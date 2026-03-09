import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import * as jsonwebtoken from "jsonwebtoken"

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email", placeholder: "student@example.com" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                try {
                    console.log("Attempting to login with:", credentials.email);

                    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
                    const res = await fetch(`${backendUrl}/api/auth/login`, {
                        method: 'POST',
                        body: JSON.stringify({
                            email: credentials.email,
                            password: credentials.password,
                        }),
                        headers: { "Content-Type": "application/json" },
                        cache: 'no-store'
                    });

                    console.log("Backend login response status:", res.status);
                    if (res.ok) {
                        const user = await res.json();
                        console.log("Backend login success:", user.email);
                        // Important: DTO has lowercase 'email' and 'id' and 'role'
                        return {
                            id: user.id,
                            email: user.email,
                            role: user.role
                        };
                    } else {
                        const errText = await res.text();
                        console.error("Backend login failed:", errText);
                    }
                } catch (e) {
                    console.error("Backend login network error:", e);
                }

                return null;
            }
        })
    ],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async signIn() {
            return true;
        },
        async jwt({ token, user, account, isNewUser, trigger, session }) {
            console.log("JWT Callback invoked. User attached:", !!user);
            // When user first signs in, user object is passed
            if (user) {
                token.id = user.id;
                // @ts-expect-error casting role from user response
                token.role = user.role || "student";

                // For a fully built app, we might check if they have a profile, 
                // but we can assume credentials login means they just registered.
                // We'll set needsOnboarding to false temporarily, or we could redirect them
                // We'll check if it's their first login
                // Actually, register endpoint doesn't set onboarding, wait it just creates the user.
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
            console.log("Session Callback invoked");
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
                // We MUST cast token.id to a string because Rust strictly expects `sub: String`.
                const rawToken = jsonwebtoken.sign(
                    { sub: String(token.id), email: token.email, role: token.role },
                    process.env.NEXTAUTH_SECRET as string,
                    { algorithm: 'HS256', expiresIn: '30d' }
                );

                // @ts-expect-error adding id_token to session
                session.id_token = rawToken;
            }
            return session
        }
    },
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: "jwt",
    },
    debug: true,
}
