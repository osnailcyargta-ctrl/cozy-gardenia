// Hearts, weapon slot, room name, boss bar, prompts and toasts.

import { decode } from '../engine/sprite.js';
import { HEARTS } from '../data/sprites.js';

const HEART_SPR = {
  full: decode(HEARTS.full[0], 'heart:full'),
  half: decode(HEARTS.half[0], 'heart:half'),
  empty: decode(HEARTS.empty[0], 'heart:empty'),
};

function heartCanvas(kind) {
  const c = document.createElement('canvas');
  c.width = 9; c.height = 8;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(HEART_SPR[kind], 0, 0);
  return c;
}

const hud = document.getElementById('hud');
const heartsEl = document.getElementById('hearts');
const roomLabel = document.getElementById('room-label');
const bossBar = document.getElementById('boss-bar');
const bossFill = document.getElementById('boss-fill');
const bossLag = document.getElementById('boss-lag');
const bossName = document.getElementById('boss-name');

let lastHp = null;
let heartEls = [];

export function show() { hud.classList.remove('hidden'); }
export function hide() { hud.classList.add('hidden'); }

export function setHearts(hp, maxHp) {
  const perHeart = 10;
  const total = Math.ceil(maxHp / perHeart);

  if (heartEls.length !== total) {
    heartsEl.innerHTML = '';
    heartEls = [];
    for (let i = 0; i < total; i++) {
      const el = document.createElement('div');
      el.className = 'heart';
      el.appendChild(heartCanvas('full'));
      heartsEl.appendChild(el);
      heartEls.push(el);
    }
  }

  const damaged = lastHp !== null && hp < lastHp;
  heartEls.forEach((el, i) => {
    const v = hp - i * perHeart;
    const kind = v >= perHeart ? 'full' : v >= perHeart / 2 ? 'half' : 'empty';
    el.className = 'heart ' + kind;
    if (el.dataset.kind !== kind) {
      el.dataset.kind = kind;
      el.replaceChildren(heartCanvas(kind));
    }
    if (damaged && v < perHeart) {
      el.classList.remove('pulse');
      void el.offsetWidth;
      el.classList.add('pulse');
    }
  });
  lastHp = hp;
}


export function setRoom(name) { roomLabel.textContent = name; }


export function toast() { /* removed: the game no longer narrates itself */ }

export function showBoss(name) {
  bossName.textContent = name;
  bossBar.classList.remove('hidden', 'phase2');
  bossFill.style.width = '100%';
  bossLag.style.width = '100%';
}

export function updateBoss(hp, maxHp, phase) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  bossFill.style.width = pct + '%';
  bossLag.style.width = pct + '%';
  bossBar.classList.toggle('phase2', phase === 2);
}

export function hideBoss() { bossBar.classList.add('hidden'); }
