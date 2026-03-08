import NextAuth, { AuthOptions } from "next-auth"
import GithubProvider from "next-auth/providers/github"
import { prisma } from "@/lib/prisma"
import { emailQueue, syncQueue } from "@/lib/queue"

// This file configures the authentication options for next-auth, including the GitHub provider and
//  the callbacks that run during sign-in and session retrieval.
//  When a user signs in with GitHub, it checks if they already exist in the database, 
// creates or updates their record, and adds jobs to the sync and email queues to keep 
// their data up to date and send them weekly digests. The session callback simply returns 
// the session object as is.

export const authOptions: AuthOptions = {
  providers: [
    // configures GitHub as the authentication provider, 
    // specifying the client ID and secret from environment variables, 
    // and requesting specific scopes for user data and repository access
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: { scope: "read:user user:email repo" }
      }
    }),
  ],

  // callbacks are functions that run at specific points in the authentication flow 
  // allowing you to customize the behavior of next-auth.
  callbacks: {

    // The signIn callback is called after a user successfully signs in, 
    // used here to handle user data storage and background job scheduling. 
    // It checks if the user already exists in the database, creates or updates their record with the latest access token, and adds jobs to the sync and email queues to keep their data up to date and send them weekly digests.
    async signIn({ user, account, profile }) {
      try {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        })

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
          })
        } else {
          await prisma.user.update({
            where: { email: user.email! },
            data: {
              accessToken: account?.access_token,
            },
          })
        }
        
        // After ensuring the user is in the database, we add them to the sync and email queues. 
        // The sync queue will run every 6 hours to update their repository data, 
        const syncUser = await prisma.user.findUnique({
          where: { email: user.email! },
        })

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
            jobId: `sync-${syncUser!.id}`,
          }
        )

        // The email queue will send a weekly digest every Sunday at 9am, 
        // containing updates on their repositories and any important notifications.
        await emailQueue.add(
          "weekly-digest",
          { userId: syncUser!.id },
          {
            repeat: {
              pattern: "0 9 * * 0",
            },
            jobId: `email-${syncUser!.id}`,
          }
        )

        return true
      } catch (error) {
        console.error("Error Saving Data", error)
        return false
      }
    },

    async session({ session }) {
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

// NextAuth can handle both GET and POST requests to the same endpoint, 
// so we export the handler for both methods.

//Checking the session is a GET. 
// Signing in is a POST. 
// Same handler, both methods.
export { handler as GET, handler as POST }
