import { Queue } from "bullmq";

//to connect UPSTASH REDIS

export const redisConnection = {

    //EXTRACTS HOSTNAME 
    host : new URL(process.env.UPSTASH_URL!).hostname,
    port : 6379,
    password : process.env.UPSTASH_REDIS_REST_TOKEN!,
    tls:{}
}

//create a new queue called repo-sync
export const syncQueue = new Queue("repo-sync", {
    connection : redisConnection,
    defaultJobOptions: {

        //if fails retry upto 3 ties 
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
}
}

)