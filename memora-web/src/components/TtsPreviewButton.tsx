"use client";

import { useRef, useState } from "react";
import { getSession } from "next-auth/react";
import { Volume2, Loader2 } from "lucide-react";

// Соответствие языка голосу Inworld (как на бэкенде и в TTSInput).
const VOICE_BY_LANG: Record<string, string> = {
    ru: "Tatiana",
    fr: "Alain",
    de: "Josef",
    es: "Carmen",
    en: "Clive",
};

interface Props {
    /** Читаем текст в момент клика — поле редактируется вживую. */
    getText: () => string;
    voice?: string;
    lang?: string;
}

/**
 * Кнопка предпрослушивания озвучки прямо при создании/редактировании карточки.
 * Использует /api/tts (не требует id карточки, кэшируется на сервере).
 */
export default function TtsPreviewButton({ getText, voice, lang }: Props) {
    const [loading, setLoading] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const play = async () => {
        const text = (getText() || "").trim();
        if (!text) {
            alert("Сначала введите текст поля, чтобы его озвучить.");
            return;
        }
        setLoading(true);
        try {
            const session = await getSession();
            const token = (session as { id_token?: string } | null)?.id_token;
            const v = voice || VOICE_BY_LANG[lang ?? "en"] || VOICE_BY_LANG.en;
            const res = await fetch(
                `/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(v)}`,
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );
            if (!res.ok) throw new Error(`TTS ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            if (audioRef.current) audioRef.current.pause();
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => URL.revokeObjectURL(url);
            await audio.play();
        } catch (err) {
            console.error("TTS preview failed", err);
            alert("Не удалось воспроизвести озвучку. Попробуйте ещё раз.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={play}
            disabled={loading}
            title="Прослушать озвучку этого поля"
            className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-900/20 hover:bg-emerald-900/40 px-2 py-1 rounded-md transition-colors disabled:opacity-60"
        >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Volume2 size={13} />}
            Прослушать
        </button>
    );
}
