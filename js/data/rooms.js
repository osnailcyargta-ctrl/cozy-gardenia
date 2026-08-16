// Room definitions. Every room is exactly one screen: 30 x 16 tiles of 16px.
//
// Tile legend:  # wall   . floor   E forward exit   B backward exit

const SHELL = (rows) => rows;

const BLANK = SHELL([
  '##############################',
  '##############################',
  '#............................#',
  '#............................#',
  '#............................#',
  '#............................#',
  '#............................#',
  '#............................#',
  '#............................#',
  '#............................#',
  '#............................#',
  '#............................#',
  '#............................#',
  '#............................#',
  '##############################',
  '##############################',
]);

/**
 * Copy BLANK and punch exits into it.
 *
 * The exit must be a real doorway, not a gap in an open field. An earlier
 * version left column 28 as floor on every row, so the gate at column 27 stood
 * in the middle of open ground and the player could simply walk around it —
 * skipping the entire forge chain. Columns 28-29 are therefore wall everywhere
 * except the two doorway rows, so the gate is the only way through.
 */
function shell({ right = false, left = false }) {
  const rows = BLANK.slice();

  // seal the right side: col 28 and 29 become wall on every row
  for (let y = 2; y <= 13; y++) rows[y] = rows[y].slice(0, 28) + '##';

  if (right) {
    // col 28 = threshold the gate sits in, col 29 = the exit trigger
    rows[7] = rows[7].slice(0, 28) + '.E';
    rows[8] = rows[8].slice(0, 28) + '.E';
  }
  if (left) {
    rows[7] = 'BB' + rows[7].slice(2);
    rows[8] = 'BB' + rows[8].slice(2);
  }
  return rows;
}

/* ============================================================
   The library hub
   ============================================================ */

export const LIBRARY = {
  id: 'library',
  name: 'The Library',
  tiles: SHELL([
    '##############################',
    '##############################',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '##############################',
    '##############################',
  ]),
  spawn: { x: 240, y: 184 },
  mood: { fog: 0.34, vignette: 1.05, ambient: '#3c3459' },
  floor: 'wood',
  props: [
    { type: 'shelf', x: 240, y: 88 },
    { type: 'torch', x: 88,  y: 40  },
    { type: 'torch', x: 392, y: 40  },
    { type: 'torch', x: 24,  y: 128 },
    { type: 'torch', x: 456, y: 128 },
    { type: 'torch', x: 152, y: 216 },
    { type: 'torch', x: 328, y: 216 },
  ],
};

/* ============================================================
   Book 1 — "Greedy Ass Dragon"
   ============================================================ */

