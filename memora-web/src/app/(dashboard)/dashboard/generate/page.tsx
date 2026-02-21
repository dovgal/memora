'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { Loader2, Sparkles, AlertCircle, Trash2, Plus, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function GenerateFlashcardsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedCards, setGeneratedCards] = useState<{ term: string, definition: string }[]>([]);
    const [base64Image, setBase64Image] = useState<string | null>(null);

    // Set Metadata
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                // Compress to JPEG for OpenAI vision API
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setBase64Image(dataUrl);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleCardChange = (index: number, field: 'term' | 'definition', value: string) => {
        const newCards = [...generatedCards];
        newCards[index][field] = value;
        setGeneratedCards(newCards);
    };

    const handleRemoveCard = (index: number) => {
        const newCards = generatedCards.filter((_, i) => i !== index);
        setGeneratedCards(newCards);
    };

    const handleAddCard = () => {
        setGeneratedCards([...generatedCards, { term: '', definition: '' }]);
    };

    const handleSaveSet = async () => {
        // @ts-expect-error id_token is injected by our custom authOptions
        if (!title.trim() || generatedCards.length === 0 || !session?.id_token) return;

        setIsSaving(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:8000/api/sets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // @ts-expect-error id_token is injected by our custom authOptions
                    'Authorization': `Bearer ${session.id_token}`,
                },
                body: JSON.stringify({
                    title,
                    description: description.trim() ? description.trim() : null,
                    isPublic: true,
                    flashcards: generatedCards.filter(c => c.term.trim() && c.definition.trim()) // filter empty ones
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save set');
            }

            const data = await response.json();
            // Redirect to the newly created set using the returned UUID
            router.push(`/set/${data.id}`);

        } catch (e: any) {
            console.error("Save error:", e);
            setError(e.message || "An unexpected error occurred while saving.");
            setIsSaving(false);
        }
    };

    const handleGenerate = async () => {
        // @ts-expect-error id_token is injected by our custom authOptions
        if ((!prompt.trim() && !base64Image) || !session?.id_token) return;

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
                body: JSON.stringify({
                    prompt: prompt.trim() ? prompt : "Extract flashcards from this image",
                    image_url: base64Image
                }),
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

                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Paste lecture text here, or optionally specify OCR instructions..."
                        className="flex-1 min-h-[192px] bg-black/50 text-white border border-zinc-700/50 rounded-xl p-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y font-mono text-sm leading-relaxed"
                    />

                    <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
                        <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-zinc-700/50 rounded-xl hover:border-indigo-500/50 hover:bg-zinc-800/50 transition-colors cursor-pointer relative overflow-hidden group">
                            {base64Image ? (
                                <img src={base64Image} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                            ) : (
                                <div className="text-center p-4">
                                    <svg className="w-8 h-8 text-zinc-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L28 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <p className="text-xs text-zinc-400">Take Photo or Upload Notes</p>
                                </div>
                            )}
                            <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
                        </label>
                        {base64Image && (
                            <button onClick={() => setBase64Image(null)} className="text-xs text-red-400 hover:text-red-300 py-1">Remove Image</button>
                        )}
                    </div>
                </div>

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
                        disabled={isGenerating || (!prompt.trim() && !base64Image)}
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
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-white">
                            {isGenerating ? 'Extracting Knowledge...' : 'Review & Revise Generated Cards'}
                        </h3>
                        {!isGenerating && generatedCards.length > 0 && (
                            <button onClick={handleAddCard} className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors">
                                <Plus className="w-4 h-4" /> Add Card
                            </button>
                        )}
                    </div>


                    <div className="flex flex-col gap-4">
                        {generatedCards.map((card, idx) => (
                            <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-500 relative group">
                                {isGenerating ? (
                                    <>
                                        <h4 className="font-semibold text-indigo-300 mb-2">{card.term}</h4>
                                        <p className="text-zinc-300 whitespace-pre-wrap">{card.definition}</p>
                                    </>
                                ) : (
                                    <div className="flex gap-4">
                                        <div className="flex-1 space-y-3">
                                            <div>
                                                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1 block">Term</label>
                                                <input
                                                    value={card.term}
                                                    onChange={(e) => handleCardChange(idx, 'term', e.target.value)}
                                                    className="w-full bg-black/50 text-white border border-zinc-700/50 rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:border-transparent outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1 block">Definition</label>
                                                <textarea
                                                    value={card.definition}
                                                    onChange={(e) => handleCardChange(idx, 'definition', e.target.value)}
                                                    className="w-full bg-black/50 text-zinc-300 border border-zinc-700/50 rounded-lg px-3 py-2 min-h-[60px] focus:ring-1 focus:ring-indigo-500 focus:border-transparent outline-none resize-y"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveCard(idx)}
                                            className="text-zinc-600 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors self-start opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            title="Remove card"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}

                        {isGenerating && (
                            <div className="bg-zinc-900/50 border border-zinc-800/50 border-dashed rounded-xl p-4 h-24 animate-pulse" />
                        )}
                    </div>

                    {!isGenerating && generatedCards.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-zinc-800 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-zinc-400 mb-1 block">Set Title <span className="text-red-400">*</span></label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="E.g., History Midterm Review"
                                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-zinc-400 mb-1 block">Description (Optional)</label>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Chapters 4-6 terminology"
                                        className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-zinc-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={handleSaveSet}
                                    disabled={isSaving || !title.trim() || generatedCards.length === 0}
                                    className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-8 py-3 rounded-lg font-medium shadow-xl shadow-indigo-500/20 transition-all hover:scale-[1.02]"
                                >
                                    {isSaving ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                    ) : (
                                        <><Save className="w-4 h-4" /> Save as New Set</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
