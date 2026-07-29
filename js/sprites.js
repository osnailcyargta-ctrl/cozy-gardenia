/**
 * Vector art, generated as SVG markup strings.
 *
 * Built in JS rather than shipped as a static <symbol> sheet because every
 * plant recolours the same shapes from its own palette — gradient stops inside
 * a <use> reference can't be re-themed per instance, but a generated gradient
 * can. Vector at every stage keeps the art crisp at any DPI.
 */

const NS = 'http://www.w3.org/2000/svg';

/** Gradient ids must be unique per rendered instance or defs collide. */
let uid = 0;
function nextId() {
  uid += 1;
  return `g${uid}`;
}

/* --------------------------------------------------------------- the pot -- */

function potMarkup(id) {
  return `
    <defs>
      <linearGradient id="${id}-clay" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#E09A70"/>
        <stop offset="45%" stop-color="#C97B54"/>
        <stop offset="100%" stop-color="#9A5537"/>
      </linearGradient>
      <linearGradient id="${id}-rim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#EDAA80"/>
        <stop offset="100%" stop-color="#B96C48"/>
      </linearGradient>
      <radialGradient id="${id}-soil" cx="0.5" cy="0.35" r="0.75">
        <stop offset="0%" stop-color="#6B4A34"/>
        <stop offset="100%" stop-color="#3E2A1D"/>
      </radialGradient>
    </defs>

    <ellipse class="pot-shadow" cx="70" cy="133" rx="46" ry="8"/>

    <path class="pot-body" d="M30 100 H110 L101 129 Q100 134 95 134 H45 Q40 134 39 129 Z"
          fill="url(#${id}-clay)"/>
    <path d="M39 103 L46 130 Q47 132 44 132 L43 132 L36 103 Z" fill="#FFFFFF" opacity="0.16"/>
    <rect x="23" y="82" width="94" height="19" rx="7" fill="url(#${id}-rim)"/>
    <rect x="23" y="82" width="94" height="6" rx="3" fill="#FFFFFF" opacity="0.2"/>

    <ellipse cx="70" cy="88" rx="40" ry="8" fill="url(#${id}-soil)"/>
    <ellipse cx="70" cy="87" rx="40" ry="7.5" fill="#000" opacity="0.18"/>
  `;
}

/* ------------------------------------------------------------ the plants -- */

function leaf(x, y, flip, palette, scale = 1) {
  const dir = flip ? -1 : 1;
  return `<path d="M0 0 C ${14 * dir} -4, ${22 * dir} -12, ${20 * dir} -22
                     C ${10 * dir} -20, ${2 * dir} -10, 0 0 Z"
                fill="${palette.leaf}"
                transform="translate(${x} ${y}) scale(${scale})"/>`;
}

function stem(fromY, toY, palette, width = 4) {
  return `<path d="M70 ${fromY} Q ${70 + 3} ${(fromY + toY) / 2}, 70 ${toY}"
                stroke="${palette.leaf}" stroke-width="${width}" stroke-linecap="round" fill="none"/>`;
}

function flowerHead(cx, cy, palette, radius, petals = 6) {
  let out = '';
  for (let i = 0; i < petals; i += 1) {
    const angle = (360 / petals) * i;
    out += `<ellipse cx="${cx}" cy="${cy - radius * 0.62}" rx="${radius * 0.42}" ry="${radius * 0.66}"
                     fill="${palette.bloom}" stroke="${palette.bloomDeep}" stroke-width="1"
                     transform="rotate(${angle} ${cx} ${cy})"/>`;
  }
  out += `<circle cx="${cx}" cy="${cy}" r="${radius * 0.34}" fill="${palette.bloomDeep}"/>`;
  out += `<circle cx="${cx - radius * 0.1}" cy="${cy - radius * 0.1}" r="${radius * 0.14}"
                  fill="#FFFFFF" opacity="0.45"/>`;
  return out;
}

