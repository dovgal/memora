"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { FlashcardResponse, FieldSchema } from "@/types/schema"
import { ChevronLeft, ChevronRight, Settings, Play, Maximize, Edit2, Volume2, VolumeX, Star } from "lucide-react"
import FlashcardRender from "@/components/FlashcardRender"

const DEFAULT_SCHEMA: FieldSchema[] = [
    { id: 'term', name: 'ТЕРМИН', type: 'text', side: 'front', order: 1, settings: { language: 'default' } },
    { id: 'definition', name: 'ОПРЕДЕЛЕНИЕ', type: 'text', side: 'back', order: 1, settings: { language: 'default' } }
];

interface FlashcardPlayerProps {
    flashcards: FlashcardResponse[];
    fieldsSchema?: FieldSchema[];
    setId?: string;
}

export default function FlashcardPlayer({ flashcards, fieldsSchema = DEFAULT_SCHEMA, setId }: FlashcardPlayerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Settings state
    const [trackProgress, setTrackProgress] = useState(false);
    const [fsrsEnabled, setFsrsEnabled] = useState(false);
    const [studyStarredOnly, setStudyStarredOnly] = useState(false);
    const [frontSide, setFrontSide] = useState<'term' | 'definition'>('term');
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [showBothSides, setShowBothSides] = useState(false);

    // activeCards could be restricted when FSRS is enabled
    const [activeCards, setActiveCards] = useState<FlashcardResponse[]>(flashcards);
    const [isLoadingFsrs, setIsLoadingFsrs] = useState(false);

    useEffect(() => {
        if (!fsrsEnabled) {
            setActiveCards(flashcards);
            setCurrentIndex(0);
            setIsFlipped(false);
            return;
        }

        if (!setId) return;

        let isMounted = true;
        setIsLoadingFsrs(true);
        fetch(`/api/sets/${setId}/fsrs/due`)
            .then(res => res.json())
            .then(data => {
                if (isMounted) {
                    setActiveCards(data && Array.isArray(data) ? data : []);
                    setCurrentIndex(0);
                    setIsFlipped(false);
                }
            })
            .catch(err => console.error("Error fetching FSRS due cards:", err))
            .finally(() => {
                if (isMounted) setIsLoadingFsrs(false);
            });

        return () => { isMounted = false; };
    }, [fsrsEnabled, flashcards, setId]);

    const handleRateFSRS = async (rating: number) => {
        const currentCard = activeCards[currentIndex];
        if (!currentCard) return;

        try {
            await fetch("/api/study/fsrs/review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    flashcard_id: currentCard.id,
                    rating,
                    now: new Date().toISOString()
                })
            });
            // Advance to next card
            setIsFlipped(false);
            setCurrentIndex(prev => prev + 1);
        } catch (err) {
            console.error("Error rating card:", err);
        }
    };

    const handleNext = useCallback(() => {
        setIsFlipped(false);
        setCurrentIndex(prev => Math.min(prev + 1, activeCards.length - 1));
    }, [activeCards.length]);

    const handlePrev = useCallback(() => {
        setIsFlipped(false);
        setCurrentIndex(prev => Math.max(prev - 1, 0));
    }, []);

    const handleFlip = useCallback(() => {
        setIsFlipped(prev => !prev);
    }, []);

    // Determine what is currently front/back based on settings
    const actualFrontSide = frontSide === 'term' ? 'front' : 'back';
    const actualBackSide = frontSide === 'term' ? 'back' : 'front';
    const visibleSide = isFlipped ? actualBackSide : actualFrontSide;

    // Audio Playback logic
    const playCurrentSideAudio = useCallback(() => {
        if (!activeCards || activeCards.length === 0) return;
        const currentCard = activeCards[currentIndex];
        const fieldsForSide = fieldsSchema.filter(f => f.side === visibleSide).sort((a, b) => a.order - b.order);

        const audioUrls: string[] = [];
        for (const field of fieldsForSide) {
            if (field.type === 'text') {
                const audioData = currentCard.fieldsData?.[`${field.id}_audio`];
                if (audioData) {
                    audioUrls.push(audioData);
                }
            }
        }

        if (audioUrls.length === 0) return;

        let audioIndex = 0;
        const playNext = () => {
            if (audioIndex < audioUrls.length) {
                const audio = new Audio(audioUrls[audioIndex]);
                audio.onended = () => {
                    audioIndex++;
                    playNext();
                };
                audio.play().catch(console.error);
            }
        };

        playNext();
    }, [currentIndex, isFlipped, activeCards, fieldsSchema, visibleSide]);

    // Auto-play TTS on card flip/change
    useEffect(() => {
        if (ttsEnabled) {
            playCurrentSideAudio();
        }
    }, [currentIndex, isFlipped, ttsEnabled, playCurrentSideAudio]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input (like search)
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.code === 'Space') {
                e.preventDefault();
                handleFlip();
            } else if (e.code === 'ArrowRight') {
                handleNext();
            } else if (e.code === 'ArrowLeft') {
                handlePrev();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleFlip, handleNext, handlePrev]);

    if (fsrsEnabled && isLoadingFsrs) {
        return <div className="p-8 text-center text-zinc-500 animate-pulse">Загрузка карточек для повторения...</div>;
    }

    if (!activeCards || activeCards.length === 0) {
        return (
            <div className="w-full flex items-center justify-center aspect-[16/9] md:aspect-[2/1] max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl flex-col mb-6">
                <div className="text-zinc-400 font-medium">
                    {fsrsEnabled ? "Отлично! На сегодня карточек для повторения больше нет! 🎉" : "No flashcards available."}
                </div>
            </div>
        );
    }

    // When FSRS is enabled, we exhaust the activeCards list one by one
    // So if currentIndex >= activeCards.length, we are done
    if (fsrsEnabled && currentIndex >= activeCards.length) {
        return (
            <div className="w-full flex items-center justify-center aspect-[16/9] md:aspect-[2/1] max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl flex-col mb-6">
                <div className="text-zinc-300 text-lg font-bold mb-2">На сегодня карточек для повторения больше нет! 🎉</div>
                <button
                    onClick={() => { setFsrsEnabled(false); }}
                    className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl transition-colors font-semibold"
                >
                    Вернуться к обычному просмотру
                </button>
            </div>
        );
    }

    const currentCard = activeCards[currentIndex];

    return (
        <div className="w-full flex flex-col items-center">

            {/* The Flashcard Container */}
            <div className="relative w-full aspect-[16/9] md:aspect-[2/1] max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl flex flex-col overflow-hidden mb-6 select-none group">

                {/* Overlay Settings Modal */}
                {showSettings && (
                    <div className="absolute inset-0 z-50 bg-[#0a0a1a]/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                        <div className="w-full max-w-2xl bg-[#0a0a1a] rounded-3xl overflow-y-auto shadow-2xl relative max-h-full border border-white/5">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-[#1b1b2f] hover:bg-[#2a2a4d] text-zinc-300 hover:text-white transition-colors"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                            <div className="p-8 sm:p-10">
                                <h3 className="text-3xl font-bold text-white mb-2">Параметры</h3>

                                <div className="mt-8 flex flex-col">
                                    {/* Row 1 */}
                                    <div className="flex items-start justify-between py-6 border-b border-white/10">
                                        <div className="pr-8">
                                            <p className="font-bold text-base text-white">Интервальное повторение (FSRS)</p>
                                            <p className="text-[13px] text-zinc-400 mt-2 leading-relaxed max-w-lg">
                                                Интеллектуальный алгоритм. Показывает только карточки, которые вы можете скоро забыть.
                                            </p>
                                        </div>
                                        <div className="pt-1">
                                            <Toggle isOn={fsrsEnabled} onToggle={() => setFsrsEnabled(!fsrsEnabled)} />
                                        </div>
                                    </div>

                                    {/* Row 2 */}
                                    <div className="flex items-center justify-between py-6 border-b border-white/10">
                                        <div className="pr-8">
                                            <p className="font-bold text-base text-white">Отслеживайте прогресс</p>
                                            <p className="text-[13px] text-zinc-400 mt-2 leading-relaxed max-w-lg">Обычный режим. Отключите его для быстрого повторения.</p>
                                        </div>
                                        <div className="pt-1">
                                            <Toggle isOn={trackProgress} onToggle={() => setTrackProgress(!trackProgress)} />
                                        </div>
                                    </div>

                                    {/* Row 3 */}
                                    <div className="flex items-center justify-between py-6 border-b border-white/10">
                                        <p className="font-bold text-base text-white">Изучать только термины с ★</p>
                                        <Toggle isOn={studyStarredOnly} onToggle={() => setStudyStarredOnly(!studyStarredOnly)} />
                                    </div>

                                    {/* Row 3 */}
                                    <div className="flex items-center justify-between py-6 border-b border-white/10">
                                        <p className="font-bold text-base text-white">Лицевая сторона</p>
                                        <div className="relative">
                                            <select
                                                value={frontSide}
                                                onChange={(e) => setFrontSide(e.target.value as any)}
                                                className="bg-[#1b1b2f] hover:bg-[#2a2a4d] transition-colors appearance-none text-sm font-semibold rounded-full px-5 py-2.5 pr-10 outline-none text-white cursor-pointer"
                                            >
                                                <option value="term">Термин</option>
                                                <option value="definition">Определение</option>
                                            </select>
                                            <ChevronDownIcon className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white" />
                                        </div>
                                    </div>

                                    {/* Row 4 */}
                                    <div className="flex items-center justify-between py-6 border-b border-white/10">
                                        <p className="font-bold text-base text-white">Показывать обе стороны карточек</p>
                                        <Toggle isOn={showBothSides} onToggle={() => setShowBothSides(!showBothSides)} />
                                    </div>

                                    {/* Row 5 */}
                                    <div className="flex items-center justify-between py-6 border-b border-white/10">
                                        <p className="font-bold text-base text-white">Сочетания клавиш</p>
                                        <button className="flex items-center gap-2 text-sm font-semibold text-white hover:text-indigo-400 transition-colors">
                                            Просмотреть <ChevronDownIcon className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Row 6 */}
                                    <div className="flex items-center justify-between py-6 border-b border-white/10">
                                        <p className="font-bold text-base text-white">Преобразование текста в речь</p>
                                        <Toggle isOn={ttsEnabled} onToggle={() => setTtsEnabled(!ttsEnabled)} />
                                    </div>

                                    {/* Row 7 */}
                                    <div className="py-6 border-b border-white/10">
                                        <button
                                            onClick={() => { setCurrentIndex(0); setShowSettings(false); }}
                                            className="font-bold text-[15px] text-[#ff725b] hover:opacity-80 transition-opacity"
                                        >
                                            Пройти карточки заново
                                        </button>
                                    </div>

                                    {/* Row 8 */}
                                    <div className="py-6">
                                        <Link href="#" className="font-bold text-[15px] text-[#a8b1ff] hover:opacity-80 transition-opacity">
                                            Политика конфиденциальности
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Top Toolbar inside card */}
                <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2 text-zinc-400">
                        <HelpCircleIcon className="w-5 h-5 cursor-pointer hover:text-white transition-colors" /> Показать подсказку
                    </div>
                    <div className="flex items-center gap-4 text-zinc-400">
                        <Edit2 className="w-5 h-5 cursor-pointer hover:text-white transition-colors" />
                        {ttsEnabled ? (
                            <Volume2 onClick={(e) => { e.stopPropagation(); setTtsEnabled(false); }} className="w-5 h-5 cursor-pointer text-[#a8b1ff] hover:text-white transition-colors" />
                        ) : (
                            <VolumeX onClick={(e) => { e.stopPropagation(); setTtsEnabled(true); }} className="w-5 h-5 cursor-pointer text-zinc-500 hover:text-white transition-colors" />
                        )}
                        <Star className="w-5 h-5 cursor-pointer hover:text-yellow-400 transition-colors" />
                    </div>
                </div>

                {/* Card Content Area (Click to flip) */}
                <div
                    onClick={handleFlip}
                    className="flex-1 flex items-center justify-center p-12 cursor-pointer perspective-[1000px] w-full h-full"
                >
                    <div
                        className={`w-full h-full flex items-center justify-center transition-transform duration-500 ease-out-expo ${isFlipped ? 'rotate-x-180' : ''}`}
                        style={{ transformStyle: 'preserve-3d' }}
                    >
                        {/* Front Side */}
                        <div
                            className="absolute inset-0 flex flex-col items-center justify-center text-center backface-hidden"
                            style={{ backfaceVisibility: 'hidden' }}
                        >
                            <FlashcardRender card={currentCard} fieldsSchema={fieldsSchema} side={actualFrontSide} />
                        </div>

                        {/* Back Side */}
                        <div
                            className="absolute inset-0 flex flex-col items-center justify-center text-center backface-hidden rotate-x-180 text-indigo-100"
                            style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
                        >
                            <FlashcardRender card={currentCard} fieldsSchema={fieldsSchema} side={actualBackSide} />
                        </div>
                    </div>
                </div>

                {/* Bottom hint banner */}
                <div className="absolute bottom-0 left-0 right-0 h-10 flex items-center justify-center bg-indigo-600 font-medium text-sm text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Нажмите пробел, чтобы перевернуть карточку
                </div>
            </div>

            {/* Controls Below Card */}
            {fsrsEnabled && isFlipped ? (
                // FSRS Response Buttons
                <div className="flex items-center justify-center w-full max-w-4xl px-4 gap-4 md:gap-8 mt-2">
                    <button onClick={() => handleRateFSRS(1)} className="flex-1 max-w-[150px] py-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-colors font-bold text-sm">
                        Снова (1)
                    </button>
                    <button onClick={() => handleRateFSRS(2)} className="flex-1 max-w-[150px] py-3 rounded-xl bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border border-orange-500/20 transition-colors font-bold text-sm">
                        Трудно (2)
                    </button>
                    <button onClick={() => handleRateFSRS(3)} className="flex-1 max-w-[150px] py-3 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20 transition-colors font-bold text-sm">
                        Хорошо (3)
                    </button>
                    <button onClick={() => handleRateFSRS(4)} className="flex-1 max-w-[150px] py-3 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/20 transition-colors font-bold text-sm">
                        Легко (4)
                    </button>
                </div>
            ) : (
                <div className="flex items-center justify-between w-full max-w-4xl px-4">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-zinc-400">Алгоритм FSRS</span>
                        <Toggle isOn={fsrsEnabled} onToggle={() => setFsrsEnabled(!fsrsEnabled)} />
                    </div>

                    <div className="flex items-center gap-6">
                        <button
                            onClick={handlePrev}
                            disabled={fsrsEnabled || currentIndex === 0}
                            className={`w-12 h-12 flex items-center justify-center rounded-full border border-zinc-700 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-zinc-300 ${fsrsEnabled ? 'hidden' : ''}`}
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>

                        <div className="text-sm font-bold tracking-widest text-zinc-400 min-w-[60px] text-center">
                            {currentIndex + 1} / {activeCards.length}
                        </div>

                        <button
                            onClick={handleNext}
                            disabled={fsrsEnabled || currentIndex === activeCards.length - 1}
                            className={`w-12 h-12 flex items-center justify-center rounded-full border border-zinc-700 hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-zinc-300 ${fsrsEnabled ? 'hidden' : ''}`}
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 text-zinc-400">
                        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 transition-colors">
                            <Play className="w-5 h-5 fill-current" />
                        </button>
                        <button onClick={() => setShowSettings(true)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 transition-colors">
                            <Settings className="w-5 h-5" />
                        </button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 transition-colors">
                            <Maximize className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}

// Icons
function XIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}

function HelpCircleIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}

// Mini UI Toggle component
function Toggle({ isOn, onToggle }: { isOn: boolean; onToggle: () => void }) {
    return (
        <div
            onClick={onToggle}
            className={`w-11 h-6 rounded-full cursor-pointer transition-colors relative flex items-center ${isOn ? 'bg-[#a8b1ff]' : 'bg-[#5e5e6e]'}`}
        >
            <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm ${isOn ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
        </div>
    );
}

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
    );
}
