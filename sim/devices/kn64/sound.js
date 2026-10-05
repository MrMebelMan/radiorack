// KN 64 audio output: the Morse identifier of the DME station while locked to it (PG "Operational
// Notes": "an audio output for use in identifying the DME ground station being received").
import { scheduleMorse } from '../../ui/audio.js';

const MASTER = 0.3;
const IDENT_HZ = 1350;       // DME identification tone (ICAO Annex 10; not in the KN 64 manuals)
const IDENT_REPEAT = 30;     // seconds between idents (ICAO: about every 30 s)
const LEVEL = 0.25;

export function createSound(kn, { toggle }) {
  let ctx = null, key = null, enabled = toggle.checked, cur = null, next = 0;

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const out = ctx.createGain(); out.gain.value = MASTER; out.connect(ctx.destination);
    const osc = ctx.createOscillator(); osc.frequency.value = IDENT_HZ;
    key = ctx.createGain(); key.gain.value = 0;
    osc.connect(key).connect(out); osc.start();
  }
  const silence = () => { if (!ctx) return; const now = ctx.currentTime; key.gain.cancelScheduledValues(now); key.gain.setValueAtTime(0, now); cur = null; };

  function update() {
    if (!enabled || !ctx) return;
    const id = kn.ident, now = ctx.currentTime;
    if (!id) { if (cur) silence(); return; }
    if (id !== cur) { silence(); cur = id; next = now + 0.5 + Math.random() * 3; }
    if (now >= next - 0.1) next = scheduleMorse(key.gain, id, Math.max(now + 0.05, next), LEVEL) + IDENT_REPEAT;
  }

  const gesture = () => { if (enabled && !ctx) init(); if (ctx && ctx.state !== 'running') ctx.resume(); };
  ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, gesture, { capture: true }));
  toggle.onchange = e => { enabled = e.target.checked; if (enabled) gesture(); else if (ctx) { silence(); ctx.suspend(); } };
  return { update };
}
