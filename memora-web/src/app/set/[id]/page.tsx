import { notFound } from "next/navigation"
import { SetResponse, SetProgressResponse } from "@/types/schema"
import PublicActionBanner from "./PublicActionBanner"
import QChatWrapper from "./QChatWrapper"
import HostLiveGameButton from "./HostLiveGameButton"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import { GraduationCap, Copy, Share2, BookOpen, Layers, ChevronLeft } from "lucide-react"
import AddToFolderModal from "./AddToFolderModal"
import FlashcardPlayer from "./FlashcardPlayer"
import SetActionsBar from "./SetActionsBar"

async function getSet(id: string, token?: string): Promise<SetResponse | null> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

    try {
        const headers: Record<string, string> = {}
        if (token) {
            headers["Authorization"] = `Bearer ${token}`
        }

        const res = await fetch(`${apiUrl}/api/sets/${id}`, {
            headers,
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

    // Attempt to get session. Type any here guards against strict authOptions typing issues from route.ts
    const session: any = await getServerSession(authOptions as any)
    const token = session?.id_token

    const set = await getSet(id, token)

    if (!set) {
        notFound()
    }

    let progress: SetProgressResponse | null = null

    if (token) {
        progress = await getProgress(id, token)
    }

    const role = session?.user?.role || "student"
    const dashboardLink = role === "teacher" ? "/dashboard/teacher" : "/dashboard/student"

    return (
        <div className="min-h-screen bg-[#0a0a1a] text-white p-6 md:p-12 relative overflow-hidden pb-32 font-sans">
            <div className="max-w-5xl mx-auto relative z-10">
                <Link href={dashboardLink} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-6 font-medium text-sm">
                    <ChevronLeft size={16} /> Назад к панели управления
                </Link>

                <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                            {set.title}
                        </h1>
                        {set.description && (
                            <p className="text-zinc-400 text-sm max-w-2xl">{set.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-4 text-xs font-semibold text-zinc-500">
                            <span className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 px-3 py-1 rounded-full"><Layers size={14} /> {set.flashcards.length} терминов</span>
                        </div>
                    </div>

                    <div className="flex items-center">
                        <SetActionsBar
                            setId={id}
                            token={session?.id_token}
                            flashcards={set.flashcards}
                            fieldsSchema={set.fieldsSchema || []}
                            isOwner={true}
                            title={set.title}
                            description={set.description || ""}
                        />
                    </div>
                </header>

                {/* Horizontal Study Modes Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                    <Link href={`/set/${id}/flashcards`} className="bg-[#1f1f3d] hover:bg-[#2a2a4d] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-[#2a2a4d]">
                        <BookOpen size={18} className="text-indigo-400" /> Карточки
                    </Link>
                    <Link href={`/set/${id}/learn`} className="bg-[#1f1f3d] hover:bg-[#2a2a4d] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-[#2a2a4d]">
                        <GraduationCap size={18} className="text-purple-400" /> Заучивание
                    </Link>
                    <Link href={`/set/${id}/test`} className="bg-[#1f1f3d] hover:bg-[#2a2a4d] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-[#2a2a4d]">
                        <BookOpen size={18} className="text-orange-400" /> Тест
                    </Link>
                    <Link href={`/set/${id}/match`} className="bg-[#1f1f3d] hover:bg-[#2a2a4d] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-[#2a2a4d]">
                        <Copy size={18} className="text-emerald-400" /> Подбор
                    </Link>
                    <Link href={`/set/${id}/blocks`} className="bg-[#1f1f3d] hover:bg-[#2a2a4d] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-[#2a2a4d]">
                        <Layers size={18} className="text-blue-400" /> Блоки
                    </Link>
                    <Link href={`/set/${id}/blast`} className="bg-[#1f1f3d] hover:bg-[#2a2a4d] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-[#2a2a4d]">
                        <span className="text-cyan-400 font-black">🚀</span> Blast
                    </Link>
                </div>

                {/* The Flashcard Player Inline */}
                <div className="mb-16 flex justify-center w-full">
                    <FlashcardPlayer flashcards={set.flashcards} fieldsSchema={set.fieldsSchema} setId={id} />
                </div>

                {/* Terms List and Mastery */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
                    <div className="lg:col-span-3">
                        <h2 className="text-xl font-bold mb-6 text-white">Термины в этом модуле ({set.flashcards.length})</h2>
                        <div className="flex flex-col gap-4">
                            {set.flashcards.map((card: any, index: number) => {
                                const schema = set.fieldsSchema || [];
                                const getPreviewText = (side: 'front' | 'back') => {
                                    if (!schema.length) return <p className="font-semibold text-lg break-words">{side === 'front' ? card.term : card.definition}</p>;
                                    const textFields = schema.filter(f => f.side === side && f.type === 'text').sort((a, b) => a.order - b.order);
                                    if (textFields.length === 0) return <p className="italic text-zinc-500 text-sm">(Без текста)</p>;

                                    return (
                                        <div className="flex flex-col gap-3">
                                            {textFields.map(field => {
                                                let val = "";
                                                if (field.id === 'term') val = card.term;
                                                else if (field.id === 'definition') val = card.definition;
                                                else val = card.fieldsData?.[field.id] || "";
                                                if (!val) return null;

                                                return (
                                                    <div key={field.id} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 w-full">
                                                        {textFields.length > 1 && (
                                                            <span className="text-[10px] text-indigo-400/80 font-bold uppercase tracking-widest shrink-0 sm:w-1/4 sm:text-right">
                                                                {field.name}
                                                            </span>
                                                        )}
                                                        <span className={`flex-1 break-words leading-relaxed ${side === 'front' ? 'font-semibold text-white text-lg' : 'font-medium text-zinc-300'}`}>
                                                            {val}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                };

                                return (
                                    <div
                                        key={card.id}
                                        className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-6 rounded-2xl flex flex-col md:flex-row gap-4 md:gap-8 transition-colors group cursor-default shadow-md"
                                    >
                                        <div className="md:w-1/3 border-b md:border-b-0 md:border-r border-zinc-800 pb-4 md:pb-0 md:pr-8 flex items-center">
                                            {getPreviewText('front')}
                                        </div>
                                        <div className="md:w-2/3 flex items-center pl-0 md:pl-4">
                                            {getPreviewText('back')}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="lg:col-span-1 flex flex-col gap-4">
                        {session && progress && progress.totalCards > 0 && (
                            <div className="bg-[#1f1f3d] border border-[#2a2a4d] p-6 rounded-2xl sticky top-6">
                                <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-4">Ваш прогресс</h3>
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="text-4xl font-black text-indigo-400">{progress.masteryPercentage}%</div>
                                </div>
                                <div className="w-full bg-[#0a0a1a] rounded-full h-2 mb-4 overflow-hidden border border-[#2a2a4d]">
                                    <div
                                        className="bg-indigo-500 h-2 rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${progress.masteryPercentage}%` }}
                                    ></div>
                                </div>
                                <div className="text-xs font-medium text-zinc-400 flex justify-between">
                                    <span>{progress.knownCards} Выучено</span>
                                    <span>{progress.totalCards - progress.knownCards} Осталось</span>
                                </div>
                            </div>
                        )}
                        {/* Live Game — teacher only */}
                        {session && (
                            <div className="sticky top-48">
                                <HostLiveGameButton setId={id} />
                            </div>
                        )}
                    </div>
                </div>

                <PublicActionBanner />
            </div>

            {/* Q-Chat panel (client component) — fixed-positioned, visible only when authenticated */}
            {session && <QChatWrapper setId={id} />}
        </div>
    )
}
