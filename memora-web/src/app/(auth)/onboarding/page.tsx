"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

export default function OnboardingPage() {
    const { data: session, update } = useSession()
    const router = useRouter()

    const [dob, setDob] = useState("")
    const [error, setError] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isBlocked, setIsBlocked] = useState(false)

    // Helper to calculate age from DoB string
    const calculateAge = (dateString: string) => {
        const today = new Date()
        const birthDate = new Date(dateString)
        let age = today.getFullYear() - birthDate.getFullYear()
        const m = today.getMonth() - birthDate.getMonth()
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--
        }
        return age
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (!dob) {
            setError("Please enter your date of birth.")
            return
        }

        const age = calculateAge(dob)

        if (age < 13) {
            setIsBlocked(true)
            return
        }

        setIsSubmitting(true)

        try {
            // Route through the local Next.js API proxy which attaches the real JWT
            const res = await fetch("/api/users/onboarding", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    dateOfBirth: dob
                })
            })
            await update({ needsOnboarding: false })

            router.push("/dashboard")
            router.refresh()

        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.")
            setIsSubmitting(false)
        }
    }

    if (isBlocked) {
        return (
            <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4">
                <div className="max-w-md w-full bg-qz-bg border border-red-900/50 p-8 rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.15)] text-center">
                    <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-3xl">🛑</span>
                    </div>
                    <h2 className="text-2xl font-bold text-qz-text mb-4">Parental Consent Required</h2>
                    <p className="text-qz-text-muted mb-6 leading-relaxed">
                        Based on the date of birth you provided, you are under 13 years old.
                        In accordance with the Children's Online Privacy Protection Act (COPPA),
                        we require verifiable parental consent before you can use Memora.
                    </p>
                    <p className="text-zinc-500 text-sm">
                        Please ask a parent or guardian to assist you with creating an account.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black flex flex-col justify-center items-center relative overflow-hidden p-4">
            {/* Background Gradients */}
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900 rounded-full mix-blend-multiply filter blur-[120px] opacity-50 animate-blob"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-900 rounded-full mix-blend-multiply filter blur-[150px] opacity-40 animate-blob animation-delay-2000"></div>

            <div className="relative z-10 w-full max-w-md p-8 bg-qz-bg/80 backdrop-blur-xl border border-qz-border-light rounded-3xl shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-qz-text mb-2">Welcome to Memora</h1>
                    <p className="text-qz-text-muted">Let's finish setting up your account. We need your age to personalize your experience safely.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="dob" className="block text-sm font-medium text-qz-text-muted mb-2">
                            Date of Birth
                        </label>
                        <input
                            type="date"
                            id="dob"
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                            max={new Date().toISOString().split("T")[0]}
                            className="w-full bg-qz-bg border border-qz-border text-qz-text rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            required
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-900/30 border border-red-900/50 rounded-lg text-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-[#4255ff] hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 ease-out active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "Saving..." : "Continue"}
                    </button>

                    <p className="text-xs text-zinc-500 text-center mt-4">
                        We ask for your age to comply with safety regulations like COPPA. Your date of birth is kept private.
                    </p>
                </form>
            </div>
        </div>
    )
}
