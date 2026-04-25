"use client";

import { FlashcardResponse, FieldSchema } from "@/types/schema";
import { Play, Square, FileAudio, Volume2 } from "lucide-react";
import { useState, useRef } from "react";
import Image from "next/image";

interface FlashcardRenderProps {
    card: FlashcardResponse;
    fieldsSchema: FieldSchema[];
    side: 'front' | 'back';
}

function AudioPlayer({ src, label, icon: Icon }: { src: string, label: string, icon: (props: { className?: string; size?: number }) => JSX.Element }) {
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
            className="flex items-center gap-3 bg-qz-card/80 hover:bg-[#586380] p-3 rounded-xl border border-qz-border transition-colors mt-2 text-left w-full max-w-sm"
        >
            <div className="w-10 h-10 flex items-center justify-center bg-[#4255ff] rounded-full text-white shrink-0">
                {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
            </div>
            <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-qz-text-muted flex items-center gap-1">
                    <Icon size={14} className="text-[#ffcd1f] shrink-0" /> {label}
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

    // Scale font size down when there are many fields to prevent overflow
    const textFieldCount = fieldsForSide.filter(f => f.type === 'text').length;
    const textSizeClass =
        textFieldCount >= 4 ? 'text-xl md:text-2xl lg:text-3xl' :
        textFieldCount >= 3 ? 'text-2xl md:text-3xl lg:text-4xl' :
        textFieldCount >= 2 ? 'text-3xl md:text-4xl lg:text-5xl' :
        'text-4xl md:text-4xl lg:text-5xl';
    const gapClass = textFieldCount >= 3 ? 'gap-2' : 'gap-4';

    return (
        <div className={`flex flex-col items-center ${gapClass} w-full text-qz-text p-3`}>
            {fieldsForSide.map((field) => {
                // Determine field value
                let value: string | null | undefined = null;
                if (field.id === 'term') value = card.term;
                else if (field.id === 'definition') value = card.definition;
                else if (field.id === 'image') value = card.imageUrl;
                else value = card.fieldsData?.[field.id];

                if (!value) return null;

                switch (field.type) {
                    case 'text':
                        return (
                            <div key={field.id} className="flex flex-col items-center gap-2 w-full max-w-4xl mx-auto">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] md:text-sm text-[#ffcd1f] font-bold uppercase tracking-[0.2em] opacity-80">
                                        {field.name}
                                    </span>
                                    {field.settings?.ttsEnabled && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const audio = new Audio(`/api/audio/${card.id}/${field.id}_audio`);
                                                audio.play().catch(err => console.warn("Audio playback failed", err));
                                            }}
                                            className="text-[#4255ff] hover:text-[#ffcd1f] p-2 bg-[#4255ff]/10 hover:bg-[#4255ff]/20 rounded-full transition-all hover:scale-110 active:scale-90"
                                            title="Озвучить"
                                        >
                                            <Volume2 size={16} />
                                        </button>
                                    )}

                                </div>
                                <p className={`${textSizeClass} text-center font-semibold tracking-tight break-words leading-tight text-qz-text`}>
                                    {value}
                                </p>
                            </div>
                        );
                    case 'image':
                        return (
                            <Image
                                key={field.id}
                                src={value}
                                alt={field.name}
                                width={400}
                                height={200}
                                className="max-h-[200px] object-contain rounded-lg shadow-lg"
                            />
                        );
                    case 'audio':
                        const src = value === "__AUDIO_ON_SERVER__" 
                            ? `/api/audio/${card.id}/${field.id}` 
                            : value;
                        return (
                            <AudioPlayer
                                key={field.id}
                                src={src}
                                label={field.name}
                                icon={FileAudio}
                            />
                        );

                    case 'math':
                        // Fallback to text if KaTeX is not fully implemented, but use mono and smaller size
                        return (
                            <div key={field.id} className="font-mono text-xl md:text-2xl text-indigo-300 bg-qz-bg/50 p-4 rounded-xl border border-qz-border-light text-center inline-block">
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
