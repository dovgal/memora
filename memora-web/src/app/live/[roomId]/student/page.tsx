'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Users, Wifi, WifiOff, Sparkles } from 'lucide-react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

// Team colour palette (6 teams)
const TEAM_COLOURS: Record<string, { bg: string; border: string; glow: string; emoji: string }> = {
    Tiger: { bg: 'bg-orange-600', border: 'border-orange-500', glow: 'shadow-orange-500/40', emoji: '🐯' },
    Falcon: { bg: 'bg-blue-600', border: 'border-blue-400', glow: 'shadow-blue-500/40', emoji: '🦅' },
    Shark: { bg: 'bg-cyan-600', border: 'border-cyan-400', glow: 'shadow-cyan-500/40', emoji: '🦈' },
    Panda: { bg: 'bg-zinc-100', border: 'border-zinc-200', glow: 'shadow-zinc-200/40', emoji: '🐼' },
    Dragon: { bg: 'bg-red-600', border: 'border-red-400', glow: 'shadow-red-500/40', emoji: '🐉' },
    Phoenix: { bg: 'bg-[#4255ff]', border: 'border-purple-400', glow: 'shadow-purple-500/40', emoji: '🦄' },
};

interface StudentLobbyPageProps {
    params: Promise<{ roomId: string }>;
}

export default function StudentLobbyPage({ params }: StudentLobbyPageProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { data: session } = useSession();

    const [roomId, setRoomId] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [team, setTeam] = useState<string | null>(null);
    const [isRevealing, setIsRevealing] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const joinCode = searchParams.get('joinCode') ?? '------';

    // Resolve async params
    useEffect(() => {
        params.then(p => setRoomId(p.roomId));
    }, [params]);

    const connectWs = useCallback(() => {
        if (!roomId) return;

        // @ts-expect-error id_token injected by custom authOptions
        const token = session?.id_token ?? 'anonymous';
        const wsUrl = `${WS_URL}/api/live/ws?room_id=${roomId}&token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            // Announce presence to the room
            ws.send(JSON.stringify({ type: 'student_joined' }));
        };

        ws.onclose = () => setIsConnected(false);
        ws.onerror = () => setIsConnected(false);

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data as string);

                if (msg.type === 'team_assigned' && msg.team) {
                    setIsRevealing(true);
                    setTimeout(() => {
                        setTeam(msg.team);
                        setIsRevealing(false);
                    }, 600);
                }

                if (msg.type === 'game_started') {
                    router.push(`/live/${roomId}/student/game`);
                }
            } catch {
                // ignore non-JSON
            }
        };

        return () => ws.close();
    }, [roomId, session, router]);

    useEffect(() => {
        const cleanup = connectWs();
        return cleanup;
    }, [connectWs]);

    const teamStyle = team ? (TEAM_COLOURS[team] ?? TEAM_COLOURS.Tiger) : null;

    return (
        <div className="min-h-screen bg-qz-bg text-qz-text flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient background glow — changes colour when team is assigned */}
            <div
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[160px] pointer-events-none transition-all duration-1000 ${team ? 'opacity-30' : 'opacity-15'
                    } ${team ? 'bg-emerald-500' : 'bg-indigo-800'}`}
            />

            <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-8">

                {!team ? (
                    /* ── Waiting state ── */
                    <>
                        <div className="flex flex-col items-center gap-3">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-colors ${isConnected
                                    ? 'bg-emerald-500/10 border-emerald-500/30'
                                    : 'bg-red-500/10 border-red-500/30'
                                }`}>
                                {isConnected
                                    ? <Wifi className="w-7 h-7 text-emerald-400" />
                                    : <WifiOff className="w-7 h-7 text-red-400" />
                                }
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-semibold text-qz-text">You&apos;re in!</p>
                                <p className="text-zinc-500 text-sm mt-1">Waiting for the teacher to start…</p>
                            </div>
                        </div>

                        {/* Join code display */}
                        <div className="bg-qz-bg/60 border border-qz-border-light rounded-2xl px-8 py-5 text-center">
                            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Game Code</p>
                            <p className="text-4xl font-semibold tracking-[0.3em] text-[#ffcd1f] tabular-nums">{joinCode}</p>
                        </div>

                        {/* Animated waiting dots */}
                        <div className="flex gap-2 items-center">
                            <div className="w-2 h-2 bg-[#586380] rounded-full animate-bounce [animation-delay:0ms]" />
                            <div className="w-2 h-2 bg-[#586380] rounded-full animate-bounce [animation-delay:150ms]" />
                            <div className="w-2 h-2 bg-[#586380] rounded-full animate-bounce [animation-delay:300ms]" />
                        </div>

                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-qz-bg/40 border border-qz-border-light">
                            <Users className="w-4 h-4 text-zinc-500" />
                            <p className="text-sm text-zinc-500">
                                {isConnected ? 'Connected — waiting for others' : 'Reconnecting…'}
                            </p>
                        </div>
                    </>
                ) : (
                    /* ── Team reveal state ── */
                    <div className={`flex flex-col items-center gap-6 animate-in zoom-in fade-in duration-700 ${isRevealing ? 'opacity-0 scale-90' : 'opacity-100 scale-100'} transition-all`}>
                        <div className="flex flex-col items-center gap-2">
                            <Sparkles className="w-6 h-6 text-yellow-400 animate-spin" />
                            <p className="text-qz-text-muted text-sm uppercase tracking-widest font-bold">You&apos;re on team</p>
                        </div>

                        <div className={`w-48 h-48 rounded-3xl ${teamStyle!.bg} ${teamStyle!.border} border-4 shadow-2xl ${teamStyle!.glow} flex flex-col items-center justify-center gap-3 transition-all`}>
                            <span className="text-7xl">{teamStyle!.emoji}</span>
                        </div>

                        <p className={`text-5xl font-semibold ${team === 'Panda' ? 'text-zinc-900' : 'text-qz-text'}`}>
                            {team}
                        </p>

                        <p className="text-zinc-500 text-sm text-center">
                            Get ready! The game is about to begin…
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
