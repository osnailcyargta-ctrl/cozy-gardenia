// Smelter state.
//
// Rules from the design: one coal burns exactly three ores, and each ore takes
// ten seconds. The chest starts with 1 coal and 3 iron ore, which is precisely
// enough for the three bars the anvil wants — the economy is meant to be tight.

import { ITEM_DEFS } from '../data/items.js';
import { sfx } from '../engine/audio.js';

export const SECONDS_PER_ORE = 10;
export const ORES_PER_COAL = 3;

export class Smelter {
  constructor() {
    this.charges = 0;      // ore firings left in the current coal
    this.oreId = null;     // what's cooking
    this.progress = 0;     // 0..1
    this.queue = 0;        // ores still to process after the current one
  }

  get burning() { return this.oreId !== null; }

  /** Coal already loaded plus whatever a fresh coal would add. */
  canSmelt(inv, oreId) {
    if (!ITEM_DEFS[oreId]?.smeltsTo) return false;
    if (!inv.has(oreId, 1)) return false;
    return this.charges > 0 || inv.has('coal', 1);
  }

  /**
   * Begin smelting one ore. Consumes the ore immediately and a coal only when
   * the previous one is spent.
   */
  start(inv, oreId) {
    if (this.burning) return { ok: false, why: 'The forge is already lit.' };
    if (!ITEM_DEFS[oreId]?.smeltsTo) return { ok: false, why: 'That will not melt.' };
    if (!inv.has(oreId, 1)) return { ok: false, why: `No ${ITEM_DEFS[oreId].name.toLowerCase()} left.` };

    if (this.charges <= 0) {
      if (!inv.has('coal', 1)) return { ok: false, why: 'Out of coal.' };
      inv.remove('coal', 1);
      this.charges = ORES_PER_COAL;
    }

    inv.remove(oreId, 1);
    this.charges--;
    this.oreId = oreId;
    this.progress = 0;
    sfx.smelt();
    return { ok: true };
  }

  /** Returns the produced item id on the tick it finishes, else null. */
  update(dt) {
    if (!this.burning) return null;
    this.progress += dt / SECONDS_PER_ORE;
    if (this.progress < 1) return null;

    const out = ITEM_DEFS[this.oreId].smeltsTo;
    this.oreId = null;
    this.progress = 0;
    return out;
  }

  reset() {
    this.charges = 0;
    this.oreId = null;
    this.progress = 0;
  }

  serialize() { return { charges: this.charges, oreId: this.oreId, progress: this.progress }; }
  load(d) { if (d) Object.assign(this, d); }
}
