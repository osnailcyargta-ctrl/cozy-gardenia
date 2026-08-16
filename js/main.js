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

import { Room, makeEnemy } from './world/room.js';
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
import * as devUI from './ui/devUI.js';
import * as puzzleUI from './ui/puzzleUI.js';
import * as portalUI from './ui/portalUI.js';
import * as voidUI from './ui/voidUI.js';
import { Portal, tileCentre } from './entities/portalgun.js';
import { Claw } from './entities/claw.js';
import { ChainHook } from './entities/chainhook.js';
import { Prop } from './entities/props.js';
import * as rates from './world/spawnrates.js';
import { CORRUPT_BITE, CORRUPT_FLOOR } from './entities/nullbyte.js';

/** How often a void bites whatever is standing beside it. */
const VOID_BITE_EVERY = 1.5;
import { dev, DEV_DAMAGE } from './systems/dev.js';

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
  // Hard is a property of the run, not of the save. `pendingHard` is what the
  // lever sets; it only becomes real when you walk out of room one, so the
  // lever can be thrown back and forth as much as you like before committing.
  hard: false,
  pendingHard: false,
  // book four only: how deep this run is, and the deepest landing reached
  depth: 0,
  milestone: 0,
  runSeed: 1,
  cleared: save.cleared(),
  hardCleared: save.hardCleared(),
  paused: false,
  time: 0,

  toast: () => {},
  refreshInventory,
  syncWeapon,
  onShopSold: (stall) => {
    if (inDungeon()) save.markSold(game.bookIndex, game.depth, stall.soldRows);
  },
  enterBook,
  onBossDefeated,
  // console escape hatches
  unlockAll: () => {
    BOOKS.forEach((b, i) => {
      if (!b.rooms && !b.infinite) return;
      game.cleared.add(i); save.markCleared(i);
      game.hardCleared.add(i); save.markHardCleared(i);
    });
    shelfUI.refresh();
  },
  wipeSave: () => {
    // Leave the book BEFORE wiping, and only then wipe. The run is written out
    // every frame now, so a wipe with a book still open was undone on the next
    // frame — and going home afterwards was worse, because goToLibrary saves the
    // book on its way out and put the whole thing back.
    if (game.scene === 'book') goToLibrary();
    save.wipe();
    game.cleared = new Set();
    game.hardCleared = new Set();
    shelfUI.refresh();
  },
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
devUI.init(game);
puzzleUI.init(game);
portalUI.init(game);
voidUI.init(game);

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
    if (inDungeon()) {
      save.saveDungeon(game.bookIndex, game.milestone, game.inventory, hotbar.selectedIndex(), game.smelter);
    }
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
  game.hard = false;
  game.pendingHard = false;
  // Book three eats the top off your health bar and the library gives it back.
  // That already happens because goToLibrary builds a fresh Player, but relying
  // on a side effect for a rule the player can feel is asking for it.
  if (game.player) { game.player.maxHp = 100; game.player.hp = Math.min(game.player.hp, 100); }

  if (book.infinite) {
    enterDungeon(index);
    return;
  }

  // fresh run: rebuild rooms and the forge. Chests carry their own contents.
  game.rooms = book.rooms.map((def, i) => new Room(def, save.deadEnemies(index, i)));
  // The lever is bolted up there from the start, but there is nothing to choose
  // between until you have read the book once.
  if (!game.cleared.has(index)) {
    for (const r of game.rooms) r.props = r.props.filter((pr) => pr.type !== 'lever');
  }
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
  rates.resetRates();
  game.rateRoom = false;
  game.rooms = new Map();
  game.milestone = save.deepest(index);
  // Minted once and then kept. A fresh seed every visit meant the same landing
  // handed you a different station and a different stall each time you came
  // back to it — the depth persisted but nothing else did.
  game.runSeed = save.runSeed(index);
  save.restoreDungeon(index, game.smelter);
  game.scene = 'book';
  music.play('rush');
  // You always land on the last checkpoint you reached; a fresh run starts at 1.
  loadDepth(Math.max(1, game.milestone));
}

