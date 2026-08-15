// Developer mode.
//
// Two things live here. The first is a flag in its own localStorage key, kept
// deliberately outside the save blob: it decides *which* blob the save system
// reads, so storing it inside one would be circular — you would have to load a
// save to find out which save to load.
//
// The second is the set of cheats the debug menu drives. They sit in a module
// rather than on the player because the player object is rebuilt every time you
// change rooms, and a godmode that switches itself off at every doorway is worse
// than no godmode at all.

const FLAG = 'itb.devmode';

/** The save file developer mode plays on, kept well away from the real one. */
export const DEV_SAVE_KEY = 'testdeveloperidkdktestperioddpr';

export function devMode() {
  try { return localStorage.getItem(FLAG) === '1'; }
  catch { return false; }
}

/**
 * Live cheat state. Not persisted: every one of these is something you turn on
 * to look at a specific thing, and having it survive a reload means eventually
 * wondering for ten minutes why nothing can hurt you.
 */
export const dev = {
  on: devMode(),
  god: false,
  damageMul: 1,
  speedMul: 1,
};

/** How much stronger ×100 damage actually is. */
export const DEV_DAMAGE = 100;

export const SPEEDS = [1, 1.5, 2, 2.5, 3, 5, 10];

/**
 * Switching modes reloads the page. Nothing in memory is written for the mode
 * you are leaving and nothing is carried into the one you are entering — the
 * same reason the reset button reloads rather than tidying up by hand.
 */
export function setMode(on) {
  try {
    if (on) localStorage.setItem(FLAG, '1');
    else localStorage.removeItem(FLAG);
  } catch { /* private mode — nothing we can do, and nothing worth breaking for */ }
  location.reload();
}
