// The sliding board behind book three's errored gates.
//
// A board is a flat array of n*n cells holding 0..n*n-2 plus one `null` for the
// hole. Solved means every cell holds its own index.
//
// The one thing that matters here: **the scramble must be built out of legal
// moves.** Exactly half of all arrangements of a sliding puzzle are unreachable
// from the solved state — shuffling by `sort(() => Math.random() - 0.5)` would
// hand roughly half of all players a gate that cannot be opened, in a book whose
// only way forward is through it. Walking the hole around at random cannot
// produce an unsolvable board, because every step is reversible by definition.

/** A finished board: cell i holds tile i, and the last cell is the hole. */
export function solved(n) {
  const cells = [];
  for (let i = 0; i < n * n - 1; i++) cells.push(i);
  cells.push(null);
  return cells;
}

export function isSolved(cells) {
  for (let i = 0; i < cells.length - 1; i++) if (cells[i] !== i) return false;
  return cells[cells.length - 1] === null;
}

export const holeAt = (cells) => cells.indexOf(null);

/** The cells you are allowed to click: the four orthogonal neighbours of the hole. */
export function movable(cells, n) {
  const h = holeAt(cells);
  const hx = h % n, hy = (h / n) | 0;
  const out = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = hx + dx, y = hy + dy;
    if (x < 0 || y < 0 || x >= n || y >= n) continue;
    out.push(y * n + x);
  }
  return out;
}

/**
 * Slide the tile at `i` into the hole. Returns true if it was a legal move —
 * the caller uses that to decide between a click sound and a refusal.
 */
export function slide(cells, n, i) {
  if (!movable(cells, n).includes(i)) return false;
  const h = holeAt(cells);
  cells[h] = cells[i];
  cells[i] = null;
  return true;
}

/**
 * A scrambled but always solvable board. `rand` is injectable so a room can
 * derive its board from its own seed and hand you the same puzzle every time
 * you walk back into it.
 */
export function scramble(n, steps = n * n * 12, rand = Math.random) {
  const cells = solved(n);
  let last = -1;
  for (let s = 0; s < steps; s++) {
    // never immediately undo the previous move, or the walk mostly stands still
    const options = movable(cells, n).filter((i) => i !== last);
    const pick = options[(rand() * options.length) | 0];
    last = holeAt(cells);
    slide(cells, n, pick);
  }
  // a scramble that happens to land on solved is not a puzzle
  return isSolved(cells) ? scramble(n, steps + 7, rand) : cells;
}

/**
 * Inversion parity, used only by the tests: a board is reachable from solved
 * when, for odd n, the inversion count is even; and for even n, inversions plus
 * the hole's row-from-the-bottom is odd.
 */
export function solvable(cells, n) {
  const flat = cells.filter((c) => c !== null);
  let inv = 0;
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) if (flat[i] > flat[j]) inv++;
  }
  if (n % 2 === 1) return inv % 2 === 0;
  const rowFromBottom = n - ((holeAt(cells) / n) | 0);
  return (inv + rowFromBottom) % 2 === 1;
}
