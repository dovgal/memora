import { notFound } from "next/navigation"
import { StudySet, SetProgressResponse } from "@/types/schema"
import PublicActionBanner from "./PublicActionBanner"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import { GraduationCap, Copy, Share2, BookOpen, Layers } from "lucide-react"

async function getSet(id: string): Promise<StudySet | null> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

    try {
        const res = await fetch(`${apiUrl}/api/sets/${id}`, {
            next: { revalidate: 60 }
        })

        if (!res.ok) {
            return null
        }

        return await res.json()
    } catch (error) {
        console.error("Error fetching set:", error)
        return null
    }
}

async function getProgress(id: string, token: string): Promise<SetProgressResponse | null> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

    try {
        const res = await fetch(`${apiUrl}/api/sets/${id}/progress`, {
            headers: {
                "Authorization": `Bearer ${token}`
            },
            cache: 'no-store'
        })

        if (!res.ok) {
            return null
        }

        return await res.json()
    } catch (error) {
        console.error("Error fetching progress:", error)
        return null
    }
}

export default async function SetPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const set = await getSet(id)

    if (!set) {
        notFound()
    }

    // Attempt to get session. Type any here guards against strict authOptions typing issues from route.ts
    const session: any = await getServerSession(authOptions as any)
    let progress: SetProgressResponse | null = null

    if (session && session.id_token) {
        progress = await getProgress(id, session.id_token)
    }

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-12 relative overflow-hidden pb-32">
            <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-indigo-900/20 rounded-full mix-blend-screen filter blur-[150px] pointer-events-none"></div>

            <div className="max-w-5xl mx-auto relative z-10">
                <header className="mb-12 border-b border-zinc-800 pb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-6">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400">
                            {set.title}
                        </h1>
                        {set.description && (
                            <p className="text-zinc-400 mt-4 text-lg max-w-2xl">{set.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-6 text-sm font-semibold text-zinc-500">
                            <span className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 px-3 py-1 rounded-full"><Layers size={14} /> {set.flashcards.length} Terms</span>
                            <span className="flex items-center gap-1 cursor-pointer hover:text-indigo-400 transition-colors"><Share2 size={14} /> Share</span>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                    <div className="lg:col-span-1 flex flex-col gap-4">

                        {session && progress && progress.totalCards > 0 && (
                            <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl">
                                <h3 className="text-zinc-400 text-sm font-bold uppercase tracking-widest mb-4">Your Mastery</h3>
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="text-5xl font-black text-indigo-400">{progress.masteryPercentage}%</div>
                                    <div className="text-sm font-medium text-zinc-500 leading-tight">
                                        of terms <br /> known
                                    </div>
                                </div>
                                <div className="w-full bg-zinc-800 rounded-full h-3 mb-4 overflow-hidden">
                                    <div
                                        className="bg-indigo-500 h-3 rounded-full transition-all duration-1000 ease-out animate-pulse"
                                        style={{ width: `${progress.masteryPercentage}%` }}
                                    ></div>
                                </div>
                                <div className="text-sm font-medium text-zinc-500 flex justify-between">
                                    <span>{progress.knownCards} Known</span>
                                    <span>{progress.totalCards - progress.knownCards} Left</span>
                                </div>
                            </div>
                        )}

                        <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl flex flex-col gap-4">
                            <h3 className="text-zinc-400 text-sm font-bold uppercase tracking-widest">Study Modes</h3>
                            <Link
                                href={`/set/${id}/flashcards`}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-between transition-all shadow-[0_0_20px_rgba(79,70,229,0.2)] hover:shadow-[0_0_30px_rgba(79,70,229,0.4)] hover:-translate-y-1"
                            >
                                <span className="flex items-center gap-3">
                                    <BookOpen size={20} /> Flashcards
                                </span>
                            </Link>
                            <Link
                                href={`/set/${id}/learn`}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-between transition-all shadow-[0_0_20px_rgba(147,51,234,0.2)] hover:shadow-[0_0_30px_rgba(147,51,234,0.4)] hover:-translate-y-1"
                            >
                                <span className="flex items-center gap-3">
                                    <GraduationCap size={20} /> Learn
                                </span>
                            </Link>

                            <Link
                                href={`/set/${id}/test`}
                                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-between transition-all shadow-[0_0_20px_rgba(234,88,12,0.2)] hover:shadow-[0_0_30px_rgba(234,88,12,0.4)] hover:-translate-y-1"
                            >
                                <span className="flex items-center gap-3">
                                    <Copy size={20} /> Test
                                </span>
                            </Link>
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        <h2 className="text-xl font-bold mb-6 text-zinc-200">Terms in this set ({set.flashcards.length})</h2>
                        <div className="flex flex-col gap-4">
                            {set.flashcards.map((card, index) => (
                                <div
                                    key={card.id}
                                    className="bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700 p-6 rounded-2xl flex flex-col md:flex-row gap-4 md:gap-8 transition-colors group cursor-default"
                                >
                                    <div className="md:w-1/3 border-b md:border-b-0 md:border-r border-zinc-800 pb-4 md:pb-0 md:pr-8">
                                        <p className="font-bold text-lg text-white group-hover:text-indigo-200 transition-colors">{card.term}</p>
                                    </div>
                                    <div className="md:w-2/3">
                                        <p className="text-zinc-400 leading-relaxed">{card.definition}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <PublicActionBanner />
            </div>
        </div>
    )
}
