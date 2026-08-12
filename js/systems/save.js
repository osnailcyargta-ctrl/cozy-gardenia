// Persistence.
//
// One localStorage blob holds everything the world should remember between
// visits: which books are finished, what is in your satchel, and — per book,
// per room — which gates you opened and what is left in each chest.
//
// Enemies are deliberately NOT saved. What you took and what you broke stays
// taken and broken; the things guarding them come back, so a book you have
// already finished is still a book you can play.

// Bumped, with a new key, because saves written before the forge was included
// can strand you: the ore was banked in a chest the save had already emptied,
// so a book could be entered with no way left to finish it.
const KEY = 'itb.save.v2';
const LEGACY_KEYS = ['itb.save', 'itb.cleared'];
const VERSION = 2;

function blank() {
  return { v: VERSION, cleared: [], satchel: null, hotbar: 0, books: {} };
}

let data = load();
for (const k of LEGACY_KEYS) { try { localStorage.removeItem(k); } catch { /* ignore */ } }

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
export function restoreBook(bookIndex, rooms, smelter) {
  const saved = data.books[bookIndex];
  if (!saved) return false;

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
  });
  return true;
}

/** Forget everything — the reset button, and `game.wipeSave()` in the console. */
export function wipe() {
  data = blank();
  try {
    localStorage.removeItem(KEY);
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch { /* ignore */ }
}
