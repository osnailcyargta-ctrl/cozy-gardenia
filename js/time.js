/**
 * Clock + tick loop.
 *
 * All game time flows through now(), so tests (and the console) can fast-forward
 * by setting a clock offset instead of waiting out real grow timers.
 */

let offsetMs = 0;

export function now() {
  return Date.now() + offsetMs;
}

/** Fast-forward the game clock. Used by the verification harness. */
export function advanceClock(ms) {
  offsetMs += ms;
  return offsetMs;
}

export function getClockOffset() {
  return offsetMs;
}

const listeners = new Set();
let rafId = null;
let lastLogicTick = 0;

/** Subscribe to the ~4Hz logic tick. Returns an unsubscribe function. */
export function onTick(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const LOGIC_INTERVAL_MS = 250;

function frame() {
  const t = now();
  if (t - lastLogicTick >= LOGIC_INTERVAL_MS) {
    lastLogicTick = t;
    for (const fn of listeners) {
      try {
        fn(t);
      } catch (err) {
        console.error('[gardenia] tick listener failed', err);
      }
    }
  }
  rafId = requestAnimationFrame(frame);
}

export function startLoop() {
  if (rafId !== null) return;
  lastLogicTick = 0;
  rafId = requestAnimationFrame(frame);
}

export function stopLoop() {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
}

/** "1m 05s" / "42s" — used by the merchant countdown and grow timers. */
export function formatDuration(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins > 0) return `${mins}m ${String(secs).padStart(2, '0')}s`;
  return `${secs}s`;
}
