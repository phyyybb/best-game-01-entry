// Simulation state: the descent, spawning, movement, collisions and the events they
// emit (collect / hit / zone / died). All rolls go through the seeded RNG so a run
// is identical given the same seed.

import {
  VIEW, PLAYER, DESCENT, HAZARD, PICKUP, PARTICLES,
  zoneIndexAt, zoneAt, depthRateAt,
} from './config.js';
import { makeRng } from './random.js';

export class World {
  constructor(seed) {
    this.rng = makeRng(seed);
    this.time = 0;
    this.depth = 0;         // meters (the score)
    this.hull = PLAYER.maxHull;
    this.plankton = 0;
    this.alive = true;
    this.player = {
      x: PLAYER.x,
      y: PLAYER.yAnchor,
      vx: 0,
      vy: 0,
      invuln: 0,
    };
    this.entities = [];
    this.particles = this._makeParticles();
    this.hazardTimer = 0.8;
    this.collectTimer = 0.4;
    this.lastZone = 0;
  }

  zoneIndex() { return zoneIndexAt(this.depth); }
  zone() { return zoneAt(this.depth); }
  scrollPxPerSec() {
    return depthRateAt(this.depth) * DESCENT.pixelsPerMeter * this.zone().speedMult;
  }

  _makeParticles() {
    const ps = [];
    for (let i = 0; i < PARTICLES.count; i++) {
      ps.push({
        x: this.rng.range(0, VIEW.w),
        y: this.rng.range(0, VIEW.h),
        scale: this.rng.range(0.35, 1.5),
        drift: this.rng.range(-6, 6),
      });
    }
    return ps;
  }

  _weighted(weights) {
    let roll = this.rng.next();
    for (const k in weights) {
      roll -= weights[k];
      if (roll <= 0) return k;
    }
    return Object.keys(weights)[0];
  }

