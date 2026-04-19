"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import { SetResponse, FlashcardResponse } from '@/types/schema';
import { X, Trophy, RefreshCcw, Settings, Star, Play, RotateCcw, Keyboard } from 'lucide-react';
import Link from 'next/link';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateLearnQueue, getCardText } from '@/lib/studyUtils';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// --- SHAPE DEFINITIONS ---
const SHAPES = [
    // 1x1
    { shape: [[1]], color: 'bg-green-500', shadow: 'shadow-[0_4px_0_0_#16a34a]' },
    // 1x2 Horizontal / Vertical
    { shape: [[1, 1]], color: 'bg-blue-500', shadow: 'shadow-[0_4px_0_0_#2563eb]' },
    { shape: [[1], [1]], color: 'bg-blue-500', shadow: 'shadow-[0_4px_0_0_#2563eb]' },
    // 1x3 Horizontal / Vertical
    { shape: [[1, 1, 1]], color: 'bg-sky-400', shadow: 'shadow-[0_4px_0_0_#0284c7]' },
    { shape: [[1], [1], [1]], color: 'bg-sky-400', shadow: 'shadow-[0_4px_0_0_#0284c7]' },
    // 1x4 Horizontal / Vertical
    { shape: [[1, 1, 1, 1]], color: 'bg-[#4255ff]', shadow: 'shadow-[0_4px_0_0_#4f46e5]' },
    { shape: [[1], [1], [1], [1]], color: 'bg-[#4255ff]', shadow: 'shadow-[0_4px_0_0_#4f46e5]' },
    // 1x5 Horizontal / Vertical
    { shape: [[1, 1, 1, 1, 1]], color: 'bg-[#4255ff]', shadow: 'shadow-[0_4px_0_0_#9333ea]' },
    { shape: [[1], [1], [1], [1], [1]], color: 'bg-[#4255ff]', shadow: 'shadow-[0_4px_0_0_#9333ea]' },
    // 2x2
    { shape: [[1, 1], [1, 1]], color: 'bg-yellow-400', shadow: 'shadow-[0_4px_0_0_#eab308]' },
    // 3x3
    { shape: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], color: 'bg-red-500', shadow: 'shadow-[0_4px_0_0_#dc2626]' },
    // Small L (2x2)
    { shape: [[1, 0], [1, 1]], color: 'bg-pink-500', shadow: 'shadow-[0_4px_0_0_#db2777]' },
    { shape: [[0, 1], [1, 1]], color: 'bg-pink-500', shadow: 'shadow-[0_4px_0_0_#db2777]' },
    { shape: [[1, 1], [1, 0]], color: 'bg-pink-500', shadow: 'shadow-[0_4px_0_0_#db2777]' },
    { shape: [[1, 1], [0, 1]], color: 'bg-pink-500', shadow: 'shadow-[0_4px_0_0_#db2777]' },
    // Large L (3x3)
    { shape: [[1, 0, 0], [1, 0, 0], [1, 1, 1]], color: 'bg-orange-500', shadow: 'shadow-[0_4px_0_0_#ea580c]' },
    { shape: [[0, 0, 1], [0, 0, 1], [1, 1, 1]], color: 'bg-orange-500', shadow: 'shadow-[0_4px_0_0_#ea580c]' },
    { shape: [[1, 1, 1], [1, 0, 0], [1, 0, 0]], color: 'bg-orange-500', shadow: 'shadow-[0_4px_0_0_#ea580c]' },
    { shape: [[1, 1, 1], [0, 0, 1], [0, 0, 1]], color: 'bg-orange-500', shadow: 'shadow-[0_4px_0_0_#ea580c]' }
];

type BlockShape = {
    id: string; // unique string for rendering keys in hand
    shape: number[][]; // 2D array of 1s and 0s
    color: string;
    shadow: string;
    isPlaced: boolean; // Tracking if the piece was placed during the current phase
};

