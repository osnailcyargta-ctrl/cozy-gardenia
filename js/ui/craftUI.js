// Smelter and anvil panels.

import { iconCanvas } from './icons.js';
import { ITEM_DEFS } from '../data/items.js';
import { rollForge, rollReforge, displayName, modColour, REFORGE_COST, MODS } from '../data/modifiers.js';
import { ORES_PER_COAL, SECONDS_PER_ORE } from '../systems/smelting.js';
import { sfx } from '../engine/audio.js';
import * as hotbar from './hotbar.js';

/* ============================================================
   Smelter
   ============================================================ */

const sPopup = document.getElementById('smelter-popup');
const choices = document.getElementById('smelt-choices');
const fuelBox = document.getElementById('fuel-box');
const forgeMouth = document.getElementById('forge-mouth');
const smeltFill = document.getElementById('smelt-fill');
const smeltStatus = document.getElementById('smelt-status');

let game = null;

export function init(g) {
  game = g;
  document.getElementById('forge-btn').addEventListener('click', onForge);
  document.getElementById('reforge-btn').addEventListener('click', onReforge);
}

export function openSmelter() {
  sPopup.classList.remove('hidden');
  refreshSmelter();
}

export function closeSmelter() { sPopup.classList.add('hidden'); }
export function smelterOpen() { return !sPopup.classList.contains('hidden'); }

export function refreshSmelter() {
  if (!smelterOpen()) return;
  const inv = game.inventory;
  const sm = game.smelter;

  // ore options: anything smeltable the player is carrying
  choices.innerHTML = '';
  const ores = Object.values(ITEM_DEFS).filter((d) => d.smeltsTo);
  let any = false;
  for (const d of ores) {
    const n = inv.count(d.id);
    const usable = n > 0 && !sm.burning && (sm.charges > 0 || inv.has('coal', 1));
    if (n > 0) any = true;
    if (n === 0) continue;

    const el = document.createElement('div');
    el.className = 'ore-choice' + (usable ? '' : ' disabled');
    el.appendChild(iconCanvas(d.id));
    const label = document.createElement('span');
    label.textContent = `${d.name} ×${n}`;
    el.appendChild(label);
    if (usable) {
      el.addEventListener('click', () => {
        const r = sm.start(inv, d.id);
        if (!r.ok) sfx.denied(); else sfx.ui();
        refreshSmelter();
        game.refreshInventory();
      });
    }
    choices.appendChild(el);
  }

  if (!any) {
    const p = document.createElement('div');
    p.className = 'lbl small';
    p.style.opacity = '0.6';
    p.textContent = 'No ore in your satchel.';
    choices.appendChild(p);
  }

  // fuel pips: charges left in the burning coal, plus spare coal
  fuelBox.innerHTML = '';
  for (let i = 0; i < ORES_PER_COAL; i++) {
    const pip = document.createElement('div');
    pip.className = 'fuel-pip' + (i < sm.charges ? ' lit' : '');
    fuelBox.appendChild(pip);
  }
  const spare = document.createElement('div');
  spare.className = 'lbl small';
  spare.style.marginTop = '4px';
  spare.textContent = `Coal: ${inv.count('coal')}`;
  fuelBox.appendChild(spare);

  updateSmeltProgress();
}

export function updateSmeltProgress() {
  if (!smelterOpen()) return;
  const sm = game.smelter;
  forgeMouth.classList.toggle('burning', sm.burning);
  smeltFill.style.width = (sm.burning ? sm.progress * 100 : 0) + '%';
  if (sm.burning) {
    const left = Math.ceil(SECONDS_PER_ORE * (1 - sm.progress));
    smeltStatus.textContent = `Smelting… ${left}s`;
  } else {
    smeltStatus.textContent = 'Idle';
  }
}

/* ============================================================
   Anvil
   ============================================================ */

const aPopup = document.getElementById('anvil-popup');
const anvilIn = document.getElementById('anvil-in');
const anvilOut = document.getElementById('anvil-out');
const anvilMsg = document.getElementById('anvil-msg');
const forgeBtn = document.getElementById('forge-btn');

export const RECIPE = { need: { iron_bar: 3 }, gives: 'iron_sword' };

export function openAnvil() {
  aPopup.classList.remove('hidden');
  anvilMsg.textContent = '';
  anvilMsg.className = '';
  refreshAnvil();
}

export function closeAnvil() { aPopup.classList.add('hidden'); }
export function anvilOpen() { return !aPopup.classList.contains('hidden'); }

