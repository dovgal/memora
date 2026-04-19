'use client';

import { HelpCircle } from 'lucide-react';
import { useQChat } from './QChatContext';

interface WhyWrongButtonProps {
    term: string;
    correctAnswer: string;
    userAnswer: string;
}

/**
 * Renders a secondary "Why is this wrong?" button after an incorrect Learn mode answer.
 * On click, opens Q-Chat and auto-sends a contextualized explanation prompt.
 */
export function WhyWrongButton({ term, correctAnswer, userAnswer }: WhyWrongButtonProps) {
    const { autoSend } = useQChat();

    const handleClick = () => {
        const message =
            `I was asked to define "${term}". I answered: "${userAnswer}", ` +
            `but the correct answer is: "${correctAnswer}". ` +
            `Can you explain why my answer was wrong and help me understand the correct definition?`;
        autoSend(message);
    };

    return (
        <button
            id="why-wrong-btn"
            onClick={handleClick}
            className="flex items-center gap-2 text-sm text-qz-text-muted hover:text-indigo-300 px-4 py-2 rounded-xl border border-qz-border/50 hover:border-indigo-500/40 hover:bg-[#4255ff]/5 transition-all duration-200"
        >
            <HelpCircle className="w-4 h-4 shrink-0" />
            Why is this wrong?
        </button>
    );
}
