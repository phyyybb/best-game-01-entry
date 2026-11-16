// Boot + fixed-step loop. Owns the phase machine (title / playing / paused / game over),
// wires input, audio and events to the simulation, and renders every frame. When the URL
// carries ?shot=start|play|end it instead runs a deterministic autopilot scene for the
// screenshot harness.

import { VIEW, TIMESTEP } from './config.js';
import { World } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  drawBackground, drawWorld, drawHud, drawTitle, drawPause, drawGameOver, drawBanner,
} from './render.js';
import { shotFromUrl, scriptedInput, shotFrames } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.w;
canvas.height = VIEW.h;

const BEST_KEY = 'deepdrop.best';
function loadBest() {
  try { const v = Number(localStorage.getItem(BEST_KEY)); return Number.isFinite(v) && v > 0 ? v : 0; }
  catch { return 0; }
}
function saveBest(v) { try { localStorage.setItem(BEST_KEY, String(v)); } catch {} }

function seedFromUrl(search) {
  const m = /[?&]seed=(\d+)/.exec(search);
  return m ? (Number(m[1]) >>> 0) : null;
}

const audio = createAudio();
const input = createInput();

let phase = 'title';
let world = null;
let bestDepth = loadBest();
let newBest = false;
let sinceDeath = 0;
let banner = null;
const BANNER_TIME = 2.4;

function startRun(seed) {
  world = new World(seed);
  phase = 'playing';
  sinceDeath = 0;
  newBest = false;
  banner = { name: world.zone().name, t: 0 };
  audio.unlock();
  audio.startDrone();
}

function onDied() {
  const depth = Math.floor(world.depth);
  newBest = depth > bestDepth;
  if (newBest) { bestDepth = depth; saveBest(depth); }
  phase = 'gameover';
  sinceDeath = 0;
  audio.stopDrone();
}

function pause() {
  if (phase !== 'playing') return;
  phase = 'paused';
  audio.stopDrone();
}
function resume() {
  if (phase !== 'paused') return;
  phase = 'playing';
  audio.startDrone();
}
function togglePause() {
  if (phase === 'playing') pause();
  else if (phase === 'paused') resume();
}

function handleEvent(ev) {
  if (ev.type === 'collect') { ev.kind === 'bubble' ? audio.healBubble() : audio.bubble(); }
  else if (ev.type === 'hit') audio.hit();
  else if (ev.type === 'zone') { banner = { name: ev.name, t: 0 }; audio.zoneChime(); }
  else if (ev.type === 'died') onDied();
}

let acc = 0;
let last = performance.now();

function frame(now) {
  const dtReal = Math.min((now - last) / 1000, 0.1);
  last = now;

  const pressed = input.consumePressed();
  if (pressed.pause) togglePause();
  if (pressed.space && (phase === 'title' || phase === 'gameover')) {
    startRun(seedFromUrl(location.search) ?? ((Math.random() * 0xffffffff) >>> 0));
  }
  if (input.consumeBlur()) pause();

  if (phase === 'playing') {
    acc += dtReal;
    while (acc >= TIMESTEP) {
      acc -= TIMESTEP;
      for (const ev of world.update(TIMESTEP, input.held)) handleEvent(ev);
      if (phase !== 'playing') { acc = 0; break; }
    }
    audio.setDroneDepth(world.depth);
  } else if (phase === 'gameover') {
    sinceDeath += dtReal;
  }

  if (banner) {
    banner.t += dtReal;
    if (banner.t >= BANNER_TIME) banner = null;
  }

  render(now);
  requestAnimationFrame(frame);
}

function render(now) {
  ctx.clearRect(0, 0, VIEW.w, VIEW.h);
  if (phase === 'title') {
    drawBackground(ctx, 0);
    drawTitle(ctx, now / 1000);
    return;
  }
  drawWorld(ctx, world, { sinceDeath });
  drawHud(ctx, world);
  if (banner) drawBanner(ctx, banner);
  if (phase === 'paused') drawPause(ctx);
  else if (phase === 'gameover') drawGameOver(ctx, world, bestDepth, newBest, sinceDeath, now / 1000);
}

// --- deterministic screenshot scenes -------------------------------------------

function runShot(shot) {
  const w = new World(shot.seed);
  let ph = 'title';
  let sd = 0;
  let shotBest = 0;
  let shotNewBest = false;

  if (shot.kind === 'play') {
    ph = 'playing';
    for (let f = 0; f < shotFrames('play'); f++) w.update(TIMESTEP, scriptedInput('play', f, w));
  } else if (shot.kind === 'end') {
    for (let f = 0; f < shotFrames('end'); f++) {
      w.update(TIMESTEP, scriptedInput('end', f, w));
      if (!w.alive) break;
    }
    if (w.alive) w.sink();
    ph = 'gameover';
    sd = 1.4;
    shotBest = Math.floor(w.depth);
  }

  const now = 0;
  function draw() {
    ctx.clearRect(0, 0, VIEW.w, VIEW.h);
    if (ph === 'title') {
      drawBackground(ctx, 0);
      drawTitle(ctx, now);
      return;
    }
    drawWorld(ctx, w, { sinceDeath: sd });
    drawHud(ctx, w);
    if (ph === 'gameover') drawGameOver(ctx, w, shotBest, shotNewBest, sd, now);
  }
  draw();
  requestAnimationFrame(function keep() { draw(); requestAnimationFrame(keep); });
}

const shot = shotFromUrl(location.search);
if (shot) runShot(shot);
else requestAnimationFrame(frame);
