// GTR 225 page entry: builds the device and wires the shared UI modules to index.html.
import { GTR225, MESSAGES } from './device.js';
import { POSITIONS } from '../../data/lk.js';
import { createLcd } from '../../ui/lcd.js';
import { bindControls, fitBezel } from '../../ui/controls.js';
import { createAudio } from '../../ui/audio.js';
import { bindPanel } from '../../ui/panel.js';

let storage = null;
try { storage = window.localStorage; storage.getItem('x'); } catch { storage = null; }

const radio = new GTR225({ storage });
const $ = id => document.getElementById(id);

fitBezel($('bezel'), $('bezelWrap'), { width: 880, height: 248, maxScale: 2.2 });
const renderLcd = createLcd($('lcd'));
const audio = createAudio(radio, {
  clips: [{ url: 'sounds/incoming_1.mp3', ms: 4640 }, { url: 'sounds/incoming_2.mp3', ms: 4000 }],
  clipFor: { act: 0, stb: 1 },   // incoming_1 on active, incoming_2 on standby
  toggle: $('audioOn'),
});

let renderStatus = () => {};
function render() {
  radio.tick();
  renderLcd(radio.view());
  renderStatus();
  controls.renderKnobs();
  audio.update();
}

const controls = bindControls(radio, render, {
  encoders: { outer: $('tuneOuter'), inner: $('tuneInner') },
  innerPush: 'push',
  // PWR/VOL pot: 0% = -135°, 100% = +135°, OFF detent at -150°
  vol: { el: $('volKnob'), angle: r => (r.switchOn ? -135 + r.s.vol / 100 * 270 : -150) },
  keys: document.querySelectorAll('.key[data-key]'),
  holds: [[$('flip'), 'flipDown', 'flipUp'], [$('ptt'), 'pttDown', 'pttUp'], [$('xfr'), 'xfrDown', 'xfrUp']],
  keyboard: {
    keys: { Enter: 'ENT', NumpadEnter: 'ENT', Backspace: 'CLR', Delete: 'CLR', KeyF: 'FUNC', KeyC: 'COM', KeyM: 'MEM', KeyI: 'ICS', KeyN: 'MON', Space: 'push', KeyP: 'recall' },
    holds: { KeyX: ['flipDown', 'flipUp'], KeyT: ['pttDown', 'pttUp'], KeyR: ['xfrDown', 'xfrUp'] },
    turns: { ArrowLeft: ['outer', -1], ArrowRight: ['outer', 1], ArrowUp: ['inner', 1], ArrowDown: ['inner', -1], BracketLeft: ['vol', -1], BracketRight: ['vol', 1] },
    presses: { KeyS: ['sqDown', 'sqUp'] },
  },
});

renderStatus = bindPanel(radio, { $, send: controls.send, render, audio, positions: POSITIONS, messages: MESSAGES });

setInterval(render, 50);
render();
