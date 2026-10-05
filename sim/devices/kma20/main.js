// KMA 20 page entry: builds the audio panel, its toggles and the simulation panels.
import '../../ui/manuals.js';
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
for (const t of toggles.filter(t => t.dataset.sw)) {
  t.addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); send('sw', [t.dataset.sw, half(t, e)]); } });
  t.addEventListener('wheel', e => { e.preventDefault(); send('sw', [t.dataset.sw, e.deltaY < 0 ? 1 : -1]); }, { passive: false });
}
// MKR: HI up, LO center, TEST down while held (momentary)
const mkr = $('mkrSw');
mkr.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  e.preventDefault(); mkr.setPointerCapture(e.pointerId);
  send('mkr', half(mkr, e));
});
for (const ev of ['pointerup', 'pointercancel']) mkr.addEventListener(ev, () => { if (kma.test) send('mkrUp'); });
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
sync();
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
$('factory').onclick = () => { if (confirm('Reset the switches, tuned stations and approach to the simulator defaults?')) { kma.factoryReset(); sync(); render(); } };

const list = a => (a.length ? a.map(k => NAME[k]).join(', ') : 'nothing');
function renderPanel() {
  $('hint').textContent = !kma.bus ? 'Avionics master off.' : '';
  $('hearingRow').hidden = !kma.power;
  const m = kma.mix();
  if (m.power) {
    const spk = m.ext ? `EXT speaker: ${list(m.speaker)}` : `Speaker: ${list(m.speaker)}`;
    const tx = m.tx ? (m.tx === 'EXT' ? ' · microphone on the EXT speaker' : ` · transmitting on ${NAME[m.tx]}`) : '';
    $('hearing').textContent = `${spk}${m.muted && m.speaker.length ? ' (muted)' : ''} · Phones: ${list(m.phone)}${tx}`;
    const routed = new Set([...(m.muted || m.ext ? [] : m.speaker), ...m.phone]);
    const hearing = ['COM1', 'COM2', 'MKR'].some(k => routed.has(k) && m.inputs[k]);
    $('statusBar').dataset.state = m.tx ? 'tx' : hearing ? 'rx' : 'on';
  } else $('statusBar').dataset.state = 'off';
  $('ptt').classList.toggle('down', kma.ptt);
  $('busSw').checked = kma.bus;
  if (document.activeElement !== $('distSl')) $('distSl').value = kma.dist;
  $('distVal').textContent = `${kma.dist.toFixed(2)} NM`;
  $('flyBtn').textContent = kma.flying ? 'Pause' : 'Fly';
  $('flyBtn').classList.toggle('down', kma.flying);
}

setInterval(render, 50);
render();
