# OSS Health Tracker

Track and visualize the health of your GitHub repositories with AI-powered insights.

## What is this?

OSS Health Tracker connects to your GitHub account, analyzes all your repositories across 8 health signals, and gives each one a score from 0 to 100. It runs automatically in the background every 6 hours, sends you a weekly email digest, and generates a badge you can embed in any README.

## Features

- Login with GitHub OAuth, no passwords required
- Automatic repository sync every 6 hours via background jobs
- Health score (0 to 100) calculated across 8 signals per repository
- AI-powered improvement suggestions using GPT-3.5
- Dependency health check via npm registry
- Vulnerability scanning via OSV.dev
- Secret scanning via GitHub's built-in API
- Commit activity chart across all repositories
- Weekly email digest with score changes and top suggestions
- Embeddable SVG health badge for your README

## Tech Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Framework | Next.js + TypeScript | Frontend and API routes in one codebase |
| Auth | NextAuth + GitHub OAuth | Login with GitHub, session management |
| Database | Supabase (PostgreSQL) via Prisma | Permanent storage for repos, scores, users |
| Cache + Queue | Upstash Redis + BullMQ | Background job scheduling and fast reads |
| AI | OpenAI GPT-3.5 | Generating improvement suggestions |
| Charts | Recharts | Commit activity visualization |
| Email | Resend | Weekly digest delivery |
| Hosting | Vercel | Deployment |

## How the Health Score Works

Each repository is scored across 7 signals. The final score is a weighted sum.

| Signal | Weight | What it measures |
|--------|--------|-----------------|
| Commit Recency | 20% | Days since last push |
| Commit Activity | 20% | Total commits in tracked period |
| Issue Management | 15% | Ratio of open to closed issues |
| PR Health | 15% | Average pull request merge time |
| Documentation | 15% | README, LICENSE, description presence |
| Repo Structure | 10% | .gitignore, GitHub Actions, CONTRIBUTING |
| Popularity | 5% | Star count |

Dependency health and security are scored separately and displayed in their own panels.

## Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # GitHub OAuth + session + queue scheduling
│   │   ├── repos/                # Fetch repositories from database
│   │   ├── sync/                 # Manual sync trigger
│   │   ├── worker/               # Start BullMQ background workers
│   │   ├── badge/                # SVG badge generation
│   │   └── testemail/            # Weekly digest trigger
│   ├── dashboard/                # Main dashboard page
│   └── repo/[name]/              # Individual repository detail page
└── lib/
    ├── prisma.ts                 # Database client (singleton pattern)
    ├── github.ts                 # GitHub API functions via Octokit
    ├── scoring.ts                # Health score calculation engine
    ├── dependencies.ts           # npm + OSV.dev dependency checks
    ├── security.ts               # GitHub secret scanning
    ├── suggestions.ts            # OpenAI integration + fallback logic
    ├── email.ts                  # Resend weekly digest
    ├── queue.ts                  # BullMQ queue definitions
    └── worker.ts                 # BullMQ worker definitions
```

## Getting Started

### Prerequisites

- Node.js 18+
- A GitHub OAuth App
- Supabase project
- Upstash Redis instance
- OpenAI API key
- Resend account

### 1. Clone the repository
```bash
git clone https://github.com/your-username/oss-health-tracker.git
cd oss-health-tracker
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the root:
```env
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# NextAuth
NEXTAUTH_SECRET=your_random_secret_string
NEXTAUTH_URL=http://localhost:3000

# Database
DATABASE_URL=your_supabase_postgresql_connection_string

# Upstash Redis
UPSTASH_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Resend
RESEND_API_KEY=your_resend_api_key
```

### 3. Set up the database
```bash
npx prisma generate
npx prisma db push
```

### 4. Create a GitHub OAuth App

Go to GitHub Settings > Developer Settings > OAuth Apps > New OAuth App

Set the callback URL to:
```
http://localhost:3000/api/auth/callback/github
```

### 5. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Start the background workers

Once the app is running, visit:
```
http://localhost:3000/api/worker
```

This starts the sync and email workers. Repositories will begin syncing automatically.

## How the Badge Works

After syncing, embed your repository health badge in any README:
```markdown
![OSS Health](https://your-domain.com/api/badge/your-github-username/your-repo-name)
```

The badge shows your current health score and updates every hour.

## Background Jobs

Two jobs run automatically after login:

**Sync job** runs every 6 hours. Fetches fresh data from GitHub for all repositories, recalculates health scores, checks dependencies and security, and generates new AI suggestions.

**Email job** runs every Sunday at 9am. Sends a weekly digest showing your top 5 repositories by score, score changes since last week, and the top 3 improvement suggestions.

## Known Limitations

- GitHub API allows 5,000 requests per hour. Users with many repositories may approach this limit during a full sync.
- Health scores do not account for repository age. A brand new repository will score low on popularity and commit history by design.
- Secret scanning requires GitHub Advanced Security for private repositories. Public repositories are scanned by default.
- Workers require a persistent runtime. On Vercel's hobby plan, the worker endpoint must be called manually to start workers after a cold start.
- The email sender address uses Resend's default domain in development. A verified custom domain is required for production delivery.

## License

MIT