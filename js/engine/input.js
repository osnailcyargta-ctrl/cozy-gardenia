// Keyboard + mouse. Exposes both "is held" and "was pressed this frame" so game
// logic can distinguish holding W from tapping E.

import { toBuffer } from './canvas.js';

const held = new Set();
const pressedThisFrame = new Set();

export const mouse = { x: 0, y: 0, down: false, rightDown: false };

/**
 * Modifier keys, tracked separately because the pressed-set stores `e.code` and
 * a code alone cannot tell Ctrl+M from M. The debug menu needs to: one of those
 * two switches save files.
 *
 * This is live state, so it is only good for "is Ctrl down right now". For an
 * edge-triggered chord, read `pressed('Ctrl+KeyM')` instead — the combination is
 * stamped into the pressed-set at keydown, which means letting go of Ctrl a
 * millisecond before the frame runs cannot turn the chord back into a bare key.
 */
export const mods = { ctrl: false, shift: false, alt: false };
let leftClicked = false;
let rightClicked = false;

const CODE_ALIAS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

/** True while the UI owns input; the world stops reading movement keys. */
export let uiCapture = false;
export function setUICapture(v) { uiCapture = v; }

function readMods(e) {
  mods.ctrl = e.ctrlKey || e.metaKey;
  mods.shift = e.shiftKey;
  mods.alt = e.altKey;
}

window.addEventListener('keydown', (e) => {
  readMods(e);
  if (e.repeat) return;
  const k = CODE_ALIAS[e.code] || e.code;
  held.add(k);
  pressedThisFrame.add(k);
  if (e.ctrlKey || e.metaKey) pressedThisFrame.add('Ctrl+' + e.code);
  // stop the page scrolling / quick-find under the game
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash'].includes(e.code)) {
    e.preventDefault();
  }
  // Firefox mutes the tab on Ctrl+M, which would silence the soundtrack every
  // time you switched into developer mode.
  if (e.code === 'KeyM' && (e.ctrlKey || e.metaKey)) e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  readMods(e);
  held.delete(CODE_ALIAS[e.code] || e.code);
});

window.addEventListener('blur', () => { held.clear(); mouse.down = false; mouse.rightDown = false; });

const screenEl = document.getElementById('screen');

window.addEventListener('mousemove', (e) => {
  const p = toBuffer(e);
  mouse.x = p.x;
  mouse.y = p.y;
});

screenEl.addEventListener('mousedown', (e) => {
  if (e.button === 0) { mouse.down = true; leftClicked = true; }
  if (e.button === 2) { mouse.rightDown = true; rightClicked = true; }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.down = false;
  if (e.button === 2) mouse.rightDown = false;
});

// Right-click is a game verb here, so the browser menu has to go.
window.addEventListener('contextmenu', (e) => e.preventDefault());

export function isDown(k) { return !uiCapture && held.has(k); }
export function isDownRaw(k) { return held.has(k); }
export function pressed(k) { return pressedThisFrame.has(k); }

export function tookLeftClick() { const v = leftClicked; leftClicked = false; return v; }
export function tookRightClick() { const v = rightClicked; rightClicked = false; return v; }

/** Called at the end of every frame. */
export function endFrame() {
  pressedThisFrame.clear();
  leftClicked = false;
  rightClicked = false;
}

/** Movement axis, normalised so diagonals aren't faster. */
export function axis() {
  let x = 0, y = 0;
  if (isDown('left')) x -= 1;
  if (isDown('right')) x += 1;
  if (isDown('up')) y -= 1;
  if (isDown('down')) y += 1;
  if (x && y) { const inv = Math.SQRT1_2; x *= inv; y *= inv; }
  return { x, y };
}