export const BOOK1_ROOMS = [
  // ---------- Room 1: the workshop ----------
  {
    id: 'b1r1',
    name: 'The Cold Forge',
    tiles: shell({ right: true, left: true }),
    spawn: { x: 120, y: 200 },
    spawnBack: { x: 420, y: 128 },
    mood: { fog: 0.4, vignette: 1.05, ambient: '#343048' },
    floor: 'stone',
    props: [
      { type: 'smelter', x: 72,  y: 128 },
      // Slot 1 holds the coal, slot 5 the ore — exactly enough for one sword
      // and not a scrap more.
      { type: 'chest',   x: 240, y: 128,
        contents: { 0: { id: 'coal', count: 1 }, 4: { id: 'iron_ore', count: 3 } } },
      { type: 'anvil',   x: 72,  y: 56  },
      { type: 'torch',   x: 24,  y: 40  },
      { type: 'torch',   x: 168, y: 40  },
      { type: 'torch',   x: 312, y: 40  },
      { type: 'torch',   x: 456, y: 40  },
      { type: 'torch',   x: 24,  y: 200 },
      { type: 'torch',   x: 168, y: 216 },
      { type: 'torch',   x: 312, y: 216 },
      { type: 'torch',   x: 456, y: 200 },
    ],
    gate: { tx: 28, ty: 7, kind: 'wood', hp: 72 },
    enemies: [],
    exitTo: 1,
    backTo: 'library',
  },

  // ---------- Room 2: the servants ----------
  {
    id: 'b1r2',
    name: 'Hall of Coin',
    tiles: shell({ right: true, left: true }),
    spawn: { x: 60, y: 128 },
    spawnBack: { x: 420, y: 128 },
    mood: { fog: 0.3, vignette: 1, ambient: '#38304a' },
    floor: 'stone',
    props: [
      { type: 'coinPile', x: 64,  y: 72  },
      { type: 'coinPile', x: 64,  y: 184 },
      { type: 'coinPile', x: 416, y: 72  },
      { type: 'coinPile', x: 416, y: 184 },
      { type: 'coinPile', x: 40,  y: 96  },
      { type: 'coinPile', x: 408, y: 96  },
      { type: 'torch', x: 152, y: 40  },
      { type: 'torch', x: 328, y: 40  },
      { type: 'torch', x: 152, y: 216 },
      { type: 'torch', x: 328, y: 216 },
      { type: 'torch', x: 24,  y: 40  },
      { type: 'torch', x: 456, y: 40  },
    ],
    gate: { tx: 28, ty: 7, kind: 'locked' },
    enemies: [
      { type: 'servant', tier: 1, x: 300, y: 72  },
      { type: 'servant', tier: 1, x: 300, y: 184 },
      { type: 'servant', tier: 2, x: 380, y: 128 },
    ],
    exitTo: 2,
    backTo: 0,
  },

  // ---------- Room 3: the Dragon King ----------
  {
    id: 'b1r3',
    name: "The Hoard",
    tiles: SHELL([
      '##############################',
      '##############################',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      'BB...........................#',
      'BB...........................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '##############################',
      '##############################',
    ]),
    spawn: { x: 64, y: 128 },
    spawnBack: { x: 64, y: 128 },
    mood: { fog: 0.26, vignette: 1.15, ambient: '#3a2c44' },
    floor: 'stone',
    props: [
      { type: 'coinPile', x: 400, y: 64  },
      { type: 'coinPile', x: 432, y: 96  },
      { type: 'coinPile', x: 400, y: 192 },
      { type: 'coinPile', x: 432, y: 160 },
      { type: 'coinPile', x: 448, y: 128 },
      { type: 'torch', x: 112, y: 40  },
      { type: 'torch', x: 264, y: 40  },
      { type: 'torch', x: 112, y: 216 },
      { type: 'torch', x: 264, y: 216 },
      { type: 'torch', x: 24,  y: 128 },
    ],
    gate: null,
    enemies: [{ type: 'king', x: 330, y: 118 }],
    exitTo: null,
    backTo: 1,
  },
];

/* ============================================================
   Book 2 — "Underwater Mommy"
   ============================================================ */

