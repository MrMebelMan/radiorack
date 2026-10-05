import { Radio, MESSAGES, fmtFreq, fmtTime } from './radio.js';
import { POSITIONS } from './data.js';

let storage = null;
try { storage = window.localStorage; storage.getItem('x'); } catch { storage = null; }

const radio = new Radio({ storage });
const $ = id => document.getElementById(id);
const lcd = $('lcd');

// ---------- scaling the bezel to the available width ----------
const bezel = $('bezel'), wrap = $('bezelWrap');
function fit() {
  const s = Math.min(1.25, wrap.clientWidth / 886);
  bezel.style.transform = `scale(${s})`;
  wrap.style.height = `${216 * s}px`;
}
new ResizeObserver(fit).observe(wrap);

// ---------- rendering ----------
const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function seg(sg) {
  if (sg.bar !== undefined) return `<span class="bar"><i style="width:${sg.bar}%"></i></span>`;
  const cls = [sg.inv && 'inv', sg.ul && 'ul', sg.big && 'big', sg.small && 'small', sg.dim && 'dim', sg.box && 'boxed'].filter(Boolean).join(' ');
  const t = esc(sg.t).replace(/ /g, '&nbsp;');
  return cls ? `<span class="${cls}">${t}</span>` : t;
}
const segs = a => (a || []).map(seg).join('');

