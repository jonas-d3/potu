import { difficultyProfiles } from "./difficulty.mjs";

// A cell holds [number, color]. Zero means that the player still has to fill it.
export const PUZZLE_VERSION = 3;
export const VALUES = [1, 2, 3, 4];
export const COLORS = ["", "blå", "grøn", "gul", "rød", "lilla"];
export const LEVELS = ["Let", "Mellem", "Svær", "Ekspert"];
function layout(size) {
  const values = Array.from({ length: size }, (_, i) => i + 1);
  const indices = Array.from({ length: size * size }, (_, i) => i);
  const rows = values.map((_, r) => indices.slice(size * r, size * (r + 1)));
  const columns = values.map((_, c) => indices.filter((i) => i % size === c));
  const peers = indices.map((i) =>
    indices.filter(
      (j) =>
        i !== j &&
        (Math.floor(i / size) === Math.floor(j / size) ||
          i % size === j % size),
    ),
  );
  const pairs = values.flatMap((n) => values.map((c) => [n, c]));
  return { size, values, indices, lines: [...rows, ...columns], peers, pairs };
}
const layouts = { 16: layout(4), 25: layout(5) };

export const copyBoard = (board) => board.map((cell) => [...cell]);
export const coordinate = (i, size = 4) =>
  "ABCDE"[i % size] + (1 + Math.floor(i / size));
export function conflicts(board, solution) {
  return layouts[board.length].indices.filter((i) =>
    board[i].some((v, k) => v && v !== solution[i][k]),
  );
}
export function isComplete(board, solution) {
  return board.every((cell, i) => cell.every((v, k) => v === solution[i][k]));
}

