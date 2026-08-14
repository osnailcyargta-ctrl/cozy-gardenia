// The bookshelf picker. Sealed books rattle their chains; an open one just
// takes you in.

import { sfx } from '../engine/audio.js';
import { BOOKS } from '../data/rooms.js';

const popup = document.getElementById('shelf-popup');
let game = null;
let busy = false;

export function init(g) {
  game = g;
  popup.querySelectorAll('.book').forEach((el) => {
    el.addEventListener('click', () => onPick(el));
    el.addEventListener('mouseenter', () => {
      if (!busy) sfx.ui();
    });
  });
  refresh();
}

/**
 * Paint the shelf from BOOKS. A book that exists always shows its real title
 * even while chained — knowing what is behind the lock is the point of a
 * locked book. A book with no rooms behind it stays anonymous.
 */
export function refresh() {
  popup.querySelectorAll('.book').forEach((el) => {
    const b = BOOKS[Number(el.dataset.book)];
    // An endless book has no rooms table but is very much written.
    const written = !!(b?.rooms || b?.infinite);
    const sealed = !written || (b.needs !== undefined && !game?.cleared?.has(b.needs));

    el.classList.toggle('locked', sealed);
    el.querySelector('.book-title').textContent = written ? b.title : '???';
    el.querySelector('.book-label').textContent = sealed ? 'Sealed' : b.title;

    let chain = el.querySelector('.chain');
    if (sealed && !chain) {
      chain = document.createElement('div');
      chain.className = 'chain';
      chain.innerHTML = '<div class="lock"></div>';
      el.appendChild(chain);
    } else if (!sealed && chain) {
      chain.remove();
    }
  });
}

function onPick(el) {
  if (busy) return;
  const idx = Number(el.dataset.book);

  if (el.classList.contains('locked')) {
    sfx.denied();
    // re-trigger the rattle even if the pointer never left
    el.classList.remove('locked-shake');
    void el.offsetWidth;
    el.classList.add('locked-shake');
    return;
  }

  busy = true;
  sfx.bookOpen();
  // No page sweep, no cover swing: a short fade and you are in.
  setTimeout(() => { game.enterBook(idx); close(); busy = false; }, 180);
}

export function open() {
  refresh();
  popup.classList.remove('hidden');
  sfx.uiBig();
}

export function close() { popup.classList.add('hidden'); }
export function isOpen() { return !popup.classList.contains('hidden'); }
export function isBusy() { return busy; }
