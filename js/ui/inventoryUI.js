// Slot-grid UI shared by the satchel and the chest.
//
// Per the design: left click moves ONE item, right click moves the WHOLE stack.
// Clicking with nothing held picks up; clicking again places into the target.

import { transfer } from '../systems/inventory.js';
import { iconCanvas } from './icons.js';
import { ITEM_DEFS } from '../data/items.js';
import { displayName, modColour, MODS, statLine } from '../data/modifiers.js';
import { sfx } from '../engine/audio.js';

const invGrid = document.getElementById('inv-grid');
const chestGrid = document.getElementById('chest-grid');
const chestSide = document.getElementById('chest-side');
const chestTitle = document.getElementById('chest-title');
const popup = document.getElementById('inv-popup');

let held = null;          // { container, index }
let heldEl = null;
let tipEl = null;
let game = null;
let openChest = null;

export function init(g) {
  game = g;
  buildGrid(invGrid, () => game.inventory, 16);
  window.addEventListener('mousemove', (e) => {
    if (heldEl) { heldEl.style.left = e.clientX + 'px'; heldEl.style.top = e.clientY + 'px'; }
    if (tipEl) { tipEl.style.left = (e.clientX + 16) + 'px'; tipEl.style.top = (e.clientY + 14) + 'px'; }
  });
}

function buildGrid(root, getContainer, size) {
  root.innerHTML = '';
  for (let i = 0; i < size; i++) {
    const el = document.createElement('div');
    el.className = 'slot';
    el.dataset.i = i;

    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onSlot(getContainer(), i, e.button === 2 ? Infinity : 1);
    });
    el.addEventListener('mouseenter', () => showTip(getContainer(), i));
    el.addEventListener('mouseleave', hideTip);

    root.appendChild(el);
  }
}

function onSlot(container, index, amount) {
  if (!held) {
    if (!container.slots[index]) { sfx.denied(); return; }
    held = { container, index };
    sfx.ui();
  } else {
    const moved = transfer(held.container, held.index, container, index, amount);
    if (moved) sfx.ui(); else sfx.denied();
    // keep holding while the source stack still has items, so repeated clicks
    // let you meter items out one at a time
    if (!held.container.slots[held.index]) held = null;
  }
  refresh();
}

function showTip(container, index) {
  const s = container.slots[index];
  hideTip();
  if (!s) return;
  const d = ITEM_DEFS[s.id];
  const colour = modColour(s.mod);
  const m = MODS[s.mod];
  tipEl = document.createElement('div');
  tipEl.id = 'tip';
  tipEl.innerHTML =
    `<span${colour ? ` style="color:${colour}"` : ''}>${displayName(d?.name || s.id, s.mod)}</span>` +
    (s.count > 1 ? ` <span style="color:#7e6c92">×${s.count}</span>` : '') +
    (m ? `<span class="tip-sub" style="color:${colour}">${m.blurb}</span>` : '') +
    // A weapon describes itself from its own live numbers; everything else
    // keeps the flat text it was written with.
    (d?.weapon
      ? `<span class="tip-sub tip-stats">${statLine(d.weapon, s.mod)}</span>`
      : (d?.desc ? `<span class="tip-sub">${d.desc}</span>` : ''));
  document.body.appendChild(tipEl);
}

function hideTip() {
  tipEl?.remove();
  tipEl = null;
}

export function refresh() {
  paint(invGrid, game.inventory);
  if (openChest) paint(chestGrid, openChest);

  // the floating held stack
  heldEl?.remove();
  heldEl = null;
  if (held) {
    const s = held.container.slots[held.index];
    if (s) {
      heldEl = document.createElement('div');
      heldEl.id = 'held';
      heldEl.appendChild(iconCanvas(s.id));
      if (s.count > 1) {
        const c = document.createElement('span');
        c.className = 'count';
        c.textContent = s.count;
        heldEl.appendChild(c);
      }
      document.body.appendChild(heldEl);
    } else {
      held = null;
    }
  }
  game.syncWeapon();
}

function paint(root, container) {
  [...root.children].forEach((el, i) => {
    const s = container.slots[i];
    const isHeld = held && held.container === container && held.index === i;
    el.className = 'slot' + (s ? ' filled' : '');
    el.innerHTML = '';
    if (!s) return;
    const cv = iconCanvas(s.id);
    if (isHeld) cv.style.opacity = '0.35';
    el.appendChild(cv);
    if (s.count > 1) {
      const c = document.createElement('span');
      c.className = 'count';
      c.textContent = s.count;
      el.appendChild(c);
    }
  });
}

export function open(chest = null, title = 'Chest') {
  openChest = chest;
  if (chest) {
    chestSide.classList.remove('hidden');
    chestTitle.textContent = title;
    buildGrid(chestGrid, () => openChest, chest.size);
  } else {
    chestSide.classList.add('hidden');
  }
  popup.classList.remove('hidden');
  refresh();
}

export function close() {
  // anything still on the cursor goes back where it came from — nothing is lost
  held = null;
  heldEl?.remove();
  heldEl = null;
  hideTip();
  openChest = null;
  popup.classList.add('hidden');
  refresh();
}

export function isOpen() { return !popup.classList.contains('hidden'); }
