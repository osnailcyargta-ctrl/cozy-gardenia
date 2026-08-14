// Book four's room factory.
//
// Rooms are made on demand and thrown away behind you, so nothing here returns
// a fixed table like data/rooms.js does — it returns one room definition for
// one depth, built from a seeded generator so the room you are standing in
// stays the same room if it has to be rebuilt (on death, say).
//
// Every generated layout is flood-filled before it is handed back. A pillar
// that walls off the exit would be an unwinnable room in a book with no way
// back, and "looks fine to me" is exactly how the two progression blockers in
// books one and two got in.

import { TILE, VW, VH } from '../engine/canvas.js';

export const MILESTONE = 10;
export const MAX_ALIVE = 25;

/* ---------- seeded noise ---------- */

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* ---------- difficulty ---------- */

/**
 * How many, and how hard.
 *
 * The count grows by one every two rooms, and that "one" itself grows by one
 * every ten rooms. Left alone that reaches fifty-plus bodies, which is neither
 * playable nor drawable — so past MAX_ALIVE the surplus stops being more
 * monsters and becomes tougher ones instead.
 */
export function scaling(depth) {
  let want = 3;
  for (let d = 3; d <= depth; d += 2) want += 1 + Math.floor((d - 1) / 10);
  const count = Math.min(MAX_ALIVE, want);
  const surplus = want - count;
  return { want, count, statMul: +(1 + surplus * 0.06).toFixed(3) };
}

export const isMilestone = (depth) => depth % MILESTONE === 0;

/* ---------- layout ---------- */

const W = 30, H = 16;

function blankRows() {
  const rows = [];
  for (let y = 0; y < H; y++) {
    if (y < 2 || y > 13) rows.push('#'.repeat(W));
    else rows.push('#' + '.'.repeat(W - 2) + '#');
  }
  return rows;
}

/** Can you get from the spawn tile to the exit tile through this layout? */
function reaches(rows, from, to) {
  const seen = new Set();
  const key = (x, y) => y * W + x;
  const q = [from];
  seen.add(key(from[0], from[1]));
  while (q.length) {
    const [x, y] = q.pop();
    if (x === to[0] && y === to[1]) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (rows[ny][nx] === '#') continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return false;
}

/**
 * Carve pillars and broken walls into an empty shell. Milestone rooms are left
 * clear — you are meant to be able to reach the merchant and the portal without
 * negotiating anything.
 */
function carve(rand, depth) {
  const rows = blankRows();
  const grid = rows.map((r) => r.split(''));

  // the doorway out, always on the middle rows of the right wall
  grid[7][W - 1] = 'E';
  grid[8][W - 1] = 'E';

  if (!isMilestone(depth)) {
    const clumps = 2 + ((rand() * 4) | 0);
    for (let i = 0; i < clumps; i++) {
      const cx = 5 + ((rand() * (W - 12)) | 0);
      const cy = 3 + ((rand() * (H - 8)) | 0);
      const w = 1 + ((rand() * 3) | 0);
      const h = 1 + ((rand() * 3) | 0);
      for (let y = cy; y < cy + h; y++) {
        for (let x = cx; x < cx + w; x++) {
          if (y < 2 || y > 13 || x < 2 || x > W - 3) continue;
          // never wall the doorway rows next to the exit
          if (x > W - 6 && (y === 7 || y === 8)) continue;
          grid[y][x] = '#';
        }
      }
    }
  }

  return grid.map((r) => r.join(''));
}

/** A layout guaranteed to be walkable from the entrance to the exit. */
function layout(seed, depth) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const rows = carve(rng(seed + attempt * 7919), depth);
    if (reaches(rows, [2, 8], [W - 1, 8])) return rows;
  }
  return blankRows().map((r, y) => (y === 7 || y === 8 ? r.slice(0, W - 1) + 'E' : r));
}

/* ---------- population ---------- */

const KINDS = ['crawler', 'crawler', 'crawler', 'servant1', 'servant2', 'siren1'];

