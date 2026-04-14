"use client"

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import { SetResponse } from '@/types/schema';
import { X, Trophy, RotateCcw, Play } from 'lucide-react';
import Link from 'next/link';
import { getCardText } from '@/lib/studyUtils';

type CardItem = {
    id: string; // Internal unique ID for the game piece
    flashcardId: string;
    text: string;
    type: 'term' | 'definition';
    isMatched: boolean;
    isFailed: boolean;
    isSelected: boolean;
};

export default function MatchModePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const router = useRouter();
    const { data: session } = useSession();

    const [set, setSet] = useState<SetResponse | null>(null);
    const [gameState, setGameState] = useState<'start' | 'playing' | 'ended'>('start');

    // Core game state
    const [cards, setCards] = useState<CardItem[]>([]);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [matchedPairCount, setMatchedPairCount] = useState(0);

    // Timer state
    const [time, setTime] = useState(0);
    const [bestTime, setBestTime] = useState<number | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch the set data
    useEffect(() => {
        const fetchSet = async () => {
            try {
                const resSet = await fetch(`/api/sets/${id}`);
                if (resSet.ok) {
                    const setData: SetResponse = await resSet.json();
                    setSet(setData);
                } else {
                    router.push('/404');
                }
            } catch (err) {
                console.error("Failed to fetch set data", err);
            }
        };
        fetchSet();
    }, [id, router]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => stopTimer();
    }, []);

    // Timer logic
    const startTimer = () => {
        setTime(0);
        timerRef.current = setInterval(() => {
            setTime(prev => prev + 100); // 100ms precision
        }, 100);
    };

    const stopTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const formatTime = (ms: number) => {
        const totalSeconds = ms / 1000;
        return totalSeconds.toFixed(1);
    };

    // Initialize Game Board
    const initializeGame = () => {
        if (!set || set.flashcards.length === 0) return;

        // Take up to 6 random cards for the board (Quizlet standard limit for match screen is usually 6 pairs)
        const shuffledFlashcards = [...set.flashcards].sort(() => 0.5 - Math.random()).slice(0, 6);
        const newCards: CardItem[] = [];

        shuffledFlashcards.forEach((fc, index) => {
            // Term card
            newCards.push({
                id: `term-${fc.id}-${index}`,
                flashcardId: fc.id,
                text: getCardText(fc, 'front', set.fieldsSchema),
                type: 'term',
                isMatched: false,
                isFailed: false,
                isSelected: false,
            });
            // Definition card
            newCards.push({
                id: `def-${fc.id}-${index}`,
                flashcardId: fc.id,
                text: getCardText(fc, 'back', set.fieldsSchema),
                type: 'definition',
                isMatched: false,
                isFailed: false,
                isSelected: false,
            });
        });

        // Shuffle the grid so terms and definitions are scrambled
        const gridScrambled = newCards.sort(() => 0.5 - Math.random());

        setCards(gridScrambled);
        setMatchedPairCount(0);
        setSelectedCardId(null);
        setGameState('playing');
        startTimer();
    };

    const handleCardClick = (clickedId: string) => {
        if (gameState !== 'playing') return;

        const clickedCard = cards.find(c => c.id === clickedId);
        if (!clickedCard || clickedCard.isMatched) return;

        // If nothing is currently selected, select this one
        if (!selectedCardId) {
            setCards(prev => prev.map(c =>
                c.id === clickedId ? { ...c, isSelected: true } : c
            ));
            setSelectedCardId(clickedId);
            return;
        }

        // If clicking the same card, deselect
        if (selectedCardId === clickedId) {
            setCards(prev => prev.map(c =>
                c.id === clickedId ? { ...c, isSelected: false } : c
            ));
            setSelectedCardId(null);
            return;
        }

        const firstCard = cards.find(c => c.id === selectedCardId);
        if (!firstCard) return;

        // We have two different cards selected. Check for match!
        const isMatch = firstCard.flashcardId === clickedCard.flashcardId && firstCard.type !== clickedCard.type;

        if (isMatch) {
            // Correct! Mark both as matched
            setCards(prev => prev.map(c =>
                c.id === firstCard.id || c.id === clickedCard.id
                    ? { ...c, isMatched: true, isSelected: false }
                    : c
            ));
            setSelectedCardId(null);

            setMatchedPairCount(prev => {
                const newCount = prev + 1;
                // Total pairs = cards.length / 2
                if (newCount === cards.length / 2) {
                    endGame();
                }
                return newCount;
            });
        } else {
            // Incorrect! Mark both as failed briefly
            setCards(prev => prev.map(c =>
                c.id === firstCard.id || c.id === clickedCard.id
                    ? { ...c, isFailed: true, isSelected: false }
                    : c
            ));
            setSelectedCardId(null);

            // Reset failed state after animation
            setTimeout(() => {
                setCards(prev => prev.map(c =>
                    c.id === firstCard.id || c.id === clickedCard.id
                        ? { ...c, isFailed: false }
                        : c
                ));
            }, 500); // 500ms red shake animation
        }
    };

    const endGame = () => {
        stopTimer();

        // Delay the end screen slightly so user sees the last match complete
        setTimeout(() => {
            setGameState('ended');

            // Update best time locally
            setBestTime(prevBest => {
                if (prevBest === null || time < prevBest) return time;
                return prevBest;
            });
        }, 500);
    };

    if (!set) {
        return (
            <div className="min-h-screen bg-[#f6f7fb] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f6f7fb] text-zinc-800 flex flex-col relative overflow-hidden select-none font-sans">
            {/* Header */}
            <header className="bg-white p-4 md:p-6 flex justify-between items-center z-50 border-b border-zinc-200 shadow-sm relative w-full">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        Подбор: {set.title}
                    </h1>
                </div>
                <div className="flex items-center gap-6">
                    {gameState === 'playing' && (
                        <div className="text-2xl font-bold font-mono text-zinc-700 w-24 text-right bg-zinc-100 rounded-lg px-3 py-1 border border-zinc-200 shadow-inner">
                            {formatTime(time)}s
                        </div>
                    )}
                    <Link
                        href={`/set/${id}`}
                        className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-400 hover:text-zinc-600"
                    >
                        <X size={24} />
                    </Link>
                </div>
            </header>

            {/* Game Board Content */}
            <main className="flex-1 w-full relative flex flex-col items-center p-4 py-8">
                {/* START SCREEN */}
                {gameState === 'start' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-[#0a092d]/40 backdrop-blur-sm">
                        <div className="bg-white border text-center border-zinc-200 p-12 rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in duration-300">
                            <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-100">
                                <Trophy size={48} />
                            </div>
                            <h2 className="text-3xl font-bold mb-4">Готовы к игре?</h2>
                            <p className="text-zinc-500 mb-8 font-medium">Соедините все термины с их определениями как можно быстрее!</p>

                            <button
                                onClick={initializeGame}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-3 transition-transform hover:scale-105 shadow-xl shadow-blue-600/20"
                            >
                                <Play fill="currentColor" size={20} /> Начать игру
                            </button>
                        </div>
                    </div>
                )}

                {/* END SCREEN */}
                {gameState === 'ended' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-[#0a092d]/40 backdrop-blur-sm">
                        <div className="bg-white border text-center border-zinc-200 p-12 rounded-3xl w-full max-w-lg shadow-2xl animate-in zoom-in duration-300">
                            <span className="text-sm font-bold tracking-widest uppercase text-zinc-400 mb-2 block">Ваше время</span>
                            <h2 className="text-6xl font-semibold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400 drop-shadow-sm">
                                {formatTime(time)}s
                            </h2>

                            {bestTime && (
                                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 py-3 px-6 rounded-xl mb-10 font-bold inline-flex items-center gap-2 shadow-sm">
                                    <Trophy size={18} /> Лучшее время: {formatTime(bestTime)}s
                                </div>
                            )}

                            <div className="flex gap-4 w-full">
                                <Link
                                    href={`/set/${id}`}
                                    className="flex-1 bg-white border-2 border-zinc-200 hover:border-zinc-300 text-zinc-700 font-bold py-4 rounded-xl transition-all shadow-sm text-center"
                                >
                                    Выйти
                                </Link>
                                <button
                                    onClick={initializeGame}
                                    className="flex-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2"
                                >
                                    <RotateCcw size={20} /> Играть снова
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* PLAYING GRID */}
                {gameState === 'playing' && (
                    <div className="w-full max-w-5xl mx-auto h-full flex items-center justify-center animate-in fade-in duration-500 object-contain">
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 w-full auto-rows-fr">
                            {cards.map(card => {
                                // Dynamic classes based on card state
                                let stateClasses = "bg-white border-zinc-200 text-zinc-700 hover:border-indigo-300 hover:shadow-md cursor-pointer";
                                let visibilityClass = "opacity-100 scale-100";

                                if (card.isSelected) {
                                    stateClasses = "bg-indigo-50 border-indigo-500 text-indigo-700 ring-4 ring-indigo-500/20";
                                } else if (card.isFailed) {
                                    stateClasses = "bg-red-50 border-red-500 text-red-700 ring-4 ring-red-500/20 animate-shake";
                                }

                                if (card.isMatched) {
                                    // Matched cards fade out but still take up grid space
                                    visibilityClass = "opacity-0 scale-95 pointer-events-none";
                                }

                                return (
                                    <div
                                        key={card.id}
                                        onClick={() => handleCardClick(card.id)}
                                        className={`rounded-2xl border-2 flex items-center justify-center p-6 text-center shadow-sm transition-all duration-300 min-h-[120px] md:min-h-[160px] relative overflow-hidden group ${stateClasses} ${visibilityClass}`}
                                    >
                                        <span className="font-semibold text-lg md:text-xl break-words leading-tight pointer-events-none whitespace-pre-wrap">
                                            {card.text}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>

            {/* Shake animation style inclusion */}
            <style jsx global>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-6px); }
                    40% { transform: translateX(6px); }
                    60% { transform: translateX(-6px); }
                    80% { transform: translateX(6px); }
                }
                .animate-shake {
                    animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                }
            `}</style>
        </div>
    );
}
