// Item definitions. `smeltsTo` drives the smelter, `stack` the inventory.

export const ITEM_DEFS = {
  coal:       { id: 'coal',       name: 'Coal',       stack: 64, desc: 'Fuel · 3 ore' },
  iron_ore:   { id: 'iron_ore',   name: 'Iron Ore',   stack: 64, desc: 'Smelts to iron bar', smeltsTo: 'iron_bar' },
  iron_bar:   { id: 'iron_bar',   name: 'Iron Bar',   stack: 64, desc: '3 → iron sword' },
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', stack: 1,  desc: '18 damage · 2 block reach', weapon: { damage: 18, range: 32, arc: 1.5, cooldown: 0.36, name: 'Iron Sword' } },
  key:        { id: 'key',        name: 'Dragon Key', stack: 8,  desc: 'Opens a sealed gate' },
  gold_coin:  { id: 'gold_coin',  name: 'Gold Coin',  stack: 64, desc: '' },
};

/**
 * Bare hands do NOT damage anything — not enemies, not wood. The sword is the
 * only way to deal damage at all, which is what makes the forge mandatory.
 */
export const FIST = { damage: 0, range: 20, arc: 1.2, cooldown: 0.3, name: 'Fists', isFist: true };

export function def(id) { return ITEM_DEFS[id]; }
export function maxStack(id) { return ITEM_DEFS[id]?.stack ?? 64; }
