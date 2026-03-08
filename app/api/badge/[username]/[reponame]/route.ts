import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// This API route generates an SVG badge for a given GitHub repository's health score.
// It takes the GitHub username and repository name as parameters, 
// looks up the latest health score for that repository in the database, 
// and returns an SVG badge with the score and a color indicating the health level (green for good, orange for warning, red for bad). If the repository or score is not found, it returns a badge with "unknown" and a gray color. The badge is cached for 1 hour to improve performance.
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

// Helper function to generate an SVG badge with the given score and color.
// The badge has a fixed width and height, with the left side displaying "OSS Health" and the right side displaying the score. 
// The colors indicate the health level, and the badge is designed to be visually appealing and easy to read.
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