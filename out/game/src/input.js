// Keyboard handling: tracks held directions and edge-triggered actions (dive, pause),
// plus a "tab blurred" signal so the caller can auto-pause.

export function createInput() {
  const held = { left: false, right: false, up: false, down: false };
  let pressedSpace = false;
  let pressedPause = false;
  let blurred = false;

  function keyOf(e) {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') return 'left';
    if (k === 'ArrowRight' || k === 'd' || k === 'D') return 'right';
    if (k === 'ArrowUp' || k === 'w' || k === 'W') return 'up';
    if (k === 'ArrowDown' || k === 's' || k === 'S') return 'down';
    if (e.code === 'Space' || k === ' ') return 'space';
    if (k === 'p' || k === 'P' || k === 'Escape') return 'pause';
    return null;
  }

  function onKeyDown(e) {
    const key = keyOf(e);
    if (!key) return;
    if (key === 'space') { if (!e.repeat) pressedSpace = true; e.preventDefault(); return; }
    if (key === 'pause') { if (!e.repeat) pressedPause = true; return; }
    held[key] = true;
    e.preventDefault();
  }
  function onKeyUp(e) {
    const key = keyOf(e);
    if (!key || key === 'space' || key === 'pause') return;
    held[key] = false;
  }
  function onBlur() { blurred = true; }
  function onVisibility() { if (document.hidden) blurred = true; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    held,
    consumePressed() {
      const s = pressedSpace, p = pressedPause;
      pressedSpace = false; pressedPause = false;
      return { space: s, pause: p };
    },
    consumeBlur() {
      const b = blurred; blurred = false; return b;
    },
  };
}
