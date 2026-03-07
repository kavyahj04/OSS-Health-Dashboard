export type DependencyResult = {
  totalDependencies: number
  outdatedCount: number
  vulnerableCount: number
  outdatedPackages: OutdatedPackage[]
  vulnerabilities: Vulnerability[]
  dependencyScore: number
}

export type OutdatedPackage = {
  name: string
  currentVersion: string
  latestVersion: string
}

export type Vulnerability = {
  packageName: string
  version: string
  severity: string
  description: string
  id: string
}

// Cleans version string for comparison
// "^4.17.11" → "4.17.11"
// "~2.0.0"   → "2.0.0"
function cleanVersion(version: string): string {
  return version.replace(/[\^~>=<]/g, "").trim()
}

async function checkNpmVersion(packageName: string,currentVersion: string): Promise<OutdatedPackage | null>{
    try {
        const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`)

        if(!response.ok) return null

        const data = await response.json()
        const latestVersion = data.version
        const cleaned = cleanVersion(currentVersion)

        if (cleaned !== latestVersion) {
            return {
                name: packageName,
                currentVersion: cleaned,
                latestVersion,
            }
            }
        return null

    }
    catch(error){
        return null
    }
}

async function checkOSVVulnerabilities(packageName: string, version: string) : Promise<Vulnerability[] > {
    try {
        const response = await fetch("https://api.osv.dev/v1/query", {
            method : "POST",
            headers : {"Content-Type" : "application/json"},
            body : JSON.stringify({
                version : cleanVersion(version),
                package  : {
                    name: packageName,
                    ecosystem: "npm",
                },
            }),
        })
        if (!response.ok) return []

        const data = await response.json()

        if (!data.vulns || data.vulns.length === 0) return []

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data.vulns.map((vuln: any) => ({
            packageName,
            version : cleanVersion(version),
            severity: vuln.database_specific?.severity ?? "UNKNOWN",
            description: vuln.summary ?? "No description available",
            id: vuln.id,
        })
    )
    }
    catch(error) {
        return []
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkDependencyHealth(packageJson: any) : Promise<DependencyResult>{
  
    // Repo has no package.json
  if (!packageJson) {
    return {
      totalDependencies: 0,
      outdatedCount: 0,
      vulnerableCount: 0,
      outdatedPackages: [],
      vulnerabilities: [],
      dependencyScore: 100, // no deps = no problems
    }
  }

  //Comibe all dependencies
  const allDeps = {...packageJson.dependencies, ...packageJson.devDependencies,}
   
  const packageNames = Object.keys(allDeps)

  if (packageNames.length === 0) {
    return {
      totalDependencies: 0,
      outdatedCount: 0,
      vulnerableCount: 0,
      outdatedPackages: [],
      vulnerabilities: [],
      dependencyScore: 100,
    }
  }

  //parell checking of all packages to save time
  // Promise.all runs all checks simultaneously

  const [outdatedResults, vulnerabilityResults] = await Promise.all([

    //access key and value 
    Promise.all(packageNames.map(p => checkNpmVersion(p, allDeps[p] ?? ""))),
    Promise.all(packageNames.map(p => checkOSVVulnerabilities(p, allDeps[p] ?? "")))
  ])

  // Filter out nulls from outdated results
  const outdatedPackages = outdatedResults.filter((r): r is OutdatedPackage => r !== null)

  // Flatten vulnerability arrays
  const vulnerabilities = vulnerabilityResults.flat()

  const totalDependencies = packageNames.length
  const outdatedCount = outdatedPackages.length
  const vulnerableCount = vulnerabilities.length


  const dependencyScore = calculateDependencyScore(
        totalDependencies,
        outdatedCount,
        vulnerableCount
  )

    return {
        totalDependencies,
        outdatedCount,
        vulnerableCount,
        outdatedPackages,
        vulnerabilities,
        dependencyScore,
    }
    }

    function calculateDependencyScore(total: number,outdated: number,vulnerable: number) : number
    {
        let score = 100
        const outdatedRatio = outdated / total
        const vulnerableRatio = vulnerable / total


        score -= Math.round(outdatedRatio * 40)    // max -40 for outdated
        score -= Math.round(vulnerableRatio * 60)  // max -60 for vulnerable

        return Math.max(0, score)  // never below 

    }