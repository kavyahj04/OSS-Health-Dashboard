// This is the main landing page of the app, where users can log in with GitHub to access their dashboard. It features a modern design with a gradient background, floating blobs, and a glassmorphic card that highlights the app's features and benefits. The "Continue with GitHub" button triggers the signIn function from next-auth to start the authentication flow.
"use client"

//the next-auth/react gives you browser-side function
import { signIn } from "next-auth/react"

export default function Home() {
  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #533483 100%)",
        backgroundSize: "400% 400%",
        animation: "gradientShift 6s ease infinite",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>

      {/* Floating blobs in background */}
      <div style={{
        position: "absolute",
        width: 400,
        height: 400,
        borderRadius: "50%",
        background: "rgba(99, 102, 241, 0.15)",
        top: "-100px",
        left: "-100px",
        animation: "pulse 4s ease infinite",
        filter: "blur(40px)",
      }} />
      <div style={{
        position: "absolute",
        width: 300,
        height: 300,
        borderRadius: "50%",
        background: "rgba(168, 85, 247, 0.15)",
        bottom: "-50px",
        right: "-50px",
        animation: "pulse 5s ease infinite 1s",
        filter: "blur(40px)",
      }} />
      <div style={{
        position: "absolute",
        width: 200,
        height: 200,
        borderRadius: "50%",
        background: "rgba(59, 130, 246, 0.2)",
        top: "40%",
        right: "15%",
        animation: "pulse 6s ease infinite 2s",
        filter: "blur(30px)",
      }} />

      {/* Card */}
      <div
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "28px",
          padding: "52px 48px",
          textAlign: "center",
          maxWidth: "420px",
          width: "90%",
          boxShadow: "0 32px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
          position: "relative",
          zIndex: 1,
          animation: "float 6s ease infinite",
        }}
      >
        {/* Icon */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: "20px",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 28px",
          fontSize: 36,
          boxShadow: "0 8px 32px rgba(99,102,241,0.4)",
        }}>
          🔍
        </div>

        {/* Title */}
        <h1 style={{
          color: "#ffffff",
          fontSize: 30,
          fontWeight: 700,
          margin: "0 0 12px",
          letterSpacing: "-0.5px",
          textShadow: "0 2px 10px rgba(0,0,0,0.3)",
        }}>
          OSS Health Tracker
        </h1>

        {/* Subtitle */}
        <p style={{
          color: "rgba(255,255,255,0.6)",
          fontSize: 15,
          margin: "0 0 36px",
          lineHeight: 1.7,
        }}>
          Track the health of your GitHub repositories with AI-powered insights
        </p>

        {/* Divider */}
        <div style={{
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
          marginBottom: 36,
        }} />

        {/* GitHub Login Button */}
        <button

          //redirects the user to GitHub's authorization page, GitHub asks the user to approve access, after approval GitHub redirects back to your app with an authorization code, next-auth exchanges that code for an access token and logs the user in, then redirects to the dashboard
          onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            width: "100%",
            background: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)",
            color: "#1e293b",
            padding: "15px 24px",
            borderRadius: "14px",
            fontWeight: 600,
            fontSize: 15,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => {
            const btn = e.currentTarget as HTMLButtonElement
            btn.style.transform = "translateY(-2px)"
            btn.style.boxShadow = "0 8px 30px rgba(0,0,0,0.4)"
          }}
          onMouseLeave={e => {
            const btn = e.currentTarget as HTMLButtonElement
            btn.style.transform = "translateY(0)"
            btn.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)"
          }}
        >
          {/* GitHub logo drawn as a vector*/}
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          Continue with GitHub
        </button>

        {/* Features row */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: 20,
          marginTop: 28,
        }}>
          {["🤖 AI Insights", "📊 Charts", "🔒 Security"].map((item, i) => (
            <span key={i} style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 12,
            }}>
              {item}
            </span>
          ))}
        </div>

      </div>
    </main>
  )
}
