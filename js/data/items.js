// Item definitions. `smeltsTo` drives the smelter, `stack` the inventory.
//
// A weapon's `kind` decides how a swing is resolved: 'melee' runs an arc test
// against whatever is in front of you, 'wave' plants a lingering cone in the
// world instead. Anything without a kind is melee.

export const ITEM_DEFS = {
  coal:       { id: 'coal',       name: 'Coal',       stack: 64, desc: 'Fuel · 3 ore' },
  iron_ore:   { id: 'iron_ore',   name: 'Iron Ore',   stack: 64, desc: 'Smelts to iron bar', smeltsTo: 'iron_bar' },
  iron_bar:   { id: 'iron_bar',   name: 'Iron Bar',   stack: 64, desc: '3 → iron sword' },
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', stack: 1,  desc: '18 damage · 2 block reach', weapon: { kind: 'melee', damage: 18, range: 32, arc: 1.5, cooldown: 0.36, projectileChip: 5, name: 'Iron Sword' } },
  key:        { id: 'key',        name: 'Dragon Key', stack: 8,  desc: 'Opens a sealed gate' },
  gold_coin:  { id: 'gold_coin',  name: 'Gold Coin',  stack: 64, desc: '' },

  // ---- book two ----
  coral_key: { id: 'coral_key', name: 'Coral Key', stack: 8, desc: 'Opens a drowned gate' },

  // ---- book three ----
  digital_claw_cannon: {
    id: 'digital_claw_cannon', name: 'Digital Claw Cannon', stack: 1,
    desc: '6 dmg claw · right click throws it for 18',
    // Two modes, so `kind` only describes the left click. The right click is
    // handled where interaction is: point at empty floor and the hand goes.
    weapon: {
      kind: 'claw', name: 'Digital Claw Cannon',
      damage: 6, range: 26, arc: 1.7,
      // The swing animation runs first and the cooldown only starts once it is
      // over, so a full claw is 0.8s end to end.
      swing: 0.5, cooldown: 0.3,
      projectileChip: 3,
      throwDamage: 18, throwCooldown: 0.4, throwSpeed: 240,
    },
  },

  // ---- book four ----
  crypt_key: { id: 'crypt_key', name: 'Crypt Key', stack: 8, desc: 'Opens the way deeper' },

  blackholian_nest: {
    id: 'blackholian_nest', name: "Blackholian's Nest", stack: 8,
    desc: 'Place it · spits a black hole every 5s',
    // Not a weapon: left click puts it down instead of swinging, and the item
    // is spent doing it.
    weapon: { kind: 'place', name: "Blackholian's Nest", damage: 0, range: 48, arc: 0, cooldown: 0.35, projectileChip: 0 },
  },
  wave_gun: {
    id: 'wave_gun', name: 'Wave Gun', stack: 1,
    desc: '9 damage · 4 block cone · leaves a slowing tide',
    weapon: {
      kind: 'wave',
      name: 'Wave Gun',
      damage: 9,            // the hit the cast itself lands
      range: 64,            // 4 blocks
      arc: 0.9,             // ~50 degrees
      cooldown: 2,          // long enough that waves can't be stacked
      projectileChip: 4,
      // the field it leaves behind
      duration: 1.5,
      tick: 8,
      tickMin: 0.2,
      tickMax: 0.7,
      slow: 0.45,
    },
  },
};

/**
 * Bare hands do NOT damage anything — not enemies, not wood. The sword is the
 * only way to deal damage at all, which is what makes the forge mandatory.
 *
 * `projectileChip` is deliberately separate from `damage`: batting a fireball
 * out of the air is its own interaction rather than damage, so bare hands can
 * still do it — just slower (5 swings against the sword's 2).
 */
export const FIST = { kind: 'melee', damage: 0, range: 20, arc: 1.2, cooldown: 0.3, projectileChip: 2, name: 'Fists', isFist: true };

export function def(id) { return ITEM_DEFS[id]; }
export function maxStack(id) { return ITEM_DEFS[id]?.stack ?? 64; }
