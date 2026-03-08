import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendWeeklyDigest } from "@/lib/email"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

// This API route is designed to send a weekly digest email to the authenticated user, summarizing the health scores of their repositories.
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      repos: {
        include: {
          healthScores: {
            orderBy: { calculatedAt: "desc" },
            take: 2
          }
        }
      }
    }
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const reposWithScores = user.repos.filter(r => r.healthScores.length > 0)

  const repoSummaries = reposWithScores.map(repo => ({
    name: repo.name,
    score: Math.round(repo.healthScores[0].score),
    previousScore: repo.healthScores[1]
      ? Math.round(repo.healthScores[1].score)
      : undefined,
    suggestions: repo.healthScores[0].suggestions as string[],
  }))

  await sendWeeklyDigest(
    user.email!,
    user.name ?? "Developer",
    repoSummaries
  )

  return NextResponse.json({ success: true, sent: reposWithScores.length })
}
