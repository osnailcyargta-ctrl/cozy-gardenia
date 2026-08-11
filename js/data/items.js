// Item definitions. `smeltsTo` drives the smelter, `stack` the inventory.

export const ITEM_DEFS = {
  coal:       { id: 'coal',       name: 'Coal',       stack: 64, desc: 'Fuel. Burns three ores.' },
  iron_ore:   { id: 'iron_ore',   name: 'Iron Ore',   stack: 64, desc: 'Raw. Needs the smelter.', smeltsTo: 'iron_bar' },
  iron_bar:   { id: 'iron_bar',   name: 'Iron Bar',   stack: 64, desc: 'Three make a sword.' },
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', stack: 1,  desc: '3 damage · 2 block reach', weapon: { damage: 3, range: 32, arc: 1.5, cooldown: 0.36, name: 'Iron Sword' } },
  key:        { id: 'key',        name: 'Dragon Key', stack: 8,  desc: 'Opens a sealed gate.' },
  gold_coin:  { id: 'gold_coin',  name: 'Gold Coin',  stack: 64, desc: 'The hoard, in miniature.' },
};

/** Bare hands: reaches less, hurts less, and cannot break wood at all. */
export const FIST = { damage: 1, range: 20, arc: 1.2, cooldown: 0.3, name: 'Fists', isFist: true };

export function def(id) { return ITEM_DEFS[id]; }
export function maxStack(id) { return ITEM_DEFS[id]?.stack ?? 64; }
