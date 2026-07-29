/**
 * Seed & plant catalog.
 *
 * growMs is the fully-watered grow time; dry soil halves the rate (see garden.js).
 * dropChance is the odds a harvest returns a free seed of the same plant.
 * palette drives the SVG gradient stops so every plant reads distinctly.
 */

export const RARITIES = {
  common: { label: 'Common', weight: 55, color: '#8FA98A' },
  uncommon: { label: 'Uncommon', weight: 28, color: '#5B9BD5' },
  rare: { label: 'Rare', weight: 14, color: '#A472D6' },
  legendary: { label: 'Legendary', weight: 3, color: '#F2B33D' },
};

export const PLANTS = [
  // --- Common -------------------------------------------------------------
  {
    id: 'marigold',
    name: 'Marigold',
    rarity: 'common',
    seedPrice: 8,
    sellValue: 20,
    growMs: 30_000,
    dropChance: 0.35,
    blurb: 'Hardy, sunny, forgiving. A first-garden favourite.',
    palette: { bloom: '#FFB43D', bloomDeep: '#E2801B', leaf: '#6C9A63' },
  },
  {
    id: 'basil',
    name: 'Basil',
    rarity: 'common',
    seedPrice: 9,
    sellValue: 22,
    growMs: 34_000,
    dropChance: 0.35,
    blurb: 'Smells like a warm kitchen window.',
    palette: { bloom: '#7FBF6A', bloomDeep: '#43804A', leaf: '#5C8F58' },
  },
  {
    id: 'daisy',
    name: 'Daisy',
    rarity: 'common',
    seedPrice: 10,
    sellValue: 26,
    growMs: 38_000,
    dropChance: 0.3,
    blurb: 'Small, cheerful, impossible to dislike.',
    palette: { bloom: '#FFFBF0', bloomDeep: '#F3D98A', leaf: '#6C9A63' },
  },
  {
    id: 'tomato',
    name: 'Tomato',
    rarity: 'common',
    seedPrice: 12,
    sellValue: 32,
    growMs: 45_000,
    dropChance: 0.3,
    blurb: 'Technically a fruit. Emotionally, a vegetable.',
    palette: { bloom: '#E5533D', bloomDeep: '#A82D22', leaf: '#5C8F58' },
  },

  // --- Uncommon -----------------------------------------------------------
  {
    id: 'lavender',
    name: 'Lavender',
    rarity: 'uncommon',
    seedPrice: 30,
    sellValue: 80,
    growMs: 60_000,
    dropChance: 0.25,
    blurb: 'The whole plot goes quiet when it blooms.',
    palette: { bloom: '#B39BE0', bloomDeep: '#6F5AA8', leaf: '#7FA07A' },
  },
  {
    id: 'sunflower',
    name: 'Sunflower',
    rarity: 'uncommon',
    seedPrice: 34,
    sellValue: 92,
    growMs: 70_000,
    dropChance: 0.25,
    blurb: 'Tall enough to look over the fence.',
    palette: { bloom: '#FFD34D', bloomDeep: '#D98A16', leaf: '#5C8F58' },
  },
  {
    id: 'strawberry',
    name: 'Strawberry',
    rarity: 'uncommon',
    seedPrice: 38,
    sellValue: 104,
    growMs: 80_000,
    dropChance: 0.22,
    blurb: 'Never quite makes it to the basket.',
    palette: { bloom: '#F2506B', bloomDeep: '#B22343', leaf: '#6C9A63' },
  },
  {
    id: 'mint',
    name: 'Mint',
    rarity: 'uncommon',
    seedPrice: 42,
    sellValue: 118,
    growMs: 90_000,
    dropChance: 0.22,
    blurb: 'Give it a pot of its own. Trust me.',
    palette: { bloom: '#7EDCB4', bloomDeep: '#329C77', leaf: '#4E9070' },
  },

  // --- Rare ---------------------------------------------------------------
  {
    id: 'blue-rose',
    name: 'Blue Rose',
    rarity: 'rare',
    seedPrice: 110,
    sellValue: 300,
    growMs: 120_000,
    dropChance: 0.16,
    blurb: 'Said to be impossible. Clearly not.',
    palette: { bloom: '#6FA8F5', bloomDeep: '#2A4FA8', leaf: '#4F7A55' },
  },
  {
    id: 'moonflower',
    name: 'Moonflower',
    rarity: 'rare',
    seedPrice: 140,
    sellValue: 380,
    growMs: 135_000,
    dropChance: 0.14,
    blurb: 'Opens only after the lamps come on.',
    palette: { bloom: '#E8E4FF', bloomDeep: '#8A7FC4', leaf: '#5A7F62' },
  },
  {
    id: 'ghost-orchid',
    name: 'Ghost Orchid',
    rarity: 'rare',
    seedPrice: 170,
    sellValue: 470,
    growMs: 150_000,
    dropChance: 0.12,
    blurb: 'Looks like it is about to say something.',
    palette: { bloom: '#DFF6F0', bloomDeep: '#7FBFB0', leaf: '#4E8069' },
  },

  // --- Legendary ----------------------------------------------------------
  {
    id: 'gardenia',
    name: 'Gardenia',
    rarity: 'legendary',
    seedPrice: 350,
    sellValue: 950,
    growMs: 180_000,
    dropChance: 0.1,
    blurb: 'The one the whole garden is named for.',
    palette: { bloom: '#FFFDF6', bloomDeep: '#E8D9A8', leaf: '#3F6B4C' },
  },
  {
    id: 'aurora-lily',
    name: 'Aurora Lily',
    rarity: 'legendary',
    seedPrice: 420,
    sellValue: 1150,
    growMs: 180_000,
    dropChance: 0.08,
    blurb: 'Its petals never settle on one colour.',
    palette: { bloom: '#9BF0D6', bloomDeep: '#A472D6', leaf: '#44795C' },
  },
];

const BY_ID = new Map(PLANTS.map((p) => [p.id, p]));

export function getPlant(id) {
  return BY_ID.get(id) ?? null;
}

export function isPlantId(id) {
  return BY_ID.has(id);
}

/** Pick a random plant, weighted by its rarity tier. */
export function randomPlant(rand = Math.random) {
  const total = PLANTS.reduce((sum, p) => sum + RARITIES[p.rarity].weight, 0);
  let roll = rand() * total;
  for (const plant of PLANTS) {
    roll -= RARITIES[plant.rarity].weight;
    if (roll <= 0) return plant;
  }
  return PLANTS[0];
}
