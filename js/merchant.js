/**
 * The merchant: exactly three seeds, reshuffled every minute.
 *
 * The restock clock is derived from `lastRestockAt` rather than driven by a
 * setInterval, so it stays correct across reloads and throttled background
 * tabs, and catches up in one step after time away.
 */

import { RARITIES, getPlant, randomPlant } from './data/plants.js';
import {
  state,
  MERCHANT_RESTOCK_MS,
  MERCHANT_SLOTS,
  addSeed,
  spendCoins,
  scheduleSave,
  flushSave,
} from './state.js';
import { now, formatDuration } from './time.js';
import { seedIcon, ICONS } from './sprites.js';
import { toast, burst, renderHUD, el } from './ui.js';

let listEl = null;
let ringEl = null;
let countdownEl = null;
let stockSignature = '';

/** Prices wobble ±15% so two restocks of the same seed still feel different. */
function rollPrice(plant) {
  const jitter = 0.85 + Math.random() * 0.3;
  return Math.max(1, Math.round(plant.seedPrice * jitter));
}

function rollStock() {
  const stock = [];
  const used = new Set();
  let guard = 0;
  while (stock.length < MERCHANT_SLOTS && guard < 50) {
    guard += 1;
    const plant = randomPlant();
    // Prefer three distinct seeds, but never loop forever chasing them.
    if (used.has(plant.id) && guard < 30) continue;
    used.add(plant.id);
    stock.push({ seedId: plant.id, price: rollPrice(plant), sold: false });
  }
  return stock;
}

export function msToRestock(t = now()) {
  // Guard the clock running backwards: a negative elapsed would make JS's %
  // negative and push the countdown past a full period.
  const elapsed = Math.max(0, t - state.merchant.lastRestockAt);
  return Math.max(0, MERCHANT_RESTOCK_MS - (elapsed % MERCHANT_RESTOCK_MS));
}

/** Roll the shop forward to `t`. Returns true if the stock changed. */
export function tickMerchant(t = now()) {
  const m = state.merchant;
  if (m.stock.length === 0) {
    m.stock = rollStock();
    m.lastRestockAt = t;
    scheduleSave();
    return true;
  }
  const elapsed = t - m.lastRestockAt;
  if (elapsed < MERCHANT_RESTOCK_MS) return false;

  // Advance by whole periods so the countdown keeps its phase after a long gap.
  const periods = Math.floor(elapsed / MERCHANT_RESTOCK_MS);
  m.lastRestockAt += periods * MERCHANT_RESTOCK_MS;
  m.stock = rollStock();
  scheduleSave();
  return true;
}

/* ---------------------------------------------------------------- render -- */

function buildSlot(slot, index) {
  const plant = getPlant(slot.seedId);
  const rarity = RARITIES[plant.rarity];
  const card = el('li', `stock-card stock-card--${plant.rarity}`);
  card.style.setProperty('--enter-delay', `${index * 70}ms`);
  if (slot.sold) card.classList.add('is-sold');

  card.innerHTML = `
    <div class="stock-card__art">${seedIcon(plant)}</div>
    <div class="stock-card__body">
      <h3 class="stock-card__name">${plant.name}</h3>
      <span class="rarity rarity--${plant.rarity}" style="--rarity-color:${rarity.color}">
        ${rarity.label}
      </span>
      <p class="stock-card__blurb">${plant.blurb}</p>
      <dl class="stock-card__stats">
        <div><dt>Grows in</dt><dd>${formatDuration(plant.growMs)}</dd></div>
        <div><dt>Sells for</dt><dd>${plant.sellValue}</dd></div>
      </dl>
    </div>`;

  const footer = el('div', 'stock-card__footer');
  if (slot.sold) {
    footer.append(el('span', 'stock-card__sold', { text: 'Sold out — restocking soon' }));
  } else {
    const btn = el('button', 'btn btn--buy', { attrs: { type: 'button' } });
    btn.innerHTML = `${ICONS.coin}<span class="btn__label">Buy — ${slot.price}</span>`;
    btn.disabled = state.coins < slot.price;
    btn.addEventListener('click', () => buySlot(index, btn));
    footer.append(btn);
  }
  card.append(footer);
  return card;
}

function signature() {
  return state.merchant.stock.map((s) => `${s.seedId}:${s.price}:${s.sold}`).join('|');
}

export function renderMerchant() {
  if (!listEl) return;

  const sig = signature();
  if (sig !== stockSignature) {
    stockSignature = sig;
    listEl.replaceChildren(...state.merchant.stock.map(buildSlot));
  } else {
    // Same stock — only affordability can have changed.
    const buttons = listEl.querySelectorAll('.stock-card__footer .btn');
    let i = 0;
    state.merchant.stock.forEach((slot) => {
      if (slot.sold) return;
      const btn = buttons[i];
      i += 1;
      if (btn) btn.disabled = state.coins < slot.price;
    });
  }

  const t = now();
  const remaining = msToRestock(t);
  if (countdownEl) countdownEl.textContent = formatDuration(remaining);
  if (ringEl) {
    const pct = 1 - remaining / MERCHANT_RESTOCK_MS;
    const circumference = 2 * Math.PI * 26;
    ringEl.style.strokeDasharray = String(circumference);
    ringEl.style.strokeDashoffset = String(circumference * (1 - pct));
  }
}

export function initMerchant() {
  listEl = document.getElementById('stock-list');
  ringEl = document.getElementById('restock-ring');
  countdownEl = document.getElementById('restock-countdown');
  stockSignature = '';
  tickMerchant();
  renderMerchant();
}

/* ------------------------------------------------------------------- buy -- */

function buySlot(index, anchor) {
  const slot = state.merchant.stock[index];
  if (!slot || slot.sold) return;

  if (!spendCoins(slot.price)) {
    toast(`Not enough coins — that seed costs ${slot.price}.`, 'warn');
    return;
  }

  const plant = getPlant(slot.seedId);
  slot.sold = true;
  addSeed(plant.id, 1);
  state.stats.seedsBought += 1;
  flushSave();

  burst(anchor, 'sparkle', 6);
  toast(`Bought a ${plant.name} seed.`, 'good');
  stockSignature = '';
  renderMerchant();
  renderHUD();
}