function wrapText(text, width) {
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

function lcdHtml(v) {
  if (v.off) return '';
  if (v.splash) {
    return `<div class="splash"><div class="logo">${v.splash[0]}</div><div>${esc(v.splash[1])}</div><div class="small">${esc(v.splash[2])}</div></div>`;
  }
  let h = `<div class="ann"><div class="top">${v.ann}</div><div>ACT</div></div>`;
  h += `<div class="act"><span class="big">${v.act}</span></div>`;
  const r = v.right;
  if (r.type === 'com') {
    h += `<div class="rcom"><div class="labs"><span>${r.com ? 'COM' : ''}</span><span>${r.label}</span></div><div>${r.big.map(x => seg({ ...x, big: true })).join('')}</div></div>`;
  } else if (r.type === 'page') {
    const cls = ['rpage', v.bottomFull ? 'short' : '', r.rows.length > 2 ? 'three' : ''].join(' ');
    h += `<div class="${cls}"><div class="title">${esc(r.title)}</div>${r.rows.map(row => `<div class="row">${segs(row)}</div>`).join('')}</div>`;
  } else if (r.type === 'msg') {
    h += `<div class="msg"><div class="title">${r.title}</div>${wrapText(r.text, 32).map(esc).join('<br>')}</div>`;
  }
  if (v.bottomFull) {
    h += `<div class="bfull">${segs(v.bottomFull)}</div>`;
  } else {
    h += `<div class="bl${v.promptWide ? ' wide' : ''}">${segs(v.bottomLeft)}</div>`;
    if (r.type === 'com') h += `<div class="br">${segs(v.bottomRight)}</div>`;
  }
  if (v.locked) h += `<div class="lockbadge">LOCK</div>`;
  return h;
}

let lastHtml = null;
function render() {
  radio.tick();
  const v = radio.view();
  const html = lcdHtml(v);
  if (html !== lastHtml) { lcd.innerHTML = html; lastHtml = html; }
  lcd.classList.toggle('off', !!v.off);
  const b = v.brt ?? 0, c = v.contrast ?? 0;
  lcd.style.filter = v.off ? '' : `brightness(${(0.75 + (b + 10) / 110 * 0.5).toFixed(2)}) contrast(${(1 + c / 100).toFixed(2)})`;
  renderStatus();
  renderVolKnob();
  audio.update();
}

function renderStatus() {
  const s = radio.s;
  $('hint').textContent = !radio.switchOn
    ? 'Radio is OFF. Turn the PWR/VOL knob clockwise (drag up or scroll up) to power on.'
    : !radio.bus ? (radio.power ? 'Aircraft power removed: unit shuts down in a few seconds unless power is restored.' : 'No aircraft power. Restore aircraft power to bring the radio back.')
    : radio.locked ? 'COM is locked to 121.5. Hold COM RMT XFR for 2 s to unlock.' : '';
  const a = radio.audio();
  const name = f => { const r = radio.reverse(f); return r ? ` (${r})` : ''; };
  const txt = {
    off: 'radio off',
    tx: `transmitting on ${fmtFreq(a.freq || 0)} (sidetone ${s.sidetone.mode === 'FIXED' ? 'fixed' : 'offset ' + s.sidetone.offset})`,
    act: `receiving on ACTIVE ${fmtFreq(a.freq || 0)}${name(a.freq)}`,
    stb: `receiving on STANDBY ${fmtFreq(a.freq || 0)}${name(a.freq)} (monitor)`,
    static: 'squelch open: background static',
    quiet: 'quiet (squelched)',
  }[a.src];
  const extra = radio.power ? ` · vol ${s.vol}% · speaker ${s.speaker ? 'on' : 'off'} · ICS ${s.ics.on ? 'on' : 'off'}${s.ics.mute && (a.src === 'act' || a.src === 'stb') ? ' (muted on RX)' : ''}${radio.stuck ? ' · STUCK MIC' : ''}` : '';
  $('hearing').textContent = txt + extra;
  $('usbSlot').classList.toggle('inserted', s.usb !== 'none');
  $('busBtn').textContent = radio.bus ? 'Remove aircraft power' : 'Restore aircraft power';
  $('xfr').classList.toggle('down', !!radio.hold.xfr);
  $('ptt').classList.toggle('down', radio.tx);
}

setInterval(render, 50);

// ---------- input helpers ----------
// TUNE knobs are endless encoders; the volume pot has end stops (see renderVolKnob).
const TUNE_STEP_DEG = 4;
const angles = { outer: 0, inner: 0 };
function rotate(knob, dir) {
  angles[knob] += dir * TUNE_STEP_DEG;
  const el = knob === 'outer' ? $('tuneOuter') : $('tuneInner');
  el.querySelector('.grip').style.transform = `rotate(${angles[knob]}deg)`;
}
const volGrip = $('volKnob').querySelector('.grip');
function renderVolKnob() {
  const deg = radio.switchOn ? -135 + radio.s.vol / 100 * 270 : -150;
  volGrip.style.transform = `rotate(${deg}deg)`;
}
function send(evt, arg) { radio.input(evt, arg); render(); }
function turn(knob, dir) {
  if (knob === 'vol') { send('vol', dir); return; }
  rotate(knob, dir);
  send(knob, dir);
}

function wheelHandler(knob) {
  let acc = 0;
  return e => {
    e.preventDefault(); e.stopPropagation();
    const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    if (Math.abs(dy) >= 50) { turn(knob, dy < 0 ? 1 : -1); acc = 0; return; }
    acc += dy;
    while (Math.abs(acc) >= 50) { const d = acc < 0 ? 1 : -1; turn(knob, d); acc += d * 50; }
  };
}

$('volKnob').addEventListener('wheel', wheelHandler('vol'), { passive: false });
$('tuneInner').addEventListener('wheel', wheelHandler('inner'), { passive: false });
const outerWheel = wheelHandler('outer');
$('tuneOuter').addEventListener('wheel', e => { if (!e.target.closest('#tuneInner')) outerWheel(e); }, { passive: false });

// Knob drag: press and drag up (clockwise) / down (counter-clockwise).
// A press without movement is a click: PUSH SQ on the volume knob, PUSH CRSR on the inner knob.
const DRAG_STEP_PX = 12, DRAG_START_PX = 4;
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

dragKnob($('volKnob'), 'vol', {
  onPress: () => send('sqDown'),           // hold 2 s without dragging = 121.5
  onDragStart: () => { radio.hold.sq = null; },
  onClick: () => send('sqUp'),
});
dragKnob($('tuneInner'), 'inner', { onClick: () => send('push') });
dragKnob($('tuneOuter'), 'outer');

// bezel keys
document.querySelectorAll('.key[data-key]').forEach(b => b.addEventListener('click', () => send(b.dataset.key)));

function holdButton(el, down, up) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('down'); send(down); });
  const rel = () => { if (el.classList.contains('down')) { el.classList.remove('down'); send(up); } };
  el.addEventListener('pointerup', rel);
  el.addEventListener('pointercancel', rel);
}
holdButton($('flip'), 'flipDown', 'flipUp');
holdButton($('ptt'), 'pttDown', 'pttUp');
holdButton($('xfr'), 'xfrDown', 'xfrUp');

// ---------- simulation panel ----------
const posSel = $('posSel');
POSITIONS.forEach(p => posSel.add(new Option(p.label, p.id)));
posSel.value = radio.s.posId;
posSel.onchange = () => { radio.s.posId = posSel.value; radio.save(); };
$('gpsOn').checked = radio.s.gps;
$('gpsOn').onchange = e => { radio.s.gps = e.target.checked; radio.save(); };
$('usbSel').value = radio.s.usb;
$('usbSel').onchange = e => { radio.s.usb = e.target.value; radio.save(); };
const msgSel = $('msgSel');
Object.entries(MESSAGES).forEach(([id, t]) => msgSel.add(new Option(t.length > 60 ? t.slice(0, 58) + '…' : t, id)));

