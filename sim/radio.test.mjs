import test from 'node:test';
import assert from 'node:assert/strict';
import { Radio, stepKhz, stepMhz, fmtFreq, MAX_USER, EMERGENCY } from './radio.js';

function make() {
  let t = 0;
  const r = new Radio({ now: () => t });
  r.advance = ms => { t += ms; r.tick(); };
  r.input('vol', 1); // power on
  r.advance(3000);   // boot splash
  return r;
}
const text = v => JSON.stringify(v);

test('frequency stepping 25 kHz and 8.33 kHz', () => {
  assert.equal(fmtFreq(stepKhz(118000, 1, 25)), '118.025');
  assert.equal(fmtFreq(stepKhz(118975, 1, 25)), '118.000');
  assert.equal(fmtFreq(stepKhz(118000, 1, 833)), '118.005');
  assert.equal(fmtFreq(stepKhz(118015, 1, 833)), '118.025');
  assert.equal(fmtFreq(stepKhz(118000, -1, 833)), '118.990');
  assert.equal(fmtFreq(stepMhz(136500, 1)), '118.500');
  assert.equal(fmtFreq(stepMhz(118500, -1)), '136.500');
});

test('power on, tune standby, flip adds to recent', () => {
  const r = make();
  r.s.act = 118000; r.s.stb = 120000;
  r.input('outer', 1); r.input('inner', 1);
  assert.equal(r.s.stb, 121005);
  r.input('flipDown'); r.input('flipUp');
  assert.equal(r.s.act, 121005);
  assert.equal(r.s.stb, 118000);
  assert.equal(r.s.recent[0], 121005);
});

test('flip disabled while transmitting, hold = emergency', () => {
  const r = make();
  r.s.act = 118000; r.s.stb = 120000;
  r.input('pttDown');
  r.input('flipDown'); r.input('flipUp');
  assert.equal(r.s.act, 118000);
  r.input('pttUp');
  r.input('flipDown'); r.advance(2100); r.input('flipUp');
  assert.equal(r.s.act, EMERGENCY);
  assert.equal(r.s.stb, 118000);
});

test('stuck mic', () => {
  const r = make();
  r.input('pttDown');
  r.advance(30500);
  assert.ok(r.msgs.includes('PTT_STUCK'));
  assert.ok(r.transmitting);
  r.advance(5000);
  assert.ok(!r.transmitting);
  assert.match(text(r.view()), /MESSAGE/);
  r.input('ENT');
  assert.match(text(r.view()), /STUCK MIC/);
  r.input('pttUp');
  assert.doesNotMatch(text(r.view()), /STUCK MIC/);
});

test('remote XFR lock', () => {
  const r = make();
  r.input('xfrDown'); r.advance(2100); r.input('xfrUp');
  assert.ok(r.locked);
  assert.equal(r.s.act, EMERGENCY);
  r.input('ENT'); // ack message
  r.input('flipDown'); r.input('flipUp');
  assert.equal(r.s.act, EMERGENCY);
  r.input('xfrDown'); r.advance(2100); r.input('xfrUp');
  assert.ok(!r.locked);
});

test('save user frequency from COM page', () => {
  const r = make();
  r.s.user = [];
  r.s.stb = 119405;
  r.input('ENT');
  assert.equal(r.page.id, 'uedit');
  // L = index 12 in '_ABC...'
  for (let i = 0; i < 12; i++) r.input('inner', 1);
  r.input('outer', 1);
  for (let i = 0; i < 11; i++) r.input('inner', 1); // K
  r.input('ENT');      // accept name
  r.input('inner', 1); // ignored: name accepted, no field selected
  r.input('outer', 1); // outer knob -> TYPE field
  r.input('inner', 1); // TWR (wraps from blank)
  r.input('ENT');
  assert.deepEqual(r.s.user[0], { freq: 119405, name: 'LK', type: 'TWR' });
});

