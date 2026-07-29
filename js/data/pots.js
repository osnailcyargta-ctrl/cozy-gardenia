/**
 * The 10-pot unlock table.
 *
 * Pots 1-3 start unlocked. The rest alternate between coin purchases and boss
 * gates. Boss battles are not implemented yet, so boss pots render as a
 * "Coming Soon" plate — and crucially, buyable pots do NOT depend on them.
 * Pot 7 can be bought without clearing pot 6's boss, so 7 pots are reachable
 * today and the three boss plates become fight entry points later.
 */

export const POT_COUNT = 10;

export const POTS = [
  { id: 1, unlock: { type: 'start' } },
  { id: 2, unlock: { type: 'start' } },
  { id: 3, unlock: { type: 'start' } },
  { id: 4, unlock: { type: 'buy', cost: 150 } },
  { id: 5, unlock: { type: 'buy', cost: 400 } },
  { id: 6, unlock: { type: 'boss', bossName: 'Thorn Wyrm' } },
  { id: 7, unlock: { type: 'buy', cost: 900 } },
  { id: 8, unlock: { type: 'buy', cost: 1800 } },
  { id: 9, unlock: { type: 'boss', bossName: 'Frost Bramble' } },
  { id: 10, unlock: { type: 'boss', bossName: 'Elder Root' } },
];

const BY_ID = new Map(POTS.map((p) => [p.id, p]));

export function getPotDef(id) {
  return BY_ID.get(id) ?? null;
}

export function startsUnlocked(id) {
  return getPotDef(id)?.unlock.type === 'start';
}