function randomSource(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Each legal pair must fit the cell's givens, both lines, and the whole board.
function candidates(board) {
  const { peers, pairs } = layouts[board.length];
  return board.map(([n, c], i) => {
    if (n && c) return [[n, c]];
    return pairs.filter(
      ([a, b]) =>
        (!n || n === a) &&
        (!c || c === b) &&
        !peers[i].some((j) => board[j][0] === a || board[j][1] === b) &&
        !board.some(
          ([otherN, otherC], j) => j !== i && otherN === a && otherC === b,
        ),
    );
  });
}

export function nextDeduction(board) {
  const { size, values, indices, lines, pairs } = layouts[board.length];
  const options = candidates(board);
  for (const i of indices) {
    for (const k of [0, 1]) {
      if (board[i][k] || !options[i].length) continue;
      const value = options[i][0][k];
      if (options[i].every((pair) => pair[k] === value))
        return { i, k, value, reason: "cell" };
    }
  }
  for (const [lineIndex, line] of lines.entries()) {
    for (const k of [0, 1]) {
      for (const value of values) {
        const places = line.filter((i) =>
          options[i].some((pair) => pair[k] === value),
        );
        if (places.length === 1 && !board[places[0]][k]) {
          return {
            i: places[0],
            k,
            value,
            reason: lineIndex < size ? "row" : "column",
          };
        }
      }
    }
  }
  for (const [n, c] of pairs) {
    const places = indices.filter((i) =>
      options[i].some((pair) => pair[0] === n && pair[1] === c),
    );
    if (places.length !== 1) continue;
    const i = places[0];
    if (!board[i][0])
      return { i, k: 0, value: n, reason: "pair", pair: [n, c] };
    if (!board[i][1])
      return { i, k: 1, value: c, reason: "pair", pair: [n, c] };
  }
  return null;
}

function solveByLogic(givens, solution) {
  const board = copyBoard(givens);
  const pairTurns = [];
  let turn = 0;
  let lineSteps = 0;
  for (let step = nextDeduction(board); step; step = nextDeduction(board)) {
    turn++;
    if (step.reason === "pair") pairTurns.push(turn);
    if (step.reason === "row" || step.reason === "column") lineSteps++;
    board[step.i][step.k] = step.value;
  }
  return { solved: isComplete(board, solution), pairTurns, lineSteps };
}

// Targets based on the reference boards. Each nonzero number or color is one clue.
// The fallback masks describe proven clue positions on the unpermuted squares:
// 0 = empty, 1 = number, 2 = color, 3 = both. They bound generation time.
const previousTiers = [
  { clues: 10, mask: "2000010001122033" },
  { clues: 6, mask: "0300002010000021" },
  { clues: 11, mask: "0000220013020000003000023" },
  { clues: 12, mask: "0002001230012022000020101" },
];

function makeSolution(rows, columns, numbers, colors) {
  const size = rows.length;
  // Pairs of orthogonal Latin squares over GF(4) or the integers modulo 5.
  const doubled = [0, 2, 3, 1];
  return rows.flatMap((y) =>
    columns.map((x) =>
      size === 4
        ? [numbers[y ^ x], colors[doubled[y] ^ x]]
        : [numbers[(y + x) % size], colors[(2 * y + x) % size]],
    ),
  );
}

function maskedGivens(solution, mask, rows, columns) {
  const size = rows.length;
  return solution.map(([n, color], i) => {
    const bits = Number(
      mask[rows[Math.floor(i / size)] * size + columns[i % size]],
    );
    return [bits & 1 ? n : 0, bits & 2 ? color : 0];
  });
}

function matchesProfile(givens, solution, profile) {
  const { solved, pairTurns, lineSteps } = solveByLogic(givens, solution);
  if (!solved || pairTurns.length !== profile.pairs) return false;
  const first = pairTurns[0];
  if (first < profile.firstPair[0] || first > profile.firstPair[1])
    return false;
  if (lineSteps < profile.lineSteps[0] || lineSteps > profile.lineSteps[1])
    return false;
  if (profile.pairs === 1) return true;

  // On Expert, the three pair deductions form a cluster with at least two
  // back-to-back, as in the reference trace (turns 5, 8 and 9).
  return (
    pairTurns.at(-1) - first <= 7 &&
    pairTurns.some((turn, i) => i > 0 && turn === pairTurns[i - 1] + 1)
  );
}

function relocateClue(givens, solution, random) {
  const kind = Math.floor(random() * 2);
  const filled = [],
    empty = [];
  givens.forEach((cell, i) => (cell[kind] ? filled : empty).push(i));
  const from = filled[Math.floor(random() * filled.length)];
  const to = empty[Math.floor(random() * empty.length)];
  givens[from][kind] = 0;
  givens[to][kind] = solution[to][kind];
}

function calibratedPuzzle(values, axis, profile, random) {
  const size = axis.length;
  const mask = profile.masks[Math.floor(random() * profile.masks.length)];
  // Moving clues and shuffling rows, columns and labels can change the hint
  // sequence. Grade the actual board that will be played on every attempt.
  for (let attempt = 0; attempt < 16; attempt++) {
    // Try keeping the known geometry before falling back to its original labels.
    const rows = attempt < 12 ? shuffle(axis, random) : axis;
    const columns = attempt < 12 ? shuffle(axis, random) : axis;
    const solution = makeSolution(
      rows,
      columns,
      shuffle(values, random),
      shuffle(values, random),
    );
    const givens = maskedGivens(solution, mask, rows, columns);
    if (attempt < 4) relocateClue(givens, solution, random);
    if (matchesProfile(givens, solution, profile))
      return { size, values, givens, solution };
  }
  // Every mask already meets its profile in this orientation, so retries are bounded.
  const solution = makeSolution(axis, axis, values, values);
  return {
    size,
    values,
    givens: maskedGivens(solution, mask, axis, axis),
    solution,
  };
}

export function createPuzzle(seed, level = 1, version = PUZZLE_VERSION) {
  const size = version === 1 || level < 2 ? 4 : 5;
  const { values } = layouts[size * size];
  const random = randomSource(seed);
  const axis = values.map((v) => v - 1);
  if (version === PUZZLE_VERSION)
    return calibratedPuzzle(values, axis, difficultyProfiles[level], random);

  // Reproduce started games using their original generation algorithm and RNG order.
  const r = shuffle(axis, random),
    c = shuffle(axis, random);
  const solution = makeSolution(
    r,
    c,
    shuffle(values, random),
    shuffle(values, random),
  );
  const tier = previousTiers[level];
  const target = version === 1 ? [13, 9, 7, 6][level] : tier.clues;
  let givens = copyBoard(solution);
  let remaining = solution.length * 2;
  for (const id of shuffle(
    Array.from({ length: remaining }, (_, i) => i),
    random,
  )) {
    const i = id >> 1,
      k = id % 2;
    const previous = givens[i][k];
    givens[i][k] = 0;
    if (solveByLogic(givens, solution).solved) remaining--;
    else givens[i][k] = previous;
    if (remaining === target) break;
  }
  // Expert puzzles also require reasoning about the location of a whole pair.
  if (
    version === 2 &&
    (remaining !== target ||
      (level === 3 && !solveByLogic(givens, solution).pairTurns.length))
  ) {
    givens = maskedGivens(solution, tier.mask, r, c);
  }
  return { size, values, givens, solution };
}
