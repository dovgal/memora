import Link from 'next/link';
import { Sparkles, UploadCloud, Layers } from 'lucide-react';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { SetSummaryResponse } from "@/types/schema";

async function getUserSets(token: string): Promise<SetSummaryResponse[]> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    try {
        const res = await fetch(`${apiUrl}/api/sets`, {
            headers: { "Authorization": `Bearer ${token}` },
            cache: 'no-store'
        });
        if (!res.ok) return [];
        return await res.json();
    } catch {
        return [];
    }
}

export default async function StudentDashboard() {
    const session: any = await getServerSession(authOptions as any);
    let sets: SetSummaryResponse[] = [];

    if (session?.id_token) {
        sets = await getUserSets(session.id_token);
    }

    // Sort sets to put newest first just in case
    sets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const recentSets = sets.slice(0, 3);
    const topGameSet = sets[0]; // Set to promote for Keep your brain fresh
    const otherSets = sets.slice(3, 9); // Limit recents

    return (
        <div className="min-h-screen bg-[#0a0f1d] text-white selection:bg-[#4255ff]/30">
            <div className="p-8 max-w-7xl mx-auto space-y-16">

                {/* Jump back in Section (Big Interactive Carousel Cards) */}
                <section>
                    <h2 className="text-xl font-bold mb-6 text-qz-text tracking-wide">Jump back in</h2>

                    {sets.length === 0 ? (
                        <div className="bg-[#171c2e] border border-[#262c40] rounded-3xl p-12 text-center shadow-lg">
                            <div className="w-20 h-20 bg-[#262c40] rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <Layers className="w-10 h-10 text-[#ffcd1f]" />
                            </div>
                            <h3 className="text-2xl font-bold mb-2">Welcome to Memora</h3>
                            <p className="text-[#8e95ae] mb-6 max-w-sm mx-auto">You don't have any study sets yet. Open your Library or Sidebar to create one.</p>
                        </div>
                    ) : (
                        <div className="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide">
                            {recentSets.map((set, idx) => {
                                // Rotate gradients for visual variety
                                const gradients = [
                                    "from-indigo-900/40 via-purple-900/20 to-transparent",
                                    "from-blue-900/40 via-cyan-900/20 to-transparent",
                                    "from-emerald-900/40 via-teal-900/20 to-transparent"
                                ];
                                const bgGradient = gradients[idx % gradients.length];

                                // Mock progress for UI feeling
                                const mockProgress = Math.floor(Math.random() * 40) + 10;

                                return (
                                    <div key={set.id} className="min-w-[400px] w-[500px] snap-start relative group rounded-[2rem] bg-[#171c2e] overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_20px_40px_-15px_rgba(79,70,229,0.2)] border border-[#262c40] hover:border-indigo-500/50 flex flex-col cursor-pointer">
                                        {/* Background Decoration */}
                                        <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} opacity-50`}></div>
                                        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#4255ff]/10 rounded-full mix-blend-screen filter blur-[40px] group-hover:bg-[#4255ff]/20 transition-all duration-500"></div>

                                        <div className="relative z-10 p-8 flex-1 flex flex-col justify-between h-full">
                                            <div>
                                                <div className="flex justify-between items-start mb-6">
                                                    <h3 className="text-2xl font-bold text-qz-text group-hover:text-indigo-300 transition-colors line-clamp-2 leading-tight">
                                                        {set.title}
                                                    </h3>
                                                    <button className="text-zinc-500 hover:text-qz-text transition-colors p-2 hover:bg-white/10 rounded-full">
                                                        <Sparkles className="w-5 h-5" />
                                                    </button>
                                                </div>

                                                <div className="space-y-2 mb-8">
                                                    <div className="w-3/4 h-2 bg-[#0a0f1d] rounded-full overflow-hidden border border-[#262c40]">
                                                        <div className="h-full bg-[#4255ff] rounded-full relative" style={{ width: `${mockProgress}%` }}>
                                                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs font-medium text-[#8e95ae] tracking-wide">{mockProgress}/{set.flashcardCount} cards reviewed</p>
                                                </div>
                                            </div>

                                            <Link href={`/set/${set.id}`} className="inline-flex w-max items-center justify-center bg-[#4255ff] hover:bg-[#4255ff] text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-indigo-500/30 transition-all hover:shadow-indigo-500/50 active:scale-95">
                                                Continue
                                            </Link>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </section>

                {/* Keep your brain fresh (Games Promotion Block) */}
                {topGameSet && (
                    <section>
                        <h2 className="text-xl font-bold mb-6 text-qz-text tracking-wide">Keep your brain fresh</h2>
                        <div className="relative rounded-[2rem] bg-[#171c2e] overflow-hidden border border-[#262c40] group">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/30 to-purple-900/10 z-0"></div>

                            <div className="relative z-10 p-10 flex flex-col md:flex-row items-center justify-between gap-12">
                                <div className="flex-1">
                                    <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 text-blue-400 border border-blue-500/30">
                                        <Sparkles className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-3xl font-semibold text-qz-text mb-2 leading-tight">from {topGameSet.title}</h3>
                                    <p className="text-[#8e95ae] text-lg mb-8 max-w-md">Get more moves by answering correctly before time runs out.</p>

                                    <div className="flex gap-4">
                                        <Link href={`/set/${topGameSet.id}`} className="bg-qz-card hover:bg-[#586380] border border-qz-border text-qz-text font-bold py-3 px-8 rounded-full transition-all hover:border-zinc-500 shadow-md">
                                            Play Blast
                                        </Link>
                                    </div>
                                </div>

                                {/* Abstract decorative illustration mimicking a game */}
                                <div className="flex-1 w-full max-w-md relative aspect-video bg-[#0a0f1d] rounded-2xl border border-qz-border-light/50 overflow-hidden shadow-2xl flex items-center justify-center">
                                    <div className="relative w-full h-full p-6 flex flex-wrap gap-2 content-center justify-center opacity-80 group-hover:scale-105 transition-transform duration-700">
                                        <div className="w-16 h-16 bg-blue-500 rounded-lg animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-16 h-16 bg-[#4255ff] rounded-lg animate-bounce" style={{ animationDelay: '200ms' }}></div>
                                        <div className="w-16 h-16 bg-pink-500 rounded-lg animate-bounce" style={{ animationDelay: '400ms' }}></div>
                                        <div className="w-16 h-16 bg-[#4255ff] rounded-lg animate-bounce" style={{ animationDelay: '600ms' }}></div>
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1d] to-transparent"></div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Recents Section (Compact 2-column list) */}
                {otherSets.length > 0 && (
                    <section>
                        <h2 className="text-xl font-bold mb-6 text-qz-text tracking-wide">Recents</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {otherSets.map(set => (
                                <Link href={`/set/${set.id}`} key={set.id} className="flex items-center gap-6 p-5 rounded-2xl bg-[#171c2e] border border-transparent hover:border-[#262c40] hover:bg-[#1a1f33] transition-all group cursor-pointer shadow-sm hover:shadow-md">
                                    <div className="w-12 h-12 bg-[#2d3348] rounded-xl flex items-center justify-center text-[#8e95ae] group-hover:bg-[#4255ff]/20 group-hover:text-[#ffcd1f] transition-colors shrink-0">
                                        <Layers className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-zinc-100 group-hover:text-indigo-300 transition-colors line-clamp-1">{set.title}</h4>
                                        <p className="text-sm font-medium text-[#8e95ae]">{set.flashcardCount} cards</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    )
}
