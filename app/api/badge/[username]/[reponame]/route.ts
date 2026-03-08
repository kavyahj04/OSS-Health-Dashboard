import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string; reponame: string }> },
) {
  try {
    const { username, reponame } = await params;

    const user = await prisma.user.findFirst({
      where: { githubUsername: username },
    });

    if (!user) {
      return badgeSVG("unknown", "#94a3b8");
    }

    // Find repo with latest health score
    const repo = await prisma.repositories.findFirst({
      where: {
        name: reponame,
        userId: user.id,
      },
      include: {
        healthScores: {
          orderBy: { calculatedAt: "desc" },
          take: 1,
        },
      },
    });
    if (!repo || repo.healthScores.length === 0) {
      return badgeSVG("unknown", "#94a3b8");
    }
    const score = Math.round(repo.healthScores[0].score);

    const color =
      score >= 70
        ? "#16a34a" // green
        : score >= 40
          ? "#f97316" // orange
          : "#dc2626"; // red

    return badgeSVG(score.toString(), color);

  } catch (error) {
    return badgeSVG("error", "#dc2626")
  }
}


function badgeSVG(score: string, color: string) {
  const leftWidth = 110
  const rightWidth = 60
  const totalWidth = leftWidth + rightWidth
  const height = 20

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}">
  <defs>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".1"/>
      <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
    <clipPath id="r">
      <rect width="${totalWidth}" height="${height}" rx="3"/>
    </clipPath>
  </defs>

  <g clip-path="url(#r)">
    <!-- Left side (label) -->
    <rect width="${leftWidth}" height="${height}" fill="#1e293b"/>
    <!-- Right side (score) -->
    <rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="${color}"/>
    <!-- Gradient overlay -->
    <rect width="${totalWidth}" height="${height}" fill="url(#s)"/>
  </g>

  <!-- Left text: OSS Health -->
  <text
    x="${leftWidth / 2}"
    y="14"
    font-family="DejaVu Sans,Verdana,Geneva,sans-serif"
    font-size="11"
    fill="#fff"
    text-anchor="middle"
  >
    OSS Health
  </text>

  <!-- Right text: score -->
  <text
    x="${leftWidth + rightWidth / 2}"
    y="14"
    font-family="DejaVu Sans,Verdana,Geneva,sans-serif"
    font-size="11"
    fill="#fff"
    font-weight="bold"
    text-anchor="middle"
  >
    ${score}
  </text>
</svg>
`.trim()

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      // Cache for 1 hour
      "Cache-Control": "public, max-age=3600",
    }
  })
}