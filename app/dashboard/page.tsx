"use client"

import { useSession } from "next-auth/react"
import { useState } from "react"

export default function DashboardPage() {

    const {data: session} = useSession()
    const[syncing, setSyncing] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const[result, setResult] = useState<any>(null)

    async function handleSync() {
        setSyncing(true)
        const response = await fetch("/api/sync", {
            method : "POST",
        })

        const data = await response.json()
        setResult(data)
        setSyncing(false)
    } 

    return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-2">
        Welcome {session?.user?.name}
      </h1>
      <p className="text-gray-400 mb-8">
        {session?.user?.email}
      </p>
       
      <button
        onClick={handleSync}
        disabled={syncing}
        className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-medium transition disabled:opacity-50"
      >
        {syncing ? "Syncing..." : "Sync GitHub Repos"}
      </button>

      {result && (
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
            {/* JSON.stringify(value, replacer, space) */}
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </main>
    )
}