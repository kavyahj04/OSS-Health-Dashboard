"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type Breakdown = {
  commitRecency: number;
  commitActivity: number;
  issueManagement: number;
  prHealth: number;
  documentation: number;
  repoStructure: number;
  popularity: number;
};

type OutdatedPackage = {
  name: string;
  currentVersion: string;
  latestVersion: string;
};

type SecretFound = {
  pattern: string;
  riskLevel: string;
};

type HealthScore = {
  score: number;
  breakdown: Breakdown;
  suggestions: string[];
  vulnerabilities: { id: string; summary: string }[];
  dependencyData: {
    totalDependencies: number;
    outdatedCount: number;
    vulnerableCount: number;
    outdatedPackages: OutdatedPackage[];
    dependencyScore: number;
  };
  securityData: {
    riskLevel: string;
    securityScore: number;
    secretsFound: SecretFound[];
  };
  calculatedAt: string;
};

type Contributor = {
  githubUsername: string;
  commitCount: number;
};

type Repo = {
  id: string;
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  totalCommits: number;
  totalPRs: number;
  mergedPRs: number;
  openIssues: number;
  totalIssues: number;
  lastCommitDate: string | null;
  healthScores: HealthScore[];
  contributors: Contributor[];
  _count: { contributors: number };
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? "#16a34a" : score >= 40 ? "#f97316" : "#dc2626";

  const label =
    score >= 70 ? "Healthy" : score >= 40 ? "Needs Work" : "Critical";

  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className="w-32 h-32 rounded-full flex flex-col items-center justify-center border-4 shadow-md"
        style={{
          borderColor: color,
          backgroundColor: `${color}15`,
        }}
      >
        <span className="text-4xl font-bold" style={{ color }}>
          {Math.round(score)}
        </span>
        <span className="text-xs font-medium mt-1" style={{ color }}>
          {label}
        </span>
      </div>
      <span className="text-xs text-slate-400 mt-2">Overall Score</span>
    </div>
  );
}

