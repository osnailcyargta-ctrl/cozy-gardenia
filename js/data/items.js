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

  reforge_coupon: {
    id: 'reforge_coupon', name: 'Reforge Coupon', stack: 9,
    desc: 'Spend instead of coins at an anvil',
  },

  // ---- book three ----
  digital_claw_cannon: {
    id: 'digital_claw_cannon', name: 'Digital Claw Cannon', stack: 1,
    desc: '6 dmg claw · right click swaps to the 18 dmg throw',
    // Two modes on one weapon. Right click swaps between them and left click
    // uses whichever is live, so `kind` describes the weapon rather than a
    // click. It works in every book — the modes belong to the weapon, not to
    // book three.
    weapon: {
      kind: 'claw', name: 'Digital Claw Cannon',
      // Mode one: two tiles of reach, a 0.2s swing and no cooldown at all,
      // which is 30 damage a second — this is the fast weapon in the game now.
      damage: 6, range: 32, arc: 1.7,
      swing: 0.2, cooldown: 0,
      projectileChip: 3,
      // Mode two: the hand itself, thrown.
      throwDamage: 18, throwCooldown: 0.4, throwSpeed: 240,
    },
  },

  portal_gun: {
    id: 'portal_gun', name: 'Portal Gun', stack: 1,
    desc: 'Opens a way into any book you have finished',
    weapon: {
      kind: 'portal', name: 'Portal Gun',
      damage: 4, range: 24, arc: 1.4,
      swing: 0.2, cooldown: 0.5,
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
