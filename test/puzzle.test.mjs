import assert from "node:assert/strict";
import { test } from "node:test";
import {
  copyBoard,
  createPuzzle,
  isComplete,
  nextDeduction,
} from "../puzzle.mjs";

for (const [level, size, clues] of [
  [0, 4, 10],
  [1, 4, 6],
  [2, 5, 11],
  [3, 5, 12],
]) {
  test(`level ${level} produces a solvable ${size}×${size} board with ${clues} clues`, () => {
    for (const seed of ["2026-11-05", "2026-11-08", "fri-size-regression"]) {
      const puzzle = createPuzzle(seed, level);
      const board = copyBoard(puzzle.givens);
      assert.equal(puzzle.size, size);
      assert.equal(board.length, size * size);
      assert.equal(board.flat().filter(Boolean).length, clues);

      for (let step = nextDeduction(board); step; step = nextDeduction(board)) {
        assert.equal(board[step.i][step.k], 0);
        assert.equal(step.value, puzzle.solution[step.i][step.k]);
        board[step.i][step.k] = step.value;
      }
      assert.ok(isComplete(board, puzzle.solution));
      assert.equal(
        new Set(board.map((cell) => cell.join(","))).size,
        size * size,
      );
      for (let line = 0; line < size; line++) {
        const row = board.slice(line * size, (line + 1) * size);
        const column = board.filter((_, i) => i % size === line);
        for (const cells of [row, column]) {
          for (const k of [0, 1])
            assert.deepEqual(
              cells.map((cell) => cell[k]).sort(),
              puzzle.values,
            );
        }
      }
    }
  });
}

test("saved expert boards from version 1 retain their original clues and solution", () => {
  const puzzle = createPuzzle("fri-size-regression", 3, 1);
  assert.equal(puzzle.size, 4);
  assert.equal(
    puzzle.givens.map((cell) => cell.join("")).join(" "),
    "00 00 40 00 20 14 00 00 00 00 00 03 00 00 04 02",
  );
  assert.equal(
    puzzle.solution.map((cell) => cell.join("")).join(" "),
    "13 21 42 34 22 14 33 41 44 32 11 23 31 43 24 12",
  );
});

test("version 2 saves keep their exact givens after recalibration", () => {
  const expected = [
    "00 00 00 00 10 00 00 04 34 02 01 00 42 14 00 00",
    "21 00 00 00 00 00 30 04 00 00 00 03 00 10 00 00",
    "00 00 00 00 05 00 15 00 00 00 00 02 00 00 44 00 50 00 04 32 01 00 00 00 00",
    "00 00 00 00 00 00 05 03 40 21 30 00 00 00 00 20 51 40 04 00 00 30 00 00 00",
  ];
  expected.forEach((clues, level) => {
    const { givens } = createPuzzle("fri-calibration-regression", level, 2);
    assert.equal(givens.map((cell) => cell.join("")).join(" "), clues);
  });
});

test("generation grading on playable boards follows the calibrated tier progression", () => {
  const referenceFirstPair = [4, 7.33, 11, 5];
  for (const [level, reference] of referenceFirstPair.entries()) {
    let firstPairTotal = 0;
    const boards = new Set();
    for (let seed = 0; seed < 32; seed++) {
      const key = "test-profile-" + seed;
      const puzzle = createPuzzle(key, level);
      assert.deepEqual(createPuzzle(key, level), puzzle);
      boards.add(JSON.stringify(puzzle.givens));
      const board = copyBoard(puzzle.givens);
      const pairs = [];
      let turn = 0;
      for (let step = nextDeduction(board); step; step = nextDeduction(board)) {
        turn++;
        if (step.reason === "pair") pairs.push(turn);
        board[step.i][step.k] = step.value;
      }
      assert.ok(isComplete(board, puzzle.solution));
      assert.equal(pairs.length, level === 3 ? 3 : 1);
      firstPairTotal += pairs[0];
      if (level === 3) {
        assert.ok(pairs[2] - pairs[0] <= 7);
        assert.ok(pairs[1] === pairs[0] + 1 || pairs[2] === pairs[1] + 1);
      }
    }
    assert.equal(boards.size, 32);
    assert.ok(Math.abs(firstPairTotal / 32 - reference) < 2);
  }
});
