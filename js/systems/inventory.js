// Slot containers. The player's satchel is 4x4, the chest 3x3, and both are the
// same structure so items can move between them with one code path.

import { maxStack } from '../data/items.js';

export class Container {
  constructor(size, label) {
    this.size = size;
    this.label = label;
    this.slots = new Array(size).fill(null); // { id, count } | null
  }

  get(i) { return this.slots[i]; }

  /** Total of one item id across every slot. */
  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  has(id, n = 1) { return this.count(id) >= n; }

  /**
   * Add items, filling partial stacks first. Returns the leftover that didn't
   * fit. A modifier is part of the item's identity — a Heavy sword must never
   * merge into a stack of plain ones.
   */
  add(id, count = 1, mod = undefined) {
    let left = count;
    const cap = maxStack(id);
    for (const s of this.slots) {
      if (left <= 0) break;
      if (s && s.id === id && s.mod === mod && s.count < cap) {
        const room = cap - s.count;
        const take = Math.min(room, left);
        s.count += take;
        left -= take;
      }
    }
    for (let i = 0; i < this.size && left > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(cap, left);
        this.slots[i] = mod ? { id, count: take, mod } : { id, count: take };
        left -= take;
      }
    }
    return left;
  }

  /** Remove up to `count`; returns how many were actually removed. */
  remove(id, count = 1) {
    let left = count;
    for (let i = this.size - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(s.count, left);
      s.count -= take;
      left -= take;
      if (s.count <= 0) this.slots[i] = null;
    }
    return count - left;
  }

  firstEmpty() { return this.slots.findIndex((s) => s === null); }
  isFull() { return this.firstEmpty() === -1; }

  clear() { this.slots.fill(null); }

  serialize() { return this.slots.map((s) => (s ? { ...s } : null)); }
  load(data) { this.slots = data.map((s) => (s ? { ...s } : null)); }
}

/**
 * Move items between two slots, possibly in different containers.
 * `amount` is 1 for a left click and Infinity for a right click.
 * Returns true if anything actually moved.
 */
export function transfer(fromC, fromI, toC, toI, amount) {
  const src = fromC.slots[fromI];
  if (!src) return false;
  if (fromC === toC && fromI === toI) return false;

  const n = Math.min(amount, src.count);
  const dst = toC.slots[toI];
  const cap = maxStack(src.id);

  if (!dst) {
    const take = Math.min(n, cap);
    toC.slots[toI] = src.mod ? { id: src.id, count: take, mod: src.mod } : { id: src.id, count: take };
    src.count -= take;
    if (src.count <= 0) fromC.slots[fromI] = null;
    return true;
  }

  if (dst.id === src.id && dst.mod === src.mod) {
    const room = cap - dst.count;
    if (room <= 0) return false;
    const take = Math.min(room, n);
    dst.count += take;
    src.count -= take;
    if (src.count <= 0) fromC.slots[fromI] = null;
    return true;
  }

  // different items: swap, but only when taking the whole stack
  if (n >= src.count) {
    fromC.slots[fromI] = dst;
    toC.slots[toI] = src;
    return true;
  }
  return false;
}
