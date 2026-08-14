// Into the Book — boot, game loop, and the glue between world, combat and UI.

import { scene, lights, screen, sctx, resize, nudgeScale, view, VW, VH, TILE } from './engine/canvas.js';
import { present, clearLights, FX } from './engine/postfx.js';
import * as P from './engine/particles.js';
import * as cam from './engine/camera.js';
import * as input from './engine/input.js';
import { sfx, unlock as unlockAudio } from './engine/audio.js';
import * as music from './engine/music.js';

import { LIBRARY, BOOKS } from './data/rooms.js';
import { FIST, ITEM_DEFS } from './data/items.js';
import { applyMod, CRIT_MULT } from './data/modifiers.js';

import { Room } from './world/room.js';
import * as dungeon from './world/dungeon.js';
import { inArc } from './world/collision.js';
import { Player } from './entities/player.js';
import { WaveField } from './entities/wave.js';

import { Container } from './systems/inventory.js';
import { Smelter } from './systems/smelting.js';
import * as save from './systems/save.js';

import * as hud from './ui/hud.js';
import * as invUI from './ui/inventoryUI.js';
import * as craftUI from './ui/craftUI.js';
import * as shelfUI from './ui/shelfUI.js';
import * as hotbar from './ui/hotbar.js';
import * as shopUI from './ui/shopUI.js';

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
  smelter: new Smelter(),
  bookIndex: 0,
  bookDefeated: false,
  // book four only: how deep this run is, and the deepest landing reached
  depth: 0,
  milestone: 0,
  runSeed: 1,
  cleared: save.cleared(),
  paused: false,
  time: 0,

  toast: () => {},
  refreshInventory,
  syncWeapon,
  enterBook,
  onBossDefeated,
  // console escape hatches
  unlockAll: () => {
    BOOKS.forEach((b, i) => { if (b.rooms || b.infinite) { game.cleared.add(i); save.markCleared(i); } });
    shelfUI.refresh();
  },
  wipeSave: () => { save.wipe(); game.cleared = new Set(); shelfUI.refresh(); },
};

window.game = game;   // handy for debugging from the console

// The satchel outlives a reload, because the unlock and the sword have to
// travel together: book two only opens once book one is done, and book one is
// only finishable with the sword you forged in it.
save.loadSatchel(game.inventory);

/* ============================================================
   Boot
   ============================================================ */

resize();
invUI.init(game);
craftUI.init(game);
shelfUI.init(game);
hotbar.init(game);
shopUI.init(game);

const titleScreen = document.getElementById('title-screen');
const deathScreen = document.getElementById('death-screen');
const resetScreen = document.getElementById('reset-screen');
const fade = document.getElementById('fade');

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('respawn-btn').addEventListener('click', respawn);
document.getElementById('reset-cancel').addEventListener('click', closeReset);
document.getElementById('reset-confirm').addEventListener('click', () => {
  save.wipe();
  location.reload();          // the cleanest wipe: nothing in memory survives it
});

/**
 * R opens it, and it always asks first. Throwing away every book you have
 * finished should not be one keystroke away from a movement key.
 */
function openReset() {
  if (resetOpen() || anyPopupOpen()) return;
  resetScreen.classList.remove('hidden');
  sfx.uiBig();
}
function closeReset() {
  if (!resetOpen()) return;
  resetScreen.classList.add('hidden');
  sfx.ui();
}
function resetOpen() { return !resetScreen.classList.contains('hidden'); }

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && !e.repeat) openReset();
  else if (e.code === 'Escape' && resetOpen()) closeReset();
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
  hud.setPrompt(null);
  // Leaving a book is the moment the player thinks of as "done for now", so it
  // is the moment the world is written down.
  if (game.scene === 'book') {
    if (inDungeon()) save.saveDungeon(game.bookIndex, game.milestone, game.inventory, hotbar.selectedIndex());
    else if (game.rooms.length) {
      save.saveBook(game.bookIndex, game.rooms, game.inventory, hotbar.selectedIndex(), game.smelter);
    }
  }
  if (game.player) { game.player.speedMul = 1; game.player.frozen = false; }
  game.scene = 'library';
  game.rooms = [];
  game.room = new Room(LIBRARY);
  game.player = new Player(LIBRARY.spawn.x, LIBRARY.spawn.y);
  game.room._player = game.player;
  syncWeapon();
  hud.show();
  hotbar.show();
  hud.setRoom(LIBRARY.name);
  hud.setHearts(game.player.hp, game.player.maxHp);
  hud.hideBoss();
  P.clear();
  cam.reset();
  flashFromBlack();
  music.play('oakvale');

  // No popup. A finished book is something you notice on the shelf.
  game.bookDefeated = false;
  shelfUI.refresh();
}

