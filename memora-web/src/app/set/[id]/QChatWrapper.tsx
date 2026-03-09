'use client';

import { useRef } from 'react';
import { QChatPanel, type QChatPanelHandle } from '@/components/QChat';

interface QChatWrapperProps {
    setId: string;
}

/**
 * Thin client wrapper that owns the QChatPanelHandle ref.
 * This allows the Server Component (set/[id]/page.tsx) to mount Q-Chat
 * without converting the whole page to a Client Component.
 * The ref is also consumed by Story 4.3's WhyWrongButton via context (future).
 */
export default function QChatWrapper({ setId }: QChatWrapperProps) {
    const panelRef = useRef<QChatPanelHandle>(null);
    return <QChatPanel ref={panelRef} setId={setId} />;
}
