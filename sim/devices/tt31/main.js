// TT31 page entry: builds the transponder and wires the shared UI modules to index.html.
import '../../ui/manuals.js';
import { t } from '../../ui/i18n.js';
import { TT31, MODES } from './device.js';
import { createLcd } from '../../ui/lcd.js';
import { bindControls, fitBezel } from '../../ui/controls.js';
import { createAudio } from '../../ui/audio.js';
import { TRIG_LOGO } from '../../ui/logos.js';

let storage = null;
try { storage = window.localStorage; storage.getItem('x'); } catch { storage = null; }

const xpdr = new TT31({ storage });
const $ = id => document.getElementById(id);
$('trigMark').innerHTML = TRIG_LOGO;

fitBezel($('bezel'), $('bezelWrap'), { width: 880, height: 240, maxScale: 2.2 });
const renderLcd = createLcd($('lcd'));
const audio = createAudio(xpdr, { clips: [], clipFor: {}, toggle: $('audioOn') });

function render() {
  xpdr.tick();
  renderLcd(xpdr.view());
  controls.renderKnobs();
  audio.update();
  renderPanel();
}

// mode switch positions OFF, SBY, GND, ON, ALT at -90, -45, 0, 45, 90 degrees
const controls = bindControls(xpdr, render, {
  encoders: { inner: $('codeKnob') },
  pots: [{ el: $('modeKnob'), evt: 'mode', angle: x => -90 + x.mode * 45 }],
  keys: document.querySelectorAll('.key[data-key]'),
  holds: [],
});

// ---------- panels ----------
const s = xpdr.s;
const sync = () => {
  $('altSl').value = s.sim.alt; $('altVal').textContent = `${s.sim.alt} ft`;
  $('gndSw').checked = s.sim.onGround; $('radarSw').checked = s.sim.radar;
  $('squatSw').checked = s.inst.squat; $('adsbSw').checked = s.inst.adsb; $('gpsSw').checked = s.sim.gpsValid;
};
sync();
const on = (id, fn) => { $(id).onchange = e => { fn(e.target); xpdr.save(); sync(); render(); }; };
$('altSl').oninput = e => { s.sim.alt = +e.target.value; xpdr.save(); sync(); };
$('ambSl').oninput = e => { s.sim.ambient = +e.target.value; xpdr.save(); sync(); };   // ambient light sensor: LCD backlight (Installation Manual 6.1.11)
on('gndSw', t => { s.sim.onGround = t.checked; });
on('radarSw', t => { s.sim.radar = t.checked; });
on('squatSw', t => { s.inst.squat = t.checked; });
on('adsbSw', t => { s.inst.adsb = t.checked; });
on('gpsSw', t => { s.sim.gpsValid = t.checked; });
$('busSw').onchange = e => { xpdr.setAircraftPower(e.target.checked); render(); };
$('antWarn').onclick = () => { xpdr.raiseWarning('ANTENNA'); render(); };
$('faultRec').onclick = () => { xpdr.raiseFault(true); render(); };
$('faultHard').onclick = () => { xpdr.raiseFault(false); render(); };
$('factory').onclick = () => { if (confirm(t('tt31.confirm.factory'))) { xpdr.factoryReset(); sync(); render(); } };

function renderPanel() {
  const m = MODES[xpdr.mode];
  $('hint').textContent = !xpdr.bus ? t('sim.busOff') : m === 'OFF' ? t('tt31.hint.off') : '';
  $('hearingRow').hidden = !xpdr.power;
  const reply = t(xpdr.replying ? 'xpdr.replying' : 'xpdr.notReplying');
  $('hearing').textContent = `${xpdr.opMode}${xpdr.opMode !== m ? t('tt31.hear.squat', { mode: m }) : ''} · ${reply}${xpdr.identActive ? ' · IDENT (SPI)' : ''}${xpdr.altAlert ? ' · ALTITUDE ALERT' : ''}`;
  $('statusBar').dataset.state = !xpdr.power ? 'off' : xpdr.altAlert ? 'nopower' : xpdr.replying ? 'rx' : 'on';
  $('altLamp').classList.toggle('on', xpdr.altAlert);
  $('busSw').checked = xpdr.bus;
}

setInterval(render, 50);
render();
