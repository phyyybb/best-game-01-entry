// Synthesized WebAudio: soft bubble pops, a low thud on hits, and a deep ambient drone.
// No audio files — everything is generated. Every entry point no-ops when AudioContext
// is unavailable, so the game still runs without sound.

export function createAudio() {
  let ctx = null;
  let master = null;
  let drone = null;

  function ensure() {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // Audio may not start until a user gesture; unlock on the first one.
  if (typeof window !== 'undefined') {
    const onGesture = () => {
      ensure();
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
  }

  const now = () => (ctx ? ctx.currentTime : 0);

  function blip(f0, f1, dur, gain, type = 'sine') {
    if (!ctx) return;
    const t = now();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function bubble() { blip(420, 980, 0.09, 0.12); }
  function healBubble() {
    blip(300, 720, 0.12, 0.14);
    setTimeout(() => blip(360, 880, 0.1, 0.1), 60);
  }
  function hit() {
    blip(120, 42, 0.32, 0.5, 'triangle');
    blip(65, 38, 0.4, 0.35, 'sine');
  }
  function zoneChime() {
    blip(520, 760, 0.18, 0.1);
    setTimeout(() => blip(660, 990, 0.22, 0.1), 90);
  }

  function startDrone() {
    if (!ensure()) return;
    if (drone) return;
    const t = now();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 420; filter.Q.value = 0.7;

    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 48;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 96.7;
    const o2g = ctx.createGain(); o2g.gain.value = 0.35;

    const trem = ctx.createGain(); trem.gain.value = 0.55;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.08;
    const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.35;
    lfo.connect(lfoDepth); lfoDepth.connect(trem.gain);

    const fade = ctx.createGain();
    fade.gain.setValueAtTime(0.0001, t);
    fade.gain.exponentialRampToValueAtTime(0.06, t + 1.5);

    o1.connect(filter); o2.connect(o2g); o2g.connect(filter);
    filter.connect(trem); trem.connect(fade); fade.connect(master);

    o1.start(t); o2.start(t); lfo.start(t);
    drone = { fade, filter, oscs: [o1, o2, lfo] };
  }

  function stopDrone() {
    if (!ctx || !drone) return;
    const t = now();
    const { fade, oscs } = drone; drone = null;
    fade.gain.cancelScheduledValues(t);
    fade.gain.setValueAtTime(Math.max(0.0001, fade.gain.value), t);
    fade.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    const stopAt = t + 0.55;
    for (const o of oscs) o.stop(stopAt);
  }

  function setDroneDepth(depth) {
    if (!ctx || !drone) return;
    const f = Math.max(70, 420 - depth * 0.3);
    drone.filter.frequency.setTargetAtTime(f, now(), 0.4);
  }

  return {
    unlock: ensure, bubble, healBubble, hit, zoneChime,
    startDrone, stopDrone, setDroneDepth,
  };
}
