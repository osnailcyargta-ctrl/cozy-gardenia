// Into the Book — boot, game loop, and the glue between world, combat and UI.

import { scene, lights, screen, sctx, resize, nudgeScale, view, VW, VH, TILE } from './engine/canvas.js';
import { present, clearLights, FX } from './engine/postfx.js';
import * as P from './engine/particles.js';
import * as cam from './engine/camera.js';
import * as input from './engine/input.js';
import { sfx, unlock as unlockAudio } from './engine/audio.js';

import { LIBRARY, BOOKS } from './data/rooms.js';
import { FIST, ITEM_DEFS } from './data/items.js';

import { Room } from './world/room.js';
import { inArc } from './world/collision.js';
import { Player } from './entities/player.js';
import { Servant } from './entities/servant.js';
import { DragonKing } from './entities/dragonking.js';

import { Container } from './systems/inventory.js';
import { Smelter } from './systems/smelting.js';

import * as hud from './ui/hud.js';
import * as invUI from './ui/inventoryUI.js';
import * as craftUI from './ui/craftUI.js';
import * as shelfUI from './ui/shelfUI.js';

/* ============================================================
   Game state
   ============================================================ */

const game = {
  scene: 'title',           // title | library | book
  room: null,
  rooms: [],
  roomIndex: 0,
  player: null,
  inventory: new Container(16, 'Satchel'),
  chest: new Container(9, 'Chest'),
  smelter: new Smelter(),
  bookDefeated: false,
  paused: false,
  time: 0,

  toast: hud.toast,
  refreshInventory,
  syncWeapon,
  enterBook,
  onBossDefeated,
};

window.game = game;   // handy for debugging from the console

/* ============================================================
   Boot
   ============================================================ */

resize();
invUI.init(game);
craftUI.init(game);
shelfUI.init(game);

const titleScreen = document.getElementById('title-screen');
const deathScreen = document.getElementById('death-screen');
const victoryScreen = document.getElementById('victory-screen');
const fade = document.getElementById('fade');

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('respawn-btn').addEventListener('click', respawn);
document.getElementById('victory-btn').addEventListener('click', () => {
  victoryScreen.classList.add('hidden');
  goToLibrary();
});

function startGame() {
  unlockAudio();
  sfx.uiBig();
  titleScreen.classList.add('leaving');
  setTimeout(() => {
    titleScreen.classList.add('hidden');
    titleScreen.classList.remove('leaving');
    goToLibrary();
  }, 600);
}

function goToLibrary() {
  game.scene = 'library';
  game.rooms = [];
  game.room = new Room(LIBRARY);
  game.player = new Player(LIBRARY.spawn.x, LIBRARY.spawn.y);
  game.room._player = game.player;
  syncWeapon();
  hud.show();
  hud.setRoom(LIBRARY.name);
  hud.setHearts(game.player.hp, game.player.maxHp);
  hud.hideBoss();
  P.clear();
  cam.reset();
  flashFromBlack();
}

/* ============================================================
   Entering a book
   ============================================================ */

function enterBook(index) {
  const book = BOOKS[index];
  if (!book || book.locked || !book.rooms) return;

  // fresh run: rebuild rooms, reset the chest and the forge
  game.rooms = book.rooms.map((def) => new Room(def));
  game.roomIndex = 0;
  game.bookDefeated = false;

  game.chest.clear();
  game.chest.slots[0] = { id: 'coal', count: 1 };
  game.chest.slots[4] = { id: 'iron_ore', count: 3 };
  game.smelter.reset();

  game.scene = 'book';
  loadRoom(0, 'forward');
}

function loadRoom(index, dir) {
  game.roomIndex = index;
  const room = game.rooms[index];
  game.room = room;
  room.smelter = game.smelter;

  const def = room.def;
  const at = dir === 'back' ? (def.spawnBack || def.spawn) : def.spawn;

  if (!game.player) game.player = new Player(at.x, at.y);
  else { game.player.x = at.x; game.player.y = at.y; game.player.vx = game.player.vy = 0; }
  game.player.knockX = game.player.knockY = 0;
  game.player.invuln = 0.6;
  room._player = game.player;

  hud.setRoom(def.name);
  hud.setHearts(game.player.hp, game.player.maxHp);

  const boss = room.boss;
  if (boss && !boss.dead) hud.showBoss('Dragon King');
  else hud.hideBoss();

  P.clear();
  cam.reset();
  flashFromBlack();
}

