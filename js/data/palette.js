// Dark-fantasy palette. One character per colour, used by every sprite in
// data/sprites.js. Keeping the set small is what makes the art look like it
// belongs to one world rather than a pile of unrelated assets.
//
// '.' is always transparent.

export const PAL = {
  '.': null,

  // --- neutrals / stone ---
  '0': '#07060d',  // void black
  '1': '#120e1b',  // near black
  '2': '#1e1829',  // stone shadow
  '3': '#2e2440',  // stone dark
  '4': '#413353',  // stone mid
  '5': '#584767',  // stone light
  '6': '#77638a',  // stone highlight

  // --- floor ---
  '7': '#171222',  // floor dark
  '8': '#231b31',  // floor mid
  '9': '#31263f',  // floor light

  // --- wood ---
  'a': '#3a2a1c',  // wood shadow
  'b': '#573f28',  // wood dark
  'c': '#7a5a38',  // wood mid
  'd': '#a07a4c',  // wood light

  // --- fire / dragon warm ---
  'e': '#5c1a10',  // ember dark
  'f': '#8f2f16',  // dragon deep red
  'g': '#c4491d',  // dragon red
  'h': '#e87a2c',  // flame orange
  'i': '#ffb648',  // flame bright
  'j': '#ffeaa8',  // flame white-hot

  // --- gold ---
  'k': '#8a6414',  // gold shadow
  'l': '#c99a26',  // gold mid
  'm': '#f0cc5a',  // gold bright
  'n': '#fff2b0',  // gold shine

  // --- steel ---
  'o': '#2b3440',  // steel shadow
  'p': '#4e5f72',  // steel dark
  'q': '#7d92a6',  // steel mid
  'r': '#b6c8d8',  // steel light
  's': '#eaf2fa',  // steel shine

  // --- player ---
  't': '#1d2a44',  // cloak shadow
  'u': '#31456b',  // cloak dark
  'v': '#4a6595',  // cloak mid
  'w': '#6d8cc0',  // cloak light
  'x': '#c98f5e',  // skin
  'y': '#efc396',  // skin light

  // --- arcane / magic ---
  'z': '#3d1f5e',  // magic deep
  'A': '#6b32a0',  // magic mid
  'B': '#a866e0',  // magic bright
  'C': '#ddb4ff',  // magic pale

  // --- blood / danger ---
  'D': '#4a0f18',  // blood dark
  'E': '#8f1c26',  // blood
  'F': '#cc3340',  // blood bright

  // --- misc ---
  'G': '#22302a',  // moss dark
  'H': '#3d5a44',  // moss
  'I': '#d8cba8',  // parchment
  'J': '#6b5f4a',  // parchment shadow

  // --- water (book two) ---
  // Cold and desaturated on purpose: the drowned book has to feel like a
  // different world from the dragon's forge without leaving the same palette.
  'K': '#04141d',  // abyss
  'L': '#082733',  // deep water
  'M': '#0e3d4f',  // water dark
  'N': '#15586d',  // water mid
  'O': '#1f7d91',  // water light
  'P': '#38aab6',  // shallow
  'Q': '#70dad4',  // foam
  'R': '#c4f6ef',  // foam bright

  // --- coral ---
  'S': '#3d1430',  // coral shadow
  'T': '#7a1f45',  // coral deep
  'U': '#b83a5a',  // coral mid
  'V': '#e8688a',  // coral bright
  'W': '#ffb3c4',  // coral pale

  // --- kelp / drowned flesh ---
  'X': '#12261c',  // kelp dark
  'Y': '#2c5638',  // kelp
  'Z': '#5c8f5a',  // kelp light
};
