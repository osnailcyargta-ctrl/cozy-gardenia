/**
 * Bootstrap: load the save, resolve time spent away, wire the panels, tick.
 */

import { load, advanceAll, flushSave, scheduleSave, state, addCoins, reset, isReady } from './state.js';
import { now, startLoop, onTick, advanceClock } from './time.js';
import { initTabs, initHUD, initModal, renderHUD, onTabChange, getTab, toast } from './ui.js';
import { initGarden, renderGarden } from './garden.js';
import { initMerchant, renderMerchant, tickMerchant } from './merchant.js';
import { initPhone } from './phone.js';

function catchUpOffline() {
  const previous = state.lastSeenAt;
  const t = now();
  advanceAll(t);
  tickMerchant(t);

  const away = t - previous;
  if (away > 60_000) {
    const ready = state.pots.filter(isReady).length;
    if (ready > 0) {
      toast(`Welcome back — ${ready} pot${ready === 1 ? '' : 's'} finished blooming.`, 'good');
    }
  }
}

function tick(t) {
  advanceAll(t);
  const restocked = tickMerchant(t);

  // Only the visible panel needs repainting.
  if (getTab() === 'garden') renderGarden();
  if (getTab() === 'merchant') renderMerchant();
  renderHUD();

  if (restocked && getTab() !== 'merchant') toast('The merchant restocked.', 'info');
  scheduleSave();
}

function boot() {
  load();

  initModal();
  initHUD();
  initGarden();
  initMerchant();
  initPhone();
  initTabs();

  catchUpOffline();
  renderGarden();
  renderMerchant();
  renderHUD();

  onTabChange((name) => {
    if (name === 'garden') renderGarden();
    if (name === 'merchant') renderMerchant();
  });

  onTick(tick);
  startLoop();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
    else {
      advanceAll();
      tickMerchant();
      renderGarden();
      renderMerchant();
      renderHUD();
    }
  });
  window.addEventListener('pagehide', flushSave);

  document.getElementById('app')?.classList.add('is-ready');

  // Small console handle for poking at the game (and for the test harness).
  window.gardenia = {
    state: () => state,
    grant: (n = 1000) => {
      addCoins(n);
      renderHUD();
      renderGarden();
      renderMerchant();
      return state.coins;
    },
    reset: () => {
      reset();
      location.reload();
    },
    /** Fast-forward the game clock, in seconds. */
    skip: (seconds = 60) => {
      advanceClock(seconds * 1000);
      const t = now();
      advanceAll(t);
      tickMerchant(t);
      renderGarden();
      renderMerchant();
      renderHUD();
      return seconds;
    },
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
