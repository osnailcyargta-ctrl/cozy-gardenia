// Where the Portal Gun is pointing.
//
// Four numbers: book, room, tile x, tile y. Books and rooms are numbered the
// way they are on the shelf and in the room label — starting at 1 — because
// asking a player for a zero-based index is asking them to read the source.
// Tiles are the map's own coordinates, so those start at 0, and **y counts
// downward**: y + 1 is one tile further down the screen.

import { BOOKS } from '../data/rooms.js';
import { sfx } from '../engine/audio.js';
import { parseDestination } from '../entities/portalgun.js';

const popup = document.getElementById('portal-popup');
const input = document.getElementById('portal-input');
const note = document.getElementById('portal-note');

let game = null;
let onAccept = null;

export function init(g) {
  game = g;
  document.getElementById('portal-go').addEventListener('click', accept);
  document.getElementById('portal-cancel').addEventListener('click', close);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') accept();
    if (e.key === 'Escape') close();
  });
}

export function isOpen() { return !popup.classList.contains('hidden'); }

export function close() {
  popup.classList.add('hidden');
  onAccept = null;
}

export function open(cb) {
  onAccept = cb;
  note.textContent = '';
  input.value = '';
  popup.classList.remove('hidden');
  sfx.uiBig();
  setTimeout(() => input.focus(), 0);
}

/** Everything that has to be true before a destination is worth opening. */
export function validate(dest) {
  if (!dest) return 'Four numbers: book room x y';
  const b = BOOKS[dest.book];
  if (!b) return 'No such book';
  if (b.infinite) return 'The dungeon is not a place you can aim at';
  if (!b.rooms) return 'That book is not written';
  if (!game.cleared.has(dest.book)) return 'Finish that book first';
  if (dest.room < 0 || dest.room >= b.rooms.length) {
    return `Book ${dest.book + 1} has ${b.rooms.length} rooms`;
  }
  const tiles = b.rooms[dest.room].tiles;
  if (dest.ty < 0 || dest.ty >= tiles.length
      || dest.tx < 0 || dest.tx >= tiles[0].length) {
    return `Tiles are 0-${tiles[0].length - 1} across, 0-${tiles.length - 1} down`;
  }
  // Landing inside a wall would be a hole you cannot climb out of.
  if (tiles[dest.ty][dest.tx] === '#') return 'That tile is solid';
  return null;
}

function accept() {
  const dest = parseDestination(input.value);
  const bad = validate(dest);
  if (bad) { note.textContent = bad; sfx.denied(); return; }
  const cb = onAccept;
  close();
  cb?.(dest);
}
