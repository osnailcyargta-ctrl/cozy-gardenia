// A seeded random stream.
//
// xorshift32: four lines, no state to manage, and the same seed always replays
// the same sequence. That last part is the whole point — book four's rooms are
// not stored anywhere, they are re-derived, so anything about a room that uses
// Math.random() is a detail that quietly changes every time you walk back in.

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