function dungeonRoom(depth) {
  let room = game.rooms.get(depth);
  if (!room) {
    const def = dungeon.makeRoom(game.runSeed, depth);
    const sold = save.soldRows(game.bookIndex, depth);
    if (sold) for (const p of def.props) if (p.type === 'merchant') p.soldRows = sold;
    room = new Room(def);
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

  const healed = healOnArrival(room);

  hud.setRoom(room.def.name);
  hud.setHearts(game.player.hp, game.player.maxHp);
  bossBarUp = false;
  hud.hideBoss();
  P.clear();
  cam.reset();
  flashFromBlack();
  if (healed) showHeal();
}

const inDungeon = () => game.scene === 'book' && BOOKS[game.bookIndex]?.infinite;

function loadRoom(index, dir) {
  // Leaving room one is what locks the difficulty in for this run.
  if (game.scene === 'book' && game.roomIndex === 0 && index > 0) commitDifficulty();
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

  const healed = healOnArrival(room);

  hud.setRoom(def.name);
  hud.setHearts(game.player.hp, game.player.maxHp);

  bossBarUp = false;
  hud.hideBoss();

  P.clear();
  cam.reset();
  flashFromBlack();
  if (healed) showHeal();
}

/**
 * Mode two of the Digital Claw Cannon: point at empty floor and the hand goes,
 * on a cable, until it hits something and comes back. One at a time, because it
 * is your hand and you only have the one to spare.
 */
function throwClaw() {
  const p = game.player, room = game.room;
  const w = p.weapon;
  if (w.kind !== 'claw' || room.claw || p.throwCool > 0 || p.dead) return false;
  const angle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
  room.claw = new Claw(p.x + Math.cos(angle) * 10, p.y + Math.sin(angle) * 10, angle, w, p);
  p.throwCool = w.throwCooldown ?? 0.4;
  return true;
}

/**
 * The nest in the Heap. Four summons, ten seconds apart — both drawn on the
 * block, so nobody has to count in their head.
 */
function summonFromNest(prop) {
  if (prop.charges <= 0 || prop.cool > 0) { sfx.denied(); return false; }
  prop.charges--;
  prop.cool = 10;
  sfx.uiBig();
  cam.shake(4, 0.3);
  for (const [dx, dy] of [[-26, -18], [26, 18]]) {
    const e = makeEnemy('nullbyte', prop.x + dx, prop.y + dy);
    if (!e) continue;
    // never part of the room definition, so it is never written into the save
    e.defIndex = -1;
    game.room.enemies.push(e);
    P.burst(e.x, e.y, 14, {
      colour: '#5cff7a', speed: 90, life: 0.45, size: 2, drag: 0.9,
      glow: 10, glowColour: 'rgba(38,194,71,ALPHA)',
    });
  }
  return true;
}

/**
 * The difficulty lever, bolted above the first gate of a book you have already
 * finished. Throwing it arms hard mode; walking out of room one is what commits
 * to it, and committing rebuilds the whole book — every enemy you already killed
 * on this visit stands back up, carrying the hard numbers.
 */
function throwLever(prop) {
  if (game.roomIndex !== 0) { sfx.denied(); return false; }
  prop.on = !prop.on;
  prop.throwT = 0;
  game.pendingHard = prop.on;
  sfx.unlock();
  cam.shake(3, 0.2);
  P.burst(prop.x, prop.y, 10, {
    colour: prop.on ? '#ff3355' : '#7d92a6', speed: 70, life: 0.4, size: 2, drag: 0.9,
    glow: 9, glowColour: prop.on ? 'rgba(255,51,85,ALPHA)' : 'rgba(160,180,220,ALPHA)',
  });
  return true;
}

/**
 * Called on the way out of room one. Rebuilding from the definitions with no
 * dead-set is the whole point: a book half-cleared on normal and half on hard
 * would have two different games in it.
 */
function commitDifficulty() {
  if (game.pendingHard === game.hard) return;
  game.hard = game.pendingHard;
  const book = BOOKS[game.bookIndex];
  if (!book?.rooms) return;
  game.rooms = book.rooms.map((def) => {
    const r = new Room(def, new Set());
    r.hard = game.hard;
    return r;
  });
  for (const r of game.rooms) r.applyHard?.();
}

function loadRateOverride() {
  game.rateRoom = true;
  const r = new Room(rates.OVERRIDE_ROOM, new Set());
  game.room = r;
  game.player.x = rates.OVERRIDE_ROOM.spawn.x;
  game.player.y = rates.OVERRIDE_ROOM.spawn.y;
  game.player.hp = game.player.maxHp;
  hud.setRoom('');
  cam.shake(9, 0.9);
  sfx.death();
  for (let i = 0; i < 40; i++) {
    P.spawn({
      x: Math.random() * VW, y: Math.random() * VH,
      vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 90,
      life: 0.9, size: 2, colour: Math.random() > 0.5 ? '#7a1018' : '#a8161f',
      drag: 0.93,
    });
  }
}

/**
 * Put a portal on the floor in front of you and ask where it goes. Only one at
 * a time — a floor covered in doorways is not a tool, it is a mess.
 */
function openPortalHere() {
  const p = game.player, room = game.room;
  if (room.chain) {
    room.chain.update(dt, {
      player: p,
      enemies: room.enemies.filter((e) => !e.dead),
      map: room.map,
      aimX: input.mouse.x, aimY: input.mouse.y,
      // holding is the whole input for this weapon: every stage of it asks
      // whether the button is still down
      held: input.mouse.down && p.weapon.kind === 'chain' && !p.dead,
    });
    if (room.chain.dead) room.chain = null;
  }

  if (room.portal) { room.portal.dead = true; room.portal = null; }
  const a = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
  const px = p.x + Math.cos(a) * 22;
  const py = p.y + Math.sin(a) * 22;
  portalUI.open((dest) => {
    room.portal = new Portal(px, py, dest);
  });
}

/** Walk into one and come out the other side. */
function takePortal(dest) {
  const book = BOOKS[dest.book];
  if (!book?.rooms) return;
  game.room.portal = null;
  enterBook(dest.book);
  if (game.scene !== 'book') return;
  const idx = Math.max(0, Math.min(dest.room, game.rooms.length - 1));
  loadRoom(idx, 'forward');
  const c = tileCentre(dest.tx, dest.ty);
  game.player.x = c.x;
  game.player.y = c.y;
  cam.shake(5, 0.4);
  sfx.uiBig();
  P.burst(c.x, c.y, 22, {
    colour: '#f0a020', speed: 110, life: 0.6, size: 2, drag: 0.9,
    glow: 12, glowColour: 'rgba(240,160,32,ALPHA)',
  });
}

/** Passive regeneration: half a heart, every two seconds. */
const REGEN_EVERY = 2;
const REGEN_AMOUNT = 5;

/**
 * Write the run out. Called every frame — see the note at the call site for why
 * that is affordable — and routed to whichever of the two shapes this book uses.
 */
function autosave() {
  if (game.scene !== 'book') return;
  // The satchel is saved wherever you are standing, including rooms that are
  // not part of any book's table. Skipping the write entirely in one of those
  // meant anything picked up there was gone on the next reload — which is the
  // exact opposite of what saving every frame is for.
  if (game.rateRoom) {
    save.saveSatchel(game.inventory, hotbar.selectedIndex());
    return;
  }
  if (inDungeon()) {
    save.saveDungeon(game.bookIndex, game.milestone, game.inventory,
      hotbar.selectedIndex(), game.smelter);
  } else {
    save.saveBook(game.bookIndex, game.rooms, game.inventory,
      hotbar.selectedIndex(), game.smelter);
  }
}

/** What each book's boss calls in when hard mode pushes it into phase two. */
const ESCORT = ['servant1', 'thrall', 'nullbyte'];

function summonEscort(boss) {
  const kind = ESCORT[game.bookIndex] || 'servant1';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const e = makeEnemy(kind, boss.x + Math.cos(a) * 52, boss.y + Math.sin(a) * 44);
    if (!e) continue;
    e.defIndex = -1;                 // called in, never part of the room's roster
    e.maxHp = Math.round(e.maxHp * 1.25);
    e.hp = e.maxHp;
    if (typeof e.damage === 'number') e.damage = Math.round(e.damage * 1.5);
    e.dmgMul = 1.5;
    game.room.enemies.push(e);
    P.burst(e.x, e.y, 12, {
      colour: '#ff3355', speed: 90, life: 0.45, size: 2, drag: 0.9,
      glow: 10, glowColour: 'rgba(255,51,85,ALPHA)',
    });
  }
  sfx.roar();
  cam.shake(6, 0.5);
}

