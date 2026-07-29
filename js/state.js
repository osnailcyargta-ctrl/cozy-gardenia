/**
 * Game state: shape, persistence, and the growth model.
 *
 * Growth uses an accumulator (`growthMs`) advanced by a pure function of
 * (lastAdvanceAt -> now, lastWateredAt). Watering is a speed bonus rather than a
 * hard gate, so a single "wet until" window is enough to resolve any elapsed
 * span exactly — including a span the player spent away from the tab. That
 * makes offline catch-up a single advanceAll() call on load.
 */

import { POTS, getPotDef } from './data/pots.js';
import { getPlant, isPlantId } from './data/plants.js';
import { now } from './time.js';

export const SAVE_KEY = 'gardenia.save.v1';
export const SAVE_VERSION = 1;

export const STARTING_COINS = 60;
/** How long soil stays damp after a watering. */
export const WET_MS = 25_000;
/** Growth rate multiplier while the soil is dry. */
export const DRY_RATE = 0.5;
/** Cap on offline catch-up so a week away doesn't trivialise the garden. */
export const MAX_OFFLINE_MS = 8 * 60 * 60 * 1000;

export const MERCHANT_RESTOCK_MS = 60_000;
export const MERCHANT_SLOTS = 3;

export const STAGES = [
  { id: 'seed', label: 'Seed', at: 0 },
  { id: 'sprout', label: 'Sprout', at: 0.25 },
  { id: 'bud', label: 'Bud', at: 0.6 },
  { id: 'bloom', label: 'Bloom', at: 1 },
];

/* ------------------------------------------------------------------ state -- */

function freshPot(def) {
  return {
    id: def.id,
    unlocked: def.unlock.type === 'start',
    seedId: null,
    plantedAt: 0,
    lastWateredAt: 0,
    growthMs: 0,
    lastAdvanceAt: 0,
  };
}

export function createState(startedAt = now()) {
  return {
    version: SAVE_VERSION,
    coins: STARTING_COINS,
    pots: POTS.map(freshPot),
    inventory: { marigold: 3, basil: 2 },
    merchant: { stock: [], lastRestockAt: startedAt },
    stats: { harvests: 0, coinsEarned: 0, seedsBought: 0 },
    lastSeenAt: startedAt,
  };
}

/** The single live state object. Replaced only by load()/reset(). */
export let state = createState();

/* ------------------------------------------------------------ persistence -- */

function sanitise(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version !== SAVE_VERSION) return null;

  const clean = createState();
  clean.coins = Number.isFinite(raw.coins) ? Math.max(0, Math.floor(raw.coins)) : STARTING_COINS;

  if (Array.isArray(raw.pots)) {
    for (const potDef of POTS) {
      const saved = raw.pots.find((p) => p && p.id === potDef.id);
      const target = clean.pots.find((p) => p.id === potDef.id);
      if (!saved || !target) continue;
      // A boss pot can never be unlocked yet — bosses aren't implemented.
      const unlockable = potDef.unlock.type !== 'boss';
      target.unlocked = target.unlocked || (unlockable && saved.unlocked === true);
      if (isPlantId(saved.seedId)) {
        target.seedId = saved.seedId;
        target.plantedAt = Number.isFinite(saved.plantedAt) ? saved.plantedAt : 0;
        target.lastWateredAt = Number.isFinite(saved.lastWateredAt) ? saved.lastWateredAt : 0;
        target.growthMs = Number.isFinite(saved.growthMs) ? Math.max(0, saved.growthMs) : 0;
        target.lastAdvanceAt = Number.isFinite(saved.lastAdvanceAt) ? saved.lastAdvanceAt : 0;
      }
    }
  }

  if (raw.inventory && typeof raw.inventory === 'object') {
    clean.inventory = {};
    for (const [id, count] of Object.entries(raw.inventory)) {
      if (isPlantId(id) && Number.isFinite(count) && count > 0) {
        clean.inventory[id] = Math.floor(count);
      }
    }
  }

  if (raw.merchant && typeof raw.merchant === 'object') {
    clean.merchant.lastRestockAt = Number.isFinite(raw.merchant.lastRestockAt)
      ? raw.merchant.lastRestockAt
      : now();
    if (Array.isArray(raw.merchant.stock)) {
      clean.merchant.stock = raw.merchant.stock
        .filter((s) => s && isPlantId(s.seedId) && Number.isFinite(s.price))
        .slice(0, MERCHANT_SLOTS)
        .map((s) => ({ seedId: s.seedId, price: Math.max(1, Math.floor(s.price)), sold: s.sold === true }));
    }
  }

  if (raw.stats && typeof raw.stats === 'object') {
    for (const key of Object.keys(clean.stats)) {
      if (Number.isFinite(raw.stats[key])) clean.stats[key] = Math.max(0, Math.floor(raw.stats[key]));
    }
  }

  clean.lastSeenAt = Number.isFinite(raw.lastSeenAt) ? raw.lastSeenAt : now();
  return clean;
}

/**
 * Pull any timestamp that sits in the future back to the present.
 *
 * A save is written against the wall clock, so a backwards clock jump — an NTP
 * correction, a timezone fix, a manually changed system clock — leaves stored
 * timestamps ahead of `now()`. Left alone that yields negative elapsed spans,
 * which surface as a restock countdown above its own period and soil that
 * reads as permanently wet.
 */
