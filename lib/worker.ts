// This file defines two workers using the BullMQ library: 
// one for synchronizing repository data from GitHub and calculating health scores, 
// and another for sending weekly email digests to users. 
// The sync worker fetches various metrics about the user's repositories, calculates a health score based on those metrics, 
// checks dependencies and security, and saves everything to the database. 
// The email worker retrieves the latest health scores for the user's repositories and sends a summary email with suggestions for improvement.

import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { redisConnection } from "@/lib/queue";
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
import { sendWeeklyDigest } from "@/lib/email";
import { emailQueue } from "@/lib/queue";
import { calculateHealthScore } from "./scoring";
import { checkDependencyHealth } from "./dependencies";
import { getAISuggestions } from "./suggestions";
import { scanSecurity } from "./security";


// The createSyncWorker function sets up a worker that listens to the "repo-sync" queue.
// When a job is added to this queue, the worker executes a function that takes the user's ID, access token, and GitHub username as input.
// It then fetches all repositories for that user from GitHub, and for each repository, it gathers various metrics such as contributors, commits, pull requests, and issues.
// It calculates a health score for each repository based on these metrics, checks the dependency health and security status, and generates AI-driven suggestions for improvement.
// Finally, it saves all this information to the database and updates the user's last synced time. The worker also logs progress and handles errors gracefully.

export function createSyncWorker() {
  //creates a worker that listens to repo-sync
  const worker = new Worker(
    "repo-sync",
    async (job) => {
      const { userId, accessToken, githubUsername } = job.data;
      console.log(`Starting sync for user: ${githubUsername}`);

      // Fetch all repos from GitHub
      const githubRepos = await fetchUserRepos(accessToken);

      for (const repo of githubRepos) {
        const savedRepo = await prisma.repositories.upsert({
          where: { githubId: repo.id },
          create: {
            githubId: repo.id,
            name: repo.name,
            description: repo.description,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
            userId,
          },
          update: {
            name: repo.name,
            description: repo.description,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
          },
        });
        // Fetch contributors
        try {
          const contributors = await fetchRepoContributors(
            accessToken,
            repo.owner.login,
            repo.name,
          );
          for (const contributor of contributors) {
            await prisma.contributor.upsert({
              where: { id: `${repo.id}-${contributor.login}` },
              create: {
                id: `${repo.id}-${contributor.login}`,
                githubUsername: contributor.login!,
                commitCount: contributor.contributions,
                repoId: savedRepo.id,
              },
              update: { commitCount: contributor.contributions },
            });
          }
        } catch (error) {
          console.error(`Contributors error for ${repo.name}:`, error);
        }

        // Fetch commit metrics
        try {
          const commits = await fetchRepoCommits(
            accessToken,
            repo.owner.login,
            repo.name,
          );

          const totalCommits = commits.length;
          const lastCommitDate =
            totalCommits > 0 && commits[0].commit.author?.date
              ? new Date(commits[0].commit.author.date)
              : null;

          await prisma.repositories.update({
            where: { githubId: repo.id },
            data: { totalCommits, lastCommitDate },
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          if (error?.status === 409) {
            console.log(`${repo.name} → empty repo, skipping`);
          } else {
            console.error(`Commits error for ${repo.name}:`, error);
          }
        }

        // Fetch PR metrics
        try {
          const pulls = await fetchRepoPullRequests(
            accessToken,
            repo.owner.login,
            repo.name,
          );
          const totalPRs = pulls.length;
          const mergedPRs = pulls.filter((pr) => pr.merged_at !== null).length;
          const mergedPulls = pulls.filter((pr) => pr.merged_at !== null);
          const avgPRMergeTime =
            mergedPulls.length > 0
              ? mergedPulls.reduce((sum, pr) => {
                  const created = new Date(pr.created_at).getTime();
                  const merged = new Date(pr.merged_at!).getTime();
                  return sum + (merged - created) / (1000 * 60 * 60);
                }, 0) / mergedPulls.length
              : 0;
          await prisma.repositories.update({
            where: { githubId: repo.id },
            data: { totalPRs, mergedPRs, avgPRMergeTime },
          });
        } catch (error) {
          console.error(`PRs error for ${repo.name}:`, error);
        }

        // Fetch issue metrics
        try {
          const issues = await fetchRepoIssues(
            accessToken,
            repo.owner.login,
            repo.name,
          );
          const realIssues = issues.filter((issue) => !issue.pull_request);
          const totalIssues = realIssues.length;
          const openIssues = realIssues.filter(
            (issue) => issue.state === "open",
          ).length;
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
        } catch (error) {
          console.error(`Issues error for ${repo.name}:`, error);
        }
        try {
          //fetcts repo content
          const contents = await fetchRepoContent(
            accessToken,
            repo.owner.login,
            repo.name,
          );

          //fetches package json in decoded format and converts to string
          const packageJson = await fetchPackageJson(
            accessToken,
            repo.owner.login,
            repo.name,
          );

          const repoData = await prisma.repositories.findUnique({
            where: { githubId: repo.id },
          });

          if (!repoData) continue;

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
            accessToken,
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
          const activity = await fetchCommitActivity(
            accessToken,
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

      await prisma.user.update({
        where: { id: userId },
        data: { lastSyncedAt: new Date() },
      });
      console.log(
        `Sync complete for ${githubUsername} — ${githubRepos.length} repos`,
      );
      return { repoCount: githubRepos.length };
    },
    { connection: redisConnection },
  );

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Job ${job?.id} failed:`, error);
  });

  return worker;
}

// The createEmailWorker function sets up a worker that listens to the "weekly-email" queue.
// When a job is added to this queue, the worker executes a function that takes the user's ID as input.
// It retrieves the user's email and all their repositories along with the latest health scores from the database.
// It then compiles a summary of each repository's health score, previous score for comparison, and suggestions for improvement.
// Finally, it sends a weekly digest email to the user with this information and logs the action.
export function createEmailWorker() {
  const worker = new Worker(
    "weekly-email",
    async (job) => {
      const { userId } = job.data;

      // Get user with all repos and latest health scores
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          repos: {
            include: {
              healthScores: {
                orderBy: { calculatedAt: "desc" },
                take: 2, // latest + previous for comparison
              },
            },
          },
        },
      });

      if (!user?.email) return;

      const reposWithScores = user.repos.filter(
        (r) => r.healthScores.length > 0,
      );

      if (reposWithScores.length === 0) return;

      const repoSummaries = reposWithScores.map((repo) => ({
        name: repo.name,
        score: Math.round(repo.healthScores[0].score),
        previousScore: repo.healthScores[1]
          ? Math.round(repo.healthScores[1].score)
          : undefined,
        suggestions: repo.healthScores[0].suggestions as string[],
      }));

      await sendWeeklyDigest(
        user.email,
        user.name ?? "Developer",
        repoSummaries,
      );

      console.log(`Weekly digest sent to ${user.email}`);
    },
    { connection: redisConnection },
  );

  return worker;
}
