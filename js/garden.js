/**
 * The main plot: the 10-pot grid and every interaction on it.
 *
 * The grid is built once; each tick only patches text, classes and widths.
 * SVG art is re-injected solely when a pot's visual signature changes, so sway
 * and glow animations aren't restarted four times a second.
 */

import { POTS, getPotDef } from './data/pots.js';
import { PLANTS, getPlant, RARITIES } from './data/plants.js';
import {
  state,
  getPot,
  potStage,
  potProgress,
  isReady,
  isWet,
  timeToBloom,
  advancePot,
  seedCount,
  removeSeed,
  addSeed,
  addCoins,
  canBuyPot,
  buyPot,
  unlockedPotCount,
  flushSave,
  scheduleSave,
} from './state.js';
import { now, formatDuration } from './time.js';
import { potArt, seedIcon, ICONS } from './sprites.js';
import { toast, burst, openModal, closeModal, renderHUD, el, setTab } from './ui.js';

let gridEl = null;
const cards = new Map(); // potId -> { root, refs..., signature }

/* ---------------------------------------------------------------- render -- */

function buildCard(def) {
  const root = el('article', 'pot-card', { attrs: { 'data-pot-id': String(def.id) } });
  // Stagger the idle sway so the plot doesn't pulse in lockstep.
  root.style.setProperty('--sway-delay', `${(def.id % 5) * 0.4}s`);

  const head = el('header', 'pot-card__head');
  const num = el('span', 'pot-card__num', { text: `Pot ${def.id}` });
  const badge = el('span', 'pot-card__badge');
  head.append(num, badge);

  const stage = el('div', 'pot-card__stage');
  const meta = el('div', 'pot-card__meta');
  const name = el('span', 'pot-card__name');
  const timer = el('span', 'pot-card__timer');
  meta.append(name, timer);

  const progress = el('div', 'progress');
  const fill = el('div', 'progress__fill');
  progress.append(fill);

  const actions = el('div', 'pot-card__actions');

  root.append(head, stage, meta, progress, actions);
  return { root, badge, stage, name, timer, progress, fill, actions, signature: '' };
}

function actionButton(label, className, onClick, { disabled = false, icon = null } = {}) {
  const btn = el('button', `btn ${className}`, { attrs: { type: 'button' } });
  if (icon) btn.insertAdjacentHTML('afterbegin', icon);
  btn.append(el('span', 'btn__label', { text: label }));
  btn.disabled = disabled;
  if (!disabled) btn.addEventListener('click', onClick);
  return btn;
}

function signatureOf(pot, def, t) {
  if (!pot.unlocked) {
    return `locked:${def.unlock.type}:${def.unlock.type === 'buy' ? canBuyPot(def.id) : ''}`;
  }
  if (!pot.seedId) return 'empty';
  return `${pot.seedId}:${potStage(pot).id}:${isWet(pot, t)}:${isReady(pot)}`;
}

