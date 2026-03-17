import {
  fetchUserRepos,
  fetchRepoContributors,
  fetchRepoCommits,
  fetchRepoPullRequests,
  fetchRepoIssues,
  fetchRepoContent,
  fetchPackageJson,
  fetchCommitActivity,
} from "@/lib/github";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { calculateHealthScore } from "@/lib/scoring";
import { checkDependencyHealth } from "@/lib/dependencies";
import { scanSecurity } from "@/lib/security";
import { getAISuggestions } from "@/lib/suggestions";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// This API route handles POST requests to synchronize the authenticated user's GitHub repositories with the application's database.
export async function POST() {
  try {
    //getServerSession() returns the current logged in user
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    //get userinfo from db
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user?.accessToken) {
      return NextResponse.json(
        { error: "access token not found" },
        { status: 400 },
      );
    }

    // If the user exists and has an access token, we proceed to sync their repositories.
    const githubRepos = await fetchUserRepos(user.accessToken);

    for (const repo of githubRepos) {
      await prisma.repositories.upsert({
        where: { githubId: repo.id },
        create: {
          githubId: repo.id,
          name: repo.name,
          description: repo.description,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          language: repo.language,
          userId: user.id,
        },
        update: {
          name: repo.name,
          description: repo.description,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          language: repo.language,
        },
      });

      try {
        // For each repository, we fetch the contributors and their commit counts, and upsert them into the database.
        const contributors = await fetchRepoContributors(
          user.accessToken,
          repo.owner.login,
          repo.name,
        );

        const savedRepo = await prisma.repositories.findUnique({
          where: {
            githubId: repo.id,
          },
        });

        for (const contributor of contributors) {
          await prisma.contributor.upsert({
            where: {
              id: `${repo.id}-${contributor.login}`,
            },
            create: {
              id: `${repo.id}-${contributor.login}`,
              githubUsername: contributor.login!,
              commitCount: contributor.contributions,
              repoId: savedRepo!.id,
            },
            update: {
              commitCount: contributor.contributions,
            },
          });
        }
      } catch (error) {
        console.error(`Error syncying ${repo.name}: `, error);
      }

      try {
        // We also fetch the commits, pull requests, and issues for each repository to calculate various metrics such as total commits, open issues, average PR merge time, etc., and update the repository record in the database with these metrics.
        const commits = await fetchRepoCommits(
          user.accessToken,
          repo.owner.login,
          repo.name,
        );

        const totalCommits = commits.length;

        //const lastCommitedDate = totalCommits > 0 ? new Date(commits[0].commit.author?.date) : null
        const lastCommitDate =
          totalCommits > 0 && commits[0].commit.author?.date
            ? new Date(commits[0].commit.author.date)
            : null;
        await prisma.repositories.update({
          where: { githubId: repo.id },
          data: {
            totalCommits,
            lastCommitDate,
          },
        });

        console.log(`${repo.name} → ${totalCommits} commits`);
      } catch (error) {
        console.error(`Error syncying ${repo.name}: `, error);
      }

      try {
        // Fetch pull requests and calculate total PRs, merged PRs, and average merge time, then update the repository record in the database with these metrics.
        const pulls = await fetchRepoPullRequests(
          user.accessToken,
          repo.owner.login,
          repo.name,
        );

        const totalPRs = pulls.length;
        const mergedPRs = pulls.filter((pr) => pr.merged_at != null).length;

        //to calculate avg merge time
        const mergedPulls = pulls.filter((pr) => pr.merged_at != null);
        const avgPRMergeTime =
          mergedPulls.length > 0
            ? mergedPulls.reduce((sum, pr) => {
                const created = new Date(pr.created_at).getTime(); //ms
                const merged = new Date(pr.merged_at!).getTime(); //ms
                return sum + (merged - created) / (1000 * 60 * 60);
              }, 0) / mergedPulls.length
            : 0;
        await prisma.repositories.update({
          where: { githubId: repo.id },
          data: { totalPRs, mergedPRs, avgPRMergeTime },
        });
        console.log(
          `${repo.name} → ${totalPRs} PRs, avg merge time: ${avgPRMergeTime.toFixed(1)}hrs`,
        );
      } catch (error) {
        console.error(`Error syncying ${repo.name}: `, error);
      }

      try {
        // Fetch issues and calculate total issues, open issues, and average issue close time, then update the repository record in the database with these metrics.
        const issues = await fetchRepoIssues(
          user.accessToken,
          repo.owner.login,
          repo.name,
        );
        const realIssues = issues.filter((issue) => !issue.pull_request);
        const totalIssues = realIssues.length;

        const openIssues = realIssues.filter((i) => i.state == "open").length;

        //avg closing time
        const closedIssues = realIssues.filter(
          (issue) => issue.closed_at !== null,
        );
        const avgIssueCloseTime =
          closedIssues.length > 0
            ? closedIssues.reduce((sum, issue) => {
                const created = new Date(issue.created_at).getTime();
                const closed = new Date(issue.closed_at!).getTime();
                return sum + (closed - created) / (1000 * 60 * 60);
              }, 0) / closedIssues.length
            : 0;

        await prisma.repositories.update({
          where: { githubId: repo.id },
          data: { totalIssues, openIssues, avgIssueCloseTime },
        });
        console.log(
          `${repo.name} → ${totalIssues} issues, avg close time: ${avgIssueCloseTime.toFixed(1)}hrs`,
        );
      } catch (error) {
        console.error(`Error syncying ${repo.name}: `, error);
      }

      // Calculate and store health score
      try {
        //fetcts repo content
        const contents = await fetchRepoContent(
          user.accessToken,
          repo.owner.login,
          repo.name,
        );

        //fetches package json in decoded format and converts to string
        const packageJson = await fetchPackageJson(
          user.accessToken,
          repo.owner.login,
          repo.name,
        );

        const repoData = await prisma.repositories.findUnique({
          where: { githubId: repo.id },
        });

        if (!repoData) continue;

        // Calculate the health score using the various metrics and content of the repository.
        const { score, breakdown } = calculateHealthScore(
          {
            lastCommitDate: repoData.lastCommitDate,
            totalCommits: repoData.totalCommits,
            openIssues: repoData.openIssues,
            totalIssues: repoData.totalIssues,
            avgPRMergeTime: repoData.avgPRMergeTime,
            totalPRs: repoData.totalPRs,
            stars: repoData.stars,
            description: repoData.description,
          },
          contents,
        );

        // Check dependency health
        const dependencyResult = await checkDependencyHealth(packageJson);

        // Scan security
        const securityResult = await scanSecurity(
          user.accessToken,
          repo.owner.login,
          repo.name,
        );

        // Get AI suggestions
        const { suggestions } = await getAISuggestions(
          repo.name,
          score,
          breakdown,
          dependencyResult,
          securityResult,
        );

        // Save everything to HealthScore table
        await prisma.healthScore.create({
          data: {
            score,
            breakdown,
            suggestions,
            vulnerabilities: dependencyResult.vulnerabilities,
            dependencyData: {
              totalDependencies: dependencyResult.totalDependencies,
              outdatedCount: dependencyResult.outdatedCount,
              vulnerableCount: dependencyResult.vulnerableCount,
              outdatedPackages: dependencyResult.outdatedPackages,
              dependencyScore: dependencyResult.dependencyScore,
            },
            securityData: {
              riskLevel: securityResult.riskLevel,
              securityScore: securityResult.securityScore,
              secretsFound: securityResult.secretsFound,
            },
            repoId: repoData.id,
          },
        });

        console.log(`${repo.name} → health score: ${score}`);
      } catch (error) {
        console.error(`Health score error for ${repo.name}:`, error);
      }

      try {
        // Fetch commit activity for the past year and store it in the database. This data can be used to analyze trends in commit activity over time.
        const activity = await fetchCommitActivity(
          user.accessToken,
          repo.owner.login,
          repo.name,
        );

        await prisma.repositories.update({
          where: { githubId: repo.id },
          data: {
            commitActivity:
              Array.isArray(activity) && activity.length > 0
                ? activity.slice(-6).map((week) => ({
                    week: week.week,
                    total: week.total,
                  }))
                : undefined,
          },
        });
      } catch (error) {
        console.error(`Health score error for ${repo.name}:`, error);
      }
    }

    // After syncing all repositories, we update the user's last synced time in the database and return a success response with the count of synced repositories.
    // Delete repos that no longer exist on GitHub
const githubRepoIds = githubRepos.map((r) => r.id);
await prisma.repositories.deleteMany({
  where: {
    userId: user.id,
    githubId: { notIn: githubRepoIds },
  },
});

// After syncing all repositories, we update the user's last synced time
await prisma.user.update({
  where: { id: user.id },
  data: { lastSyncedAt: new Date() },
});

    return NextResponse.json({
      success: true,
      repoCount: githubRepos.length,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
