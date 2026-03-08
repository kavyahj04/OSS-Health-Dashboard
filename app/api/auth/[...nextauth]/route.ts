import NextAuth, { AuthOptions } from "next-auth"
import GithubProvider from "next-auth/providers/github"
import { prisma } from "@/lib/prisma"
import { emailQueue, syncQueue } from "@/lib/queue"

export const authOptions: AuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: { scope: "read:user user:email repo" }
      }
    }),
  ],
  callbacks: {
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
export { handler as GET, handler as POST }
