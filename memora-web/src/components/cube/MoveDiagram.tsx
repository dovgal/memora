'use client';
// Схемы ходов в стиле печатных инструкций: сетка 3×3 (вид на переднюю грань)
// и красная стрелка, показывающая, какой ряд или столбец едет и куда.
// Повороты передней и задней граней рисуются круговой стрелкой.

import { useId } from 'react';
import { parseMoves, pieceMoves, solvedCube, applySequence, type Move, type Turnable } from '@/lib/cube/model';
import { CubePreview } from './CubePreview';

/** Международная буква → русская, как в отечественных печатных схемах. */
const RU_LABEL: Record<Turnable, string> = {
  U: 'В', D: 'Н', R: 'П', L: 'Л', F: 'Ф', B: 'З', M: 'Сп', E: 'Сн', S: 'Сф',
};

/** Подпись хода в русской нотации: П, П′, П2. */
export function ruNotation(m: Move): string {
  const base = RU_LABEL[m.face] ?? String(m.face);
  return m.turns === 2 ? `${base}2` : m.turns === -1 ? `${base}′` : base;
}

/** Вся последовательность в русской записи. */
export function ruSequence(seq: string): string {
  return parseMoves(seq).map(ruNotation).join(' ');
}

const S = 62;                 // сторона сетки
const C = S / 3;              // клетка
const RED = '#e03131';

/** Как изобразить ход: полоса (ряд/столбец) со стрелкой либо кольцевая стрелка. */
type Shape =
  | { kind: 'col'; col: 0 | 1 | 2; dir: 'up' | 'down' }
  | { kind: 'row'; row: 0 | 1 | 2; dir: 'left' | 'right' }
  | { kind: 'turn'; cw: boolean; back?: boolean };

/**
 * Направления даны для взгляда на переднюю грань — как в печатных схемах.
 * R по часовой (если смотреть справа) тянет передний столбец ВВЕРХ, L — вниз,
 * U уводит верхний ряд ВЛЕВО, D — нижний ряд вправо. E идёт как D, M — как L.
 */
function shapeOf(face: Turnable, prime: boolean): Shape {
  switch (face) {
    case 'R': return { kind: 'col', col: 2, dir: prime ? 'down' : 'up' };
    case 'L': return { kind: 'col', col: 0, dir: prime ? 'up' : 'down' };
    case 'M': return { kind: 'col', col: 1, dir: prime ? 'up' : 'down' };
    case 'U': return { kind: 'row', row: 0, dir: prime ? 'right' : 'left' };
    case 'D': return { kind: 'row', row: 2, dir: prime ? 'left' : 'right' };
    case 'E': return { kind: 'row', row: 1, dir: prime ? 'left' : 'right' };
    case 'F': return { kind: 'turn', cw: !prime };
    case 'S': return { kind: 'turn', cw: !prime };
    case 'B': return { kind: 'turn', cw: prime, back: true };
  }
}

function Grid() {
  const lines = [];
  for (let i = 1; i < 3; i++) {
    lines.push(<line key={`v${i}`} x1={i * C} y1={0} x2={i * C} y2={S} stroke="#adb5bd" strokeWidth="1.5" />);
    lines.push(<line key={`h${i}`} x1={0} y1={i * C} x2={S} y2={i * C} stroke="#adb5bd" strokeWidth="1.5" />);
  }
  return (
    <>
      <rect x="0" y="0" width={S} height={S} fill="#fff" stroke="#495057" strokeWidth="2" rx="3" />
      {lines}
    </>
  );
}

/** Одна схема хода: сетка + стрелка. */
export function MoveDiagram({ move, label }: { move: Move; label?: string }) {
  const prime = move.turns === -1;
  const sh = shapeOf(move.face, prime);
  const half = C / 2;
  const pad = 7;
  // useId вместо случайного значения: рендер должен быть чистым, а маркер
  // стрелки — иметь стабильный идентификатор между сервером и клиентом.
  const id = useId();

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={S + 18} height={S + 18} viewBox={`-9 -9 ${S + 18} ${S + 18}`}>
        <defs>
          <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={RED} />
          </marker>
        </defs>
        <Grid />

        {sh.kind === 'col' && (
          <line
            x1={sh.col * C + half} y1={sh.dir === 'up' ? S - pad : pad}
            x2={sh.col * C + half} y2={sh.dir === 'up' ? pad : S - pad}
            stroke={RED} strokeWidth="3" markerEnd={`url(#${id})`}
          />
        )}
        {sh.kind === 'row' && (
          <line
            x1={sh.dir === 'right' ? pad : S - pad} y1={sh.row * C + half}
            x2={sh.dir === 'right' ? S - pad : pad} y2={sh.row * C + half}
            stroke={RED} strokeWidth="3" markerEnd={`url(#${id})`}
          />
        )}
        {sh.kind === 'turn' && (
          <g transform={sh.cw ? undefined : `scale(-1,1) translate(${-S},0)`}>
            <path
              d={`M ${S * 0.24} ${S * 0.72} A ${S * 0.3} ${S * 0.3} 0 1 1 ${S * 0.78} ${S * 0.68}`}
              fill="none" stroke={RED} strokeWidth="3" markerEnd={`url(#${id})`} strokeLinecap="round"
            />
            {sh.back && <text x={S / 2} y={S * 0.58} textAnchor="middle" fontSize="11" fill={RED} fontWeight="700">зад</text>}
          </g>
        )}
        {move.turns === 2 && (
          <text x={S - 4} y={S - 4} textAnchor="end" fontSize="13" fontWeight="700" fill={RED}>×2</text>
        )}
      </svg>
      <span className="font-mono text-xs font-bold text-foreground">{label ?? ruNotation(move)}</span>
    </div>
  );
}

/** Вся комбинация: ряд схем по одной на ход, как в печатной инструкции. */
export function AlgorithmDiagram({ algorithm, title, note, setup = '', preview = true }: {
  algorithm: string;
  title?: string;
  note?: string;
  setup?: string;
  /** Показывать объёмную схему «что изменится» слева. */
  preview?: boolean;
}) {
  const moves = parseMoves(algorithm);
  if (moves.length === 0) return null;
  const flow = pieceMoves(applySequence(solvedCube(), setup), algorithm);
  const travel = flow.filter(m => !m.twistOnly).length;
  const twist = flow.length - travel;

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-5">
      {title && <p className="font-bold text-foreground mb-1">{title}</p>}
      <p className="font-mono text-sm font-bold text-[#4255ff]">{ruSequence(algorithm)}</p>
      <p className="font-mono text-xs text-qz-text-muted mb-3">международная запись: {algorithm}</p>

      <div className="flex flex-col lg:flex-row gap-5">
        {preview && (
          <div className="shrink-0">
            <CubePreview algorithm={algorithm} setup={setup} />
            <p className="text-[11px] text-amber-500 mt-2 max-w-[190px] leading-snug">
              Стрелки — итог всей комбинации: {travel > 0 && <>переезжают <strong>{travel}</strong></>}
              {travel > 0 && twist > 0 && ', '}
              {twist > 0 && <>разворачиваются на месте <strong>{twist}</strong></>}.
              Приглушённые детали не меняются.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 content-start">
          {moves.map((m, i) => <MoveDiagram key={i} move={m} />)}
        </div>
      </div>
      {note && <p className="text-qz-text-muted text-xs mt-3">{note}</p>}
    </div>
  );
}
