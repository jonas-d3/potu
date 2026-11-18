import { COLORS, coordinate, nextHintDeduction } from "./puzzle.mjs";

export function nextHint(board) {
  const step = nextHintDeduction(board);
  if (!step) return null;

  // Keep the answer for “Vis” separate from the cell exposed by the hint.
  // Pair hints give the combination; finding its location is the puzzle.
  if (step.reason === "pair") {
    const [number, color] = step.pair;
    return {
      step,
      cell: null,
      message: `En ${COLORS[color]} ${number}'er kan kun stå ét sted på brættet.`,
    };
  }

  const subject = step.k ? "Én farve" : "Ét tal";
  const clues = {
    cell: `Kun ${step.k ? "én farve" : "ét tal"} passer her.`,
    row: `${subject} i denne række kan kun stå her.`,
    column: `${subject} i denne kolonne kan kun stå her.`,
  };
  return {
    step,
    cell: step.i,
    message:
      coordinate(step.i, Math.sqrt(board.length)) + " · " + clues[step.reason],
  };
}

// A reveal is one undoable action, including both halves of a pair or all errors.
export function hintChanges(board, hint, solution) {
  if (hint.error) {
    return hint.cells.map((i) => ({
      i,
      previous: [...board[i]],
      next: board[i].map((value, k) => (value === solution[i][k] ? value : 0)),
    }));
  }
  const { i, k, value, pair } = hint.step;
  const next = pair ? [...pair] : [...board[i]];
  if (!pair) next[k] = value;
  return [{ i, previous: [...board[i]], next }];
}
