import OpenAI from "openai";
import { ScoreBreakdown } from "./scoring";
import { DependencyResult } from "./dependencies";
import { SecurityResult } from "./security";

const openai = new OpenAI({
    apiKey : process.env.OPENAI_API_KEY
})

export type SuggestionsResult = {
    suggestions : string[]
}

export async function getAISuggestions(
    repoName: string,
    score: number,
    breakdown: ScoreBreakdown,
    dependencies: DependencyResult,
    security: SecurityResult
):  Promise<SuggestionsResult> {
try{
    const prompt = `
                    You are a GitHub repository health advisor.
                    Analyze this repository health data and give exactly 3 specific, actionable improvement suggestions.

                    Repository: ${repoName}
                    Overall Health Score: ${score}/100

                    Signal Breakdown:
                    - Commit Recency: ${breakdown.commitRecency}/100
                    - Commit Activity: ${breakdown.commitActivity}/100
                    - Issue Management: ${breakdown.issueManagement}/100
                    - PR Health: ${breakdown.prHealth}/100
                    - Documentation: ${breakdown.documentation}/100
                    - Repository Structure: ${breakdown.repoStructure}/100
                    - Popularity: ${breakdown.popularity}/100

                    Dependency Health:
                    - Total Dependencies: ${dependencies.totalDependencies}
                    - Outdated Packages: ${dependencies.outdatedCount}
                    - Vulnerable Packages: ${dependencies.vulnerableCount}

                    Security:
                    - Risk Level: ${security.riskLevel}
                    - Secrets Found: ${security.secretsFound.length}

                    Rules:
                    - Give exactly 3 suggestions
                    - Each suggestion must be specific to this repo's weakest signals
                    - Start each suggestion with an emoji, use professional emojis not face emojis
                    - Keep each suggestion under 20 words
                    - Return as JSON array of strings like: ["suggestion1", "suggestion2", "suggestion3"]
                    - Return ONLY the JSON array, nothing else
`

    const result = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7,//0.7 → balanced, good for suggestions
    })

    // Extract the text response
    const content = result.choices[0].message.content ?? "[]"

    // Parse JSON array from response
    const suggestions = JSON.parse(content)

    return { suggestions }
}
catch(error)
{
    return {
      suggestions: generateFallbackSuggestions(breakdown, dependencies, security)
    }
}
}

function generateFallbackSuggestions(
  breakdown: ScoreBreakdown,
  dependencies: DependencyResult,
  security: SecurityResult
): string[] {
  const suggestions: string[] = []

  if (breakdown.commitRecency < 50) {
    suggestions.push("⏰ Repo hasn't been updated recently — push a commit or archive it")
  }

  if (breakdown.documentation < 50) {
    suggestions.push("📝 Add or improve your README with installation and usage sections")
  }

  if (breakdown.repoStructure < 50) {
    suggestions.push("🔧 Add a .gitignore and GitHub Actions workflow to improve structure")
  }

  if (dependencies.vulnerableCount > 0) {
    suggestions.push(`🔒 Fix ${dependencies.vulnerableCount} vulnerable dependencies — run npm audit fix`)
  }

  if (dependencies.outdatedCount > 0) {
    suggestions.push(`📦 Update ${dependencies.outdatedCount} outdated packages to latest versions`)
  }
  if (security.secretsFound.length > 0) {
    suggestions.push("🚨 Secrets detected in repo — rotate exposed keys immediately")
  }

  // Return max 3 suggestions
  return suggestions.slice(0, 3)
}