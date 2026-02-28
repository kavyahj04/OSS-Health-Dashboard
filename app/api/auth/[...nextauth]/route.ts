import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";

//configure NEXTAUTH and store in handler
const handler = NextAuth({

    //supported logins
    providers : [
        GithubProvider({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        }),
    ],
})

export {handler as GET, handler as POST}