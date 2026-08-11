// Hearts, weapon slot, room name, boss bar, prompts and toasts.

import { paintIcon } from './icons.js';

const hud = document.getElementById('hud');
const heartsEl = document.getElementById('hearts');
const weaponIcon = document.getElementById('weapon-icon');
const weaponName = document.getElementById('weapon-name');
const roomLabel = document.getElementById('room-label');
const promptEl = document.getElementById('prompt');
const promptText = promptEl.querySelector('span');
const toastsEl = document.getElementById('toasts');
const bossBar = document.getElementById('boss-bar');
const bossFill = document.getElementById('boss-fill');
const bossLag = document.getElementById('boss-lag');
const bossName = document.getElementById('boss-name');

let lastHp = null;
let heartEls = [];

export function show() { hud.classList.remove('hidden'); }
export function hide() { hud.classList.add('hidden'); }

export function setHearts(hp, maxHp) {
  const perHeart = 2;
  const total = Math.ceil(maxHp / perHeart);

  if (heartEls.length !== total) {
    heartsEl.innerHTML = '';
    heartEls = [];
    for (let i = 0; i < total; i++) {
      const el = document.createElement('div');
      el.className = 'heart';
      heartsEl.appendChild(el);
      heartEls.push(el);
    }
  }

  const damaged = lastHp !== null && hp < lastHp;
  heartEls.forEach((el, i) => {
    const v = hp - i * perHeart;
    el.className = 'heart' + (v >= perHeart ? '' : v >= 1 ? ' half' : ' empty');
    if (damaged && v < perHeart) {
      el.classList.remove('pulse');
      void el.offsetWidth;
      el.classList.add('pulse');
    }
  });
  lastHp = hp;
}

export function setWeapon(w) {
  weaponName.textContent = w.name;
  const x = weaponIcon.getContext('2d');
  x.clearRect(0, 0, weaponIcon.width, weaponIcon.height);
  if (w.isFist) {
    // no icon for bare hands; draw a small knuckle glyph so the slot isn't empty
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#c98f5e';
    x.fillRect(7, 9, 10, 7);
    x.fillStyle = '#efc396';
    x.fillRect(7, 9, 10, 2);
    x.fillStyle = '#3a2a1c';
    for (let i = 0; i < 3; i++) x.fillRect(9 + i * 3, 12, 1, 3);
  } else {
    paintIcon(weaponIcon, 'iron_sword');
  }
}

export function setRoom(name) { roomLabel.textContent = name; }

export function setPrompt(text) {
  if (!text) { promptEl.classList.add('hidden'); return; }
  if (promptText.textContent !== text) promptText.textContent = text;
  promptEl.classList.remove('hidden');
}

export function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  toastsEl.appendChild(el);
  setTimeout(() => el.remove(), 2600);
  // never let toasts stack off-screen
  while (toastsEl.children.length > 4) toastsEl.firstChild.remove();
}

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
