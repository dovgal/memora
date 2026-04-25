import { notFound } from "next/navigation"
import { SetResponse, FlashcardResponse, SetProgressResponse } from "@/types/schema"
import PublicActionBanner from "./PublicActionBanner"
import QChatWrapper from "./QChatWrapper"
import HostLiveGameButton from "./HostLiveGameButton"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import { GraduationCap, Copy, BookOpen, Layers, ChevronLeft } from "lucide-react"
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
            cache: 'no-store'
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
        
        return await res.json();
    } catch (error) {
        console.error("Error fetching progress:", error)
        return null
    }
}

export default async function SetPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    // Attempt to get session. Type any here guards against strict authOptions typing issues from route.ts
    const session = await getServerSession(authOptions) as { id_token?: string; user?: { id?: string; email?: string; role?: string } } | null
    const token = session?.id_token

    // Start both fetches in parallel
    const [set, progress] = await Promise.all([
        getSet(id, token),
        token ? getProgress(id, token) : Promise.resolve(null)
    ])

    if (!set) {
        notFound()
    }

    const role = session?.user?.role || "student"
    const dashboardLink = role === "teacher" ? "/dashboard/teacher" : "/dashboard/student"

    return (
        <div className="min-h-screen bg-qz-bg text-qz-text p-6 md:p-12 relative overflow-hidden pb-32 font-sans">
            <div className="max-w-5xl mx-auto relative z-10">

                <Link href={dashboardLink} className="inline-flex items-center gap-2 text-qz-text-muted hover:text-qz-text transition-colors mb-6 font-medium text-sm">
                    <ChevronLeft size={16} /> Назад к панели управления
                </Link>

                <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-qz-text mb-2">
                            {set.title}
                        </h1>
                        {set.description && (
                            <p className="text-qz-text-muted text-sm max-w-2xl">{set.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-4 text-xs font-semibold text-zinc-500">
                            <span className="flex items-center gap-1 bg-qz-bg border border-qz-border px-3 py-1 rounded-full"><Layers size={14} /> {set.flashcards.length} терминов</span>
                        </div>
                    </div>

                    <div className="flex items-center">
                        <SetActionsBar
                            setId={id}
                            token={session?.id_token}
                            flashcards={set.flashcards}
                            fieldsSchema={set.fieldsSchema || []}
                            isOwner={
                                (() => {
                                    const s = set as unknown as { creator_id?: string; creator_email?: string };
                                    return (
                                        session?.user?.id === set.creatorId ||
                                        session?.user?.id === s.creator_id ||
                                        session?.user?.email === s.creator_email
                                    );
                                })()
                            }
                            title={set.title}
                            description={set.description || ""}
                        />
                    </div>
                </header>

                {/* Horizontal Study Modes Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                    <Link href={`/set/${id}/flashcards`} className="bg-qz-card hover:bg-qz-card text-qz-text font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-qz-border-light">
                        <BookOpen size={18} className="text-[#ffcd1f]" /> Карточки
                    </Link>
                    <Link href={`/set/${id}/learn`} className="bg-qz-card hover:bg-qz-card text-qz-text font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-qz-border-light">
                        <GraduationCap size={18} className="text-[#ffcd1f]" /> Заучивание
                    </Link>
                    <Link href={`/set/${id}/test`} className="bg-qz-card hover:bg-qz-card text-qz-text font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-qz-border-light">
                        <BookOpen size={18} className="text-orange-400" /> Тест
                    </Link>
                    <Link href={`/set/${id}/match`} className="bg-qz-card hover:bg-qz-card text-qz-text font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-qz-border-light">
                        <Copy size={18} className="text-emerald-400" /> Подбор
                    </Link>
                    <Link href={`/set/${id}/blocks`} className="bg-qz-card hover:bg-qz-card text-qz-text font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-qz-border-light">
                        <Layers size={18} className="text-blue-400" /> Блоки
                    </Link>
                    <Link href={`/set/${id}/blast`} className="bg-qz-card hover:bg-qz-card text-qz-text font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-qz-border-light">
                        <span className="text-cyan-400 font-semibold">🚀</span> Blast
                    </Link>
                </div>

                {/* The Flashcard Player Inline */}
                <div className="mb-16 flex justify-center w-full">
                    <FlashcardPlayer flashcards={set.flashcards} fieldsSchema={set.fieldsSchema} setId={id} />
                </div>

                {/* Terms List and Mastery */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
                    <div className="lg:col-span-3">
                        {/* Process cards into 3 FSRS groups based on progress object */}
                        {(() => {
                            // Extract states map for O(1) lookup
                            const progressMap = new Map<string, number>();
                            if (progress && progress.cards) {
                                progress.cards.forEach(c => progressMap.set(c.flashcardId, c.state));
                            }

                            const mastered: FlashcardResponse[] = []; // State 2
                            const learning: FlashcardResponse[] = []; // State 1 or 3
                            const notStudied: FlashcardResponse[] = []; // State 0 or missing

                            set.flashcards.forEach(card => {
                                const state = progressMap.get(card.id) ?? 0;
                                if (state === 2) mastered.push(card);
                                else if (state === 1 || state === 3) learning.push(card);
                                else notStudied.push(card);
                            });

                            const schema = set.fieldsSchema || [];

                            // Reusable Card Renderer
                            const renderCard = (card: FlashcardResponse) => {
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
                                                else { const v = card.fieldsData?.[field.id]; val = typeof v === 'string' ? v : ""; }
                                                if (!val) return null;

                                                return (
                                                    <div key={field.id} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 w-full">
                                                        {textFields.length > 1 && (
                                                            <span className="text-[10px] text-[#ffcd1f]/80 font-bold uppercase tracking-widest shrink-0 sm:w-1/4 sm:text-right">
                                                                {field.name}
                                                            </span>
                                                        )}
                                                        <span className={`flex-1 break-words leading-relaxed ${side === 'front' ? 'font-semibold text-qz-text text-base md:text-lg' : 'font-medium text-qz-text-muted text-sm md:text-base'}`}>
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
                                        className="bg-qz-card border border-transparent shadow-[0_2px_8px_rgba(0,0,0,0.2)] md:hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] p-4 md:p-6 rounded-xl flex flex-col md:flex-row gap-4 md:gap-8 transition-all group cursor-default"
                                    >
                                        <div className="md:w-1/3 border-b md:border-b-0 md:border-r border-[#262c40] pb-4 md:pb-0 md:pr-8 flex items-center">
                                            {getPreviewText('front')}
                                        </div>
                                        <div className="md:w-2/3 flex items-center pl-0 md:pl-4 justify-between">
                                            <div className="flex-1">
                                                {getPreviewText('back')}
                                            </div>
                                            {/* Quizlet-style interactive icons hidden until hover on desktop */}
                                            <div className="hidden md:flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="text-qz-text-muted hover:text-amber-400 transition-colors" title="Добавить в избранное">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                                </button>
                                                <button className="text-qz-text-muted hover:text-[#ffcd1f] transition-colors" title="Редактировать">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            };

                            const renderGroup = (title: string, cards: FlashcardResponse[], colorClass: string, subtitle?: string) => {
                                if (cards.length === 0) return null;
                                return (
                                    <div className="mb-12">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className={`text-lg font-bold ${colorClass}`}>{title} ({cards.length})</h3>
                                                {subtitle && <p className="text-sm text-qz-text-muted mt-1">{subtitle}</p>}
                                            </div>
                                            <button className="text-xs font-semibold text-qz-text-muted bg-qz-card hover:bg-qz-card border border-qz-border-light px-4 py-2 rounded-full flex items-center gap-2 transition-colors">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                                Выбрать {cards.length}
                                            </button>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            {cards.map(renderCard)}
                                        </div>
                                    </div>
                                );
                            };

                            return (
                                <div className="w-full">
                                    <div className="flex items-center justify-between mb-8">
                                        <h2 className="text-xl font-bold text-qz-text">Термины в модуле ({set.flashcards.length})</h2>
                                        <button className="text-sm font-semibold text-qz-text-muted hover:text-qz-text transition-colors flex items-center gap-1 cursor-pointer">
                                            Ваша статистика <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                        </button>
                                    </div>

                                    {/* Groups */}
                                    {renderGroup("Изучено", learning, "text-orange-400", "Вы начали изучать эти термины. Продолжайте!")}
                                    {renderGroup("Усвоено", mastered, "text-emerald-400", "Вы хорошо усвоили эти термины!")}
                                    {renderGroup("Не изучено", notStudied, "text-qz-text-muted", "Вы еще не проходили эти термины!")}
                                </div>
                            );
                        })()}
                    </div>

                    <div className="lg:col-span-1 flex flex-col gap-4">
                        {session && progress && progress.totalCards > 0 && (
                            <div className="bg-qz-card border border-qz-border-light p-6 rounded-2xl sticky top-6">
                                <h3 className="text-qz-text-muted text-xs font-bold uppercase tracking-widest mb-4">Ваш прогресс</h3>
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="text-4xl font-semibold text-[#ffcd1f]">{progress.masteryPercentage}%</div>
                                </div>
                                <div className="w-full bg-qz-bg rounded-full h-2 mb-4 overflow-hidden border border-qz-border-light">
                                    <div
                                        className="bg-[#4255ff] h-2 rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${progress.masteryPercentage}%` }}
                                    ></div>
                                </div>
                                <div className="text-xs font-medium text-qz-text-muted flex justify-between">
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
