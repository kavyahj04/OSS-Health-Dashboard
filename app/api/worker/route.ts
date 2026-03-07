import { createSyncWorker } from "@/lib/worker"

let workerStarted = false

export async function GET() {
    if (!workerStarted) {
        createSyncWorker()
        workerStarted = true
        console.log("Worker started")
    }
    return Response.json({ status: "worker running" })
}