document.querySelectorAll('[data-sim]').forEach(b => b.addEventListener('click', () => {
  switch (b.dataset.sim) {
    case 'recall': send('recall'); break;
    case 'chanUp': send('chanUp'); break;
    case 'chanDn': send('chanDn'); break;
    case 'remoteIcs': send('remoteIcs'); break;
    case 'rxAct': incomingCall('act'); break;
    case 'rxStb': incomingCall('stb'); break;
    case 'powerToggle': if (radio.bus) radio.removeAircraftPower(); else radio.restoreAircraftPower(); break;
    case 'msg': radio.triggerMessage(msgSel.value); break;
    case 'factory':
      if (confirm('Reset all settings, user frequencies and recent list?')) {
        radio.factoryReset();
        posSel.value = radio.s.posId; $('gpsOn').checked = radio.s.gps; $('usbSel').value = radio.s.usb;
      }
      break;
  }
  render();
}));

// ---------- keyboard ----------
// Matched on e.code (physical key) so it works with any keyboard layout (CZ, UA, ...).
const keyMap = {
  Enter: 'ENT', NumpadEnter: 'ENT', Backspace: 'CLR', Delete: 'CLR',
  KeyF: 'FUNC', KeyC: 'COM', KeyM: 'MEM', KeyI: 'ICS', KeyN: 'MON',
};
const holdKeys = { KeyX: ['flipDown', 'flipUp'], KeyT: ['pttDown', 'pttUp'], KeyR: ['xfrDown', 'xfrUp'] };
const repeatable = {
  ArrowLeft: () => turn('outer', -1), ArrowRight: () => turn('outer', 1),
  ArrowUp: () => turn('inner', 1), ArrowDown: () => turn('inner', -1),
  BracketLeft: () => turn('vol', -1), BracketRight: () => turn('vol', 1),
};
const held = new Set();
document.addEventListener('keydown', e => {
  if (e.target.closest?.('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.code;
  let handled = true;
  if (holdKeys[k]) { if (!held.has(k)) { held.add(k); send(holdKeys[k][0]); } }
  else if (repeatable[k]) repeatable[k]();
  else if (e.repeat) handled = !!(keyMap[k] || k === 'Space' || k === 'KeyS' || k === 'KeyP');
  else if (keyMap[k]) send(keyMap[k]);
  else if (k === 'Space') send('push');
  else if (k === 'KeyS') { send('sqDown'); send('sqUp'); }
  else if (k === 'KeyP') send('recall');
  else handled = false;
  if (handled) e.preventDefault();
});
document.addEventListener('keyup', e => {
  const k = e.code;
  if (holdKeys[k] && held.has(k)) { held.delete(k); send(holdKeys[k][1]); }
});
window.addEventListener('blur', () => { for (const k of held) send(holdKeys[k][1]); held.clear(); });

// ---------- sound (optional) ----------
const MASTER_GAIN = 0.3; // overall loudness of all sound effects
// Recorded incoming transmissions: incoming_1 on the active frequency,
// incoming_2 on the standby frequency.
const CLIP_URLS = ['sounds/incoming_1.mp3', 'sounds/incoming_2.mp3'];
const CLIP_FOR = { act: 0, stb: 1 };
const clipData = CLIP_URLS.map(u => fetch(u).then(r => r.arrayBuffer()).catch(() => null));
const clipDurMs = [4640, 4000]; // fallback until the files are decoded
function incomingCall(which) {
  const clip = CLIP_FOR[which];
  radio.simulateRx(which, clipDurMs[clip], clip);
}

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
    // recorded incoming transmissions
    this.clipGain = ctx.createGain(); this.clipGain.gain.value = 0;
    this.clipGain.connect(out);
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
    for (const g of [this.gain.gain, this.clipGain.gain]) { g.cancelScheduledValues(t); g.setValueAtTime(0, t); }
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
    const vol = radio.s.vol / 100;
    const now = this.ctx.currentTime;
    const hearingRx = a.src === 'act' || a.src === 'stb';

    // incoming transmission: play the clip while it is audible
    if (hearingRx) {
      if (!this.playing || this.playing.rx !== a.call) this.startClip(a.call);
    } else {
      this.stopClip();
    }
    this.clipGain.gain.setTargetAtTime(vol, now, 0.02);

    // static levels / colour per source (tune here)
    let n = 0, fc = 1800, q = 0.6;
    if (a.src === 'static') n = 0.12 * vol;                  // squelch override
    if (hearingRx) n = 0.12 * vol;                           // background under incoming calls
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
audio.enabled = $('audioOn').checked;
function startAudioOnGesture() {
  if (audio.enabled && !audio.ctx) audio.init();
  if (audio.ctx && audio.enabled && audio.ctx.state !== 'running' && radio.power) audio.ctx.resume();
}
['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, startAudioOnGesture, { capture: true }));
$('audioOn').onchange = e => {
  audio.enabled = e.target.checked;
  if (audio.enabled && !audio.ctx) audio.init();
  if (audio.ctx) {
    audio.prev = 'off';
    if (audio.enabled) audio.ctx.resume(); else { audio.silence(); audio.ctx.suspend(); }
  }
};

render();
