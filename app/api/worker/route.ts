import { createEmailWorker, createSyncWorker } from "@/lib/worker"

let workerStarted = false

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