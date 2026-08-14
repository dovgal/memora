'use client';
// Трёхмерный кубик на CSS-трансформациях. Каждый кубик — коробка из шести
// граней; поворот слоя анимируется поворотом ГРУППЫ кубиков вокруг оси —
// то же движение, что и рукой, поэтому глазу понятно, что именно повернулось.

import { useMemo } from 'react';
import { posKey, type Axis, type CubeState, type Cubie, type Face, type PieceMove } from '@/lib/cube/model';

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

/**
 * Цвет корпуса. Раньше внутренние стороны красились почти в чёрный, и при
 * повороте слоя в кадре появлялись «дыры». Настоящий кубик внутри — серый
 * пластик, а цвет несёт наклейка; так и сделано: корпус одинаковый со всех
 * сторон, наклейка — вставка чуть меньшего размера поверх него.
 */
const PLASTIC = '#3a3f4b';
const STICKER_INSET = 5;

function CubieBox({ c, highlight = false }: { c: Cubie; highlight?: boolean }) {
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
            background: PLASTIC,
            borderRadius: 9,
            // ВАЖНО: без backfaceVisibility:'hidden'. С ним грань, повёрнутая
            // к камере изнанкой, исчезала — и сквозь кубик была видна пустота,
            // которая читалась как чёрные дыры при повороте слоя.
            boxShadow: 'inset 0 0 6px rgba(0,0,0,.45)',
          }}
        >
          {c.colors[f] && (
            <div
              style={{
                position: 'absolute',
                inset: STICKER_INSET,
                background: c.colors[f] as string,
                borderRadius: 6,
                boxShadow: highlight
                  ? '0 0 0 3px #4255ff, 0 0 14px 2px rgba(66,85,255,.9)'
                  : 'inset 0 0 10px rgba(0,0,0,.18)',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/** Стрелка на грани: показывает, что и в какую сторону сейчас повернётся. */
export interface FaceArrow {
  face: Face;
  /** 1 — по часовой (снаружи), -1 — против, 2 — на 180°. */
  dir: 1 | -1 | 2;
}

const ARROW_DIST = STEP + SIZE / 2 + 10;
const ARROW_TRANSFORM: Record<Face, string> = {
  F: `translateZ(${ARROW_DIST}px)`,
  B: `rotateY(180deg) translateZ(${ARROW_DIST}px)`,
  R: `rotateY(90deg) translateZ(${ARROW_DIST}px)`,
  L: `rotateY(-90deg) translateZ(${ARROW_DIST}px)`,
  U: `rotateX(90deg) translateZ(${ARROW_DIST}px)`,
  D: `rotateX(-90deg) translateZ(${ARROW_DIST}px)`,
};

/** Изогнутая стрелка поверх грани — рисуем SVG, чтобы направление читалось. */
function TurnArrow({ face, dir }: FaceArrow) {
  const box = STEP * 3;
  const ccw = dir === -1;
  return (
    <div
      style={{
        position: 'absolute', left: '50%', top: '50%',
        width: box, height: box, marginLeft: -box / 2, marginTop: -box / 2,
        transform: ARROW_TRANSFORM[face],
        pointerEvents: 'none',
      }}
    >
      <svg viewBox="0 0 100 100" width={box} height={box}
        style={{ transform: ccw ? 'scaleX(-1)' : undefined, filter: 'drop-shadow(0 0 6px rgba(0,0,0,.55))' }}>
        <path
          d="M 22 66 A 34 34 0 1 1 74 68"
          fill="none" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" opacity="0.95"
        />
        <path d="M 74 68 l -3 -19 l 19 6 z" fill="#ffffff" opacity="0.95" />
        {dir === 2 && (
          <text x="50" y="60" textAnchor="middle" fontSize="26" fontWeight="700" fill="#ffffff"
            transform={ccw ? 'scale(-1,1) translate(-100,0)' : undefined}>×2</text>
        )}
      </svg>
    </div>
  );
}

const PERSPECTIVE = 1000;

/**
 * Проекция точки куба на экран. Повторяет то, что делает браузер с
 * `rotateX(rotX) rotateY(rotY)` и перспективой, — иначе стрелки «поплывут»
 * относительно кубиков при повороте камеры.
 */
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

export interface TurnAnim {
  /** Какие кубики крутятся. */
  inLayer: (c: Cubie) => boolean;
  axis: Axis;
  /** Текущий угол поворота группы, град. */
  angle: number;
  /** Длительность перехода, мс (0 — мгновенно). */
  ms: number;
}

export function Cube3D({ state, rotX = -24, rotY = -32, turn, scale = 1, highlight, arrow, flow }: {
  state: CubeState;
  rotX?: number;
  rotY?: number;
  turn?: TurnAnim | null;
  scale?: number;
  /** Позиции («x,y,z»), которые нужно подсветить — зона действия алгоритма. */
  highlight?: Set<string> | null;
  /** Стрелка предстоящего поворота. */
  arrow?: FaceArrow | null;
  /** Маршруты деталей за всю последовательность — показ «что изменится». */
  flow?: PieceMove[] | null;
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
        position: 'relative',
        perspective: PERSPECTIVE,
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
        {still.map(c => <CubieBox key={c.id} c={c} highlight={!!highlight?.has(posKey(c))} />)}

        {arrow && <TurnArrow face={arrow.face} dir={arrow.dir} />}

        {turn && (
          <div
            style={{
              position: 'absolute', inset: 0,
              transformStyle: 'preserve-3d',
              // Ось Y в CSS смотрит вниз, поэтому знак угла инвертируем —
              // иначе анимация крутилась бы в сторону, обратную самому ходу.
              transform: `rotate3d(${axisVec}, ${turn.axis === 'y' ? -turn.angle : turn.angle}deg)`,
              transition: turn.ms > 0 ? `transform ${turn.ms}ms cubic-bezier(.4,0,.2,1)` : 'none',
              willChange: 'transform',
            }}
          >
            {moving.map(c => <CubieBox key={c.id} c={c} highlight={!!highlight?.has(posKey(c))} />)}
          </div>
        )}
      </div>

      {flow && flow.length > 0 && (
        <FlowArrows flow={flow} rotX={rotX} rotY={rotY} box={box} scale={scale} />
      )}
    </div>
  );
}
