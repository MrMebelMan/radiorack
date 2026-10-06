// KMA 20 page entry: builds the audio panel, its toggles and the simulation panels.
import '../../ui/manuals.js';
import { t, onLang } from '../../ui/i18n.js';
import { KMA20, NAV_LIST, ADF_LIST, DME_LIST, stationKey } from './device.js';
import { createSound } from './sound.js';
import { bindControls, fitBezel } from '../../ui/controls.js';
import { ambWord } from '../../ui/panel.js';
import { fmtFreq } from '../../core/freq.js';
import { AIRPORTS, STATIONS } from '../../data/lk.js';
import { APPROACHES } from '../../data/lk-nav.js';

let storage = null;
try { storage = window.localStorage; storage.getItem('x'); } catch { storage = null; }

const kma = new KMA20({ storage });
const $ = id => document.getElementById(id);
const NAME = { COM1: 'COM 1', COM2: 'COM 2', NAV1: 'NAV 1', NAV2: 'NAV 2', ADF: 'ADF', DME: 'DME', MKR: 'MKR', EXT: 'EXT' };
const MIC_DEG = { COM1: -22, COM2: 0, EXT: 22 };   // detent angles of the bar knob (photo: COM 2 straight up)

fitBezel($('bezel'), $('bezelWrap'), { width: 880, height: 223, maxScale: 2.2 });
const sound = createSound(kma, {
  toggle: $('audioOn'),
  clips: [new URL('../../sounds/incoming_1.mp3', import.meta.url).href, new URL('../../sounds/incoming_2.mp3', import.meta.url).href],
});

