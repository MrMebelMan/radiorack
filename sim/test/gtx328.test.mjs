// GTX 328 unit tests: fonts, conversions, automatic GND, trend arrows, display mode, persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GTX328, BOOT_MS, usTailToHex, validAddr } from '../devices/gtx328/device.js';
import { PAGES } from '../devices/gtx328/config.js';
import { gtxBitmap, missingGlyphs, textWidth } from '../ui/lcd-gtx.js';

function unit(storage = null) {
  let t = 0;
  const x = new GTX328({ now: () => t, storage });
  x.advance = ms => { t += ms; x.tick(); };
  x.press = k => { x.input('down:' + k); x.input('up:' + k); x.tick(); };
  x.press('ALT'); x.advance(BOOT_MS + 100);
  return x;
}
function memStorage() { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; }
const problems = x => {
  const out = [];
  for (const o of x.view().gtx.ops) if (o.t === 'txt') {
    const m = missingGlyphs(o.f, o.s);
    if (m.length) out.push(`${o.f}:${m.join('')} in "${o.s}"`);
    if (!o.align && o.x + textWidth(o.f, o.s) > 200) out.push(`overflow "${o.s}"`);
  }
  return out;
};

test('every screen and configuration page draws with existing glyphs and fits the 200-dot display', () => {
  const x = unit();
  for (const p of x.pages()) { x.page = p; assert.deepEqual(problems(x), [], p); }
  x.c.tempSensor = 'YES'; x.c.contrastMode = 'MAN'; x.c.bkltMode = 'MAN';
  for (const p of x.pages()) { x.page = p; assert.deepEqual(problems(x), [], p); }
  x.press('OFF'); x.input('down:FUNC'); x.press('ON'); x.input('up:FUNC'); x.advance(BOOT_MS + 100);
  for (let i = 0; i < PAGES.length; i++) {
    x.cfgPage = i;
    assert.deepEqual(problems(x), [], PAGES[i].id);
    // every option of every list field fits too
    for (const [fi, f] of PAGES[i].fields.entries()) for (const o of f.opts || []) {
      x.cfgEdit = { field: fi, draft: o };
      assert.deepEqual(problems(x), [], `${PAGES[i].id} ${f.key}=${o}`);
    }
    x.cfgEdit = null;
  }
});

test('bitmap: text, units and inversion', () => {
  const bm = gtxBitmap([{ t: 'rect', x: 0, y: 0, w: 3, h: 1 }, { t: 'inv', x: 1, y: 0, w: 1, h: 1 }]);
  assert.deepEqual([...bm.slice(0, 4)], [1, 0, 1, 0]);
  assert.ok(textWidth('c', '7000') === 72, 'code digits: 18-dot pitch');
});

test('US N-number to ICAO address (FAA allocation)', () => {
  assert.equal(usTailToHex('1'), 'A00001');
  assert.equal(usTailToHex('12345'), 'A061D9');
  assert.equal(usTailToHex('99999'), 'ADF7C7');
  assert.equal(usTailToHex('0A'), null);
  assert.ok(validAddr({ addrType: 'HEX', addr: '49D3A5' }));
  assert.ok(!validAddr({ addrType: 'HEX', addr: '000000' }));
});

test('no valid address at power-up: the unit prompts for one (IM 5.2.12)', () => {
  let t = 0;
  const x = new GTX328({ now: () => t });
  x.c.addr = '';
  x.input('down:ALT'); x.input('up:ALT'); t += BOOT_MS + 1; x.tick();
  assert.ok(x.addrPrompt && !x.operating);
});

test('automatic GND: squat switch, after the DELAY TIME on landing', () => {
  const x = unit();
  x.c.squat = 'YES'; x.s.sim.onGround = false; x.advance(100);
  assert.equal(x.opMode, 'ALT');
  x.s.sim.onGround = true; x.advance(100);
  assert.equal(x.opMode, 'ALT', 'waits the delay time');
  x.advance(24000);
  assert.equal(x.opMode, 'GND');
  x.s.sim.onGround = false; x.advance(100);
  assert.equal(x.opMode, 'ALT');
});

test('automatic GND from GPS ground speed: airborne at 35 kt', () => {
  const x = unit();
  x.c.rs1In = 'GPS'; x.s.sim.gs = 10; x.advance(100);
  assert.equal(x.opMode, 'GND');
  x.s.sim.gs = 60; x.advance(100);
  assert.equal(x.opMode, 'ALT');
});

test('PRESSURE ALT: flight level, feet, meters; trend arrow above VS RATE', () => {
  const x = unit();
  x.s.sim.alt = 12340;
  const txt = () => x.view().gtx.ops.filter(o => o.t === 'txt').map(o => o.s).join(' ');
  const arrows = () => x.view().gtx.ops.filter(o => o.t === 'unit' && /^(up|dn)/.test(o.id)).map(o => o.id);
  assert.ok(txt().includes('FL 123'));
  x.c.format = 'FEET'; assert.ok(txt().includes('12300'));
  x.c.format = 'METERS'; assert.ok(txt().includes('3761'));
  x.c.format = 'FLIGHT LVL'; x.s.sim.alt = -1000; assert.ok(txt().includes('FL -010'), 'below sea level: three digits with a minus');
  x.s.sim.alt = 12340;
  x.s.sim.vs = 300; assert.deepEqual(arrows(), []);
  x.s.sim.vs = 600; assert.deepEqual(arrows(), ['up']);
  x.s.sim.vs = -1200; assert.deepEqual(arrows(), ['dnL']);
  x.s.sim.encoder = false; x.c.format = 'FLIGHT LVL'; assert.ok(txt().includes('---'));
});

test('display mode AUTO: positive above the photocell LEVEL, negative below', () => {
  const x = unit();
  x.s.sim.ambient = 90; assert.ok(x.view().gtx.pos);
  x.s.sim.ambient = 20; assert.ok(!x.view().gtx.pos);
  x.c.dispMode = 'PSTV'; assert.ok(x.view().gtx.pos);
});

test('the code and configuration persist; operating states do not', () => {
  const st = memStorage();
  const a = unit(st);
  a.press('1'); a.press('2'); a.press('3'); a.press('4');
  a.c.vfrKey = 'DISABLE'; a.save();
  const b = unit(st);
  assert.equal(b.s.code, '1234');
  assert.equal(b.c.vfrKey, 'DISABLE');
  assert.equal(b.opMode, 'ALT');
});

test('avionics master turn-on wired: the unit comes on and goes off with the master, in the last mode', () => {
  const x = unit();
  x.press('ON'); x.press('OFF');
  x.setMasterWiring(true);
  assert.ok(x.power, 'master already on: powers on');
  assert.equal(x.mode, 'ON');
  x.setAircraftPower(false); assert.ok(!x.power);
  x.setAircraftPower(true); assert.ok(x.power);
  x.setMasterWiring(false); x.press('OFF');
  x.setAircraftPower(false); x.setAircraftPower(true);
  assert.ok(!x.power, 'not wired: only the keys power it on');
});
