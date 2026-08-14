// Модель кубика Рубика: 26 кубиков-«кубиков» с координатами и цветами граней.
//
// Такое представление (а не 54 наклейки) выбрано ради анимации: чтобы повернуть
// слой, достаточно взять кубики с нужной координатой и вращать их как группу —
// ровно так же, как рукой в реальности.

export type Face = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';
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
  /** Координаты от -1 до 1. x — вправо, y — вверх, z — на зрителя. */
  x: number; y: number; z: number;
  /** Цвет каждой стороны кубика; null — внутренняя, невидимая сторона. */
  colors: Record<Face, string | null>;
}

export type CubeState = Cubie[];

/** Собранный куб. */
export function solvedCube(): CubeState {
  const out: CubeState = [];
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue; // центр не виден
        out.push({
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

/** Какие кубики участвуют в повороте грани. */
export function layerOf(face: Face): (c: Cubie) => boolean {
  switch (face) {
    case 'U': return c => c.y === 1;
    case 'D': return c => c.y === -1;
    case 'R': return c => c.x === 1;
    case 'L': return c => c.x === -1;
    case 'F': return c => c.z === 1;
    case 'B': return c => c.z === -1;
  }
}

/** Ось вращения грани и знак: по часовой стрелке, если смотреть на грань снаружи. */
export const FACE_AXIS: Record<Face, { axis: Axis; sign: number }> = {
  U: { axis: 'y', sign: -1 },
  D: { axis: 'y', sign: 1 },
  R: { axis: 'x', sign: -1 },
  L: { axis: 'x', sign: 1 },
  F: { axis: 'z', sign: -1 },
  B: { axis: 'z', sign: 1 },
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
  return { x: nx, y: ny, z: nz, colors: n };
}

/** Один ход в нотации: R, R', R2, U, U'… */
export interface Move {
  face: Face;
  /** 1 — по часовой, -1 — против, 2 — на 180°. */
  turns: 1 | -1 | 2;
  /** Исходная запись, для показа ученику. */
  notation: string;
}

export function parseMoves(seq: string): Move[] {
  const out: Move[] = [];
  for (const tok of seq.trim().split(/\s+/).filter(Boolean)) {
    const f = tok[0].toUpperCase() as Face;
    if (!'UDLRFB'.includes(f)) continue;
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
