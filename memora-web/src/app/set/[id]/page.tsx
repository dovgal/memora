import { notFound } from "next/navigation"
import { StudySet } from "@/types/schema"
import PublicActionBanner from "./PublicActionBanner"

async function getSet(id: string): Promise<StudySet | null> {
    const rustApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

    // Server-side fetch without auth headers (simulating unauthenticated/public access)
    const res = await fetch(`${rustApiUrl}/api/sets/${id}`, {
        // Cache heavily for public sets, or revalidate path on edits
        next: { revalidate: 60 }
    })

    if (!res.ok) {
        return null
    }

    return res.json()
}

export default async function PublicSetPage({ params }: { params: { id: string } }) {
    const setId = params.id
    const studySet = await getSet(setId)

    if (!studySet) {
        notFound()
    }

    return (
        <div className="min-h-screen bg-black text-white p-8 pb-32 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-1/4 w-[50%] h-[30%] bg-indigo-900 rounded-full mix-blend-multiply filter blur-[150px] opacity-20 pointer-events-none"></div>

            <main className="max-w-4xl mx-auto relative z-10">
                <header className="mb-12">
                    <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 mb-4 pb-2">
                        {studySet.title}
                    </h1>
                    {studySet.description && (
                        <p className="text-zinc-400 text-lg">{studySet.description}</p>
                    )}
                    <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-xs font-medium text-zinc-300">
                        {studySet.flashcards.length} Terms
                    </div>
                </header>

                <div className="space-y-6">
                    {studySet.flashcards.map((card) => (
                        <div
                            key={card.id}
                            className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl flex flex-col md:flex-row gap-6 hover:border-indigo-500/50 transition-colors"
                        >
                            <div className="md:w-1/3 border-b md:border-b-0 md:border-r border-zinc-800 pb-4 md:pb-0 md:pr-6">
                                <h3 className="text-lg font-semibold text-indigo-300">{card.term}</h3>
                            </div>
                            <div className="md:w-2/3">
                                <p className="text-zinc-300 leading-relaxed">{card.definition}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            <PublicActionBanner />
        </div>
    )
}
