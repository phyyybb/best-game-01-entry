// Deterministic autopilot scenes for the screenshot harness. The shot tool opens
// index.html?shot=start|play|end&seed=N and captures the canvas; each scene advances
// the simulation a fixed number of frames with scripted input so the frame is
// identical for the same seed.

import { VIEW } from './config.js';

export function shotFromUrl(search) {
  const m = /[?&]shot=(start|play|end)/.exec(search);
  if (!m) return null;
  const s = /[?&]seed=(\d+)/.exec(search);
  return { kind: m[1], seed: s ? (Number(s[1]) >>> 0) : 1 };
}

export function shotFrames(kind) {
  if (kind === 'play') return 2100;
  if (kind === 'end') return 2400;
  return 0;
}

function nearestThreat(world) {
  const p = world.player;
  let best = null, bd = Infinity;
  for (const e of world.entities) {
    if (e.type === 'plankton' || e.type === 'bubble') continue;
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return { e: best, d2: bd };
}

function dodge(world, frame) {
  const i = { left: false, right: false, up: false, down: false };
  const p = world.player;
  const { e, d2 } = nearestThreat(world);
  if (e && d2 < 300 * 300) {
    const dx = e.x - p.x;
    if (Math.abs(dx) < 46) {
      i.right = p.x < VIEW.w / 2;
      i.left = !i.right;
    } else {
      i.left = dx > 0;
      i.right = dx < 0;
    }
    if (e.y > p.y && d2 < 190 * 190) i.up = true;
  } else {
    const sway = Math.sin(frame * 0.02);
    i.right = sway > 0.3;
    i.left = sway < -0.3;
  }
  return i;
}

function seekHazard(world) {
  const i = { left: false, right: false, up: false, down: false };
  const p = world.player;
  const { e } = nearestThreat(world);
  if (e) {
    i.left = e.x < p.x - 6;
    i.right = e.x > p.x + 6;
    i.up = e.y < p.y - 6;
    i.down = e.y > p.y + 6;
  }
  return i;
}

export function scriptedInput(kind, frame, world) {
  if (kind === 'play') return dodge(world, frame);
  if (kind === 'end') return frame < 1500 ? dodge(world, frame) : seekHazard(world);
  return { left: false, right: false, up: false, down: false };
}
