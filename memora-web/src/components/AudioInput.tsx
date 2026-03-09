"use client";

import { useState, useRef } from "react";
import { Mic, Square, Play, Trash2, Upload, Loader2, FileAudio } from "lucide-react";

interface Props {
    value: string | null;
    onChange: (base64Audio: string | null) => void;
}

export default function AudioInput({ value, onChange }: Props) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
                // Convert to base64
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        onChange(reader.result);
                    }
                };
                reader.readAsDataURL(audioBlob);

                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Error accessing microphone", err);
            alert("Не удалось получить доступ к микрофону. Проверьте разрешения вашего браузера.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('audio/')) {
            alert('Пожалуйста, загрузите аудиофайл (mp3, wav, etc.)');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            alert('Размер файла не должен превышать 10MB');
            return;
        }

        setIsUploading(true);
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                onChange(reader.result);
            }
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
    };

    const togglePlay = () => {
        if (!value) return;

        if (isPlaying && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        } else {
            if (!audioRef.current) {
                audioRef.current = new Audio(value);
                audioRef.current.onended = () => setIsPlaying(false);
            } else if (audioRef.current.src !== value) {
                audioRef.current.src = value;
            }
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div className="flex flex-col gap-2 mt-2">
            {value ? (
                <div className="flex items-center gap-3 bg-zinc-800/80 p-3 rounded-xl border border-zinc-700">
                    <button
                        type="button"
                        onClick={togglePlay}
                        className="w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 rounded-full text-white transition-colors"
                    >
                        {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
                    </button>

                    <div className="flex-1 flex flex-col">
                        <span className="text-sm font-semibold text-zinc-300 flex items-center gap-1">
                            <FileAudio size={14} className="text-indigo-400" /> Аудиозапись
                        </span>
                        <span className="text-xs text-zinc-500">
                            {isPlaying ? "Воспроизведение..." : "Готово к прослушиванию"}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            if (audioRef.current) {
                                audioRef.current.pause();
                                setIsPlaying(false);
                            }
                            onChange(null);
                        }}
                        className="p-2 text-zinc-500 hover:bg-zinc-700 hover:text-red-400 rounded-lg transition-all"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    {/* Microphone Record Button */}
                    <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold transition-all flex-1 justify-center ${isRecording
                                ? 'bg-red-500/20 text-red-500 border border-red-500/50 animate-pulse'
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-transparent'
                            }`}
                    >
                        {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={18} />}
                        {isRecording ? formatTime(recordingTime) : 'Запись'}
                    </button>

                    {/* Upload button */}
                    <label className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-bold cursor-pointer transition-all border border-transparent flex-1 justify-center">
                        {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                        <span>Загрузить</span>
                        <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={isUploading || isRecording}
                        />
                    </label>
                </div>
            )}
        </div>
    );
}
