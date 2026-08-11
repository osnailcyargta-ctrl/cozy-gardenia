// Hotbar: the satchel's top row, always on screen.
//
// The selected slot *is* the equipped weapon — there is no auto-equip. Since
// fists deal 0 damage, selecting a non-weapon slot means your swing does
// nothing, which is intended.

import { iconCanvas } from './icons.js';
import { ITEM_DEFS } from '../data/items.js';
import { sfx } from '../engine/audio.js';

export const HOTBAR_SLOTS = 4;

const wrap = document.getElementById('hotbar-wrap');
const root = document.getElementById('hotbar');
const nameEl = document.getElementById('hotbar-name');

let game = null;
let selected = 0;
let nameTimer = 0;

export function init(g) {
  game = g;

  root.innerHTML = '';
  for (let i = 0; i < HOTBAR_SLOTS; i++) {
    const el = document.createElement('div');
    el.className = 'hb-slot';
    el.dataset.i = i;
    el.innerHTML = `<span class="hb-key">${i + 1}</span><div class="hb-item"></div>`;
    el.addEventListener('mousedown', (e) => { e.preventDefault(); select(i); });
    root.appendChild(el);
  }

  // scroll anywhere over the game switches slots
  window.addEventListener('wheel', (e) => {
    if (game.renderPaused) return;
    select(selected + (e.deltaY > 0 ? 1 : -1));
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    if (n !== -1) select(n);
  });

  refresh();
}

export function select(i) {
  const next = ((i % HOTBAR_SLOTS) + HOTBAR_SLOTS) % HOTBAR_SLOTS;
  if (next === selected) return;
  selected = next;
  sfx.ui();
  showName();
  refresh();
  game.syncWeapon();
}

export function selectedIndex() { return selected; }

export function selectedItem() {
  return game?.inventory?.slots[selected] || null;
}

/** Put an item into the first free hotbar slot; returns true if it landed there. */
export function placeInHotbar(id, count = 1) {
  const inv = game.inventory;
  for (let i = 0; i < HOTBAR_SLOTS; i++) {
    if (!inv.slots[i]) {
      inv.slots[i] = { id, count };
      select(i);
      refresh();
      return true;
    }
  }
  return false;
}

function showName() {
  const s = selectedItem();
  nameEl.textContent = s ? (ITEM_DEFS[s.id]?.name || s.id) : '';
  nameEl.classList.toggle('show', !!s);
  nameTimer = 1.6;
}

export function update(dt) {
  if (nameTimer > 0) {
    nameTimer -= dt;
    if (nameTimer <= 0) nameEl.classList.remove('show');
  }
}

export function refresh() {
  if (!game) return;
  const inv = game.inventory;
  [...root.children].forEach((el, i) => {
    const s = inv.slots[i];
    el.classList.toggle('sel', i === selected);
    el.classList.toggle('filled', !!s);
    const box = el.querySelector('.hb-item');
    box.innerHTML = '';
    if (!s) return;
    box.appendChild(iconCanvas(s.id));
    if (s.count > 1) {
      const c = document.createElement('span');
      c.className = 'count';
      c.textContent = s.count;
      box.appendChild(c);
    }
  });
}

export function show() { wrap.classList.remove('hidden'); }
export function hide() { wrap.classList.add('hidden'); }