/* ============================================================
   Entering a book
   ============================================================ */

function enterBook(index) {
  const book = BOOKS[index];
  if (!book || (!book.rooms && !book.infinite) || locked(index)) return;

  game.bookIndex = index;
  game.bookDefeated = false;

  if (book.infinite) {
    enterDungeon(index);
    return;
  }

  // fresh run: rebuild rooms and the forge. Chests carry their own contents.
  game.rooms = book.rooms.map((def) => new Room(def));
  game.roomIndex = 0;

  // Gates you broke stay broken, chests you emptied stay empty, and the forge
  // is exactly as you left it. Only a book you have never opened gets a cold
  // one — resetting a half-finished smelt would burn the ore it was holding.
  if (!save.restoreBook(index, game.rooms, game.smelter)) game.smelter.reset();

  game.scene = 'book';
  music.play('rush');
  loadRoom(0, 'forward');
}

/* ============================================================
   Book four: rooms that do not exist until you reach them
   ============================================================ */

/**
 * `game.rooms` is a Map here, not an array — an endless book cannot build its
 * floors up front, and anything behind you is unreachable anyway, so it is
 * released rather than kept.
 */
function enterDungeon(index) {
  game.rooms = new Map();
  game.milestone = save.deepest(index);
  game.runSeed = (Math.random() * 0xffffffff) >>> 0;
  game.smelter.reset();
  game.scene = 'book';
  music.play('rush');
  // You always land on the last checkpoint you reached; a fresh run starts at 1.
  loadDepth(Math.max(1, game.milestone));
}

function dungeonRoom(depth) {
  let room = game.rooms.get(depth);
  if (!room) {
    room = new Room(dungeon.makeRoom(game.runSeed, depth));
    game.rooms.set(depth, room);
  }
  return room;
}

/** Forget everything except the floor you are standing on. */
function releaseRooms(keep) {
  for (const d of [...game.rooms.keys()]) if (d !== keep) game.rooms.delete(d);
}

function loadDepth(depth) {
  const room = dungeonRoom(depth);
  releaseRooms(depth);

  game.depth = depth;
  game.roomIndex = depth;
  game.room = room;
  room.smelter = game.smelter;

  if (dungeon.isMilestone(depth) && depth > game.milestone) {
    game.milestone = depth;
    save.setDeepest(game.bookIndex, depth);
  }

  const at = room.def.spawn;
  if (!game.player) game.player = new Player(at.x, at.y);
  else { game.player.x = at.x; game.player.y = at.y; game.player.vx = game.player.vy = 0; }
  game.player.knockX = game.player.knockY = 0;
  game.player.invuln = 0.8;
  game.player.frozen = false;
  room._player = game.player;

  hud.setRoom(room.def.name);
  hud.setHearts(game.player.hp, game.player.maxHp);
  bossBarUp = false;
  hud.hideBoss();
  P.clear();
  cam.reset();
  flashFromBlack();
}

const inDungeon = () => game.scene === 'book' && BOOKS[game.bookIndex]?.infinite;

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

  bossBarUp = false;
  hud.hideBoss();

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
let bossBarUp = false;

function tryRoomTransition() {
  if (transitioning || game.scene !== 'book') return;
  // Not during a boss cutscene. The player is frozen, but standing on the
  // doorway tile would still drag them out of the room — which abandons the
  // boss mid-collapse and leaves the book unfinished.
  if (game.room.boss?.locksPlayer) return;
  const exit = game.room.exitUnder(game.player);
  if (!exit) return;

  const def = game.room.def;

  // The dungeon only ever goes deeper.
  if (inDungeon()) {
    if (exit !== 'E') return;
    transitioning = true;
    fadeThen(() => { loadDepth(game.depth + 1); transitioning = false; });
    return;
  }

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
    || shopUI.isOpen()
    || !deathScreen.classList.contains('hidden')
    || !resetScreen.classList.contains('hidden');
}

function closeAllPopups() {
  closeReset();
  shopUI.close();
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
      invUI.open(prop.container, prop.title);
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
    case 'merchant':
      shopUI.open(prop);
      return true;
    case 'portal':
      goToLibrary();
      return true;
  }
  return false;
}

