// Bezel controls: knob drag / wheel, bezel keys, hold buttons, keyboard.
// Config-driven so another bezel (e.g. GNC 255 with a second knob) can reuse it.

const TUNE_STEP_DEG = 4;              // visual rotation per click of an endless encoder
const DRAG_STEP_PX = 12, DRAG_START_PX = 4;
const WHEEL_STEP = 50;

/**
 * @param radio  ComRadio
 * @param after  called after every input (re-render)
 * @param cfg {
 *   encoders: { outer: el, inner: el },     endless rotary encoders (event name = key)
 *   innerPush: 'push',                       event when the inner knob is clicked
 *   vol: { el, angle: radio => deg },        COM volume pot with end stops (angle from state);
 *                                            click = PUSH SQ, hold without dragging = 121.5
 *   pots: [{ el, evt, pushDown, pushUp, angle }]  further pots (e.g. GNC NAV VOL / PUSH ID)
 *   keys: NodeList of [data-key] buttons,
 *   holds: [[el, downEvt, upEvt]],
 *   keyboard: { keys: {code: evt}, holds: {code: [down, up]}, turns: {code: [knob, dir]}, presses: {code: [evt…]} }
 * }
 */
export function bindControls(radio, after, cfg) {
  const send = (evt, arg) => { radio.input(evt, arg); after(); };
  const angles = {};
  const rotate = (knob, dir) => {
    const el = cfg.encoders[knob];
    if (!el) return;
    angles[knob] = (angles[knob] || 0) + dir * TUNE_STEP_DEG;
    el.querySelector('.grip').style.transform = `rotate(${angles[knob]}deg)`;
  };
  const potEvts = new Set(['vol', ...(cfg.pots || []).map(p => p.evt)]);
  const turn = (knob, dir) => {
    if (potEvts.has(knob)) { send(knob, dir); return; }
    rotate(knob, dir);
    send(knob, dir);
  };

  function wheelHandler(knob) {
    let acc = 0;
    return e => {
      e.preventDefault(); e.stopPropagation();
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      if (Math.abs(dy) >= WHEEL_STEP) { turn(knob, dy < 0 ? 1 : -1); acc = 0; return; }
      acc += dy;
      while (Math.abs(acc) >= WHEEL_STEP) { const d = acc < 0 ? 1 : -1; turn(knob, d); acc += d * WHEEL_STEP; }
    };
  }

  // Knob drag: press and drag up (clockwise) / down (counter-clockwise).
  // A press without movement is a click.
  function dragKnob(el, knob, { onPress, onClick, onDragStart } = {}) {
    let st = null;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      st = { y: e.clientY, last: e.clientY, dragging: false };
      el.classList.add('down');
      onPress?.();
    });
    el.addEventListener('pointermove', e => {
      if (!st) return;
      if (!st.dragging && Math.abs(e.clientY - st.y) >= DRAG_START_PX) {
        st.dragging = true;
        el.classList.add('dragging');
        onDragStart?.();
      }
      if (!st.dragging) return;
      while (Math.abs(e.clientY - st.last) >= DRAG_STEP_PX) {
        const dir = e.clientY < st.last ? 1 : -1;
        st.last -= dir * DRAG_STEP_PX;
        turn(knob, dir);
      }
    });
    const end = e => {
      if (!st) return;
      e.stopPropagation();
      const wasDrag = st.dragging;
      st = null;
      el.classList.remove('down', 'dragging');
      if (!wasDrag) onClick?.();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  // COM volume pot (radios only): click = PUSH SQ, hold 2 s without dragging = 121.5
  const vol = cfg.vol;
  let volGrip = null;
  if (vol) {
    vol.el.addEventListener('wheel', wheelHandler('vol'), { passive: false });
    dragKnob(vol.el, 'vol', {
      onPress: () => send('sqDown'),
      onDragStart: () => { radio.hold.sq = null; },
      onClick: () => send('sqUp'),
    });
    volGrip = vol.el.querySelector('.grip');
  }
  for (const pot of cfg.pots || []) {
    pot.el.addEventListener('wheel', wheelHandler(pot.evt), { passive: false });
    dragKnob(pot.el, pot.evt, {
      onPress: () => pot.pushDown && send(pot.pushDown),
      onClick: () => pot.pushUp && send(pot.pushUp),
    });
    pot.grip = pot.el.querySelector('.grip');
  }

  // encoders; the inner knob sits inside the outer one (a single knob has only `inner`)
  const { outer, inner } = cfg.encoders;
  inner.addEventListener('wheel', wheelHandler('inner'), { passive: false });
  dragKnob(inner, 'inner', { onClick: () => cfg.innerPush && send(cfg.innerPush) });
  if (outer) {
    const outerWheel = wheelHandler('outer');
    outer.addEventListener('wheel', e => { if (!inner.contains(e.target)) outerWheel(e); }, { passive: false });
    dragKnob(outer, 'outer');
  }

  cfg.keys.forEach(b => b.addEventListener('click', () => send(b.dataset.key)));

  for (const [el, down, up] of cfg.holds || []) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('down'); send(down); });
    const rel = () => { if (el.classList.contains('down')) { el.classList.remove('down'); send(up); } };
    el.addEventListener('pointerup', rel);
    el.addEventListener('pointercancel', rel);
  }

  // keyboard, matched on e.code (physical key) so it works with any layout
  const kb = cfg.keyboard;
  if (kb) {
    const held = new Set();
    document.addEventListener('keydown', e => {
      if (e.target.closest?.('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.code;
      let handled = true;
      if (kb.holds[k]) { if (!held.has(k)) { held.add(k); send(kb.holds[k][0]); } }
      else if (kb.turns[k]) turn(...kb.turns[k]);
      else if (e.repeat) handled = !!(kb.keys[k] || kb.presses[k]);
      else if (kb.keys[k]) send(kb.keys[k]);
      else if (kb.presses[k]) kb.presses[k].forEach(ev => send(ev));
      else handled = false;
      if (handled) e.preventDefault();
    });
    document.addEventListener('keyup', e => {
      const k = e.code;
      if (kb.holds[k] && held.has(k)) { held.delete(k); send(kb.holds[k][1]); }
    });
    window.addEventListener('blur', () => { for (const k of held) send(kb.holds[k][1]); held.clear(); });
  }

  return {
    send, turn,
    // the volume pot's angle follows the radio state (end stops)
    renderKnobs() {
      if (volGrip) volGrip.style.transform = `rotate(${vol.angle(radio)}deg)`;
      for (const pot of cfg.pots || []) pot.grip.style.transform = `rotate(${pot.angle(radio)}deg)`;
    },
  };
}

// Scale a fixed-size bezel to its container's width.
// Grows with the column, but never taller than maxViewport of the window height.
export function fitBezel(bezel, wrap, { width, height, maxScale = 1.25, maxViewport = 0.55 }) {
  const fit = () => {
    const s = Math.min(maxScale, wrap.clientWidth / (width + 6), window.innerHeight * maxViewport / (height + 6));
    bezel.style.transform = `scale(${s})`;
    wrap.style.height = `${(height + 6) * s}px`;
  };
  new ResizeObserver(fit).observe(wrap);
  window.addEventListener('resize', fit);
  fit();
}
