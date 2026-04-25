"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { GraduationCap, BookOpen } from "lucide-react"

export default function RoleSelectionPage() {
    const { update } = useSession()
    const router = useRouter()

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState("")

    const handleRoleSelection = async (role: "student" | "teacher") => {
        setIsSubmitting(true)
        setError("")

        try {
            const res = await fetch("/api/users/role", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ role })
            })

            if (!res.ok) {
                throw new Error("Failed to save role.")
            }

            // Tell next-auth to refresh the session, picking up the new role and cleared flag
            await update({ needsRoleSelection: false, role })

            router.push(`/dashboard/${role}`)
            router.refresh()

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.")
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-qz-bg flex flex-col justify-center items-center relative overflow-hidden p-4">
            {/* Background Gradients */}
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-blob"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-900 rounded-full mix-blend-multiply filter blur-[150px] opacity-30 animate-blob animation-delay-2000"></div>

            <div className="relative z-10 w-full max-w-4xl p-8 bg-qz-bg/80 backdrop-blur-xl border border-qz-border-light rounded-3xl shadow-2xl">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-qz-text mb-4">Choose Your Path</h1>
                    <p className="text-qz-text-muted text-lg">Select how you&apos;ll be using Memora to personalize your dashboard.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-900/30 border border-red-900/50 rounded-xl text-red-200 text-center">
                        {error}
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Student Card */}
                    <button
                        onClick={() => handleRoleSelection("student")}
                        disabled={isSubmitting}
                        className="group relative bg-qz-bg border border-qz-border hover:border-indigo-500 rounded-2xl p-8 text-left transition-all duration-300 hover:shadow-[0_0_30px_rgba(99,102,241,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="w-16 h-16 bg-[#4255ff]/10 text-[#ffcd1f] rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#4255ff] group-hover:text-white transition-colors duration-300">
                            <GraduationCap className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-qz-text mb-3">I&apos;m a Student</h2>
                        <p className="text-qz-text-muted leading-relaxed">
                            Join classes, study flashcards with spaced repetition, and use the AI tutor to master your material faster.
                        </p>
                    </button>

                    {/* Teacher Card */}
                    <button
                        onClick={() => handleRoleSelection("teacher")}
                        disabled={isSubmitting}
                        className="group relative bg-qz-bg border border-qz-border hover:border-purple-500 rounded-2xl p-8 text-left transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="w-16 h-16 bg-[#4255ff]/10 text-[#ffcd1f] rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#4255ff] group-hover:text-white transition-colors duration-300">
                            <BookOpen className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-qz-text mb-3">I&apos;m a Teacher</h2>
                        <p className="text-qz-text-muted leading-relaxed">
                            Create study sets, generate flashcards with AI, host live classroom games, and track student progress.
                        </p>
                    </button>
                </div>
            </div>
        </div>
    )
}
