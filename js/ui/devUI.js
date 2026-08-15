// The debug menu.
//
// One popup with two faces. `Ctrl+M` shows the switch — the thing that moves you
// between the real save and the developer one. `M` on its own shows the tools,
// and only once you are already in developer mode: outside it, the key does
// nothing whatsoever, no panel and no message. A menu that announces itself to
// someone who just wanted to walk left is a menu in the wrong place.

import { dev, setMode, DEV_DAMAGE, SPEEDS } from '../systems/dev.js';
import { ENEMY_NAMES, makeEnemy } from '../world/room.js';
import { ITEM_DEFS } from '../data/items.js';
import { sfx } from '../engine/audio.js';

const popup = document.getElementById('dev-popup');
const titleEl = document.getElementById('dev-title');
const bodyEl = document.getElementById('dev-body');
const badge = document.getElementById('dev-badge');

let game = null;
let face = null;          // 'switch' | 'tools'

export function init(g) {
  game = g;
  badge.classList.toggle('hidden', !dev.on);
}

export function isOpen() { return !popup.classList.contains('hidden'); }
export function close() { popup.classList.add('hidden'); face = null; }

/** Ctrl+M — in or out of developer mode. */
export function openSwitch() {
  if (isOpen() && face === 'switch') { close(); sfx.ui(); return; }
  face = 'switch';
  drawSwitch();
  popup.classList.remove('hidden');
  sfx.uiBig();
}

/** M — the tools, which only exist inside developer mode. */
export function openTools() {
  if (!dev.on) return;
  if (isOpen() && face === 'tools') { close(); sfx.ui(); return; }
  face = 'tools';
  drawTools();
  popup.classList.remove('hidden');
  sfx.uiBig();
}

/* ============================================================
   The switch
   ============================================================ */

function drawSwitch() {
  titleEl.textContent = dev.on ? 'Leave Developer Mode' : 'Developer Mode';
  bodyEl.innerHTML = dev.on
    ? `<p class="dev-note">Back to your real save. The developer save stays where it is —
         nothing on it is thrown away, and you can come back to it with <code>Ctrl+M</code>.</p>`
    : `<p class="dev-note">Developer mode plays on a save of its own, under the key
         <code>testdeveloperidkdktestperioddpr</code>. Your real save is not read, not written,
         and not touched.</p>
       <p class="dev-note">Once you are in, <code>M</code> opens the tools.</p>`;

  const row = document.createElement('div');
  row.className = 'btn-row';

  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => { close(); sfx.ui(); });

  const go = document.createElement('button');
  go.textContent = dev.on ? 'Leave' : 'Enter';
  if (dev.on) go.className = 'danger';
  // The page reloads: it is the only way to be sure nothing from one save is
  // still sitting in memory while the other one is being played.
  go.addEventListener('click', () => setMode(!dev.on));

  row.append(cancel, go);
  bodyEl.appendChild(row);
}

/* ============================================================
   The tools
   ============================================================ */

function group(label) {
  const g = document.createElement('div');
  g.className = 'dev-group';
  g.insertAdjacentHTML('beforeend', `<span class="dev-label">${label}</span>`);
  return g;
}

function chip(text, on, onClick) {
  const b = document.createElement('button');
  b.className = 'dev-chip' + (on ? ' on' : '');
  b.textContent = text;
  b.addEventListener('click', () => { onClick(); sfx.ui(); drawTools(); });
  return b;
}

function select(options) {
  const el = document.createElement('select');
  for (const [value, label] of options) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    el.appendChild(o);
  }
  return el;
}

function drawTools() {
  titleEl.textContent = 'Debug Menu';
  bodyEl.innerHTML = '';

  /* ---- spawn ---- */
  const spawn = group('Spawn enemy');
  const spawnLine = document.createElement('div');
  spawnLine.className = 'dev-line';
  const kind = select(Object.entries(ENEMY_NAMES));
  const spawnBtn = document.createElement('button');
  spawnBtn.textContent = 'Spawn';
  spawnBtn.addEventListener('click', () => {
    const room = game.room, p = game.player;
    if (!room || !p) return;
    // A little way off, so a Dragon King does not land on your head.
    const e = makeEnemy(kind.value, p.x + 60, p.y);
    if (!e) { sfx.denied(); return; }
    e.defIndex = -1;               // never part of the room definition, never saved
    room.enemies.push(e);
    sfx.uiBig();
  });
  spawnLine.append(kind, spawnBtn);
  spawn.appendChild(spawnLine);

  /* ---- drop ---- */
  const drop = group('Drop item at your feet');
  const dropLine = document.createElement('div');
  dropLine.className = 'dev-line';
  const item = select(Object.values(ITEM_DEFS).map((d) => [d.id, d.name]));
  const count = document.createElement('input');
  count.type = 'number'; count.min = '1'; count.max = '64'; count.value = '1';
  const dropBtn = document.createElement('button');
  dropBtn.textContent = 'Drop';
  dropBtn.addEventListener('click', () => {
    const room = game.room, p = game.player;
    if (!room || !p) return;
    room.addDrop(item.value, p.x, p.y, Math.max(1, Math.min(64, +count.value || 1)));
    sfx.pickup();
  });
  dropLine.append(item, count, dropBtn);
  drop.appendChild(dropLine);

  /* ---- cheats ---- */
  const cheats = group('Cheats');
  const cheatChips = document.createElement('div');
  cheatChips.className = 'dev-chips';
  cheatChips.append(
    chip('Godmode', dev.god, () => { dev.god = !dev.god; }),
    chip(`Damage ×${DEV_DAMAGE}`, dev.damageMul > 1, () => {
      dev.damageMul = dev.damageMul > 1 ? 1 : DEV_DAMAGE;
    }),
  );
  cheats.appendChild(cheatChips);

  /* ---- speed ---- */
  const speed = group('Move speed');
  const speedChips = document.createElement('div');
  speedChips.className = 'dev-chips';
  for (const v of SPEEDS) {
    speedChips.appendChild(chip(`${v}×`, dev.speedMul === v, () => { dev.speedMul = v; }));
  }
  speed.appendChild(speedChips);

  bodyEl.append(spawn, drop, cheats, speed);
  bodyEl.insertAdjacentHTML('beforeend',
    '<div class="dev-foot"><b>Ctrl+M</b> — leave developer mode</div>');
}
