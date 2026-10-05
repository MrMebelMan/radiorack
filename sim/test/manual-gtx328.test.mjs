// Garmin GTX 328 Pilot's Guide (190-00420-03) and Installation Manual (190-00420-04 Rev C) procedures,
// replayed literally, one input per step, on a unit used elsewhere first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GTX328, IDENT_MS, STBY_HOLD_MS, BOOT_MS, VFR_MSG_MS } from '../devices/gtx328/device.js';
import { PAGES } from '../devices/gtx328/config.js';

function unit({ config = false } = {}) {
  let t = 0;
  const x = new GTX328({ now: () => t });
  x.advance = ms => { t += ms; x.tick(); };
  x.press = k => { x.input('down:' + k); x.input('up:' + k); x.tick(); };
  x.hold = (k, ms) => { x.input('down:' + k); x.advance(ms); x.input('up:' + k); x.tick(); };
  if (config) { x.input('down:FUNC'); x.press('ON'); x.input('up:FUNC'); x.advance(BOOT_MS + 100); return x; }
  x.press('ALT');
  x.advance(BOOT_MS + 100);
  // used elsewhere first: FUNC pages, a code entry cancelled, a count up started and reset
  ['FUNC', 'FUNC', 'FUNC', '1', 'CRSR', 'FUNC', 'START', 'CLR', 'FUNC'].forEach(k => x.press(k));
  while (x.page !== 'PALT') x.press('FUNC');
  return x;
}
// the texts drawn on the display
const texts = x => { const v = x.view(); return v.off ? 'OFF' : v.gtx.ops.filter(o => o.t === 'txt').map(o => o.s).join(' '); };
const has = (x, ...w) => { const s = texts(x); for (const t of w) assert.ok(s.includes(t), `"${t}" not on screen: ${s}`); };
const code = x => { const v = x.view(); return v.gtx.ops.filter(o => o.f === 'c').map(o => o.s).join(''); };

test('power on: STBY, ON or ALT; start-up page during the self test; last code', () => {
  let t = 0;
  const x = new GTX328({ now: () => t });
  x.s.code = '4321';
  x.input('down:ON'); x.input('up:ON');
  has(x, 'Garmin GTX 328', 'SW Version 5.00', 'Self Test In Progress');
  t += BOOT_MS + 1; x.tick();
  assert.equal(x.opMode, 'ON');
  assert.equal(code(x), '4321');
  x.input('down:OFF'); x.input('up:OFF');
  assert.ok(!x.power);
});

test('mode selection keys: STBY no replies, ON and ALT reply, hold STBY selects GND', () => {
  const x = unit();
  x.press('STBY'); assert.equal(x.opMode, 'STBY'); assert.ok(!x.replying); has(x, 'STBY');
  x.press('ON'); assert.equal(x.opMode, 'ON'); assert.ok(x.replying);
  x.press('ALT'); assert.equal(x.opMode, 'ALT'); has(x, 'ALT');
  x.hold('STBY', STBY_HOLD_MS + 100); assert.equal(x.opMode, 'GND'); has(x, 'GND');
  assert.ok(!x.replying);
});

test('code selection: four digits, dashes, CLR back, CLR on first digit / CRSR cancel, CLR within 5 s', () => {
  const x = unit();
  x.press('1'); x.press('2'); x.press('0'); x.press('0');   // 1200
  assert.equal(x.s.code, '1200');
  x.press('5');
  assert.equal(code(x), '5---');
  assert.equal(x.s.code, '1200', 'not activated before the fourth digit');
  x.press('4'); x.press('CLR');
  assert.equal(code(x), '5---');
  x.press('CLR'); x.press('CLR');                            // back over the first digit: cancelled
  assert.equal(code(x), '1200');
  x.press('3'); x.press('CRSR');                             // CRSR cancels
  assert.equal(code(x), '1200');
  x.press('5'); x.press('4'); x.press('7'); x.press('1');
  assert.equal(x.s.code, '5471');
  x.advance(2000); x.press('CLR');                           // within five seconds: cursor on the fourth digit
  assert.equal(code(x), '547-');
  x.press('2');
  assert.equal(x.s.code, '5472');
  x.advance(6000); x.press('CLR');
  assert.equal(code(x), '5472', 'after five seconds CLR does not reopen the entry');
  x.press('8'); x.press('9');
  assert.equal(code(x), '5472', '8 and 9 are not used for codes');
});

