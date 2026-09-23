'use client';
// Оверлей праздника: конфетти на canvas (без библиотек), карточка «уровень
// вырос» / «достижение открыто» / «дневная цель выполнена», короткий звук,
// синтезированный WebAudio (lib/game/sound.ts). Слушает lib/game/celebrationBus —
// любой тренажёр зовёт celebrate(update), а очередь тут сама решает, что и
// когда показать. Монтируется один раз в layout панели.
//
// Тон — «отметили и идём дальше»: карточка сверху, сама уходит через
// несколько секунд, ничего не блокирует. Для взрослых не должно быть
// навязчиво, для детей — ощутимо, но без фанфар на каждый ответ (праздник
// только за уровень, достижение и выполненную цель дня).

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Sparkles, Target } from 'lucide-react';
import { onCelebration, type CelebrationEvent } from '@/lib/game/celebrationBus';
import { playChime } from '@/lib/game/sound';
import { SoundToggle } from './SoundToggle';

interface Particle {
  x: number; y: number; vx: number; vy: number; rot: number; vr: number;
  color: string; size: number; life: number;
}

const CONFETTI_COLORS = ['#4255ff', '#ffcd1f', '#10b981', '#f472b6', '#f59e0b'];

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Лёгкий конфетти-взрыв на canvas поверх страницы — без сторонних пакетов. */
function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback(function step() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) { rafRef.current = null; return; }
    if (canvas.width !== window.innerWidth) canvas.width = window.innerWidth;
    if (canvas.height !== window.innerHeight) canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const alive: Particle[] = [];
    for (const p of particlesRef.current) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // гравитация
      p.rot += p.vr;
      p.life -= 0.008;
      if (p.life > 0 && p.y < canvas.height + 30) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, p.life * 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
        alive.push(p);
      }
    }
    particlesRef.current = alive;

    if (alive.length > 0) {
      rafRef.current = requestAnimationFrame(step);
    } else {
      rafRef.current = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const burst = useCallback((count: number) => {
    // Движение по экрану отключено в системе — конфетти не сыплем, карточки хватит.
    if (!canvasRef.current || prefersReducedMotion()) return;
    const w = window.innerWidth;
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: w / 2 + (Math.random() - 0.5) * Math.min(w, 400),
        y: -20,
        vx: (Math.random() - 0.5) * 6,
        vy: 2 + Math.random() * 3,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 5 + Math.random() * 5,
        life: 1,
      });
    }
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  return { canvasRef, burst };
}

interface CardInfo {
  key: number;
  kind: CelebrationEvent['kind'];
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: string;
}

function toCard(event: CelebrationEvent, key: number): CardInfo {
  if (event.kind === 'levelUp') {
    return {
      key,
      kind: event.kind,
      icon: <Sparkles className="w-6 h-6" />,
      title: `Уровень ${event.level}`,
      subtitle: 'Новый уровень — опыт копится не зря',
      accent: 'from-[#4255ff] to-indigo-500',
    };
  }
  if (event.kind === 'achievement') {
    return {
      key,
      kind: event.kind,
      icon: <span className="text-2xl leading-none">{event.achievement.emoji}</span>,
      title: event.achievement.title,
      subtitle: event.achievement.description,
      accent: 'from-amber-600 to-amber-500',
    };
  }
  return {
    key,
    kind: event.kind,
    icon: <Target className="w-6 h-6" />,
    title: 'Цель дня выполнена',
    subtitle: 'На сегодня план закрыт — всё дальше сверху',
    accent: 'from-emerald-600 to-teal-500',
  };
}

const SHOW_MS: Record<CelebrationEvent['kind'], number> = {
  levelUp: 4000,
  achievement: 3600,
  dailyGoal: 3000,
};

export function CelebrationOverlay() {
  const [current, setCurrent] = useState<CardInfo | null>(null);
  // Очередь и таймер — в ref'ах, а не в состоянии: всё переключение идёт из
  // колбэков (событие шины, таймер, клик «закрыть»), без эффектов, которые
  // перезапускались бы на каждое изменение очереди и сбрасывали таймер.
  const queueRef = useRef<CelebrationEvent[]>([]);
  const showingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);
  const { canvasRef, burst } = useConfetti();

  const showNext = useCallback(function next() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const event = queueRef.current.shift();
    if (!event) {
      showingRef.current = false;
      setCurrent(null);
      return;
    }
    showingRef.current = true;
    keyRef.current += 1;
    setCurrent(toCard(event, keyRef.current));
    burst(event.kind === 'levelUp' ? 120 : event.kind === 'achievement' ? 70 : 50);
    playChime(event.kind);
    timerRef.current = setTimeout(next, SHOW_MS[event.kind]);
  }, [burst]);

  useEffect(() => {
    const unsubscribe = onCelebration(event => {
      queueRef.current.push(event);
      // Одна карточка за раз: уровень+достижение+цель разом не должны
      // накладываться друг на друга нечитаемой кашей.
      if (!showingRef.current) showNext();
    });
    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showNext]);

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[90]" aria-hidden="true" />

      {current && (
        <div className="fixed inset-x-0 top-4 sm:top-6 z-[95] flex justify-center px-4 pointer-events-none">
          <div
            key={current.key}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto flex items-center gap-3 max-w-md w-full sm:w-auto rounded-2xl px-4 py-3 shadow-2xl text-white bg-gradient-to-r ${current.accent} motion-safe:animate-[celebration-in_0.25s_ease-out]`}
          >
            <span className="shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">{current.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm leading-tight">{current.title}</p>
              <p className="text-xs text-white/90 leading-snug">{current.subtitle}</p>
            </div>
            <SoundToggle className="shrink-0 opacity-80 hover:opacity-100 transition-opacity" />
            <button
              type="button"
              onClick={showNext}
              aria-label="Закрыть"
              className="shrink-0 opacity-80 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes celebration-in {
          from { opacity: 0; transform: translateY(-12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