test('user list limit and delete', () => {
  const r = make();
  r.s.user = Array.from({ length: MAX_USER }, (_, i) => ({ freq: 118000 + i * 25, name: 'X', type: '' }));
  r.input('ENT');
  assert.equal(r.page.id, 'com');
  r.input('FUNC'); r.input('inner', 1); r.input('ENT'); // USER FREQS
  assert.equal(r.page.kind, 'user');
  r.input('CLR');
  assert.match(text(r.view()), /DELETE FREQUENCY/);
  r.input('ENT');
  assert.equal(r.s.user.length, MAX_USER - 1);
});

test('database look-up LKPR to standby', () => {
  const r = make();
  r.input('push');
  // type L -> autocompletes first L ident
  for (let i = 0; i < 12; i++) r.input('inner', 1);
  assert.equal(r.page.ident[0], 'L');
  r.page.ident = ['L', 'K', 'P', 'R'];
  r.input('ENT');
  assert.equal(r.page.phase, 'type');
  assert.match(text(r.view()), /ATIS/);
  r.input('inner', 2);
  assert.match(text(r.view()), /GND\+/);
  r.input('inner', -2);
  r.input('ENT');
  assert.equal(r.page.id, 'com');
  assert.equal(r.s.stb, 122160);
});

test('spacing to 25 kHz deletes 8.33 user frequencies', () => {
  const r = make();
  r.s.user = [{ freq: 118000, name: 'A', type: '' }, { freq: 118005, name: 'B', type: '' }];
  r.setSpacing(25);
  assert.equal(r.s.user.length, 1);
  assert.equal(r.s.act % 25, 0);
});

test('count down timer overruns and counts up highlighted; COM page stop/reset prompts', () => {
  const r = make();
  r.s.cdStart = 5;
  r.input('FUNC'); r.input('outer', -1); // TMR CONFIGURATION
  r.input('inner', 1); r.input('ENT');  // COUNT DOWN
  assert.equal(r.page.id, 'tmrdown');
  r.input('ENT'); // start
  r.advance(2000);
  r.input('COM');
  assert.match(text(r.view()), /00:00:03/);
  r.advance(5000);
  const v = r.view();
  assert.equal(v.bottomRight[0].t, '00:00:02');
  assert.ok(v.bottomRight[0].inv);
  r.input('ENT');
  assert.match(text(r.view()), /STOP TMR/);
  r.input('ENT');
  assert.ok(!r.cd.running);
  r.input('CLR');
  assert.match(text(r.view()), /RESET TMR/);
  r.input('ENT');
  assert.equal(r.displayedTimer(), null);
});

test('count down set start value', () => {
  const r = make();
  r.input('FUNC'); r.input('outer', -1); r.input('inner', 1); r.input('ENT');
  r.input('push');
  r.input('inner', 4); // minutes 1 -> 5
  r.input('ENT');
  assert.equal(r.s.cdStart, 5 * 60);
});

test('MEM toggles recent and user; nearest needs GPS', () => {
  const r = make();
  r.input('MEM'); assert.equal(r.page.kind, 'recent');
  r.input('MEM'); assert.equal(r.page.kind, 'user');
  r.s.gps = false;
  assert.equal(r.listItems('napt').length, 0);
  r.s.gps = true;
  const n = r.listItems('napt');
  assert.ok(n.length > 0 && n.length <= 25);
  assert.match(n[0].apt.id, /LKLT|LKKB/);
});

test('ICS key cycles pages and settings commit/undo', () => {
  const r = make();
  r.input('ICS'); assert.equal(r.page.kind, 'adjics');
  r.input('inner', 1); // SQ AUTO -> 0
  r.input('CLR');
  assert.equal(r.s.ics.sq, 'AUTO');
  r.input('ICS'); r.input('inner', 1); r.input('ENT');
  assert.equal(r.s.ics.sq, 0);
  r.input('ICS'); r.input('ICS'); assert.equal(r.page.kind, 'aux');
  r.input('ICS'); assert.equal(r.page.kind, 'icsonoff');
  r.input('ICS'); assert.equal(r.page.id, 'com');
});

test('volume past zero powers off', () => {
  const r = make();
  r.s.vol = 5;
  r.input('vol', -1); assert.ok(r.power);
  r.input('vol', -1); assert.ok(!r.power);
});

