// The bookshelf picker. Book one opens with a cover-swing and a page sweep;
// the sealed pair only rattle their chains.

import { sfx } from '../engine/audio.js';

const popup = document.getElementById('shelf-popup');
const transition = document.getElementById('book-transition');
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
  el.classList.add('opening');

  setTimeout(() => {
    transition.classList.remove('hidden');
    const flip = transition.querySelector('.page-flip');
    flip.style.animation = 'none';
    void flip.offsetWidth;
    flip.style.animation = '';

    // swap the world at the midpoint of the page sweep, while the screen is covered
    setTimeout(() => game.enterBook(idx), 480);
    setTimeout(() => {
      transition.classList.add('hidden');
      close();
      el.classList.remove('opening');
      busy = false;
    }, 1060);
  }, 620);
}

export function open() {
  popup.classList.remove('hidden');
  sfx.uiBig();
}

export function close() { popup.classList.add('hidden'); }
export function isOpen() { return !popup.classList.contains('hidden'); }
export function isBusy() { return busy; }