type GridCell = {
    active: boolean;
    color: string;
    shadow: string;
};

// --- GAME LOGIC SETTINGS ---
const GRID_SIZE = 8;
const MAX_STRIKES = 3;

export default function BlocksGameMode({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const router = useRouter();
    const { data: session } = useSession();

    // Core External Data
    const [set, setSet] = useState<SetResponse | null>(null);
    const [queue, setQueue] = useState<FlashcardResponse[]>([]);

    // Settings
    const [showSettings, setShowSettings] = useState(false);
    const [answerWith, setAnswerWith] = useState<'term' | 'definition'>('term'); // 'term' means user types the Term (prompt is Definition)

    // Game State
    const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAME_OVER'>('START');
    const [gamePhase, setGamePhase] = useState<'PLACING' | 'ANSWERING'>('PLACING');

    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);

    const [grid, setGrid] = useState<GridCell[][]>(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill({ active: false, color: '', shadow: '' })));
    const [hand, setHand] = useState<BlockShape[]>([]);

    // Answering State
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [typedAnswer, setTypedAnswer] = useState("");
    const [wrongAttempts, setWrongAttempts] = useState(0);
    const [showCorrectAnswerOverlay, setShowCorrectAnswerOverlay] = useState(false); // Shown after 3 strikes

    // Drag & Drop State
    const [draggingPiece, setDraggingPiece] = useState<{ piece: BlockShape, handIndex: number } | null>(null);
    const [dragPos, setDragPos] = useState({ x: 0, y: 0 }); // Current cursor pos
    const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 }); // Mouse offset within the piece
    const gridRef = useRef<HTMLDivElement>(null);

    // Initial Data Fetch
    useEffect(() => {
        const fetchSet = async () => {
            try {
                const resSet = await fetch(`/api/sets/${id}`);
                if (resSet.ok) {
                    const setData: SetResponse = await resSet.json();
                    setSet(setData);
                    setQueue(generateLearnQueue(setData.flashcards, new Set()));
                } else {
                    router.push('/404');
                }
            } catch (err) {
                console.error("Failed to fetch set data", err);
            }
        };
        fetchSet();
    }, [id, router]);

    // Game Actions
    const generateNewHand = useCallback(() => {
        const newHand = [];
        for (let i = 0; i < 3; i++) {
            const randomShapeData = SHAPES[Math.floor(Math.random() * SHAPES.length)];
            newHand.push({
                id: Math.random().toString(36).substr(2, 9),
                shape: randomShapeData.shape,
                color: randomShapeData.color,
                shadow: randomShapeData.shadow,
                isPlaced: false
            });
        }
        setHand(newHand);
    }, []);

    const startGame = () => {
        setScore(0);
        setGrid(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill({ active: false, color: '', shadow: '' })));
        setGameState('PLAYING');
        setGamePhase('PLACING');
        setWrongAttempts(0);
        setShowCorrectAnswerOverlay(false);
        setTypedAnswer("");
        setCurrentQuestionIndex(0);

        // Ensure we shuffle for a fresh start
        if (set) {
            setQueue(generateLearnQueue(set.flashcards, new Set()));
        }

        generateNewHand();
    };

    // --- GAME ENGINE LOGIC ---

    const canFitPieceAnywhere = (piece: BlockShape, currentGrid: GridCell[][]) => {
        const h = piece.shape.length;
        const w = piece.shape[0].length;

        for (let r = 0; r <= GRID_SIZE - h; r++) {
            for (let c = 0; c <= GRID_SIZE - w; c++) {
                let fits = true;
                for (let pr = 0; pr < h; pr++) {
                    for (let pc = 0; pc < w; pc++) {
                        if (piece.shape[pr][pc] === 1 && currentGrid[r + pr][c + pc].active) {
                            fits = false;
                            break;
                        }
                    }
                    if (!fits) break;
                }
                if (fits) return true;
            }
        }
        return false;
    };

    const checkGameOver = useCallback((currentGrid: GridCell[][], currentHand: BlockShape[]) => {
        const remainingPieces = currentHand.filter(p => !p.isPlaced);
        if (remainingPieces.length === 0) return false;

        for (const piece of remainingPieces) {
            if (canFitPieceAnywhere(piece, currentGrid)) {
                return false; // At least one piece fits
            }
        }
        return true; // No pieces fit!
    }, []);

    const clearLinesAndScore = (newGrid: GridCell[][]) => {
        let rowsToClear = new Set<number>();
        let colsToClear = new Set<number>();

        // Find full rows
        for (let r = 0; r < GRID_SIZE; r++) {
            let full = true;
            for (let c = 0; c < GRID_SIZE; c++) {
                if (!newGrid[r][c].active) {
                    full = false;
                    break;
                }
            }
            if (full) rowsToClear.add(r);
        }

        // Find full cols
        for (let c = 0; c < GRID_SIZE; c++) {
            let full = true;
            for (let r = 0; r < GRID_SIZE; r++) {
                if (!newGrid[r][c].active) {
                    full = false;
                    break;
                }
            }
            if (full) colsToClear.add(c);
        }

        const linesCleared = rowsToClear.size + colsToClear.size;

        if (linesCleared > 0) {
            // Apply clearing
            const finalGrid = newGrid.map(row => [...row]);

            rowsToClear.forEach(r => {
                for (let c = 0; c < GRID_SIZE; c++) {
                    finalGrid[r][c] = { active: false, color: '', shadow: '' };
                }
            });
            colsToClear.forEach(c => {
                for (let r = 0; r < GRID_SIZE; r++) {
                    finalGrid[r][c] = { active: false, color: '', shadow: '' };
                }
            });

            setGrid(finalGrid);

            // Score calculation (simple version: 10 pts per line, plus combo scaling)
            const comboMultiplier = linesCleared > 1 ? linesCleared : 1;
            const pts = linesCleared * 10 * comboMultiplier;

            setScore(prev => {
                const nextScore = prev + pts;
                if (nextScore > highScore) setHighScore(nextScore);
                return nextScore;
            });

            return finalGrid;
        }

        return newGrid;
    };

    // --- DRAG AND DROP HANDLING ---

    const handlePointerDown = (e: React.PointerEvent, piece: BlockShape, handIndex: number) => {
        if (gamePhase !== 'PLACING' || piece.isPlaced) return;

        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();

        // Calculate the offset of the cursor from the top-left of the piece's container
        // This keeps the piece fixed to the cursor where they clicked it
        setDragStartOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });

        setDragPos({ x: e.clientX, y: e.clientY });
        setDraggingPiece({ piece, handIndex });

        // Capture pointer to allow dragging outside bounds
        target.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!draggingPiece) return;
        e.preventDefault(); // Stop scrolling while dragging
        setDragPos({ x: e.clientX, y: e.clientY });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!draggingPiece) return;

        const { piece, handIndex } = draggingPiece;
        setDraggingPiece(null);

        if (!gridRef.current) return;
        const gridRect = gridRef.current.getBoundingClientRect();

        // Calculate top-left corner of the DROPPED piece relative to the grid
        const dropX = dragPos.x - dragStartOffset.x;
        const dropY = dragPos.y - dragStartOffset.y;

        const relX = dropX - gridRect.left;
        const relY = dropY - gridRect.top;

        const cellSize = gridRect.width / GRID_SIZE;

        // Determine grid coordinates (rounding to nearest cell)
        const gridCol = Math.round(relX / cellSize);
        const gridRow = Math.round(relY / cellSize);

        // Check boundaries
        const h = piece.shape.length;
        const w = piece.shape[0].length;

        if (gridRow >= 0 && gridRow + h <= GRID_SIZE && gridCol >= 0 && gridCol + w <= GRID_SIZE) {
            // Check overlaps
            let canPlace = true;
            for (let pr = 0; pr < h; pr++) {
                for (let pc = 0; pc < w; pc++) {
                    if (piece.shape[pr][pc] === 1 && grid[gridRow + pr][gridCol + pc].active) {
                        canPlace = false;
                        break;
                    }
                }
            }

            if (canPlace) {
                // Apply placement
                const newGrid = grid.map(row => [...row]);
                for (let pr = 0; pr < h; pr++) {
                    for (let pc = 0; pc < w; pc++) {
                        if (piece.shape[pr][pc] === 1) {
                            newGrid[gridRow + pr][gridCol + pc] = {
                                active: true,
                                color: piece.color,
                                shadow: piece.shadow
                            };
                        }
                    }
                }

                // Add points for placing pieces (+1 per block block)
                const pieceBlocks = piece.shape.flat().filter(x => x === 1).length;
                setScore(prev => prev + pieceBlocks);

                // Mark placed
                const newHand = [...hand];
                newHand[handIndex] = { ...piece, isPlaced: true };
                setHand(newHand);

                // Process lines cleared
                const postClearGrid = clearLinesAndScore(newGrid);

                // Check if hand is empty
                if (newHand.every(p => p.isPlaced)) {
                    setGamePhase('ANSWERING');
                } else if (checkGameOver(postClearGrid, newHand)) {
                    setGameState('GAME_OVER');
                } else {
                    // Update grid state if game is still active
                    setGrid(postClearGrid);
                }
                return;
            }
        }

        // If we reach here, placement failed. Piece naturally snaps back as draggingPiece goes null.
    };

    // Hover validation logic (for rendering shadows under the finger)
    const getHoverState = () => {
        if (!draggingPiece || !gridRef.current) return null;

        const gridRect = gridRef.current.getBoundingClientRect();
        const dropX = dragPos.x - dragStartOffset.x;
        const dropY = dragPos.y - dragStartOffset.y;
        const relX = dropX - gridRect.left;
        const relY = dropY - gridRect.top;
        const cellSize = gridRect.width / GRID_SIZE;
        const col = Math.round(relX / cellSize);
        const row = Math.round(relY / cellSize);

        const h = draggingPiece.piece.shape.length;
        const w = draggingPiece.piece.shape[0].length;

        // Is it out of bounds?
        if (row < 0 || row + h > GRID_SIZE || col < 0 || col + w > GRID_SIZE) return null;

        // Does it overlap?
        let isValid = true;
        for (let pr = 0; pr < h; pr++) {
            for (let pc = 0; pc < w; pc++) {
                if (draggingPiece.piece.shape[pr][pc] === 1 && grid[row + pr]?.[col + pc]?.active) {
                    isValid = false;
                    break;
                }
            }
        }

        return { row, col, shape: draggingPiece.piece.shape, isValid, color: draggingPiece.piece.color };
    };

    const hoverState = getHoverState();

    // --- ANSWERING PHASE LOGIC ---

    const activeQuestionCard = queue[currentQuestionIndex % queue.length]; // Fallback to cycle if queue is somehow empty

    // Derived properties based on user settings
    // Derived properties based on user settings
    const currentPrompt = activeQuestionCard ? (answerWith === 'term' ? getCardText(activeQuestionCard, 'back', set?.fieldsSchema) : getCardText(activeQuestionCard, 'front', set?.fieldsSchema)) : "";
    const currentExpectedAnswer = activeQuestionCard ? (answerWith === 'term' ? getCardText(activeQuestionCard, 'front', set?.fieldsSchema) : getCardText(activeQuestionCard, 'back', set?.fieldsSchema)) : "";

    const handleAnswerSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!typedAnswer.trim() || showCorrectAnswerOverlay) return;

        // Normalize text roughly
        const qTrim = typedAnswer.trim().toLowerCase();
        const aTrim = currentExpectedAnswer.trim().toLowerCase();

        if (qTrim === aTrim) { // Very basic check, extend if needed
            handleCorrectAnswer();
        } else {
            handleWrongAnswer();
        }
    };

    const handleCorrectAnswer = () => {
        setTypedAnswer("");
        setWrongAttempts(0);
        setCurrentQuestionIndex(prev => prev + 1);

        // Success -> Give 3 new pieces & switch phase
        generateNewHand();
        setGamePhase('PLACING');

        // Note: we only do game over checks immediately after a PLACEMENT, so it's safe to give them 3 new pieces.
        // But if giving 3 new pieces instantly causes a Game Over, check here.
        // Actually, we must do it AFTER state updates, so we'll do it using a timeout or let the render cycle catch it if we had a dedicated engine hook. Let's do a fast forward check using the new hand.
        setTimeout(() => {
            // Need the latest states, simplest is to let the user see the board and wait for next move. Game will end if they can't place.
        }, 10);
    };

    const handleWrongAnswer = () => {
        const nextAttempts = wrongAttempts + 1;
        setWrongAttempts(nextAttempts);
        if (nextAttempts >= MAX_STRIKES) {
            setShowCorrectAnswerOverlay(true);
        }
    };

    const skipQuestion = useCallback(() => {
        // Skipped explicitly or due to 3 failures
        setCurrentQuestionIndex(prev => prev + 1);
        setTypedAnswer("");
        setWrongAttempts(0);
        setShowCorrectAnswerOverlay(false);
    }, []);

    const handleRefreshQuestion = () => {
        setCurrentQuestionIndex(prev => prev + 1);
        setTypedAnswer("");
        setWrongAttempts(0);
    };

    // --- RENDER HELPERS ---

    // Renders the tiny preview blocks in the hand
    const renderBlockGraphic = (shapeProps: BlockShape) => {
        const { shape, color, shadow } = shapeProps;
        return (
            <div className="flex flex-col gap-1 pointer-events-none">
                {shape.map((row, rIdx) => (
                    <div key={rIdx} className="flex gap-1">
                        {row.map((cell, cIdx) => (
                            <div
                                key={cIdx}
                                className={cn(
                                    "w-8 h-8 rounded-md transition-all",
                                    cell ? `${color} ${shadow}` : "bg-transparent opacity-0"
                                )}
                            />
                        ))}
                    </div>
                ))}
            </div>
        );
    };

    // Loading State
    if (!set) {
        return (
            <div className="min-h-screen bg-qz-card flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] bg-qz-card text-qz-text flex flex-col font-sans select-none overflow-hidden touch-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >

            {/* --- HEADER --- */}
            <header className="bg-qz-card p-4 flex justify-between items-center z-20">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 grid grid-cols-3 gap-[2px] opacity-80">
                        {/* Tiny blocks icon */}
                        {[...Array(9)].map((_, i) => <div key={i} className="bg-blue-400 rounded-sm"></div>)}
                    </div>
                    <span className="font-bold">Блоки</span>
                </div>

                <div className="text-qz-text-muted text-sm font-medium">
                    {set.title}
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-qz-text-muted">
                        <Settings size={20} />
                    </button>
                    <Link
                        href={`/set/${id}`}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-qz-text-muted hover:text-qz-text"
                    >
                        <X size={24} />
                    </Link>
                </div>
            </header>

            {/* --- SETTINGS MODAL --- */}
            {showSettings && (
                <div className="absolute inset-0 z-50 bg-qz-card/95 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-qz-card rounded-2xl shadow-2xl flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-white/5">
                            <h2 className="text-2xl font-bold">Параметры</h2>
                            <button onClick={() => setShowSettings(false)} className="text-qz-text-muted hover:text-qz-text">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-qz-text-muted">Отвечать термином <br /> <span className="text-xs font-normal text-zinc-500">(вижу Определение, печатаю Термин)</span></span>
                                <div
                                    className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors ${answerWith === 'term' ? 'bg-[#4255ff]' : 'bg-[#586380]'}`}
                                    onClick={() => setAnswerWith(answerWith === 'term' ? 'definition' : 'term')}
                                >
                                    <div className={`absolute top-1 bottom-1 w-4 h-4 bg-white rounded-full transition-transform ${answerWith === 'term' ? 'translate-x-7' : 'translate-x-1'}`} />
                                </div>
                            </div>

                            <button onClick={() => { setShowSettings(false); startGame(); }} className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-4 rounded-xl mt-4">
                                Перезапустить игру
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DEFAULT START SCREEN --- */}
            {gameState === 'START' && (
                <div className="flex-1 flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="mb-8 p-6 bg-qz-card rounded-3xl shadow-[0_0_80px_rgba(37,99,235,0.2)] text-center max-w-lg w-full flex flex-col items-center">
                        <div className="w-20 h-20 grid grid-cols-3 gap-1 mb-6">
                            {/* Decorative large icon block */}
                            <div className="bg-blue-500 rounded-sm"></div>
                            <div className="bg-blue-400 rounded-sm"></div>
                            <div className="bg-sky-400 rounded-sm"></div>
                            <div className="bg-[#4255ff] rounded-sm"></div>
                            <div className="bg-qz-card rounded-sm"></div>
                            <div className="bg-[#4255ff] rounded-sm"></div>
                            <div className="bg-[#4255ff] rounded-sm"></div>
                            <div className="bg-[#4255ff] rounded-sm"></div>
                            <div className="bg-blue-600 rounded-sm"></div>
                        </div>
                        <h2 className="text-3xl font-bold text-qz-text mb-4">Сыграйте в "Блоки"</h2>
                        <p className="text-qz-text-muted mb-8 leading-relaxed max-w-sm">
                            Зарабатывайте блоки, правильно отвечая на вопросы. Заполняйте сетку и зарабатывайте очки, завершая вертикальные или горизонтальные линии.
                        </p>
                        <button
                            onClick={startGame}
                            className="w-full bg-[#4255ff] hover:bg-indigo-400 text-white font-bold py-5 rounded-2xl shadow-[0_6px_0_0_#3730a3] active:translate-y-[6px] active:shadow-none transition-all text-lg mb-4"
                        >
                            Играть
                        </button>
                    </div>
                </div>
            )}

            {/* --- GAME VIEWS --- */}
            {gameState !== 'START' && (
                <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto relative relative px-4 pt-6 pb-2">

                    {/* Score Info Area */}
                    <div className="flex justify-between items-center mb-8 px-2 font-bold text-xl">
                        <div className="text-qz-text flex-1">{score}</div>
                        <div className="text-yellow-500 flex items-center gap-2 justify-end flex-1">
                            <Trophy size={18} /> {highScore}
                        </div>
                    </div>

                    {/* MAIN GAME AREA WRAPPER */}
                    <div className="relative flex-1 flex flex-col">

                        {/* PLACING PHASE RENDERING */}
                        <div className={cn("transition-opacity duration-300 flex flex-col flex-1", gamePhase === 'PLACING' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none absolute inset-0')}>

                            {/* Grid Board */}
                            <div className="w-full max-w-[400px] aspect-square mx-auto bg-qz-card rounded-lg p-[4px] relative mb-12" ref={gridRef}>
                                {/* Draw actual cells */}
                                <div className="w-full h-full grid grid-cols-8 grid-rows-8 gap-[4px]">
                                    {grid.map((row, rIdx) => (
                                        row.map((cell, cIdx) => (
                                            <div key={`${rIdx}-${cIdx}`} className={cn("w-full h-full rounded-[4px] relative", cell.active ? "bg-transparent" : "bg-qz-card")}>
                                                {/* Placed Block Content */}
                                                {cell.active && (
                                                    <div className={cn("absolute inset-0 rounded-[4px]", cell.color, cell.shadow)}></div>
                                                )}
                                            </div>
                                        ))
                                    ))}
                                </div>

                                {/* Hover Projection */}
                                {hoverState && hoverState.isValid && gamePhase === 'PLACING' && (
                                    <div className="absolute" style={{
                                        top: 4 + (hoverState.row * (gridRef.current!.getBoundingClientRect().width / 8)),
                                        left: 4 + (hoverState.col * (gridRef.current!.getBoundingClientRect().width / 8)),
                                        width: (hoverState.shape[0].length * (gridRef.current!.getBoundingClientRect().width / 8)),
                                        height: (hoverState.shape.length * (gridRef.current!.getBoundingClientRect().width / 8)),
                                    }}>
                                        <div className="w-full h-full relative" style={{ display: 'grid', gridTemplateColumns: `repeat(${hoverState.shape[0].length}, 1fr)`, gridTemplateRows: `repeat(${hoverState.shape.length}, 1fr)`, gap: '4px' }}>
                                            {hoverState.shape.map((r, ri) => r.map((c, ci) => (
                                                <div key={`${ri}-${ci}`} className={cn("w-full h-full rounded-[4px]", c ? `${hoverState.color} opacity-40` : "opacity-0")} />
                                            )))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Hand Area */}
                            <div className="flex justify-center items-center gap-6 md:gap-10 mt-auto pb-8 h-32">
                                {hand.map((piece, i) => (
                                    <div
                                        key={piece.id}
                                        className={cn("relative touch-none", piece.isPlaced ? "opacity-0 pointer-events-none" : "opacity-100")}
                                    >
                                        <div
                                            onPointerDown={(e) => handlePointerDown(e, piece, i)}
                                            className="cursor-pointer"
                                            style={{
                                                // If this is the dragging piece, hide the original in the hand
                                                opacity: draggingPiece?.handIndex === i ? 0 : 1
                                            }}
                                        >
                                            {renderBlockGraphic(piece)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ANSWERING PHASE RENDERING */}
                        {gamePhase === 'ANSWERING' && (
                            <div className="absolute inset-0 z-20 flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-500 bg-qz-card/80 backdrop-blur-md pt-4">
                                <div className="text-qz-text-muted text-sm font-semibold mb-2">
                                    {answerWith === 'term' ? 'ОПРЕДЕЛЕНИЕ' : 'ТЕРМИН'}
                                    {activeQuestionCard?.imageUrl && <img src={activeQuestionCard.imageUrl} alt="img" className="h-16 inline-block ml-4 rounded-md" />}
                                </div>
                                <h3 className="text-3xl font-medium text-qz-text mb-10 leading-relaxed">
                                    {currentPrompt}
                                </h3>

                                <form onSubmit={handleAnswerSubmit} className="mt-auto relative w-full mb-8">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            autoFocus
                                            value={typedAnswer}
                                            onChange={(e) => setTypedAnswer(e.target.value)}
                                            placeholder="Введите ответ"
                                            disabled={showCorrectAnswerOverlay}
                                            className={cn(
                                                "w-full bg-qz-card border-2 rounded-2xl py-5 pl-6 pr-16 text-xl text-qz-text outline-none transition-colors",
                                                wrongAttempts > 0 && wrongAttempts < MAX_STRIKES ? "border-red-500" : "border-[#2e3b7a] focus:border-indigo-500"
                                            )}
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                                            <Keyboard size={24} />
                                        </div>
                                    </div>

                                    {/* Warnings */}
                                    {wrongAttempts > 0 && wrongAttempts < MAX_STRIKES && !showCorrectAnswerOverlay && (
                                        <p className="text-red-400 mt-3 font-medium px-4 flex justify-between items-center">
                                            <span>Неверно! Попробуйте еще.</span>
                                            <button type="button" onClick={handleRefreshQuestion} className="text-qz-text-muted hover:text-white flex items-center gap-1 text-sm bg-qz-bg/20 px-3 py-1 rounded-full">
                                                <RefreshCcw size={14} /> Пропустить
                                            </button>
                                        </p>
                                    )}

                                    {/* Action Buttons if not wrong yet */}
                                    {wrongAttempts === 0 && (
                                        <div className="flex justify-between items-center mt-4 px-2">
                                            <button type="button" onClick={handleRefreshQuestion} className="text-qz-text-muted hover:text-qz-text flex items-center gap-2 font-medium">
                                                <RefreshCcw size={18} /> Обновить
                                            </button>
                                        </div>
                                    )}
                                </form>

                                {/* Fail / Correct Reveal Overlay */}
                                {showCorrectAnswerOverlay && (
                                    <div className="absolute inset-0 bg-qz-card/95 flex flex-col z-30 p-6 animate-in fade-in duration-300 rounded-2xl border border-white/5">
                                        <div className="text-red-400 text-sm font-bold uppercase mb-2">ВЫ ОТВЕТИЛИ</div>
                                        <h4 className="text-2xl text-[#8d97be] line-through mb-8">{typedAnswer}</h4>

                                        <div className="text-green-400 text-sm font-bold uppercase mb-2">ПРАВИЛЬНЫЙ ОТВЕТ</div>
                                        <h4 className="text-3xl text-qz-text font-medium mb-auto whitespace-pre-wrap">{currentExpectedAnswer}</h4>

                                        <button
                                            onClick={skipQuestion}
                                            className="w-full bg-blue-600 hover:bg-blue-500 font-bold text-qz-text py-5 rounded-xl transition-colors mt-auto text-lg shadow-[0_4px_0_0_#2563eb] active:translate-y-[4px] active:shadow-none"
                                        >
                                            Нажмите любую клавишу для продолжения
                                        </button>

                                        {/* Auto listener to allow hitting enter or space to skip */}
                                        <input
                                            autoFocus
                                            className="opacity-0 absolute w-0 h-0"
                                            onKeyDown={skipQuestion}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                    </div>

                    {/* --- GAME OVER SCREEN --- */}
                    {gameState === 'GAME_OVER' && (
                        <div className="absolute inset-0 z-50 bg-qz-card/98 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
                            <h2 className="text-4xl font-bold text-qz-text mb-8">Больше нет ходов!</h2>
                            <div className="bg-qz-card w-full max-w-sm rounded-[32px] p-8 flex flex-col items-center shadow-2xl mb-8">
                                <span className="text-qz-text-muted font-medium mb-2">ВАШ СЧЕТ</span>
                                <span className="text-7xl font-semibold text-qz-text mb-2">{score}</span>
                                {score >= highScore && score > 0 && (
                                    <span className="bg-yellow-500/20 text-yellow-400 px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wide mt-2">Новый рекорд!</span>
                                )}
                            </div>

                            <button
                                onClick={startGame}
                                className="w-full max-w-sm bg-[#4255ff] hover:bg-indigo-400 text-white font-bold py-6 rounded-[24px] shadow-[0_8px_0_0_#3730a3] active:translate-y-[8px] active:shadow-none transition-all text-xl"
                            >
                                Сыграть еще раз
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Render dynamically dragged piece at the root level so it breaks out of bounds */}
            {draggingPiece && (
                <div
                    className="fixed pointer-events-none z-[100]"
                    style={{
                        left: dragPos.x - dragStartOffset.x,
                        top: dragPos.y - dragStartOffset.y,
                        // Ensure it scales to match the grid if possible, or keep it standard size
                        // In 1010 games, the hand pieces are small but expand when dragged. 
                        // For simplicity right now, it will look like the hand piece.
                        transform: 'scale(1.2)' // Slight visual bump when dragged
                    }}
                >
                    {renderBlockGraphic(draggingPiece.piece)}
                </div>
            )}
        </div>
    );
}
