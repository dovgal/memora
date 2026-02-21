"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"

export default function PublicActionBanner() {
    const { data: session, status } = useSession()

    // Don't render while checking session, or if they are already logged in
    if (status === "loading" || session?.user) {
        return null
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-indigo-600 border-t border-indigo-400 p-4 shadow-[0_-10px_40px_rgba(79,70,229,0.3)] z-50">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h3 className="text-white font-bold text-lg">Save your progress!</h3>
                    <p className="text-indigo-200 text-sm">Create a free account to track your mastery of these flashcards and customize the set.</p>
                </div>
                <Link
                    href="/login"
                    className="whitespace-nowrap bg-white text-indigo-700 hover:bg-zinc-100 font-semibold py-2 px-6 rounded-xl transition-colors shadow-md"
                >
                    Login to Save Progress
                </Link>
            </div>
        </div>
    )
}
