'use client';
// Плеер алгоритма: показывает куб и проигрывает последовательность ходов
// с анимацией — по шагам или подряд. Текущий ход подсвечивается в нотации,
// поэтому видно связь «запись → движение».

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, SkipForward, RotateCcw, Repeat, Shuffle, Sparkles } from 'lucide-react';
import { Cube3D, type TurnAnim } from './Cube3D';
import {
  applyMove, applySequence, layerOf, parseMoves, solvedCube, scramble as makeScramble,
  affectedPositions, affectedFaces, FACE_AXIS, FACE_RU, type CubeState, type Move,
} from '@/lib/cube/model';

const SPEEDS = [
  { label: 'медленно', ms: 900 },
  { label: 'обычно', ms: 480 },
  { label: 'быстро', ms: 240 },
];

export function AlgorithmPlayer({ algorithm, setup = '', title, loop = false, allowScramble = false }: {
  /** Последовательность в нотации: "R U R' U'". */
  algorithm: string;
  /** Что сделать с собранным кубом ДО показа — чтобы алгоритм было видно на деле. */
  setup?: string;
  title?: string;
  loop?: boolean;
  allowScramble?: boolean;
}) {
  // Мемоизация обязательна: без неё массив пересоздаётся каждый рендер
  // и эффект автопроигрывания перезапускается бесконечно.
  const moves = useMemo(() => parseMoves(algorithm), [algorithm]);
  const start = useCallback(() => applySequence(solvedCube(), setup), [setup]);

  const [state, setState] = useState<CubeState>(start);
  const [idx, setIdx] = useState(0);            // сколько ходов уже сделано
  const [playing, setPlaying] = useState(false);
  const [turn, setTurn] = useState<TurnAnim | null>(null);
  const [speed, setSpeed] = useState(1);
  const [rot, setRot] = useState({ x: -24, y: -32 });
  // Подсветка зоны действия: какие детали алгоритм тронет. Включена до старта,
  // чтобы сначала увидеть «что изменится», а потом уже смотреть само движение.
  const [showZone, setShowZone] = useState(true);
  const busy = useRef(false);

  const ms = SPEEDS[speed].ms;

  // Считаем от исходного положения — зона одна и та же на всём проигрывании.
  const zone = useMemo(() => affectedPositions(start(), algorithm), [start, algorithm]);
  const faces = useMemo(() => affectedFaces(start(), algorithm), [start, algorithm]);

  const reset = useCallback(() => {
    setPlaying(false); setTurn(null); busy.current = false;
    setIdx(0); setState(start());
  }, [start]);

  /** Проиграть один ход с анимацией и зафиксировать результат. */
  const stepOnce = useCallback((mv: Move) => {
    if (busy.current) return;
    busy.current = true;
    const inLayer = layerOf(mv.face);
    const { axis, sign } = FACE_AXIS[mv.face];
    const deg = (mv.turns === 2 ? 180 : 90) * (mv.turns === -1 ? -sign : sign);

    setTurn({ inLayer, axis, angle: 0, ms: 0 });
    // Кадр на применение нулевого угла, затем — сам поворот.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTurn({ inLayer, axis, angle: deg, ms }));
    });
    window.setTimeout(() => {
      setState(s => applyMove(s, mv));
      setTurn(null);
      setIdx(i => i + 1);
      busy.current = false;
    }, ms + 30);
  }, [ms]);

  const next = useCallback(() => {
    if (idx >= moves.length) {
      if (!loop) return;
      reset();
      return;
    }
    stepOnce(moves[idx]);
  }, [idx, moves, stepOnce, loop, reset]);

  // Автопроигрывание.
  useEffect(() => {
    if (!playing) return;
    if (idx >= moves.length) {
      // Дошли до конца: без повтора просто останавливаемся — кнопка сама
      // переключится на «Сначала», менять состояние из эффекта не нужно.
      if (!loop) return;
      const t = window.setTimeout(reset, 700);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => stepOnce(moves[idx]), 60);
    return () => window.clearTimeout(t);
  }, [playing, idx, moves, stepOnce, loop, reset]);

  const done = idx >= moves.length;

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-5">
      {title && <p className="font-bold text-foreground mb-3">{title}</p>}

      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="shrink-0">
          <Cube3D state={state} rotX={rot.x} rotY={rot.y} turn={turn} scale={0.9}
            highlight={showZone ? zone : null} />
          <div className="flex justify-center gap-1 mt-2">
            <button onClick={() => setRot(r => ({ ...r, y: r.y - 45 }))}
              className="px-2 py-1 text-xs border border-border rounded-lg text-qz-text-muted hover:text-foreground">◀ повернуть</button>
            <button onClick={() => setRot(r => ({ ...r, y: r.y + 45 }))}
              className="px-2 py-1 text-xs border border-border rounded-lg text-qz-text-muted hover:text-foreground">повернуть ▶</button>
          </div>
        </div>

        <div className="flex-1 min-w-0 w-full">
          {/* Нотация с подсветкой текущего хода */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {moves.map((m, i) => (
              <span
                key={i}
                className={`px-2.5 py-1.5 rounded-lg font-mono text-sm font-bold transition-colors ${
                  i < idx ? 'bg-emerald-500/15 text-emerald-500'
                    : i === idx ? 'bg-[#4255ff] text-white'
                    : 'bg-muted text-qz-text-muted'}`}
              >
                {m.notation}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => (done ? reset() : setPlaying(p => !p))}
              className="inline-flex items-center gap-1.5 bg-[#4255ff] hover:bg-[#3144e0] text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
            >
              {done ? <><RotateCcw className="w-4 h-4" /> Сначала</>
                : playing ? <><Pause className="w-4 h-4" /> Пауза</>
                : <><Play className="w-4 h-4" /> Показать</>}
            </button>
            <button
              onClick={() => { setPlaying(false); next(); }}
              disabled={done}
              className="inline-flex items-center gap-1.5 border border-border text-foreground text-sm font-semibold px-3 py-2 rounded-xl disabled:opacity-40"
            >
              <SkipForward className="w-4 h-4" /> Шаг
            </button>
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 border border-border text-qz-text-muted hover:text-foreground text-sm font-semibold px-3 py-2 rounded-xl"
            >
              <Repeat className="w-4 h-4" /> Заново
            </button>
            {allowScramble && (
              <button
                onClick={() => { setPlaying(false); setIdx(0); setState(applySequence(solvedCube(), makeScramble(20))); }}
                className="inline-flex items-center gap-1.5 border border-border text-qz-text-muted hover:text-foreground text-sm font-semibold px-3 py-2 rounded-xl"
              >
                <Shuffle className="w-4 h-4" /> Перемешать
              </button>
            )}
            <button
              onClick={() => setShowZone(v => !v)}
              title="Подсветить детали, которые изменит алгоритм"
              className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl transition-colors border ${
                showZone ? 'border-[#4255ff] text-[#4255ff] bg-[#4255ff]/10' : 'border-border text-qz-text-muted hover:text-foreground'}`}
            >
              <Sparkles className="w-4 h-4" /> Что изменится
            </button>
            <select
              value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none"
            >
              {SPEEDS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
            </select>
          </div>

          <p className="text-qz-text-muted text-xs mt-3">
            Ход {Math.min(idx + (done ? 0 : 1), moves.length)} из {moves.length}
            {setup && ' · куб заранее приведён в нужное положение'}
          </p>
          {showZone && (
            <p className="text-xs mt-2 text-[#4255ff]">
              Синим обведены {zone.size} детал{zone.size % 10 === 1 && zone.size !== 11 ? 'ь' : zone.size % 10 >= 2 && zone.size % 10 <= 4 && (zone.size < 12 || zone.size > 14) ? 'и' : 'ей'},
              которые изменятся. Затронутые грани: {faces.map(f => FACE_RU[f]).join(', ')}.
              Остальное останется на месте.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