// ---------- bezel ----------
const toggles = [...document.querySelectorAll('.tgl')];
for (const t of toggles) t.innerHTML = '<i class="nut"></i><i class="lever"></i><i class="ball"></i>';
const send = (evt, arg) => { kma.input(evt, arg); render(); };
const half = (el, e) => (e.clientY < el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2 ? 1 : -1);
// Mouse: a press acts on the half pressed. Touch: swipe up / down moves the lever one position per SWIPE_PX,
// and a tap without movement acts on the half tapped when the finger lifts.
const SWIPE_PX = 14;
function bindToggle(el, move, release = () => {}) {
  let st = null;
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    if (e.pointerType === 'mouse') { move(half(el, e)); return; }
    st = { y: e.clientY, half: half(el, e), swiped: false };
  });
  el.addEventListener('pointermove', e => {
    if (!st) return;
    while (Math.abs(e.clientY - st.y) >= SWIPE_PX) {
      const dir = e.clientY < st.y ? 1 : -1;
      st.y -= dir * SWIPE_PX; st.swiped = true;
      move(dir);
    }
  });
  const end = e => {
    if (st && !st.swiped && e.type === 'pointerup') move(st.half);
    st = null;
    release();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
for (const t of toggles.filter(t => t.dataset.sw)) {
  bindToggle(t, dir => send('sw', [t.dataset.sw, dir]));
  t.addEventListener('wheel', e => { e.preventDefault(); send('sw', [t.dataset.sw, e.deltaY < 0 ? 1 : -1]); }, { passive: false });
}
// MKR: HI up, LO center, TEST down while held (momentary). A tap on the lower half at LO is a short TEST.
const mkr = $('mkrSw');
bindToggle(mkr, dir => send('mkr', dir), () => { if (kma.test) send('mkrUp'); });
mkr.addEventListener('wheel', e => { e.preventDefault(); if (e.deltaY < 0) send('mkr', 1); else if (kma.s.hi) send('mkr', -1); }, { passive: false });

const controls = bindControls(kma, render, {
  pots: [{ el: $('micKnob'), evt: 'mic', angle: k => MIC_DEG[k.s.mic], dragPx: 24, wheelSteps: 1 }],
  keys: [],
  holds: [[$('ptt'), 'pttDown', 'pttUp']],
});

function render() {
  kma.tick();
  const v = kma.view();
  for (const t of toggles) t.dataset.pos = t.dataset.sw ? v.sw[t.dataset.sw] : { HI: 1, LO: 0, TEST: -1 }[v.mkr];
  for (const l of ['A', 'O', 'M']) $('lamp' + l).style.setProperty('--lit', v.lamps[l].toFixed(2));
  controls.renderKnobs();
  sound.update();
  renderPanel();
}

// ---------- panels ----------
const opt = (sel, items) => { sel.innerHTML = items.map(([v, t]) => `<option value="${v}">${t}</option>`).join(''); };
const comFreqs = [
  ...AIRPORTS.flatMap(a => a.freqs.map(f => [f.f, `${fmtFreq(f.f)} ${a.id} ${f.type}`])),
  ...STATIONS.map(s => [s.f, `${fmtFreq(s.f)} ${s.name}`]),
].sort((a, b) => a[0] - b[0]);
opt($('com1Sel'), comFreqs); opt($('com2Sel'), comFreqs);
const navOpt = n => [stationKey(n), `${n.id} ${n.name} ${(n.f / 1000).toFixed(2)}`];
opt($('nav1Sel'), NAV_LIST.map(navOpt)); opt($('nav2Sel'), NAV_LIST.map(navOpt));
opt($('dmeSel'), DME_LIST.map(navOpt));
opt($('adfSel'), ADF_LIST.map(n => [stationKey(n), `${n.id} ${n.name} ${n.type} ${n.f}`]));
opt($('apprSel'), APPROACHES.map(a => [a.id, a.name]));

const SEL = { com1Sel: 'COM1', com2Sel: 'COM2', nav1Sel: 'NAV1', nav2Sel: 'NAV2', adfSel: 'ADF', dmeSel: 'DME' };
const sim = () => kma.s.sim;
function sync() {
  for (const [id, k] of Object.entries(SEL)) $(id).value = String(kma.s.tune[k]);
  $('apprSel').value = kma.s.appr;
  $('headSw').checked = sim().headset;
  $('ambSl').value = sim().ambient; $('ambVal').textContent = ambWord(sim().ambient);
  $('gsSl').value = sim().gs; $('gsVal').textContent = `${sim().gs} kt`;
}
onLang(sync);   // also relabels the cockpit light value after a language change
for (const [id, k] of Object.entries(SEL)) $(id).onchange = e => { kma.s.tune[k] = k.startsWith('COM') ? +e.target.value : e.target.value; kma.save(); render(); };
$('apprSel').onchange = e => { kma.s.appr = e.target.value; kma.save(); render(); };
$('headSw').onchange = e => { sim().headset = e.target.checked; kma.save(); render(); };
$('ambSl').oninput = e => { sim().ambient = +e.target.value; kma.save(); sync(); render(); };
$('gsSl').oninput = e => { sim().gs = +e.target.value; kma.save(); sync(); };
$('distSl').oninput = e => { kma.dist = +e.target.value; render(); };
$('flyBtn').onclick = () => { kma.flying = !kma.flying && kma.dist > 0; render(); };
$('busSw').onchange = e => { kma.setAircraftPower(e.target.checked); render(); };
document.querySelectorAll('[data-call]').forEach(b => {
  b.onclick = () => { const i = b.dataset.call === 'COM1' ? 0 : 1; kma.simulateCall(b.dataset.call, sound.clipMs(i), i); render(); };
});
$('factory').onclick = () => { if (confirm(t('kma20.confirm.factory'))) { kma.factoryReset(); sync(); render(); } };

const list = a => (a.length ? a.map(k => NAME[k]).join(', ') : t('kma20.hear.nothing'));
function renderPanel() {
  $('hint').textContent = !kma.bus ? t('sim.busOff') : '';
  $('hearingRow').hidden = !kma.power;
  const m = kma.mix();
  if (m.power) {
    const spk = t(m.ext ? 'kma20.hear.ext' : 'kma20.hear.speaker', { list: list(m.speaker) });
    const tx = m.tx ? (m.tx === 'EXT' ? t('kma20.hear.micExt') : t('kma20.hear.tx', { name: NAME[m.tx] })) : '';
    $('hearing').textContent = `${spk}${m.muted && m.speaker.length ? t('kma20.hear.muted') : ''}${t('kma20.hear.phones', { list: list(m.phone) })}${tx}`;
    const routed = new Set([...(m.muted || m.ext ? [] : m.speaker), ...m.phone]);
    const hearing = ['COM1', 'COM2', 'MKR'].some(k => routed.has(k) && m.inputs[k]);
    $('statusBar').dataset.state = m.tx ? 'tx' : hearing ? 'rx' : 'on';
  } else $('statusBar').dataset.state = 'off';
  $('ptt').classList.toggle('down', kma.ptt);
  $('busSw').checked = kma.bus;
  if (document.activeElement !== $('distSl')) $('distSl').value = kma.dist;
  $('distVal').textContent = `${kma.dist.toFixed(2)} NM`;
  $('flyBtn').textContent = t(kma.flying ? 'sim.pause' : 'sim.fly');
  $('flyBtn').classList.toggle('down', kma.flying);
}

setInterval(render, 50);
render();
