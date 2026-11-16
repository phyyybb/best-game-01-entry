// Deep Drop — every tuning number and palette lives here so the whole game can be
// rebalanced by editing one file.

export const VIEW = Object.freeze({ w: 720, h: 960 });
export const TIMESTEP = 1 / 60;

export const PLAYER = Object.freeze({
  x: VIEW.w / 2,
  yAnchor: 200,
  radius: 22,
  speedX: 330,
  speedY: 210,
  yMin: 110,
  yMax: 560,
  maxHull: 3,
  invuln: 1.1,
});

export const DESCENT = Object.freeze({
  baseMetersPerSec: 8,
  rampPerMeter: 0.005,
  pixelsPerMeter: 10,
});

export const HAZARD = Object.freeze({
  jellyfish: { radius: 26, vx: 26, vy: 12, pulse: 2.6 },
  rock: { radius: 20, vyMin: 15, vyMax: 55, vx: 40, spin: 1.6 },
  angler: { radius: 24, chargeSpeed: 380, trigger: 280, lureLen: 30, telegraphTime: 0.55 },
});

export const PICKUP = Object.freeze({
  plankton: { radius: 4 },
  bubble: { radius: 8, rise: 90 },
});

export const PARTICLES = Object.freeze({ count: 90 });
export const ZONE_BURST = 4;
export const FX = Object.freeze({
  shakeDecay: 0.45,
  shakeMag: 7,
  hitFlashDecay: 0.35,
  rippleLife: 0.45,
  rippleRadius: 36,
  comboWindow: 1.6,
});
export const DEPTH_DARK = 1000;
export const ZONE_METERS = 200;

export const ZONES = [
  {
    name: 'Sunlit Shallows',
    speedMult: 1,
    spawnMult: 1,
    hazardInterval: 2.3,
    collectInterval: 0.85,
    hazardWeights: { jellyfish: 0.55, rock: 0.45, angler: 0 },
    collectWeights: { plankton: 0.9, bubble: 0.1 },
    palette: {
      top: [140, 244, 234], mid: [44, 160, 178], bottom: [8, 60, 78],
      glow: [140, 255, 244], particle: [205, 250, 250], jelly: [180, 240, 255],
    },
  },
  {
    name: 'Twilight Zone',
    speedMult: 1.25,
    spawnMult: 1.35,
    hazardInterval: 1.95,
    collectInterval: 1.0,
    hazardWeights: { jellyfish: 0.45, rock: 0.38, angler: 0.17 },
    collectWeights: { plankton: 0.78, bubble: 0.22 },
    palette: {
      top: [32, 102, 132], mid: [16, 66, 92], bottom: [4, 24, 40],
      glow: [90, 190, 225], particle: [150, 200, 225], jelly: [150, 210, 240],
    },
  },
  {
    name: 'Midnight Zone',
    speedMult: 1.5,
    spawnMult: 1.75,
    hazardInterval: 1.6,
    collectInterval: 1.1,
    hazardWeights: { jellyfish: 0.4, rock: 0.32, angler: 0.28 },
    collectWeights: { plankton: 0.62, bubble: 0.38 },
    palette: {
      top: [12, 48, 70], mid: [6, 32, 52], bottom: [1, 10, 22],
      glow: [70, 150, 210], particle: [110, 160, 200], jelly: [110, 170, 210],
    },
  },
  {
    name: 'Abyssal Plain',
    speedMult: 1.8,
    spawnMult: 2.2,
    hazardInterval: 1.3,
    collectInterval: 1.2,
    hazardWeights: { jellyfish: 0.34, rock: 0.36, angler: 0.3 },
    collectWeights: { plankton: 0.5, bubble: 0.5 },
    palette: {
      top: [6, 26, 40], mid: [3, 18, 30], bottom: [0, 4, 12],
      glow: [60, 110, 180], particle: [80, 120, 170], jelly: [80, 120, 180],
    },
  },
  {
    name: 'Hadal Deep',
    speedMult: 2.1,
    spawnMult: 2.7,
    hazardInterval: 1.0,
    collectInterval: 1.3,
    hazardWeights: { jellyfish: 0.28, rock: 0.4, angler: 0.32 },
    collectWeights: { plankton: 0.4, bubble: 0.6 },
    palette: {
      top: [3, 12, 22], mid: [1, 8, 16], bottom: [0, 0, 4],
      glow: [50, 80, 150], particle: [60, 90, 140], jelly: [60, 90, 140],
    },
  },
];

export function zoneIndexAt(depth) {
  return Math.min(ZONES.length - 1, Math.max(0, Math.floor(depth / ZONE_METERS)));
}
export function zoneAt(depth) {
  return ZONES[zoneIndexAt(depth)];
}
export function depthRateAt(depth) {
  return DESCENT.baseMetersPerSec + DESCENT.rampPerMeter * depth;
}
export function darknessAt(depth) {
  return Math.min(1, Math.max(0, depth / DEPTH_DARK));
}
export function css(c, a = 1) {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
}

const mix = (a, b, t) => a + (b - a) * t;
const mixC = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

export function paletteAt(depth) {
  const i = zoneIndexAt(depth);
  const z = ZONES[i].palette;
  if (i === ZONES.length - 1) return z;
  const t = (depth - i * ZONE_METERS) / ZONE_METERS;
  const n = ZONES[i + 1].palette;
  return {
    top: mixC(z.top, n.top, t),
    mid: mixC(z.mid, n.mid, t),
    bottom: mixC(z.bottom, n.bottom, t),
    glow: mixC(z.glow, n.glow, t),
    particle: mixC(z.particle, n.particle, t),
    jelly: mixC(z.jelly, n.jelly, t),
  };
}