export const BOOK2_ROOMS = [
  // ---------- Room 1: the shallows ----------
  {
    id: 'b2r1',
    name: 'The Shallows',
    tiles: shell({ right: true, left: true }),
    spawn: { x: 72, y: 128 },
    spawnBack: { x: 420, y: 128 },
    mood: { fog: 0.5, vignette: 1.1, ambient: '#16323f' },
    floor: 'water',
    props: [
      // No chest here. This book only opens once book one is finished, and book
      // one cannot be finished without forging the sword — which the save keeps
      // for you across reloads.
      { type: 'coral', x: 40,  y: 56  },
      { type: 'coral', x: 72,  y: 200 },
      { type: 'coral', x: 200, y: 48  },
      { type: 'coral', x: 360, y: 56  },
      { type: 'coral', x: 40,  y: 208 },
      { type: 'coral', x: 216, y: 216 },
      { type: 'coral', x: 400, y: 208 },
      { type: 'coral', x: 424, y: 200 },
      { type: 'kelp', x: 128, y: 72  },
      { type: 'kelp', x: 152, y: 184 },
      { type: 'kelp', x: 288, y: 80  },
      { type: 'kelp', x: 312, y: 176 },
      { type: 'kelp', x: 392, y: 88  },
    ],
    gate: { tx: 28, ty: 7, kind: 'coral', hp: 90 },
    enemies: [
      { type: 'thrall', x: 280, y: 88  },
      { type: 'thrall', x: 300, y: 176 },
    ],
    exitTo: 1,
    backTo: 'library',
  },

  // ---------- Room 2: the vault ----------
  {
    id: 'b2r2',
    name: 'The Coral Vault',
    tiles: shell({ right: true, left: true }),
    spawn: { x: 60, y: 128 },
    spawnBack: { x: 420, y: 128 },
    mood: { fog: 0.42, vignette: 1.08, ambient: '#142e3b' },
    floor: 'water',
    props: [
      // The wave gun, in the top-right corner and nowhere near the door lane.
      { type: 'chest', x: 424, y: 56, title: 'Vault Chest',
        contents: { 0: { id: 'wave_gun' } } },
      // Nothing is hoarded here — the vault is a reef, not a treasury.
      { type: 'coral', x: 64,  y: 72  },
      { type: 'coral', x: 64,  y: 184 },
      { type: 'kelp',  x: 392, y: 200 },
      { type: 'kelp',  x: 232, y: 216 },
      { type: 'coral', x: 40,  y: 48  },
      { type: 'coral', x: 168, y: 48  },
      { type: 'coral', x: 296, y: 48  },
      { type: 'coral', x: 40,  y: 216 },
      { type: 'coral', x: 168, y: 216 },
      { type: 'coral', x: 320, y: 216 },
      { type: 'coral', x: 440, y: 208 },
      { type: 'kelp', x: 120, y: 128 },
      { type: 'kelp', x: 344, y: 120 },
    ],
    gate: { tx: 28, ty: 7, kind: 'locked', theme: 'coral', keyId: 'coral_key' },
    enemies: [
      { type: 'siren', tier: 1, x: 300, y: 80  },
      { type: 'siren', tier: 1, x: 300, y: 176 },
      { type: 'siren', tier: 2, x: 376, y: 128 },
    ],
    exitTo: 2,
    backTo: 0,
  },

  // ---------- Room 3: the throne ----------
  {
    id: 'b2r3',
    name: 'The Tide Throne',
    tiles: SHELL([
      '##############################',
      '##############################',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      'BB...........................#',
      'BB...........................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '##############################',
      '##############################',
    ]),
    spawn: { x: 64, y: 128 },
    spawnBack: { x: 64, y: 128 },
    mood: { fog: 0.36, vignette: 1.2, ambient: '#122834' },
    floor: 'water',
    props: [
      // The floor is kept clear: her tides sweep the whole room, so anything
      // solid out there would be cover she never agreed to.
      { type: 'coral', x: 40,  y: 40  },
      { type: 'coral', x: 40,  y: 216 },
      { type: 'coral', x: 440, y: 40  },
      { type: 'coral', x: 440, y: 216 },
      { type: 'coral', x: 400, y: 216 },
      { type: 'kelp', x: 24,  y: 88  },
      { type: 'kelp', x: 24,  y: 168 },
      { type: 'kelp', x: 456, y: 88  },
      { type: 'kelp', x: 456, y: 168 },
    ],
    gate: null,
    enemies: [{ type: 'queen', x: 340, y: 120 }],
    exitTo: null,
    backTo: 1,
  },
];


/* ============================================================
   BOOK THREE — Digital Matrix
   Five rooms. Every doorway is an errored gate: it cannot be hit open, only
   defragmented. The board sizes climb 3, 3, 4, 4 and the last room has no gate
   at all, because what is standing in it is the way out.
   ============================================================ */

const NB = (x, y) => ({ type: 'nullbyte', x, y });

