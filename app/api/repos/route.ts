// This API route handles GET requests to fetch detailed information about a specific repository for the authenticated user.
// It takes the repository name as a parameter, checks if the user is authenticated, and then queries the database for the repository that matches the given name and belongs to the authenticated user. 
// If found, it returns the repository details along with the latest health score and top contributors. If not found or if there's an error, it returns an appropriate error message.
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function GET(){
    try{
        const session = await getServerSession(authOptions)

        if(!session?.user?.email)
        {
            return NextResponse.json(
                {error : "Not authenticated"},
                {status: 401}
            )
        }

        const user = await prisma.user.findUnique({
            where : {email : session.user.email },
            include : {
              repos : {
                include: {
                    // Only get the LATEST health score per repo
                    healthScores : {
                        orderBy : {calculatedAt : "desc"}
                    },
                    // Count contributors
                    _count : {
                        select : {
                            contributors : true
                        }
                    }
                }

                }
            }
        })
        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            )
            }
         return NextResponse.json({
                repositories: user.repos,
                lastSyncedAt: user.lastSyncedAt,
                })
                }
    catch(error)
    {
        console.error("Repos fetch error:", error)
        return NextResponse.json(
        { error: "Failed to fetch repos" },
        { status: 500 }
        )

    }
}   