function plantMarkup(stageId, palette) {
  switch (stageId) {
    case 'seed':
      return `
        <g class="plant-art plant-seed">
          <ellipse cx="70" cy="86" rx="9" ry="4" fill="#5A3E2B"/>
          <ellipse cx="70" cy="84" rx="5" ry="3.4" fill="#C9A87C"/>
          <ellipse cx="68.5" cy="83" rx="1.8" ry="1.2" fill="#F0DCBC"/>
        </g>`;

    case 'sprout':
      return `
        <g class="plant-art plant-sprout">
          ${stem(88, 66, palette, 3.5)}
          ${leaf(70, 74, false, palette, 0.62)}
          ${leaf(70, 78, true, palette, 0.55)}
        </g>`;

    case 'bud':
      return `
        <g class="plant-art plant-bud">
          ${stem(88, 50, palette, 4)}
          ${leaf(70, 76, false, palette, 0.85)}
          ${leaf(70, 66, true, palette, 0.75)}
          <ellipse cx="70" cy="46" rx="8" ry="12" fill="${palette.bloomDeep}"/>
          <ellipse cx="70" cy="44" rx="5" ry="9" fill="${palette.bloom}" opacity="0.75"/>
          <path d="M62 48 Q70 40 78 48 Q70 44 62 48 Z" fill="${palette.leaf}"/>
        </g>`;

    case 'bloom':
    default:
      return `
        <g class="plant-art plant-bloom">
          ${stem(88, 46, palette, 4.5)}
          ${leaf(70, 78, false, palette, 1)}
          ${leaf(70, 66, true, palette, 0.9)}
          ${leaf(70, 58, false, palette, 0.6)}
          ${flowerHead(70, 40, palette, 20)}
        </g>`;
  }
}

/**
 * Full pot + plant illustration.
 * @param {object|null} plant catalog entry, or null for an empty pot
 * @param {string} stageId one of seed | sprout | bud | bloom
 */
export function potArt(plant, stageId) {
  const id = nextId();
  const inner = plant ? plantMarkup(stageId, plant.palette) : '';
  return `<svg class="pot-art" viewBox="0 0 140 140" xmlns="${NS}" aria-hidden="true">
    ${potMarkup(id)}
    ${inner}
  </svg>`;
}

/** Small seed-packet icon used in the merchant and the seed picker. */
export function seedIcon(plant) {
  const id = nextId();
  const p = plant.palette;
  return `<svg class="seed-icon" viewBox="0 0 64 64" xmlns="${NS}" aria-hidden="true">
    <defs>
      <linearGradient id="${id}-pk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFF6E6"/>
        <stop offset="100%" stop-color="#EBD8B4"/>
      </linearGradient>
    </defs>
    <path d="M14 8 H50 A4 4 0 0 1 54 12 V52 A4 4 0 0 1 50 56 H14 A4 4 0 0 1 10 52 V12 A4 4 0 0 1 14 8 Z"
          fill="url(#${id}-pk)" stroke="#C9A87C" stroke-width="2"/>
    <path d="M10 18 H54" stroke="#C9A87C" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.7"/>
    ${flowerHead(32, 34, p, 13)}
    <ellipse cx="32" cy="49" rx="12" ry="3" fill="${p.leaf}" opacity="0.35"/>
  </svg>`;
}

/** Inline icons for buttons and the HUD. */
export const ICONS = {
  coin: `<svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="#F2B33D" stroke="#C98A16" stroke-width="1.6"/>
    <circle cx="12" cy="12" r="5.5" fill="#FFD98A" opacity="0.7"/>
    <path d="M12 7.5v9M9.6 9.6h4.8M9.6 14.4h4.8" stroke="#B4780F" stroke-width="1.4"
          stroke-linecap="round"/>
  </svg>`,
  seed: `<svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
    <ellipse cx="12" cy="13" rx="5" ry="7" fill="#C9A87C" stroke="#8A6C46" stroke-width="1.4"/>
    <path d="M12 6c2 2 2 4 0 6" stroke="#6C9A63" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </svg>`,
  water: `<svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
    <path d="M12 3s6 6.6 6 10.3A6 6 0 0 1 6 13.3C6 9.6 12 3 12 3Z"
          fill="#7FC4E8" stroke="#3C86B0" stroke-width="1.5"/>
    <path d="M9.4 13.6a2.8 2.8 0 0 0 2.4 3" stroke="#FFFFFF" stroke-width="1.4"
          fill="none" stroke-linecap="round" opacity="0.85"/>
  </svg>`,
  lock: `<svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.4" fill="#C9A87C" stroke="#8A6C46"
          stroke-width="1.5"/>
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="#8A6C46" stroke-width="1.7"/>
  </svg>`,
  sword: `<svg viewBox="0 0 24 24" class="icon" aria-hidden="true">
    <path d="M14.5 3.5 20 9l-8.5 8.5-2-2L14.5 10 12 7.5Z" fill="#CFD8DC" stroke="#78909C"
          stroke-width="1.3"/>
    <path d="m8 16 2 2-3.2 3.2-2-2Z" fill="#8A6C46" stroke="#5A452C" stroke-width="1.2"/>
  </svg>`,
};