function spawnPoints(rand, rows, n) {
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 600) {
    const tx = 8 + ((rand() * (W - 12)) | 0);
    const ty = 3 + ((rand() * (H - 7)) | 0);
    if (rows[ty][tx] === '#') continue;
    const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
    // never right on top of where the player walks in
    if (x < 110) continue;
    out.push({ x, y });
  }
  return out;
}

/**
 * One room, at one depth. `runSeed` keeps a run's rooms stable across a rebuild
 * so dying and coming back does not reshuffle the floor under you.
 */
export function makeRoom(runSeed, depth) {
  const seed = (runSeed * 2654435761 + depth * 40503) >>> 0;
  const rand = rng(seed);
  const rows = layout(seed, depth);
  const milestone = isMilestone(depth);
  const { count, statMul } = scaling(depth);

  const props = [];
  const enemies = [];

  if (milestone) {
    // A landing: the way out, someone to trade with, and often a station.
    props.push({ type: 'portal', x: VW / 2, y: VH / 2 });
    props.push({ type: 'merchant', x: VW / 2 - 96, y: VH / 2 });
    const station = rand();
    if (station > 0.62) props.push({ type: 'anvil', x: VW / 2 + 96, y: VH / 2 - 8 });
    else if (station > 0.28) props.push({ type: 'smelter', x: VW / 2 + 96, y: VH / 2 });

    // Lit like somewhere you are meant to stop and stand about, not like the
    // rooms you fight through. Torches along both walls rather than four in the
    // far corners, which left the middle — where everything actually is — dark.
    for (const x of [56, 152, 248, 344, 424]) {
      props.push({ type: 'torch', x, y: 42 });
      props.push({ type: 'torch', x, y: VH - 38 });
    }
  } else {
    for (const p of spawnPoints(rand, rows, count)) {
      enemies.push({ type: KINDS[(rand() * KINDS.length) | 0], x: p.x, y: p.y, statMul });
    }

    // Torches go on the walls, the way they do everywhere else in the game.
    // Scattered across the middle of the floor they light almost nothing and
    // leave the room a black soup you cannot read the pillars out of.
    for (let i = 0; i < 4; i++) {
      const cx = 3 + i * 7 + ((rand() * 3) | 0);
      if (cx >= W - 2) continue;
      if (rows[2][cx] !== '#') props.push({ type: 'torch', x: cx * TILE + 8, y: 2 * TILE + 10 });
      if (rows[13][cx] !== '#') props.push({ type: 'torch', x: cx * TILE + 8, y: 13 * TILE + 10 });
    }
    // and one deeper in, so the light is not a flat band top and bottom
    for (let i = 0; i < 2; i++) {
      const tx = 4 + ((rand() * (W - 8)) | 0);
      const ty = 5 + ((rand() * 5) | 0);
      if (rows[ty][tx] === '#') continue;
      props.push({ type: 'torch', x: tx * TILE + 8, y: ty * TILE + 10 });
    }
  }

  return {
    id: `b4r${depth}`,
    name: `Dungeon · ${depth}`,
    depth,
    tiles: rows,
    // Sat in the middle of row 8, not on the seam at y=128. The player's box is
    // ten pixels tall, so spawning on a tile boundary leaves them half inside
    // the row above — and in a room with procedural pillars that means walking
    // in and immediately catching on something you cannot see you are touching.
    spawn: { x: 56, y: 136 },
    spawnBack: { x: 56, y: 136 },
    // Cold and low, but still lit enough to read the floor — a crypt, not a
    // blackout. A landing is brighter on purpose: it is where you stop.
    mood: milestone
      ? { fog: 0.26, vignette: 1.0, ambient: '#3e3660' }
      : { fog: 0.34, vignette: 1.08, ambient: '#342c50' },
    floor: 'crypt',
    props,
    gate: null,
    enemies,
    // Forward only. There is no `B` tile anywhere in this book: the door you
    // came through is sealed the moment you are through it.
    exitTo: depth + 1,
    backTo: null,
    milestone,
    statMul,
  };
}
