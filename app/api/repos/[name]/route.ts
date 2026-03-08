import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params  // ← await params
    const repoName = decodeURIComponent(name)

    console.log("Looking for repo:", repoName)
    const session = await getServerSession()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }
    console.log(user)

    const repo = await prisma.repositories.findFirst({
      where: {
        name: repoName,
        userId: user.id
      },
      include: {
        healthScores: {
          orderBy: { calculatedAt: "desc" },
          take: 1,
        },
        contributors: {
          orderBy: { commitCount: "desc" },
          take: 5,
        },
        _count: {
          select: { contributors: true }
        }
      }
    })

    console.log("Found repo:", repo?.name)

    if (!repo) {
      return NextResponse.json(
        { error: "Repo not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ repo })

  } catch (error) {
    console.error("Repo fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch repo" },
      { status: 500 }
    )
  }
}