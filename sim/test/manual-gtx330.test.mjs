// Garmin GTX 330 Pilot's Guide (190-00207-00 Rev K) and Installation Manual (190-00207-02 Rev AE) procedures,
// replayed literally, one input per step, on a unit used elsewhere first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GTX330, IDENT_MS, BOOT_MS } from '../devices/gtx330/device.js';
import { PAGES } from '../devices/gtx330/config.js';

function unit({ config = false } = {}) {
  let t = 0;
  const x = new GTX330({ now: () => t });
  x.advance = ms => { t += ms; x.tick(); };
  x.press = k => { x.input('down:' + k); x.input('up:' + k); x.tick(); };
  x.hold = (k, ms) => { x.input('down:' + k); x.advance(ms); x.input('up:' + k); x.tick(); };
  if (config) { x.input('down:FUNC'); x.press('ON'); x.input('up:FUNC'); x.advance(BOOT_MS + 100); return x; }
  fly(x);
  x.press('ALT');
  x.advance(BOOT_MS + 100);
  // used elsewhere first: FUNC pages, a code entry cancelled, a count up started and reset, the dialog opened and closed
  ['FUNC', 'FUNC', 'FUNC', '1', 'CRSR', 'FUNC', 'START', 'CLR'].forEach(k => x.press(k));
  while (x.page !== 'FLTID') x.press('FUNC');
  x.press('CRSR'); x.press('CLR');
  while (x.page !== 'PALT') x.press('FUNC');
  return x;
}
// in flight: the configured GPS input senses the ground speed (Automated Airborne Determination)
const fly = x => { x.s.sim.onGround = false; x.s.sim.gs = 110; };
const until = (x, page) => { while (x.page !== page) x.press('FUNC'); };
// the texts drawn on the display
const texts = x => { const v = x.view(); return v.off ? 'OFF' : v.gtx.ops.filter(o => o.t === 'txt').map(o => o.s).join(' '); };
const has = (x, ...w) => { const s = texts(x); for (const t of w) assert.ok(s.includes(t), `"${t}" not on screen: ${s}`); };
const hasNot = (x, w) => assert.ok(!texts(x).includes(w), `"${w}" on screen: ${texts(x)}`);
const code = x => x.view().gtx.ops.filter(o => o.f === 'c').map(o => o.s).join('');

test('power on: STBY, ON or ALT; start-up page during the self test; last active code', () => {
  let t = 0;
  const x = new GTX330({ now: () => t });
  x.s.code = '4321'; fly(x);
  x.input('down:ON'); x.input('up:ON');
  has(x, 'Garmin GTX 330', 'Self Test In Progress');
  t += BOOT_MS + 1; x.tick();
  assert.equal(x.opMode, 'ON');
  assert.equal(code(x), '4321');
  x.input('down:OFF'); x.input('up:OFF');
  assert.ok(!x.power);
});

test('mode selection keys: STBY no replies, ON and ALT reply; holding STBY does not select GND', () => {
  const x = unit();
  x.press('STBY'); assert.equal(x.opMode, 'STBY'); assert.ok(!x.replying); has(x, 'STBY');
  x.press('ON'); assert.equal(x.opMode, 'ON'); assert.ok(x.replying);
  x.press('ALT'); assert.equal(x.opMode, 'ALT'); has(x, 'ALT');
  x.press('STBY'); x.hold('STBY', 5000);
  assert.equal(x.opMode, 'STBY');
});

test('Automated Airborne Determination: no replies on the ground (GND), ALT at lift-off with AUTO ALT', () => {
  const x = unit();
  x.c.squat = 'YES'; x.s.sim.onGround = true;
  x.press('ALT'); x.advance(0); x.advance(30000);            // landed: GND after the delay
  assert.equal(x.opMode, 'GND'); assert.ok(!x.replying);
  x.press('STBY');
  x.s.sim.onGround = false; x.advance(100);                  // takeoff sensed
  assert.equal(x.mode, 'ALT'); assert.equal(x.opMode, 'ALT');
  x.c.autoAlt = 'OFF'; x.press('STBY');
  x.s.sim.onGround = true; x.advance(30000); x.s.sim.onGround = false; x.advance(100);
  assert.equal(x.opMode, 'STBY', 'Auto-ALT OFF: no automatic mode switching');
});

