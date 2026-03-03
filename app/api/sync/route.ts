import {fetchUserRepos,
  fetchRepoContributors,
  fetchRepoCommits,
  fetchRepoPullRequests,
  fetchRepoIssues,} from "@/lib/github";
  import { getServerSession } from "next-auth";
  import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

  export async function POST() {
    try{
        //getServerSession() returns the current logged in user
        const session = await getServerSession();

        if(!session?.user?.email)
        {
            return NextResponse.json(
                {error : "Not authenticated"},
                {status: 401}
            )
        }

        //get userinfo from db 
        const user = await prisma.user.findUnique({
            where:{email: session.user.email}
        })

        if(!user?.accessToken)
        {
            return NextResponse.json(
                {error : "access token not found" },
                {status : 400}
                
            )
        }

        const githubRepos = await fetchUserRepos(user.accessToken);

        for (const repo of githubRepos)
        {
            await prisma.repositories.upsert({
                where:{githubId: repo.id},
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
                }
            })

            try {
                const contributors = await fetchRepoContributors(user.accessToken, repo.owner.login, repo.name)

                const savedRepo = await prisma.repositories.findUnique({
                    where: {
                        githubId: repo.id
                    }
                })

                for(const contributor of contributors)
                {
                    await prisma.contributor.upsert({
                        where : {
                            id: `${repo.id}-${contributor.login}`
                        },
                        create : {
                            id: `${repo.id}-${contributor.login}`,
                            githubUsername: contributor.login!,
                            commitCount: contributor.contributions,
                            repoId: savedRepo!.id,
                        },
                        update : {
                            commitCount: contributor.contributions,
                        },
                    })
                }
            }
            catch(error){
                console.error(`Error syncying ${repo.name}: `, error)
            }
            
            try{
                const commits = await fetchRepoCommits(user.accessToken, repo.owner.login, repo.name)

                const totalCommits = commits.length

                //const lastCommitedDate = totalCommits > 0 ? new Date(commits[0].commit.author?.date) : null
                const lastCommitDate = totalCommits > 0 && commits[0].commit.author?.date ? new Date(commits[0].commit.author.date) : null;
                await prisma.repositories.update({
                    where : {githubId: repo.id}, 
                    data : { 
                        totalCommits,
                        lastCommitDate
                    }
                })

            console.log(`${repo.name} → ${totalCommits} commits`)
            }
            catch(error){
                console.error(`Error syncying ${repo.name}: `, error)
            }

            try{
                const pulls = await fetchRepoPullRequests(user.accessToken, repo.owner.login, repo.name)
                
                const totalPRs = pulls.length
                const mergedPRs = pulls.filter(pr => pr.merged_at != null).length

                //to calculate avg merge time 
                const mergedPulls = pulls.filter(pr => pr.merged_at != null)
                const avgPRMergeTime = mergedPulls.length > 0 ? mergedPulls.reduce((sum, pr) => {
                    const created = new Date(pr.created_at).getTime() //ms
                    const merged =  new Date(pr.merged_at!).getTime() //ms
                    return sum + (merged - created)/(1000 * 60 * 60)
                },0)/mergedPulls.length
                :
                0
                await prisma.repositories.update({
                            where: { githubId: repo.id },
                            data: { totalPRs, mergedPRs, avgPRMergeTime }
                        })
                console.log(`${repo.name} → ${totalPRs} PRs, avg merge time: ${avgPRMergeTime.toFixed(1)}hrs`)
            }
            catch(error){
                console.error(`Error syncying ${repo.name}: `, error)
            }

            try{
                const issues = await fetchRepoIssues( user.accessToken,repo.owner.login,repo.name)
                const realIssues = issues.filter(issue => !issue.pull_request)
                const totalIssues = realIssues.length

                const openIssues = realIssues.filter(i => i.state == "open").length

                //avg closing time 
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
                data: { totalIssues, openIssues, avgIssueCloseTime }
            })
                console.log(`${repo.name} → ${totalIssues} issues, avg close time: ${avgIssueCloseTime.toFixed(1)}hrs`)
            }
            catch(error){
                console.error(`Error syncying ${repo.name}: `, error)
            }
        }
        return NextResponse.json({
        success: true,
        repoCount: githubRepos.length,
    })
    }


    catch(error){
        console.error("Sync error:", error)
        return NextResponse.json(
        { error: "Sync failed" },
        { status: 500 })
    }
  }