function flashFromBlack() {
  fade.classList.remove('hidden', 'to-black');
  fade.classList.add('from-black');
  setTimeout(() => fade.classList.add('hidden'), 560);
}

/* ============================================================
   Transitions between rooms
   ============================================================ */

let transitioning = false;

function tryRoomTransition() {
  if (transitioning || game.scene !== 'book') return;
  const exit = game.room.exitUnder(game.player);
  if (!exit) return;

  const def = game.room.def;
  if (exit === 'E' && def.exitTo !== null && def.exitTo !== undefined) {
    transitioning = true;
    fadeThen(() => { loadRoom(def.exitTo, 'forward'); transitioning = false; });
  } else if (exit === 'B') {
    transitioning = true;
    if (def.backTo === 'library') {
      fadeThen(() => { goToLibrary(); transitioning = false; });
    } else if (typeof def.backTo === 'number') {
      fadeThen(() => { loadRoom(def.backTo, 'back'); transitioning = false; });
    } else {
      // nowhere to go — nudge the player back in
      game.player.x += 10;
      transitioning = false;
    }
  }
}

function fadeThen(fn) {
  fade.classList.remove('hidden', 'from-black');
  fade.classList.add('to-black');
  setTimeout(() => { fn(); }, 440);
}

/* ============================================================
   Interaction + combat
   ============================================================ */

function anyPopupOpen() {
  return invUI.isOpen() || craftUI.smelterOpen() || craftUI.anvilOpen() || shelfUI.isOpen()
    || !deathScreen.classList.contains('hidden')
    || !victoryScreen.classList.contains('hidden');
}

function closeAllPopups() {
  invUI.close();
  craftUI.closeSmelter();
  craftUI.closeAnvil();
  shelfUI.close();
  // whichever chest was open is no longer being looked at
  for (const p of game.room?.props || []) p.opened = false;
}

function doInteract() {
  const room = game.room;
  const prop = room.nearestInteractive(game.player);
  if (!prop) return false;

  switch (prop.type) {
    case 'shelf':
      shelfUI.open();
      return true;
    case 'chest':
      prop.opened = true;
      invUI.open(game.chest, 'Chest');
      sfx.uiBig();
      return true;
    case 'smelter':
      craftUI.openSmelter();
      sfx.uiBig();
      return true;
    case 'anvil':
      craftUI.openAnvil();
      sfx.uiBig();
      return true;
  }
  return false;
}

function resolveSwing() {
  const p = game.player;
  const room = game.room;
  const w = p.weapon;
  let hitAnything = false;

  for (const e of room.enemies) {
    if (e.dead) continue;
    if (e instanceof DragonKing && e.invisible) continue;
    if (inArc(p.x, p.y, p.attackAngle, w.arc, w.range + (e.radius || 8), e.x, e.y)) {
      e.hurt(w.damage, p.x, p.y);
      hitAnything = true;
    }
  }

  const gate = room.gate;
  if (gate && !gate.open) {
    if (inArc(p.x, p.y, p.attackAngle, w.arc, w.range + 12, gate.x, gate.y)) {
      const r = gate.strike(w.damage, w, p.x, p.y);
      hitAnything = true;
      if (r === 'blocked' && w.isFist && gate.kind === 'wood') {
        hud.toast('Your fists cannot break wood', 'bad');
      } else if (r === 'blocked' && gate.kind === 'locked') {
        hud.toast('Locked. Something here holds the key.', 'bad');
      } else if (r === 'broken') {
        hud.toast('The gate splinters open', 'good');
      }
    }
  }

  return hitAnything;
}

/** Walk into a locked gate carrying a key -> it opens. */
function tryUnlockGate() {
  const gate = game.room.gate;
  if (!gate || gate.open || gate.kind !== 'locked') return;
  const d = Math.hypot(game.player.x - gate.x, game.player.y - gate.y);
  if (d > 30) return;
  if (game.inventory.has('key', 1)) {
    game.inventory.remove('key', 1);
    gate.unlock();
    hud.toast('The key turns. The way opens.', 'good');
    refreshInventory();
  }
}