/** Three hearts, in the HP the hearts are actually made of. */
const ROOM_HEAL = 30;

/**
 * Somewhere you have never been is worth three hearts. Walking back through a
 * door you already came through is not — otherwise the nearest doorway is a
 * free health fountain you can pace in and out of.
 *
 * P.clear() runs right after this in both callers, so the burst is spawned by
 * the caller rather than here.
 */
function healOnArrival(room) {
  if (room.visited) return false;
  room.visited = true;
  const p = game.player;
  if (!p || p.hp >= p.maxHp) return false;
  p.heal(ROOM_HEAL);
  return true;
}

/** The green flourish that says the three hearts happened. */
function showHeal() {
  sfx.heal();
  const p = game.player;
  P.burst(p.x, p.y - 2, 16, {
    colour: '#8ff0b0', speed: 46, life: 0.75, size: 2, grav: -60, drag: 0.93,
    glow: 10, glowColour: 'rgba(120,240,170,ALPHA)',
  });
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
    || shopUI.isOpen() || devUI.isOpen() || puzzleUI.isOpen() || portalUI.isOpen() || voidUI.isOpen()
    || !deathScreen.classList.contains('hidden')
    || !resetScreen.classList.contains('hidden');
}

function closeAllPopups() {
  closeReset();
  devUI.close();
  puzzleUI.close();
  portalUI.close();
  voidUI.close();
  shopUI.close();
  invUI.close();
  craftUI.closeSmelter();
  craftUI.closeAnvil();
  shelfUI.close();
  // whichever chest was open is no longer being looked at
  for (const p of game.room?.props || []) p.opened = false;
}

