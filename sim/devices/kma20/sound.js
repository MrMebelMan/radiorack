// KMA 20 audio: every receiver input is a source (COM calls, NAV / ADF / DME Morse idents, marker
// tones) feeding two buses as the toggles route it: the speaker (through the isolation amplifier,
// muted while the mic is keyed, moved to the ramp hail speaker on EXT) and the phones (bypass).
// What reaches the listener depends on the headset: phones in the ears and the cockpit speaker
// muffled through the ear cups, or the speaker alone.
import { scheduleMorse } from '../../ui/audio.js';
import { KMA20, MARKER, RECEIVERS } from './device.js';

const MASTER = 0.3;
const IDENT_REPEAT = { NAV1: 8, NAV2: 8, ADF: 8, DME: 30 };   // seconds between idents (DME about every 30 s, ICAO)
const LEVEL = { COM: 1, ident: 0.25, marker: 0.25, sidetone: 0.2 };   // sidetone as the GTR / GNC PTT static
const THROUGH_HEADSET = 0.3;                                  // speaker heard through the headset (not from the manuals)

export function createSound(kma, { toggle, clips }) {
  let ctx = null, enabled = toggle.checked;
  const src = {}, buffers = [];
  let spk, phone, spkOut, phoneOut, playing = {}, morse = {}, mkSched = 0, mkType = null;

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const out = ctx.createGain(); out.gain.value = MASTER; out.connect(ctx.destination);
    spk = ctx.createGain(); phone = ctx.createGain();
    // the cockpit speaker heard through the headset: quieter and muffled
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    spkOut = ctx.createGain(); phoneOut = ctx.createGain();
    spk.connect(lp).connect(spkOut).connect(out);
    phone.connect(phoneOut).connect(out);
    for (const k of RECEIVERS) {
      const input = ctx.createGain(), toSpk = ctx.createGain(), toPhone = ctx.createGain();
      toSpk.gain.value = toPhone.gain.value = 0;
      input.connect(toSpk).connect(spk); input.connect(toPhone).connect(phone);
      src[k] = { input, toSpk, toPhone };
    }
    // Morse idents: a tone per input, keyed by its own gain
    for (const k of ['NAV1', 'NAV2', 'ADF', 'DME']) {
      const osc = ctx.createOscillator(), key = ctx.createGain();
      key.gain.value = 0; osc.connect(key).connect(src[k].input); osc.start();
      src[k].osc = osc; src[k].key = key;
    }
    // transceiver sidetone while keyed: the static the GTR / GNC play on PTT
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    for (const c of ['COM1', 'COM2']) {
      const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      n.buffer = noise; n.loop = true; bp.type = 'bandpass'; bp.frequency.value = 3500; bp.Q.value = 0.4; g.gain.value = 0;
      n.connect(bp).connect(g).connect(src[c].input); n.start();
      src[c].side = g;
    }
    // marker tones
    src.MKR.tones = {};
    for (const [type, m] of Object.entries(MARKER)) {
      const osc = ctx.createOscillator(), key = ctx.createGain();
      osc.frequency.value = m.hz; key.gain.value = 0; osc.connect(key).connect(src.MKR.input); osc.start();
      src.MKR.tones[type] = key;
    }
    clips.forEach((url, i) => fetch(url).then(r => r.arrayBuffer()).then(ab => ctx.decodeAudioData(ab)).then(b => { buffers[i] = b; }).catch(() => {}));
  }

  const set = (p, v, now) => p.setTargetAtTime(v, now, 0.01);

  function stopAll() {
    for (const k of Object.keys(playing)) { try { playing[k].node.stop(); } catch { /* stopped */ } }
    playing = {};
    const now = ctx.currentTime;
    for (const c of ['COM1', 'COM2']) { src[c].side.gain.cancelScheduledValues(now); src[c].side.gain.setValueAtTime(0, now); }
    for (const k of ['NAV1', 'NAV2', 'ADF', 'DME']) { src[k].key.gain.cancelScheduledValues(now); src[k].key.gain.setValueAtTime(0, now); }
    for (const g of Object.values(src.MKR.tones)) { g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(0, now); }
    morse = {}; mkSched = 0; mkType = null;
  }

  function update() {
    if (!enabled || !ctx) return;
    const m = kma.mix(), now = ctx.currentTime;
    if (!m.power) { set(spk.gain, 0, now); set(phone.gain, 0, now); stopAll(); return; }
    // listener: headset on = phones plus the muffled speaker; off = the speaker alone
    set(phoneOut.gain, m.headset ? 1 : 0, now);
    set(spkOut.gain, m.headset ? THROUGH_HEADSET : 1, now);
    // speaker: muted while the mic is keyed (IM 1.2 input muting), silent in the cockpit on EXT
    set(spk.gain, m.muted || m.ext ? 0 : 1, now);
    set(phone.gain, 1, now);
    for (const k of RECEIVERS) {
      set(src[k].toSpk.gain, m.speaker.includes(k) ? 1 : 0, now);
      set(src[k].toPhone.gain, m.phone.includes(k) ? 1 : 0, now);
    }
    // COM: the recorded call while it lasts; the sidetone while transmitting
    for (const c of ['COM1', 'COM2']) {
      const side = src[c].side.gain;
      side.cancelScheduledValues(now); side.setValueAtTime(side.value, now);
      side.linearRampToValueAtTime(m.inputs[c]?.sidetone ? LEVEL.sidetone : 0, now + 0.005);
      const call = m.inputs[c]?.call;
      if (call && (!playing[c] || playing[c].call !== call)) {
        if (playing[c]) { try { playing[c].node.stop(); } catch { /* stopped */ } }
        const b = buffers[call.clip], offset = (kma.now() - call.start) / 1000;
        if (b && offset < b.duration) {
          const node = ctx.createBufferSource(), g = ctx.createGain();
          g.gain.value = LEVEL.COM; node.buffer = b; node.connect(g).connect(src[c].input); node.start(0, offset);
          playing[c] = { node, call };
        }
      } else if (!call && playing[c]) { try { playing[c].node.stop(); } catch { /* stopped */ } delete playing[c]; }
    }
    // idents: Morse repeated while the station is tuned
    for (const k of ['NAV1', 'NAV2', 'ADF', 'DME']) {
      const id = m.inputs[k], g = src[k].key.gain, st = morse[k];
      if (!id) { if (st) { g.cancelScheduledValues(now); g.setValueAtTime(0, now); delete morse[k]; } continue; }
      if (!st || st.ident !== id.ident) {
        g.cancelScheduledValues(now); g.setValueAtTime(0, now);
        src[k].osc.frequency.setValueAtTime(id.hz, now);
        morse[k] = { ident: id.ident, next: now + 0.3 + Math.random() * 2 };
      }
      if (now >= morse[k].next - 0.1) morse[k].next = scheduleMorse(g, id.ident, Math.max(now + 0.05, morse[k].next), LEVEL.ident) + IDENT_REPEAT[k];
    }
    // marker: the keying scheduled ahead on the unit's clock, so tone and lamp stay together
    const mk = m.inputs.MKR?.marker || null;
    if (mk !== mkType) {
      for (const g of Object.values(src.MKR.tones)) { g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(0, now); }
      mkType = mk; mkSched = now;
    }
    if (mk) {
      const g = src.MKR.tones[mk].gain, off = now - kma.now() / 1000, until = now + 0.3;
      for (let t = Math.max(mkSched, now); t < until; t += 0.005) {
        const on = KMA20.keyed(mk, (t - off) * 1000);
        g.setValueAtTime(on ? LEVEL.marker : 0, t);
      }
      mkSched = until;
    }
  }

  const gesture = () => { if (enabled && !ctx) init(); if (ctx && ctx.state !== 'running') ctx.resume(); };
  ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, gesture, { capture: true }));
  toggle.onchange = e => { enabled = e.target.checked; if (enabled) gesture(); else if (ctx) { stopAll(); ctx.suspend(); } };
  return { update, clipMs: i => (buffers[i] ? Math.round(buffers[i].duration * 1000) : [4640, 4000][i]) };
}
