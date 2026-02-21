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
        async jwt({ token, user, account, isNewUser, trigger, session }) {
            // Initial sign in
            if (account && user) {
                token.id = user.id;
                // Default every new user to student if we don't have it, but they still need to select it
                token.role = "student";
                if (isNewUser) {
                    token.needsOnboarding = true;
                    token.needsRoleSelection = true;
                }
            }

            // Client-side session updates
            if (trigger === "update" && session) {
                if (session.needsOnboarding !== undefined) {
                    token.needsOnboarding = session.needsOnboarding;
                }
                if (session.needsRoleSelection !== undefined) {
                    token.needsRoleSelection = session.needsRoleSelection;
                }
                if (session.role !== undefined) {
                    token.role = session.role;
                }
            }
            return token
        },
        async session({ session, token }) {
            if (session?.user) {
                // @ts-ignore
                session.user.id = token.id;
                // @ts-ignore
                session.user.role = token.role;
                // @ts-ignore
                session.user.needsOnboarding = token.needsOnboarding;
                // @ts-ignore
                session.user.needsRoleSelection = token.needsRoleSelection;
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
