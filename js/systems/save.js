// Persistence.
//
// One localStorage blob holds everything the world should remember between
// visits: which books are finished, what is in your satchel, and — per book,
// per room — which gates you opened, what is left in each chest, what is lying
// on the floor, and which enemies are already dead.
//
// Enemies used to be left out on purpose, so a finished book was still a book
// you could play. They are saved now, and that is the point: coins buy things
// from book four's merchant, and a book whose guards come back every time you
// open the cover is a coin printer.
//
// Ground drops are saved for a less obvious reason. Kill the servant carrying
// the key, leave the key on the floor, and walk out. The servant will not come
// back — so if the key is not saved either, it exists nowhere and the book can
// never be finished again.

import { devMode, DEV_SAVE_KEY } from './dev.js';

// Bumped, with a new key, because saves written before the forge was included
// can strand you: the ore was banked in a chest the save had already emptied,
// so a book could be entered with no way left to finish it.
const KEY = devMode() ? DEV_SAVE_KEY : 'itb.save.v2';
const LEGACY_KEYS = ['itb.save', 'itb.cleared'];
const VERSION = 2;

function blank() {
  return { v: VERSION, cleared: [], satchel: null, hotbar: 0, books: {} };
}

let data = load();
// Developer mode leaves the real save strictly alone — including its legacy
// keys, which are only ever swept on a normal boot.
if (!devMode()) {
  for (const k of LEGACY_KEYS) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || raw.v !== VERSION) return blank();
    return { ...blank(), ...raw };
  } catch {
    return blank();
  }
}

function flush() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch { /* private mode, or the quota is full — play on regardless */ }
}

/* ---------- books finished ---------- */

export function cleared() { return new Set(data.cleared); }

/**
 * Books finished on hard. Kept apart from `cleared` because they answer
 * different questions: one is "have you read this", the other is "have you read
 * this the hard way", and book three only opens for the second.
 */
export function hardCleared() { return new Set(data.hardCleared || []); }

export function markHardCleared(bookIndex) {
  data.hardCleared = data.hardCleared || [];
  if (!data.hardCleared.includes(bookIndex)) { data.hardCleared.push(bookIndex); flush(); }
}

export function markCleared(bookIndex) {
  if (!data.cleared.includes(bookIndex)) data.cleared.push(bookIndex);
  flush();
}

/* ---------- the satchel ---------- */
/* Saved because the unlock and the sword have to travel together: book two is
   only reachable once book one is finished, and book one is only finishable
   with a forged sword. Without this, a page reload would hand you an unlocked
   book two and empty hands. */

export function loadSatchel(container) {
  if (!data.satchel) return false;
  container.load(data.satchel);
  return true;
}

export function savedHotbar() { return data.hotbar | 0; }

/* ---------- per-book world state ---------- */

/**
 * Snapshot the rooms of the book you are leaving. Called on the way out to the
 * library, which is the moment the player thinks of as "done for now".
 */
export function saveBook(bookIndex, rooms, satchel, hotbarIndex, smelter) {
  data.books[bookIndex] = {
    rooms: rooms.map((room) => ({
      gateOpen: !!room.gate?.open,
      chests: room.props.filter((p) => p.container).map((p) => p.container.serialize()),
      // Enemies are recorded by their index in the room definition, not by their
      // position in the live list — the dead ones are never built, so a live
      // index would shift underneath us on the second visit.
      dead: [...room.deadFromSave, ...room.enemies.filter((e) => e.dead).map((e) => e.defIndex)],
      drops: room.drops.filter((d) => !d.dead)
        .map((d) => ({ id: d.id, count: d.count, x: Math.round(d.x), y: Math.round(d.y) })),
    })),
    // The forge is part of the world, not scenery. Starting an ore takes it out
    // of your satchel immediately, so throwing the smelter away on the way out
    // destroys that ore outright — and book one's economy is exactly tight
    // enough that losing one means never forging the sword.
    smelter: smelter ? smelter.serialize() : null,
  };
  if (satchel) data.satchel = satchel.serialize();
  data.hotbar = hotbarIndex | 0;
  flush();
}

/**
 * Put a freshly built set of rooms back into the state it was left in.
 * Rooms are still constructed normally first, so anything not covered here —
 * enemies above all — starts over.
 */
/**
 * Which enemies of a given room are already dead, so the room can be built
 * without them. Read before the rooms exist, which is why it is separate from
 * `restoreBook` — everything else there is applied to rooms already standing.
 */
export function deadEnemies(bookIndex, roomIndex) {
  return new Set(data.books[bookIndex]?.rooms?.[roomIndex]?.dead || []);
}

export function restoreBook(bookIndex, rooms, smelter) {
  const saved = data.books[bookIndex];
  if (!saved || !saved.rooms) return false;

  if (smelter) {
    if (saved.smelter) smelter.load(saved.smelter);
    else smelter.reset();
  }

  saved.rooms.forEach((snap, i) => {
    const room = rooms[i];
    if (!room) return;

    if (snap.gateOpen && room.gate && !room.gate.open) room.gate.openSilently();

    const chests = room.props.filter((p) => p.container);
    snap.chests?.forEach((slots, c) => chests[c]?.container.load(slots));

    for (const d of snap.drops || []) room.addDrop(d.id, d.x, d.y, d.count);
  });
  return true;
}

/* ---------- book four ---------- */
/* An endless book cannot store its rooms — there are infinitely many and it
   throws them away as you walk. What it stores instead is the seed they are all
   generated from, which is the same thing at a thousandth of the size: the same
   seed rebuilds the same layouts, the same monsters, and the same anvil on the
   same landing, exactly. */

export function deepest(bookIndex) { return data.books[bookIndex]?.deepest | 0; }

export function setDeepest(bookIndex, depth) {
  const b = (data.books[bookIndex] ||= {});
  if (depth > (b.deepest | 0)) { b.deepest = depth; flush(); }
}

/** The run's seed, minted once and then never again for this save. */
export function runSeed(bookIndex) {
  const b = (data.books[bookIndex] ||= {});
  if (!b.runSeed) {
    b.runSeed = ((Math.random() * 0xffffffff) >>> 0) || 1;
    flush();
  }
  return b.runSeed;
}

/**
 * Which merchant rows are already bought out, by depth. This one genuinely has
 * to be stored — it is a thing you did, not a thing the seed implies.
 */
export function soldRows(bookIndex, depth) {
  return data.books[bookIndex]?.sold?.[depth] || null;
}

export function markSold(bookIndex, depth, rows) {
  const b = (data.books[bookIndex] ||= {});
  (b.sold ||= {})[depth] = rows;
  flush();
}

export function saveDungeon(bookIndex, depth, satchel, hotbarIndex, smelter) {
  setDeepest(bookIndex, depth);
  const b = (data.books[bookIndex] ||= {});
  b.smelter = smelter ? smelter.serialize() : null;
  if (satchel) data.satchel = satchel.serialize();
  data.hotbar = hotbarIndex | 0;
  flush();
}

/** The dungeon's forge, which survives a trip home like every other book's. */
export function restoreDungeon(bookIndex, smelter) {
  const saved = data.books[bookIndex];
  if (!smelter) return;
  if (saved?.smelter) smelter.load(saved.smelter);
  else smelter.reset();
}

/** Forget everything — the reset button, and `game.wipeSave()` in the console. */
export function wipe() {
  data = blank();
  try {
    localStorage.removeItem(KEY);
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch { /* ignore */ }
}
