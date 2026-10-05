// Becker AR6201-(X0X) Operating Instructions (Issue 5, 2013) and Installation Manual
// (DV 14300.03 Issue 5) procedures, replayed literally on a unit used elsewhere first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AR6201, LONG_MS, STUCK_MS, thrDbm } from '../devices/ar6201/device.js';

function unit({ setup = false } = {}) {
  let t = 0;
  const r = new AR6201({ now: () => t });
  r.advance = ms => { for (let i = 0; i < ms; i += 50) { t += 50; r.tick(); } };
  r.press = k => { r.input('down', k); r.advance(100); r.input('up', k); };
  r.hold = k => { r.input('down', k); r.advance(LONG_MS + 100); r.input('up', k); };
  if (setup) r.input('down', 'MDE');      // held while switching on
  r.input('vol', 8);                        // a. turn ON by turning the volume knob clockwise
  r.advance(3200);                          // b. WAIT during PBIT
  if (setup) { r.input('up', 'MDE'); return r; }
  // use it elsewhere first: Direct Tune, Channel, back to Standard, squelch twice
  r.press('MDE'); r.press('MDE'); r.press('MDE'); r.press('ICSQL'); r.press('ICSQL');
  return r;
}
const bk = r => r.view().bk;
const txt = a => (a || []).map(s => s.t).join('');
function screen(r) {
  const v = r.view();
  if (v.off) return 'OFF';
  const b = v.bk;
  if (b.scr === 'wait') return b.lines.join(' / ');
  if (b.scr === 'failstart') return 'FAILURE / PRESS ANY KEY';
  if (b.scr === 'pw') return `PASSWORD ${b.digits}`;
  if (b.scr === 'setup') return `${b.title}`;
  if (b.scr === 'menu') return `${txt(b.top.l)} | ${b.label} ${b.value}`;
  const bot = b.bot;
  const second = { freq: () => txt(bot.l), bat: () => bot.t, msg: () => bot.t, chan: () => `${bot.db} ${bot.label} ${bot.num}`,
    sto: () => `${bot.status} CH${bot.num}`, label: () => txt(bot.l) }[bot.kind]();
  return `${b.top.ann || ''} ${txt(b.top.l)} | ${bot.ann.join(' ')} ${second}`.trim();
}
const has = (r, ...w) => { const s = screen(r); for (const x of w) assert.ok(s.includes(x), `"${x}" not on screen: ${s}`); };

test('4.2 start-up: WAIT with CH-SW / CM-SW, then the mode used last', () => {
  let t = 0;
  const r = new AR6201({ now: () => t });
  r.input('vol', 1);
  has(r, 'WAIT', 'CH-SW V 3.05', 'CM-SW V 1.49');
  t += 3100; r.tick();
  has(r, '120.335', '122.160', 'SQL');
  r.s.mode = 'dir'; r.input('vol', -1); r.input('vol', 1); t += 3100; r.tick();
  has(r, 'BAT 13.80V');                                  // d. starts in the mode last used
});

test('4.2 c / 4.13: start-up failure shows FAILURE / PRESS ANY KEY', () => {
  let t = 0;
  const r = new AR6201({ now: () => t });
  r.s.sim.failStart = true;
  r.input('vol', 1); t += 3100; r.tick();
  has(r, 'FAILURE / PRESS ANY KEY');
  r.input('down', 'STO'); r.input('up', 'STO');
  has(r, '120.335');
  assert.equal(r.s.fail['P_INTERNAL IC'], 1);
});

test('4.4 MDE short press: Standard -> Direct Tune -> Channel -> Standard', () => {
  const r = unit();
  has(r, '122.160');
  r.press('MDE'); has(r, 'BAT ');
  r.press('MDE'); has(r, 'CH LKLT RADIO 01');
  r.press('MDE'); has(r, '122.160');
});

test('4.4.1 Standard Mode: push MHz, push 100 kHz, push 25/8.33 kHz, edits the preset; ↕ exchanges', () => {
  const r = unit();
  r.s.pre = 127000;
  r.input('push'); r.input('inner', 0);
  assert.deepEqual(bk(r).bot.l.map(s => [s.t, !!s.inv]), [['127', true], ['.000', false]]);
  r.input('push'); r.input('inner', 2);                 // 127.200
  assert.deepEqual(bk(r).bot.l.map(s => [s.t, !!s.inv]), [['127.', false], ['2', true], ['00', false]]);
  r.input('push'); r.input('inner', 8);                 // 8.33 channels inside .200: 127.250
  assert.equal(txt(bk(r).bot.l), '127.250');
  assert.equal(r.s.act, 120335, 'only the preset is edited');
  r.press('SCN');
  has(r, '127.250 | SQL 120.335');
});

