// Модель кубика Рубика: 26 кубиков-«кубиков» с координатами и цветами граней.
//
// Такое представление (а не 54 наклейки) выбрано ради анимации: чтобы повернуть
// слой, достаточно взять кубики с нужной координатой и вращать их как группу —
// ровно так же, как рукой в реальности.

export type Face = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';
/** Средние слои: M — между L и R, E — между U и D, S — между F и B. */
export type Slice = 'M' | 'E' | 'S';
export type Turnable = Face | Slice;
export type Axis = 'x' | 'y' | 'z';

/** Цвета стандартной раскраски: белый верх, жёлтый низ, зелёный перед. */
export const COLORS: Record<Face, string> = {
  U: '#f8f9fa', // белый
  D: '#ffd93d', // жёлтый
  F: '#37b24d', // зелёный
  B: '#1c7ed6', // синий
  L: '#f76707', // оранжевый
  R: '#e03131', // красный
};

export interface Cubie {
  /**
   * Постоянный номер детали. Координаты меняются на каждом ходу, поэтому
   * ключом React они быть не могут: узлы пересоздавались бы на каждом
   * повороте — отсюда рывки анимации. Идентификатор живёт с деталью.
   */
  id: number;
  /** Координаты от -1 до 1. x — вправо, y — вверх, z — на зрителя. */
  x: number; y: number; z: number;
  /** Цвет каждой стороны кубика; null — внутренняя, невидимая сторона. */
  colors: Record<Face, string | null>;
}

export type CubeState = Cubie[];

/** Собранный куб. */
export function solvedCube(): CubeState {
  const out: CubeState = [];
  let id = 0;
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue; // центр не виден
        out.push({
          id: id++,
          x, y, z,
          colors: {
            U: y === 1 ? COLORS.U : null,
            D: y === -1 ? COLORS.D : null,
            R: x === 1 ? COLORS.R : null,
            L: x === -1 ? COLORS.L : null,
            F: z === 1 ? COLORS.F : null,
            B: z === -1 ? COLORS.B : null,
          },
        });
      }
  return out;
}

/** Какие кубики участвуют в повороте грани или среднего слоя. */
export function layerOf(face: Turnable): (c: Cubie) => boolean {
  switch (face) {
    case 'U': return c => c.y === 1;
    case 'D': return c => c.y === -1;
    case 'R': return c => c.x === 1;
    case 'L': return c => c.x === -1;
    case 'F': return c => c.z === 1;
    case 'B': return c => c.z === -1;
    // Средние слои: та же плоскость, но координата 0.
    case 'M': return c => c.x === 0;
    case 'E': return c => c.y === 0;
    case 'S': return c => c.z === 0;
  }
}

/** Ось вращения грани и знак: по часовой стрелке, если смотреть на грань снаружи. */
export const FACE_AXIS: Record<Turnable, { axis: Axis; sign: number }> = {
  U: { axis: 'y', sign: -1 },
  D: { axis: 'y', sign: 1 },
  R: { axis: 'x', sign: -1 },
  L: { axis: 'x', sign: 1 },
  F: { axis: 'z', sign: -1 },
  B: { axis: 'z', sign: 1 },
  // Средние слои идут в сторону «своей» грани: M — как L, E — как D, S — как F.
  M: { axis: 'x', sign: 1 },
  E: { axis: 'y', sign: 1 },
  S: { axis: 'z', sign: -1 },
};

/** Поворот одного кубика на 90° вокруг оси. dir=1 — по часовой (в системе экрана). */
function rotateCubie(c: Cubie, axis: Axis, dir: number): Cubie {
  const { x, y, z, colors } = c;
  const n: Record<Face, string | null> = { ...colors };
  let nx = x, ny = y, nz = z;

  if (axis === 'y') {
    // Поворот вокруг вертикали: перед → право → зад → лево.
    nx = dir > 0 ? -z : z;
    nz = dir > 0 ? x : -x;
    if (dir > 0) { n.F = colors.R; n.R = colors.B; n.B = colors.L; n.L = colors.F; }
    else { n.F = colors.L; n.L = colors.B; n.B = colors.R; n.R = colors.F; }
  } else if (axis === 'x') {
    ny = dir > 0 ? -z : z;
    nz = dir > 0 ? y : -y;
    if (dir > 0) { n.U = colors.F; n.F = colors.D; n.D = colors.B; n.B = colors.U; }
    else { n.U = colors.B; n.B = colors.D; n.D = colors.F; n.F = colors.U; }
  } else {
    nx = dir > 0 ? y : -y;
    ny = dir > 0 ? -x : x;
    if (dir > 0) { n.U = colors.L; n.L = colors.D; n.D = colors.R; n.R = colors.U; }
    else { n.U = colors.R; n.R = colors.D; n.D = colors.L; n.L = colors.U; }
  }
  return { id: c.id, x: nx, y: ny, z: nz, colors: n };
}

/** Один ход в нотации: R, R', R2, U, U'… */
export interface Move {
  face: Turnable;
  /** 1 — по часовой, -1 — против, 2 — на 180°. */
  turns: 1 | -1 | 2;
  /** Исходная запись, для показа ученику. */
  notation: string;
}

/**
 * Русская нотация из отечественных схем сборки → международная.
 * В — верх, Н — низ, П — право, Л — лево, Ф — фронт, З/Т — зад.
 */
export const RU_TO_FACE: Record<string, Turnable> = {
  'В': 'U', 'Н': 'D', 'П': 'R', 'Л': 'L', 'Ф': 'F', 'З': 'B', 'Т': 'B',
  // «Сн» из отечественных схем — средний слой вниз, это ход M.
  'С': 'M',
};

