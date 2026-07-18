import { notFound, redirect } from "next/navigation"
import { FolderResponse } from "@/types/schema"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import { ChevronLeft, Folder, Layers, MoreVertical } from "lucide-react"
import FolderHeaderActions from "./FolderHeaderActions"

async function getFolder(id: string, token: string): Promise<FolderResponse | null> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

    try {
        const res = await fetch(`${apiUrl}/api/folders/${id}`, {
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
        console.error("Error fetching folder:", error)
        return null
    }
}

export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    // Attempt to get session
    const session = await getServerSession(authOptions)

    if (!session || !session.id_token) {
        redirect("/login")
    }

    const folder = await getFolder(id, session.id_token)

    if (!folder) {
        notFound()
    }

    return (
        <div className="min-h-screen bg-qz-bg text-qz-text p-6 md:p-12 relative overflow-hidden pb-32">
            <div className="max-w-7xl mx-auto relative z-10">
                <Link href="/library" className="inline-flex items-center gap-2 text-qz-text-muted hover:text-qz-text transition-colors mb-6 font-medium">
                    <ChevronLeft size={20} /> Back to Library
                </Link>

                <header className="mb-12 border-b border-qz-border-light pb-8 flex flex-col md:flex-row md:justify-between md:items-start gap-6">
                    <div className="flex items-start gap-6">
                        <div className="bg-[#4255ff]/10 text-qz-accent p-4 rounded-2xl">
                            <Folder size={48} />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-5xl font-semibold text-qz-text mb-2">
                                {folder.name}
                            </h1>
                            {folder.description && (
                                <p className="text-qz-text-muted mt-2 text-lg max-w-2xl">{folder.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-4 text-sm font-semibold text-zinc-500">
                                <span>Created {new Date(folder.createdAt).toLocaleDateString()}</span>
                                <span>•</span>
                                <span>{folder.sets.length} {folder.sets.length === 1 ? 'Set' : 'Sets'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <FolderHeaderActions folderId={id} currentSets={folder.sets} />
                        <button className="flex justify-center flex-shrink-0 items-center w-10 h-10 text-qz-text-muted hover:text-qz-text bg-qz-bg rounded-full border border-qz-border-light transition-colors shadow-lg shadow-black/20">
                            <MoreVertical size={20} />
                        </button>
                    </div>
                </header>

                <div className="mb-8">
                    <h2 className="text-xl font-bold mb-6 text-qz-text">Study Sets in {folder.name}</h2>

                    {folder.sets.length === 0 ? (
                        <div className="bg-qz-card/50 border border-qz-border-light rounded-2xl p-8 text-center max-w-2xl">
                            <Layers className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
                            <p className="text-qz-text-muted mb-4">This folder is empty.</p>
                            <p className="text-sm text-zinc-500">Go to any study set to add it to this folder.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {folder.sets.map(set => (
                                <Link href={`/set/${set.id}`} key={set.id} className="block p-6 rounded-2xl bg-qz-card border border-qz-border-light hover:border-indigo-500/50 transition-all group group/card">
                                    <h3 className="text-lg font-bold text-qz-text mb-2 group-hover/card:text-indigo-300 transition-colors line-clamp-1">{set.title}</h3>
                                    {set.description && <p className="text-qz-text-muted text-sm mb-4 line-clamp-2">{set.description}</p>}
                                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-widest mt-auto">
                                        <Layers className="w-4 h-4" /> {set.flashcardCount} Terms
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