test('4.4.2 Direct Tune Mode: the active frequency changes immediately', () => {
  const r = unit();
  r.press('MDE');
  r.input('push'); r.input('inner', 7);                 // 127.335
  r.input('push'); r.input('inner', -1);                // 127.235
  r.input('push'); r.input('inner', -5);                // 127.205
  assert.equal(r.s.act, 127205);
  r.input('pttDown'); r.input('inner', 1);
  assert.equal(r.s.act, 127205, 'not while transmitting');
  assert.ok(bk(r).flash);
});

test('4.4.3 Channel Mode: CW turn -> user channels, CCW turn -> LAST, 5 s timeout, CH--', () => {
  const r = unit();
  r.press('MDE'); r.press('MDE');
  has(r, 'CH LKLT RADIO 01');
  r.input('inner', 1);                                  // one clockwise turn: number inverted
  assert.ok(bk(r).bot.inv);
  r.input('inner', 1);                                  // tunes immediately
  assert.equal(r.s.act, r.s.ch[1]);
  has(r, 'LKKB TWR 02');
  r.advance(5200);
  assert.equal(r.chsel, null, 'leaves after 5 s');
  r.s.last = [118555];
  r.input('inner', -1);                                 // counter-clockwise: Last Channels
  has(r, 'LAST', ' 1');
  assert.equal(r.s.act, 118555);
  r.input('push');                                      // leave by a short push
  has(r, 'CH  --');                                     // not stored in the user channels
});

test('4.4.4 Scan: long SCN, preset heard only when the active is quiet, active has priority', () => {
  const r = unit();
  r.press('MDE');                                       // Direct Tune
  r.hold('SCN');                                        // long press: Scan, changes to Standard
  assert.ok(r.scan); assert.equal(r.s.mode, 'std');
  has(r, 'SCAN');
  r.simulateRx('stb', 4000, 1, -85);
  r.advance(100);
  assert.equal(r.audio().src, 'stb');
  assert.ok(bk(r).bot.tri, 'arrow in front of the preset');
  r.simulateRx('act', 4000, 0, -85);
  r.advance(100);
  assert.equal(r.audio().src, 'act');
  const frames = []; for (let i = 0; i < 4; i++) { r.advance(250); frames.push(bk(r).bot.l.some(s => s.inv)); }
  assert.ok(frames.includes(true) && frames.includes(false), 'preset inverts and blinks');
  r.press('MDE');                                       // short MDE terminates Scan
  assert.ok(!r.scan); assert.equal(r.s.mode, 'std');
});

test('4.5 squelch: IC/SQL short toggles, arrow stays visible with squelch off; threshold', () => {
  const r = unit();
  has(r, 'SQL');
  r.press('ICSQL');
  assert.ok(!r.sqlOn);
  assert.equal(bk(r).top.tri, 'empty');
  assert.equal(r.audio().src, 'static');
  r.press('ICSQL');
  r.simulateRx('act', 3000, 0, thrDbm(r.s.sqThr) - 2);
  assert.equal(r.audio().src, 'quiet', 'below the threshold the receiver stays muted');
  r.simulateRx('act', 3000, 0, -75);
  assert.equal(bk(r).top.tri, 'full');
});

test('4.7 channel spacing: MDE + STO for 2 s toggles 8.33 / 25 kHz', () => {
  const r = unit();
  r.s.act = 120880;
  r.hold('COMBO');
  assert.equal(r.s.spacing, 25);
  has(r, '120.87');
  r.hold('COMBO');
  assert.equal(r.s.spacing, 833);
});

test('4.8.1 storage: STO proposes a channel, STO again edits the label, short STO stores', () => {
  const r = unit();
  r.s.act = 119555;
  r.press('STO');
  has(r, 'STO FREE CH10');                              // first free channel (9 preloaded)
  r.input('inner', 1); has(r, 'FREE CH11');
  r.press('STO');
  assert.equal(txt(bk(r).bot.l), '__________');         // ten underscores
  r.input('inner', 1); r.input('push'); r.input('inner', 2);   // "AB"
  r.press('STO');
  assert.equal(r.s.ch[10], 119555);
  assert.equal(r.s.labels[119555], 'AB');
  // long STO clears the label being edited
  r.press('STO'); r.press('STO'); r.hold('STO');
  assert.equal(txt(bk(r).bot.l), '__________');
});

test('4.8.1 storage: no action for 7 s returns without storing the frequency and label', () => {
  const r = unit();
  r.s.act = 119555;
  r.press('STO'); r.press('STO');
  r.input('inner', 1);
  r.advance(7200);
  assert.equal(r.sto, null);
  assert.ok(!r.s.ch.includes(119555));
});

test('4.8.2 Last Channels: an active frequency kept 10 s is stored as LAST1', () => {
  const r = unit();
  r.s.last = [];
  r.press('MDE');
  r.input('push'); r.input('inner', 1);
  r.advance(9000); assert.equal(r.s.last.length, 0);
  r.advance(1200); assert.equal(r.s.last[0], 121335);
});

