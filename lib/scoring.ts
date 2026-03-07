//Signal-1 - Commit Recency
function scoreCommitRecency(lastCommitDate: Date | null) : number {
    if(!lastCommitDate)
        return 0
    
    
    //1000        → milliseconds per second
    // 1000 * 60   → milliseconds per minute
    // 1000 * 60 * 60      → milliseconds per hour
    // 1000 * 60 * 60 * 24 → milliseconds per day (86,400,000)
    
    //to check how many days ago last commit was 
    const daysSince = Math.floor(
    (Date.now() - new Date(lastCommitDate).getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysSince <= 7)   return 100
    if (daysSince <= 30)  return 80
    if (daysSince <= 90)  return 50
    if (daysSince <= 180) return 20
    return 0
}

//Signal-2 - Commit Activity 
function scoreCommitActivity(totalCommits: number) :  number {
    if (totalCommits >= 50) return 100
    if (totalCommits >= 30) return 80
    if (totalCommits >= 20) return 60
    if (totalCommits >= 10)  return 40
    if (totalCommits >= 6)  return 20
    return 10
}

//Signal-3 - Issue Management 
function scoreIssueManagement(openIssues: number, totalIssues: number) : number {
    if (totalIssues === 0) return 50

    const openRatio = openIssues / totalIssues

    if (openRatio === 0)    return 100
    if (openRatio < 0.25)   return 80
    if (openRatio < 0.50)   return 60
    if (openRatio < 0.75)   return 30
    return 10
}

//Signal-4 - PR Health 
function scorePRHealth(avgPRMergeTime: number, totalPRs: number): number{
    if (totalPRs === 0) return 50

  // avgPRMergeTime is stored in hours
  if (avgPRMergeTime < 24)   return 100  // less than 1 day
  if (avgPRMergeTime < 72)   return 80   // less than 3 days
  if (avgPRMergeTime < 168)  return 60   // less than 1 week
  if (avgPRMergeTime < 720)  return 30   // less than 1 month
  return 10
}

//Signal-5 - Documentation Quality 

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoreDocumentation(contents: any[], description: string | null) : number {

    let score = 0
    
    // Get all file names in root
    const fileNames = contents.map(f => f.name.toLowerCase())
    
    // README exists
    const hasReadme = fileNames.some(f => f.startsWith("readme"))

    if(hasReadme) score += 40

    const hasLicense = fileNames.some(f => f.startsWith("license"))
    if (hasLicense) score += 20

    //Check readme file has content
    const readmeFile = contents.find(f => f.name.toLowerCase().startsWith("readme"))

    if(hasReadme && readmeFile.size > 200 ) score += 20

    if(description && description.trim().length > 0) score += 20
    
    return score 
}

//Signal-6 - Repository Structure

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoreRepoStructure(contents:any[]) : number {
    let score = 0 

    const fileNames = contents.map(f => f.name.toLowerCase())

    const hasGitIgnore = fileNames.includes(".gitignore")

    if(hasGitIgnore) score += 40

    const hasCICD = fileNames.includes(".github")

    if(hasCICD) score += 40

    const hasContributing = fileNames.some(f => f.startsWith("contributing"))
    
    if(hasContributing) score += 20

    return score
}


//Signal- 7 - Popularity 

function scorePopularity(stars: number ) : number {
    if(stars >= 1000) return 100
    if (stars >= 500)  return 90
    if (stars >= 100)  return 70
    if (stars >= 50)   return 50
    if (stars >= 10)   return 30

    return 10
    
}

export type ScoreBreakdown = {
    commitRecency: number
    commitActivity: number
    issueManagement: number
    prHealth: number
    documentation: number
    repoStructure: number
    popularity: number
    final: number
}

export type HealthScoreResult = {
  score: number
  breakdown: ScoreBreakdown
}

export function calculateHealthScore(
    repo :{
    lastCommitDate: Date | null
    totalCommits: number
    openIssues: number
    totalIssues: number
    avgPRMergeTime: number
    totalPRs: number
    stars: number
    description: string | null
},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contents: any[]
): HealthScoreResult {

    const commitRecency    = scoreCommitRecency(repo.lastCommitDate)
    const commitActivity   = scoreCommitActivity(repo.totalCommits)
    const issueManagement  = scoreIssueManagement(repo.openIssues, repo.totalIssues)
    const prHealth         = scorePRHealth(repo.avgPRMergeTime, repo.totalPRs)
    const documentation    = scoreDocumentation(contents, repo.description)
    const repoStructure    = scoreRepoStructure(contents)
    const popularity       = scorePopularity(repo.stars)

    //Apply Weights
    const final = Math.round(
        commitRecency   * 0.20 +
        commitActivity  * 0.20 +
        issueManagement * 0.15 +
        prHealth        * 0.15 +
        documentation   * 0.15 +
        repoStructure   * 0.10 +
        popularity      * 0.05
  )

  return {
    score : final,
    breakdown : {
        commitRecency,
        commitActivity,
        issueManagement,
        prHealth,
        documentation,
        repoStructure,
        popularity,
        final
    }
  }
}