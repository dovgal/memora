import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import GithubProvider from "next-auth/providers/github"
import * as jsonwebtoken from "jsonwebtoken"

export const authOptions: NextAuthOptions = {
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
        async signIn() {
            return true;
        },
        async jwt({ token, user, account, isNewUser, trigger, session }) {
            if (account && user) {
                token.id = user.id;
                token.role = "student";
                if (isNewUser) {
                    token.needsOnboarding = true;
                    token.needsRoleSelection = true;
                }
            }

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
                // @ts-expect-error extending next-auth types
                session.user.id = token.id;
                // @ts-expect-error extending next-auth types
                session.user.role = token.role;
                // @ts-expect-error extending next-auth types
                session.user.needsOnboarding = token.needsOnboarding;
                // @ts-expect-error extending next-auth types
                session.user.needsRoleSelection = token.needsRoleSelection;

                // Create a raw JWT string to send to Rust.
                const rawToken = await authOptions.jwt?.encode?.({
                    secret: process.env.NEXTAUTH_SECRET as string,
                    token: token,
                });

                // @ts-expect-error adding id_token to session
                session.id_token = rawToken;
            }
            return session
        }
    },
    jwt: {
        encode: async ({ secret, token }) => {
            if (!token) return "";
            return jsonwebtoken.sign(token, secret as string, { algorithm: 'HS256' });
        },
        decode: async ({ secret, token }) => {
            if (!token) return null;
            return jsonwebtoken.verify(token, secret as string, { algorithms: ['HS256'] }) as any;
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: "jwt",
    }
}
