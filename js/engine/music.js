// Background music.
//
// These are ~15 minute, 7MB files. They are streamed through <audio> and never
// touched by WebAudio: decodeAudioData would have to hold the whole thing as
// raw PCM, and 15 minutes of 48kHz stereo is about 170MB of memory per track.
// `preload="none"` also means nothing is fetched until a track is actually
// asked for, so the first load of the page is unaffected.

const TRACKS = {
  oakvale: { title: 'Lanterns of Oakvale', src: 'assets/music/lanterns-of-oakvale.mp3' },
  rush:    { title: 'Library Rush',        src: 'assets/music/library-rush.mp3' },
};

const VOLUME = 0.42;
const FADE = 0.8;          // seconds to cross between two tracks
const START_DELAY = 1;     // the toast appears first, the music follows it

const toastEl = document.getElementById('music-toast');
const toastName = toastEl?.querySelector('.mt-name');

const players = {};
let current = null;        // id of the track that should be audible
let pending = null;        // { id, t } counting down to START_DELAY
let enabled = true;

function player(id) {
  if (players[id]) return players[id];
  const a = new Audio();
  a.src = TRACKS[id].src;
  a.loop = true;
  a.preload = 'none';
  a.volume = 0;
  // Attached to the document rather than left floating: a media element in the
  // page is visible to devtools and to the browser's media session, which is
  // also what makes it observable from a test.
  a.hidden = true;
  a.setAttribute('data-track', id);
  document.body.appendChild(a);
  players[id] = a;
  return a;
}

/**
 * The now-playing card: slides in from the right, holds, then keeps sliding
 * left as it fades. Two seconds total, and the music starts one second in.
 */
function showToast(id) {
  if (!toastEl) return;
  toastName.textContent = TRACKS[id].title;
  toastEl.classList.remove('hidden', 'run');
  void toastEl.offsetWidth;          // restart the animation
  toastEl.classList.add('run');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toastEl.classList.add('hidden');
    toastEl.classList.remove('run');
  }, 2000);
}

/**
 * Ask for a track. Repeating the request for whatever is already playing does
 * nothing — walking library -> book -> library must not restart the music or
 * re-announce it.
 */
export function play(id) {
  if (!TRACKS[id]) return;
  if (current === id || pending?.id === id) return;
  pending = { id, t: 0 };
  showToast(id);

  // Start fetching now, while the card is on screen. The one second before the
  // music comes in is not dead time — it is exactly the window the stream needs
  // to buffer, so the track starts when it is announced instead of a beat late.
  const a = player(id);
  if (a.preload !== 'auto') { a.preload = 'auto'; a.load(); }
}

export function stop() {
  pending = null;
  current = null;
}

export function setEnabled(v) {
  enabled = v;
  if (!v) for (const id in players) players[id].pause();
}

export function nowPlaying() { return current; }

/** Called once per frame from the game loop. */
export function update(dt) {
  if (pending) {
    pending.t += dt;
    if (pending.t >= START_DELAY) {
      current = pending.id;
      pending = null;
      if (enabled) {
        const a = player(current);
        // A track that was faded out is still where we left it; restarting
        // from zero on every visit makes the library feel like a menu.
        a.play().catch(() => { /* blocked until the player interacts */ });
      }
    }
  }

  const step = dt / FADE;
  for (const id in players) {
    const a = players[id];
    const want = enabled && id === current ? VOLUME : 0;
    if (a.volume < want) a.volume = Math.min(want, a.volume + step * VOLUME);
    else if (a.volume > want) a.volume = Math.max(want, a.volume - step * VOLUME);
    if (a.volume === 0 && !a.paused) a.pause();
  }
}