/* ============================================================
   Weapon + inventory sync
   ============================================================ */

function syncWeapon() {
  if (!game.player) return;
  const has = game.inventory.count('iron_sword') > 0;
  const w = has ? ITEM_DEFS.iron_sword.weapon : FIST;
  if (game.player.weapon !== w) game.player.weapon = w;
  hud.setWeapon(w);
}

function refreshInventory() {
  invUI.refresh();
  craftUI.refreshSmelter();
  craftUI.refreshAnvil();
  syncWeapon();
}

/* ============================================================
   Death / victory
   ============================================================ */

function onBossDefeated() {
  game.bookDefeated = true;
  hud.hideBoss();
  sfx.victory();
  setTimeout(() => {
    if (game.scene === 'book') victoryScreen.classList.remove('hidden');
  }, 2200);
}

function respawn() {
  deathScreen.classList.add('hidden');
  const p = game.player;
  p.dead = false;
  p.hp = p.maxHp;
  p.deathT = 0;
  p.invuln = 1.2;
  p.knockX = p.knockY = 0;
  p.vx = p.vy = 0;

  // restart the current room's fight from its entrance
  const room = game.rooms[game.roomIndex];
  if (room) {
    const fresh = new Room(room.def);
    fresh.smelter = game.smelter;
    game.rooms[game.roomIndex] = fresh;
    loadRoom(game.roomIndex, 'forward');
  } else {
    goToLibrary();
  }
}

let deathShown = false;

/* ============================================================
   Main loop
   ============================================================ */

let last = performance.now();

/* ---- adaptive resolution ----------------------------------
   Post-processing is fill-rate bound, so the honest lever when frames get
   expensive is to render fewer pixels and let CSS stretch the result. We watch
   a rolling average and step the backing store down when we're missing the
   budget, up when we have room to spare. The wide gap between the two
   thresholds, plus the cooldown, keeps it from oscillating.            */
const perf = { samples: [], cooldown: 2, settled: 0 };

function autoScale(dt) {
  perf.cooldown -= dt;
  perf.samples.push(dt);
  if (perf.samples.length > 45) perf.samples.shift();
  if (perf.samples.length < 45 || perf.cooldown > 0) return;

  const sorted = [...perf.samples].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];

  if (median > 0.0225) {              // slower than ~44fps — shed pixels
    if (nudgeScale(-1)) { perf.cooldown = 1.5; perf.samples.length = 0; perf.settled = 0; }
  } else if (median < 0.0132 && view.scale < view.maxScale) {   // comfortably above 75fps
    perf.settled += 1;
    if (perf.settled > 2 && nudgeScale(+1)) { perf.cooldown = 2.5; perf.samples.length = 0; perf.settled = 0; }
  } else {
    perf.settled = 0;
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.time += dt;

  update(dt);

  // A popup is a full pause, so the scene behind it is identical every frame —
  // redrawing it (and its whole post chain) would burn the budget for nothing.
  // The canvas keeps showing the last frame drawn.
  if (!game.renderPaused) {
    render(dt);
    autoScale(dt);
  }

  input.endFrame();
  requestAnimationFrame(frame);
}

