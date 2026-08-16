// The board behind book three's errored gates.
//
// A 5x5 grid holding one block, some walls, and one hole. Swipe and the block
// steps one square that way. Walls and the edge of the grid stop it. Reach the
// hole and the gate opens.
//
// The one thing that matters here: **every generated board is checked with a
// breadth-first search before it is handed out.** Walls are placed at random,
// and random walls can fence the block off from the hole completely — in a book
// whose only way forward is through that gate. The same search also measures the
// shortest solution, which is what lets the four gates get harder in a way that
// is actually measured rather than hoped for.

export const N = 5;

export const WALL = 1;

/** How hard each of the four gates is, in shortest-path steps. */
export const TIERS = [
  { walls: 4, min: 3, max: 4 },
  { walls: 6, min: 4, max: 6 },
  { walls: 8, min: 6, max: 8 },
  { walls: 10, min: 8, max: 11 },
];

const idx = (x, y) => y * N + x;
const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Shortest number of steps from the block to the hole, or -1 if the walls have
 * cut it off. Plain BFS over the open cells.
 */
export function solveLength(board) {
  const seen = new Uint8Array(N * N);
  let frontier = [board.block];
  seen[board.block] = 1;
  let steps = 0;
  while (frontier.length) {
    if (frontier.includes(board.hole)) return steps;
    const next = [];
    for (const c of frontier) {
      const x = c % N, y = (c / N) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!inside(nx, ny)) continue;
        const k = idx(nx, ny);
        if (seen[k] || board.walls[k]) continue;
        seen[k] = 1;
        next.push(k);
      }
    }
    frontier = next;
    steps++;
  }
  return -1;
}

/** The actual route, for the tests to play back through real swipes. */
export function solvePath(board) {
  const prev = new Int16Array(N * N).fill(-1);
  const seen = new Uint8Array(N * N);
  const q = [board.block];
  seen[board.block] = 1;
  while (q.length) {
    const c = q.shift();
    if (c === board.hole) {
      const out = [];
      for (let at = c; at !== board.block; at = prev[at]) out.unshift(at);
      return out;
    }
    const x = c % N, y = (c / N) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inside(nx, ny)) continue;
      const k = idx(nx, ny);
      if (seen[k] || board.walls[k]) continue;
      seen[k] = 1;
      prev[k] = c;
      q.push(k);
    }
  }
  return null;
}

/**
 * A board for the given tier. Retries until the search says the hole is
 * reachable AND the shortest route is as long as this gate is supposed to be.
 * The band is widened rather than given up on, so this always returns something
 * playable even on an unlucky run of walls.
 */
export function generate(tier = 0, rand = Math.random) {
  const t = TIERS[Math.min(tier, TIERS.length - 1)];
  for (let attempt = 0; attempt < 600; attempt++) {
    const slack = (attempt / 150) | 0;
    const walls = new Uint8Array(N * N);
    let placed = 0;
    while (placed < t.walls) {
      const c = (rand() * N * N) | 0;
      if (walls[c]) continue;
      walls[c] = WALL;
      placed++;
    }
    const free = [];
    for (let c = 0; c < N * N; c++) if (!walls[c]) free.push(c);
    if (free.length < 2) continue;

    const block = free[(rand() * free.length) | 0];

    // One search from the block, keeping every cell by its distance. Picking the
    // hole out of that is what makes this cheap: rolling a random hole and
    // throwing the board away when it was the wrong distance meant hundreds of
    // rejected boards per gate on the harder tiers, which was slow enough to
    // hang a test run.
    const dist = new Int16Array(N * N).fill(-1);
    dist[block] = 0;
    const q = [block];
    const byDist = new Map();
    while (q.length) {
      const c = q.shift();
      const x = c % N, y = (c / N) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!inside(nx, ny)) continue;
        const k = idx(nx, ny);
        if (dist[k] >= 0 || walls[k]) continue;
        dist[k] = dist[c] + 1;
        if (!byDist.has(dist[k])) byDist.set(dist[k], []);
        byDist.get(dist[k]).push(k);
        q.push(k);
      }
    }

    const wanted = [];
    for (const [d, cells] of byDist) {
      if (d >= t.min - slack && d <= t.max + slack) wanted.push(...cells);
    }
    if (!wanted.length) continue;

    const hole = wanted[(rand() * wanted.length) | 0];
    return { n: N, walls, block, hole, start: block, moves: 0, done: false };
  }
  // A board is not optional: an open grid with the hole across the room.
  const walls = new Uint8Array(N * N);
  return { n: N, walls, block: idx(0, 2), hole: idx(N - 1, 2), start: idx(0, 2), moves: 0, done: false };
}

/**
 * Step the block one square. Returns 'moved', 'blocked', or 'done' — the caller
 * uses that to pick between a click, a refusal, and opening the gate.
 */
export function step(board, dx, dy) {
  if (board.done) return 'done';
  const x = board.block % N, y = (board.block / N) | 0;
  const nx = x + dx, ny = y + dy;
  if (!inside(nx, ny)) return 'blocked';
  const k = idx(nx, ny);
  if (board.walls[k]) return 'blocked';
  board.block = k;
  board.moves++;
  if (k === board.hole) { board.done = true; return 'done'; }
  return 'moved';
}
