'use client';

import { useRef, forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { MessageCircle, X, Send, Trash2, Bot, User } from 'lucide-react';
import { useChatStream } from './useChatStream';

export interface QChatPanelHandle {
    autoSend: (message: string) => void;
}

interface QChatPanelProps {
    setId: string;
}

const TypingIndicator = () => (
    <div className="flex items-end gap-2 my-1">
        <div className="w-7 h-7 rounded-full bg-[#4255ff]/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Bot className="w-3.5 h-3.5 text-[#ffcd1f]" />
        </div>
        <div className="bg-qz-card border border-qz-border/50 px-4 py-3 rounded-2xl rounded-bl-sm">
            <span className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
        </div>
    </div>
);

const QChatPanelInner = forwardRef<QChatPanelHandle, QChatPanelProps>(
    function QChatPanel({ setId }, ref) {
        const { data: session } = useSession();
        // @ts-expect-error id_token injected by custom authOptions
        const idToken: string = session?.id_token ?? '';

        const { messages, isStreaming, sendMessage, clearHistory } = useChatStream({ setId, idToken });
        const [isOpen, setIsOpen] = useState(false);
        const [inputValue, setInputValue] = useState('');
        const messagesEndRef = useRef<HTMLDivElement>(null);

        // Expose autoSend for Story 4.3
        useImperativeHandle(ref, () => ({
            autoSend(message: string) {
                setIsOpen(true);
                // Small delay so the panel animation completes before sending
                setTimeout(() => {
                    sendMessage(message);
                }, 400);
            },
        }));

        // Auto-scroll to latest message
        useEffect(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, [messages, isStreaming]);

        const handleSubmit = (e?: React.FormEvent) => {
            e?.preventDefault();
            if (!inputValue.trim() || isStreaming) return;
            sendMessage(inputValue);
            setInputValue('');
        };

        const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        };

        if (!session) return null;

        return (
            <>
                {/* Floating toggle button */}
                <button
                    id="qchat-toggle-btn"
                    onClick={() => setIsOpen(prev => !prev)}
                    aria-label="Toggle Q-Chat"
                    className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#4255ff] hover:bg-[#4255ff] text-white shadow-[0_0_30px_rgba(79,70,229,0.5)] hover:shadow-[0_0_40px_rgba(79,70,229,0.7)] flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                >
                    {isOpen
                        ? <X className="w-6 h-6" />
                        : <MessageCircle className="w-6 h-6" />
                    }
                </button>

                {/* Side panel */}
                <div
                    id="qchat-panel"
                    className={`fixed top-0 right-0 h-full w-full sm:w-[380px] z-40 flex flex-col bg-qz-bg border-l border-qz-border-light shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-qz-border-light bg-qz-bg/80 backdrop-blur-sm shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#4255ff]/20 border border-indigo-500/30 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-[#ffcd1f]" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-qz-text">Q-Chat</p>
                                <p className="text-xs text-zinc-500">Ask anything about this set</p>
                            </div>
                        </div>
                        <button
                            onClick={clearHistory}
                            title="Clear conversation"
                            className="text-zinc-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6 py-12">
                                <div className="w-14 h-14 rounded-2xl bg-[#4255ff]/10 border border-indigo-500/20 flex items-center justify-center">
                                    <Bot className="w-7 h-7 text-[#ffcd1f]" />
                                </div>
                                <p className="text-sm font-semibold text-qz-text-muted">Ask me anything!</p>
                                <p className="text-xs text-zinc-500 leading-relaxed">
                                    I know everything in this study set. Ask me to explain a term, quiz you, or help you understand a concept.
                                </p>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                {/* Avatar */}
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user'
                                        ? 'bg-[#4255ff]/30 border border-indigo-500/40'
                                        : 'bg-[#4255ff]/20 border border-indigo-500/30'
                                    }`}>
                                    {msg.role === 'user'
                                        ? <User className="w-3.5 h-3.5 text-indigo-300" />
                                        : <Bot className="w-3.5 h-3.5 text-[#ffcd1f]" />
                                    }
                                </div>

                                {/* Bubble */}
                                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                                        ? 'bg-[#4255ff] text-white rounded-br-sm'
                                        : 'bg-qz-card border border-qz-border/50 text-zinc-200 rounded-bl-sm'
                                    }`}>
                                    {msg.content || (msg.role === 'assistant' && isStreaming && idx === messages.length - 1
                                        ? '…'
                                        : msg.content
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator shown when waiting for first chunk */}
                        {isStreaming && messages[messages.length - 1]?.content === '' && (
                            <TypingIndicator />
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form
                        onSubmit={handleSubmit}
                        className="shrink-0 px-4 py-4 border-t border-qz-border-light bg-qz-bg/60 backdrop-blur-sm"
                        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
                    >
                        <div className="flex items-end gap-2 bg-qz-card/80 border border-qz-border/50 rounded-xl px-3 py-2 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
                            <textarea
                                id="qchat-input"
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask about this set… (Enter to send)"
                                disabled={isStreaming}
                                rows={1}
                                className="flex-1 bg-transparent text-qz-text text-sm placeholder-zinc-500 resize-none outline-none max-h-32 leading-relaxed py-1 disabled:opacity-50"
                                style={{ scrollbarWidth: 'none' }}
                            />
                            <button
                                id="qchat-send-btn"
                                type="submit"
                                disabled={!inputValue.trim() || isStreaming}
                                className="w-8 h-8 rounded-lg bg-[#4255ff] hover:bg-[#4255ff] disabled:bg-[#586380] disabled:text-zinc-500 text-white flex items-center justify-center transition-colors shrink-0"
                            >
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-2 text-center">
                            Q-Chat only knows this set's material
                        </p>
                    </form>
                </div>

                {/* Backdrop on mobile */}
                {isOpen && (
                    <div
                        className="fixed inset-0 z-30 bg-black/60 sm:hidden"
                        onClick={() => setIsOpen(false)}
                    />
                )}
            </>
        );
    }
);

QChatPanelInner.displayName = 'QChatPanel';
export const QChatPanel = QChatPanelInner;
export default QChatPanel;
