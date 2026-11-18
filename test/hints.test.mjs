import assert from "node:assert/strict";
import { test } from "node:test";
import { COLORS, coordinate, copyBoard, createPuzzle } from "../puzzle.mjs";
import * as hints from "../hints.mjs";
const { nextHint } = hints;

const parseBoard = (text) => text.split(" ").map((cell) => [...cell].map(Number));

for (const { name, board, expected } of [
  {
    name: "prefer a simple row/column deduction over eliminating used pairs",
    board: "50 01 00 30 40 20 40 51 10 30 10 50 33 41 20 40 05 00 50 11 31 00 40 22 50",
    expected: { i: 17, k: 0, value: 2, reason: "cell" },
  },
  {
    name: "prefer the final occurrence of a value over a pair-based cell deduction",
    board: "22 00 00 05 14 13 04 00 02 30 50 00 12 34 00 40 32 00 11 00 30 15 00 03 02",
    expected: { i: 2, k: 0, value: 3, reason: "row" },
  },
  {
    name: "prefer the value that already occurs more often on the board",
    board: "00 01 00 00 53 00 00 54 00 00 00 30 40 00 20 04 55 01 03 02 03 00 00 00 10",
    expected: { i: 12, k: 1, value: 3, reason: "column" },
  },
  {
    name: "break equally common value ties with the most filled line",
    board: "00 01 00 30 00 20 40 51 10 30 00 00 03 40 00 00 05 00 50 00 00 00 00 22 50",
    expected: { i: 11, k: 0, value: 5, reason: "column" },
  },
]) {
  test(name, () => assert.deepEqual(nextHint(parseBoard(board)).step, expected));
}

test("revealing a pair fills both attributes in one reversible cell change", () => {
  const board = parseBoard("00 01 00 00 10 05 04 00 00 00 00 32 05 00 00 30 03 00 50 40 50 05 01 00 00");
  const hint = nextHint(board);
  assert.equal(hint.step.reason, "pair");
  const before = copyBoard(board);
  assert.deepEqual(hints.hintChanges(board, hint), [
    { i: 3, previous: [0, 0], next: [3, 5] },
  ]);
  assert.deepEqual(board, before, "preparing a reveal must not mutate the board");
});

test("error hints clear only incorrect attributes across all affected cells", () => {
  const { solution } = createPuzzle("error-hint-regression", 2);
  const board = copyBoard(solution);
  board[0][0] = board[0][0] % 5 + 1;
  board[1][1] = board[1][1] % 5 + 1;
  assert.deepEqual(hints.hintChanges(board, { error: true, cells: [0, 1] }, solution), [
    { i: 0, previous: [...board[0]], next: [0, solution[0][1]] },
    { i: 1, previous: [...board[1]], next: [solution[1][0], 0] },
  ]);
});

test("hints leave either the value or the location for the player to deduce", () => {
  const seen = new Set();
  for (const [level, seed] of [
    [0, "2026-11-18"],
    [1, "hint-disclosure-regression"],
    [2, "2026-11-18"],
    [2, "hint-disclosure-regression"],
    [3, "hint-disclosure-regression"],
  ]) {
    const puzzle = createPuzzle(seed, level);
    const board = copyBoard(puzzle.givens);
    for (let turn = 0; turn < 50; turn++) {
      const before = copyBoard(board);
      const hint = nextHint(board);
      assert.deepEqual(board, before, "asking for a hint must not fill a cell");
      if (!hint) break;
      const { step, cell, message } = hint;
      seen.add(step.reason + ":" + step.k);
      assert.equal(step.value, puzzle.solution[step.i][step.k]);
      assert.equal(board[step.i][step.k], 0);

      if (step.reason === "pair") {
        const [number, color] = step.pair;
        assert.ok(message.includes(COLORS[color]), "name the actual color");
        assert.ok(message.includes(String(number)), "name the actual number");
        assert.equal(cell, null, "do not highlight or select the answer");
        assert.doesNotMatch(message, /[A-E][1-5]/, "do not announce its coordinates");
      } else {
        assert.equal(cell, step.i);
        assert.ok(message.startsWith(coordinate(step.i, puzzle.size) + " · "));
        const clue = message.split(" · ")[1];
        assert.doesNotMatch(clue, /[1-5]|blå|grøn|gul|rød|lilla/, "leave the value to deduce");
        assert.match(clue, step.k ? /farve/ : /tal/);
        if (step.reason === "row") assert.match(clue, /række/);
        if (step.reason === "column") assert.match(clue, /kolonne/);
      }
      for (const { i, next } of hints.hintChanges(board, hint)) board[i] = next;
    }
    assert.deepEqual(board, puzzle.solution);
    assert.equal(nextHint(board), null);
  }
  for (const kind of [
    "cell:0", "cell:1", "row:0", "row:1",
    "column:0", "column:1", "pair:0", "pair:1",
  ])
    assert.ok(seen.has(kind), "exercise " + kind);
});
