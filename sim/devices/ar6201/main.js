// AR6201 page entry: builds the transceiver and wires the shared UI modules to index.html.
import { AR6201, KNOB_STEPS } from './device.js';
import { createLcd } from '../../ui/lcd.js';
import { bindControls, fitBezel } from '../../ui/controls.js';
import { createAudio } from '../../ui/audio.js';
import { fmtFreq } from '../../core/freq.js';

let storage = null;
try { storage = window.localStorage; storage.getItem('x'); } catch { storage = null; }

const radio = new AR6201({ storage });
const $ = id => document.getElementById(id);

fitBezel($('bezel'), $('bezelWrap'), { width: 440, height: 440, maxScale: 1.6, maxViewport: 0.62 });
const renderLcd = createLcd($('lcd'));
const audio = createAudio(radio, {
  clips: [{ url: new URL('../../sounds/incoming_1.mp3', import.meta.url).href, ms: 4640 },
          { url: new URL('../../sounds/incoming_2.mp3', import.meta.url).href, ms: 4000 }],
  clipFor: { act: 0, stb: 1 },   // incoming_1 on the active, incoming_2 on the preset frequency
  toggle: $('audioOn'),
});

function render() {
  radio.tick();
  renderLcd(radio.view());
  controls.renderKnobs();
  audio.update();
  renderPanel();
}

// keys are holds: the transceiver times short / long (2 s) presses itself
const keyHold = el => [el, `down:${el.dataset.key}`, `up:${el.dataset.key}`];
const controls = bindControls(radio, render, {
  encoders: { inner: $('encKnob') },
  innerPush: 'push',
  // volume knob: at OFF the pointer points at the OFF print (-57° from the top); full volume about +78°
  pots: [{ el: $('volKnob'), evt: 'vol', angle: r => -57 + r.knob * (135 / KNOB_STEPS), dragPx: 2, wheelSteps: 5 }],   // 1 % steps: 2 px of drag each, 5 % per wheel notch
  keys: [],
  holds: [...document.querySelectorAll('.key[data-key]')].map(keyHold).concat([
    [$('combo'), 'down:COMBO', 'up:COMBO'],
    [$('ptt'), 'pttDown', 'pttUp'],
    [$('speak'), 'speakDown', 'speakUp'],
  ]),
});
// the speak button belongs to the simulation, not the transceiver
const input = radio.input.bind(radio);
radio.input = (evt, arg) => {
  if (evt === 'speakDown') { radio.speaking = true; return; }
  if (evt === 'speakUp') { radio.speaking = false; return; }
  if (evt === 'pttUp' && $('pttLatch').checked) return;   // stuck PTT key keeps the line active
  input(evt, arg);
};

// ---------- panels ----------
const sim = () => radio.s.sim;
const sync = () => {
  $('voltSl').value = sim().volts; $('voltVal').textContent = `${sim().volts.toFixed(2)} V`;
  $('dimSl').value = sim().dimBus; $('dimVal').textContent = `${sim().dimBus} V`;
  $('micSl').value = sim().micLevel; $('micVal').textContent = `${sim().micLevel > 0 ? '+' : ''}${sim().micLevel}`;
  $('hotSw').checked = sim().hot; $('failStart').checked = sim().failStart;
  document.querySelectorAll('[data-str]').forEach(b => b.classList.toggle('down', b.dataset.str === sim().strength));
};
sync();
const live = (id, fn) => { $(id).oninput = e => { fn(e.target); radio.save(); sync(); }; };
live('voltSl', t => { sim().volts = +t.value; });
live('dimSl', t => { sim().dimBus = +t.value; });
live('micSl', t => { sim().micLevel = +t.value; });
$('hotSw').onchange = e => { sim().hot = e.target.checked; radio.save(); };
$('failStart').onchange = e => { sim().failStart = e.target.checked; radio.save(); };
$('icSw').onchange = e => { radio.extIc = e.target.checked; };
$('pttLatch').onchange = e => { if (e.target.checked) input('pttDown'); else input('pttUp'); render(); };
$('busSw').onchange = e => { radio.setAircraftPower(e.target.checked); render(); };
$('failRun').onclick = () => { radio.raiseRunFailure(); render(); };
document.querySelectorAll('[data-str]').forEach(b => { b.onclick = () => { sim().strength = b.dataset.str; radio.save(); sync(); }; });
document.querySelectorAll('[data-sim]').forEach(b => { b.onclick = () => { audio.incomingCall(b.dataset.sim === 'rxAct' ? 'act' : 'stb'); render(); }; });
$('factory').onclick = () => { if (confirm('Reset all settings, channels and labels to factory defaults?')) { radio.factoryReset(); sync(); render(); } };

function renderPanel() {
  const a = radio.audio();
  $('hint').textContent = !radio.bus ? 'Avionics master off.' : !radio.switchOn ? 'Transceiver OFF. Turn the volume knob clockwise (drag up or scroll up).' : '';
  $('hearingRow').hidden = a.src === 'off';
  const txt = {
    tx: `transmitting on ${fmtFreq(a.freq || 0)}`,
    act: `receiving on the ACTIVE frequency ${fmtFreq(a.freq || 0)}`,
    stb: `receiving on the PRESET frequency ${fmtFreq(a.freq || 0)} (scan)`,
    static: 'squelch off: receiver noise',
    quiet: 'quiet (squelch)',
    off: '',
  }[a.src];
  $('hearing').textContent = `${txt}${radio.power ? ` · vol ${radio.s.vol}%` : ''}${radio.icActive ? ' · intercom' : ''}`;
  $('statusBar').dataset.state = !radio.bus && radio.switchOn ? 'nopower'
    : a.src === 'off' ? 'off' : a.src === 'tx' ? 'tx' : (a.src === 'act' || a.src === 'stb') ? 'rx' : 'on';
  $('ptt').classList.toggle('down', radio.ptt);
  $('busSw').checked = radio.bus;
  // pushbutton illumination follows the panel brightness (Pilots Menu / dimming bus)
  $('bezel').style.setProperty('--keylit', radio.power ? radio.backlight.toFixed(2) : 0);
}

setInterval(render, 50);
render();
