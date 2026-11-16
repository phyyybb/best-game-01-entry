// All drawing: background, entities, the submersible, HUD, and the title / pause /
// game-over screens. Pure canvas 2D, no images, no fonts beyond system defaults.

import {
  VIEW, PLAYER, HAZARD, DEPTH_DARK, FX, zoneAt, paletteAt, darknessAt, css,
} from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawBackground(ctx, depth) {
  const p = paletteAt(depth);
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  g.addColorStop(0, css(p.top));
  g.addColorStop(0.5, css(p.mid));
  g.addColorStop(1, css(p.bottom));
  ctx.fillStyle = g;
  ctx.fillRect(-16, -16, VIEW.w + 32, VIEW.h + 32);

  // fading surface light shafts
  const shafts = 1 - darknessAt(depth);
  if (shafts > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = 30 + i * 140;
      const w = 40 + (i % 3) * 16;
      const grad = ctx.createLinearGradient(x, 0, x + w * 1.6, VIEW.h);
      grad.addColorStop(0, `rgba(180,240,255,${0.12 * shafts})`);
      grad.addColorStop(1, 'rgba(180,240,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + w, 0);
      ctx.lineTo(x + w * 1.6, VIEW.h);
      ctx.lineTo(x + w * 0.2, VIEW.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawSub(ctx, time, sunk) {
  if (!sunk) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createLinearGradient(0, 24, 0, 300);
    beam.addColorStop(0, 'rgba(200,240,255,0.15)');
    beam.addColorStop(1, 'rgba(200,240,255,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-7, 24);
    ctx.lineTo(7, 24);
    ctx.lineTo(68, 300);
    ctx.lineTo(-68, 300);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = sunk ? '#0c2b33' : '#0e5566';
  ctx.beginPath(); ctx.moveTo(-4, -26); ctx.lineTo(4, -26); ctx.lineTo(0, -46); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-14, 4); ctx.lineTo(-30, 16); ctx.lineTo(-14, 22); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(14, 4); ctx.lineTo(30, 16); ctx.lineTo(14, 22); ctx.closePath(); ctx.fill();

  const hullGrad = ctx.createLinearGradient(-14, 0, 14, 0);
  if (sunk) { hullGrad.addColorStop(0, '#0a2a33'); hullGrad.addColorStop(1, '#062028'); }
  else { hullGrad.addColorStop(0, '#2fd4cf'); hullGrad.addColorStop(0.5, '#18a9b8'); hullGrad.addColorStop(1, '#0e6f84'); }
  ctx.fillStyle = hullGrad;
  roundRect(ctx, -14, -30, 28, 64, 14);
  ctx.fill();
  ctx.strokeStyle = sunk ? 'rgba(90,160,175,0.4)' : 'rgba(170,240,245,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (!sunk) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = 'rgba(150,255,250,0.9)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(210,255,252,0.95)';
    ctx.beginPath(); ctx.arc(0, -8, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(120,160,170,0.6)';
    ctx.beginPath(); ctx.arc(0, -8, 7, 0, Math.PI * 2); ctx.fill();
  }

  const spin = time * 20;
  ctx.strokeStyle = sunk ? 'rgba(100,140,150,0.6)' : 'rgba(180,230,235,0.8)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 2; i++) {
    const a = spin + i * Math.PI;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(Math.cos(a) * 11, -34 + Math.sin(a) * 11);
    ctx.stroke();
  }
}

function drawPlayer(ctx, world, sinceDeath = 0) {
  const p = world.player;
  const sunk = !world.alive;
  const sinkT = Math.min(1, sinceDeath / 0.8);
  ctx.save();
  ctx.translate(p.x + sinkT * 14, p.y + sinkT * 46);
  ctx.rotate(sinkT * 0.9);
  if (p.invuln > 0 && !sunk && Math.floor(world.time * 14) % 2 === 0) ctx.globalAlpha = 0.35;
  drawSub(ctx, world.time, sunk);
  ctx.restore();
}

function drawJellyfish(ctx, e, time, jelly) {
  const pulse = 1 + 0.16 * Math.sin(time * HAZARD.jellyfish.pulse + e.phase);
  const rx = e.r * pulse;
  const ry = e.r * 0.72 * pulse;
  ctx.save();
  ctx.translate(e.x, e.y);

  ctx.strokeStyle = css(jelly, 0.35);
  ctx.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) {
    const bx = i * rx * 0.3;
    const wob = Math.sin(time * 2 + e.phase + i) * 5;
    ctx.beginPath();
    ctx.moveTo(bx, ry * 0.6);
    ctx.quadraticCurveTo(bx + wob, ry * 0.6 + 18, bx + wob * 0.4, ry * 0.6 + 34 + i * 4);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createRadialGradient(0, ry * 0.2, 0, 0, ry * 0.2, rx);
  grad.addColorStop(0, css(jelly, 0.85));
  grad.addColorStop(0.6, css(jelly, 0.5));
  grad.addColorStop(1, css(jelly, 0.15));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, ry * 0.2, rx, ry, 0, Math.PI, 0);
  ctx.fill();

  ctx.strokeStyle = css(jelly, 0.7);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, ry * 0.2, rx, ry, 0, Math.PI, 0);
  ctx.stroke();

  ctx.fillStyle = css(jelly, 0.9);
  ctx.beginPath(); ctx.arc(-rx * 0.25, ry * 0.05, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(rx * 0.2, ry * 0.1, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawRock(ctx, e, dark) {
  const shade = 1 - dark * 0.7;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.rot);
  const grad = ctx.createLinearGradient(-e.r, -e.r, e.r, e.r);
  grad.addColorStop(0, css([96 * shade, 78 * shade, 66 * shade]));
  grad.addColorStop(1, css([56 * shade, 46 * shade, 40 * shade]));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(e.verts[0][0], e.verts[0][1]);
  for (let i = 1; i < e.verts.length; i++) ctx.lineTo(e.verts[i][0], e.verts[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css([40 * shade, 34 * shade, 30 * shade], 0.8);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = css([70 * shade, 58 * shade, 50 * shade], 0.7);
  ctx.beginPath();
  ctx.moveTo(-e.r * 0.4, -e.r * 0.2);
  ctx.lineTo(-e.r * 0.1, e.r * 0.05);
  ctx.lineTo(-e.r * 0.35, e.r * 0.4);
  ctx.stroke();
  ctx.restore();
}

function drawAngler(ctx, e, time) {
  const charging = e.state === 'charge';
  const telegraph = e.state === 'telegraph';
  const dir = e.facing;
  const bob = Math.sin(time * 2 + e.phase) * 2;
  const lureX = dir * e.r * 0.4 + Math.sin(time * 3 + e.phase) * 3;
  const lureY = -e.r - HAZARD.angler.lureLen + bob;

  ctx.save();
  ctx.translate(e.x, e.y);

  ctx.globalCompositeOperation = 'lighter';
  const hot = telegraph && Math.floor(time * 14) % 2 === 0;
  const lureC = telegraph ? (hot ? [255, 72, 60] : [130, 22, 18]) : [255, 235, 140];
  const lureR = telegraph ? 30 : 22;
  const g = ctx.createRadialGradient(lureX, lureY, 0, lureX, lureY, lureR);
  g.addColorStop(0, css(lureC, 0.95));
  g.addColorStop(0.3, css(lureC, 0.5));
  g.addColorStop(1, css(lureC, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(lureX, lureY, lureR, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = 'rgba(40,50,60,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -e.r * 0.5);
  ctx.quadraticCurveTo(dir * e.r * 0.5, -e.r * 0.8, lureX, lureY);
  ctx.stroke();

  ctx.globalCompositeOperation = 'source-over';
  const bodyA = charging ? 0.92 : 0.75;
  const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, e.r);
  bodyGrad.addColorStop(0, `rgba(48,60,72,${bodyA})`);
  bodyGrad.addColorStop(1, `rgba(12,16,22,${bodyA})`);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, e.r * 0.85, e.r, dir * 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(6,8,10,${bodyA})`;
  ctx.beginPath();
  ctx.ellipse(0, -e.r * 0.45, e.r * 0.6, e.r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(220,230,240,0.9)';
  for (let i = -2; i <= 2; i++) {
    const tx = i * e.r * 0.22;
    ctx.beginPath();
    ctx.moveTo(tx - 3, -e.r * 0.7);
    ctx.lineTo(tx, -e.r * 0.42);
    ctx.lineTo(tx + 3, -e.r * 0.7);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(230,245,255,0.95)';
  ctx.beginPath(); ctx.arc(dir * e.r * 0.3, -e.r * 0.05, 2.2, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = `rgba(24,30,40,${bodyA})`;
  ctx.beginPath(); ctx.moveTo(-e.r * 0.7, 0); ctx.lineTo(-e.r * 1.3, e.r * 0.5); ctx.lineTo(-e.r * 0.5, e.r * 0.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(e.r * 0.7, 0); ctx.lineTo(e.r * 1.3, e.r * 0.5); ctx.lineTo(e.r * 0.5, e.r * 0.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, e.r * 0.7); ctx.lineTo(-e.r * 0.5, e.r * 1.2); ctx.lineTo(e.r * 0.5, e.r * 1.2); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawPlankton(ctx, e, time) {
  const a = 0.6 + 0.4 * Math.sin(time * 5 + e.phase);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 4);
  g.addColorStop(0, `rgba(200,255,245,${0.9 * a})`);
  g.addColorStop(1, 'rgba(200,255,245,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(235,255,252,${a})`;
  ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBubble(ctx, e, time) {
  const r = e.r * (1 + 0.06 * Math.sin(time * 6 + e.phase));
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.strokeStyle = 'rgba(210,245,255,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(240,255,255,0.5)';
  ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawEntity(ctx, e, time, pal, dark) {
  switch (e.type) {
    case 'jellyfish': drawJellyfish(ctx, e, time, pal.jelly); break;
    case 'rock': drawRock(ctx, e, dark); break;
    case 'angler': drawAngler(ctx, e, time); break;
    case 'plankton': drawPlankton(ctx, e, time); break;
    case 'bubble': drawBubble(ctx, e, time); break;
  }
}

function drawVignette(ctx) {
  const g = ctx.createRadialGradient(VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.3, VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,4,10,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
}

export function drawHitFlash(ctx, amount) {
  if (amount <= 0.001) return;
  const g = ctx.createRadialGradient(VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.25, VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.7);
  g.addColorStop(0, 'rgba(255,40,30,0)');
  g.addColorStop(1, `rgba(255,40,30,${0.55 * amount})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
}

export function drawRipples(ctx, ripples) {
  for (const r of ripples) {
    const t = Math.min(1, r.t / FX.rippleLife);
    const rad = 6 + (FX.rippleRadius - 6) * t;
    const a = (1 - t) * 0.7;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(200,255,245,${a})`;
    ctx.lineWidth = 2 * (1 - t) + 0.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawWorld(ctx, world, opts = {}) {
  ctx.save();
  ctx.translate(opts.shakeX ?? 0, opts.shakeY ?? 0);
  drawBackground(ctx, world.depth);
  const pal = paletteAt(world.depth);
  const dark = darknessAt(world.depth);

  ctx.fillStyle = css(pal.particle);
  for (const pt of world.particles) {
    ctx.globalAlpha = 0.12 + pt.scale * 0.12;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.scale * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const e of world.entities) drawEntity(ctx, e, world.time, pal, dark);
  drawPlayer(ctx, world, opts.sinceDeath ?? 0);
  drawVignette(ctx);
  ctx.restore();
}

function drawHeart(ctx, x, y, s, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, s * 0.55);
  ctx.bezierCurveTo(-s * 0.6, 0, -s * 0.35, -s * 0.5, 0, -s * 0.1);
  ctx.bezierCurveTo(s * 0.35, -s * 0.5, s * 0.6, 0, 0, s * 0.55);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#ff5d7a';
    ctx.shadowColor = 'rgba(255,80,120,0.9)';
    ctx.shadowBlur = 8;
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(40,20,30,0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,120,150,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawHearts(ctx, hull) {
  for (let i = 0; i < PLAYER.maxHull; i++) drawHeart(ctx, 24 + i * 34, 26, 22, i < hull);
}

function drawPlanktonCount(ctx, n, combo = 0) {
  const x = 24, y = 58;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
  g.addColorStop(0, 'rgba(200,255,245,0.95)');
  g.addColorStop(1, 'rgba(200,255,245,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(235,255,252,0.95)';
  ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(220,245,250,0.95)';
  ctx.font = 'bold 22px "Arial", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), x + 18, y);
  if (combo >= 2) {
    ctx.fillStyle = 'rgba(255,225,120,0.95)';
    ctx.font = 'bold 16px "Arial", sans-serif';
    ctx.fillText(`x${combo}`, x + 18, y + 20);
  }
}

function drawZoneLabel(ctx, name) {
  ctx.fillStyle = 'rgba(210,240,250,0.7)';
  ctx.font = '14px "Arial", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(name.toUpperCase(), VIEW.w / 2, 16);
}

function drawDepthMeter(ctx, depth) {
  const x = VIEW.w - 30;
  const top = 90, bottom = VIEW.h - 90;
  const trackW = 10;

  ctx.fillStyle = 'rgba(0,20,30,0.55)';
  roundRect(ctx, x - trackW / 2, top, trackW, bottom - top, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,220,235,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(160,225,240,0.3)';
  for (let z = 1; z <= 5; z++) {
    const y = bottom - (bottom - top) * (z / 5);
    ctx.beginPath();
    ctx.moveTo(x - trackW / 2 - 4, y);
    ctx.lineTo(x + trackW / 2 + 4, y);
    ctx.stroke();
  }

  const frac = Math.min(1, depth / DEPTH_DARK);
  const fillH = (bottom - top) * frac;
  const fg = ctx.createLinearGradient(0, top, 0, bottom);
  fg.addColorStop(0, 'rgba(120,255,240,0.9)');
  fg.addColorStop(1, 'rgba(60,120,180,0.75)');
  ctx.fillStyle = fg;
  roundRect(ctx, x - trackW / 2, bottom - fillH, trackW, fillH, 5);
  ctx.fill();

  ctx.fillStyle = 'rgba(235,255,255,0.95)';
  ctx.font = 'bold 24px "Consolas", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${Math.floor(depth)} m`, x, bottom + 14);

  ctx.fillStyle = 'rgba(180,230,240,0.7)';
  ctx.font = 'bold 13px "Arial", sans-serif';
  ctx.fillText('DEPTH', x, top - 26);
}

export function drawHud(ctx, world, combo = 0) {
  drawHearts(ctx, world.hull);
  drawPlanktonCount(ctx, world.plankton, combo);
  drawZoneLabel(ctx, zoneAt(world.depth).name);
  drawDepthMeter(ctx, world.depth);
}

export function drawBanner(ctx, banner) {
  const t = banner.t;
  let a = 1;
  if (t < 0.35) a = t / 0.35;
  else if (t > 1.7) a = Math.max(0, (2.4 - t) / 0.7);
  a = Math.max(0, Math.min(1, a));
  const y = VIEW.h * 0.34;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '14px "Arial", sans-serif';
  ctx.fillStyle = 'rgba(200,240,250,0.8)';
  ctx.fillText('ZONE', VIEW.w / 2, y - 42);
  ctx.font = 'bold 46px "Arial Black", "Arial", sans-serif';
  ctx.shadowColor = 'rgba(140,255,245,0.9)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(225,255,252,0.95)';
  ctx.fillText(banner.name, VIEW.w / 2, y);
  ctx.restore();
}

function drawPlanktonField(ctx, now) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 48; i++) {
    const speed = 5 + (i % 7) * 3;
    const px = ((i * 137.5) % VIEW.w) + Math.sin(now * 0.6 + i) * 10;
    const py = VIEW.h - ((i * 89 + now * speed) % VIEW.h);
    const r = 1.4 + (i % 4) * 1.1;
    const a = 0.25 + (i % 3) * 0.14;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r * 3.5);
    g.addColorStop(0, `rgba(200,255,245,${a})`);
    g.addColorStop(1, 'rgba(200,255,245,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, r * 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(235,255,252,${a})`;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawTitle(ctx, now) {
  const cx = VIEW.w / 2;
  drawPlanktonField(ctx, now);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.font = 'bold 88px "Arial Black", "Arial", sans-serif';
  ctx.shadowColor = 'rgba(80,220,230,0.9)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#eafeff';
  ctx.fillText('DEEP', cx, VIEW.h * 0.3);
  ctx.fillText('DROP', cx, VIEW.h * 0.3 + 92);
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.save();
  ctx.translate(cx + Math.sin(now * 0.4) * 6, VIEW.h * 0.52 + Math.sin(now * 0.6) * 12);
  ctx.rotate(Math.sin(now * 0.5) * 0.06);
  ctx.globalAlpha = 0.3;
  drawSub(ctx, now * 0.5, false);
  ctx.restore();

  ctx.fillStyle = 'rgba(190,230,240,0.8)';
  ctx.font = '16px "Arial", sans-serif';
  ctx.fillText('Steer with \u2190 \u2192 / WASD \u00b7 collect the light \u00b7 survive the deep', cx, VIEW.h * 0.74);

  const a = 0.6 + 0.4 * Math.sin(now * 2.5);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = '#d8fbff';
  ctx.font = 'bold 26px "Arial", sans-serif';
  ctx.shadowColor = 'rgba(120,255,245,0.8)';
  ctx.shadowBlur = 12;
  ctx.fillText('Press Space to dive', cx, VIEW.h * 0.84);
  ctx.restore();
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(2,8,14,0.55)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 48px "Arial Black", "Arial", sans-serif';
  ctx.fillStyle = '#eafeff';
  ctx.shadowColor = 'rgba(120,220,230,0.8)';
  ctx.shadowBlur = 16;
  ctx.fillText('PAUSED', VIEW.w / 2, VIEW.h * 0.45);
  ctx.shadowBlur = 0;
  ctx.font = '18px "Arial", sans-serif';
  ctx.fillStyle = 'rgba(190,230,240,0.8)';
  ctx.fillText('Press P to resume', VIEW.w / 2, VIEW.h * 0.53);
}

export function drawGameOver(ctx, world, best, newBest, sinceDeath, now) {
  ctx.fillStyle = 'rgba(2,8,14,0.66)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  const cx = VIEW.w / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const depth = Math.floor(world.depth);

  ctx.save();
  ctx.font = 'bold 64px "Arial Black", "Arial", sans-serif';
  ctx.fillStyle = '#ffd9a0';
  ctx.shadowColor = 'rgba(255,120,80,0.8)';
  ctx.shadowBlur = 18;
  ctx.fillText('YOU SANK', cx, VIEW.h * 0.24);
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.font = 'bold 30px "Arial", sans-serif';
  ctx.fillStyle = '#e8f9ff';
  ctx.fillText(`Depth  ${depth} m`, cx, VIEW.h * 0.42);

  ctx.font = '24px "Arial", sans-serif';
  ctx.fillStyle = '#bfe8f2';
  ctx.fillText(`Best  ${best} m`, cx, VIEW.h * 0.5);
  if (newBest) {
    ctx.fillStyle = '#7dffb0';
    ctx.font = 'bold 16px "Arial", sans-serif';
    ctx.fillText('NEW BEST!', cx, VIEW.h * 0.5 + 26);
  }

  ctx.fillStyle = '#cfeff7';
  ctx.font = '24px "Arial", sans-serif';
  ctx.fillText(`Plankton  ${world.plankton}`, cx, VIEW.h * 0.6);

  if (sinceDeath > 1.0) {
    const a = 0.6 + 0.4 * Math.sin(now * 2.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#d8fbff';
    ctx.font = 'bold 24px "Arial", sans-serif';
    ctx.fillText('Press Space to dive again', cx, VIEW.h * 0.78);
    ctx.restore();
  }
}
