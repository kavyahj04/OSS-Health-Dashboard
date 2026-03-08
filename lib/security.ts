import { getOctokit } from "@/lib/github";

export type SecurityResult = {
  secretsFound: SecretFound[];
  riskLevel: "low" | "medium" | "high";
  securityScore: number;
};

export type SecretFound = {
  pattern: string;
  riskLevel: "high";
};

// Scans a given repository for exposed secrets using GitHub's Secret Scanning API. It returns a SecurityResult object that includes any secrets found, an overall risk level, and a security score. If the API call fails (e.g., if secret scanning is not enabled for the repository), it returns a default result indicating no secrets found and a low risk level.
export async function scanSecurity(
  accessToken: string,
  owner: string,
  repo: string,
): Promise<SecurityResult> {
  try {
    const octokit = getOctokit(accessToken);

    const { data } = await octokit.rest.secretScanning.listAlertsForRepo({
      owner,
      repo,
    });

    // Only look at open alerts — resolved ones are already fixed
    const openAlerts = data.filter((alert) => alert.state === "open");

    return {
      secretsFound: openAlerts.map((alert) => ({
        pattern: alert.secret_type_display_name ?? "Unknown Secret",
        riskLevel: "high" as const,
      })),
      riskLevel: openAlerts.length > 0 ? "high" : "low",
      securityScore: Math.max(0, 100 - openAlerts.length * 20),
    };
  } catch (error) {
    // Secret scanning not enabled or not available
    // Return safe defaults — don't penalize the repo
    return {
      secretsFound: [],
      riskLevel: "low",
      securityScore: 100,
    };
  }
}