export const BOOK3_ROOMS = [
  // ---------- Room 1: the first error ----------
  {
    id: 'b3r1',
    name: 'Boot Sector',
    tiles: shell({ right: true, left: true }),
    spawn: { x: 60, y: 128 },
    spawnBack: { x: 420, y: 128 },
    mood: { fog: 0.3, vignette: 1.06, ambient: '#1d3a2a' },
    floor: 'digital',
    props: [
      { type: 'void', x: 104, y: 168 },
      { type: 'void', x: 120, y: 200 },
      { type: 'void', x: 152, y: 72 },
      { type: 'void', x: 184, y: 104 },
      { type: 'void', x: 216, y: 56 },
      { type: 'void', x: 248, y: 152 },
      { type: 'void', x: 280, y: 168 },
      { type: 'void', x: 296, y: 56 },
      { type: 'void', x: 344, y: 72 },
      { type: 'void', x: 360, y: 56 },
      { type: 'void', x: 376, y: 152 },
      { type: 'void', x: 376, y: 184 },
      { type: 'void', x: 408, y: 168 },
      { type: 'void', x: 56, y: 56 },
      { type: 'torch', x: 120, y: 40 },
      { type: 'torch', x: 300, y: 40 },
      { type: 'torch', x: 120, y: 216 },
      { type: 'torch', x: 300, y: 216 },
      { type: 'torch', x: 24, y: 128 },
    ],
    gate: { tx: 28, ty: 7, kind: 'error', tier: 0 },
    enemies: [NB(320, 128)],
    exitTo: 1,
    backTo: 'library',
  },

  // ---------- Room 2: two of them ----------
  {
    id: 'b3r2',
    name: 'Stack Trace',
    tiles: shell({ right: true, left: true }),
    spawn: { x: 60, y: 128 },
    spawnBack: { x: 420, y: 128 },
    mood: { fog: 0.34, vignette: 1.08, ambient: '#1a3526' },
    floor: 'digital',
    props: [
      { type: 'void', x: 136, y: 104 },
      { type: 'void', x: 136, y: 184 },
      { type: 'void', x: 136, y: 88 },
      { type: 'void', x: 152, y: 200 },
      { type: 'void', x: 168, y: 56 },
      { type: 'void', x: 184, y: 200 },
      { type: 'void', x: 216, y: 152 },
      { type: 'void', x: 232, y: 168 },
      { type: 'void', x: 232, y: 184 },
      { type: 'void', x: 264, y: 152 },
      { type: 'void', x: 264, y: 184 },
      { type: 'void', x: 312, y: 184 },
      { type: 'void', x: 328, y: 168 },
      { type: 'void', x: 392, y: 184 },
      { type: 'void', x: 392, y: 88 },
      { type: 'void', x: 72, y: 200 },
      { type: 'void', x: 72, y: 56 },
      { type: 'void', x: 72, y: 72 },
      { type: 'torch', x: 88,  y: 40 },
      { type: 'torch', x: 232, y: 40 },
      { type: 'torch', x: 376, y: 40 },
      { type: 'torch', x: 88,  y: 216 },
      { type: 'torch', x: 232, y: 216 },
      { type: 'torch', x: 376, y: 216 },
    ],
    gate: { tx: 28, ty: 7, kind: 'error', tier: 1 },
    enemies: [NB(300, 76), NB(340, 184)],
    exitTo: 2,
    backTo: 0,
  },

  // ---------- Room 3: the nest ----------
  {
    id: 'b3r3',
    name: 'Heap',
    tiles: shell({ right: true, left: true }),
    spawn: { x: 60, y: 128 },
    spawnBack: { x: 420, y: 128 },
    mood: { fog: 0.36, vignette: 1.1, ambient: '#1a3526' },
    floor: 'digital',
    props: [
      { type: 'void', x: 136, y: 200 },
      { type: 'void', x: 168, y: 104 },
      { type: 'void', x: 168, y: 200 },
      { type: 'void', x: 168, y: 88 },
      { type: 'void', x: 184, y: 184 },
      { type: 'void', x: 232, y: 200 },
      { type: 'void', x: 296, y: 152 },
      { type: 'void', x: 296, y: 200 },
      { type: 'void', x: 312, y: 152 },
      { type: 'void', x: 328, y: 184 },
      { type: 'void', x: 328, y: 88 },
      { type: 'void', x: 376, y: 88 },
      { type: 'void', x: 408, y: 168 },
      { type: 'void', x: 56, y: 168 },
      { type: 'void', x: 56, y: 72 },
      { type: 'void', x: 88, y: 200 },
      // 2x2, so its box is 16 either way and it sits on a tile corner
      { type: 'nullbyteNest', x: 240, y: 128 },
      { type: 'torch', x: 80,  y: 40 },
      { type: 'torch', x: 400, y: 40 },
      { type: 'torch', x: 80,  y: 216 },
      { type: 'torch', x: 400, y: 216 },
      { type: 'torch', x: 24,  y: 128 },
    ],
    gate: { tx: 28, ty: 7, kind: 'error', tier: 2 },
    enemies: [NB(340, 80), NB(340, 176)],
    exitTo: 3,
    backTo: 1,
  },

  // ---------- Room 4: the last corridor ----------
  {
    id: 'b3r4',
    name: 'Kernel Space',
    tiles: shell({ right: true, left: true }),
    spawn: { x: 60, y: 128 },
    spawnBack: { x: 420, y: 128 },
    mood: { fog: 0.4, vignette: 1.12, ambient: '#173021' },
    floor: 'digital',
    props: [
      { type: 'void', x: 104, y: 152 },
      { type: 'void', x: 120, y: 104 },
      { type: 'void', x: 136, y: 104 },
      { type: 'void', x: 136, y: 72 },
      { type: 'void', x: 184, y: 104 },
      { type: 'void', x: 200, y: 200 },
      { type: 'void', x: 200, y: 56 },
      { type: 'void', x: 216, y: 152 },
      { type: 'void', x: 264, y: 152 },
      { type: 'void', x: 264, y: 168 },
      { type: 'void', x: 296, y: 88 },
      { type: 'void', x: 312, y: 104 },
      { type: 'void', x: 312, y: 184 },
      { type: 'void', x: 376, y: 168 },
      { type: 'void', x: 56, y: 152 },
      { type: 'void', x: 72, y: 104 },
      { type: 'void', x: 72, y: 168 },
      { type: 'void', x: 72, y: 72 },
      { type: 'void', x: 88, y: 152 },
      { type: 'void', x: 88, y: 184 },
      { type: 'void', x: 88, y: 200 },
      { type: 'void', x: 88, y: 72 },
      { type: 'torch', x: 104, y: 40 },
      { type: 'torch', x: 248, y: 40 },
      { type: 'torch', x: 392, y: 40 },
      { type: 'torch', x: 104, y: 216 },
      { type: 'torch', x: 248, y: 216 },
      { type: 'torch', x: 392, y: 216 },
    ],
    gate: { tx: 28, ty: 7, kind: 'error', tier: 3 },
    enemies: [NB(240, 68), NB(300, 128), NB(240, 188), NB(390, 128)],
    exitTo: 4,
    backTo: 2,
  },

  // ---------- Room 5: The Kernel ----------
  {
    id: 'b3r5',
    name: 'The Kernel',
    tiles: SHELL([
      '##############################',
      '##############################',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      'BB...........................#',
      'BB...........................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '#............................#',
      '##############################',
      '##############################',
    ]),
    spawn: { x: 64, y: 128 },
    spawnBack: { x: 64, y: 128 },
    mood: { fog: 0.3, vignette: 1.18, ambient: '#142c1d' },
    floor: 'digital',
    props: [
      { type: 'torch', x: 24,  y: 40  },
      { type: 'torch', x: 24,  y: 216 },
      { type: 'torch', x: 456, y: 40  },
      { type: 'torch', x: 456, y: 216 },
    ],
    gate: null,
    enemies: [{ type: 'kernel', x: 300, y: 128 }],
    exitTo: null,
    backTo: 3,
  },
];

/**
 * The shelf. `needs` is the book you must finish before the chains come off —
 * book two expects you to arrive carrying the sword book one taught you to
 * make. `needsDepth` is book three's second lock: it also wants you to have got
 * ten rooms deep into the dungeon, so it opens to someone who has both finished
 * a story and survived something that has no ending.
 */
export const BOOKS = [
  { id: 0, title: 'Greedy Ass Dragon', rooms: BOOK1_ROOMS },
  { id: 1, title: 'Underwater Mommy', rooms: BOOK2_ROOMS, needs: 0 },
  { id: 2, title: 'Digital Matrix', rooms: BOOK3_ROOMS, needs: 1, needsDepth: 10 },
  // Book four has no rooms table because its rooms do not exist until you walk
  // into them. `infinite` is what tells the rest of the game the difference
  // between "not written yet" and "never ends".
  { id: 3, title: 'Infinite Dungeon', rooms: null, infinite: true, needs: 0 },
];
