import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { prisma } from "@/lib/prisma";

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
            },
          });
        }
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
