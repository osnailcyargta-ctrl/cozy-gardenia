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
/** Plain English for whatever this book is still waiting on. */
function unlockHint(b) {
  const needs = [];
  if (b.needs !== undefined && !game?.cleared?.has(b.needs)) {
    needs.push(`Finish ${BOOKS[b.needs]?.title || `book ${b.needs + 1}`}`);
  }
  if (b.needsHard !== undefined && !game?.hardCleared?.has(b.needsHard)) {
    needs.push(`Finish ${BOOKS[b.needsHard]?.title || `book ${b.needsHard + 1}`} on hard`);
  }
  return needs.length ? needs.join(' · ') : 'Not written yet';
}

export function refresh() {
  popup.querySelectorAll('.book').forEach((el) => {
    const b = BOOKS[Number(el.dataset.book)];
    // An endless book has no rooms table but is very much written.
    const written = !!(b?.rooms || b?.infinite);
    // Two different locks. `needs` asks whether you read a book; `needsHard`
    // asks whether you survived it on hard, which is what book three wants.
    const sealed = !written
      || (b.needs !== undefined && !game?.cleared?.has(b.needs))
      || (b.needsHard !== undefined && !game?.hardCleared?.has(b.needsHard));

    el.classList.toggle('locked', sealed);

    // A chained book says what would unchain it. Without this the shelf just
    // refuses and you are left guessing which of several conditions you missed.
    let why = el.querySelector('.book-why');
    if (sealed && written) {
      if (!why) {
        why = document.createElement('div');
        why.className = 'book-why';
        el.appendChild(why);
      }
      why.textContent = unlockHint(b);
    } else if (why) {
      why.remove();
    }
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
