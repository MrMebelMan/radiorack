// Trig TT31 Operating Manual (00454-00-AF) / Installation Manual (00455-00-AR) procedures,
// replayed literally, plus the screens seen in photos of the real unit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TT31, IDENT_MS } from '../devices/tt31/device.js';

function unit() {
  let t = 0;
  const x = new TT31({ now: () => t });
  x.advance = ms => { t += ms; x.tick(); };
  for (let i = 0; i < 4; i++) x.input('mode', 1);   // OFF -> ALT
  x.advance(2500);                                    // start-up screen
  // use it elsewhere first: FUNC pages, FLT/SQ twice
  ['FUNC', 'FUNC', 'FUNC', 'FUNC', 'FLTSQ', 'FLTSQ'].forEach(e => x.input(e));
  return x;
}
const segs = a => (a || []).map(s => s.t).join('');
function screen(x) {
  const v = x.view();
  if (v.off) return 'OFF';
  const p = v.xpdr;
  if (p.boot) return `${p.boot.logo} ${p.boot.lines.join(' / ')}`;
  if (p.alert) return `${p.alert.title} ${p.alert.text}`;
  const right = p.label ? `${p.label.map(segs).join(' / ')} ${segs(p.big)}${(p.lines || []).map(segs).join(' ')}` : segs(p.big);
  return `${p.mode}${p.ident ? ' IDENT' : ''} | ${segs(p.small)} | ${p.fl} | ${right}`;
}
const has = (x, ...t) => { const s = screen(x); for (const w of t) assert.ok(s.includes(w), `"${w}" not on screen: ${s}`); };

test('start-up screen (photo): TRIG, TT31 Mode S, Version, FPGA', () => {
  let t = 0;
  const x = new TT31({ now: () => t });
  x.input('mode', 1);            // OFF -> SBY: power on
  has(x, 'TRIG', 'TT31 Mode S', 'Version 3.18', 'FPGA 020714a');
  t += 2500;
  has(x, 'SBY |');
});

test('mode selector knob: OFF / SBY / GND / ON / ALT and replies', () => {
  const x = unit();
  x.s.sim.onGround = false;
  assert.equal(x.opMode, 'ALT');
  assert.ok(x.replying);                              // ALT: responds to all interrogations
  x.input('mode', -1); assert.equal(x.opMode, 'ON'); assert.ok(x.replying);
  x.input('mode', -1); assert.equal(x.opMode, 'GND');
  assert.ok(!x.replying, 'GND airborne: no surface-radar interrogations');
  x.s.sim.onGround = true; assert.ok(x.replying);     // Mode S ground interrogations
  x.input('mode', -1); assert.equal(x.opMode, 'SBY'); assert.ok(!x.replying);
  x.input('mode', -1); assert.ok(!x.power);           // OFF: power removed
  x.input('mode', -1); assert.equal(x.mode, 0, 'end stop');
});

test('squat switch: ALT on the ground stays GND, ALT airborne (Installation Manual 7)', () => {
  const x = unit();
  x.s.inst.squat = true; x.s.sim.onGround = true;
  has(x, 'GND |');
  x.s.sim.onGround = false;
  has(x, 'ALT |');
});

test('IDENT: SPI for 18 seconds, IDENT in the display', () => {
  const x = unit();
  x.input('IDENT');
  has(x, 'IDENT');
  x.advance(IDENT_MS - 100); assert.ok(x.identActive);
  x.advance(200); assert.ok(!x.identActive);
});

test('VFR sets the conspicuity code, pressed again restores the previous code', () => {
  const x = unit();
  x.s.squawk = '4321';
  x.input('VFR'); assert.equal(x.s.squawk, '7000');
  x.input('VFR'); assert.equal(x.s.squawk, '4321');
});

test('code selector: turning highlights and changes the first digit, ENT advances, ENT on the last digit replaces', () => {
  const x = unit();
  x.s.squawk = '7000';
  x.input('inner', -1);           // turn: first digit highlighted and changed (photo: 4000)
  x.input('inner', -1); x.input('inner', -1);
  let big = x.view().xpdr.big;
  assert.deepEqual(big.map(s => [s.t, !!s.inv]), [['4', true], ['0', false], ['0', false], ['0', false]]);
  x.input('ENT');                 // advance to the next digit
  x.input('inner', 1);
  x.input('BACK');                // back to the previous digit
  x.input('inner', 1);            // 4 -> 5
  x.input('ENT'); x.input('ENT'); x.input('ENT'); x.input('ENT');
  assert.equal(x.s.squawk, '5100');
  assert.equal(x.entry, null);
});

test('code entry not completed within 7 seconds: changes ignored', () => {
  const x = unit();
  x.s.squawk = '7000';
  x.input('inner', 1); x.input('ENT'); x.input('inner', 1);
  x.advance(7100);
  assert.equal(x.entry, null);
  assert.equal(x.s.squawk, '7000');
  has(x, '7000');
});

