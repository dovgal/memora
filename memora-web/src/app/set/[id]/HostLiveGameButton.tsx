'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Radio, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface HostLiveGameButtonProps {
    setId: string;
}

export default function HostLiveGameButton({ setId }: HostLiveGameButtonProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleHost = async () => {
        // @ts-expect-error id_token injected by custom authOptions
        if (!session?.id_token) return;

        setIsCreating(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/api/live/rooms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // @ts-expect-error id_token injected by custom authOptions
                    'Authorization': `Bearer ${session.id_token}`,
                },
                body: JSON.stringify({ set_id: setId }),
            });

            if (!res.ok) {
                throw new Error('Failed to create room');
            }

            const data = await res.json();
            router.push(`/live/${data.roomId}/teacher?joinCode=${data.joinCode}&setId=${setId}`);
        } catch (e: any) {
            setError(e.message || 'Failed to start game');
            setIsCreating(false);
        }
    };

    return (
        <div>
            <button
                id="host-live-game-btn"
                onClick={handleHost}
                disabled={isCreating}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl flex items-center justify-between transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:-translate-y-1"
            >
                <span className="flex items-center gap-3">
                    {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Radio size={20} />}
                    {isCreating ? 'Creating room…' : 'Host Live Game'}
                </span>
            </button>
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>
    );
}
