"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import { SetResponse, FlashcardResponse } from '@/types/schema';
import { X, Volume2, VolumeX, Trophy, Play, RotateCcw, Rocket } from 'lucide-react';
import Link from 'next/link';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getCardText } from '@/lib/studyUtils';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type Asteroid = {
    id: string;
    flashcardId: string;
    text: string;
    isTarget: boolean;
    x: number;
    y: number;
    speed: number;
    isShaking?: boolean;
    scale?: number;
    vx?: number;
    vy?: number;
};

export default function BlastModePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const router = useRouter();
    const { data: session } = useSession();

    const gameAreaRef = useRef<HTMLDivElement>(null);
    const shipRef = useRef<HTMLDivElement>(null);

    const [set, setSet] = useState<SetResponse | null>(null);
    const [gameState, setGameState] = useState<'start' | 'playing' | 'level_passed' | 'time_up' | 'game_over'>('start');

    // Core game state
    const [score, setScore] = useState(0);
    const [level, setLevel] = useState(1);
    const [timeLeft, setTimeLeft] = useState(60);
    const [streak, setStreak] = useState(0);

    // Game Entities
    const [asteroids, setAsteroids] = useState<Asteroid[]>([]);
    const [currentPrompt, setCurrentPrompt] = useState<FlashcardResponse | null>(null);

    // UI & Interactions
    const [shipAngle, setShipAngle] = useState(0);
    const [audioEnabled, setAudioEnabled] = useState(false);

    // Refs for animation loop
    const stateRef = useRef({
        gameState,
        asteroids,
        timeLeft,
        score,
        level,
        currentPrompt
    });

    // Audio Context and Synth
    const audioCtxRef = useRef<AudioContext | null>(null);

    const initAudio = useCallback(() => {
        if (!audioEnabled) return;
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
    }, [audioEnabled]);

    const playShootSound = useCallback(() => {
        if (!audioEnabled || !audioCtxRef.current) return;
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    }, [audioEnabled]);

    const playCorrectSound = useCallback(() => {
        if (!audioEnabled || !audioCtxRef.current) return;
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    }, [audioEnabled]);

    const playErrorSound = useCallback(() => {
        if (!audioEnabled || !audioCtxRef.current) return;
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);

        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    }, [audioEnabled]);

    // Sync refs
    useEffect(() => {
        stateRef.current = { gameState, asteroids, timeLeft, score, level, currentPrompt };
    }, [gameState, asteroids, timeLeft, score, level, currentPrompt]);

    const animationFrameId = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const timerRef = useRef<number>(0);
    const targetCooldownRef = useRef<number>(0);

    const targetScore = level * 50;

    // Derived multiplier based on streak
    const currentMultiplier = useMemo(() => {
        if (streak < 3) return 1.0;
        if (streak < 6) return 1.2;
        if (streak < 9) return 1.4;
        if (streak < 12) return 1.6;
        if (streak < 15) return 1.8;
        return 2.0;
    }, [streak]);

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



    const pickNewPrompt = useCallback(() => {
        if (!set || set.flashcards.length === 0) return;
        const rc = set.flashcards[Math.floor(Math.random() * set.flashcards.length)];
        setCurrentPrompt(rc);
    }, [set]);

    const spawnAsteroid = useCallback((isTargetForce: boolean = false) => {
        if (!set || set.flashcards.length === 0) return;

        let targetCard: FlashcardResponse;
        let isTarget = false;

        if (isTargetForce && stateRef.current.currentPrompt) {
            targetCard = stateRef.current.currentPrompt;
            isTarget = true;
        } else {
            targetCard = set.flashcards[Math.floor(Math.random() * set.flashcards.length)];
            isTarget = stateRef.current.currentPrompt?.id === targetCard.id;
        }

        const baseSpeed = 0.3 + (stateRef.current.level * 0.1) + (Math.random() * 0.3);
        const scale = 0.8 + (Math.random() * 0.4);

        // Random angle roughly downwards
        const angle = (Math.random() * 120 + 30) * (Math.PI / 180); // 30 to 150 degrees
        const vx = Math.cos(angle) * baseSpeed;
        const vy = Math.sin(angle) * baseSpeed;

        const newAsteroid: Asteroid = {
            id: Math.random().toString(36).substr(2, 9),
            flashcardId: targetCard.id,
            text: getCardText(targetCard, 'back', set.fieldsSchema, false),
            isTarget,
            x: 10 + Math.random() * 80, // 10% to 90%
            y: -20, // start slightly above screen
            speed: baseSpeed,
            scale,
            vx,
            vy
        };

        setAsteroids(prev => [...prev, newAsteroid]);
    }, [set]);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (gameState !== 'playing' || !shipRef.current) return;

        const shipRect = shipRef.current.getBoundingClientRect();
        const shipCenterX = shipRect.left + shipRect.width / 2;
        const shipCenterY = shipRect.top + shipRect.height / 2;

        const dx = e.clientX - shipCenterX;
        const dy = e.clientY - shipCenterY;

        let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

        if (angle > 90 && angle < 180) angle = 90;
        if (angle < 270 && angle >= 180) angle = 270;

        setShipAngle(angle);
    };

    const handleAsteroidClick = (e: React.MouseEvent, ast: Asteroid) => {
        e.stopPropagation();
        if (gameState !== 'playing') return;

        initAudio(); // make sure audio is unlocked on first interaction
        playShootSound();

        if (ast.isTarget) {
            // Correct hit
            const points = Math.round(5 * currentMultiplier);
            setScore(prev => prev + points);
            setStreak(prev => prev + 1);

            playCorrectSound();

            // Set a random cooldown (1.5 to 4 seconds) before forcing a new target
            targetCooldownRef.current = performance.now() + 1500 + Math.random() * 2500;

            // Visual pop
            setAsteroids(prev => prev.filter(a => a.id !== ast.id));
            pickNewPrompt();
        } else {
            // Wrong hit
            setScore(prev => Math.max(0, prev - 2));
            setStreak(0);

            playErrorSound();

            // Shake effect
            setAsteroids(prev => prev.map(a => a.id === ast.id ? { ...a, isShaking: true } : a));
            setTimeout(() => {
                setAsteroids(prev => prev.map(a => a.id === ast.id ? { ...a, isShaking: false } : a));
            }, 500);
        }
    };

    const gameLoop = useCallback((timestamp: number) => {
        if (stateRef.current.gameState !== 'playing') {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            return;
        }

        if (!lastTimeRef.current) lastTimeRef.current = timestamp;
        const deltaTime = timestamp - lastTimeRef.current;

        // Seconds timer update
        timerRef.current += deltaTime;
        if (timerRef.current >= 1000) {
            timerRef.current = 0;
            setTimeLeft(prev => {
                const next = prev - 1;
                if (next <= 0) {
                    setGameState('time_up');
                }
                return next;
            });
        }

        lastTimeRef.current = timestamp;

        // Move asteroids
        setAsteroids(prev => {
            let nextAsteroids = prev.map(ast => {
                let nx = ast.x + (ast.vx || 0) * (deltaTime / 16);
                let ny = ast.y + (ast.vy || ast.speed) * (deltaTime / 16);
                let nvx = ast.vx !== undefined ? ast.vx : 0;
                let nvy = ast.vy !== undefined ? ast.vy : ast.speed;

                const radiusX = (ast.scale || 1) * 5; // Roughly 5% width radius
                const radiusY = (ast.scale || 1) * 8; // Roughly 8% height radius

                // Bounce off walls
                if (nx < radiusX) { nx = radiusX; nvx = Math.abs(nvx); }
                if (nx > 100 - radiusX) { nx = 100 - radiusX; nvx = -Math.abs(nvx); }

                // Bounce off ceiling (only if it entered the screen first, starting at -20)
                if (ny < radiusY && ast.y >= radiusY) { ny = radiusY; nvy = Math.abs(nvy); }
                // Bounce off floor (keep above the ship UI which is around bottom 15%)
                if (ny > 85 - radiusY) { ny = 85 - radiusY; nvy = -Math.abs(nvy); }

                return {
                    ...ast,
                    x: nx,
                    y: ny,
                    vx: nvx,
                    vy: nvy
                };
            });

            // Asteroid repelling logic (prevent overlap)
            for (let i = 0; i < nextAsteroids.length; i++) {
                for (let j = i + 1; j < nextAsteroids.length; j++) {
                    const a = nextAsteroids[i];
                    const b = nextAsteroids[j];

                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const distSq = dx * dx + dy * dy;

                    // Approximate minimum distance threshold
                    const minRad = ((a.scale || 1) * 7) + ((b.scale || 1) * 7);

                    if (distSq < minRad * minRad && distSq > 0.01) {
                        const dist = Math.sqrt(distSq);
                        const pushForce = 0.05; // Gentle velocity push

                        const nx = (dx / dist) * pushForce;
                        const ny = (dy / dist) * pushForce;

                        a.vx = (a.vx || 0) + nx;
                        a.vy = (a.vy || 0) + ny;
                        b.vx = (b.vx || 0) - nx;
                        b.vy = (b.vy || 0) - ny;

                        // Limit max speed
                        const maxSpeed = ((a.speed || 0.5) + (b.speed || 0.5)) / 2 * 1.5;
                        const speedA = Math.sqrt((a.vx) * a.vx + (a.vy) * a.vy);
                        if (speedA > maxSpeed) {
                            a.vx = (a.vx / speedA) * maxSpeed;
                            a.vy = (a.vy / speedA) * maxSpeed;
                        }
                        const speedB = Math.sqrt((b.vx) * b.vx + (b.vy) * b.vy);
                        if (speedB > maxSpeed) {
                            b.vx = (b.vx / speedB) * maxSpeed;
                            b.vy = (b.vy / speedB) * maxSpeed;
                        }

                        // Also slightly push positions apart to immediately resolve overlap visually
                        const overlap = minRad - dist;
                        const pushX = (dx / dist) * (overlap / 2);
                        const pushY = (dy / dist) * (overlap / 2);
                        a.x += pushX;
                        a.y += pushY;
                        b.x -= pushX;
                        b.y -= pushY;
                    }
                }
            }

            // Spawning Logic
            if (nextAsteroids.length < 4 + Math.floor(stateRef.current.level / 2)) {
                const hasTarget = nextAsteroids.some(a => a.isTarget);

                // Allow force spawn only if cooling down period has elapsed
                const canForceTarget = performance.now() > targetCooldownRef.current;
                const forceTarget = !hasTarget && canForceTarget && (Math.random() > 0.7 || nextAsteroids.length === 0);

                // Throttle spawn slightly visually
                if (Math.random() > 0.95 || forceTarget) {
                    spawnAsteroid(forceTarget);
                }
            }

            return nextAsteroids;
        });

        if (stateRef.current.gameState === 'playing') {
            animationFrameId.current = requestAnimationFrame(gameLoop);
        }
    }, [spawnAsteroid]);

    useEffect(() => {
        if (gameState === 'playing') {
            lastTimeRef.current = performance.now();
            animationFrameId.current = requestAnimationFrame(gameLoop);
        } else if (gameState === 'time_up') {
            setTimeout(() => {
                if (score >= targetScore) {
                    setGameState('level_passed');
                } else {
                    setGameState('game_over');
                }
            }, 1500);
        }

        return () => {
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        };
    }, [gameState, gameLoop, score, targetScore]);

    useEffect(() => {
        if (gameState === 'playing' && currentPrompt) {
            const hasTarget = asteroids.some(a => a.isTarget);
            const canForceTarget = performance.now() > targetCooldownRef.current;
            if (!hasTarget && asteroids.length > 0 && Math.random() > 0.9 && canForceTarget) {
                spawnAsteroid(true);
            }
        }
    }, [asteroids, currentPrompt, gameState, spawnAsteroid]);

    const startGame = (lvl: number = 1, sc: number = 0) => {
        setScore(sc);
        setLevel(lvl);
        setTimeLeft(60);
        setStreak(0);
        setAsteroids([]);
        setGameState('playing');
        timerRef.current = 0;
        pickNewPrompt();
    };

    if (!set) {
        return (
            <div className="min-h-screen bg-[#11112b] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen bg-[#11112b] text-qz-text flex flex-col relative overflow-hidden select-none font-sans"
            onMouseMove={handleMouseMove}
        >
            <header className="bg-[#1a1a3a] border-b border-qz-border-light p-4 flex justify-between items-center z-50">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-qz-text flex items-center gap-2">
                        <Rocket size={20} className="text-cyan-400" /> Blast
                    </h1>
                </div>

                <div className="flex items-center gap-6">
                    <button onClick={() => setAudioEnabled(!audioEnabled)} className="text-qz-text-muted hover:text-qz-text transition-colors p-2">
                        {audioEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
                    </button>
                    <button className="text-qz-text-muted hover:text-yellow-400 transition-colors p-2">
                        <Trophy size={22} />
                    </button>
                    <Link
                        href={`/set/${id}`}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-qz-text-muted hover:text-qz-text"
                    >
                        <X size={24} />
                    </Link>
                </div>
            </header>

            {gameState === 'playing' && currentPrompt && (
                <div className="w-full bg-[#1b1b8b]/80 backdrop-blur-md border-b-4 border-[#ff7a7a] p-4 text-center shadow-lg z-20">
                    <h2 className="text-3xl font-bold tracking-wide whitespace-pre-wrap">{getCardText(currentPrompt, 'front', set?.fieldsSchema, false)}</h2>
                </div>
            )}

            <main ref={gameAreaRef} className="flex-1 flex flex-col relative cursor-crosshair">

                {gameState === 'playing' && (
                    <div className="absolute top-10 left-0 right-0 flex justify-center w-full pointer-events-none opacity-20 z-0">
                        <span className="text-8xl font-semibold">{timeLeft}</span>
                    </div>
                )}

                <div className="absolute inset-0 bg-[#11112b] z-[-2]">
                    <div className="absolute w-[800px] h-[800px] rounded-full bg-blue-900/10 mix-blend-screen blur-[100px] -left-[200px] top-[100px]"></div>
                    <div className="absolute w-[600px] h-[600px] rounded-full bg-purple-900/10 mix-blend-screen blur-[100px] right-[100px] bottom-[100px]"></div>
                </div>

                {gameState === 'playing' && asteroids.map(ast => (
                    <div
                        key={ast.id}
                        onMouseDown={(e) => handleAsteroidClick(e, ast)}
                        className={cn(
                            "absolute flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 rounded-full cursor-crosshair transition-transform duration-100 shadow-[0_0_20px_rgba(79,70,229,0.4)]",
                            ast.isShaking && "animate-[shake_0.5s_cubic-bezier(.36,.07,.19,.97)_both]"
                        )}
                        style={{
                            left: `${ast.x}%`,
                            top: `${ast.y}%`,
                            width: `${180 * (ast.scale || 1)}px`,
                            height: `${180 * (ast.scale || 1)}px`,
                            backgroundColor: ast.isShaking ? 'rgba(239, 68, 68, 0.4)' : '#3f3f9f',
                            boxShadow: ast.isShaking ? '0 0 30px rgba(239, 68, 68, 0.8) inset' : 'inset 0 0 40px rgba(0,0,0,0.5)',
                            backgroundImage: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.1) 0%, transparent 60%)`
                        }}
                    >
                        <div className="absolute inset-0 w-full h-full rounded-full opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #2a2a7a 10%, transparent 20%), radial-gradient(circle, #272765 10%, transparent 20%)', backgroundSize: '40px 40px, 30px 30px', backgroundPosition: '0 0, 20px 20px' }}></div>

                        <span className="font-bold text-qz-text text-center px-4 leading-tight drop-shadow-md z-10 text-sm md:text-base pointer-events-none whitespace-pre-wrap">
                            {ast.text}
                        </span>
                    </div>
                ))}

                {(gameState === 'playing' || gameState === 'time_up') && (
                    <div
                        ref={shipRef}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full bg-[#3ae0ba] shadow-[0_0_40px_rgba(58,224,186,0.5),inset_0_-10px_20px_rgba(0,0,0,0.4)] flex items-center justify-center z-30 transition-transform duration-75 ease-out"
                        style={{ transform: `translateX(-50%) rotate(${shipAngle}deg)` }}
                    >
                        <div className="w-20 h-20 rounded-full bg-[#1b8bc2] flex items-center justify-center shadow-inner">
                            <span className="text-qz-text text-4xl font-bold font-mono">E</span>
                        </div>
                        <div className="absolute -top-4 w-4 h-8 bg-zinc-300 left-8 rounded-full shadow-md"></div>
                        <div className="absolute -top-4 w-4 h-8 bg-zinc-300 right-8 rounded-full shadow-md"></div>
                    </div>
                )}

                {(gameState === 'playing' || gameState === 'time_up') && (
                    <div className="absolute bottom-6 left-6 right-6 flex justify-between z-40 pointer-events-none">
                        <div className="flex flex-col gap-1 w-48">
                            <div className="flex justify-between font-bold">
                                <span className="text-[#f1f11e]">Уров. {level}</span>
                                <span className="text-qz-text">{score}/{targetScore}</span>
                            </div>
                            <div className="w-full h-2 bg-[#1a1a3a] rounded-full overflow-hidden border border-white/10">
                                <div
                                    className="h-full bg-[#f1f11e] transition-all duration-300"
                                    style={{ width: `${Math.min(100, (score / targetScore) * 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 w-48 items-end">
                            <div className="font-bold text-[#ffcd1f]">
                                Серия x{currentMultiplier.toFixed(1)}
                            </div>
                            <div className="w-full h-3 flex gap-1 justify-end">
                                {[...Array(12)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "flex-1 rounded-sm border border-purple-900/50 transition-colors duration-300",
                                            streak > i ? "bg-[#4255ff] shadow-[0_0_8px_rgba(168,85,247,0.8)]" : "bg-purple-900/30"
                                        )}
                                    ></div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {gameState === 'time_up' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                        <h2 className="text-6xl font-bold text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]">Время вышло!</h2>
                    </div>
                )}

                {gameState === 'start' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-[#11112b] backdrop-blur-sm">
                        <div className="w-24 h-24 mb-6 rounded-full bg-[#3ae0ba] flex items-center justify-center shadow-[0_0_40px_rgba(58,224,186,0.5)] animate-bounce">
                            <Rocket size={40} className="text-[#11112b]" />
                        </div>
                        <h2 className="text-4xl font-bold mb-4 text-[#f1f11e]">Уровень 1</h2>
                        <h3 className="text-2xl font-medium mb-12 text-qz-text-muted text-center">
                            Цель: {targetScore} очков <br /> <span className="text-lg opacity-70">Направляйте мышь на корабль и кликайте на правильные ответы.</span>
                        </h3>

                        <button
                            onClick={() => startGame(1, 0)}
                            className="w-full max-w-sm bg-blue-600 hover:bg-blue-500 text-qz-text font-bold py-5 px-8 rounded-full flex items-center justify-center gap-3 transition-transform hover:scale-105 shadow-xl"
                        >
                            Начать <Play fill="currentColor" size={20} />
                        </button>
                    </div>
                )}

                {gameState === 'level_passed' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-[#11112b]/95 backdrop-blur-md">
                        <h2 className="text-5xl font-bold mb-4 text-zinc-500">Уровень {level} завершен</h2>
                        <h3 className="text-3xl font-medium mb-12 text-qz-text-muted">Общий счет: <span className="text-qz-text font-semibold">{score}</span></h3>

                        <button
                            onClick={() => startGame(level + 1, score)}
                            className="bg-blue-600 hover:bg-blue-500 text-qz-text font-bold py-5 px-12 rounded-full transition-transform hover:scale-105 shadow-[0_0_30px_rgba(37,99,235,0.4)] text-lg"
                        >
                            Следующий уровень
                        </button>
                    </div>
                )}

                {gameState === 'game_over' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-[#11112b]/95 backdrop-blur-md">
                        <div className="mb-6">
                            <Trophy size={80} className="text-[#f1f11e] drop-shadow-[0_0_40px_rgba(241,241,30,0.6)] mx-auto" />
                        </div>
                        <h2 className="text-4xl font-bold mb-4 text-qz-text">Отличная игра!</h2>
                        <h3 className="text-2xl font-medium mb-12 text-qz-text-muted">Вот ваш итоговый результат</h3>

                        <div className="flex gap-4 mb-12 w-full max-w-xl">
                            <div className="flex-1 bg-[#0b335c] p-6 rounded-2xl flex flex-col items-center justify-center shadow-inner">
                                <span className="text-sm font-bold text-blue-300 mb-2">Ваш результат</span>
                                <span className="text-5xl font-semibold text-qz-text">{score}</span>
                            </div>
                            <div className="flex-1 bg-[#0b335c] p-6 rounded-2xl flex flex-col items-center justify-center shadow-inner">
                                <span className="text-sm font-bold text-blue-300 mb-2">Ваш уровень</span>
                                <span className="text-5xl font-semibold text-qz-text">{level}</span>
                            </div>
                        </div>

                        <div className="flex flex-col w-full max-w-[300px] gap-2 items-center">
                            <span className="text-sm font-bold text-qz-text mb-2">Следующие шаги</span>
                            <button
                                onClick={() => startGame(1, 0)}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-qz-text font-bold py-4 px-8 rounded-full flex items-center justify-center gap-3 transition-transform hover:scale-105 shadow-xl"
                            >
                                <RotateCcw size={20} /> Играть снова
                            </button>
                        </div>
                    </div>
                )}

            </main>

            <style jsx global>{`
                @keyframes shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0) translate(-50%, -50%); }
                    20%, 80% { transform: translate3d(2px, 0, 0) translate(-50%, -50%); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0) translate(-50%, -50%); }
                    40%, 60% { transform: translate3d(4px, 0, 0) translate(-50%, -50%); }
                }
            `}</style>
        </div>
    );
}
