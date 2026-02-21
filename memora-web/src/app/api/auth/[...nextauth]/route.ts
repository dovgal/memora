import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import GithubProvider from "next-auth/providers/github"

const handler = NextAuth({
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "mock-google-id",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "mock-google-secret",
        }),
        GithubProvider({
            clientId: process.env.GITHUB_CLIENT_ID || "mock-github-id",
            clientSecret: process.env.GITHUB_CLIENT_SECRET || "mock-github-secret",
        })
    ],
    callbacks: {
        async signIn({ user, account, profile, email, credentials }) {
            return true;
        },
        async jwt({ token, user, account, isNewUser }) {
            // Initial sign in
            if (account && user) {
                token.id = user.id;
                // If it's a brand new OAuth sign in OR if they haven't finished onboarding
                if (isNewUser) {
                    token.needsOnboarding = true;
                }
            }
            return token
        },
        async session({ session, token }) {
            if (session?.user) {
                // @ts-ignore
                session.user.id = token.id;
                // @ts-ignore
                session.user.needsOnboarding = token.needsOnboarding;
            }
            return session
        }
    },
    jwt: {
        encode: async ({ secret, token }) => {
            const jwt = require('jsonwebtoken');
            return jwt.sign(token, secret, { algorithm: 'HS256' });
        },
        decode: async ({ secret, token }) => {
            const jwt = require('jsonwebtoken');
            return jwt.verify(token, secret, { algorithms: ['HS256'] });
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: "jwt",
    }
})

export { handler as GET, handler as POST }