  _rockShape(r) {
    const n = this.rng.int(6, 8);
    const verts = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const rad = r * this.rng.range(0.7, 1.15);
      verts.push([Math.cos(ang) * rad, Math.sin(ang) * rad]);
    }
    return verts;
  }

  _spawnHazard() {
    const z = this.zone();
    const type = this._weighted(z.hazardWeights);
    const e = {
      type, x: 0, y: VIEW.h + 40, vx: 0, vy: 0, rot: 0,
      phase: this.rng.range(0, Math.PI * 2), r: HAZARD[type].radius,
    };
    if (type === 'jellyfish') {
      e.x = this.rng.range(30, VIEW.w - 30);
      e.vx = this.rng.sign() * HAZARD.jellyfish.vx * this.rng.range(0.5, 1);
      e.vy = this.rng.range(-HAZARD.jellyfish.vy, HAZARD.jellyfish.vy);
      e.r *= this.rng.range(0.85, 1.2);
    } else if (type === 'rock') {
      e.x = this.rng.chance(0.6)
        ? (this.rng.chance(0.5) ? 24 : VIEW.w - 24)
        : this.rng.range(40, VIEW.w - 40);
      e.vx = (e.x < VIEW.w / 2 ? 1 : -1) * this.rng.range(0, HAZARD.rock.vx);
      e.vy = this.rng.range(HAZARD.rock.vyMin, HAZARD.rock.vyMax);
      e.r *= this.rng.range(0.8, 1.25);
      e.rot = this.rng.range(0, Math.PI * 2);
      e.spin = this.rng.sign() * HAZARD.rock.spin;
      e.verts = this._rockShape(e.r);
    } else if (type === 'angler') {
      e.x = this.rng.range(40, VIEW.w - 40);
      e.state = 'lurk';
      e.vx = this.rng.sign() * this.rng.range(4, 14);
      e.vy = this.rng.range(-8, 8);
      e.facing = e.x < VIEW.w / 2 ? 1 : -1;
    }
    this.entities.push(e);
  }

  _spawnCollectible() {
    const z = this.zone();
    const type = this._weighted(z.collectWeights);
    if (type === 'bubble') {
      this.entities.push({
        type: 'bubble',
        x: this.rng.range(30, VIEW.w - 30),
        y: VIEW.h + 30,
        vx: this.rng.range(-14, 14),
        vy: -PICKUP.bubble.rise,
        r: PICKUP.bubble.radius * this.rng.range(0.8, 1.3),
        phase: this.rng.range(0, Math.PI * 2),
      });
      return;
    }
    const cx = this.rng.range(50, VIEW.w - 50);
    const cy = VIEW.h + 40;
    const n = this.rng.int(3, 5);
    for (let i = 0; i < n; i++) {
      this.entities.push({
        type: 'plankton',
        x: cx + this.rng.range(-28, 28),
        y: cy + this.rng.range(-16, 16),
        vx: this.rng.range(-8, 8),
        vy: this.rng.range(-4, 6),
        r: PICKUP.plankton.radius * this.rng.range(0.8, 1.3),
        phase: this.rng.range(0, Math.PI * 2),
      });
    }
  }

  _spawn(dt) {
    const z = this.zone();
    this.hazardTimer -= dt * z.spawnMult;
    if (this.hazardTimer <= 0) {
      this._spawnHazard();
      this.hazardTimer = z.hazardInterval * this.rng.range(0.7, 1.3);
    }
    this.collectTimer -= dt * z.spawnMult;
    if (this.collectTimer <= 0) {
      this._spawnCollectible();
      this.collectTimer = z.collectInterval * this.rng.range(0.7, 1.3);
    }
  }

  _movePlayer(dt, input) {
    const p = this.player;
    const ax = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const ay = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    p.vx = ax * PLAYER.speedX;
    p.vy = ay * PLAYER.speedY;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const m = PLAYER.radius + 6;
    if (p.x < m) p.x = m; else if (p.x > VIEW.w - m) p.x = VIEW.w - m;
    if (p.y < PLAYER.yMin) p.y = PLAYER.yMin; else if (p.y > PLAYER.yMax) p.y = PLAYER.yMax;
    if (p.invuln > 0) p.invuln -= dt;
  }

  _moveEntities(dt, scroll) {
    for (const e of this.entities) {
      if (e.type === 'angler' && e.state === 'lurk') {
        const dx = this.player.x - e.x;
        const dy = this.player.y - e.y;
        if (dx * dx + dy * dy < HAZARD.angler.trigger * HAZARD.angler.trigger && this.player.y < e.y) {
          const d = Math.hypot(dx, dy) || 1;
          e.state = 'charge';
          e.vx = (dx / d) * HAZARD.angler.chargeSpeed * 0.7;
          e.vy = -HAZARD.angler.chargeSpeed;
          e.facing = dx >= 0 ? 1 : -1;
        }
      }
      e.x += e.vx * dt;
      e.y += (e.vy - scroll) * dt;
      if (e.type === 'rock') e.rot += e.spin * dt;
    }
  }

  _collide(events) {
    const p = this.player;
    const pr = PLAYER.radius;
    this.entities = this.entities.filter((e) => {
      const er = e.r ?? 10;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const rr = pr + er;
      if (dx * dx + dy * dy > rr * rr) return true;

      if (e.type === 'plankton') {
        this.plankton += 1;
        events.push({ type: 'collect', kind: 'plankton' });
        return false;
      }
      if (e.type === 'bubble') {
        if (this.hull < PLAYER.maxHull) {
          this.hull += 1;
          events.push({ type: 'collect', kind: 'bubble', heal: true });
        } else {
          this.plankton += 2;
          events.push({ type: 'collect', kind: 'bubble', heal: false });
        }
        return false;
      }
      if (p.invuln > 0) return true;
      this.hull -= 1;
      p.invuln = PLAYER.invuln;
      events.push({ type: 'hit', hazard: e.type });
      if (this.hull <= 0) {
        this.hull = 0;
        this.alive = false;
        events.push({ type: 'died' });
      }
      return false;
    });
  }

  _cull() {
    this.entities = this.entities.filter(
      (e) => e.y > -80 && e.y < VIEW.h + 120 && e.x > -60 && e.x < VIEW.w + 60,
    );
  }

  _moveParticles(dt, scroll) {
    for (const p of this.particles) {
      p.y += (p.drift - scroll * p.scale) * dt;
      p.x += p.drift * 0.3 * dt;
      if (p.y < -4) { p.y = VIEW.h + 4; p.x = this.rng.range(0, VIEW.w); }
      if (p.y > VIEW.h + 4) { p.y = -4; p.x = this.rng.range(0, VIEW.w); }
      if (p.x < -4) p.x = VIEW.w + 4; else if (p.x > VIEW.w + 4) p.x = -4;
    }
  }

  // Advance one fixed step and return the events emitted this step.
  update(dt, input) {
    const events = [];
    if (!this.alive) return events;
    this.time += dt;

    this.depth += depthRateAt(this.depth) * dt;
    const scroll = this.scrollPxPerSec();

    const zi = this.zoneIndex();
    if (zi !== this.lastZone) {
      this.lastZone = zi;
      events.push({ type: 'zone', index: zi, name: this.zone().name });
    }

    this._movePlayer(dt, input);
    this._spawn(dt);
    this._moveEntities(dt, scroll);
    this._collide(events);
    if (!this.alive) return events;
    this._cull();
    this._moveParticles(dt, scroll);
    return events;
  }

  // Force the run to end (used by the screenshot autopilot to guarantee a game-over frame).
  sink() {
    if (!this.alive) return;
    this.alive = false;
    this.hull = 0;
  }
}
