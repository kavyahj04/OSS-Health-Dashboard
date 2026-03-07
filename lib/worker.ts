import { Worker } from "bullmq";
import {prisma} from "@/lib/prisma"
import {redisConnection} from "@/lib/queue"
import {
  fetchUserRepos,
  fetchRepoContributors,
  fetchRepoCommits,
  fetchRepoPullRequests,
  fetchRepoIssues,
} from "@/lib/github"

export function createSyncWorker(){
    
    //creates a worker that listens to repo-sync
    const worker = new Worker(
        "repo-sync",
        async(job) => {
            const {userId, accessToken, githubUsername} = job.data
            console.log(`Starting sync for user: ${githubUsername}`)

            // Fetch all repos from GitHub
        const githubRepos = await fetchUserRepos(accessToken)

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
        })
        // Fetch contributors
        try {
          const contributors = await fetchRepoContributors(
            accessToken,
            repo.owner.login,
            repo.name
          )
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
            })
          }
        } catch (error) {
          console.error(`Contributors error for ${repo.name}:`, error)
        }

        // Fetch commit metrics
        try {
          const commits = await fetchRepoCommits(
            accessToken,
            repo.owner.login,
            repo.name
          )

          const totalCommits = commits.length
          const lastCommitDate = totalCommits > 0 && commits[0].commit.author?.date
            ? new Date(commits[0].commit.author.date)
            : null

          await prisma.repositories.update({
            where: { githubId: repo.id },
            data: { totalCommits, lastCommitDate },
          })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          if (error?.status === 409) {
            console.log(`${repo.name} → empty repo, skipping`)
          } else {
            console.error(`Commits error for ${repo.name}:`, error)
          }
        }

        // Fetch PR metrics
        try {
          const pulls = await fetchRepoPullRequests(
            accessToken,
            repo.owner.login,
            repo.name
          )
          const totalPRs = pulls.length
          const mergedPRs = pulls.filter(pr => pr.merged_at !== null).length
          const mergedPulls = pulls.filter(pr => pr.merged_at !== null)
          const avgPRMergeTime = mergedPulls.length > 0
            ? mergedPulls.reduce((sum, pr) => {
                const created = new Date(pr.created_at).getTime()
                const merged = new Date(pr.merged_at!).getTime()
                return sum + (merged - created) / (1000 * 60 * 60)
              }, 0) / mergedPulls.length
            : 0
             await prisma.repositories.update({
            where: { githubId: repo.id },
            data: { totalPRs, mergedPRs, avgPRMergeTime },
          })
        } catch (error) {
          console.error(`PRs error for ${repo.name}:`, error)
        }
        
        // Fetch issue metrics
        try {
          const issues = await fetchRepoIssues(
            accessToken,
            repo.owner.login,
            repo.name
          )
          const realIssues = issues.filter(issue => !issue.pull_request)
          const totalIssues = realIssues.length
          const openIssues = realIssues.filter(issue => issue.state === "open").length
          const closedIssues = realIssues.filter(issue => issue.closed_at !== null)
          const avgIssueCloseTime = closedIssues.length > 0
            ? closedIssues.reduce((sum, issue) => {
                const created = new Date(issue.created_at).getTime()
                const closed = new Date(issue.closed_at!).getTime()
                return sum + (closed - created) / (1000 * 60 * 60)
              }, 0) / closedIssues.length
            : 0

          await prisma.repositories.update({
            where: { githubId: repo.id },
            data: { totalIssues, openIssues, avgIssueCloseTime },
          })
        } catch (error) {
          console.error(`Issues error for ${repo.name}:`, error)
        }

        }

        await prisma.user.update({
            where : {id : userId},
            data : {lastSyncedAt: new Date()}
        })
        console.log(`Sync complete for ${githubUsername} — ${githubRepos.length} repos`)
        return { repoCount: githubRepos.length }

        },
        { connection: redisConnection}
    )

    worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`)
    })

   worker.on("failed", (job, error) => {
    console.error(`Job ${job?.id} failed:`, error)
    })

  return worker
}