test('aircraft power loss and restore with knob on', () => {
  const r = make();
  r.removeAircraftPower();
  assert.ok(r.msgs.includes('POWER'));
  r.advance(11000);
  assert.ok(!r.power);
  r.input('vol', 1);            // knob already on: just volume, no power
  assert.ok(!r.power);
  r.restoreAircraftPower();
  assert.ok(r.power && r.booting);
  r.advance(3000);
  assert.ok(!r.booting);
  // restoring within the hold-up time keeps it running
  r.removeAircraftPower(); r.advance(3000); r.restoreAircraftPower();
  assert.ok(r.power && !r.booting);
  // knob off, power cycle: stays off
  r.s.vol = 0; r.input('vol', -1);
  assert.ok(!r.power);
  r.removeAircraftPower(); r.restoreAircraftPower();
  assert.ok(!r.power);
});

test('monitor: active transmission takes priority over standby, standby resumes', () => {
  const r = make();
  r.input('MON');
  r.simulateRx('stb', 6000, 1);
  assert.equal(r.audio().src, 'stb');
  r.advance(1000);
  r.simulateRx('act', 2000, 0);
  assert.equal(r.audio().src, 'act');
  r.advance(2500);                 // active call over, standby still going
  assert.equal(r.audio().src, 'stb');
  r.advance(3000);
  assert.equal(r.audio().src, 'quiet');
  // without MON the standby call is not heard at all
  r.input('MON');
  r.simulateRx('stb', 3000, 1);
  assert.equal(r.audio().src, 'quiet');
});

test('MON and squelch override are reset at power-up (also after a page reload)', () => {
  let t = 0;
  const store = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
  let r = new Radio({ now: () => t, storage: store });
  r.input('vol', 1); t += 3000; r.tick();
  r.input('MON'); r.input('sqDown'); r.input('sqUp');
  assert.ok(r.s.mon && r.s.sq);
  r = new Radio({ now: () => t, storage: store }); // page reload with saved state
  r.input('vol', 1); t += 3000; r.tick();
  assert.ok(!r.s.mon && !r.s.sq);
});

test('8.33 -> 25 kHz also drops 8.33 recent frequencies', () => {
  const r = make();
  r.s.recent = [118005, 118000, 120335];
  r.setSpacing(25);
  assert.deepEqual(r.s.recent, [118000]);
});

test('remote transfer key held 30 s raises REMOTE KEY STUCK', () => {
  const r = make();
  r.input('xfrDown');
  r.advance(2100);
  assert.ok(r.locked);
  r.input('ENT'); // ack COM LOCKED
  r.advance(28000);
  assert.ok(r.msgs.includes('XFR_STUCK'));
  r.input('xfrUp');
  assert.ok(r.locked);
});

test('lists: ENT / flip stay on the list, CLR returns to the functions display', () => {
  const r = make();
  r.input('FUNC'); r.input('ENT'); // RECENT FREQS
  r.input('ENT');
  assert.equal(r.page.id, 'list');
  r.input('CLR');
  assert.equal(r.page.id, 'menu');
});

test('nearest APT lists airports; ENT shows its frequencies; ENT = standby, flip = active', () => {
  const r = make();
  r.s.posId = 'LKPR';
  r.input('FUNC'); for (let i = 0; i < 3; i++) r.input('inner', 1); r.input('ENT'); // NEAREST APT
  assert.equal(r.page.kind, 'napt');
  assert.match(text(r.view()), /LKPR/);
  assert.match(text(r.view()), /ENT=DONE/);
  r.input('ENT');
  assert.equal(r.page.id, 'db');
  r.input('ENT');                       // ATIS -> standby, stay
  assert.equal(r.s.stb, 122160);
  assert.equal(r.page.id, 'db');
  r.input('CLR');
  assert.equal(r.page.kind, 'napt');
  r.input('CLR');
  assert.equal(r.page.id, 'menu');
});

test('database look-up from the COM page returns to the COM page after ENT', () => {
  const r = make();
  r.input('push');
  r.page.ident = ['L', 'K', 'L', 'T'];
  r.input('ENT'); r.input('ENT');
  assert.equal(r.page.id, 'com');
  assert.equal(r.s.stb, 120335);
});