test('code selection: dashes, fourth digit activates, CLR back, CLR on first digit / CRSR cancel, CLR within 5 s', () => {
  const x = unit();
  x.press('5');
  assert.equal(code(x), '5---');
  x.press('4'); x.press('CLR');
  assert.equal(code(x), '5---');
  x.press('CLR'); x.press('CLR');
  assert.equal(code(x), x.s.code);
  x.press('3'); x.press('CRSR');
  assert.equal(code(x), x.s.code);
  x.press('5'); x.press('4'); x.press('7'); x.press('1');
  assert.equal(x.s.code, '5471');
  x.advance(2000); x.press('CLR');
  assert.equal(code(x), '547-');
  x.press('2');
  assert.equal(x.s.code, '5472');
  x.press('8'); x.press('9');
  assert.equal(code(x), '5472', '8 and 9 are not used for code entry');
});

test('IDENT: SPI for 18 seconds, IDENT in the upper left corner', () => {
  const x = unit();
  x.press('IDENT');
  has(x, 'IDENT');
  x.advance(IDENT_MS - 100); assert.ok(x.identActive);
  x.advance(200); assert.ok(!x.identActive);
});

test('VFR: the configured VFR code, again restores the previous code', () => {
  const x = unit();
  x.c.vfrId = '1200';
  x.press('1'); x.press('2'); x.press('3'); x.press('4');
  x.press('VFR'); assert.equal(x.s.code, '1200');
  x.press('VFR'); assert.equal(x.s.code, '1234');
});

test('Timer Operation, Flight Timer: steps 1-5 (automatic, START/STOP, CLR, stops on the ground)', () => {
  const x = unit();
  x.c.squat = 'YES'; x.c.autoFlt = 'CLEAR'; x.s.sim.onGround = true; x.advance(100);
  until(x, 'FTIME');                                         // 1.
  has(x, 'FLIGHT TIME');
  x.s.sim.onGround = false; x.advance(0);                    // 2. airborne: the timer begins
  x.advance(30000);
  has(x, '00:00:30');
  x.press('START'); x.advance(5000);                         // 3. pause
  has(x, '00:00:30');
  x.press('START'); x.advance(5000);                         //    restart
  has(x, '00:00:35');
  x.s.sim.onGround = true; x.advance(0); x.advance(10000);   // 5. stops on the ground
  has(x, '00:00:35');
  x.press('CLR');                                            // 4.
  has(x, '00:00:00');
});

test('flight timer CLEAR resets at every lift-off, ACCUM continues', () => {
  const x = unit();
  x.c.squat = 'YES'; x.s.sim.onGround = true; x.advance(100);
  until(x, 'FTIME');
  x.c.autoFlt = 'ACCUM';
  x.s.sim.onGround = false; x.advance(0); x.advance(20000);
  x.s.sim.onGround = true; x.advance(0); x.advance(5000);
  x.s.sim.onGround = false; x.advance(0); x.advance(10000);
  has(x, '00:00:30');
  x.c.autoFlt = 'CLEAR';
  x.s.sim.onGround = true; x.advance(0); x.s.sim.onGround = false; x.advance(0); x.advance(10000);
  has(x, '00:00:10');
});

test('Timer Operation, Count Up timer: steps 1-5', () => {
  const x = unit();
  until(x, 'CUP');                                           // 1.
  has(x, 'COUNT UP');
  x.press('CLR');                                            // 2.
  x.press('START'); x.advance(3000);                         // 3.
  has(x, '00:00:03');
  x.press('START'); x.advance(3000);                         // 4.
  has(x, '00:00:03');
  x.press('CLR');                                            // 5.
  has(x, '00:00:00');
});

test('Timer Operation, Count Down timer: steps 1-6', () => {
  const x = unit();
  until(x, 'CDOWN');                                         // 1.
  has(x, 'COUNT DOWN');
  x.press('CRSR');                                           // 2. all digits, leading zeros with 0
  for (const d of '000010') x.press(d);
  has(x, '00:00:10');
  x.press('START'); x.advance(4000);                         // 3.
  has(x, '00:00:06');
  x.press('START'); x.advance(4000);                         // 4.
  has(x, '00:00:06');
  x.press('START'); x.advance(8000);                         // 5. EXPIRED, "Timer Expired", counts up
  assert.ok(x.cd.expired);
  assert.equal(x.alert.id, 'timer-expired');
  has(x, '00:00:02');
  x.press('CLR');                                            // 6.
  has(x, 'COUNT DOWN', '00:00:10');
});

