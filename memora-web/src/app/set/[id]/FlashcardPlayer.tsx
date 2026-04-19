"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { FlashcardResponse, FieldSchema } from "@/types/schema"
import { ChevronLeft, ChevronRight, Settings, Play, Pause, Maximize, Edit2, Volume2, VolumeX, Star, Shuffle } from "lucide-react"
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
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);

    // Settings state
    const [trackProgress, setTrackProgress] = useState(false);
    const [studyStarredOnly, setStudyStarredOnly] = useState(false);
    const [frontSide, setFrontSide] = useState<'term' | 'definition'>('term');
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [showBothSides, setShowBothSides] = useState(false);

    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [isShuffled, setIsShuffled] = useState(false);
    const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
    const [editingCard, setEditingCard] = useState<FlashcardResponse | null>(null);
    const [hasInteracted, setHasInteracted] = useState(false);

    // activeCards could be restricted when tracking progress
    const [activeCards, setActiveCards] = useState<FlashcardResponse[]>(flashcards);
    const [isLoadingFsrs, setIsLoadingFsrs] = useState(false);

    useEffect(() => {
        const onInteract = () => setHasInteracted(true);
        window.addEventListener('click', onInteract, { once: true });
        window.addEventListener('keydown', onInteract, { once: true });
        return () => {
            window.removeEventListener('click', onInteract);
            window.removeEventListener('keydown', onInteract);
        };
    }, []);

    const handleResetFsrs = async () => {
        if (!setId) return;
        setIsLoadingFsrs(true);
        try {
            await fetch(`/api/sets/${setId}/fsrs/reset`, { method: "DELETE" });
            const res = await fetch(`/api/sets/${setId}/fsrs/due`);
            const data = await res.json();
            let newCards = data && Array.isArray(data) ? data : [];
            if (studyStarredOnly) newCards = newCards.filter((c: any) => starredIds.has(c.id));
            if (isShuffled) newCards = [...newCards].sort(() => Math.random() - 0.5);
            setActiveCards(newCards);
            setCurrentIndex(0);
            setIsFlipped(false);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingFsrs(false);
            setShowSettings(false);
        }
    };

    useEffect(() => {
        // Load initial starred state
        if (setId && typeof window !== 'undefined') {
            const saved = localStorage.getItem(`starred_${setId}`);
            if (saved) {
                try { setStarredIds(new Set(JSON.parse(saved))); } catch (e) { }
            }
        }
    }, [setId]);

    const toggleStar = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setStarredIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            if (setId) localStorage.setItem(`starred_${setId}`, JSON.stringify(Array.from(next)));
            return next;
        });
    };

    useEffect(() => {
        const applyFilters = (baseCards: FlashcardResponse[]) => {
            let res = baseCards;
            if (studyStarredOnly) {
                res = res.filter(c => starredIds.has(c.id));
            }
            if (isShuffled) {
                // simple shuffle
                res = [...res].sort(() => Math.random() - 0.5);
            }
            return res;
        };

        if (!trackProgress) {
            setActiveCards(applyFilters(flashcards));
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
                    setActiveCards(applyFilters(data && Array.isArray(data) ? data : []));
                    setCurrentIndex(0);
                    setIsFlipped(false);
                }
            })
            .catch(err => console.error("Error fetching FSRS due cards:", err))
            .finally(() => {
                if (isMounted) setIsLoadingFsrs(false);
            });

        return () => { isMounted = false; };
        // deliberately excluding starredIds from deps to avoid re-shuffling on every star click
    }, [trackProgress, flashcards, setId, studyStarredOnly, isShuffled]);

    const handleRateFSRS = useCallback(async (rating: number) => {
        const currentCard = activeCards[currentIndex];
        if (!currentCard) return;

        try {
            await fetch("/api/study/fsrs/review", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    flashcardId: currentCard.id,
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
    }, [activeCards, currentIndex]);

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
            if (field.type === 'text' && field.settings?.ttsEnabled) {
                // Use the new dedicated audio endpoint instead of embedded base64
                // TTS audio is stored with the _audio suffix
                audioUrls.push(`/api/audio/${currentCard.id}/${field.id}_audio`);
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
                audio.play().catch(e => console.warn("Autoplay prevented:", e.message));
            }
        };

        playNext();
    }, [currentIndex, isFlipped, activeCards, fieldsSchema, visibleSide]);

    // Auto-play TTS on card flip/change
    useEffect(() => {
        if (ttsEnabled && hasInteracted) {
            playCurrentSideAudio();
        }
    }, [currentIndex, isFlipped, ttsEnabled, hasInteracted, playCurrentSideAudio]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input (like search)
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.code === 'Space') {
                e.preventDefault();
                handleFlip();
            } else if (e.code === 'ArrowRight') {
                if (trackProgress && isFlipped && !showBothSides) {
                    handleRateFSRS(3); // Знаю
                } else {
                    handleNext();
                }
            } else if (e.code === 'ArrowLeft') {
                if (trackProgress && isFlipped && !showBothSides) {
                    handleRateFSRS(1); // Еще изучаю
                } else {
                    handlePrev();
                }
            } else if (e.code === 'KeyH') {
                setIsShuffled(prev => !prev);
            } else if (e.code === 'KeyA') {
                setTtsEnabled(prev => !prev);
            } else if (e.code === 'KeyE') {
                if (activeCards[currentIndex]) setEditingCard(activeCards[currentIndex]);
            } else if (e.code === 'KeyS') {
                const cardId = activeCards[currentIndex]?.id;
                if (cardId) {
                    setStarredIds(prev => {
                        const next = new Set(prev);
                        if (next.has(cardId)) next.delete(cardId);
                        else next.add(cardId);
                        if (setId) localStorage.setItem(`starred_${setId}`, JSON.stringify(Array.from(next)));
                        return next;
                    });
                }
            } else if (e.code === 'KeyT') {
                setFrontSide('term');
            } else if (e.code === 'KeyD') {
                setFrontSide('definition');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleFlip, handleNext, handlePrev, activeCards, currentIndex, trackProgress, isFlipped, showBothSides, setId, handleRateFSRS]);

    useEffect(() => {
        if (!isAutoPlaying) return;
        const currentIsFlipped = isFlipped;

        const timer = setTimeout(() => {
            if (!currentIsFlipped && !showBothSides) {
                setIsFlipped(true);
            } else {
                handleNext();
                if (currentIndex >= activeCards.length - 1) {
                    setIsAutoPlaying(false);
                }
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [isAutoPlaying, isFlipped, currentIndex, handleNext, activeCards.length, showBothSides]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            if (containerRef.current) containerRef.current.requestFullscreen().catch(err => console.error(err));
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    if (trackProgress && isLoadingFsrs) {
        return <div className="p-8 text-center text-zinc-500 animate-pulse">Загрузка карточек для повторения...</div>;
    }

    if (!activeCards || activeCards.length === 0) {
        return (
            <div className="w-full flex-col flex items-center justify-center aspect-[16/9] md:aspect-[2/1] max-w-4xl bg-qz-bg border border-qz-border-light rounded-2xl shadow-xl mb-6">
                <div className="text-qz-text-muted font-medium">
                    {trackProgress ? "Отлично! На сегодня карточек для повторения больше нет! 🎉" : "Нет карточек для отображения."}
                </div>
                {trackProgress && (
                    <div className="flex flex-col sm:flex-row gap-4 mt-6">
                        <button
                            onClick={handleResetFsrs}
                            className="bg-qz-card hover:bg-qz-card border border-white/10 text-qz-text px-6 py-2.5 rounded-xl transition-colors font-semibold"
                        >
                            Сбросить прогресс
                        </button>
                        <button
                            onClick={() => { setTrackProgress(false); }}
                            className="bg-[#4255ff] hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl transition-colors font-semibold"
                        >
                            Вернуться к обычному просмотру
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // When tracking progress, we exhaust the activeCards list one by one
    if (trackProgress && currentIndex >= activeCards.length) {
        return (
            <div className="w-full flex-col flex items-center justify-center aspect-[16/9] md:aspect-[2/1] max-w-4xl bg-qz-bg border border-qz-border-light rounded-2xl shadow-xl mb-6">
                <div className="text-qz-text-muted text-lg font-bold mb-2">На сегодня карточек для повторения больше нет! 🎉</div>
                <div className="flex flex-col sm:flex-row gap-4 mt-6">
                    <button
                        onClick={handleResetFsrs}
                        className="bg-qz-card hover:bg-qz-card border border-white/10 text-qz-text px-6 py-2.5 rounded-xl transition-colors font-semibold shadow-md inline-flex justify-center"
                    >
                        Начать заново (Сбросить прогресс)
                    </button>
                    <button
                        onClick={() => { setTrackProgress(false); }}
                        className="bg-[#4255ff] hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl transition-colors font-semibold"
                    >
                        Вернуться к обычному просмотру
                    </button>
                </div>
            </div>
        );
    }

    const currentCard = activeCards[currentIndex];

    return (
        <div ref={containerRef} className="w-full flex flex-col items-center bg-qz-bg md:bg-transparent min-h-screen md:min-h-auto justify-center md:justify-start">

            {/* The Flashcard Container */}
            <div className="relative w-full h-[65vh] md:h-auto md:aspect-[2/1] max-w-6xl bg-qz-card border border-qz-border-light rounded-2xl shadow-xl flex flex-col overflow-hidden mb-6 select-none group">

                {/* Overlay Settings Modal */}
                {showSettings && (
                    <div className="absolute inset-0 z-50 bg-qz-bg/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200" onClick={() => setShowSettings(false)}>
                        <div className="w-full max-w-2xl bg-qz-bg rounded-3xl overflow-y-auto shadow-2xl relative max-h-full border border-white/5" onClick={e => e.stopPropagation()}>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-qz-bg hover:bg-qz-card text-qz-text-muted hover:text-qz-text transition-colors"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                            <div className="p-8 sm:p-10">
                                <h3 className="text-3xl font-bold text-qz-text mb-2">Параметры</h3>

                                <div className="mt-8 flex flex-col">
                                    {/* Row 1 */}
                                    <div className="flex items-start justify-between py-6 border-b border-white/10">
                                        <div className="pr-8">
                                            <p className="font-bold text-base text-qz-text">Отслеживайте прогресс</p>
                                            <p className="text-[13px] text-qz-text-muted mt-2 leading-relaxed max-w-lg">
                                                Интеллектуальный алгоритм. Показывает только карточки, которые вы можете скоро забыть.
                                            </p>
                                        </div>
                                        <div className="pt-1">
                                            <Toggle isOn={trackProgress} onToggle={() => setTrackProgress(!trackProgress)} />
                                        </div>
                                    </div>

                                    {/* Row 3 */}
                                    <div className="flex items-center justify-between py-6 border-b border-white/10">
                                        <p className="font-bold text-base text-qz-text">Изучать только термины с ★</p>
                                        <Toggle isOn={studyStarredOnly} onToggle={() => setStudyStarredOnly(!studyStarredOnly)} />
                                    </div>

                                    {/* Row 3 */}
                                    <div className="flex items-center justify-between py-6 border-b border-white/10">
                                        <p className="font-bold text-base text-qz-text">Лицевая сторона</p>
                                        <div className="relative">
                                            <select
                                                value={frontSide}
                                                onChange={(e) => setFrontSide(e.target.value as any)}
                                                className="bg-qz-bg hover:bg-qz-card transition-colors appearance-none text-sm font-semibold rounded-full px-5 py-2.5 pr-10 outline-none text-qz-text cursor-pointer"
                                            >
                                                <option value="term">Термин</option>
                                                <option value="definition">Определение</option>
                                            </select>
                                            <ChevronDownIcon className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-qz-text" />
                                        </div>
                                    </div>

                                    {/* Row 4 */}
                                    <div className="flex items-center justify-between py-6 border-b border-white/10">
                                        <p className="font-bold text-base text-qz-text">Показывать обе стороны карточек</p>
                                        <Toggle isOn={showBothSides} onToggle={() => setShowBothSides(!showBothSides)} />
                                    </div>

                                    {/* Row 5 */}
                                    <div className="flex flex-col py-6 border-b border-white/10">
                                        <div className="flex items-center justify-between cursor-pointer group" onClick={() => setShowShortcuts(!showShortcuts)}>
                                            <p className="font-bold text-base text-qz-text group-hover:text-[#ffcd1f] transition-colors">Сочетания клавиш</p>
                                            <button className="flex items-center gap-2 text-sm font-semibold text-qz-text group-hover:text-[#ffcd1f] transition-colors">
                                                {showShortcuts ? 'Скрыть' : 'Просмотреть'} <ChevronDownIcon className={`w-4 h-4 transition-transform ${showShortcuts ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                        {showShortcuts && (
                                            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-[15px] text-qz-text-muted">
                                                <div className="flex justify-between items-center py-2.5 border-b border-white/5"><span className="text-qz-text">Знаю</span><kbd className="px-2 py-1 bg-transparent border-2 border-white/20 rounded font-bold text-xs uppercase flex items-center justify-center w-8 h-8">→</kbd></div>
                                                <div className="flex justify-between items-center py-2.5 border-b border-white/5"><span className="text-qz-text">Перемешать</span><kbd className="px-2 py-1 bg-transparent border-2 border-white/20 rounded font-bold text-xs uppercase flex items-center justify-center w-8 h-8">H</kbd></div>
                                                <div className="flex justify-between items-center py-2.5 border-b border-white/5"><span className="text-qz-text">Еще изучаю</span><kbd className="px-2 py-1 bg-transparent border-2 border-white/20 rounded font-bold text-xs uppercase flex items-center justify-center w-8 h-8">←</kbd></div>
                                                <div className="flex justify-between items-center py-2.5 border-b border-white/5"><span className="text-qz-text">Аудио</span><kbd className="px-2 py-1 bg-transparent border-2 border-white/20 rounded font-bold text-xs uppercase flex items-center justify-center w-8 h-8">A</kbd></div>
                                                <div className="flex justify-between items-center py-2.5 border-b border-white/5"><span className="text-qz-text">Перевернуть</span><kbd className="px-3 py-1 bg-transparent border-2 border-white/20 rounded font-bold text-xs uppercase flex items-center justify-center h-8">Пробел</kbd></div>
                                                <div className="flex justify-between items-center py-2.5 border-b border-white/5"><span className="text-qz-text">Отвечать термином</span><kbd className="px-2 py-1 bg-transparent border-2 border-white/20 rounded font-bold text-xs uppercase flex items-center justify-center w-8 h-8">T</kbd></div>
                                                <div className="flex justify-between items-center py-2.5 border-b border-white/5"><span className="text-qz-text shadow-sm flex items-center gap-2 text-base">Пометить <Star className="w-5 h-5 fill-white text-qz-text" /></span><kbd className="px-2 py-1 bg-transparent border-2 border-white/20 rounded font-bold text-xs uppercase flex items-center justify-center w-8 h-8">S</kbd></div>
                                                <div className="flex justify-between items-center py-2.5 border-b border-white/5"><span className="text-qz-text flex flex-col justify-start items-start gap-1"><span>Отвечать</span> <span>определением</span></span><kbd className="px-2 py-1 bg-transparent border-2 border-white/20 rounded font-bold text-xs uppercase flex items-center justify-center w-8 h-8">D</kbd></div>
                                                <div className="flex justify-between items-center py-2.5 border-b border-white/5"><span className="text-qz-text">Редактировать</span><kbd className="px-2 py-1 bg-transparent border-2 border-white/20 rounded font-bold text-xs uppercase flex items-center justify-center w-8 h-8">E</kbd></div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Row 6 */}
                                    <div className="flex items-center justify-between py-6 border-b border-white/10">
                                        <p className="font-bold text-base text-qz-text">Преобразование текста в речь</p>
                                        <Toggle isOn={ttsEnabled} onToggle={() => setTtsEnabled(!ttsEnabled)} />
                                    </div>

                                    {/* Row 7 */}
                                    <div className="py-6 border-b border-white/10">
                                        <button
                                            onClick={() => {
                                                if (trackProgress) {
                                                    handleResetFsrs();
                                                } else {
                                                    setCurrentIndex(0);
                                                    setIsFlipped(false);
                                                    setShowSettings(false);
                                                }
                                            }}
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
                    <div className="flex items-center gap-2 text-qz-text-muted">
                        <HelpCircleIcon className="w-5 h-5 cursor-pointer hover:text-qz-text transition-colors" /> Показать подсказку
                    </div>
                    <div className="flex items-center gap-4 text-qz-text-muted">
                        <Edit2 onClick={(e) => { e.stopPropagation(); setEditingCard(currentCard); }} className="w-5 h-5 cursor-pointer hover:text-qz-text transition-colors" />
                        {ttsEnabled ? (
                            <Volume2 onClick={(e) => { e.stopPropagation(); setTtsEnabled(false); }} className="w-5 h-5 cursor-pointer text-[#a8b1ff] hover:text-qz-text transition-colors" />
                        ) : (
                            <VolumeX onClick={(e) => { e.stopPropagation(); setTtsEnabled(true); }} className="w-5 h-5 cursor-pointer text-zinc-500 hover:text-qz-text transition-colors" />
                        )}
                        <Star onClick={(e) => toggleStar(e, currentCard?.id)} className={`w-5 h-5 cursor-pointer transition-colors ${starredIds.has(currentCard?.id) ? 'text-yellow-400 fill-yellow-400' : 'hover:text-yellow-400'}`} />
                    </div>
                </div>

                {/* Card Content Area (Click to flip) */}
                <div
                    onClick={handleFlip}
                    className="flex-1 flex items-center justify-center p-4 md:p-8 cursor-pointer perspective-[1000px] w-full h-full"
                >
                    <div
                        className={`w-full h-full flex items-center justify-center transition-transform duration-500 ease-out-expo ${(isFlipped && !showBothSides) ? 'rotate-x-180' : ''}`}
                        style={{ transformStyle: 'preserve-3d' }}
                    >
                        {showBothSides ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 gap-8 overflow-y-auto w-full h-full">
                                <div className="font-semibold text-qz-text text-[22px] border-b border-white/10 pb-6 w-full flex-1 flex flex-col justify-end">
                                    <FlashcardRender card={currentCard} fieldsSchema={fieldsSchema} side={actualFrontSide} />
                                </div>
                                <div className="font-medium text-indigo-100 text-lg w-full flex-1 flex flex-col justify-start">
                                    <FlashcardRender card={currentCard} fieldsSchema={fieldsSchema} side={actualBackSide} />
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Front Side - scrollable, centered via my-auto trick */}
                                <div
                                    className="absolute inset-0 flex flex-col items-center text-center backface-hidden overflow-y-auto py-4"
                                    style={{ backfaceVisibility: 'hidden' }}
                                >
                                    <div className="my-auto w-full">
                                        <FlashcardRender card={currentCard} fieldsSchema={fieldsSchema} side={actualFrontSide} />
                                    </div>
                                </div>

                                {/* Back Side - scrollable, centered via my-auto trick */}
                                <div
                                    className="absolute inset-0 flex flex-col items-center text-center backface-hidden overflow-y-auto py-4 text-indigo-100"
                                    style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
                                >
                                    <div className="my-auto w-full">
                                        <FlashcardRender card={currentCard} fieldsSchema={fieldsSchema} side={actualBackSide} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Bottom hint banner */}
                <div className={`absolute bottom-0 left-0 right-0 h-10 flex items-center justify-center bg-[#4255ff] font-medium text-sm text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${showBothSides ? 'hidden' : ''}`}>
                    Нажмите пробел, чтобы перевернуть карточку
                </div>
            </div>

            {/* Controls Below Card */}
            {trackProgress && isFlipped && !showBothSides ? (
                // FSRS Response Buttons (Quizlet Style)
                <div className="flex items-center justify-center w-full max-w-4xl px-4 gap-4 md:gap-8 mt-2">
                    <button onClick={() => handleRateFSRS(1)} className="flex-1 max-w-[200px] py-4 rounded-xl bg-qz-card hover:bg-qz-card border border-qz-border-light transition-colors font-bold text-sm text-qz-text flex items-center justify-center gap-3">
                        <span className="w-6 h-6 rounded border border-white/20 flex items-center justify-center text-[10px]">←</span>
                        Еще изучаю
                    </button>
                    <button onClick={() => handleRateFSRS(3)} className="flex-1 max-w-[200px] py-4 rounded-xl bg-qz-card hover:bg-qz-card border border-qz-border-light transition-colors font-bold text-sm text-qz-text flex items-center justify-center gap-3">
                        Знаю
                        <span className="w-6 h-6 rounded border border-white/20 flex items-center justify-center text-[10px]">→</span>
                    </button>
                </div>
            ) : (
                <div className="flex items-center justify-between w-full max-w-6xl px-4">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setTrackProgress(!trackProgress)}>
                        <span className="text-sm font-medium text-qz-text-muted group-hover:text-qz-text transition-colors">Отслеживать прогресс</span>
                        <Toggle isOn={trackProgress} onToggle={() => setTrackProgress(!trackProgress)} />
                    </div>

                    <div className="flex items-center gap-6">
                        <button
                            onClick={handlePrev}
                            disabled={trackProgress || currentIndex === 0}
                            className={`w-12 h-12 flex items-center justify-center rounded-full border border-qz-border hover:bg-qz-card disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-qz-text-muted ${trackProgress ? 'invisible' : ''}`}
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>

                        <div className="text-sm font-bold tracking-widest text-qz-text-muted min-w-[60px] text-center">
                            {currentIndex + 1} / {activeCards.length}
                        </div>

                        <button
                            onClick={handleNext}
                            disabled={trackProgress || currentIndex === activeCards.length - 1}
                            className={`w-12 h-12 flex items-center justify-center rounded-full border border-qz-border hover:bg-qz-card disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-qz-text-muted ${trackProgress ? 'invisible' : ''}`}
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 text-qz-text-muted">
                        <button onClick={() => setIsAutoPlaying(!isAutoPlaying)} className={`w-10 h-10 flex items-center justify-center rounded-full hover:bg-qz-card transition-colors ${isAutoPlaying ? 'text-[#ffcd1f]' : ''}`} title="Автовоспроизведение">
                            {isAutoPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                        </button>
                        <button onClick={() => setIsShuffled(!isShuffled)} className={`w-10 h-10 flex items-center justify-center rounded-full hover:bg-qz-card transition-colors ${isShuffled ? 'text-[#ffcd1f]' : ''}`} title="Перемешать">
                            <Shuffle className="w-5 h-5" />
                        </button>
                        <button onClick={() => setShowSettings(true)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-qz-card transition-colors" title="Параметры">
                            <Settings className="w-5 h-5" />
                        </button>
                        <button onClick={toggleFullscreen} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-qz-card transition-colors" title="На весь экран">
                            <Maximize className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Modal Overlay */}
            {editingCard && (
                <div className="fixed inset-0 z-[100] bg-qz-bg/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-[#171c2e] rounded-2xl shadow-2xl border border-qz-border-light overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-qz-border-light flex justify-between items-center bg-[#111526]">
                            <h3 className="text-xl font-bold text-qz-text">Редактировать карточку</h3>
                            <button onClick={() => setEditingCard(null)} className="text-qz-text-muted hover:text-qz-text transition-colors">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 flex flex-col gap-6 bg-[#171c2e] overflow-y-auto max-h-[60vh]">
                            {fieldsSchema.sort((a, b) => a.order - b.order).map(field => (
                                <div key={field.id}>
                                    <label className="text-xs font-bold text-[#ffcd1f] mb-2 block uppercase tracking-wider">{field.name}</label>
                                    {field.id === 'term' || field.id === 'definition' ? (
                                        field.id === 'term' ? (
                                            <input
                                                className="w-full bg-qz-bg border-b-2 border-white/20 focus:border-[#a8b1ff] text-qz-text p-3 outline-none transition-colors rounded-t-md"
                                                defaultValue={editingCard?.term}
                                                onChange={(e) => { if (editingCard) editingCard.term = e.target.value; }}
                                            />
                                        ) : (
                                            <textarea
                                                className="w-full bg-qz-bg border-b-2 border-white/20 focus:border-[#a8b1ff] text-qz-text p-3 outline-none transition-colors resize-none min-h-[100px] rounded-t-md"
                                                defaultValue={editingCard?.definition}
                                                onChange={(e) => { if (editingCard) editingCard.definition = e.target.value; }}
                                            />
                                        )
                                    ) : (
                                        <textarea
                                            className="w-full bg-qz-bg border-b-2 border-white/20 focus:border-[#a8b1ff] text-qz-text p-3 outline-none transition-colors resize-none min-h-[70px] rounded-t-md"
                                            defaultValue={editingCard?.fieldsData?.[field.id] || ''}
                                            onChange={(e) => {
                                                if (editingCard) {
                                                    if (!editingCard.fieldsData) editingCard.fieldsData = {};
                                                    editingCard.fieldsData[field.id] = e.target.value;
                                                }
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="p-5 border-t border-qz-border-light flex justify-end gap-4 bg-[#111526]">
                            <button onClick={() => setEditingCard(null)} className="px-6 py-2.5 rounded-full text-qz-text-muted font-semibold hover:bg-white/5 transition-colors">Отмена</button>
                            <button onClick={() => {
                                setActiveCards(prev => [...prev]);
                                setEditingCard(null);
                            }} className="px-8 py-2.5 rounded-full bg-[#4255ff] text-white font-semibold hover:bg-indigo-700 transition-colors">
                                Готово
                            </button>
                        </div>
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
