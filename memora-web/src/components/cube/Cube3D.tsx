'use client';
// Трёхмерный кубик на CSS-трансформациях. Каждый кубик — коробка из шести
// граней; поворот слоя анимируется поворотом ГРУППЫ кубиков вокруг оси —
// то же движение, что и рукой, поэтому глазу понятно, что именно повернулось.

import { useMemo } from 'react';
import type { Axis, CubeState, Cubie, Face } from '@/lib/cube/model';

const SIZE = 46;      // ребро кубика, px
const GAP = 2;        // зазор между кубиками
const STEP = SIZE + GAP;

const FACE_TRANSFORM: Record<Face, string> = {
  F: `translateZ(${SIZE / 2}px)`,
  B: `rotateY(180deg) translateZ(${SIZE / 2}px)`,
  R: `rotateY(90deg) translateZ(${SIZE / 2}px)`,
  L: `rotateY(-90deg) translateZ(${SIZE / 2}px)`,
  U: `rotateX(90deg) translateZ(${SIZE / 2}px)`,
  D: `rotateX(-90deg) translateZ(${SIZE / 2}px)`,
};

function CubieBox({ c }: { c: Cubie }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: SIZE, height: SIZE,
        transformStyle: 'preserve-3d',
        transform: `translate3d(${c.x * STEP}px, ${-c.y * STEP}px, ${c.z * STEP}px)`,
        left: '50%', top: '50%',
        marginLeft: -SIZE / 2, marginTop: -SIZE / 2,
      }}
    >
      {(Object.keys(FACE_TRANSFORM) as Face[]).map(f => (
        <div
          key={f}
          style={{
            position: 'absolute',
            width: SIZE, height: SIZE,
            transform: FACE_TRANSFORM[f],
            background: c.colors[f] ?? '#15161a',
            border: '2px solid #0b0c0f',
            borderRadius: 8,
            boxShadow: c.colors[f] ? 'inset 0 0 12px rgba(0,0,0,.25)' : undefined,
            backfaceVisibility: 'hidden',
          }}
        />
      ))}
    </div>
  );
}

export interface TurnAnim {
  /** Какие кубики крутятся. */
  inLayer: (c: Cubie) => boolean;
  axis: Axis;
  /** Текущий угол поворота группы, град. */
  angle: number;
  /** Длительность перехода, мс (0 — мгновенно). */
  ms: number;
}

export function Cube3D({ state, rotX = -24, rotY = -32, turn, scale = 1 }: {
  state: CubeState;
  rotX?: number;
  rotY?: number;
  turn?: TurnAnim | null;
  scale?: number;
}) {
  const [moving, still] = useMemo(() => {
    if (!turn) return [[] as CubeState, state];
    return [state.filter(turn.inLayer), state.filter(c => !turn.inLayer(c))];
  }, [state, turn]);

  const axisVec = turn
    ? (turn.axis === 'x' ? '1, 0, 0' : turn.axis === 'y' ? '0, 1, 0' : '0, 0, 1')
    : '0, 1, 0';

  const box = STEP * 3;
  return (
    <div
      style={{
        perspective: 1000,
        width: box * scale,
        height: box * scale,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: box, height: box,
          transformStyle: 'preserve-3d',
          transform: `scale(${scale}) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transition: 'transform .35s ease',
        }}
      >
        {still.map((c, i) => <CubieBox key={`s${i}-${c.x}${c.y}${c.z}`} c={c} />)}

        {turn && (
          <div
            style={{
              position: 'absolute', inset: 0,
              transformStyle: 'preserve-3d',
              // Ось Y в CSS смотрит вниз, поэтому знак угла инвертируем —
              // иначе анимация крутилась бы в сторону, обратную самому ходу.
              transform: `rotate3d(${axisVec}, ${turn.axis === 'y' ? -turn.angle : turn.angle}deg)`,
              transition: turn.ms > 0 ? `transform ${turn.ms}ms cubic-bezier(.4,0,.2,1)` : 'none',
            }}
          >
            {moving.map((c, i) => <CubieBox key={`m${i}-${c.x}${c.y}${c.z}`} c={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}