test('Altitude Monitor Operation: steps 1-4; ABOVE / BELOW flashes over the limit until within 100 ft', () => {
  const x = unit();
  x.s.sim.alt = 4500;                                        // 1.
  until(x, 'ALTMON');                                        // 2.
  has(x, 'ALT MONITOR');
  x.press('START');                                          // 3.
  x.s.sim.alt = 4750; x.advance(100);
  assert.ok(x.altAlert);
  assert.equal(x.alert.id, 'leaving-altitude');
  x.s.sim.alt = 4580; x.advance(100);
  assert.ok(!x.altAlert, 'back within 100 ft');
  x.press('START');                                          // 4.
  assert.ok(!x.altMon.on);
  x.press('START');                                          // a new monitored altitude
  x.s.sim.alt = 4500 + 80 + 1000 + 300; x.advance(100);
  assert.ok(!x.altMon.on, 'stops beyond 1000 ft plus the deviation');
});

test('Flight ID Entry Dialog: FLIGHT ID page, CRSR opens it when ALLOW PILOT TO EDIT FLT ID is enabled', () => {
  const x = unit();
  x.c.dfltMode = 'ENTRY'; x.c.fltId = 'AIR000';
  until(x, 'FLTID');
  has(x, 'FLIGHT ID', 'AIR000');
  x.c.pilotFlt = 'NO';
  x.press('CRSR');
  assert.ok(!x.dialog, 'not with the option disabled');
  x.c.pilotFlt = 'YES';
  x.press('CRSR');
  has(x, 'FLIGHT ID:', 'AIR000', 'CLR=CANCEL  CRSR=EDIT  8=AIR000');
});

test('Editing the Flight ID: R = 5 four times, CRSR to the next field, CLR back, CRSR over the blanks completes', () => {
  const x = unit();
  x.c.dfltMode = 'ENTRY'; x.c.fltId = 'AIR123';
  until(x, 'FLTID');
  x.press('CRSR');                                           // dialog
  x.press('CRSR');                                           // begin editing
  for (let i = 0; i < 4; i++) x.press('4');                  // O
  x.press('CRSR');
  for (let i = 0; i < 3; i++) x.press('3');                  // K
  x.press('CRSR');
  for (let i = 0; i < 4; i++) x.press('5');                  // R
  assert.equal(x.dialog.chars.slice(0, 3).join(''), 'OKR');
  x.press('CLR'); x.press('CRSR');                           // back one character and forward again
  for (let i = 0; i < 6; i++) x.press('CRSR');               // over the remaining characters and blanks
  assert.ok(!x.dialog, 'entry complete');
  assert.equal(x.fltId, 'OKR123');
  has(x, 'FLIGHT ID', 'OKR123');
});

test('Flight ID: CLR on the first character reverts and keeps the dialog open; CLR while not editing closes without saving', () => {
  const x = unit();
  x.c.dfltMode = 'ENTRY'; x.c.fltId = 'AIR123';
  until(x, 'FLTID');
  x.press('CRSR'); x.press('CRSR');
  x.press('7');                                              // first character changed to 7
  x.press('CLR');                                            // cursor on the first character
  assert.ok(x.dialog && !x.dialog.editing);
  assert.equal(x.dialog.chars.join(''), 'AIR123');
  x.press('CLR');
  assert.ok(!x.dialog);
  assert.equal(x.fltId, 'AIR123');
});

test('Resetting the Flight ID to Default: 8 sets the configured default and closes the dialog', () => {
  const x = unit();
  x.c.dfltMode = 'ENTRY'; x.c.fltId = 'AIR800';
  x.s.fltId = 'OKR123';
  until(x, 'FLTID');
  x.press('CRSR');
  has(x, '8=AIR800');
  x.press('8');
  assert.ok(!x.dialog);
  assert.equal(x.fltId, 'AIR800');
});

test('ADS-B: PILOT SET page, START/STOP toggles, ON at each power cycle; NO ADSB when off or without position', () => {
  const x = unit();
  until(x, 'ADSB');
  has(x, 'ADS-B TX', 'ON');
  hasNot(x, 'NO ADSB');
  x.press('START');
  has(x, 'OFF', 'NO ADSB');
  x.press('START');
  hasNot(x, 'NO ADSB');
  x.s.sim.gpsPos = false; x.advance(100);
  has(x, 'NO ADSB');
  x.s.sim.gpsPos = true;
  x.press('START'); x.press('OFF'); x.press('ALT'); x.advance(BOOT_MS + 100);
  assert.ok(x.adsbOn, 'ADS-B defaults to ON at each power cycle');
});

test('Failure Annunciation: an ADS-B transmission failure shows FAIL and no data is transmitted', () => {
  const x = unit();
  x.s.sim.adsbFault = true; x.advance(100);
  assert.equal(x.opMode, 'FAIL'); has(x, 'FAIL'); assert.ok(!x.replying);
});

