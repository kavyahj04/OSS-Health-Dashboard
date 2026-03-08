import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type RepoSummary = {
  name: string;
  score: number;
  previousScore?: number;
  suggestions: string[];
};

export async function sendWeeklyDigest(
  toEmail: string,
  userName: string,
  repos: RepoSummary[],
) {
  const topRepos = repos.sort((a, b) => b.score - a.score).slice(0, 5);

  const avgScore = Math.round(
    repos.reduce((sum, r) => sum + r.score, 0) / repos.length,
  );

  const avgColor =
    avgScore >= 70 ? "#16a34a" : avgScore >= 40 ? "#f97316" : "#dc2626";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f8faff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8faff; padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0;">

          <!-- HEADER -->
          <tr>
            <td style="background:#2563eb; padding:32px; text-align:center;">
              <div style="color:#ffffff; font-size:24px; font-weight:700; margin:0;">
                OSS Health Tracker
              </div>
              <div style="color:#bfdbfe; font-size:14px; margin-top:8px;">
                Your weekly repository health digest
              </div>
            </td>
          </tr>

          <!-- GREETING -->
          <tr>
            <td style="padding:32px 32px 0;">
              <div style="color:#1e293b; font-size:18px; font-weight:600; margin-bottom:8px;">
                Hi ${userName} 👋
              </div>
              <div style="color:#64748b; font-size:14px;">
                Here's your weekly health summary across
                <strong>${repos.length} repositories</strong>.
              </div>
            </td>
          </tr>

          <!-- AVG SCORE BANNER -->
          <tr>
            <td style="padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:24px; text-align:center;">
                    <div style="font-size:52px; font-weight:700; color:${avgColor};">
                      ${avgScore}
                    </div>
                    <div style="color:#64748b; font-size:13px; margin-top:6px;">
                      Average Health Score across all repos
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- TOP REPOS HEADING -->
          <tr>
            <td style="padding:0 32px 12px;">
              <div style="color:#1e293b; font-size:15px; font-weight:600;">
                Top Repositories
              </div>
            </td>
          </tr>

          <!-- REPO LIST -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${topRepos
                  .map((repo) => {
                    const color =
                      repo.score >= 70
                        ? "#16a34a"
                        : repo.score >= 40
                          ? "#f97316"
                          : "#dc2626";
                    const change =
                      repo.previousScore != null
                        ? repo.score - repo.previousScore
                        : null;
                    return `
                  <tr>
                    <td style="padding-bottom:8px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff; border:1px solid #e2e8f0; border-radius:8px;">
                        <tr>
                          <td style="padding:14px 16px;">
                            <div style="font-weight:600; color:#1e293b; font-size:14px;">
                              ${repo.name}
                            </div>
                            ${
                              change !== null
                                ? `
                            <div style="font-size:12px; color:${change >= 0 ? "#16a34a" : "#dc2626"}; margin-top:4px;">
                              ${change >= 0 ? "↑" : "↓"} ${Math.abs(change)} points from last week
                            </div>
                            `
                                : `
                            <div style="font-size:12px; color:#94a3b8; margin-top:4px;">
                              First scan this week
                            </div>
                            `
                            }
                          </td>
                          <td style="padding:14px 16px; text-align:right; vertical-align:middle;">
                            <div style="font-size:24px; font-weight:700; color:${color};">
                              ${repo.score}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  `;
                  })
                  .join("")}
              </table>
            </td>
          </tr>

          <!-- SUGGESTIONS HEADING -->
          <tr>
            <td style="padding:0 32px 12px;">
              <div style="color:#1e293b; font-size:15px; font-weight:600;">
                💡 Top Suggestions This Week
              </div>
            </td>
          </tr>

          <!-- SUGGESTIONS LIST -->
          <tr>
            <td style="padding:0 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${repos
                  .flatMap((r) => r.suggestions)
                  .slice(0, 3)
                  .map(
                    (s) => `
                  <tr>
                    <td style="padding-bottom:8px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:12px 16px; font-size:13px; color:#1e293b; line-height:1.6;">
                            ${s}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  `,
                  )
                  .join("")}
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f8faff; border-top:1px solid #e2e8f0; padding:20px 32px; text-align:center;">
              <div style="color:#94a3b8; font-size:12px;">
                OSS Health Tracker · Sent every Sunday · Built with Next.js
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `;

  await resend.emails.send({
    from: "OSS Health Tracker <onboarding@resend.dev>",
    to: toEmail,
    subject: `📊 Your Weekly Repo Health Digest — Avg Score: ${avgScore}`,
    html,
  });
}
