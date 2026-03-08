import { createEmailWorker, createSyncWorker } from "@/lib/worker"

let workerStarted = false

// This API route is responsible for starting the background workers that handle repository syncing and sending weekly digest emails.
export async function GET() {
    if (!workerStarted) {
        createSyncWorker()
        createEmailWorker()
        workerStarted = true
        console.log("✅ Sync worker started")
        console.log("✅ Email worker started")
    }
    return Response.json({ status: "worker running" })
}