// GTX 328 audio output (IM 5.2.2): tones and the voice messages "Leaving Altitude" and "Timer Expired",
// male or female voice, at the configured volume. The continuous tone (AUDIO MODE message 0) and the
// tone frequency come from the Maintenance Manual audio test (Table 5-2: 490 Hz).
const TONE_HZ = 490;
const ATTENTION_S = 0.4;          // attention tone length (not stated)
const MASTER = 0.3;

export function createSound(xpdr, { toggle, base }) {
  let ctx = null, out = null, toneGain = null, beepGain = null, enabled = toggle.checked, lastSeq = xpdr.alertSeq;
  const buffers = {};
  const clipUrl = (voice, id) => new URL(`${voice.toLowerCase()}-${id}.mp3`, base).href;
  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    out = ctx.createGain(); out.gain.value = MASTER; out.connect(ctx.destination);
    const osc = ctx.createOscillator(); osc.frequency.value = TONE_HZ; osc.type = 'sine';
    toneGain = ctx.createGain(); toneGain.gain.value = 0;      // continuous tone
    beepGain = ctx.createGain(); beepGain.gain.value = 0;      // attention / alert tone
    osc.connect(toneGain).connect(out); osc.connect(beepGain).connect(out); osc.start();
  }
  async function clip(voice, id) {
    const k = voice + id;
    if (!(k in buffers)) {
      buffers[k] = fetch(clipUrl(voice, id)).then(r => (r.ok ? r.arrayBuffer() : null)).then(ab => ab && ctx.decodeAudioData(ab)).catch(() => null);
    }
    return buffers[k];
  }
  async function play(a) {
    const vol = a.volume / 100, t = ctx.currentTime + 0.02;
    // a tone; voice messages are preceded by the attention tone (IM 5.2.2 message 1)
    beepGain.gain.setValueAtTime(vol, t); beepGain.gain.setValueAtTime(0, t + ATTENTION_S);
    if (a.type !== 'msg') return;
    const b = await clip(a.voice, a.id);
    if (!b) return;                     // voice file not installed: the tone only
    const src = ctx.createBufferSource(), g = ctx.createGain();
    g.gain.value = vol; src.buffer = b; src.connect(g).connect(out);
    src.start(Math.max(ctx.currentTime, t + ATTENTION_S + 0.1));
  }
  const gesture = () => { if (enabled && !ctx) init(); if (ctx && ctx.state !== 'running') ctx.resume(); };
  ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, gesture, { capture: true }));
  toggle.onchange = e => { enabled = e.target.checked; if (enabled) gesture(); else if (ctx) { toneGain.gain.value = 0; ctx.suspend(); } };
  return {
    update() {
      if (!enabled || !ctx) { lastSeq = xpdr.alertSeq; return; }
      const now = ctx.currentTime;
      // continuous tone: AUDIO MODE message 0 test
      if (xpdr.toneOn && xpdr.power) toneGain.gain.setTargetAtTime(xpdr.c.volume / 100, now, 0.01);
      else toneGain.gain.setTargetAtTime(0, now, 0.01);
      if (xpdr.alertSeq !== lastSeq) {
        lastSeq = xpdr.alertSeq;
        if (xpdr.power && xpdr.alert) play(xpdr.alert);
      }
    },
  };
}
