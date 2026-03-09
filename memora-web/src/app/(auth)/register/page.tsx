"use client"

import { signIn } from "next-auth/react"
import { Play } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            setLoading(false);
            return;
        }

        try {
            // Register via Rust backend API
            const res = await fetch("http://localhost:8000/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            if (!res.ok) {
                const data = await res.text();
                throw new Error(data || "Registration failed");
            }

            // Successfully registered, now sign in via NextAuth
            const signInRes = await signIn("credentials", {
                email,
                password,
                redirect: true,
                callbackUrl: "/onboarding",
            });
            // With redirect: true, signIn will navigate out if successful.
        } catch (err: any) {
            setError(err.message || "Something went wrong during registration");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col justify-center items-center relative overflow-hidden py-12">
            {/* Dynamic Background Gradients */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900 rounded-full mix-blend-multiply filter blur-[120px] animate-blob"></div>
            <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-blue-900 rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] bg-indigo-900 rounded-full mix-blend-multiply filter blur-[150px] animate-blob animation-delay-4000"></div>

            <div className="relative z-10 w-full max-w-md p-8 bg-zinc-950/60 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl">
                <div className="text-center mb-8">
                    <div className="flex justify-center items-center mb-4 text-white">
                        <Play fill="white" className="w-8 h-8 mr-2" />
                        <span className="text-3xl font-extrabold tracking-tight">Memora</span>
                    </div>
                    <p className="text-zinc-400">Create an account to track progress.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                            placeholder="student@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">Confirm Password</label>
                        <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full pt-2 flex items-center justify-center space-x-3 bg-white hover:bg-zinc-200 text-black font-semibold py-3 px-4 rounded-xl transition-all duration-200 ease-out active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 mt-6"
                    >
                        <span>{loading ? "Creating account..." : "Register"}</span>
                    </button>

                    <div className="text-center pt-4">
                        <p className="text-zinc-400 text-sm">
                            Already have an account? <Link href="/login" className="text-white hover:text-purple-400 transition-colors font-medium">Sign in</Link>
                        </p>
                    </div>
                </form>

                <p className="mt-8 text-center text-xs text-zinc-600">
                    By registering, you agree to our Terms of Service & Privacy Policy.
                </p>
            </div>
        </div>
    )
}
