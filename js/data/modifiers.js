// Weapon modifiers.
//
// A weapon in a satchel slot is `{ id, count, mod }`. The base numbers live in
// ITEM_DEFS and never change; a modifier multiplies them on the way out, so the
// same iron sword can be a fast weak one or a slow heavy one without needing a
// separate item for each.
//
// "Speed" here is swing speed — the cooldown between attacks — not how fast you
// walk.

export const MODS = {
  light: {
    name: 'Light', colour: '#8fd7ff',
    speed: 1.3, damage: 0.75, crit: 0,
    blurb: 'faster swing, softer hit',
  },
  heavy: {
    name: 'Heavy', colour: '#e8a05a',
    speed: 0.75, damage: 1.4, crit: 0,
    blurb: 'slower swing, harder hit',
  },
  broken: {
    name: 'Broken', colour: '#8a7f96',
    speed: 0.8, damage: 0.7, crit: 0,
    blurb: 'slower and weaker — reforge again',
  },
  legendary: {
    name: 'Legendary', colour: '#f0cc5a',
    speed: 1.15, damage: 1.35, crit: 0.25,
    blurb: 'faster, harder, and it bites',
  },
};

/** Damage multiplier applied when a swing crits. */
export const CRIT_MULT = 1.75;

/**
 * Roll tables. Forging a new blade can come out plain, but it can never come
 * out broken — you only break a weapon by gambling with one you already have.
 */
const FORGE_TABLE = [
  [null, 45], ['light', 22], ['heavy', 22], ['legendary', 11],
];
const REFORGE_TABLE = [
  [null, 35], ['light', 22], ['heavy', 22], ['broken', 16], ['legendary', 5],
];

function roll(table) {
  const total = table.reduce((n, [, w]) => n + w, 0);
  let r = Math.random() * total;
  for (const [id, w] of table) {
    r -= w;
    if (r <= 0) return id;
  }
  return null;
}

export function rollForge() { return roll(FORGE_TABLE); }
export function rollReforge() { return roll(REFORGE_TABLE); }

export const REFORGE_COST = 20;

/**
 * Derive the weapon a slot actually swings. Returns the base object untouched
 * when there is no modifier, so unmodded weapons stay reference-equal and
 * nothing downstream has to care that modifiers exist.
 */
export function applyMod(base, mod) {
  const m = MODS[mod];
  if (!base || !m) return base;
  return {
    ...base,
    damage: Math.max(1, Math.round(base.damage * m.damage)),
    cooldown: +(base.cooldown / m.speed).toFixed(3),
    crit: m.crit,
    mod,
    modName: m.name,
    modColour: m.colour,
  };
}

/** "Heavy Iron Sword", or just "Iron Sword". */
export function displayName(baseName, mod) {
  return MODS[mod] ? `${MODS[mod].name} ${baseName}` : baseName;
}

export function modColour(mod) { return MODS[mod]?.colour || null; }