test('IDENT: SPI for 18 seconds, IDENT in the upper left corner', () => {
  const x = unit();
  x.press('IDENT');
  has(x, 'IDENT');
  x.advance(IDENT_MS - 100); assert.ok(x.identActive);
  x.advance(200); assert.ok(!x.identActive);
});

test('VFR: sets the VFR code (7000), again restores the previous code; disabled: advisory 5 s or CLR', () => {
  const x = unit();
  x.press('1'); x.press('2'); x.press('3'); x.press('4');
  x.press('VFR'); assert.equal(x.s.code, '7000');
  x.press('VFR'); assert.equal(x.s.code, '1234');
  x.c.vfrKey = 'DISABLE';
  x.press('VFR'); assert.equal(x.s.code, '1234'); has(x, 'VFR KEY', 'DISABLED');
  x.advance(VFR_MSG_MS + 100); assert.ok(!x.msg);
  x.press('VFR'); x.press('CLR'); assert.ok(!x.msg);
});

test('flight timer: FUNC to FLIGHT TIME, START/STOP pause / restart, CLR resets', () => {
  const x = unit();
  x.press('FUNC');                                           // 1. FLIGHT TIME
  has(x, 'FLIGHT TIME');
  x.press('START'); x.advance(65000);                        // 3. start
  has(x, '00:01:05');
  x.press('START'); x.advance(10000);                        //    pause
  has(x, '00:01:05');
  x.press('CLR');                                            // 4. reset
  has(x, '00:00:00');
});

test('flight timer automatic: starts at lift-off, stops on the ground (squat switch)', () => {
  const x = unit();
  x.c.squat = 'YES'; x.c.autoFlt = 'YES'; x.s.sim.onGround = true;
  x.press('FUNC'); x.advance(1000);
  x.s.sim.onGround = false; x.advance(100); x.advance(30000);
  has(x, '00:00:30');
  x.s.sim.onGround = true; x.advance(100); x.advance(30000);
  has(x, '00:00:30');
});

test('count up timer: FUNC to COUNT UP, CLR, START/STOP begins, again pauses, CLR resets', () => {
  const x = unit();
  x.press('FUNC'); x.press('FUNC'); x.press('FUNC');         // 1.
  has(x, 'COUNT UP');
  x.press('CLR');                                            // 2.
  x.press('START'); x.advance(3000);                         // 3.
  has(x, '00:00:03');
  x.press('START'); x.advance(3000);                         // 4.
  has(x, '00:00:03');
  x.press('CLR');                                            // 5.
  has(x, '00:00:00');
});

test('count down timer: CRSR and all digits, START/STOP, EXPIRED and counting up, CLR to the initial time', () => {
  const x = unit();
  for (let i = 0; i < 4; i++) x.press('FUNC');               // 1.
  has(x, 'COUNT DOWN');
  x.press('CRSR');                                           // 2.
  for (const d of '000010') x.press(d);
  has(x, '00:00:10');
  x.press('START'); x.advance(4000);                         // 3.
  has(x, '00:00:06');
  x.press('START'); x.advance(4000);                         // 4.
  has(x, '00:00:06');
  x.press('START'); x.advance(8000);                         // 5. expired: counts up
  const seq = x.alertSeq;
  assert.ok(x.cd.expired);
  has(x, '00:00:02');
  assert.equal(x.alert.id, 'timer-expired'); assert.ok(seq >= 1);
  x.press('CLR');                                            // 6.
  has(x, 'COUNT DOWN', '00:00:10');
});

test('altitude monitor: START/STOP at the altitude, alert beyond the deviation (200 ft)', () => {
  const x = unit();
  x.s.sim.alt = 4500;
  x.press('FUNC'); x.press('FUNC');
  has(x, 'ALT MONITOR');
  x.press('START');
  x.s.sim.alt = 4650; x.advance(100);
  assert.ok(!x.altAlert);
  x.s.sim.alt = 4750; x.advance(100);
  assert.ok(x.altAlert);
  assert.equal(x.alert.id, 'leaving-altitude');
  x.press('START');
  assert.ok(!x.altMon.on);
});