function resolveSwing() {
  const p = game.player;
  const room = game.room;
  const w = p.weapon;
  let hitAnything = false;

  // Some things in your hand are not swung. Left click puts them down.
  if (w.kind === 'place') return placeHeld();

  // One roll per swing, not per target: a critical is a good hit, not a good
  // frame, and rolling per enemy would make crowds crit constantly.
  const crit = Math.random() < (w.crit || 0);
  const dmg = crit ? Math.round(w.damage * CRIT_MULT) : w.damage;
  if (crit && w.damage > 0) {
    cam.shake(5, 0.22);
    P.burst(p.x + Math.cos(p.attackAngle) * 14, p.y + Math.sin(p.attackAngle) * 14, 12, {
      colour: '#fff2b0', speed: 130, life: 0.35, size: 2, drag: 0.88,
      glow: 14, glowColour: 'rgba(255,242,176,ALPHA)',
    });
  }

  // The wave gun does not swing at anything: it plants a cone that then does
  // the work on its own clock. Only the opening hit is resolved here.
  if (w.kind === 'wave') {
    room.addWave(new WaveField(p.x, p.y, p.attackAngle, w));
    for (const e of room.enemies) {
      if (e.dead || e.invisible) continue;
      if (inArc(p.x, p.y, p.attackAngle, w.arc, w.range + (e.radius || 8), e.x, e.y)) {
        e.hurt(w.damage, p.x, p.y);
        hitAnything = true;
      }
    }
    for (const pr of room.projectiles()) {
      if (inArc(p.x, p.y, p.attackAngle, w.arc, w.range, pr.x, pr.y)) {
        pr.strike(w, p.x, p.y);
        hitAnything = true;
      }
    }
    // water does nothing to a barred door — the gate still wants a blade
    return hitAnything;
  }

  for (const e of room.enemies) {
    if (e.dead) continue;
    if (e.invisible) continue;
    if (inArc(p.x, p.y, p.attackAngle, w.arc, w.range + (e.radius || 8), e.x, e.y)) {
      e.hurt(dmg, p.x, p.y);
      hitAnything = true;
    }
  }

  // Fireballs can be batted out of the air. This is not damage — bare hands
  // deal zero — so it is resolved through the projectile's own integrity pool.
  for (const pr of room.projectiles()) {
    if (inArc(p.x, p.y, p.attackAngle, w.arc, w.range + (pr.radius || 4) + 8, pr.x, pr.y)) {
      pr.strike(w, p.x, p.y);
      hitAnything = true;
    }
  }

  const gate = room.gate;
  if (gate && !gate.open) {
    if (inArc(p.x, p.y, p.attackAngle, w.arc, w.range + 12, gate.x, gate.y)) {
      gate.strike(dmg, w, p.x, p.y);
      hitAnything = true;
    }
  }

  return hitAnything;
}

/**
 * Put the held block down where the cursor is, if that is close enough and the
 * floor is clear. Costs one of them — a nest is spent by placing it.
 */
function placeHeld() {
  const p = game.player;
  const room = game.room;
  const slot = game.inventory.slots[hotbar.selectedIndex()];
  if (!slot || slot.id !== 'blackholian_nest') return false;

  const tx = input.mouse.x, ty = input.mouse.y;
  if (Math.hypot(tx - p.x, ty - p.y) > 48) { sfx.denied(); return false; }
  if (room.map.solidPx(tx, ty)) { sfx.denied(); return false; }

  room.addNest(tx, ty);
  game.inventory.remove('blackholian_nest', 1);
  refreshInventory();
  return true;
}

/** Walk into a locked gate carrying a key -> it opens. */
function tryUnlockGate() {
  const gate = game.room.gate;
  if (!gate || gate.open || gate.kind !== 'locked') return;
  const d = Math.hypot(game.player.x - gate.x, game.player.y - gate.y);
  if (d > 30) return;
  if (game.inventory.has(gate.keyId, 1)) {
    game.inventory.remove(gate.keyId, 1);
    gate.unlock();
    refreshInventory();
  }
}

/** A book is sealed until the one it depends on has been finished. */
function locked(index) {
  const b = BOOKS[index];
  if (!b || (!b.rooms && !b.infinite)) return true;
  return b.needs !== undefined && !game.cleared.has(b.needs);
}

/* ============================================================
   Weapon + inventory sync
   ============================================================ */

function syncWeapon() {
  if (!game.player) return;
  // Whatever sits in the selected hotbar slot is what you swing. No auto-equip:
  // holding coal means your swing does nothing, because fists deal 0.
  const held = game.inventory.slots[hotbar.selectedIndex()];
  const base = (held && ITEM_DEFS[held.id]?.weapon) || FIST;
  const w = applyMod(base, held?.mod);
  game.player.weapon = w;
  hotbar.refresh();
}

