// KN 64 Pilot's Guide (Silver Crown Plus, KN 62A and KN 64 pp. 25-26) and Installation Manual
// (006-00144-0007 Rev 7, 3.1) procedures, replayed literally, one input per step, on a unit used
// elsewhere first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KN64 } from '../devices/kn64/device.js';

const text = v => v.ch.map((c, i) => c + (v.dp[i] ? '.' : '')).join('');
const lit = v => Object.keys(v.ann).filter(k => v.ann[k]);
function unit() {
  let t = 0;
  const k = new KN64({ now: () => t });
  k.advance = ms => { for (let i = 0; i < ms; i += 50) { t += 50; k.tick(); } };
  // used elsewhere first: RMT, 115.75 with the inner knob out, NAV receiver on OKL, at LKKB 3000 ft
  k.input('func', -1); k.input('outer', 3); k.input('inner', -9); k.input('pull');
  k.s.remote = 112600; k.s.sim.posId = 'LKKB'; k.s.sim.alt = 3000; k.s.sim.gs = 120; k.s.sim.trk = 270;
  k.advance(2000);
  return k;
}

test('PG FREQ: channeled with the unit\'s own knobs, displays distance and the selected frequency', () => {
  const k = unit();
  // "Place the function switch on Frequency (FREQ)"
  k.input('func', 1);
  assert.equal(k.s.func, 'FREQ');
  assert.deepEqual(lit(k.view()), ['NM', 'MHZ']);
  // "When pulled 'out', it adds 0.05 MHz" -> pushing it in "subtracts 0.05 MHz"
  assert.equal(k.channel, 115750);
  k.input('pull');                          // push in
  assert.equal(k.channel, 115700);
  // "When in the 'in' position, this smaller knob changes the 0.1 MHz digit"
  k.input('inner', -1);
  assert.equal(k.channel, 115600);
  // "The outer, larger knob changes the larger digits (1 MHz, 10 MHz)": 115 -> 112
  k.input('outer', -1); k.input('outer', -1); k.input('outer', -1);
  assert.equal(k.channel, 112600);
  // pulled out it tunes in 0.1 MHz steps (x.x5)
  k.input('pull'); k.input('inner', 1);
  assert.equal(k.channel, 112750);
  k.input('inner', -1); k.input('pull');
  assert.equal(k.channel, 112600);
  // "the unit will display distance and the selected frequency" (Figure 19)
  k.advance(1500);
  assert.match(text(k.view()), /^[ \d]\d\.\d112\.60$/);
});

test('PG GS/T: holds the frequency, shows distance, groundspeed and time-to-station; knobs have no effect', () => {
  const k = unit();
  k.input('func', 1);                       // FREQ
  k.input('pull');                          // 115.70
  k.input('outer', -1); k.input('outer', -1); k.input('outer', -1); k.input('inner', -1);   // 112.60 OKL
  k.advance(1500);
  // "Now move the function switch to the Groundspeed/Time-to-Station (GS/T) position"
  k.input('func', 1);
  assert.equal(k.s.func, 'GS/T');
  k.setFlying(true); k.advance(5000);
  const v = k.view();
  assert.deepEqual(lit(v), ['NM', 'KT', 'MIN']);
  assert.ok(k.measured().gs > 100, 'groundspeed while flying toward OKL');
  // "Rotating the frequency selector will have no effect ... 'Frequency Hold'"
  k.input('outer', 1); k.input('inner', 1);
  assert.equal(k.channel, 112600);
  assert.ok(k.locked);
});

test('PG RMT: channeled from the NAV receiver, dashes prior to lock-on, then distance / groundspeed / TTS', () => {
  const k = unit();
  k.input('func', 1);                       // FREQ
  // "Place the function switch in the Remote (RMT) position"
  k.input('func', -1);
  assert.equal(k.s.func, 'RMT');
  // "select your NAV frequency on the NAV receiver": NER 112.25
  k.s.remote = 112250; k.tick();
  // "Prior to lock on, 'dashes' will be displayed" (Figure 22)
  assert.equal(text(k.view()), '--------');
  // "Search time is usually about one second"
  k.advance(1100);
  const v = k.view();
  assert.ok(k.locked && k.measured().st.id === 'NER');
  assert.deepEqual(lit(v), ['NM', 'RMT', 'KT', 'MIN']);
  // two frequencies available: the internally selected one is kept
  assert.equal(k.s.freq, 115750);
});

test('IM 3.1: power on in GS/T shows dashes and stays in search until FREQ or RMT', () => {
  const k = unit();
  k.input('func', 1); k.input('func', 1);   // GS/T
  k.input('power');                         // OFF
  assert.equal(k.view().power, false);
  k.input('power');                         // on
  k.advance(5000);
  assert.ok(!k.locked);
  assert.equal(text(k.view()), '--------');
  // "Normal operation is re-established by switching to FREQ or RMT mode"
  k.input('func', -1);                      // FREQ (115.75: no station, searching normally)
  k.input('func', -1);                      // RMT on the NAV receiver's OKL 112.60
  k.advance(1500);
  assert.ok(k.locked);
});
