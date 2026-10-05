// KMA 20 unit tests: audio routing, AUTO, mic muting, EXT, marker reception and keying, lamps, persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KMA20, MARKER, SPEAKER, OFF, PHONE, RECEIVERS, HI_FACTOR, LO_HALF_M } from '../devices/kma20/device.js';

function unit(storage = null) {
  let t = 0;
  const k = new KMA20({ now: () => t, storage });
  k.advance = ms => { for (let i = 0; i < ms; i += 10) { t += 10; k.tick(); } };
  k.at = ms => { t = ms; };
  return k;
}
function memStorage() { const m = {}; return { getItem: x => m[x] ?? null, setItem: (x, v) => { m[x] = v; } }; }
const setAll = (k, pos) => { for (const r of [...RECEIVERS, 'AUTO']) k.s.sw[r] = pos; };

test('each toggle routes its receiver: up speaker, center off, down phones', () => {
  const k = unit();
  setAll(k, OFF);
  assert.deepEqual(k.routes().speaker, []); assert.deepEqual(k.routes().phone, []);
  for (const r of RECEIVERS) {
    setAll(k, OFF); k.s.sw[r] = SPEAKER;
    assert.deepEqual(k.routes().speaker, [r]); assert.deepEqual(k.routes().phone, []);
    k.s.sw[r] = PHONE;
    assert.deepEqual(k.routes().phone, [r]); assert.deepEqual(k.routes().speaker, []);
  }
});

test('toggles move one position per step and stop at the ends', () => {
  const k = unit();
  k.s.sw.NAV1 = OFF;
  k.input('sw', ['NAV1', 1]); assert.equal(k.s.sw.NAV1, SPEAKER);
  k.input('sw', ['NAV1', 1]); assert.equal(k.s.sw.NAV1, SPEAKER);
  k.input('sw', ['NAV1', -1]); k.input('sw', ['NAV1', -1]); k.input('sw', ['NAV1', -1]);
  assert.equal(k.s.sw.NAV1, PHONE);
});

test('AUTO adds the COM of the mic selector; nothing on EXT', () => {
  const k = unit();
  setAll(k, OFF); k.s.sw.AUTO = SPEAKER;
  k.s.mic = 'COM1'; assert.deepEqual(k.routes().speaker, ['COM1']);
  k.s.mic = 'COM2'; assert.deepEqual(k.routes().speaker, ['COM2']);
  k.s.mic = 'EXT'; assert.deepEqual(k.routes().speaker, []);
  k.s.mic = 'COM1'; k.s.sw.AUTO = PHONE; assert.deepEqual(k.routes().phone, ['COM1']);
  k.s.sw.COM2 = SPEAKER; assert.deepEqual(k.routes().speaker, ['COM2'], 'the COM toggles still work');
});

test('the mic selector has three positions with stops', () => {
  const k = unit();
  k.s.mic = 'COM1';
  k.input('mic', -1); assert.equal(k.s.mic, 'COM1');
  k.input('mic', 1); assert.equal(k.s.mic, 'COM2');
  k.input('mic', 1); k.input('mic', 1); assert.equal(k.s.mic, 'EXT');
});

test('keying the mic mutes the speaker, not the phones; the transmitting COM sends its sidetone', () => {
  const k = unit();
  setAll(k, OFF); k.s.sw.COM1 = SPEAKER; k.s.sw.COM2 = PHONE; k.s.mic = 'COM1';
  k.simulateCall('COM1'); k.simulateCall('COM2');
  k.input('pttDown');
  const m = k.mix();
  assert.ok(m.muted); assert.equal(m.tx, 'COM1');
  assert.ok(m.inputs.COM1.sidetone && !m.inputs.COM1.call, 'COM 1 transmits: its sidetone, no reception');
  assert.ok(m.inputs.COM2 && m.phone.includes('COM2'));
  k.input('pttUp'); assert.ok(!k.mix().muted);
});

test('EXT: the amplifier output goes to the ramp hail speaker; the PTT keys no transmitter', () => {
  const k = unit();
  k.s.mic = 'EXT'; k.input('pttDown');
  assert.ok(k.routes().ext); assert.equal(k.tx, 'EXT');
});

