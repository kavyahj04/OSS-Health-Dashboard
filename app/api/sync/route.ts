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