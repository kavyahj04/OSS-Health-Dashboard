"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type HealthScore = {
  score: number;
  breakdown: {
    commitRecency: number;
    commitActivity: number;
    issueManagement: number;
    prHealth: number;
    documentation: number;
    repoStructure: number;
    popularity: number;
  };
  suggestions: string[];
  dependencyData: {
    totalDependencies: number;
    outdatedCount: number;
    vulnerableCount: number;
    dependencyScore: number;
  };
  securityData: {
    riskLevel: string;
    securityScore: number;
  };
};

type CommitWeek = {
  week: number;
  total: number;
};

type Repo = {
  id: string;
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  totalCommits: number;
  lastCommitDate: string | null;
  commitActivity: CommitWeek[] | null;
  healthScores: HealthScore[];
  _count: { contributors: number };
};

function ScoreCircle({ score }: { score: number }) {
  const colorClass =
    score >= 70
      ? "border-green-500 bg-green-50 text-green-600"
      : score >= 40
        ? "border-orange-500 bg-orange-50 text-orange-600"
        : "border-red-500 bg-red-50 text-red-600";

  return (
    <div
      className={`w-14 h-14 rounded-full border-2 flex items-center justify-center font-bold text-sm shrink-0 ${colorClass}`}
    >
      {score}
    </div>
  );
}