test('Flight ID at power-up: CRSR to OK?, CRSR accepts; R = 5 pressed four times; CLR backs up', () => {
  let t = 0;
  const x = new GTX328({ now: () => t });
  x.c.fltMode = 'PWR-UP ENTRY'; x.c.fltId = 'AIR123';
  x.input('down:ALT'); x.input('up:ALT'); t += BOOT_MS + 1; x.tick();
  const press = k => { x.input('down:' + k); x.input('up:' + k); x.tick(); };
  has(x, 'FLT', 'PWR-UP', 'ENTRY', 'OK?');
  assert.ok(!x.operating, 'does not operate before the Flight ID is entered');
  // change it to OKR: O = 4 four times, CRSR, K = 3 three times, CRSR, R = 5 four times
  for (let i = 0; i < 4; i++) press('4');
  press('CRSR');
  for (let i = 0; i < 3; i++) press('3');
  press('CRSR');
  for (let i = 0; i < 4; i++) press('5');
  assert.equal(x.fltEntry.chars.slice(0, 3).join(''), 'OKR');
  press('CLR'); press('CRSR');                               // back one character and forward again
  press('CRSR'); press('CRSR'); press('CRSR');               // over the remaining characters
  press('CRSR');                                             // to the next blank field
  press('CRSR');
  assert.ok(x.fltEntry.ok, 'cursor on OK?');
  press('CRSR');
  assert.ok(x.operating);
  assert.equal(x.c.fltId, 'OKR123');
});

test('configuration mode: FUNC held while powering on; FUNC forward, START/STOP back to the menu', () => {
  const x = unit({ config: true });
  assert.ok(x.config);
  has(x, 'JUMP', 'DIAGNOSTICS');
  x.press('FUNC'); assert.equal(PAGES[x.cfgPage].id, 'AUDIO1');
  x.press('FUNC'); x.press('START'); x.press('START'); x.press('START');
  assert.equal(PAGES[x.cfgPage].id, 'JUMP', 'stops at the menu page');
  x.press('CRSR'); x.press('9'); x.press('9'); x.press('9');  // JUMP TO ACFT CONFIG
  x.press('CRSR');
  assert.equal(PAGES[x.cfgPage].id, 'CONF1');
});

test('configuration: CRSR highlights, 8/9 list, CRSR accepts; FUNC moves on without saving', () => {
  const x = unit({ config: true });
  while (PAGES[x.cfgPage].id !== 'VFRKEY') x.press('FUNC');
  x.press('CRSR'); x.press('9'); x.press('FUNC');
  assert.equal(x.c.vfrKey, 'ENABLE', 'FUNC with a highlighted field does not save');
  x.press('START');
  x.press('CRSR'); x.press('9'); x.press('CRSR');
  assert.equal(x.c.vfrKey, 'DISABLE');
});

test('Installation Manual 5.2.12.1: Mode S address entry (HEX), steps 1-9', () => {
  const x = unit({ config: true });                          // 1-2. FUNC held while powering on
  while (PAGES[x.cfgPage].id !== 'ADDR') x.press('FUNC');    // 3.
  has(x, 'ADDRESS', 'HEX');
  x.press('CRSR');                                           // 4. type field highlighted
  x.press('CRSR');                                           // 5. address field
  const keys = { '4': ['4'], '9': ['9'], 'D': ['1', '1'], '3': ['3'], 'A': ['0', '0'], '7': ['7'] };
  for (const ch of '49D3A7') { keys[ch].forEach(k => x.press(k)); if (ch !== '7') x.press('CRSR'); }   // 6-7.
  x.press('CRSR');                                           // 8. accept
  assert.equal(x.c.addr, '49D3A7');
  x.press('FUNC'); x.press('START');                         // 9. off and back onto the page
  has(x, '4', '9', 'D', '3', 'A', '7');
});

test('Installation Manual 5.2.12.2: Flight ID CONFIG ENTRY, steps 1-6', () => {
  const x = unit({ config: true });
  x.c.fltId = '';                                            // initial installation
  while (PAGES[x.cfgPage].id !== 'FLTID') x.press('FUNC');
  x.press('CRSR'); x.press('CRSR');                          // mode stays CONFIG ENTRY; 1. field
  const seq = { O: ['4', '4', '4', '4'], K: ['3', '3', '3'], X: ['7', '7', '7', '7'] };
  for (const ch of 'OKX') { seq[ch].forEach(k => x.press(k)); x.press('CRSR'); }   // 2-3.
  x.press('CRSR');                                           // 4. accept
  assert.equal(x.c.fltId.slice(0, 3), 'OKX');
  x.press('OFF');                                            // 6.
  x.press('ALT'); x.advance(BOOT_MS + 100);
  assert.ok(x.operating, 'CONFIG ENTRY: no entry at power-up');
});