function renderCardStructure(card, pot, def) {
  const { stage, actions } = card;
  actions.replaceChildren();

  if (!pot.unlocked) {
    card.root.classList.add('is-locked');
    if (def.unlock.type === 'boss') {
      card.root.classList.add('is-boss');
      stage.innerHTML = `
        <div class="lock-plate lock-plate--boss">
          ${ICONS.sword}
          <span class="lock-plate__title">${def.unlock.bossName}</span>
          <span class="lock-plate__sub">Boss Battle</span>
        </div>`;
      actions.append(
        actionButton('Coming Soon', 'btn--ghost', () => {}, { disabled: true }),
      );
    } else {
      stage.innerHTML = `
        <div class="lock-plate">
          ${ICONS.lock}
          <span class="lock-plate__title">Locked</span>
          <span class="lock-plate__sub">${def.unlock.cost} coins</span>
        </div>`;
      const affordable = canBuyPot(def.id);
      actions.append(
        actionButton(
          affordable ? `Unlock — ${def.unlock.cost}` : `Need ${def.unlock.cost}`,
          'btn--buy',
          () => handleBuyPot(def.id),
          { disabled: !affordable, icon: ICONS.coin },
        ),
      );
    }
    return;
  }

  card.root.classList.remove('is-locked', 'is-boss');

  if (!pot.seedId) {
    stage.innerHTML = potArt(null, 'seed');
    actions.append(
      actionButton('Plant a seed', 'btn--plant', () => openSeedPicker(pot.id), { icon: ICONS.seed }),
    );
    return;
  }

  const plant = getPlant(pot.seedId);
  stage.innerHTML = potArt(plant, potStage(pot).id);

  if (isReady(pot)) {
    card.root.classList.add('is-ready');
    actions.append(
      actionButton(`Harvest — ${plant.sellValue}`, 'btn--harvest', () => handleHarvest(pot.id), {
        icon: ICONS.coin,
      }),
    );
  } else {
    card.root.classList.remove('is-ready');
    const wet = isWet(pot);
    actions.append(
      actionButton(wet ? 'Watered' : 'Water', 'btn--water', () => handleWater(pot.id), {
        disabled: wet,
        icon: ICONS.water,
      }),
    );
  }
}

function renderCardState(card, pot, def, t) {
  if (!pot.unlocked) {
    card.badge.textContent = def.unlock.type === 'boss' ? 'Boss' : 'Locked';
    card.badge.className = 'pot-card__badge pot-card__badge--locked';
    card.name.textContent = def.unlock.type === 'boss' ? def.unlock.bossName : 'Empty plot';
    card.timer.textContent = '';
    card.progress.hidden = true;
    return;
  }

  if (!pot.seedId) {
    card.badge.textContent = 'Empty';
    card.badge.className = 'pot-card__badge';
    card.name.textContent = 'Ready for a seed';
    card.timer.textContent = '';
    card.progress.hidden = true;
    return;
  }

  const plant = getPlant(pot.seedId);
  const stage = potStage(pot);
  const progress = potProgress(pot);

  card.progress.hidden = false;
  card.fill.style.width = `${Math.round(progress * 100)}%`;
  card.fill.style.background = `linear-gradient(90deg, ${plant.palette.leaf}, ${plant.palette.bloom})`;
  card.name.textContent = plant.name;
  card.badge.textContent = stage.label;
  card.badge.className = `pot-card__badge pot-card__badge--${plant.rarity}`;

  if (isReady(pot)) {
    card.timer.textContent = 'Ready!';
  } else {
    const dry = !isWet(pot, t);
    card.timer.textContent = `${formatDuration(timeToBloom(pot, t))}${dry ? ' · dry' : ''}`;
    card.timer.classList.toggle('is-dry', dry);
  }
}

export function renderGarden() {
  const t = now();
  for (const def of POTS) {
    const pot = getPot(def.id);
    const card = cards.get(def.id);
    if (!pot || !card) continue;

    const sig = signatureOf(pot, def, t);
    if (sig !== card.signature) {
      card.signature = sig;
      renderCardStructure(card, pot, def);
    }
    renderCardState(card, pot, def, t);
  }

  const summary = document.getElementById('garden-summary');
  if (summary) {
    const growing = state.pots.filter((p) => p.seedId && !isReady(p)).length;
    const ready = state.pots.filter((p) => isReady(p)).length;
    summary.textContent =
      `${unlockedPotCount()} of ${POTS.length} pots · ${growing} growing · ${ready} ready`;
  }
}

export function initGarden() {
  gridEl = document.getElementById('pot-grid');
  if (!gridEl) return;
  gridEl.replaceChildren();
  cards.clear();

  for (const def of POTS) {
    const card = buildCard(def);
    cards.set(def.id, card);
    gridEl.append(card.root);
  }
  renderGarden();
}

/* ------------------------------------------------------------ interaction -- */