function SignalBars({ breakdown }: { breakdown: HealthScore["breakdown"] }) {
  const signals = Object.values(breakdown);
  return (
    <div className="flex gap-1 mt-3">
      {signals.map((value, i) => {
        const colorClass =
          value >= 70
            ? "bg-green-500"
            : value >= 40
              ? "bg-orange-500"
              : "bg-red-500";
        return (
          <div
            key={i}
            className="flex-1 h-1 rounded-full bg-gray-200 overflow-hidden"
          >
            <div
              className={`h-full rounded-full ${colorClass}`}
              style={{ width: `${value}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function formatLastSynced(dateString: string | null) {
  if (!dateString) return "Never synced";
  const diff = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / (1000 * 60),
  );
  if (diff < 1) return "Just now";
  if (diff < 60) return `${diff} minutes ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
  return `${Math.floor(diff / 1440)} days ago`;
}

function formatWeek(timestamp: number) {
  const date = new Date(timestamp * 1000);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// The DashboardPage component is the main landing page for the OSS Health Tracker application. It displays an overview of the user's repositories, including their health scores, commit activity, and other relevant statistics. The page fetches the repository data from the API when it mounts and provides a sync button to allow users to manually trigger a data refresh. The repositories are displayed in a grid format, sorted by their health scores, with visual indicators for their overall health status and signal breakdowns.
export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  async function fetchRepos() {
    setLoading(true);
    const response = await fetch("/api/repos");
    const data = await response.json();
    console.log(
      "commitActivity sample:",
      data.repositories?.[0]?.commitActivity,
    );
    setRepos(data.repositories ?? []);
    setLastSyncedAt(data.lastSyncedAt);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRepos();
  }, []);

  async function handleSync() {
    setSyncing(true);
    await fetch("/api/sync", { method: "POST" });
    await fetchRepos();
    setSyncing(false);
  }

  const sortedRepos = [...repos].sort((a, b) => {
    const scoreA = a.healthScores[0]?.score ?? 0;
    const scoreB = b.healthScores[0]?.score ?? 0;
    return scoreB - scoreA;
  });

  // Show top 6 or all
  const visibleRepos = showAll ? sortedRepos : sortedRepos.slice(0, 6);

  // Stats
  const reposWithScores = repos.filter((r) => r.healthScores.length > 0);
  const avgScore =
    reposWithScores.length > 0
      ? Math.round(
          reposWithScores.reduce((sum, r) => sum + r.healthScores[0].score, 0) /
            reposWithScores.length,
        )
      : 0;
  const healthyCount = reposWithScores.filter(
    (r) => r.healthScores[0].score >= 70,
  ).length;
  const attentionCount = reposWithScores.filter(
    (r) => r.healthScores[0].score < 70,
  ).length;

  const commitChartData = (() => {
    const reposWithActivity = repos.filter(
      (r) => r.commitActivity && r.commitActivity.length > 0,
    );
    if (reposWithActivity.length === 0) return [];

    const baseWeeks = reposWithActivity[0].commitActivity!;

    const allWeeks = baseWeeks.map((week, i) => {
      const total = reposWithActivity.reduce((sum, repo) => {
        return sum + (repo.commitActivity?.[i]?.total ?? 0);
      }, 0);
      return {
        week: formatWeek(week.week),
        commits: total,
      };
    });

    // Show last 8 weeks, drop the current incomplete week if it's 0
    const recent = allWeeks.slice(-8);
    const last = recent[recent.length - 1];
    if (last && last.commits === 0) recent.pop();
    return recent;
  })();

  return (
    <main
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #bfdbfe 100% 100%)",
      }}
    >
      {/* NAVBAR */}
      <nav
        style={{
          background: "#4338ca",
          borderBottom: "1px solid #3730a3",
          padding: "16px 32px",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
        }}
      >
        {/* Left — empty spacer */}
        <div />

        {/* Center — title */}
        <span
          style={{
            color: "#ffffff",
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: 0.5,
            textAlign: "center",
          }}
        >
          🔍 OSS Health Tracker
        </span>

        {/* Right — name + sync */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            justifyContent: "flex-end",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            {session?.user?.name}
          </span>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              background: syncing
                ? "rgba(249,115,22,0.5)"
                : "linear-gradient(135deg, #f97316, #ea580c)",
              color: "#ffffff",
              border: "none",
              padding: "8px 20px",
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              cursor: syncing ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(249,115,22,0.3)",
            }}
          >
            {syncing ? "Syncing..." : "↻ Sync Now"}
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-1">
            Welcome back, {session?.user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-slate-500 text-sm">
            Last synced: {formatLastSynced(lastSyncedAt)}
            {" · "}
            {repos.length} repositories tracked
          </p>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Repos",
              value: repos.length,
              color: "text-blue-600",
            },
            {
              label: "Avg Health Score",
              value: avgScore,
              color: "text-orange-500",
            },
            {
              label: "Healthy Repos",
              value: healthyCount,
              color: "text-green-600",
            },
            {
              label: "Need Attention",
              value: attentionCount,
              color: "text-red-500",
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-white border border-blue-200 rounded-xl p-5 shadow-sm"
            >
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                {stat.label}
              </div>
              <div className={`text-4xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* COMMIT ACTIVITY CHART */}
        <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-700 mb-1">
            Commit Activity
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Last 4 weeks across all repositories
          </p>
          {commitChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={commitChartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="commitGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white border border-blue-100 rounded-lg px-4 py-2 shadow-md">
                          <p className="text-xs text-slate-400 mb-1">{label}</p>
                          <p className="text-sm font-semibold text-blue-600">
                            {payload[0].value} commits
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="commits"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#commitGradient)"
                  dot={{ fill: "#2563eb", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: "#f97316" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-slate-400 py-8">
              Sync your repos to see commit activity
            </div>
          )}
        </div>

        {/* REPO GRID */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-700">
            Your Repositories
            <span className="ml-2 text-xs text-slate-400 font-normal">
              sorted by health score
            </span>
          </h2>
          <span className="text-xs text-slate-400">
            Showing {visibleRepos.length} of {repos.length}
          </span>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-16">
            Loading repositories...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              {visibleRepos.map((repo) => {
                const latestScore = repo.healthScores[0];
                return (
                  <div
                    key={repo.id}
                    onClick={() => router.push(`/dashboard/${repo.name}`)}
                    className="bg-white border border-blue-100 hover:border-blue-400 rounded-xl p-5 cursor-pointer transition-colors"
                  >
                    {/* Top Row */}
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 mr-3">
                        <div className="font-semibold text-slate-800 mb-1">
                          {repo.name}
                        </div>
                        <div className="text-xs text-slate-500 leading-relaxed">
                          {repo.description ?? "No description"}
                        </div>
                      </div>
                      {latestScore ? (
                        <ScoreCircle score={Math.round(latestScore.score)} />
                      ) : (
                        <div className="w-14 h-14 rounded-full border-2 border-slate-200 flex items-center justify-center text-xs text-slate-400">
                          N/A
                        </div>
                      )}
                    </div>

                    {/* Signal Bars */}
                    {latestScore && (
                      <SignalBars breakdown={latestScore.breakdown} />
                    )}

                    {/* Meta Row */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-blue-100">
                      <span className="text-xs text-slate-500">
                        ⭐ {repo.stars}
                      </span>
                      <span className="text-xs text-slate-500">
                        🍴 {repo.forks}
                      </span>
                      <span className="text-xs text.slate-500">
                        👥 {repo._count.contributors}
                      </span>
                      <span className="text-xs text-slate-500">
                        📝 {repo.totalCommits}
                      </span>
                      {repo.language && (
                        <span className="ml-auto text-xs text-blue-600 bg-white border border-blue-200 px-2 py-0.5 rounded font-medium">
                          {repo.language}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* LOAD ALL BUTTON */}
            {!showAll && repos.length > 6 && (
              <div className="text-center mt-6">
                <button
                  onClick={() => setShowAll(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold text-sm transition cursor-pointer"
                >
                  Load All Repositories ({repos.length - 6} more)
                </button>
              </div>
            )}

            {/* SHOW LESS BUTTON */}
            {showAll && repos.length > 6 && (
              <div className="text-center mt-6">
                <button
                  onClick={() => setShowAll(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-8 py-3 rounded-lg font-semibold text-sm transition cursor-pointer"
                >
                  Show Less
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
