// The DEFRAG board.
//
// An errored gate is a picture of a circuit that has been shuffled. Click a tile
// next to the hole to slide it in; put the picture back together and the gate
// opens. Rooms one and two are 3×3, three and four are 4×4.
//
// The tiles are slices of one image rather than numbers, because a sliding
// puzzle is only readable when the edges of neighbouring tiles line up — a grid
// of digits gives you nothing to recognise a near-solution by.

import { PAL } from '../data/palette.js';
import { BOARD } from '../data/sprites.js';
import { sfx } from '../engine/audio.js';
import * as puzzle from '../systems/puzzle.js';

const popup = document.getElementById('puzzle-popup');
const titleEl = document.getElementById('puzzle-title');
const gridEl = document.getElementById('puzzle-grid');
const noteEl = document.getElementById('puzzle-note');

let game = null;
let gate = null;          // the gate this board belongs to
let cells = null;
let n = 3;
let moves = 0;

export function init(g) { game = g; }

export function isOpen() { return !popup.classList.contains('hidden'); }
export function close() { popup.classList.add('hidden'); gate = null; }

/** Paint the whole source image once, so tiles can be cut out of it. */
const SOURCE = (() => {
  const rows = BOARD.circuit[0];
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const x = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, cx) => {
    const col = PAL[ch];
    if (!col || ch === '.') return;
    x.fillStyle = col;
    x.fillRect(cx, y, 1, 1);
  }));
  return c;
})();

const CELL = 64;

/**
 * The board lives on the gate, not here, so walking away mid-puzzle and coming
 * back finds it exactly as you left it — and so a gate you already solved stays
 * solved without anyone having to remember that separately.
 */
export function open(g) {
  gate = g;
  n = g.board || 3;
  if (!g.cells) {
    g.cells = puzzle.scramble(n);
    g.moves = 0;
  }
  cells = g.cells;
  moves = g.moves || 0;
  popup.classList.remove('hidden');
  sfx.uiBig();
  build();
}

function build() {
  titleEl.textContent = `Defragment ${n}×${n}`;
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = `repeat(${n}, ${CELL}px)`;

  cells.forEach((tile, i) => {
    const el = document.createElement('div');
    el.className = 'pz-cell' + (tile === null ? ' hole' : '');
    if (tile !== null) {
      const c = document.createElement('canvas');
      c.width = CELL; c.height = CELL;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      // which slice of the source picture this tile is
      const sw = SOURCE.width / n, sh = SOURCE.height / n;
      const sx = (tile % n) * sw, sy = ((tile / n) | 0) * sh;
      x.drawImage(SOURCE, sx, sy, sw, sh, 0, 0, CELL, CELL);
      el.appendChild(c);
      // a tile that is already home reads as settled
      if (tile === i) el.classList.add('home');
    }
    el.addEventListener('click', () => onCell(i));
    gridEl.appendChild(el);
  });

  const left = cells.filter((t, i) => t !== null && t !== i).length;
  noteEl.textContent = puzzle.isSolved(cells)
    ? 'Restored.'
    : `${left} block${left === 1 ? '' : 's'} out of place · ${moves} move${moves === 1 ? '' : 's'}`;
}

function onCell(i) {
  if (!gate || puzzle.isSolved(cells)) return;
  if (!puzzle.slide(cells, n, i)) { sfx.denied(); return; }

  moves++;
  gate.moves = moves;
  sfx.ui();
  build();

  if (puzzle.isSolved(cells)) {
    noteEl.textContent = 'Restored.';
    gate.unlock();
    game.refreshInventory?.();
    // a beat to see the picture whole before the panel goes
    setTimeout(() => { if (isOpen()) close(); }, 700);
  }
}