test('Audio Alerts: "Traffic" on a TIS traffic alert, "Traffic Not Available" when TIS service is lost', () => {
  const x = unit();
  x.input('traffic'); x.tick();
  assert.equal(x.alert.id, 'traffic'); assert.equal(x.alert.type, 'msg');
  x.s.sim.tis = false; x.advance(100);
  assert.equal(x.alert.id, 'traffic-not-available');
  x.c.tisAudio = 'TONE'; x.s.sim.tis = true; x.advance(100);
  x.input('traffic'); x.tick();
  assert.equal(x.alert.type, 'tone');
});

test('IM 5.2: FUNC held while powering on; FUNC forward, START/STOP back to the menu; JUMP TO', () => {
  const x = unit({ config: true });
  has(x, 'JUMP', 'DIAGNOSTICS');
  x.press('FUNC'); assert.equal(PAGES[x.cfgPage].id, 'AUDIO1');
  x.press('FUNC'); x.press('FUNC'); assert.equal(PAGES[x.cfgPage].id, 'TRAFFIC');
  x.press('START'); x.press('START'); x.press('START'); x.press('START');
  assert.equal(PAGES[x.cfgPage].id, 'JUMP', 'stops at the menu page');
  x.press('CRSR'); x.press('9'); x.press('9'); x.press('9');   // ACFT CONFIG
  x.press('CRSR');
  assert.equal(PAGES[x.cfgPage].id, 'CONF1');
});

test('IM 5.2.13.1: Mode S address entry, US TAIL, steps 1-9', () => {
  const x = unit({ config: true });                          // 1-2.
  while (PAGES[x.cfgPage].id !== 'ADDR') x.press('FUNC');    // 3.
  has(x, 'ADDRESS');
  x.press('CRSR'); x.press('8');                             // 4. US TAIL#
  x.press('CRSR');                                           // 5. address field
  has(x, 'US', 'TAIL#');
  const keys = { '1': ['1'], '2': ['2'], '3': ['3'], '4': ['4'], 'A': ['0', '0'] };
  for (const ch of '1234A') { keys[ch].forEach(k => x.press(k)); if (ch !== 'A') x.press('CRSR'); }   // 6-7.
  x.press('CRSR');                                           // 8.
  assert.equal(x.c.addrType, 'US TAIL#');
  assert.equal(x.c.addr, '1234A');
  x.press('FUNC'); x.press('START');                         // 9.
  has(x, 'N', '1', '2', '3', '4', 'A');
});

test('IM 5.2.13.2: Default Flight ID ENTRY, steps 1-4', () => {
  const x = unit({ config: true });
  x.c.fltId = '';                                            // initial installation
  while (PAGES[x.cfgPage].id !== 'DFLTID') x.press('FUNC');
  has(x, 'DEFAULT', 'FLT', 'ID', 'ENTRY');
  x.press('CRSR'); x.press('CRSR');                          // mode stays ENTRY; 1. the field
  const seq = { O: ['4', '4', '4', '4'], K: ['3', '3', '3'], X: ['7', '7', '7', '7'] };
  for (const ch of 'OKX') { seq[ch].forEach(k => x.press(k)); x.press('CRSR'); }   // 2-3.
  x.press('CRSR');                                           // 4.
  assert.equal(x.c.fltId.slice(0, 3), 'OKX');
});

test('IM 5.2.13.3: ALLOW PILOT TO EDIT FLT ID NO: the Default Flight ID is the normal-mode Flight ID', () => {
  const x = unit({ config: true });
  while (PAGES[x.cfgPage].id !== 'FLTCFG') x.press('FUNC');
  has(x, 'ALLOW', 'PILOT', 'EDIT', 'YES');
  x.press('CRSR'); x.press('8'); x.press('CRSR');            // 8 selects No
  assert.equal(x.c.pilotFlt, 'NO');
  x.s.fltId = 'OKR123'; x.c.dfltMode = 'ENTRY'; x.c.fltId = 'OKABC';
  x.press('OFF'); x.press('ALT'); x.advance(BOOT_MS + 100);
  until(x, 'FLTID');
  has(x, 'OKABC');
});

test('IM 5.2.17: ADS-B TX DISABLE / ENABLE / PILOT SET', () => {
  const x = unit({ config: true });
  while (PAGES[x.cfgPage].id !== 'ADSB') x.press('FUNC');
  has(x, 'ADS-B', 'TX', 'PILOT SET');
  x.press('CRSR'); x.press('8'); x.press('CRSR');            // ENABLE
  assert.equal(x.c.adsbTx, 'ENABLE');
  x.press('OFF'); x.press('ALT'); x.advance(BOOT_MS + 100);
  assert.ok(!x.pages().includes('ADSB'), 'no pilot page when not PILOT SET');
  assert.ok(x.adsbActive);
});
