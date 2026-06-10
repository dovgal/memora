"use client";

import { useState, useRef } from "react";
import { getSession } from "next-auth/react";
import { Volume2, Play, Square, Trash2, Sparkles, Loader2, Type } from "lucide-react";

// Соответствие языка голосу Inworld (как на бэкенде).
const VOICE_BY_LANG: Record<string, string> = {
  ru: "Tatiana",
  fr: "Alain",
  de: "Josef",
  es: "Carmen",
  en: "Clive",
};

interface Props {
    value: { text?: string; audioData?: string | null } | null;
    onChange: (value: { text?: string; audioData?: string | null } | null) => void;
    lang?: string;
}

export default function TTSInput({ value, onChange, lang = "en" }: Props) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const currentText = value?.text || "";
    const currentAudioData = value?.audioData;

    const generateAudio = async () => {
        if (!currentText.trim()) return;

        setIsGenerating(true);
        try {
            // Бэкенд /api/tts принимает GET с query-параметрами и отдаёт audio/mpeg.
            const session = await getSession();
            const token = (session as { id_token?: string } | null)?.id_token;
            const voice = VOICE_BY_LANG[lang] ?? VOICE_BY_LANG.en;
            const url = `/api/tts?text=${encodeURIComponent(currentText)}&voice=${encodeURIComponent(voice)}`;
            const res = await fetch(url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            if (!res.ok) throw new Error("Failed to generate audio");

            const blob = await res.blob();
            const audioData = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            onChange({ text: currentText, audioData });
        } catch (err) {
            console.error(err);
            alert("Ошибка генерации озвучки. Попробуйте еще раз.");
        } finally {
            setIsGenerating(false);
        }
    };

    const togglePlay = () => {
        if (!currentAudioData) return;

        if (isPlaying && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        } else {
            if (!audioRef.current) {
                audioRef.current = new Audio(currentAudioData);
                audioRef.current.onended = () => setIsPlaying(false);
            } else if (audioRef.current.src !== currentAudioData) {
                audioRef.current.src = currentAudioData;
            }
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    return (
        <div className="flex flex-col gap-2 mt-2">
            {!currentAudioData ? (
                <div className="flex flex-col gap-2 bg-qz-card/30 p-3 rounded-xl border border-qz-border">
                    <div className="flex items-center gap-2 bg-qz-bg border border-qz-border px-3 py-2 rounded-lg">
                        <Type size={16} className="text-zinc-500" />
                        <input
                            type="text"
                            value={currentText}
                            onChange={(e) => onChange({ text: e.target.value, audioData: null })}
                            placeholder="Текст для озвучивания..."
                            className="bg-transparent border-none outline-none text-sm w-full text-qz-text-muted"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={generateAudio}
                        disabled={!currentText.trim() || isGenerating}
                        className="flex items-center justify-center gap-2 py-2 px-4 bg-[#4255ff] hover:bg-[#4255ff] disabled:bg-qz-card disabled:text-zinc-500 text-white text-sm font-bold rounded-lg transition-colors"
                    >
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {isGenerating ? "Генерация..." : `Сгенерировать ИИ голос (${lang.toUpperCase()})`}
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-3 bg-qz-card/80 p-3 rounded-xl border border-qz-border">
                    <button
                        type="button"
                        onClick={togglePlay}
                        className="w-10 h-10 flex items-center justify-center bg-[#4255ff] hover:bg-[#4255ff] rounded-full text-white transition-colors"
                    >
                        {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
                    </button>

                    <div className="flex-1 flex flex-col overflow-hidden">
                        <span className="text-sm font-semibold text-qz-text-muted flex items-center gap-1">
                            <Volume2 size={14} className="text-[#ffcd1f]" /> ИИ Озвучка
                        </span>
                        <span className="text-xs text-zinc-500 truncate">
                            &quot;{currentText}&quot;
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            if (audioRef.current) {
                                audioRef.current.pause();
                                setIsPlaying(false);
                            }
                            onChange({ text: currentText, audioData: null });
                        }}
                        className="p-2 text-zinc-500 hover:bg-[#586380] hover:text-red-400 rounded-lg transition-all"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            )}
        </div>
    );
}
