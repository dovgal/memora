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

export default async function TeacherDashboard() {
    const session = await getServerSession(authOptions);
    let sets: SetSummaryResponse[] = [];

    if (session?.id_token) {
        sets = await getUserSets(session.id_token);
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Teacher Dashboard</h1>

            <section className="mb-12">
                <h2 className="text-xl font-semibold mb-4 text-qz-text-muted">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Link href="/dashboard/teacher/a2" className="block p-6 rounded-2xl bg-qz-card border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-qz-card/50 transition-all group">
                        <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Layers className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2 text-qz-text">Кабинет курса «Французский A2»</h3>
                        <p className="text-qz-text-muted text-sm">Классы, диагностики учеников, назначение планов и аналитика ошибок.</p>
                    </Link>
                    <Link href="/dashboard/generate" className="block p-6 rounded-2xl bg-qz-card border border-qz-border-light hover:border-indigo-500/50 hover:bg-qz-card/50 transition-all group">
                        <div className="h-12 w-12 rounded-xl bg-[#4255ff]/10 text-[#ffcd1f] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2 text-qz-text">Generate with AI</h3>
                        <p className="text-qz-text-muted text-sm">Instantly create study sets from your lecture notes, transcripts, or topics using AI.</p>
                    </Link>

                    <Link href="/create" className="block p-6 rounded-2xl bg-qz-card border border-qz-border-light hover:border-indigo-500/50 hover:bg-qz-card/50 transition-all group">
                        <div className="h-12 w-12 rounded-xl bg-[#4255ff]/10 text-[#ffcd1f] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <UploadCloud className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2 text-qz-text">Import Flashcards</h3>
                        <p className="text-qz-text-muted text-sm">Copy and paste your terms and definitions from Excel, Word, or Docs.</p>
                    </Link>
                </div>
            </section>

            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-qz-text-muted">Your Recent Sets</h2>
                    <Link href="/library" className="text-sm font-medium text-[#ffcd1f] hover:text-indigo-300 transition-colors">View Library</Link>
                </div>
                {sets.length === 0 ? (
                    <div className="bg-qz-card/50 border border-qz-border-light rounded-2xl p-8 text-center">
                        <p className="text-qz-text-muted mb-4">You haven&apos;t created any study sets yet.</p>
                        <Link href="/create" className="inline-block bg-[#4255ff] hover:bg-indigo-400 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                            Create a Set
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sets.map(set => (
                            <Link href={`/set/${set.id}`} key={set.id} className="block p-6 rounded-2xl bg-qz-card border border-qz-border-light hover:border-indigo-500/50 transition-all group group/card">
                                <h3 className="text-lg font-bold text-qz-text mb-2 group-hover/card:text-indigo-300 transition-colors line-clamp-1">{set.title}</h3>
                                {set.description && <p className="text-qz-text-muted text-sm mb-4 line-clamp-2">{set.description}</p>}
                                <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 uppercase tracking-widest mt-auto mt-4">
                                    <span className="flex items-center gap-2"><Layers className="w-4 h-4" /> {set.flashcardCount} Terms</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
