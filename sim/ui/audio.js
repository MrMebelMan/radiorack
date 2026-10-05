// Sound: static (squelch override, keyed mic, under incoming calls) and the
// recorded incoming-call clips. Follows radio.audio(); silent without power.
const MASTER_GAIN = 0.3; // overall loudness of all sound effects

// NAV ident: Morse code at 1020 Hz, repeated while the station is received and ID is on
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};
const MORSE_UNIT = 0.12;      // seconds per dot (about 10 words per minute)
const MORSE_REPEAT = 8;       // seconds between idents
// schedule one ident on gain g from time t; returns its end time
function scheduleMorse(g, ident, t, level) {
  for (const ch of ident) {
    for (const sym of MORSE[ch] || '') {
      const len = (sym === '-' ? 3 : 1) * MORSE_UNIT;
      g.setValueAtTime(level, t);
      g.setValueAtTime(0, t + len);
      t += len + MORSE_UNIT;
    }
    t += 2 * MORSE_UNIT;
  }
  return t;
}

/**
 * @param radio  ComRadio
 * @param clips  [{ url, ms }]   recorded calls (ms = fallback length until decoded)
 * @param clipFor { act: index, stb: index }
 * @param toggle  checkbox element enabling the sound
 */
export function createAudio(radio, { clips, clipFor, toggle }) {
  const clipData = clips.map(c => fetch(c.url).then(r => r.arrayBuffer()).catch(() => null));
  const clipDurMs = clips.map(c => c.ms);

  const audio = {
    ctx: null, gain: null, filt: null, clipGain: null, buffers: [], playing: null, enabled: false, prev: 'off',
    init() {
      const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const out = ctx.createGain(); out.gain.value = MASTER_GAIN; out.connect(ctx.destination);
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
      // static: squelch override and keyed mic
      const filt = this.filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 1800; filt.Q.value = 0.6;
      this.gain = ctx.createGain(); this.gain.gain.value = 0;
      noise.connect(filt).connect(this.gain).connect(out);
      noise.start();
    // NAV Morse ident tone
    const tone = ctx.createOscillator(); tone.type = 'sine'; tone.frequency.value = 1020;
    this.morseGain = ctx.createGain(); this.morseGain.gain.value = 0;
    tone.connect(this.morseGain).connect(out);
    tone.start();
    this.morseNext = 0;
      // recorded incoming transmissions
      this.clipGain = ctx.createGain(); this.clipGain.gain.value = 0;
      // signal quality (units that report one): weak signals sound band-limited and muffled
      this.clipHp = ctx.createBiquadFilter(); this.clipHp.type = 'highpass'; this.clipHp.frequency.value = 80;
      this.clipLp = ctx.createBiquadFilter(); this.clipLp.type = 'lowpass'; this.clipLp.frequency.value = 9000;
      this.clipGain.connect(this.clipHp).connect(this.clipLp).connect(out);
      clipData.forEach((p, i) => p.then(ab => ab && ctx.decodeAudioData(ab.slice(0))).then(b => {
        if (!b) return;
        this.buffers[i] = b;
        clipDurMs[i] = Math.round(b.duration * 1000);
      }).catch(() => {}));
    },
    startClip(rx) {
      this.stopClip();
      const b = this.buffers[rx.clip];
      if (!b) return;
      const offset = Math.max(0, (radio.now() - rx.start) / 1000);
      if (offset >= b.duration) return;
      const src = this.ctx.createBufferSource();
      src.buffer = b;
      src.connect(this.clipGain);
      src.start(0, offset);
      this.playing = { src, rx };
    },
    stopClip() {
      if (!this.playing) return;
      try { this.playing.src.stop(); } catch { /* already stopped */ }
      this.playing = null;
    },
    silence() {
      this.stopClip();
      const t = this.ctx.currentTime;
      for (const g of [this.gain.gain, this.clipGain.gain, this.morseGain.gain]) { g.cancelScheduledValues(t); g.setValueAtTime(0, t); }
      this.morseNext = 0;
    },
    update() {
      if (!this.enabled || !this.ctx) return;
      const a = radio.audio();
      const prev = this.prev;
      this.prev = a.src;
      if (a.src === 'off') {
        // no power: hard silence, and stop the audio engine
        if (prev !== 'off') { this.silence(); this.ctx.suspend(); }
        return;
      }
      if (prev === 'off' && this.ctx.state !== 'running') this.ctx.resume();
      const vol = (radio.s.vol ?? 100) / 100;
      const now = this.ctx.currentTime;
      const hearingRx = a.src === 'act' || a.src === 'stb';

      // incoming transmission: play the clip while it is audible
      if (hearingRx) {
        if (!this.playing || this.playing.rx !== a.call) this.startClip(a.call);
      } else {
        this.stopClip();
      }
      // reception quality: strong = clean; good = a little muffled and noisier;
      // poor = narrow band, heavy static and a level that fades in and out
      const qual = hearingRx ? a.quality : undefined;
      const lp = qual === 'poor' ? 2200 : qual === 'good' ? 3800 : 9000, hp = qual === 'poor' ? 550 : qual === 'good' ? 250 : 80;
      this.clipLp.frequency.setTargetAtTime(lp, now, 0.05);
      this.clipHp.frequency.setTargetAtTime(hp, now, 0.05);
      // poor: the voice breaks up in short drop-outs (noise surges in the gaps); good: slight fading
      if (qual === 'poor') {
        if (now >= (this.dropUntil || 0) && Math.random() < 0.14) this.dropUntil = now + 0.08 + Math.random() * 0.25;
      } else this.dropUntil = 0;
      this.dropping = qual === 'poor' && now < this.dropUntil;
      const fade = this.dropping ? 0.03 : qual === 'poor' ? 0.45 + 0.45 * Math.random() : qual === 'good' ? 0.85 + 0.15 * Math.random() : 1;
      this.clipGain.gain.setTargetAtTime(vol * fade, now, this.dropping ? 0.01 : qual === 'poor' ? 0.05 : 0.02);

      // altitude monitor alert (TT31): two short beeps per second while active
    if (radio.alertAudio?.()) {
      if (now >= (this.alertNext || 0)) {
        const g = this.morseGain.gain, t = now + 0.02;
        for (const k of [0, 0.25]) { g.setValueAtTime(0.2, t + k); g.setValueAtTime(0, t + k + 0.12); }
        this.alertNext = now + 1;
      }
    } else this.alertNext = 0;

    // short beep (AR6201 scan / frequency change beep): one per count step
    const beeps = radio.beepAudio?.();
    if (beeps !== undefined) {
      if (this.beeps !== undefined && beeps > this.beeps) {
        const g = this.morseGain.gain, t = now + 0.02;
        g.setValueAtTime(0.2, t); g.setValueAtTime(0, t + 0.08);
      }
      this.beeps = beeps;
    }

    // NAV ident (NAV/COM units only)
    const nav = radio.navAudio?.();
    if (nav) {
      if (now >= this.morseNext) this.morseNext = scheduleMorse(this.morseGain.gain, nav.ident, now + 0.05, 0.25 * nav.vol / 100) + MORSE_REPEAT;
    } else if (this.morseNext) {
      this.morseGain.gain.cancelScheduledValues(now);
      this.morseGain.gain.setValueAtTime(0, now);
      this.morseNext = 0;
    }

    // static levels / colour per source (tune here)
      let n = 0, fc = 1800, q = 0.6;
      if (a.src === 'static') n = 0.12 * vol;                  // squelch override
      if (hearingRx) n = (a.quality === 'poor' ? (this.dropping ? 0.5 : 0.3) : a.quality === 'good' ? 0.18 : 0.12) * vol;   // background under incoming calls
      if (a.src === 'tx') { n = 0.2 * vol; fc = 3500; q = 0.4; } // own PTT: louder, crisper
      this.filt.frequency.setValueAtTime(fc, now);
      this.filt.Q.setValueAtTime(q, now);
      if (a.src !== prev) {
        // source changed (e.g. PTT pressed / released): switch level immediately
        // (5 ms ramp only to avoid a click)
        const g = this.gain.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(n, now + 0.005);
      } else {
        this.gain.gain.setTargetAtTime(n, now, 0.03);
      }
    },
  };

  // Sound is on by default; browsers only allow audio after a user gesture,
  // so the engine starts on the first click / key press on the page.
  audio.enabled = toggle.checked;
  const startOnGesture = () => {
    if (audio.enabled && !audio.ctx) audio.init();
    if (audio.ctx && audio.enabled && audio.ctx.state !== 'running' && radio.power) audio.ctx.resume();
  };
  ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, startOnGesture, { capture: true }));
  toggle.onchange = e => {
    audio.enabled = e.target.checked;
    if (audio.enabled && !audio.ctx) audio.init();
    if (audio.ctx) {
      audio.prev = 'off';
      if (audio.enabled) audio.ctx.resume(); else { audio.silence(); audio.ctx.suspend(); }
    }
  };
  // start a simulated incoming call on 'act' / 'stb' with its clip
  audio.incomingCall = which => {
    const clip = clipFor[which];
    radio.simulateRx(which, clipDurMs[clip], clip);
  };
  return audio;
}
