'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Radio, Users, Play, X, Wifi, WifiOff } from 'lucide-react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

interface TeacherLobbyPageProps {
    params: Promise<{ roomId: string }>;
}

// Simple colourful QR-code placeholder — a real QR lib (e.g. qrcode.react) could be added later
function JoinCodeDisplay({ code }: { code: string }) {
    return (
        <div className="flex flex-col items-center gap-4">
            <div className="w-48 h-48 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20">
                {/* Monochrome dot-grid visual stand-in for QR code */}
                <div className="grid grid-cols-8 gap-[3px] p-3 w-full h-full">
                    {Array.from({ length: 64 }).map((_, i) => (
                        <div
                            key={i}
                            className="rounded-sm"
                            style={{
                                backgroundColor:
                                    (Math.sin(i * 137.5 + parseInt(code, 10)) > 0) ? '#1e1e2e' : '#fff',
                            }}
                        />
                    ))}
                </div>
            </div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest">Join Code</p>
            <div className="text-6xl font-semibold tracking-[0.25em] text-qz-text tabular-nums">
                {code}
            </div>
        </div>
    );
}

export default function TeacherLobbyPage({ params }: TeacherLobbyPageProps) {
    const resolvedParams = useAsyncParams(params);
    const searchParams = useSearchParams();
    const router = useRouter();
    const { data: session } = useSession();

    const joinCode = searchParams.get('joinCode') ?? '------';
    const setId = searchParams.get('setId') ?? '';

    const [studentCount, setStudentCount] = useState(0);
    const [isConnected, setIsConnected] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!resolvedParams || !session) return;
        const token = session?.id_token;
        if (!token) return;

        const wsUrl = `${WS_URL}/api/live/ws?room_id=${resolvedParams.roomId}&token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => setIsConnected(true);
        ws.onclose = () => setIsConnected(false);
        ws.onerror = () => setIsConnected(false);

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data as string);
                if (msg.type === 'student_joined') {
                    setStudentCount(prev => prev + 1);
                } else if (msg.type === 'student_left') {
                    setStudentCount(prev => Math.max(0, prev - 1));
                }
            } catch {
                // ignore non-JSON messages
            }
        };

        return () => {
            ws.close();
        };
    }, [resolvedParams, session]);

    const handleStartGame = () => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        setIsStarting(true);
        wsRef.current.send(JSON.stringify({ type: 'start_game', setId }));
        router.push(`/live/${resolvedParams?.roomId}/teacher/game`);
    };

    const handleClose = () => {
        wsRef.current?.close();
        router.back();
    };

    if (!resolvedParams) {
        return (
            <div className="min-h-screen bg-qz-bg flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-qz-bg text-qz-text flex flex-col">
            {/* Top bar */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-qz-border-light bg-qz-bg/60 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                        <Radio className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-qz-text">Live Game Lobby</p>
                        <div className="flex items-center gap-1.5 text-xs">
                            {isConnected
                                ? <><Wifi className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Connected</span></>
                                : <><WifiOff className="w-3 h-3 text-red-400" /><span className="text-red-400">Disconnected</span></>
                            }
                        </div>
                    </div>
                </div>
                <button onClick={handleClose} className="p-2 text-zinc-500 hover:text-qz-text transition-colors rounded-lg hover:bg-qz-card">
                    <X className="w-5 h-5" />
                </button>
            </header>

            {/* Main projector view */}
            <main className="flex-1 flex flex-col md:flex-row items-center justify-center gap-16 p-8">
                {/* Left: Join Code + QR */}
                <div className="flex flex-col items-center gap-8">
                    <JoinCodeDisplay code={joinCode} />
                    <p className="text-zinc-500 text-sm text-center max-w-[220px]">
                        Students navigate to <span className="text-qz-accent font-mono">memora.app/live/join</span> and enter this code
                    </p>
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px h-64 bg-qz-card" />

                {/* Right: Student counter + Start */}
                <div className="flex flex-col items-center gap-8">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-2xl bg-[#4255ff]/10 border border-indigo-500/20 flex items-center justify-center">
                            <Users className="w-9 h-9 text-qz-accent" />
                        </div>
                        <div className="text-7xl font-semibold text-qz-text tabular-nums animate-in fade-in duration-300" key={studentCount}>
                            {studentCount}
                        </div>
                        <p className="text-qz-text-muted text-sm font-medium">
                            {studentCount === 1 ? 'student' : 'students'} connected
                        </p>
                    </div>

                    <button
                        id="start-game-btn"
                        onClick={handleStartGame}
                        disabled={studentCount === 0 || isStarting || !isConnected}
                        className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#586380] disabled:text-zinc-500 disabled:cursor-not-allowed text-qz-text font-bold py-4 px-10 rounded-2xl text-lg shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Play className="w-5 h-5" />
                        Start Game
                    </button>

                    {studentCount === 0 && (
                        <p className="text-zinc-600 text-xs text-center">
                            Waiting for students to join…
                        </p>
                    )}
                </div>
            </main>
        </div>
    );
}

// React.use() wrapper for async params in Next.js 15+
function useAsyncParams<T>(promise: Promise<T>): T | null {
    const [value, setValue] = useState<T | null>(null);
    useEffect(() => {
        promise.then(setValue);
    }, [promise]);
    return value;
}
