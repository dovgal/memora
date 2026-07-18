"use client"

import { signIn } from "next-auth/react"
import { Play } from "lucide-react"
import { useState } from "react"
import Link from "next/link"

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await signIn("credentials", {
                email,
                password,
                redirect: true,
                callbackUrl: "/dashboard",
            });
            // With redirect: true, signIn will navigate out if successful.
        } catch {
            setError("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-qz-bg flex flex-col justify-center items-center relative overflow-hidden">
            {/* Dynamic Background Gradients */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900 rounded-full mix-blend-multiply filter blur-[120px] animate-blob"></div>
            <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-blue-900 rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] bg-indigo-900 rounded-full mix-blend-multiply filter blur-[150px] animate-blob animation-delay-4000"></div>

            <div className="relative z-10 w-full max-w-md p-8 bg-qz-bg/60 backdrop-blur-xl border border-qz-border-light rounded-3xl shadow-2xl">
                <div className="text-center mb-8">
                    <div className="flex justify-center items-center mb-4 text-qz-text">
                        <Play fill="white" className="w-8 h-8 mr-2" />
                        <span className="text-3xl font-semibold tracking-tight">Memora</span>
                    </div>
                    <p className="text-qz-text-muted">Sign in to sync your flashcards and unlock the AI Tutor.</p>
                </div>

                <button
                    type="button"
                    onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                    className="w-full mb-6 flex items-center justify-center space-x-3 bg-qz-bg border border-qz-border hover:bg-qz-card text-qz-text font-semibold py-3 px-4 rounded-xl transition-all duration-200"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        <path fill="none" d="M1 1h22v22H1z" />
                    </svg>
                    <span>Continue with Google</span>
                </button>

                <div className="flex items-center space-x-4 mb-6">
                    <hr className="flex-1 border-qz-border-light" />
                    <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">or sign in with email</span>
                    <hr className="flex-1 border-qz-border-light" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-qz-text-muted mb-1">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-qz-bg border border-qz-border rounded-xl px-4 py-3 text-qz-text focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                            placeholder="student@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-qz-text-muted mb-1">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-qz-bg border border-qz-border rounded-xl px-4 py-3 text-qz-text focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full pt-2 flex items-center justify-center space-x-3 bg-white hover:bg-zinc-200 text-black font-semibold py-3 px-4 rounded-xl transition-all duration-200 ease-out active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 mt-6"
                    >
                        <span>{loading ? "Signing in..." : "Sign In"}</span>
                    </button>

                    <div className="text-center pt-4">
                        <p className="text-qz-text-muted text-sm">
                            Don&apos;t have an account? <Link href="/register" className="text-qz-text hover:text-qz-accent transition-colors font-medium">Register</Link>
                        </p>
                    </div>
                </form>

                <p className="mt-8 text-center text-xs text-zinc-600">
                    By continuing, you agree to our Terms of Service & Privacy Policy.
                </p>
            </div>
        </div>
    )
}