function SignalRow({ label, score }: { label: string; score: number }) {
  const color =
    score >= 70 ? "bg-green-500" : score >= 40 ? "bg-orange-500" : "bg-red-500";

  const textColor =
    score >= 70
      ? "text-green-600"
      : score >= 40
        ? "text-orange-500"
        : "text-red-500";

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-slate-600">{label}</span>
        <span className={`text-sm font-semibold ${textColor}`}>{score}</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm text-center">
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

export default function RepoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [repo, setRepo] = useState<Repo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRepo() {
      const response = await fetch(`/api/repos/${params.name}`);
      const data = await response.json();
      setRepo(data.repo);
      setLoading(false);
    }
    fetchRepo();
  }, [params.name]);

  if (loading) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{
          background:
            "linear-gradient(135deg, #bfdbfe 0%, #ffffff 40%, #fed7aa 100%)",
        }}
      >
        <div className="text-slate-400">Loading repository...</div>
      </main>
    );
  }

  if (!repo) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Repository not found</div>
      </main>
    );
  }

  const health = repo.healthScores[0];

  const radarData = health
    ? [
        { signal: "Commits", score: health.breakdown.commitRecency },
        { signal: "Activity", score: health.breakdown.commitActivity },
        { signal: "Issues", score: health.breakdown.issueManagement },
        { signal: "PRs", score: health.breakdown.prHealth },
        { signal: "Docs", score: health.breakdown.documentation },
        { signal: "Structure", score: health.breakdown.repoStructure },
        { signal: "Popularity", score: health.breakdown.popularity },
      ]
    : [];

  return (
    <main
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(135deg, #bfdbfe 0%, #ffffff 40%, #fed7aa 100%)",
      }}
    >
      {/* NAVBAR */}
      <nav className="bg-blue-600 px-8 py-4 flex items-center justify-between">
        <span className="text-white font-bold text-lg tracking-wide">
          OSS Health Tracker
        </span>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-blue-200 hover:text-white text-sm transition cursor-pointer"
        >
          ← Back to Dashboard
        </button>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* REPO HEADER */}
        <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-800">{repo.name}</h1>
              {repo.language && (
                <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-medium">
                  {repo.language}
                </span>
              )}
            </div>
            <p className="text-slate-500 text-sm mb-4">
              {repo.description ?? "No description"}
            </p>
            <div className="flex gap-5 text-sm text-slate-500">
              <span>⭐ {repo.stars} stars</span>
              <span>🍴 {repo.forks} forks</span>
              <span>📝 {repo.totalCommits} commits</span>
              <span>
                🕐 Last commit:{" "}
                {repo.lastCommitDate
                  ? new Date(repo.lastCommitDate).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
          </div>
          {health && <ScoreRing score={health.score} />}
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard label="Total PRs" value={repo.totalPRs} color="#2563eb" />
          <StatCard label="Merged PRs" value={repo.mergedPRs} color="#16a34a" />
          <StatCard
            label="Open Issues"
            value={repo.openIssues}
            color="#f97316"
          />
          <StatCard
            label="Contributors"
            value={repo._count.contributors}
            color="#7c3aed"
          />
        </div>

        {health && (
          <>
            {/* Health Summary Card */}
            <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm mb-6">
              <h2 className="text-base font-semibold text-slate-700 mb-1">
                Health Breakdown
              </h2>
              <p className="text-xs text-slate-400 mb-5">
                Each signal contributes to your overall health score
              </p>
              <div className="space-y-5">
                {[
                  {
                    label: "Commit Recency",
                    score: health.breakdown.commitRecency,
                    icon: "🕐",
                    what: "When did you last push code?",
                    how: "100 = committed this week · 0 = no commits in 6+ months",
                  },
                  {
                    label: "Commit Activity",
                    score: health.breakdown.commitActivity,
                    icon: "📈",
                    what: "How consistently do you commit?",
                    how: "100 = 50+ commits · 50 = around 10 commits · 0 = 1 or fewer",
                  },
                  {
                    label: "Issue Management",
                    score: health.breakdown.issueManagement,
                    icon: "🐛",
                    what: "Are open issues being resolved?",
                    how: "100 = all issues closed · 50 = no issues at all · 0 = all open",
                  },
                  {
                    label: "PR Health",
                    score: health.breakdown.prHealth,
                    icon: "🔀",
                    what: "How fast are pull requests merged?",
                    how: "100 = merged within hours · 50 = no PRs · 0 = takes weeks",
                  },
                  {
                    label: "Documentation",
                    score: health.breakdown.documentation,
                    icon: "📝",
                    what: "Is your repo easy to understand?",
                    how: "Points for README, LICENSE, description, and README size",
                  },
                  {
                    label: "Repo Structure",
                    score: health.breakdown.repoStructure,
                    icon: "🏗️",
                    what: "Is your repo well organized?",
                    how: "Points for .gitignore, GitHub Actions, CONTRIBUTING.md",
                  },
                  {
                    label: "Popularity",
                    score: health.breakdown.popularity,
                    icon: "⭐",
                    what: "How visible is your repo?",
                    how: "100 = 50+ stars · 50 = around 10 stars · 0 = no stars",
                  },
                ].map((item, i) => {
                  const barColor =
                    item.score >= 70
                      ? "bg-green-500"
                      : item.score >= 40
                        ? "bg-orange-500"
                        : "bg-red-500";
                  const scoreColor =
                    item.score >= 70
                      ? "text-green-600"
                      : item.score >= 40
                        ? "text-orange-500"
                        : "text-red-500";
                  return (
                    <div key={i}>
                      {/* Top row */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{item.icon}</span>
                          <div>
                            <span className="text-sm font-semibold text-slate-700">
                              {item.label}
                            </span>
                            <span className="text-xs text-slate-400 ml-2">
                              — {item.what}
                            </span>
                          </div>
                        </div>
                        <span className={`text-sm font-bold ${scoreColor}`}>
                          {item.score}/100
                        </span>
                      </div>
                      {/* Signal bar */}
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                        <div
                          className={`h-full rounded-full ${barColor} transition-all`}
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                      {/* How score is calculated */}
                      <p className="text-xs text-slate-400">{item.how}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DEPENDENCY + SECURITY ROW */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Dependency Health */}
              <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-700 mb-4">
                  📦 Dependency Health
                </h2>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {health.dependencyData.totalDependencies}
                    </div>
                    <div className="text-xs text-slate-500">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-500">
                      {health.dependencyData.outdatedCount}
                    </div>
                    <div className="text-xs text-slate-500">Outdated</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">
                      {health.dependencyData.vulnerableCount}
                    </div>
                    <div className="text-xs text-slate-500">Vulnerable</div>
                  </div>
                </div>

                {/* Outdated packages list */}
                {health.dependencyData.outdatedPackages?.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-slate-500 mb-2">
                      Outdated Packages
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {health.dependencyData.outdatedPackages.map((pkg, i) => (
                        <div
                          key={i}
                          className="flex justify-between text-xs bg-orange-50 border border-orange-100 rounded px-3 py-1.5"
                        >
                          <span className="font-medium text-slate-700">
                            {pkg.name}
                          </span>
                          <span className="text-slate-400">
                            {pkg.currentVersion} → {pkg.latestVersion}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Security */}
              <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-700 mb-4">
                  🔒 Security
                </h2>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="text-center">
                    <div
                      className="text-2xl font-bold capitalize"
                      style={{
                        color:
                          health.securityData.riskLevel === "high"
                            ? "#dc2626"
                            : health.securityData.riskLevel === "medium"
                              ? "#f97316"
                              : "#16a34a",
                      }}
                    >
                      {health.securityData.riskLevel}
                    </div>
                    <div className="text-xs text-slate-500">Risk Level</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {health.securityData.securityScore}
                    </div>
                    <div className="text-xs text-slate-500">Security Score</div>
                  </div>
                </div>

                {health.securityData.secretsFound?.length > 0 ? (
                  <div className="space-y-1">
                    {health.securityData.secretsFound.map((secret, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-xs bg-red-50 border border-red-100 rounded px-3 py-1.5"
                      >
                        <span className="text-slate-700">{secret.pattern}</span>
                        <span className="text-red-500 font-medium">
                          {secret.riskLevel}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-2xl mb-1">✅</div>
                    <div className="text-xs text-slate-500">
                      No secrets detected
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm mb-6">
              <h2 className="text-base font-semibold text-slate-700 mb-1">
                💡 AI Suggestions
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Personalized recommendations to improve your repo health
              </p>
              <div className="space-y-3">
                {health.suggestions.map((suggestion, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3"
                  >
                    <span className="text-orange-400 font-bold text-sm mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {suggestion}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            {/* CONTRIBUTORS */}
            {repo.contributors.length > 0 && (
              <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-700 mb-4">
                  👥 Top Contributors
                </h2>
                <div className="flex gap-4">
                  {repo.contributors.map((contributor, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                        {contributor.githubUsername[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-700">
                          {contributor.githubUsername}
                        </div>
                        <div className="text-xs text-slate-400">
                          {contributor.commitCount} commits
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
