'use client';

import { useState, useCallback, useRef } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { ChatMessage } from '@/types/schema';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const HISTORY_KEY = (setId: string) => `qchat_history_${setId}`;

function loadHistory(setId: string): ChatMessage[] {
    try {
        const raw = localStorage.getItem(HISTORY_KEY(setId));
        if (!raw) return [];
        return JSON.parse(raw) as ChatMessage[];
    } catch {
        return [];
    }
}

function saveHistory(setId: string, messages: ChatMessage[]) {
    try {
        // Keep only the last 50 messages to avoid bloating localStorage
        const trimmed = messages.slice(-50);
        localStorage.setItem(HISTORY_KEY(setId), JSON.stringify(trimmed));
    } catch {
        // Storage might be full; silently ignore
    }
}

export interface UseChatStreamOptions {
    setId: string;
    idToken: string;
}

export interface UseChatStreamReturn {
    messages: ChatMessage[];
    isStreaming: boolean;
    sendMessage: (text: string) => Promise<void>;
    clearHistory: () => void;
}

export function useChatStream({ setId, idToken }: UseChatStreamOptions): UseChatStreamReturn {
    const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory(setId));
    const [isStreaming, setIsStreaming] = useState(false);
    // Abort controller ref to cancel in-flight SSE if needed
    const abortRef = useRef<AbortController | null>(null);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isStreaming) return;

        const userMsg: ChatMessage = { role: 'user', content: text.trim() };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        saveHistory(setId, updatedMessages);
        setIsStreaming(true);

        // Placeholder for the streaming assistant reply
        const assistantPlaceholder: ChatMessage = { role: 'assistant', content: '' };
        setMessages(prev => [...prev, assistantPlaceholder]);

        abortRef.current = new AbortController();

        try {
            await fetchEventSource(`${API_URL}/api/ai/qchat/${setId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ messages: updatedMessages }),
                signal: abortRef.current.signal,
                onmessage(ev) {
                    if (ev.data === '[DONE]' || ev.event === 'done') {
                        setIsStreaming(false);
                        // Persist the finalized message list
                        setMessages(prev => {
                            saveHistory(setId, prev);
                            return prev;
                        });
                        return;
                    }
                    if (ev.event === 'error') {
                        setIsStreaming(false);
                        return;
                    }
                    // Append chunk to the last assistant message
                    setMessages(prev => {
                        const updated = [...prev];
                        const last = updated[updated.length - 1];
                        if (last && last.role === 'assistant') {
                            updated[updated.length - 1] = {
                                ...last,
                                content: last.content + ev.data,
                            };
                        }
                        return updated;
                    });
                },
                onerror(err) {
                    console.error('QChat SSE error:', err);
                    setIsStreaming(false);
                    throw err; // stop retrying on fatal errors
                },
            });
        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                console.error('QChat fetch error:', err);
            }
        } finally {
            setIsStreaming(false);
        }
    }, [setId, idToken, messages, isStreaming]);

    const clearHistory = useCallback(() => {
        localStorage.removeItem(HISTORY_KEY(setId));
        setMessages([]);
    }, [setId]);

    return { messages, isStreaming, sendMessage, clearHistory };
}
