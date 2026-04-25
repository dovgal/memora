'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function JoinPage() {
    const router = useRouter();
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRefs = useRef<HTMLInputElement[]>([]);

    const handleDigit = (index: number, value: string) => {
        const digit = value.replace(/\D/g, '').slice(-1);
        const newCode = [...code];
        newCode[index] = digit;
        setCode(newCode);
        setError(null);

        if (digit && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits entered
        if (digit && index === 5 && newCode.every(d => d)) {
            handleJoin(newCode.join(''));
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            setCode(pasted.split(''));
            setError(null);
            handleJoin(pasted);
        }
    };

    const handleJoin = async (joinCode: string) => {
        if (joinCode.length !== 6 || isJoining) return;

        setIsJoining(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/api/live/rooms/${joinCode}`);

            if (!res.ok) {
                throw new Error('Game not found. Check your code and try again.');
            }

            const data = await res.json();
            router.push(`/live/${data.roomId}/student?joinCode=${joinCode}`);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Connection error');
            setIsJoining(false);
        }
    };

    const fullCode = code.join('');

    return (
        <div className="min-h-screen bg-qz-bg flex flex-col items-center justify-center p-6">
            {/* Ambient glow */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-900/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-10">
                {/* Logo */}
                <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <Radio className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-semibold text-qz-text">Join Live Game</h1>
                        <p className="text-zinc-500 text-sm mt-1">Enter the 6-digit code from your teacher&apos;s screen</p>
                    </div>
                </div>

                {/* Code input */}
                <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                    {code.map((digit, i) => (
                        <input
                            key={i}
                            ref={el => { if (el) inputRefs.current[i] = el; }}
                            id={`join-code-digit-${i}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleDigit(i, e.target.value)}
                            onKeyDown={e => handleKeyDown(i, e)}
                            className="w-12 h-14 text-center text-2xl font-semibold text-qz-text bg-qz-bg border-2 border-qz-border focus:border-emerald-500 rounded-xl outline-none transition-colors caret-emerald-400"
                            aria-label={`Digit ${i + 1}`}
                        />
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 w-full">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Join button */}
                <button
                    id="join-game-btn"
                    onClick={() => handleJoin(fullCode)}
                    disabled={fullCode.length < 6 || isJoining}
                    className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-qz-card disabled:text-zinc-600 disabled:cursor-not-allowed text-qz-text font-bold py-4 rounded-2xl text-lg transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] hover:scale-[1.02] active:scale-[0.98]"
                >
                    {isJoining
                        ? <><Loader2 className="w-5 h-5 animate-spin" /> Joining…</>
                        : <><ArrowRight className="w-5 h-5" /> Join Game</>
                    }
                </button>
            </div>
        </div>
    );
}
