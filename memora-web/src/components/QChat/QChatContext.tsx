'use client';

import { createContext, useContext, useRef, ReactNode } from 'react';
import { QChatPanel, type QChatPanelHandle } from '@/components/QChat';

interface QChatContextValue {
    autoSend: (message: string) => void;
}

const QChatContext = createContext<QChatContextValue>({
    autoSend: () => { },
});

export function useQChat() {
    return useContext(QChatContext);
}

interface QChatProviderProps {
    setId: string;
    children: ReactNode;
}

/**
 * Wraps a page (or subtree) with QChatPanel and exposes autoSend() via context.
 * Used by LearnModePage so that WhyWrongButton can trigger Q-Chat without prop drilling.
 */
export function QChatProvider({ setId, children }: QChatProviderProps) {
    const panelRef = useRef<QChatPanelHandle>(null);

    const autoSend = (message: string) => {
        panelRef.current?.autoSend(message);
    };

    return (
        <QChatContext.Provider value={{ autoSend }}>
            {children}
            <QChatPanel ref={panelRef} setId={setId} />
        </QChatContext.Provider>
    );
}