function handleBuyPot(potId) {
  const def = getPotDef(potId);
  if (!buyPot(potId)) {
    toast(`Not enough coins — Pot ${potId} costs ${def.unlock.cost}.`, 'warn');
    return;
  }
  const card = cards.get(potId);
  card.signature = '';
  toast(`Pot ${potId} unlocked!`, 'good');
  burst(card.root, 'sparkle', 12);
  renderGarden();
  renderHUD();
}

function handleWater(potId) {
  const pot = getPot(potId);
  if (!pot || !pot.seedId || isWet(pot)) return;
  const t = now();
  advancePot(pot, t);
  pot.lastWateredAt = t;
  scheduleSave();

  const card = cards.get(potId);
  card.signature = '';
  card.root.classList.remove('is-splashing');
  void card.root.offsetWidth;
  card.root.classList.add('is-splashing');
  burst(card.stage, 'water', 7);
  renderGarden();
}

function handleHarvest(potId) {
  const pot = getPot(potId);
  if (!pot || !isReady(pot)) return;
  const plant = getPlant(pot.seedId);

  addCoins(plant.sellValue);
  state.stats.harvests += 1;

  const gotSeed = Math.random() < plant.dropChance;
  if (gotSeed) addSeed(plant.id, 1);

  pot.seedId = null;
  pot.plantedAt = 0;
  pot.lastWateredAt = 0;
  pot.growthMs = 0;
  pot.lastAdvanceAt = 0;
  flushSave();

  const card = cards.get(potId);
  card.signature = '';
  burst(card.stage, 'coin', 10);
  toast(
    gotSeed
      ? `Harvested ${plant.name} — +${plant.sellValue} coins and a spare seed!`
      : `Harvested ${plant.name} — +${plant.sellValue} coins.`,
    'good',
  );
  renderGarden();
  renderHUD();
}

function plantSeed(potId, seedId) {
  const pot = getPot(potId);
  if (!pot || !pot.unlocked || pot.seedId) return;
  if (!removeSeed(seedId, 1)) return;

  const t = now();
  pot.seedId = seedId;
  pot.plantedAt = t;
  pot.lastAdvanceAt = t;
  // Planting comes with a first watering — one less chore before anything grows.
  pot.lastWateredAt = t;
  pot.growthMs = 0;
  flushSave();

  const card = cards.get(potId);
  card.signature = '';
  closeModal();
  toast(`Planted ${getPlant(seedId).name} in pot ${potId}.`, 'good');
  renderGarden();
  renderHUD();
}

/* ----------------------------------------------------------- seed picker -- */

function openSeedPicker(potId) {
  const owned = PLANTS.filter((p) => seedCount(p.id) > 0);
  const body = el('div', 'seed-picker');

  if (owned.length === 0) {
    body.append(
      el('p', 'seed-picker__empty', {
        text: 'No seeds in your pouch. The merchant restocks three seeds every minute.',
      }),
    );
    const go = actionButton('Go to Merchant', 'btn--plant', () => {
      closeModal();
      setTab('merchant');
    });
    body.append(go);
    openModal(`Pot ${potId}`, body);
    return;
  }

  const list = el('ul', 'seed-picker__list');
  for (const plant of owned) {
    const item = el('li', 'seed-picker__item');
    const btn = el('button', 'seed-option', { attrs: { type: 'button' } });
    btn.innerHTML = `
      ${seedIcon(plant)}
      <span class="seed-option__body">
        <span class="seed-option__name">${plant.name}</span>
        <span class="seed-option__meta">
          <span class="rarity rarity--${plant.rarity}">${RARITIES[plant.rarity].label}</span>
          <span>${formatDuration(plant.growMs)} · ${plant.sellValue} coins</span>
        </span>
      </span>
      <span class="seed-option__count">×${seedCount(plant.id)}</span>`;
    btn.addEventListener('click', () => plantSeed(potId, plant.id));
    item.append(btn);
    list.append(item);
  }
  body.append(list);
  openModal(`Plant in pot ${potId}`, body);
}
