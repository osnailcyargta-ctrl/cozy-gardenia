// The board panel.
//
// Five by five. Hold anywhere on the grid and drag: the block steps one square
// per swipe, and a long drag keeps stepping as you go rather than making you
// let go and grab again for every square. Arrow keys and WASD do the same thing,
// for anyone who would rather not drag.

import { sfx } from '../engine/audio.js';
import * as puzzle from '../systems/puzzle.js';

const popup = document.getElementById('puzzle-popup');
const titleEl = document.getElementById('puzzle-title');
const gridEl = document.getElementById('puzzle-grid');
const noteEl = document.getElementById('puzzle-note');

let game = null;
let gate = null;
let board = null;

/** How far you have to drag before it counts as one swipe. */
const SWIPE = 28;

let dragging = false;
let ox = 0, oy = 0;

export function init(g) {
  game = g;

  gridEl.addEventListener('pointerdown', (e) => {
    if (!board || board.done) return;
    dragging = true;
    ox = e.clientX; oy = e.clientY;
    gridEl.setPointerCapture(e.pointerId);
  });

  gridEl.addEventListener('pointermove', (e) => {
    if (!dragging || !board || board.done) return;
    const dx = e.clientX - ox, dy = e.clientY - oy;
    if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) return;
    // dominant axis only — a diagonal drag should not move the block twice
    if (Math.abs(dx) > Math.abs(dy)) {
      push(Math.sign(dx), 0);
      ox = e.clientX; oy = e.clientY;
    } else {
      push(0, Math.sign(dy));
      ox = e.clientX; oy = e.clientY;
    }
  });

  const stop = (e) => {
    dragging = false;
    if (e.pointerId !== undefined && gridEl.hasPointerCapture?.(e.pointerId)) {
      gridEl.releasePointerCapture(e.pointerId);
    }
  };
  gridEl.addEventListener('pointerup', stop);
  gridEl.addEventListener('pointercancel', stop);

  window.addEventListener('keydown', (e) => {
    if (!isOpen() || !board || board.done) return;
    const d = {
      ArrowRight: [1, 0], KeyD: [1, 0],
      ArrowLeft: [-1, 0], KeyA: [-1, 0],
      ArrowDown: [0, 1], KeyS: [0, 1],
      ArrowUp: [0, -1], KeyW: [0, -1],
    }[e.code];
    if (!d) return;
    e.preventDefault();
    push(d[0], d[1]);
  });
}

export function isOpen() { return !popup.classList.contains('hidden'); }
export function close() { popup.classList.add('hidden'); gate = null; board = null; dragging = false; }

/**
 * The board lives on the gate, so walking away mid-puzzle and coming back finds
 * it exactly as you left it, and a gate you already opened stays open without
 * anyone having to remember that separately.
 */
export function open(g) {
  gate = g;
  if (!g.cells) g.cells = puzzle.generate(g.tier ?? 0);
  board = g.cells;
  popup.classList.remove('hidden');
  sfx.uiBig();
  build();
}

/** Exposed so the tests can drive a real swipe without faking pointer events. */
export function push(dx, dy) {
  if (!board || board.done) return 'done';
  const r = puzzle.step(board, dx, dy);
  if (r === 'blocked') { sfx.denied(); return r; }

  sfx.ui();
  build();

  if (r === 'done') {
    noteEl.textContent = 'Restored.';
    gate.unlock();
    // a beat to see it land before the panel goes
    setTimeout(() => { if (isOpen()) close(); }, 650);
  }
  return r;
}

function build() {
  titleEl.textContent = 'Defragment';
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = `repeat(${puzzle.N}, 56px)`;

  for (let c = 0; c < puzzle.N * puzzle.N; c++) {
    const el = document.createElement('div');
    el.className = 'pz-cell';
    if (board.walls[c]) el.classList.add('wall');
    if (c === board.hole) el.classList.add('hole');
    if (c === board.block) el.classList.add('block');
    gridEl.appendChild(el);
  }

  noteEl.textContent = board.done
    ? 'Restored.'
    : `Swipe the block into the void · ${board.moves} move${board.moves === 1 ? '' : 's'}`;
}
