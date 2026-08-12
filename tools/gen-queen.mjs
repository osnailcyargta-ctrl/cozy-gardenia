// Builds the Drowned Queen out of shape primitives with a top-lit shader, then
// prints the rows as JS source. Same method used for the Dragon King: a 48x40
// figure is far too large to type row by row without it turning to mush.

const W = 48, H = 40;

const RAMP = {
  gown:  ['L', 'M', 'N', 'O', 'P', 'Q'],
  flesh: ['M', 'N', 'O', 'P', 'Q', 'R'],
  coral: ['S', 'T', 'U', 'V', 'W'],
  kelp:  ['X', 'X', 'Y', 'Y', 'Z'],
  foam:  ['M', 'N', 'O', 'P', 'Q', 'R'],
  bone:  ['J', 'J', 'I', 'I', 'R'],
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function shade(ramp, t) {
  const r = RAMP[ramp];
  return r[clamp(Math.round(t * (r.length - 1)), 0, r.length - 1)];
}

const grid = () => Array.from({ length: H }, () => new Array(W).fill('.'));

function put(g, x, y, ch) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  g[y][x] = ch;
}

function ellipse(g, cx, cy, rx, ry, ramp, o = {}) {
  for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
    for (let x = Math.ceil(cx - rx); x <= Math.floor(cx + rx); x++) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const t = clamp((o.base ?? 0.58) - ny * (o.lit ?? 0.48) + nx * (o.side ?? 0.14), 0, 1);
      put(g, x, y, shade(ramp, t));
    }
  }
}

/** A vertical band whose centre and half-width both sweep from top to bottom. */
function taper(g, cx0, y0, hw0, cx1, y1, hw1, ramp, o = {}) {
  for (let y = Math.round(y0); y <= Math.round(y1); y++) {
    const k = (y - y0) / ((y1 - y0) || 1);
    const cx = cx0 + (cx1 - cx0) * k;
    const hw = hw0 + (hw1 - hw0) * k;
    for (let x = Math.ceil(cx - hw); x <= Math.floor(cx + hw); x++) {
      const nx = (x - cx) / (hw || 1);
      const t = clamp((o.base ?? 0.66) - Math.abs(nx) * (o.round ?? 0.5)
        + nx * (o.side ?? 0.18) - k * (o.fade ?? 0.18), 0, 1);
      put(g, x, y, shade(ramp, t));
    }
  }
}

/** Filled triangle — crown spikes, fins, the veil's points. */
function tri(g, ax, ay, bx, by, cx, cy, ramp, o = {}) {
  const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
  const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
  const area = (x1, y1, x2, y2, x3, y3) => (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
  const s = Math.sign(area(ax, ay, bx, by, cx, cy)) || 1;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      if (Math.sign(area(ax, ay, bx, by, px, py)) * s < 0) continue;
      if (Math.sign(area(bx, by, cx, cy, px, py)) * s < 0) continue;
      if (Math.sign(area(cx, cy, ax, ay, px, py)) * s < 0) continue;
      const k = clamp((y - minY) / ((maxY - minY) || 1), 0, 1);
      put(g, x, y, shade(ramp, clamp((o.base ?? 0.8) - k * (o.fade ?? 0.5), 0, 1)));
    }
  }
}

/** A wavering strand — kelp hair, gown ribbons, the tendrils in the water. */
function strand(g, x, y, len, dx, dy, wob, phase, ramp, o = {}) {
  let px = x, py = y;
  for (let i = 0; i < len; i++) {
    const k = i / len;
    px += dx + Math.sin(i * 0.45 + phase) * wob;
    py += dy;
    const t = clamp((o.base ?? 0.7) - k * (o.fade ?? 0.45), 0, 1);
    put(g, px, py, shade(ramp, t));
    if (o.thick && i % 2 === 0) put(g, px + (o.thickSide ?? 1), py, shade(ramp, clamp(t - 0.3, 0, 1)));
  }
}

/** 1px dark rim around everything drawn so far — keeps her readable in fog. */
function rim(g, ch = 'K') {
  const snap = g.map((r) => r.slice());
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (snap[y][x] !== '.') continue;
      let touch = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (snap[ny][nx] !== '.' && snap[ny][nx] !== ch) { touch = true; break; }
      }
      if (touch) g[y][x] = ch;
    }
  }
}

/* ============================================================
   The figure — frontal and upright: a crowned woman from the waist
   up, dissolving into a standing column of water below it.

   Frontal rather than side-on because everything that makes her read
   as a *queen* is symmetrical — the crown, the shoulders, the stare.
   In profile the same shapes just stack into a lump.
   ============================================================ */

