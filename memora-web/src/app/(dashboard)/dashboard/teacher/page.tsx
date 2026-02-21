import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function TeacherDashboard() {
    return (
        <div className="min-h-screen bg-black text-white p-8">
            <h1 className="text-3xl font-bold mb-8">Teacher Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link
                    href="/dashboard/generate"
                    className="block p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-800/50 transition-all group"
                >
                    <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Sparkles className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">Generate with AI</h2>
                    <p className="text-zinc-400 text-sm">
                        Instantly create study sets from your lecture notes, transcripts, or topics using AI.
                    </p>
                </Link>
            </div>
        </div>
    )
}
