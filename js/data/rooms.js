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

/** Copy BLANK and punch exits into it. */
function shell({ right = false, left = false }) {
  const rows = BLANK.slice();
  if (right) {
    rows[7] = '#' + '.'.repeat(27) + 'EE';
    rows[8] = '#' + '.'.repeat(27) + 'EE';
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
    tiles: shell({ right: true }),
    spawn: { x: 120, y: 200 },
    spawnBack: { x: 420, y: 128 },
    mood: { fog: 0.4, vignette: 1.05, ambient: '#343048' },
    floor: 'stone',
    props: [
      { type: 'smelter', x: 72,  y: 128 },
      { type: 'chest',   x: 240, y: 128 },
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
    gate: { tx: 27, ty: 7, kind: 'wood', hp: 12 },
    enemies: [],
    exitTo: 1,
    backTo: 'library',
  },

  // ---------- Room 2: the servants ----------
  {
    id: 'b1r2',
    name: 'Hall of Coin',
    tiles: shell({ right: true }),
    spawn: { x: 60, y: 128 },
    spawnBack: { x: 420, y: 128 },
    mood: { fog: 0.3, vignette: 1, ambient: '#38304a' },
    floor: 'stone',
    props: [
      { type: 'coinPile', x: 64,  y: 72  },
      { type: 'coinPile', x: 64,  y: 184 },
      { type: 'coinPile', x: 416, y: 72  },
      { type: 'coinPile', x: 416, y: 184 },
      { type: 'coinPile', x: 40,  y: 128 },
      { type: 'coinPile', x: 440, y: 128 },
      { type: 'torch', x: 152, y: 40  },
      { type: 'torch', x: 328, y: 40  },
      { type: 'torch', x: 152, y: 216 },
      { type: 'torch', x: 328, y: 216 },
      { type: 'torch', x: 24,  y: 40  },
      { type: 'torch', x: 456, y: 40  },
    ],
    gate: { tx: 27, ty: 7, kind: 'locked' },
    enemies: [
      { type: 'servant', tier: 1, x: 300, y: 72  },
      { type: 'servant', tier: 1, x: 300, y: 184 },
      { type: 'servant', tier: 2, x: 380, y: 128 },
    ],
    exitTo: 2,
    backTo: null,
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
    enemies: [{ type: 'king', x: 340, y: 124 }],
    exitTo: null,
    backTo: null,
  },
];

export const BOOKS = [
  { id: 0, title: 'Greedy Ass Dragon', locked: false, rooms: BOOK1_ROOMS },
  { id: 1, title: '???', locked: true, rooms: null },
  { id: 2, title: '???', locked: true, rooms: null },
];