function update(dt) {
  if (game.scene === 'title') return;

  const popups = anyPopupOpen();
  input.setUICapture(popups);
  game.renderPaused = popups;

  handleKeys(popups);

  // the forge keeps running while you're away from it
  const produced = game.smelter.update(dt);
  if (produced) {
    const left = game.inventory.add(produced, 1);
    if (left > 0) {
      hud.toast('Satchel full — bar left in the forge', 'bad');
      game.smelter.progress = 1;   // hold it until there's room
      game.smelter.oreId = game.smelter.oreId || null;
    } else {
      hud.toast(`Smelted: ${ITEM_DEFS[produced].name}`, 'good');
      sfx.pickup();
    }
    refreshInventory();
  }
  craftUI.updateSmeltProgress();

  // popups pause the world outright — particles and shake included
  if (popups) return;

  const p = game.player;
  const room = game.room;
  if (!p || !room) return;

  // --- attack ---
  if (input.tookLeftClick() && !p.dead) {
    const angle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
    p.startAttack(angle);
  }
  if (p.attacking && !p.swungThisAttack && p.attackT < 0.13) {
    p.swungThisAttack = true;
    resolveSwing();
  }

  // --- interact (E or right click) ---
  if ((input.pressed('KeyE') || input.tookRightClick()) && !p.dead) {
    doInteract();
  }

  p.update(dt, room.map, room.solids());
  room.update(dt, p, game);

  tryUnlockGate();
  tryRoomTransition();

  P.update(dt);
  cam.update(dt);

  // --- hud ---
  hud.setHearts(p.hp, p.maxHp);

  const boss = room.boss;
  if (boss) {
    if (!boss.dead) hud.updateBoss(boss.hp, boss.maxHp, boss.phase);
  }

  const near = room.nearestInteractive(p);
  hud.setPrompt(near && !p.dead ? near.label : null);

  // --- death ---
  if (p.dead && !deathShown && p.deathT > 1.1) {
    deathShown = true;
    deathScreen.classList.remove('hidden');
  }
  if (!p.dead) deathShown = false;
}

function handleKeys(popups) {
  // Q toggles the satchel; Esc backs out of whatever is open
  if (input.pressed('KeyQ')) {
    if (invUI.isOpen()) { invUI.close(); closeChests(); }
    else if (!popups) { invUI.open(null); sfx.uiBig(); }
  }

  if (input.pressed('Escape')) {
    if (popups) { closeAllPopups(); sfx.ui(); }
  }

  // debug: toggle the post-processing chain
  if (input.pressed('F1')) {
    FX.bloom = FX.fog = FX.vignette = FX.grain = FX.aberration = !FX.bloom;
    hud.toast('Effects ' + (FX.bloom ? 'on' : 'off'));
  }
}

function closeChests() {
  for (const p of game.room?.props || []) p.opened = false;
}

/* ============================================================
   Render
   ============================================================ */

function render(dt) {
  const ctx = scene.ctx;
  const lctx = lights.ctx;

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#07060d';
  ctx.fillRect(0, 0, VW, VH);

  if (game.scene === 'title' || !game.room) {
    // quiet drifting embers behind the title
    if (Math.random() > 0.75) {
      P.spawn({
        x: Math.random() * VW, y: VH + 4,
        vx: (Math.random() - 0.5) * 8, vy: -12 - Math.random() * 14,
        life: 3 + Math.random() * 2, size: 1,
        colour: Math.random() > 0.5 ? '#a866e0' : '#e87a2c',
        drag: 0.999, glow: 8,
        glowColour: 'rgba(180,120,220,ALPHA)',
      });
    }
    P.update(dt);
    clearLights(lctx);
    P.drawLights(lctx);
    P.draw(ctx);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(lights.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    present(sctx, scene.canvas, dt, { fog: 1.2, vignette: 1.15, aberration: 0.2 });
    return;
  }

  const room = game.room;

  // ---- scene ----
  room.draw(ctx);
  P.draw(ctx);

  // ---- lights ----
  // Two passes over one buffer: multiply carves the darkness (this is what
  // makes the room feel lit by torches rather than uniformly visible), then a
  // gentle additive pass lets the bright sources actually radiate.
  clearLights(lctx, room.mood.ambient || '#2a2438');
  room.drawLights(lctx);
  P.drawLights(lctx);

  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lights.canvas, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.22;
  ctx.drawImage(lights.canvas, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // ---- post ----
  const p = game.player;
  const lowHp = p ? 1 - p.hp / p.maxHp : 0;
  present(sctx, scene.canvas, dt, {
    ...room.mood,
    shakeX: cam.totalX() * (screen.width / VW),
    shakeY: cam.totalY() * (screen.width / VW),
    vignette: (room.mood.vignette ?? 1) + lowHp * 0.5,
    aberration: 0.12 + lowHp * 0.5 + (p?.hurtFlash || 0) * 2,
  });
}

requestAnimationFrame(frame);