/** The weapon in the selected hotbar slot — the one reforging would gamble. */
function heldWeapon() {
  const s = game.inventory.slots[hotbar.selectedIndex()];
  return s && ITEM_DEFS[s.id]?.weapon && ITEM_DEFS[s.id].weapon.kind !== 'place' ? s : null;
}

export function refreshAnvil() {
  if (!anvilOpen()) return;
  const inv = game.inventory;
  const have = inv.count('iron_bar');
  const need = RECIPE.need.iron_bar;
  const ok = have >= need;

  anvilIn.className = 'ing ' + (ok ? 'ok' : 'lack');
  anvilIn.innerHTML = '';
  anvilIn.appendChild(iconCanvas('iron_bar'));
  anvilIn.insertAdjacentHTML('beforeend',
    `<span class="nm">Iron Bar</span><span class="qty">${have} / ${need}</span>`);

  anvilOut.className = 'ing';
  anvilOut.innerHTML = '';
  anvilOut.appendChild(iconCanvas('iron_sword'));
  anvilOut.insertAdjacentHTML('beforeend',
    `<span class="nm">Iron Sword</span><span class="qty">18 dmg · 2 blocks</span>`);

  forgeBtn.disabled = !ok || inv.count('iron_sword') > 0;
  if (inv.count('iron_sword') > 0) {
    anvilMsg.textContent = 'You already carry one.';
    anvilMsg.className = '';
  }

  // ---- reforge ----
  const held = heldWeapon();
  const coins = inv.count('gold_coin');
  const reforgeBtn = document.getElementById('reforge-btn');
  const info = document.getElementById('reforge-info');

  reforgeBtn.disabled = !held || coins < REFORGE_COST;
  reforgeBtn.textContent = `Reforge · ${REFORGE_COST}c`;

  if (!held) {
    info.textContent = 'Hold a weapon to reforge it.';
    info.style.color = '';
  } else {
    const base = ITEM_DEFS[held.id];
    const m = MODS[held.mod];
    info.textContent = `${displayName(base.name, held.mod)}${m ? ' — ' + m.blurb : ' — no modifier'}  ·  ${coins}c in purse`;
    info.style.color = modColour(held.mod) || '';
  }
}

function onForge() {
  const inv = game.inventory;
  if (inv.count('iron_bar') < RECIPE.need.iron_bar) {
    anvilMsg.textContent = 'Not enough iron.';
    anvilMsg.className = 'err';
    sfx.denied();
    return;
  }
  if (inv.isFull() && inv.count('iron_sword') === 0) {
    anvilMsg.textContent = 'Your satchel is full.';
    anvilMsg.className = 'err';
    sfx.denied();
    return;
  }

  inv.remove('iron_bar', RECIPE.need.iron_bar);
  // A fresh blade can come out plain or come out special, but never broken —
  // you only ruin a weapon by gambling with one you already own.
  const mod = rollForge();
  // Straight into the hotbar when there is room. With 0-damage fists, a sword
  // stranded in a lower row reads as a broken game rather than a misplaced item.
  if (!hotbar.placeInHotbar('iron_sword', 1, mod)) inv.add('iron_sword', 1, mod);
  anvilMsg.textContent = mod
    ? `The blade comes out ${MODS[mod].name.toLowerCase()}.`
    : 'The blade is yours.';
  anvilMsg.className = 'ok';
  anvilMsg.style.color = modColour(mod) || '';
  sfx.forge();
  game.refreshInventory();
  refreshAnvil();
}

/**
 * Re-roll the modifier on the weapon you are holding, for coin. It can come out
 * plain, and it can come out broken — that is the whole bet.
 */
function onReforge() {
  const inv = game.inventory;
  const held = heldWeapon();
  if (!held) { sfx.denied(); return; }
  if (inv.count('gold_coin') < REFORGE_COST) {
    anvilMsg.textContent = `Reforging costs ${REFORGE_COST} coins.`;
    anvilMsg.className = 'err';
    anvilMsg.style.color = '';
    sfx.denied();
    return;
  }

  inv.remove('gold_coin', REFORGE_COST);
  const mod = rollReforge();
  if (mod) held.mod = mod; else delete held.mod;

  anvilMsg.textContent = mod
    ? `It comes back ${MODS[mod].name.toLowerCase()}.`
    : 'The metal settles plain.';
  anvilMsg.className = mod === 'broken' ? 'err' : 'ok';
  anvilMsg.style.color = modColour(mod) || '';
  sfx.forge();
  game.refreshInventory();
  refreshAnvil();
}
