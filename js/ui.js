/**
 * Shell UI: tab routing, the coin/seed HUD, toasts, the modal, and particles.
 */

import { state, totalSeeds } from './state.js';
import { ICONS } from './sprites.js';

export const TABS = ['merchant', 'garden', 'phone'];
/** Entering the game always lands on the main plot. */
export const DEFAULT_TAB = 'garden';

let activeTab = DEFAULT_TAB;
const tabListeners = new Set();

export function onTabChange(fn) {
  tabListeners.add(fn);
  return () => tabListeners.delete(fn);
}

export function getTab() {
  return activeTab;
}

export function setTab(name) {
  if (!TABS.includes(name) || name === activeTab) return;
  activeTab = name;

  for (const panel of document.querySelectorAll('.panel')) {
    const isActive = panel.dataset.panel === name;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  }
  for (const btn of document.querySelectorAll('.tab-btn')) {
    const isActive = btn.dataset.tab === name;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  }

  const panel = document.querySelector(`.panel[data-panel="${name}"]`);
  if (panel) panel.scrollTop = 0;

  for (const fn of tabListeners) fn(name);
}

export function initTabs() {
  for (const btn of document.querySelectorAll('.tab-btn')) {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  }
  // Force the default rather than trusting markup order.
  activeTab = null;
  setTab(DEFAULT_TAB);
}

/* ------------------------------------------------------------------- HUD -- */

export function renderHUD() {
  const coinEl = document.getElementById('hud-coins');
  const seedEl = document.getElementById('hud-seeds');
  if (coinEl) {
    const next = String(state.coins);
    if (coinEl.textContent !== next) {
      coinEl.textContent = next;
      coinEl.classList.remove('is-bumped');
      // Restart the bump animation.
      void coinEl.offsetWidth;
      coinEl.classList.add('is-bumped');
    }
  }
  if (seedEl) seedEl.textContent = String(totalSeeds());
}

export function initHUD() {
  const coinIcon = document.getElementById('hud-coin-icon');
  const seedIcon = document.getElementById('hud-seed-icon');
  if (coinIcon) coinIcon.innerHTML = ICONS.coin;
  if (seedIcon) seedIcon.innerHTML = ICONS.seed;
  renderHUD();
}

/* ---------------------------------------------------------------- toasts -- */

export function toast(message, kind = 'info') {
  const host = document.getElementById('toasts');
  if (!host) return;

  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  host.appendChild(el);

  setTimeout(() => {
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    // Fallback if animations are disabled.
    setTimeout(() => el.remove(), 600);
  }, 2200);
}

/* ----------------------------------------------------------------- modal -- */

let lastFocused = null;

export function openModal(title, bodyNode) {
  const root = document.getElementById('modal');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  if (!root || !titleEl || !bodyEl) return;

  lastFocused = document.activeElement;
  titleEl.textContent = title;
  bodyEl.replaceChildren(bodyNode);
  root.hidden = false;
  root.classList.add('is-open');

  const focusable = bodyEl.querySelector('button, [href], input, select');
  (focusable ?? document.getElementById('modal-close'))?.focus();
}

export function closeModal() {
  const root = document.getElementById('modal');
  if (!root || root.hidden) return;
  root.classList.remove('is-open');
  root.hidden = true;
  document.getElementById('modal-body')?.replaceChildren();
  if (lastFocused instanceof HTMLElement) lastFocused.focus();
  lastFocused = null;
}

export function initModal() {
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal')?.addEventListener('click', (e) => {
    if (e.target instanceof HTMLElement && e.target.dataset.modalDismiss !== undefined) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

/* ------------------------------------------------------------- particles -- */

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Pop a short-lived particle burst out of an element.
 * @param {Element} anchor element to burst from
 * @param {'coin'|'water'|'sparkle'} kind
 */
export function burst(anchor, kind = 'sparkle', count = 8) {
  if (!anchor || reduceMotion()) return;
  const host = document.getElementById('particles');
  if (!host) return;

  const box = anchor.getBoundingClientRect();
  const glyphs = { coin: '🪙', water: '💧', sparkle: '✨' };
  const glyph = glyphs[kind] ?? glyphs.sparkle;

  for (let i = 0; i < count; i += 1) {
    const p = document.createElement('span');
    p.className = `particle particle--${kind}`;
    p.textContent = glyph;
    p.style.left = `${box.left + box.width / 2}px`;
    p.style.top = `${box.top + box.height * 0.4}px`;
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 130}px`);
    p.style.setProperty('--dy', `${-50 - Math.random() * 90}px`);
    p.style.setProperty('--rot', `${(Math.random() - 0.5) * 180}deg`);
    p.style.animationDelay = `${Math.random() * 120}ms`;
    host.appendChild(p);
    p.addEventListener('animationend', () => p.remove(), { once: true });
    setTimeout(() => p.remove(), 1600);
  }
}

/** Small helper: build an element with class + optional text/html. */
export function el(tag, className, options = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.html !== undefined) node.innerHTML = options.html;
  if (options.attrs) for (const [k, v] of Object.entries(options.attrs)) node.setAttribute(k, v);
  return node;
}