function refreshInventory() {
  invUI.refresh();
  hotbar.refresh();
  craftUI.refreshSmelter();
  craftUI.refreshAnvil();
  shopUI.refresh();
  syncWeapon();
}

/* ============================================================
   Death / victory
   ============================================================ */

/**
 * Killing the boss only marks the book done — no popup, ever. You find out the
 * story ended by walking back to the library and seeing the chain gone from the
 * next book on the shelf.
 */
function onBossDefeated() {
  game.bookDefeated = true;
  game.cleared.add(game.bookIndex);
  save.markCleared(game.bookIndex);
  save.saveBook(game.bookIndex, game.rooms, game.inventory, hotbar.selectedIndex(), game.smelter);
  hud.hideBoss();
  sfx.victory();
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

  // The dungeon has no "this room again" — it has a checkpoint. Everything you
  // are carrying comes with you; what you lose is the descent since the last
  // landing.
  if (inDungeon()) {
    game.rooms.clear();
    loadDepth(Math.max(1, game.milestone));
    return;
  }

  // restart the current room's fight from its entrance
  const room = game.rooms[game.roomIndex];
  if (room) {
    const fresh = new Room(room.def);
    fresh.smelter = game.smelter;
    fresh.inheritContainers(room);
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
  music.update(dt);

  // the forge keeps running while you're away from it
  const produced = game.smelter.update(dt);
  if (produced) {
    const left = game.inventory.add(produced, 1);
    if (left > 0) {
      game.smelter.progress = 1;   // hold it until there's room
      game.smelter.oreId = game.smelter.oreId || null;
    } else {
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

  // A boss waking up or going down owns the screen: the player keeps breathing
  // but does not get to act, and cannot be hit while they are locked out.
  const cinematic = !!room.boss?.locksPlayer;
  p.frozen = cinematic;
  if (cinematic) p.invuln = Math.max(p.invuln, 0.2);

  if (!cinematic) {
    // --- dash ---
    if ((input.pressed('Space') || input.pressed('KeyF')) && !p.dead) {
      const ax = input.axis();
      p.startDash(ax.x, ax.y);
    }

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
  }

  p.update(dt, room.map, room.solids());
  room.update(dt, p, game);

  tryUnlockGate();
  tryRoomTransition();

  P.update(dt);
  cam.update(dt);
  hotbar.update(dt);

  // --- hud ---
  hud.setHearts(p.hp, p.maxHp);

  const near = room.nearestInteractive(p);
  hud.setPrompt(near && !p.dead && !cinematic ? near.label : null);

  // The bar arrives with the fight, not with the room: it would be a strange
  // thing to stare at while the boss is still asleep.
  const boss = room.boss;
  if (boss && !boss.dead && !boss.locksPlayer) {
    if (!bossBarUp) { bossBarUp = true; hud.showBoss(boss.name); }
    hud.updateBoss(boss.hp, boss.maxHp, boss.phase);
  } else if (boss?.dead && bossBarUp) {
    bossBarUp = false;
    hud.hideBoss();
  }

  // --- death ---
  if (p.dead && !deathShown && p.deathT > 1.1) {
    deathShown = true;
    deathScreen.classList.remove('hidden');
  }
  if (!p.dead) deathShown = false;
}

function handleKeys(popups) {
  // Esc is a long reach from WASD when one hand stays on QWEASD and the other
  // on the mouse, so E and Q close panels too — including the one that opened.
  const closeKey = input.pressed('KeyQ') || input.pressed('KeyE') || input.pressed('Escape');

  if (popups) {
    if (closeKey) { closeAllPopups(); sfx.ui(); }
    return;
  }

  if (input.pressed('KeyQ')) { invUI.open(null); sfx.uiBig(); }

  // debug: toggle the post-processing chain
  if (input.pressed('F1')) {
    FX.bloom = FX.fog = FX.vignette = FX.grain = FX.aberration = !FX.bloom;
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
    zoom: cam.cam.zoom,
    zoomX: cam.cam.zoomX,
    zoomY: cam.cam.zoomY,
    shakeX: cam.totalX() * (screen.width / VW),
    shakeY: cam.totalY() * (screen.width / VW),
    vignette: (room.mood.vignette ?? 1) + lowHp * 0.5,
    aberration: 0.12 + lowHp * 0.5 + (p?.hurtFlash || 0) * 2,
  });
}

requestAnimationFrame(frame);
