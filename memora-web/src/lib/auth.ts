import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import * as jsonwebtoken from "jsonwebtoken"

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        }),
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

            if (account && user) {
                if (account.provider === 'google') {
                    try {
                        const googleUser = {
                            email: user.email,
                            firstName: user.name?.split(' ')[0] || "",
                            lastName: user.name?.split(' ').slice(1).join(' ') || "",
                            avatarUrl: user.image,
                        };
                        const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
                        const res = await fetch(`${backendUrl}/api/auth/oauth/google`, {
                            method: 'POST',
                            body: JSON.stringify(googleUser),
                            headers: {
                                "Content-Type": "application/json",
                                "x-backend-secret": process.env.NEXTAUTH_SECRET as string
                            },
                        });

                        if (res.ok) {
                            const backendUser = await res.json();
                            token.id = backendUser.id;
                            token.role = backendUser.role;
                        } else {
                            console.error("Failed to sync Google user with backend:", await res.text());
                        }
                    } catch (e) {
                        console.error("Google OAuth backend sync error:", e);
                    }
                } else if (account.provider === 'credentials') {
                    token.id = user.id;
                    // @ts-expect-error casting role from user response
                    token.role = user.role || "student";
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
