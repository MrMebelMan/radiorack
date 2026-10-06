// KN 64 page entry: builds the display, binds the switches and knobs and the simulation panels.
import '../../ui/manuals.js';
import { t, onLang } from '../../ui/i18n.js';
import { KN64, FUNCS, NAV_LIST } from './device.js';
import { createSound } from './sound.js';
import { createSeg7 } from '../../ui/lcd-seg7.js';
import { bindControls, fitBezel } from '../../ui/controls.js';
import { ambWord } from '../../ui/panel.js';
import { POSITIONS } from '../../data/lk.js';

let storage = null;
try { storage = window.localStorage; storage.getItem('x'); } catch { storage = null; }

const kn = new KN64({ storage });
const $ = id => document.getElementById(id);

fitBezel($('bezel'), $('bezelWrap'), { width: 880, height: 181, maxScale: 2.2 });
const sound = createSound(kn, { toggle: $('audioOn') });

// display layout in window pixels (measured from the unlit photo): digit slots [3][3][2],
// decimal points after the 2nd and 6th digit, annunciators and two printed marks under the digits
const display = createSeg7($('disp'), {
  width: 358, height: 65, top: 6, skew: -5,
  digits: [11.5, 46.5, 82.5, 154.5, 189.5, 223.5, 288.5, 323.5],   // + half the slant at mid height
  dps: { 1: [69.5, 36.5], 5: [257, 36.5] },
  ann: { NM: [7, 56], RMT: [89, 56], KT: [151, 56], MHZ: [216, 56], MIN: [272, 56] },
  marks: '<rect class="mark ol" x="42.5" y="45" width="13" height="11"/><rect class="mark" x="55" y="51" width="20" height="5"/>'
    + '<rect class="mark" x="321" y="45" width="1.5" height="11"/><rect class="mark" x="337" y="48" width="9" height="8"/>',
});

// ---------- bezel ----------
const send = (evt, arg) => { kn.input(evt, arg); render(); };
const controls = bindControls(kn, render, {
  encoders: { outer: $('tuneOuter'), inner: $('tuneInner') },
  innerPush: 'pull',
});
// slide switches: press and drag the slider sideways (or click where it should go), or scroll
const funcSw = $('funcSw'), pwrSw = $('pwrSw');
function slide(el, moveTo) {
  const at = e => { const r = el.getBoundingClientRect(); return Math.min(0.999, Math.max(0, (e.clientX - r.left) / r.width)); };
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    moveTo(at(e));
  });
  el.addEventListener('pointermove', e => { if (el.hasPointerCapture(e.pointerId)) moveTo(at(e)); });
}
slide(funcSw, x => {
  let d = Math.floor(x * 3) - FUNCS.indexOf(kn.s.func);
  while (d) { send('func', Math.sign(d)); d -= Math.sign(d); }   // one detent at a time
});
slide(pwrSw, x => { if ((x >= 0.5) !== kn.s.on) send('power'); });
funcSw.addEventListener('wheel', e => { e.preventDefault(); send('func', e.deltaY < 0 ? -1 : 1); }, { passive: false });
pwrSw.addEventListener('wheel', e => { e.preventDefault(); if ((e.deltaY > 0) !== kn.s.on) send('power'); }, { passive: false });

function render() {
  kn.tick();
  display(kn.view());
  funcSw.dataset.pos = kn.s.func;
  pwrSw.dataset.pos = kn.s.on ? 'on' : 'off';
  $('tuneInner').classList.toggle('pulled', kn.pulled);
  controls.renderKnobs();
  sound.update();
  renderPanel();
}

// ---------- panels ----------
const sim = () => kn.s.sim;
$('navSel').innerHTML = NAV_LIST.map(n => `<option value="${n.f}">${(n.f / 1000).toFixed(2)} ${n.id} ${n.name}</option>`).join('');
$('posSel').innerHTML = POSITIONS.map(p => `<option value="${p.id}">${p.label}</option>`).join('');
function sync() {
  $('navSel').value = String(kn.s.remote);
  $('posSel').value = sim().posId;
  $('altSl').value = sim().alt; $('altVal').textContent = `${sim().alt} ft`;
  $('gsSl').value = sim().gs; $('gsVal').textContent = `${sim().gs} kt`;
  $('trkSl').value = sim().trk; $('trkVal').textContent = `${String(sim().trk).padStart(3, '0')}°`;
  $('ambSl').value = sim().ambient; $('ambVal').textContent = ambWord(sim().ambient);
}
onLang(sync);   // also relabels the cockpit light value after a language change
$('navSel').onchange = e => { kn.s.remote = +e.target.value; kn.save(); render(); };
$('posSel').onchange = e => { kn.setStartPos(e.target.value); render(); };
for (const [id, k] of [['altSl', 'alt'], ['gsSl', 'gs'], ['trkSl', 'trk'], ['ambSl', 'ambient']]) {
  $(id).oninput = e => { sim()[k] = +e.target.value; kn.save(); sync(); render(); };
}
$('flyBtn').onclick = () => { kn.setFlying(!kn.flying); render(); };
$('resetPos').onclick = () => { kn.setStartPos($('posSel').value); render(); };
$('busSw').onchange = e => { kn.setAircraftPower(e.target.checked); render(); };
$('factory').onclick = () => { if (confirm(t('kn64.confirm.factory'))) { kn.factoryReset(); sync(); render(); } };

function renderPanel() {
  $('busSw').checked = kn.bus;
  $('flyBtn').textContent = t(kn.flying ? 'sim.pause' : 'sim.fly');
  $('flyBtn').classList.toggle('down', kn.flying);
}

setInterval(render, 100);
render();