export function parseMoves(seq: string): Move[] {
  const out: Move[] = [];
  for (const tok of seq.trim().split(/\s+/).filter(Boolean)) {
    const head = tok[0].toUpperCase();
    const f = (RU_TO_FACE[head] ?? head) as Turnable;
    if (!'UDLRFBMES'.includes(f)) continue;
    const turns: 1 | -1 | 2 = tok.includes('2') ? 2 : (tok.includes("'") || tok.includes('’')) ? -1 : 1;
    out.push({ face: f, turns, notation: tok });
  }
  return out;
}

/** Применить ход к состоянию (без анимации). */
export function applyMove(state: CubeState, mv: Move): CubeState {
  const inLayer = layerOf(mv.face);
  const { axis, sign } = FACE_AXIS[mv.face];
  const times = mv.turns === 2 ? 2 : 1;
  const dir = mv.turns === -1 ? -sign : sign;

  let cur = state;
  for (let i = 0; i < times; i++) {
    cur = cur.map(c => (inLayer(c) ? rotateCubie(c, axis, dir) : c));
  }
  return cur;
}

export function applySequence(state: CubeState, seq: string): CubeState {
  return parseMoves(seq).reduce(applyMove, state);
}

/** Обратная последовательность — для отмены и для разбора алгоритма. */
export function invert(seq: string): string {
  return parseMoves(seq).reverse().map(m =>
    m.turns === 2 ? `${m.face}2` : m.turns === 1 ? `${m.face}'` : m.face,
  ).join(' ');
}

/** Случайная перемешка заданной длины. */
export function scramble(n = 20): string {
  const faces: Face[] = ['U', 'D', 'L', 'R', 'F', 'B'];
  const suffix = ['', "'", '2'];
  const out: string[] = [];
  let prev = '';
  while (out.length < n) {
    const f = faces[Math.floor(Math.random() * 6)];
    if (f === prev) continue;       // два подряд хода одной грани бессмысленны
    prev = f;
    out.push(f + suffix[Math.floor(Math.random() * 3)]);
  }
  return out.join(' ');
}

/** Собран ли куб: у каждой грани один цвет. */
export function isSolved(state: CubeState): boolean {
  const faces: Face[] = ['U', 'D', 'L', 'R', 'F', 'B'];
  return faces.every(f => {
    const colors = state.map(c => c.colors[f]).filter(Boolean);
    return new Set(colors).size === 1;
  });
}

/** Ключ позиции кубика — для сравнения «до» и «после». */
export function posKey(c: Cubie): string { return `${c.x},${c.y},${c.z}`; }

/**
 * Какие места куба изменятся после выполнения последовательности.
 * Сравниваем состояние до и после по позициям: если на месте оказался
 * другой набор цветов — деталь затронута. Нужно, чтобы заранее показать
 * ученику зону действия алгоритма, а не заставлять угадывать.
 */
export function affectedPositions(state: CubeState, seq: string): Set<string> {
  const after = applySequence(state, seq);
  const byPos = new Map(after.map(c => [posKey(c), c]));
  const out = new Set<string>();
  for (const before of state) {
    const a = byPos.get(posKey(before));
    if (!a) continue;
    const faces: Face[] = ['U', 'D', 'L', 'R', 'F', 'B'];
    if (faces.some(f => before.colors[f] !== a.colors[f])) out.add(posKey(before));
  }
  return out;
}

/** Какие грани куба меняются последовательностью — для подписи словами. */
export function affectedFaces(state: CubeState, seq: string): Face[] {
  const after = applySequence(state, seq);
  const faces: Face[] = ['U', 'D', 'L', 'R', 'F', 'B'];
  const key = (st: CubeState, f: Face) =>
    st.filter(c => c.colors[f]).map(c => `${posKey(c)}:${c.colors[f]}`).sort().join('|');
  return faces.filter(f => key(state, f) !== key(after, f));
}

export const FACE_RU: Record<Turnable, string> = {
  U: 'верхняя', D: 'нижняя', L: 'левая', R: 'правая', F: 'передняя', B: 'задняя',
  M: 'средний слой (вниз)', E: 'средний слой (горизонт)', S: 'средний слой (фронт)',
};

/** Куда уедет деталь после всей последовательности. */
export interface PieceMove {
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  /** Деталь осталась на месте, но развернулась. */
  twistOnly: boolean;
}

/**
 * Маршруты деталей за ВСЮ последовательность: откуда и куда переедет каждая.
 * Считаем по постоянным id — промежуточные ходы не важны, важен итог, потому
 * что ученику нужно понять результат комбинации, а не следить за каждым шагом.
 */
export function pieceMoves(state: CubeState, seq: string): PieceMove[] {
  const after = applySequence(state, seq);
  const byId = new Map(after.map(c => [c.id, c]));
  const out: PieceMove[] = [];
  const faces: Face[] = ['U', 'D', 'L', 'R', 'F', 'B'];

  for (const b of state) {
    const a = byId.get(b.id);
    if (!a) continue;
    const moved = a.x !== b.x || a.y !== b.y || a.z !== b.z;
    const twisted = faces.some(f => a.colors[f] !== b.colors[f]);
    // Центры не двигаются и не разворачиваются заметно — их пропускаем.
    const isCenter = [b.x, b.y, b.z].filter(v => v === 0).length === 2;
    if (isCenter || (!moved && !twisted)) continue;
    out.push({
      from: { x: b.x, y: b.y, z: b.z },
      to: { x: a.x, y: a.y, z: a.z },
      twistOnly: !moved,
    });
  }
  return out;
}
