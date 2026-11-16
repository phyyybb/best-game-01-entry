// Deterministic PRNG (mulberry32). Every roll in the simulation must come from here
// so a run is byte-identical given the same seed.

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range(min, max) { return min + (max - min) * next(); },
    int(min, max) { return Math.floor(min + (max - min + 1) * next()); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
    sign() { return next() < 0.5 ? -1 : 1; },
  };
}