test('4.12.1 Intercom Menu: long IC/SQL, IC VOLUME / IC VOX pages, VOX OFF above +10, long MDE ends', () => {
  const r = unit();
  r.hold('ICSQL');
  has(r, 'IC VOLUME 37');
  r.input('inner', 9); has(r, 'IC VOLUME 46');
  r.press('ICSQL'); has(r, 'IC VOX -15');
  r.input('inner', 30); has(r, 'IC VOX OFF');
  assert.ok(r.voxDisabled);
  r.hold('MDE');
  assert.equal(r.menu, null);
  r.hold('ICSQL'); r.advance(5200);
  assert.equal(r.menu, null, '5 s timeout');
});

test('4.12.2 Pilots Menu: long MDE, BRIGHTNESS then SQUELCH, push on SQUELCH leaves', () => {
  const r = unit();
  r.hold('MDE');
  has(r, 'BRIGHTNESS 50');
  r.input('inner', 10); has(r, 'BRIGHTNESS 60');
  r.press('MDE'); has(r, 'SQUELCH 12');
  r.input('inner', 30); has(r, 'SQUELCH 26');
  r.input('push');
  assert.equal(r.menu, null);
});

test('4.3.2 TX: TX symbol, mode change blocked (display inverted), STUCK PTT after 120 s', () => {
  const r = unit();
  r.input('pttDown');
  has(r, 'TX 120.335');
  r.press('MDE');
  assert.equal(r.s.mode, 'std'); assert.ok(bk(r).flash);
  r.advance(STUCK_MS + 100);
  assert.ok(!r.tx);
  let seen = false; for (let i = 0; i < 6000; i += 250) { r.advance(250); if (screen(r).includes('STUCK PTT')) seen = true; }
  assert.ok(seen);
  r.input('pttUp'); r.input('pttDown');
  assert.ok(r.tx, 'a new transmission after releasing PTT');
});

test('4.13 LOW BATT reappears every 5 seconds', () => {
  const r = unit();
  r.s.sim.volts = 10.2;
  const seen = [];
  for (let i = 0; i < 10000; i += 500) { r.advance(500); seen.push(screen(r).includes('LOW BATT')); }
  assert.ok(seen.filter(Boolean).length >= 4 && seen.includes(false));
});

test('IM 2.8 Installation Setup: MDE at power-up, password 6435, pages, values stored at once', () => {
  const r = unit({ setup: true });
  has(r, 'PASSWORD 0000');
  r.press('STO'); has(r, 'PASSWORD 0000');              // wrong password
  for (const [d, push] of [[6, 1], [4, 1], [3, 1], [5, 0]]) { r.input('inner', d); if (push) r.input('push'); }
  r.press('STO');
  has(r, 'DEVICE INFO');
  r.press('SCN'); has(r, 'DIMMING INPUT');
  r.press('SCN'); has(r, 'BRIGHTNESS');
  r.press('ICSQL'); has(r, 'DIMMING INPUT');            // IC/SQL: previous page
  r.input('inner', 1); r.press('STO');                  // 0 - 14V
  assert.equal(r.s.setup.dim, '14V');
  r.input('push'); has(r, 'ILLUM CURVE');               // BRIGHTNESS hidden with a dimming bus
  r.input('push'); has(r, 'MEM OPTIONS');
  r.press('STO');                                       // CHANNEL STORE off
  assert.equal(r.s.setup.mem.chStore, false);
  r.input('push'); has(r, 'MDE PAGES');
  r.press('STO'); r.input('inner', 1); r.press('STO');  // Standard and Direct Tune off
  r.input('inner', 1); r.press('STO');                  // the last one cannot be deselected
  assert.deepEqual(r.s.setup.pages, { std: false, bat: false, chn: true });
  r.input('vol', -8); r.input('vol', 8); r.advance(3200);   // switching off terminates the setup
  assert.equal(r.s.mode, 'chn');
  r.press('STO'); assert.ok(bk(r).flash, 'storing not possible without CHANNEL STORE');
});

test('IM 2.8.5 ERASE CHN MEM and RECALL DEF.', () => {
  const r = unit({ setup: true });
  for (const [d, push] of [[6, 1], [4, 1], [3, 1], [5, 0]]) { r.input('inner', d); if (push) r.input('push'); }
  r.press('STO');
  while (r.view().bk.title !== 'ERASE CHN MEM') r.press('SCN');
  r.input('inner', 1); r.press('STO');
  assert.ok(r.s.ch.every(f => f == null));
  while (r.view().bk.title !== 'RECALL DEF.') r.press('SCN');
  r.s.setup.lowBatt = 12;
  r.input('inner', 1); r.press('STO');
  assert.equal(r.s.setup.lowBatt, 10.5);
});