test('FLT/SQ alternates the primary display; Flight ID entry, a blank ends it', () => {
  const x = unit();
  x.s.flightId = 'OKABC';
  has(x, '| OKABC |');            // Flight ID small, squawk big
  x.input('FLTSQ');
  assert.equal(segs(x.view().xpdr.big), 'OKABC');
  // enter "OK1": O, K, then 1, then a blank ends it
  x.input('inner', 1); x.input('inner', -1);     // first char stays O
  x.input('ENT'); x.input('ENT');                // O, K
  while (x.entry.chars[2] !== '1') x.input('inner', 1);
  x.input('ENT');
  while (x.entry.chars[3] !== '_') x.input('inner', 1);
  x.input('ENT');                                // blank ends the Flight ID
  assert.equal(x.s.flightId, 'OK1');
});

test('FUNC pages (photos): FLIGHT TIME, TIMER, ALTITUDE MONITOR; squawk small top-right', () => {
  const x = unit();
  x.s.squawk = '7000';
  x.input('FUNC');
  has(x, '| 7000 |', 'FLIGHT / TIME', '00:00:');
  x.input('FUNC');
  has(x, 'TIMER / ENT', '00:00:00');
  x.input('FUNC');
  has(x, 'ALTITUDE MONITOR / ON/OFF? ENT');
  x.input('FUNC');
  assert.equal(x.page, 'main');
});

test('flight timer counts only while operating in ON or ALT (airborne with squat switch)', () => {
  const x = unit();
  x.advance(60000);
  const t1 = x.flightTimer.elapsed(x.now());
  assert.ok(t1 >= 60000);
  x.input('mode', -2);            // GND
  x.advance(60000);
  assert.equal(x.flightTimer.elapsed(x.now()), t1);
  x.s.inst.squat = true; x.s.sim.onGround = true; x.input('mode', 2);
  x.advance(60000);
  assert.equal(Math.round(x.flightTimer.elapsed(x.now()) / 1000), Math.round(t1 / 1000), 'on ground: stopped by the squat switch');
});

test('stopwatch: ENT resets and starts, ENT again stops', () => {
  const x = unit();
  x.input('FUNC'); x.input('FUNC');        // TIMER
  x.input('ENT'); x.advance(5000);
  x.input('ENT');
  has(x, '00:00:05');
  x.advance(3000); has(x, '00:00:05');
  x.input('ENT');                           // reset and start again
  has(x, '00:00:00');
});

test('altitude monitor: ENT toggles at the current altitude, alert beyond 250 ft (Installation Manual AR), pointer', () => {
  const x = unit();
  x.s.sim.alt = 3000;
  x.input('FUNC'); x.input('FUNC'); x.input('FUNC');   // ALTITUDE MONITOR
  x.input('ENT');
  assert.deepEqual(x.altMon, { on: true, ref: 3000 });
  x.input('FUNC');                                     // back to the main page
  assert.equal(x.view().xpdr.pointer, 'level');
  x.s.sim.alt = 3250; assert.ok(!x.altAlert);
  x.s.sim.alt = 3300; assert.ok(x.altAlert);
  assert.equal(x.view().xpdr.pointer, 'down');
});

test('ADS-B monitor (if installed): position, dashes when GPS invalid; ADS-B warning', () => {
  const x = unit();
  x.s.inst.adsb = true;
  x.input('FUNC'); x.input('FUNC'); x.input('FUNC');
  has(x, 'ADS-B / MONITOR', 'N50°');
  x.s.sim.gpsValid = false; x.tick();   // panel switch (the page ticks every 50 ms)
  x.advance(1500);
  has(x, 'ADS-B / MONITOR', '---');  // no valid GPS for about 2 s before the warning (Trig support)
  x.advance(600);
  has(x, 'WARNING NO ADSB POSN');    // Installation Manual §12.6: "WARNING – NO ADSB POSN"
  x.s.sim.gpsValid = true; x.advance(3000);
  has(x, 'WARNING NO ADSB POSN');    // only cleared by pressing a button, even with valid GPS again
  x.input('ENT');
  has(x, 'ADS-B / MONITOR', 'N50°');
  x.s.sim.gpsValid = false; x.tick(); x.advance(2100);
  x.input('ENT');                    // ENT clears it
  has(x, 'ADS-B / MONITOR', '---');
  x.advance(11000);
  has(x, 'WARNING');                 // reappears while the problem is still present
});

test('fault: no replies; a recoverable fault clears by switching off and on', () => {
  const x = unit();
  x.s.sim.onGround = false;
  x.raiseFault(true);
  has(x, 'FAULT');
  assert.ok(!x.replying);
  x.input('mode', -4); x.input('mode', 4); x.advance(2500);
  assert.equal(x.fault, null);
  x.raiseFault(false);
  x.input('mode', -4); x.input('mode', 4); x.advance(2500);
  has(x, 'FAULT');
});
