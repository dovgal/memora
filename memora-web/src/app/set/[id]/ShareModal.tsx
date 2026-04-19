"use client"

import React, { useState } from "react"
import { X, Copy, Mail, Check, Link as LinkIcon, ExternalLink } from "lucide-react"

interface ShareModalProps {
    setId: string;
    setTitle: string;
    onClose: () => void;
}

export default function ShareModal({ setId, setTitle, onClose }: ShareModalProps) {
    const [copied, setCopied] = useState(false);
    const [email, setEmail] = useState("");

    const shareUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/set/${setId}` 
        : "";

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy", err);
        }
    };

    const handleSendEmail = (e: React.FormEvent) => {
        e.preventDefault();
        const subject = encodeURIComponent(`Посмотри этот модуль на Memora: ${setTitle}`);
        const body = encodeURIComponent(`Привет! Я нашел отличный учебный модуль "${setTitle}" на Memora. Вот ссылка: ${shareUrl}`);
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-qz-card border border-qz-border-light rounded-3xl w-full max-w-lg p-8 shadow-2xl relative overflow-hidden">
                {/* Decorative background elements */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#4255ff]/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#4255ff]/10 rounded-full blur-3xl" />

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-qz-card/80 hover:bg-[#586380] text-qz-text-muted hover:text-qz-text transition-all z-[120] border border-white/5 active:scale-90"
                    aria-label="Close"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="relative z-10">
                    <h2 className="text-3xl font-semibold text-qz-text mb-2">Поделиться</h2>
                    <p className="text-qz-text-muted mb-8">Отправьте этот модуль друзьям или коллегам. Регистрация для просмотра не требуется.</p>

                    <div className="space-y-6">
                        {/* Copy Link Section */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Прямая ссылка</label>
                            <div className="flex gap-2 p-1.5 bg-black/40 border border-qz-border-light rounded-2xl">
                                <div className="flex-1 px-3 py-2 text-sm text-qz-text-muted truncate font-medium">
                                    {shareUrl}
                                </div>
                                <button 
                                    onClick={handleCopy}
                                    className="bg-[#4255ff] hover:bg-[#4255ff] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95"
                                >
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                    {copied ? "Готово" : "Копировать"}
                                </button>
                            </div>
                        </div>

                        <div className="h-px bg-qz-card w-full" />

                        {/* Email Section */}
                        <form onSubmit={handleSendEmail} className="space-y-3">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                <Mail size={14} /> Отправить по эл. почте
                            </label>
                            <div className="flex gap-2">
                                <input 
                                    type="email"
                                    required
                                    placeholder="friend@example.com"
                                    className="flex-1 bg-black/40 border-2 border-qz-border-light focus:border-indigo-500 rounded-xl px-4 py-3 outline-none transition-all text-sm"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                                <button 
                                    type="submit"
                                    className="bg-white text-indigo-950 hover:bg-zinc-200 px-6 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                                >
                                    Отправить
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="mt-10 flex justify-center">
                        <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
                            <ExternalLink size={12} />
                            Ссылка откроется в любом браузере
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
