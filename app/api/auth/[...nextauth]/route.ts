import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/prisma";
import { emailQueue, syncQueue } from "@/lib/queue";

//configure NEXTAUTH and store in handler
const handler = NextAuth({
  //supported logins
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    //this callback is called whenever a user logs in. We can use it to store additional information about the user in the session.
    async signIn({ user, account, profile }) {
      try {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (!existingUser) {
          await prisma.user.create({
            data: {
              name: user.name,
              email: user.email,
              image: user.image,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              githubUsername: (profile as any)?.login,
              accessToken: account?.access_token,
            },
          });
        } else {
          await prisma.user.update({
            where: { email: user.email! },
            data: {
              accessToken: account?.access_token,
            },
          });
        }
        // Get user either way
        const syncUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        //job scheduling with bullmq to sync repos every 6 hours. We add a job to the queue with the user's ID and access token, and set it to repeat every 6 hours. The jobId ensures that we only have one job per user in the queue at any time.
        await syncQueue.add(
          "sync-repos",
          {
            userId: syncUser!.id,
            accessToken: account?.access_token,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            githubUsername: (profile as any)?.login,
          },
          {
            repeat: { every: 6 * 60 * 60 * 1000 },
            jobId: `sync-${syncUser!.id}`, // unique per user
          },
        );
        await emailQueue.add(
        "weekly-digest",
        { userId: syncUser!.id },
        {
          repeat: {
            pattern: "0 9 * * 0", // Every Sunday at 9am
          },
          jobId: `email-${syncUser!.id}`,
        },
      );
        return true;
      } catch (error) {
        console.error("Error Saving Data", error);
        return false;
      }
      
    },
    async session({ session, token }) {
      return session;
    },
  },
});

export { handler as GET, handler as POST };
