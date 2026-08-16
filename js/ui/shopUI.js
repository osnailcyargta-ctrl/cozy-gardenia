// The merchant's stall.
//
// Two items, chosen when the room is built and fixed for that room, paid for in
// the coins the dungeon drops. This is the only thing coins have ever been for,
// so the prices are set against how hard each thing is to get another way: the
// iron sword is cheapest because you can forge one for free out of ore you
// find, and the nest is dearest because nothing else in the game does what it
// does.

import { iconCanvas } from './icons.js';
import { ITEM_DEFS } from '../data/items.js';
import { rollForge, displayName, modColour , statLine } from '../data/modifiers.js';
import { sfx } from '../engine/audio.js';
import { rng } from '../engine/rng.js';

export const STOCK = [
  { id: 'iron_sword',       price: 20, count: 1, modded: true },
  { id: 'wave_gun',         price: 30, count: 1 },
  { id: 'blackholian_nest', price: 40, count: 2 },
  { id: 'iron_bar',         price: 15, count: 2 },
  { id: 'iron_ore',         price: 8,  count: 3 },
  { id: 'coal',             price: 5,  count: 2 },
];

const popup = document.getElementById('shop-popup');
const listEl = document.getElementById('shop-list');
const purseEl = document.getElementById('shop-purse');

let game = null;
let stall = null;          // the prop whose stock we are looking at

export function init(g) { game = g; }

/** Two entries, drawn once per merchant so the stall does not reshuffle. */
export function rollStock(rand = Math.random) {
  const pool = STOCK.slice();
  const out = [];
  for (let i = 0; i < 2 && pool.length; i++) {
    out.push(pool.splice((rand() * pool.length) | 0, 1)[0]);
  }
  return out.map((e) => ({ ...e, mod: e.modded ? rollForge(rand) : undefined }));
}

export function open(prop) {
  stall = prop;
  // A seeded stall restocks itself identically every time the room is rebuilt,
  // which in book four is every time you walk back down to it.
  if (!stall.stock) {
    stall.stock = rollStock(prop.seed ? rng(prop.seed) : Math.random);
    // What you already bought is the one thing the seed cannot imply.
    stall.soldRows?.forEach((v, i) => { if (v && stall.stock[i]) stall.stock[i].sold = true; });
  }
  popup.classList.remove('hidden');
  sfx.uiBig();
  refresh();
}

export function close() { popup.classList.add('hidden'); stall = null; }
export function isOpen() { return !popup.classList.contains('hidden'); }

export function refresh() {
  if (!isOpen() || !stall) return;
  const coins = game.inventory.count('gold_coin');
  purseEl.textContent = String(coins);

  listEl.innerHTML = '';
  stall.stock.forEach((entry, i) => {
    const def = ITEM_DEFS[entry.id];
    const afford = coins >= entry.price;
    const sold = entry.sold;

    const el = document.createElement('div');
    el.className = 'shop-row' + (sold ? ' sold' : afford ? '' : ' poor');
    el.appendChild(iconCanvas(entry.id, 16));

    const name = displayName(def.name, entry.mod) + (entry.count > 1 ? ` ×${entry.count}` : '');
    const colour = modColour(entry.mod);
    el.insertAdjacentHTML('beforeend',
      `<div class="shop-text">
         <span class="shop-name"${colour ? ` style="color:${colour}"` : ''}>${name}</span>
         <span class="shop-desc">${sold ? 'Sold.'
           : (def.weapon ? statLine(def.weapon, entry.mod) : def.desc || '')}</span>
       </div>
       <span class="shop-price">${sold ? '—' : entry.price + 'c'}</span>`);

    if (!sold) el.addEventListener('click', () => buy(i));
    listEl.appendChild(el);
  });
}

function buy(i) {
  const entry = stall.stock[i];
  const inv = game.inventory;
  if (entry.sold) return;

  if (inv.count('gold_coin') < entry.price) { sfx.denied(); return; }
  if (inv.isFull() && !inv.has(entry.id, 1)) { sfx.denied(); return; }

  inv.remove('gold_coin', entry.price);
  inv.add(entry.id, entry.count, entry.mod);
  entry.sold = true;

  sfx.pickup();
  stall.soldRows = stall.stock.map((e) => !!e.sold);
  game.onShopSold?.(stall);
  game.refreshInventory();
  refresh();
}