/**
 * What the cursor is pointing at — and that you could still reach.
 *
 * Right click used to interact with whatever was nearest, wherever you clicked.
 * It has to be aimed now, because right click also throws the claw: pointing at
 * a chest opens it, pointing at bare floor sends your hand.
 */
function propUnderCursor() {
  const room = game.room, p = game.player;
  const mx = input.mouse.x, my = input.mouse.y;
  let best = null, bestD = Infinity;
  for (const q of room.interactives()) {
    // a little slack, because these boxes are small and the cursor is a point
    if (Math.abs(mx - q.x) > q.hw + 6 || Math.abs(my - q.y) > q.hh + 6) continue;
    const dx = Math.max(0, Math.abs(p.x - q.x) - q.hw);
    const dy = Math.max(0, Math.abs(p.y - q.y) - q.hh);
    const d = Math.hypot(dx, dy);
    if (d < q.reach && d < bestD) { best = q; bestD = d; }
  }
  return best;
}

function doInteract(prop) {
  const room = game.room;
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
      if (inDungeon()) rates.noteVendorVisit(game.depth);
      shopUI.open(prop);
      return true;
    case 'gate':
      puzzleUI.open(prop);
      return true;
    case 'lever':
      return throwLever(prop);
    case 'nullbyteNest':
      return summonFromNest(prop);
    case 'void':
      voidUI.open();
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
  // The multiplier lands here rather than on `w`: an unmodded weapon's `w` IS
  // the shared ITEM_DEFS entry, so scaling it in place would make every future
  // iron sword in the save a hundred times stronger.
  const dmg = Math.round((crit ? w.damage * CRIT_MULT : w.damage) * dev.damageMul);
  if (crit && w.damage > 0) {
    cam.shake(5, 0.22);
    freezeFrame(0.07);
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

  // A blow that connected holds the world for a few dozen milliseconds. Weight
  // is almost entirely this and the shake; neither costs a thing.
  if (hitAnything) freezeFrame(0.035);
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
  if (b.needs !== undefined && !game.cleared.has(b.needs)) return true;
  // Book three does not want the story finished. It wants it survived on hard.
  if (b.needsHard !== undefined && !game.hardCleared.has(b.needsHard)) return true;
  return false;
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
  // The Kernel leaves the way it travelled behind.
  if (game.room?.boss?.name === 'The Kernel' && !inDungeon()) {
    game.room.addDrop('portal_gun', game.room.boss.x, game.room.boss.y + 12);
  }
  // The dungeon has no ending, so the bosses it throws at you every fifteen
  // rooms are not one. Marking book four cleared would be a lie the shelf then
  // repeats back at you, and saveBook does not describe a generated book at all.
  if (BOOKS[game.bookIndex]?.infinite) {
    hud.hideBoss();
    sfx.victory();
    return;
  }
  game.bookDefeated = true;
  game.cleared.add(game.bookIndex);
  save.markCleared(game.bookIndex);
  if (game.hard) {
    game.hardCleared.add(game.bookIndex);
    save.markHardCleared(game.bookIndex);
  }
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
    const fresh = new Room(room.def, room.deadFromSave);
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

/**
 * Hit-stop: the world holds still for a few dozen milliseconds on a heavy blow.
 * It is the cheapest weight in games — one subtraction — and it is what makes a
 * hit land rather than merely happen.
 */
let hitStop = 0;
export function freezeFrame(seconds) { hitStop = Math.max(hitStop, seconds); }

function frame(now) {
  const real = Math.min(0.05, (now - last) / 1000);
  last = now;

  let dt = real;
  if (hitStop > 0) {
    hitStop -= real;
    // not a full stop: a crawl reads as weight, a freeze reads as a dropped frame
    dt = real * 0.12;
  }
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
    // Left click uses whichever face of the weapon is live. For everything
    // except the claw that is the only face there is.
    if (input.tookLeftClick() && !p.dead) {
      const angle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
      if (p.weapon.kind === 'claw' && p.clawMode === 2) throwClaw();
      else if (p.weapon.kind === 'portal') openPortalHere();
      else if (p.weapon.kind === 'chain') {
        if (!room.chain) room.chain = new ChainHook(p);
      } else p.startAttack(angle);
    }
    if (p.attacking && !p.swungThisAttack && p.attackT < 0.13) {
      p.swungThisAttack = true;
      resolveSwing();
    }

    // --- interact ---
    // E takes the nearest thing; right click takes the thing you point at, and
    // falls through to the claw when you are pointing at nothing.
    if (input.pressed('KeyE') && !p.dead) doInteract(room.nearestInteractive(p));
    if (input.tookRightClick() && !p.dead) {
      // One rule, every book: point at something you can use and you use it;
      // point at nothing and the claw changes face. A weapon carried out of
      // book three keeps both of its modes wherever it goes.
      const aimed = propUnderCursor();
      if (aimed) doInteract(aimed);
      else if (p.weapon.kind === 'claw') {
        p.clawMode = p.clawMode === 1 ? 2 : 1;
        sfx.uiBig();
        P.burst(p.x, p.y - 4, 8, {
          colour: p.clawMode === 2 ? '#5cff7a' : '#26c247',
          speed: 60, life: 0.3, size: 1, drag: 0.9,
          glow: 8, glowColour: 'rgba(38,194,71,ALPHA)',
        });
      }
    }
  }

  // Autosave, every frame. Measured before committing to it: the whole payload
  // is ~126 bytes and a full write costs 0.01ms, which is a tenth of one percent
  // of a 60fps frame — far below anything that could cost a frame.
  autosave();

  if (room.chain) {
    room.chain.update(dt, {
      player: p,
      enemies: room.enemies.filter((e) => !e.dead),
      map: room.map,
      aimX: input.mouse.x, aimY: input.mouse.y,
      // holding is the whole input for this weapon: every stage of it asks
      // whether the button is still down
      held: input.mouse.down && p.weapon.kind === 'chain' && !p.dead,
    });
    if (room.chain.dead) room.chain = null;
  }

  if (room.portal) {
    if (room.portal.update(dt, p)) { takePortal(room.portal.dest); return; }
    if (room.portal.dead) room.portal = null;
  }

  // Half a heart every two seconds, always, everywhere.
  p.regenT = (p.regenT || 0) + dt;
  if (p.regenT >= REGEN_EVERY) {
    p.regenT -= REGEN_EVERY;
    if (!p.dead && p.hp > 0 && p.hp < p.maxHp) {
      p.heal(REGEN_AMOUNT);
      P.burst(p.x, p.y + 2, 4, {
        colour: '#7ee08a', speed: 26, life: 0.5, size: 1, drag: 0.92,
        glow: 6, glowColour: 'rgba(126,224,138,ALPHA)',
      });
    }
  }

  p.throwCool = Math.max(0, (p.throwCool || 0) - dt);
  p.update(dt, room.map, room.solids());

  // The Kernel eats its own arena when it is left alive too long. It picks the
  // squares itself (flood-filling so it can never wall you into a pocket) and
  // hands them over here, because props belong to the room.
  if (inDungeon() && !game.rateRoom && rates.applyRates(room, game.depth, p)) {
    loadRateOverride();
    return;
  }

  const bossNow = room.boss;
  if (game.hard && bossNow && !bossNow.dead) {
    if (bossNow.phase === 2 && !bossNow.__calledFor) {
      bossNow.__calledFor = true;
      summonEscort(bossNow);
    }
  }

  const kb = room.boss;
  if (kb?.pendingVoids?.length) {
    for (const v of kb.pendingVoids) {
      room.props.push(new Prop('void', v.x, v.y, {}));
      P.burst(v.x, v.y, 18, {
        colour: '#000', speed: 70, life: 0.5, size: 3, drag: 0.9,
      });
      P.burst(v.x, v.y, 12, {
        colour: '#5cff7a', speed: 90, life: 0.4, size: 2, drag: 0.9,
        glow: 10, glowColour: 'rgba(38,194,71,ALPHA)',
      });
    }
    kb.pendingVoids.length = 0;
  }

  // Voids corrupt anything standing in the 3x3 of tiles around them. Done here
  // rather than in the prop because props are never handed the player.
  for (const v of room.props) {
    if (v.type !== 'void' || p.dead) continue;
    const near = Math.abs(p.x - v.x) <= TILE * 1.5 && Math.abs(p.y - v.y) <= TILE * 1.5;
    if (!near) continue;
    if (v.bite > 0) continue;
    v.bite = VOID_BITE_EVERY;
    if (p.corrupt(CORRUPT_BITE, CORRUPT_FLOOR)) {
      sfx.hurt();
      cam.shake(4, 0.3);
      P.burst(p.x, p.y, 14, {
        colour: '#ff3355', speed: 90, life: 0.5, size: 2, drag: 0.9,
        glow: 10, glowColour: 'rgba(255,51,85,ALPHA)',
      });
    }
  }
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
  // Read before the popup guard below, or the menu opens and never closes.
  // Outside developer mode a bare M does nothing at all — no menu, no message,
  // nothing that hints the menu is there.
  if (input.pressed('Ctrl+KeyM')) { devUI.openSwitch(); return; }
  if (input.pressed('KeyM')) {
    if (dev.on) devUI.openTools();
    return;
  }

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