const CX = 24;

function build({ sway = 0, arms = 'rest', broken = false, glow = false } = {}) {
  const g = grid();
  const s = sway;
  const eye = glow ? 'C' : 'R';

  // ---- the drowned gown: a column of water, widest where it meets the floor ----
  taper(g, CX, 25, 8, CX + s * 0.8, 39, 19, 'gown', { fade: 0.3, side: 0.1, round: 0.62 });

  // vertical folds, so the column has structure instead of being a wash
  for (const [fx, spread] of [[-11, 0.7], [-5, 0.35], [3, 0.4], [10, 0.65]]) {
    for (let y = 27; y < 40; y++) {
      const k = (y - 27) / 12;
      put(g, CX + fx * (0.45 + k) + Math.sin(y * 0.5 + s) * 1.2, y, k > 0.55 ? 'L' : 'M');
    }
  }

  // foam catching along the leading edge of the tide
  for (let i = 0; i < 9; i++) {
    strand(g, 8 + i * 4, 31 + ((i * 3) % 5), 4 + (i % 3) * 2, 0.35, 0.85, 0.6, i * 1.1 + s,
      'foam', { base: 0.75, fade: 0.55 });
  }

  // ---- torso ----
  taper(g, CX, 20, 6, CX, 28, 8.5, 'gown', { fade: 0.05, base: 0.82, round: 0.62 });
  ellipse(g, CX, 21, 9, 3.5, 'gown', { base: 0.86, lit: 0.42 });   // shoulders

  // ---- kelp hair, falling either side of the face and down past the shoulders ----
  const strands = broken ? 5 : 8;
  for (let i = 0; i < strands; i++) {
    const side = i % 2 ? 1 : -1;
    const n = (i / 2) | 0;
    strand(g, CX + side * (5 + n * 1.7), 9 + n, 15 + n * 3, side * 0.34, 1,
      0.45, i * 1.4 + s * 0.8, 'kelp', { base: 0.9, fade: 0.55 });
  }

  // ---- arms, drawn over the hair so the limbs stay part of the silhouette ----
  const armEdge = [];
  const arm = (x0, y0, w0, x1, y1, w1, base) => {
    taper(g, x0, y0, w0, x1, y1, w1, 'flesh', { base, fade: 0.16, round: 0.45 });
    armEdge.push([x0, y0, x1, y1]);
  };

  if (arms === 'raised') {
    arm(CX - 11, 20, 2.2, CX - 17, 6, 1.6, 0.92);
    arm(CX + 11, 20, 2.2, CX + 17, 6, 1.6, 0.86);
    ellipse(g, CX - 18, 4, 4, 4, 'foam', { base: 1, lit: 0.25 });
    ellipse(g, CX + 18, 4, 4, 4, 'foam', { base: 1, lit: 0.25 });
  } else if (arms === 'reach') {
    // both hands thrown forward — the undertow that drags you in
    arm(CX - 11, 20, 2.2, CX - 6, 31, 1.8, 0.92);
    arm(CX + 11, 20, 2.2, CX + 6, 31, 1.8, 0.86);
    ellipse(g, CX - 6, 32, 3, 3, 'foam', { base: 1, lit: 0.25 });
    ellipse(g, CX + 6, 32, 3, 3, 'foam', { base: 1, lit: 0.25 });
  } else {
    arm(CX - 11, 20, 2.4, CX - 16, 31, 1.7, 0.9);
    arm(CX + 11, 20, 2.4, CX + 16, 31, 1.7, 0.84);
  }

  // Dark seam down the inside of each arm. Without it the arm and the gown are
  // neighbouring shades of the same blue and the silhouette loses both.
  for (const [x0, y0, x1, y1] of armEdge) {
    const side = Math.sign(x0 - CX);
    for (let y = Math.round(Math.min(y0, y1)); y <= Math.round(Math.max(y0, y1)); y++) {
      const k = (y - y0) / ((y1 - y0) || 1);
      if (k < 0 || k > 1) continue;
      const x = x0 + (x1 - x0) * k - side * 2.6;
      if (g[Math.round(y)]?.[Math.round(x)] !== '.') put(g, x, y, 'K');
    }
  }

  // a pair of coral shards standing off each shoulder
  for (const dx of [-11, -7.5, 7.5, 11]) {
    tri(g, CX + dx - 1.4, 21, CX + dx + 1.4, 21, CX + dx * 1.3, 21 - (Math.abs(dx) > 9 ? 5 : 8),
      'coral', { base: 0.8, fade: 0.45 });
  }

  // ---- neck + head ----
  taper(g, CX, 16, 2.4, CX, 20, 3, 'flesh', { base: 0.5, fade: 0, round: 0.5 });
  ellipse(g, CX, 11, 5, 6, 'flesh', { lit: 0.44, side: 0.1 });

  // Face. Sockets first as holes, then the drowned light burning inside them —
  // a bright pixel in a small dark pit is what makes a face read at this size.
  // Wider sockets just turn into two black bars.
  for (const ex of [CX - 3, CX + 2]) {
    put(g, ex, 10, 'K'); put(g, ex + 1, 10, 'K');
    put(g, ex, 11, 'K'); put(g, ex + 1, 11, 'K');
    put(g, ex + (ex < CX ? 1 : 0), 10, eye);
  }
  // mouth, open on a scream that never surfaces
  put(g, CX - 1, 14, 'K'); put(g, CX, 14, 'K');
  put(g, CX - 1, 15, 'L'); put(g, CX, 15, 'K');

  // ---- coral crown ----
  const bandY = 5;
  const spikes = [4, 7, 10, 13, 10, 7, 4];
  for (let i = 0; i < spikes.length; i++) {
    const cx = CX + (i - 3) * 3.1;
    const h = spikes[i] * (broken && i > 3 ? 0.3 : 1);
    tri(g, cx - 1.7, bandY, cx + 1.7, bandY, cx + (i - 3) * 0.45, bandY - h, 'coral',
      { base: 0.95, fade: 0.5 });
  }
  taper(g, CX, bandY - 1, 9.5, CX, bandY + 1, 9, 'coral', { base: 0.66, round: 0.3, fade: 0 });
  put(g, CX, bandY, 'R'); put(g, CX - 1, bandY, 'W'); put(g, CX + 1, bandY, 'W');

  rim(g);

  // Phase 2: the tide has her. Arcane light bleeds up through the water — done
  // after the rim pass so the glow sits inside the silhouette, not on its edge.
  if (broken) {
    // Light follows the folds rather than scattering: a seam that traces the
    // shape reads as something breaking out of her, confetti reads as noise.
    for (const fx of [-11, -5, 3, 10]) {
      for (let y = 27; y < 40; y++) {
        const k = (y - 27) / 12;
        const x = Math.round(CX + fx * (0.45 + k) + Math.sin(y * 0.5 + s) * 1.2);
        if (g[y]?.[x] && g[y][x] !== '.' && g[y][x] !== 'K') g[y][x] = k > 0.6 ? 'A' : 'B';
      }
    }
    for (let y = 22; y < 30; y++) {
      const x = CX + Math.round(Math.sin(y * 0.7) * 1.5);
      if (g[y]?.[x] && g[y][x] !== '.' && g[y][x] !== 'K') g[y][x] = y % 3 ? 'B' : 'C';
    }
  }
  return g;
}

