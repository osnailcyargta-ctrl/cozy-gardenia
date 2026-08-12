// Persistence.
//
// One localStorage blob holds everything the world should remember between
// visits: which books are finished, what is in your satchel, and — per book,
// per room — which gates you opened and what is left in each chest.
//
// Enemies are deliberately NOT saved. What you took and what you broke stays
// taken and broken; the things guarding them come back, so a book you have
// already finished is still a book you can play.

const KEY = 'itb.save';
const VERSION = 1;

function blank() {
  return { v: VERSION, cleared: [], satchel: null, hotbar: 0, books: {} };
}

let data = load();

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
export function saveBook(bookIndex, rooms, satchel, hotbarIndex) {
  data.books[bookIndex] = {
    rooms: rooms.map((room) => ({
      gateOpen: !!room.gate?.open,
      chests: room.props.filter((p) => p.container).map((p) => p.container.serialize()),
    })),
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
export function restoreBook(bookIndex, rooms) {
  const saved = data.books[bookIndex];
  if (!saved) return false;

  saved.rooms.forEach((snap, i) => {
    const room = rooms[i];
    if (!room) return;

    if (snap.gateOpen && room.gate && !room.gate.open) room.gate.openSilently();

    const chests = room.props.filter((p) => p.container);
    snap.chests?.forEach((slots, c) => chests[c]?.container.load(slots));
  });
  return true;
}

/** Debug helper: forget everything. */
export function wipe() {
  data = blank();
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
