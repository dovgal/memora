"use client";

import { FlashcardResponse, FieldSchema } from "@/types/schema";
import { Play, Square, FileAudio, Volume2 } from "lucide-react";
import { useState, useRef } from "react";

interface FlashcardRenderProps {
    card: FlashcardResponse;
    fieldsSchema: FieldSchema[];
    side: 'front' | 'back';
}

function AudioPlayer({ src, label, icon: Icon }: { src: string, label: string, icon: any }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent card flip
        if (isPlaying && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        } else {
            if (!audioRef.current) {
                audioRef.current = new Audio(src);
                audioRef.current.onended = () => setIsPlaying(false);
            }
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    return (
        <button
            type="button"
            onClick={togglePlay}
            className="flex items-center gap-3 bg-zinc-800/80 hover:bg-zinc-700 p-3 rounded-xl border border-zinc-700 transition-colors mt-2 text-left w-full max-w-sm"
        >
            <div className="w-10 h-10 flex items-center justify-center bg-indigo-600 rounded-full text-white shrink-0">
                {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
            </div>
            <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-zinc-300 flex items-center gap-1">
                    <Icon size={14} className="text-indigo-400 shrink-0" /> {label}
                </span>
                <span className="text-xs text-zinc-500 block truncate">
                    {isPlaying ? "Воспроизведение..." : "Нажмите, чтобы прослушать"}
                </span>
            </div>
        </button>
    );
}

export default function FlashcardRender({ card, fieldsSchema, side }: FlashcardRenderProps) {
    const fieldsForSide = fieldsSchema
        .filter(f => f.side === side)
        .sort((a, b) => a.order - b.order);

    if (fieldsForSide.length === 0) {
        return <p className="text-zinc-500 italic text-sm">Нет полей для отображения</p>;
    }

    return (
        <div className="flex flex-col items-center justify-center gap-4 w-full h-full text-white p-4">
            {fieldsForSide.map((field) => {
                // Determine field value
                let value: any = null;
                if (field.id === 'term') value = card.term;
                else if (field.id === 'definition') value = card.definition;
                else if (field.id === 'image') value = card.imageUrl;
                else value = card.fieldsData?.[field.id];

                if (!value) return null;

                switch (field.type) {
                    case 'text':
                        const audioData = card.fieldsData?.[`${field.id}_audio`];
                        return (
                            <div key={field.id} className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 w-full justify-center md:justify-start items-center">
                                <div className="shrink-0 md:w-1/3 flex flex-col md:flex-row items-center justify-end gap-2">
                                    <span className="text-[10px] md:text-xs text-indigo-400 font-bold uppercase tracking-widest opacity-90 text-center md:text-right">
                                        {field.name}
                                    </span>
                                    {audioData && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const audio = new Audio(audioData);
                                                audio.play();
                                            }}
                                            className="text-indigo-500 hover:text-indigo-400 p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-full transition-colors"
                                            title="Озвучить"
                                        >
                                            <Volume2 size={14} />
                                        </button>
                                    )}
                                </div>
                                <p className={`text-4xl md:text-7xl md:w-2/3 text-center md:text-left font-bold tracking-tight break-words leading-tight`}>
                                    {value}
                                </p>
                            </div>
                        );
                    case 'image':
                        return (
                            <img
                                key={field.id}
                                src={value}
                                alt={field.name}
                                className="max-h-[200px] object-contain rounded-lg shadow-lg"
                            />
                        );
                    case 'audio':
                        return (
                            <AudioPlayer
                                key={field.id}
                                src={value}
                                label={field.name}
                                icon={FileAudio}
                            />
                        );

                    case 'math':
                        // Fallback to text if KaTeX is not fully implemented, but use mono and smaller size
                        return (
                            <div key={field.id} className="font-mono text-xl md:text-2xl text-indigo-300 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 text-center inline-block">
                                {value}
                            </div>
                        );
                    default:
                        return null;
                }
            })}
        </div>
    );
}
