'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function GenerateFlashcardsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedCards, setGeneratedCards] = useState<{ term: string, definition: string }[]>([]);

    const handleGenerate = async () => {
        // @ts-expect-error id_token is injected by our custom authOptions
        if (!prompt.trim() || !session?.id_token) return;

        setIsGenerating(true);
        setError(null);
        setGeneratedCards([]); // Clear previous results

        try {
            let accumulatedJsonString = '';

            await fetchEventSource('http://localhost:8000/api/ai/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // @ts-expect-error id_token is injected by our custom authOptions
                    'Authorization': `Bearer ${session.id_token}`,
                },
                body: JSON.stringify({ prompt }),
                onmessage(ev) {
                    if (ev.event === 'done' || ev.data === '[DONE]') {
                        setIsGenerating(false);
                        return;
                    }

                    if (ev.event === 'error') {
                        setError(ev.data);
                        setIsGenerating(false);
                        return;
                    }

                    accumulatedJsonString += ev.data;

                    // Naive trick: The LLM streams an array of objects `[{"term":"...","definition":"..."}, ...]`. 
                    // To render them before the stream finishes, we try to parse the entire accumulated string 
                    // by appending `]` if it's incomplete. If it fails to parse (e.g. cut off inside a string),
                    // we catch the error and simply wait for the next chunk until it's valid again.
                    try {
                        let parseablePayload = accumulatedJsonString;
                        if (!parseablePayload.endsWith(']')) {
                            // Close the last object if it's open, and close the array.
                            // This is incredibly simplistic and brittle if the stream stops mid-key, 
                            // but reactively recovers when the next valid token completes the syntax.
                            parseablePayload = parseablePayload.replace(/,\s*$/, '') + ']';
                            // If it's still missing brackets (like mid-string), JSON.parse throws, which is fine!
                        }

                        const parsed = JSON.parse(parseablePayload);
                        if (Array.isArray(parsed)) {
                            setGeneratedCards(parsed);
                        }
                    } catch (err) {
                        // Expected: JSON is incomplete in this exact chunk. We wait.
                    }
                },
                onerror(err) {
                    console.error("EventSource failed:", err);
                    setError('Failed to connect to AI Gateway.');
                    setIsGenerating(false);
                    throw err; // Stop retrying on fatal error
                }
            });
        } catch (e) {
            console.error(e);
            setError('An unexpected error occurred during generation.');
            setIsGenerating(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 md:p-8 min-h-screen">
            <div className="mb-8 flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                    <Sparkles className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Generate Flashcards</h1>
                    <p className="text-zinc-400 text-sm">Paste notes, transcripts, or topics to extract study material automatically.</p>
                </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-6 mb-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="E.g., In 1603, Tokugawa Ieyasu became shogun of Japan..."
                    className="w-full h-48 bg-black/50 text-white border border-zinc-700/50 rounded-xl p-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y mb-4 font-mono text-sm leading-relaxed"
                />

                {error && (
                    <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => router.back()}
                        className="px-6 py-2 rounded-lg text-zinc-400 hover:text-white transition-colors"
                        disabled={isGenerating}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Generate
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Results Area Placeholder */}
            {(isGenerating || generatedCards.length > 0) && (
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white mb-4">
                        {isGenerating ? 'Extracting Knowledge...' : 'Generation Complete'}
                    </h3>

                    <div className="flex flex-col gap-4">
                        {generatedCards.map((card, idx) => (
                            <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h4 className="font-semibold text-indigo-300 mb-2">{card.term}</h4>
                                <p className="text-zinc-300 whitespace-pre-wrap">{card.definition}</p>
                            </div>
                        ))}

                        {isGenerating && (
                            <div className="bg-zinc-900/50 border border-zinc-800/50 border-dashed rounded-xl p-4 h-24 animate-pulse" />
                        )}
                    </div>

                    {!isGenerating && generatedCards.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-zinc-800 flex justify-end">
                            <button className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3 rounded-lg font-medium shadow-xl shadow-indigo-500/20 transition-all hover:scale-[1.02]">
                                Save as New Set
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