test('marker: HI starts earlier than LO; the outer marker on HI about one mile before', () => {
  const k = unit();
  const om = k.approach().markers.find(m => m.type === 'OM'), d = k.markerDist(om);
  k.s.hi = false; k.dist = d + 0.5; assert.equal(k.markerSignal(), null);
  k.s.hi = true; assert.equal(k.markerSignal()?.type, 'OM');
  const hiNm = LO_HALF_M.OM * HI_FACTOR / 1852;
  assert.ok(hiNm > 0.8 && hiNm < 1.2, `HI range ${hiNm} NM`);
  k.s.hi = false; k.dist = d; assert.equal(k.markerSignal()?.type, 'OM');
  k.dist = k.markerDist(k.approach().markers.find(m => m.type === 'MM')); assert.equal(k.markerSignal()?.type, 'MM');
});

test('marker keying: outer two dashes a second, middle dot and dash', () => {
  let on = 0, edges = 0, prev = false;
  for (let t = 0; t < 1000; t += 5) { const k = KMA20.keyed('OM', t); if (k) on += 5; if (k && !prev) edges++; prev = k; }
  assert.equal(edges, 2); assert.equal(on, 750);
  const runs = []; let run = 0; prev = false;
  for (let t = 0; t < MARKER.MM.cycle; t += 1) { const k = KMA20.keyed('MM', t); if (k) run++; else if (prev) { runs.push(run); run = 0; } prev = k; }
  assert.deepEqual(runs, [100, 300], 'a dot then a dash');
});

test('lamps: the marker lamp flashes with the keying, TEST lights all three, brightness follows the cockpit light', () => {
  const k = unit();
  k.dist = k.markerDist(k.approach().markers[0]);
  k.at(100); assert.ok(k.view().lamps.O > 0); assert.equal(k.view().lamps.M, 0);
  k.at(450); assert.equal(k.view().lamps.O, 0, 'between the dashes');
  k.dist = 12; k.s.hi = false; k.input('mkr', -1); assert.ok(k.test);
  const v = k.view(); assert.ok(v.lamps.A > 0 && v.lamps.O > 0 && v.lamps.M > 0); assert.equal(v.mkr, 'TEST');
  k.input('mkrUp'); assert.equal(k.view().mkr, 'LO');
  k.input('mkr', -1); k.s.sim.ambient = 0; const night = k.view().lamps.A;
  k.s.sim.ambient = 100; assert.ok(k.view().lamps.A > night);
});

test('MKR switch: HI up, LO center; TEST only from LO and only while held', () => {
  const k = unit();
  k.s.hi = true;
  k.input('mkr', -1); assert.equal(k.view().mkr, 'LO');
  k.input('mkr', -1); assert.equal(k.view().mkr, 'TEST');
  k.input('mkrUp'); assert.equal(k.view().mkr, 'LO');
  k.input('mkr', 1); assert.equal(k.view().mkr, 'HI');
});

test('approach: flying at the ground speed closes the distance', () => {
  const k = unit();
  k.dist = 5; k.s.sim.gs = 120; k.flying = true;
  k.advance(30000);
  assert.ok(Math.abs(k.dist - 4) < 0.01, `${k.dist}`);
});

test('avionics master off: no audio, no lamps', () => {
  const k = unit();
  k.input('mkr', -1); k.input('mkr', -1);
  k.setAircraftPower(false);
  assert.equal(k.mix().power, false);
  assert.deepEqual(k.view().lamps, { A: 0, O: 0, M: 0 });
});

test('switch positions, mic selector and tuned stations persist; PTT and TEST do not', () => {
  const st = memStorage();
  const a = unit(st);
  a.input('sw', ['NAV2', -1]); a.input('mic', 1); a.input('mkr', -1);
  a.s.tune.COM1 = 118110; a.input('pttDown'); a.save();
  const b = unit(st);
  assert.equal(b.s.sw.NAV2, PHONE); assert.equal(b.s.mic, 'COM2'); assert.equal(b.s.hi, false);
  assert.equal(b.s.tune.COM1, 118110); assert.ok(!b.ptt && !b.test);
});
