// GTX 330 unit tests: every screen draws with existing glyphs and fits, Flight ID persistence and dialog edge
// cases, NO ADSB / TIS conditions, GTX 328 behavior that the GTX 330 does not share.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GTX330, BOOT_MS, PERSIST_KEY } from '../devices/gtx330/device.js';
import { PAGES } from '../devices/gtx330/config.js';
import { missingGlyphs, textWidth } from '../ui/lcd-gtx.js';
import { UNITS } from '../ui/fonts-gtx.js';

function unit(storage = null) {
  let t = 0;
  const x = new GTX330({ now: () => t, storage });
  x.advance = ms => { t += ms; x.tick(); };
  x.press = k => { x.input('down:' + k); x.input('up:' + k); x.tick(); };
  x.s.sim.onGround = false; x.s.sim.gs = 110;
  x.press('ALT'); x.advance(BOOT_MS + 100);
  return x;
}
function memStorage() { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; }
const problems = x => {
  const out = [];
  for (const o of x.view().gtx.ops) {
    if (o.t === 'unit' && !UNITS[o.id]) out.push(`unit ${o.id}`);
    if (o.t !== 'txt') continue;
    const m = missingGlyphs(o.f, o.s);
    if (m.length) out.push(`${o.f}:${m.join('')} in "${o.s}"`);
    const x0 = o.align === 'r' ? o.x + o.w - textWidth(o.f, o.s) : o.x;
    if (x0 < 0 || (!o.align && o.x + textWidth(o.f, o.s) > 200)) out.push(`overflow "${o.s}"`);
  }
  return out;
};

test('every FUNC page, the dialog and every configuration option draw with existing glyphs and fit', () => {
  const x = unit();
  x.c.contrastMode = 'MAN'; x.c.bkltMode = 'MAN';
  for (const p of x.pages()) { x.page = p; assert.deepEqual(problems(x), [], p); }
  // the longest Flight ID, every letter in the dialog and on the page
  for (const id of ['ABCDEFGH', 'IJKLMNOP', 'QRSTUVWX', 'YZ012345', '6789']) {
    x.s.fltId = id; x.page = 'FLTID'; assert.deepEqual(problems(x), [], id);
    x.press('CRSR'); assert.deepEqual(problems(x), [], `dialog ${id}`);
    x.press('CRSR'); assert.deepEqual(problems(x), [], `editing ${id}`);
    x.press('CLR'); x.press('CLR');
  }
  x.press('OFF'); x.input('down:FUNC'); x.press('ON'); x.input('up:FUNC'); x.advance(BOOT_MS + 100);
  for (let i = 0; i < PAGES.length; i++) {
    x.cfgPage = i;
    assert.deepEqual(problems(x), [], PAGES[i].id);
    for (const [fi, f] of PAGES[i].fields.entries()) for (const o of f.opts || []) {
      x.cfgEdit = { field: fi, draft: o };
      assert.deepEqual(problems(x), [], `${PAGES[i].id} ${f.key}=${o}`);
    }
    x.cfgEdit = null;
  }
});

test('the Flight ID set by the crew is saved; a fresh unit uses the Default Flight ID', () => {
  const st = memStorage();
  const x = unit(st);
  x.s.fltId = 'OKR123'; x.save();
  assert.ok(st.getItem(PERSIST_KEY).includes('OKR123'));
  const y = unit(st);
  assert.equal(y.fltId, 'OKR123');
  assert.equal(unit().fltId, 'OKABC');
});

test('Flight ID dialog: a blank entry is not saved and the dialog stays open; 8 without a default does nothing', () => {
  const x = unit();
  x.c.dfltMode = 'US TAIL'; x.c.addrType = 'HEX';            // no default Flight ID configured
  x.s.fltId = 'OKR123';
  x.page = 'FLTID'; x.press('CRSR');
  assert.ok(!x.view().gtx.ops.some(o => o.s?.includes('8=')), 'no 8= option without a default');
  x.press('8');
  assert.ok(x.dialog);
  x.dialog.chars = []; x.press('CRSR');
  for (let i = 0; i < 8; i++) x.press('CRSR');
  assert.ok(x.dialog && !x.dialog.editing);
  assert.equal(x.fltId, 'OKR123');
});

test('Flight ID dialog: IDENT still works, other keys do not leave it', () => {
  const x = unit();
  x.page = 'FLTID'; x.press('CRSR');
  x.press('IDENT'); assert.ok(x.identActive);
  x.press('FUNC'); x.press('START');
  assert.ok(x.dialog);
});

test('NO ADSB: not with ADS-B TX DISABLE; with ENABLE when the GPS has no position', () => {
  const x = unit();
  const shown = () => x.view().gtx.ops.some(o => o.s === 'NO ADSB');
  x.c.adsbTx = 'DISABLE'; x.s.sim.gpsPos = false;
  assert.ok(!shown());
  x.c.adsbTx = 'ENABLE';
  assert.ok(shown());
  x.s.sim.gpsPos = true;
  assert.ok(!shown());
  x.c.rs1In = 'OFF';                                         // no GPS input configured
  assert.ok(shown());
  x.press('IDENT');
  assert.ok(!shown(), 'IDENT takes the corner');
});

test('TIS alerts need a TIS output and replies', () => {
  const x = unit();
  const seq = () => x.alertSeq;
  let s = seq();
  x.c.out2 = 'GARMIN'; x.input('traffic'); x.tick();
  assert.equal(seq(), s, 'no TIS output configured');
  x.c.rs1Out = 'REMOTE + TIS'; x.input('traffic'); x.tick();
  assert.equal(seq(), s + 1);
  s = seq();
  x.press('STBY'); x.input('traffic'); x.tick();
  assert.equal(seq(), s, 'no TIS without replies');
});

test('AUDIO MODE page MESSAGE 3 and 5 play the TIS messages', () => {
  const x = unit();
  x.playMessage(3); assert.equal(x.alert.id, 'traffic');
  x.playMessage(5); assert.equal(x.alert.id, 'traffic-not-available');
  x.playMessage(2); assert.equal(x.alert.id, 'leaving-altitude');
});