function normaliseClock(t) {
  for (const pot of state.pots) {
    if (pot.plantedAt > t) pot.plantedAt = t;
    if (pot.lastWateredAt > t) pot.lastWateredAt = t;
    if (pot.lastAdvanceAt > t) pot.lastAdvanceAt = t;
  }
  if (state.merchant.lastRestockAt > t) state.merchant.lastRestockAt = t;
  if (state.lastSeenAt > t) state.lastSeenAt = t;
}

export function load() {
  let parsed = null;
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (text) parsed = sanitise(JSON.parse(text));
  } catch (err) {
    console.warn('[gardenia] save was unreadable, starting fresh', err);
  }
  state = parsed ?? createState();
  normaliseClock(now());
  return state;
}

let saveTimer = null;

export function save() {
  try {
    state.lastSeenAt = now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[gardenia] could not write save', err);
  }
}

/** Coalesces the many small mutations a tick produces into one write. */
export function scheduleSave() {
  if (saveTimer !== null) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    save();
  }, 500);
}

export function flushSave() {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  save();
}

export function reset() {
  state = createState();
  flushSave();
  return state;
}

/* ---------------------------------------------------------------- growth -- */

export function isWet(pot, t = now()) {
  return pot.seedId !== null && t < pot.lastWateredAt + WET_MS;
}

export function wetRemaining(pot, t = now()) {
  return Math.max(0, pot.lastWateredAt + WET_MS - t);
}

/**
 * Roll a pot's growth forward to `t`. Pure with respect to the pot's own
 * timestamps, so one call resolves an arbitrary gap (a tick or a day offline).
 */
export function advancePot(pot, t = now()) {
  if (pot.seedId === null) return pot;
  const from = pot.lastAdvanceAt || pot.plantedAt || t;
  const to = Math.min(t, from + MAX_OFFLINE_MS);
  const span = to - from;
  if (span <= 0) {
    pot.lastAdvanceAt = t;
    return pot;
  }

  const wetUntil = pot.lastWateredAt + WET_MS;
  const wetSpan = Math.max(0, Math.min(to, wetUntil) - from);
  const drySpan = span - wetSpan;

  pot.growthMs += wetSpan + drySpan * DRY_RATE;
  pot.lastAdvanceAt = t;
  return pot;
}

export function advanceAll(t = now()) {
  for (const pot of state.pots) advancePot(pot, t);
}

export function potProgress(pot) {
  const plant = getPlant(pot.seedId);
  if (!plant) return 0;
  return Math.min(1, pot.growthMs / plant.growMs);
}

export function potStage(pot) {
  const p = potProgress(pot);
  let stage = STAGES[0];
  for (const s of STAGES) if (p >= s.at) stage = s;
  return stage;
}

export function isReady(pot) {
  return pot.seedId !== null && potProgress(pot) >= 1;
}

/** Remaining real-world ms to bloom at the pot's current watering state. */
export function timeToBloom(pot, t = now()) {
  const plant = getPlant(pot.seedId);
  if (!plant) return 0;
  const remaining = plant.growMs - pot.growthMs;
  if (remaining <= 0) return 0;
  const wetLeft = wetRemaining(pot, t);
  if (remaining <= wetLeft) return remaining;
  return wetLeft + (remaining - wetLeft) / DRY_RATE;
}

/* ------------------------------------------------------------- inventory -- */

export function seedCount(seedId) {
  return state.inventory[seedId] ?? 0;
}

export function addSeed(seedId, count = 1) {
  if (!isPlantId(seedId)) return;
  state.inventory[seedId] = seedCount(seedId) + count;
  scheduleSave();
}

export function removeSeed(seedId, count = 1) {
  const have = seedCount(seedId);
  if (have < count) return false;
  if (have === count) delete state.inventory[seedId];
  else state.inventory[seedId] = have - count;
  scheduleSave();
  return true;
}

export function totalSeeds() {
  return Object.values(state.inventory).reduce((a, b) => a + b, 0);
}

/* ----------------------------------------------------------------- coins -- */

export function addCoins(amount) {
  state.coins += amount;
  if (amount > 0) state.stats.coinsEarned += amount;
  scheduleSave();
}

export function spendCoins(amount) {
  if (state.coins < amount) return false;
  state.coins -= amount;
  scheduleSave();
  return true;
}

/* ------------------------------------------------------------------ pots -- */

export function getPot(id) {
  return state.pots.find((p) => p.id === id) ?? null;
}

export function unlockedPotCount() {
  return state.pots.filter((p) => p.unlocked).length;
}

/** Buyable pots depend only on coins — never on an unimplemented boss. */
export function canBuyPot(id) {
  const def = getPotDef(id);
  const pot = getPot(id);
  if (!def || !pot || pot.unlocked) return false;
  return def.unlock.type === 'buy' && state.coins >= def.unlock.cost;
}

export function buyPot(id) {
  if (!canBuyPot(id)) return false;
  const def = getPotDef(id);
  if (!spendCoins(def.unlock.cost)) return false;
  getPot(id).unlocked = true;
  flushSave();
  return true;
}
