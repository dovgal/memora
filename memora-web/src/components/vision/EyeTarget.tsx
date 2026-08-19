'use client';
// Движущаяся цель, за которой ребёнок ведёт взглядом. Траектория рисуется
// как SVG-путь, а «светлячок» едет по нему через SMIL-анимацию
// (animateMotion) — она идёт вне основного потока JS, поэтому движение
// остаётся плавным даже когда рядом тикает таймер.

import type { Path } from '@/data/vision/exercises';

const W = 520, H = 300;

/** Пути траекторий в координатах 520×300. */
const PATHS: Record<Path, string> = {
  horizontal: `M 40 ${H / 2} L ${W - 40} ${H / 2}`,
  vertical: `M ${W / 2} 30 L ${W / 2} ${H - 30}`,
  diagonal1: `M 50 ${H - 40} L ${W - 50} 40`,
  diagonal2: `M ${W - 50} ${H - 40} L 50 40`,
  circle: `M ${W / 2} 40 A 110 110 0 1 1 ${W / 2 - 0.1} 40`,
  infinity: `M ${W / 2} ${H / 2} C ${W / 2 - 40} ${H / 2 - 90}, 60 ${H / 2 - 90}, 60 ${H / 2}
             S ${W / 2 - 40} ${H / 2 + 90}, ${W / 2} ${H / 2}
             S ${W / 2 + 40} ${H / 2 - 90}, ${W - 60} ${H / 2}
             S ${W / 2 + 40} ${H / 2 + 90}, ${W / 2} ${H / 2}`,
  zigzag: `M 40 60 L 160 ${H - 60} L 280 60 L 400 ${H - 60} L ${W - 40} 60`,
  spiral: `M ${W / 2} ${H / 2} m 0 -20 a 20 20 0 1 1 -1 0 m 1 -25 a 45 45 0 1 1 -1 0 m 1 -25 a 70 70 0 1 1 -1 0`,
  nearFar: `M ${W / 2} ${H - 50} L ${W / 2} 50`,
};

export function EyeTarget({ path, speed = 4, running }: {
  path: Path;
  /** Секунд на один проход траектории. */
  speed?: number;
  running: boolean;
}) {
  const d = PATHS[path] ?? PATHS.horizontal;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl mx-auto select-none" role="img"
      aria-label="Цель для слежения глазами">
      <defs>
        <radialGradient id="glow">
          <stop offset="0%" stopColor="#fff8d6" />
          <stop offset="55%" stopColor="#ffd43b" />
          <stop offset="100%" stopColor="#f59f00" />
        </radialGradient>
      </defs>

      {/* Подсказка-траектория: показываем пунктиром, чтобы ребёнок понимал маршрут */}
      <path d={d} fill="none" stroke="#4255ff" strokeOpacity="0.28" strokeWidth="3"
        strokeDasharray="8 10" strokeLinecap="round" />

      <g>
        <circle r="17" fill="url(#glow)" />
        <circle r="17" fill="none" stroke="#fff" strokeOpacity="0.9" strokeWidth="2" />
        <text y="6" textAnchor="middle" fontSize="16">⭐</text>
        {running && (
          <animateMotion dur={`${speed}s`} repeatCount="indefinite" rotate="auto"
            keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" path={d} />
        )}
      </g>
    </svg>
  );
}
