"use client"

import { useSession, signOut } from "next-auth/react"
import { AlertCircle } from "lucide-react"

export default function DashboardFallback() {
    const { data: session } = useSession()

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-qz-bg p-4">
            <div className="max-w-md w-full bg-qz-bg border border-qz-border-light p-8 rounded-2xl shadow-xl text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-qz-text mb-2">Account Sync Error</h1>
                <p className="text-qz-text-muted mb-6">
                    We could not retrieve your account data from the internal server. This usually happens if the backend API is misconfigured or unreachable.
                </p>
                <div className="bg-qz-bg/50 border border-red-900 text-red-400 text-sm p-4 rounded-xl mb-6 text-left">
                    <p className="font-semibold mb-1">Developer Note:</p>
                    <p>If you just set up Google Login, make sure you ALSO added <code>NEXTAUTH_SECRET</code> to your Rust Backend (memora-api) Environment Variables on Railway.</p>
                </div>
                <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full bg-white text-black font-semibold py-3 px-4 rounded-xl hover:bg-zinc-200 transition-colors"
                >
                    Sign Out & Try Again
                </button>
            </div>
        </div>
    )
}