/* ---------- output ---------- */

const ANSI = {
  '.': null, K: '#04141d', L: '#082733', M: '#0e3d4f', N: '#15586d', O: '#1f7d91',
  P: '#38aab6', Q: '#70dad4', R: '#c4f6ef', S: '#3d1430', T: '#7a1f45', U: '#b83a5a',
  V: '#e8688a', W: '#ffb3c4', X: '#12261c', Y: '#2c5638', Z: '#5c8f5a',
  A: '#6b32a0', B: '#a866e0', C: '#ddb4ff', I: '#d8cba8', J: '#6b5f4a',
};

function preview(g) {
  return g.map((row) => row.map((c) => {
    const hex = ANSI[c];
    if (!hex) return '\x1b[0m··';
    const r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `\x1b[48;2;${r};${gg};${b}m  `;
  }).join('') + '\x1b[0m').join('\n');
}

function js(g, indent = '      ') {
  return g.map((r) => `${indent}'${r.join('')}',`).join('\n');
}

const frames = {
  idleA:  build({ sway: 0, arms: 'rest' }),
  idleB:  build({ sway: 1, arms: 'rest' }),
  cast:   build({ sway: 0, arms: 'raised' }),
  pull:   build({ sway: 0, arms: 'reach' }),
  brokenA: build({ sway: 0, arms: 'rest', broken: true, glow: true }),
  brokenB: build({ sway: 1.5, arms: 'raised', broken: true, glow: true }),
};

const which = process.argv[2];
if (which === 'js') {
  for (const k in frames) console.log(`// ${k}\n[\n${js(frames[k])}\n],`);
} else {
  for (const k of (which ? [which] : Object.keys(frames))) {
    console.log(`\n=== ${k} ===`);
    console.log(preview(frames[k]));
  }
}
