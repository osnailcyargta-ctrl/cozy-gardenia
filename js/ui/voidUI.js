// What the void will take.
//
// Point at one and it opens the satchel; click a stack and it goes, all of it.
// There is no confirmation and no way back, which is the point — it is a hole.

import { ITEM_DEFS } from '../data/items.js';
import { displayName, modColour } from '../data/modifiers.js';
import { iconCanvas } from './icons.js';
import { sfx } from '../engine/audio.js';

const popup = document.getElementById('void-popup');
const listEl = document.getElementById('void-list');
const noteEl = document.getElementById('void-note');

let game = null;

export function init(g) {
  game = g;
  document.getElementById('void-cancel').addEventListener('click', close);
}

export function isOpen() { return !popup.classList.contains('hidden'); }
export function close() { popup.classList.add('hidden'); }

export function open() {
  popup.classList.remove('hidden');
  sfx.uiBig();
  build();
}

function build() {
  const inv = game.inventory;
  listEl.innerHTML = '';

  const rows = inv.slots
    .map((sl, i) => ({ sl, i }))
    .filter(({ sl }) => sl);

  noteEl.textContent = rows.length
    ? 'It will take one. All of it.'
    : 'You are carrying nothing.';

  for (const { sl, i } of rows) {
    const def = ITEM_DEFS[sl.id];
    const colour = modColour(sl.mod);
    const el = document.createElement('div');
    el.className = 'void-row';
    el.appendChild(iconCanvas(sl.id, 16));
    el.insertAdjacentHTML('beforeend',
      `<span class="void-name"${colour ? ` style="color:${colour}"` : ''}>` +
      `${displayName(def?.name || sl.id, sl.mod)}</span>` +
      `<span class="void-count">${sl.count > 1 ? '×' + sl.count : ''}</span>`);
    el.addEventListener('click', () => devour(i));
    listEl.appendChild(el);
  }
}

function devour(slot) {
  const sl = game.inventory.slots[slot];
  if (!sl) return;
  game.inventory.slots[slot] = null;
  game.refreshInventory?.();
  game.syncWeapon?.();
  sfx.vanish();
  close();
}
