// Keyboard + mouse. Exposes both "is held" and "was pressed this frame" so game
// logic can distinguish holding W from tapping E.

import { toBuffer } from './canvas.js';

const held = new Set();
const pressedThisFrame = new Set();

export const mouse = { x: 0, y: 0, down: false, rightDown: false };
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

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = CODE_ALIAS[e.code] || e.code;
  held.add(k);
  pressedThisFrame.add(k);
  // stop the page scrolling / quick-find under the game
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash'].includes(e.code)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
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
