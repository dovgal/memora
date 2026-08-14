'use client';
// Статичная объёмная схема кубика со стрелками «что изменится после алгоритма».
// Без анимации: это картинка-иллюстрация, как в печатных инструкциях, только
// стрелки считаются по модели, а не рисуются вручную.

import { pieceMoves, solvedCube, applySequence, type CubeState, type Cubie, type Face, type PieceMove } from '@/lib/cube/model';

const SIZE = 34;
const GAP = 2;
const STEP = SIZE + GAP;
const PLASTIC = '#3a3f4b';
const STICKER_INSET = 4;
const PERSPECTIVE = 1000;

const FACE_TRANSFORM: Record<Face, string> = {
  F: `translateZ(${SIZE / 2}px)`,
  B: `rotateY(180deg) translateZ(${SIZE / 2}px)`,
  R: `rotateY(90deg) translateZ(${SIZE / 2}px)`,
  L: `rotateY(-90deg) translateZ(${SIZE / 2}px)`,
  U: `rotateX(90deg) translateZ(${SIZE / 2}px)`,
  D: `rotateX(-90deg) translateZ(${SIZE / 2}px)`,
};

function CubieBox({ c, dim }: { c: Cubie; dim: boolean }) {
  return (
    <div style={{
      position: 'absolute', width: SIZE, height: SIZE,
      transformStyle: 'preserve-3d',
      transform: `translate3d(${c.x * STEP}px, ${-c.y * STEP}px, ${c.z * STEP}px)`,
      left: '50%', top: '50%', marginLeft: -SIZE / 2, marginTop: -SIZE / 2,
    }}>
      {(Object.keys(FACE_TRANSFORM) as Face[]).map(f => (
        <div key={f} style={{
          position: 'absolute', width: SIZE, height: SIZE,
          transform: FACE_TRANSFORM[f], background: PLASTIC, borderRadius: 6,
          boxShadow: 'inset 0 0 5px rgba(0,0,0,.45)',
        }}>
          {c.colors[f] && (
            <div style={{
              position: 'absolute', inset: STICKER_INSET,
              background: c.colors[f] as string, borderRadius: 4,
              opacity: dim ? 0.35 : 1,
              boxShadow: 'inset 0 0 8px rgba(0,0,0,.18)',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

function project(x: number, y: number, z: number, rotX: number, rotY: number) {
  const px = x * STEP, py = -y * STEP, pz = z * STEP;
  const ry = (rotY * Math.PI) / 180, rx = (rotX * Math.PI) / 180;
  const X = px * Math.cos(ry) + pz * Math.sin(ry);
  const Z1 = -px * Math.sin(ry) + pz * Math.cos(ry);
  const Y = py * Math.cos(rx) - Z1 * Math.sin(rx);
  const Z = py * Math.sin(rx) + Z1 * Math.cos(rx);
  const s = PERSPECTIVE / (PERSPECTIVE - Z);
  return { x: X * s, y: Y * s, depth: Z };
}

/** Стрелки «откуда → куда» за всю последовательность, поверх куба. */

/** Стрелки «откуда → куда» за всю последовательность, поверх куба. */
function FlowArrows({ flow, rotX, rotY, box, scale }: {
  flow: PieceMove[]; rotX: number; rotY: number; box: number; scale: number;
}) {
  const half = box / 2;
  return (
    <svg
      width={box * scale} height={box * scale}
      viewBox={`${-half} ${-half} ${box} ${box}`}
      style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -(box * scale) / 2, marginTop: -(box * scale) / 2, pointerEvents: 'none', overflow: 'visible' }}
    >
      <defs>
        <marker id="cube-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffd43b" />
        </marker>
      </defs>
      {flow.map((m, i) => {
        const a = project(m.from.x, m.from.y, m.from.z, rotX, rotY);
        if (m.twistOnly) {
          // Деталь остаётся на месте — показываем круговую стрелку разворота.
          return (
            <circle key={i} cx={a.x} cy={a.y} r={16} fill="none"
              stroke="#ffd43b" strokeWidth="3.5" strokeDasharray="6 5" opacity={0.95} />
          );
        }
        const b = project(m.to.x, m.to.y, m.to.z, rotX, rotY);
        // Дуга вместо прямой: несколько стрелок сразу не сливаются в кашу.
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const cx = mx - (dy / len) * len * 0.22;
        const cy = my + (dx / len) * len * 0.22;
        return (
          <g key={i}>
            <path d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
              fill="none" stroke="#ffd43b" strokeWidth="4" strokeLinecap="round"
              markerEnd="url(#cube-arrow)" opacity={0.95}
              style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,.7))' }} />
            <circle cx={a.x} cy={a.y} r={5} fill="#ffd43b" opacity={0.95} />
          </g>
        );
      })}
    </svg>
  );
}


/**
 * Схема «до алгоритма»: куб и стрелки, показывающие, куда переедет каждая
 * затронутая деталь после ВСЕЙ комбинации. Незатронутые детали приглушены,
 * чтобы взгляд сразу цеплялся за рабочую зону.
 */
export function CubePreview({ algorithm, setup = '', rotX = -22, rotY = -34, scale = 1 }: {
  algorithm: string;
  setup?: string;
  rotX?: number;
  rotY?: number;
  scale?: number;
}) {
  const state: CubeState = applySequence(solvedCube(), setup);
  const flow: PieceMove[] = pieceMoves(state, algorithm);
  const active = new Set(flow.map(m => `${m.from.x},${m.from.y},${m.from.z}`));
  const box = STEP * 3;

  return (
    <div style={{
      position: 'relative', perspective: PERSPECTIVE,
      width: box * scale, height: box * scale,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        position: 'relative', width: box, height: box,
        transformStyle: 'preserve-3d',
        transform: `scale(${scale}) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
      }}>
        {state.map(c => (
          <CubieBox key={c.id} c={c} dim={!active.has(`${c.x},${c.y},${c.z}`)} />
        ))}
      </div>
      {flow.length > 0 && <FlowArrows flow={flow} rotX={rotX} rotY={rotY} box={box} scale={scale} />}
    </div>
  );
}
