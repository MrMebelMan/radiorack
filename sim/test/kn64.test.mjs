// KN 64 DME: tuning, modes, search / lock / memory, range, ground speed and time-to-station.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KN64, PERSIST_KEY, SEARCH_MS, MEMORY_MS, DME_STATIONS } from '../devices/kn64/device.js';

const text = v => v.ch.map((c, i) => c + (v.dp[i] ? '.' : '')).join('');
function unit(storage = null) {
  let t = 0;
  const k = new KN64({ now: () => t, storage });
  k.advance = ms => { for (let i = 0; i < ms; i += 50) { t += 50; k.tick(); } };
  return k;
}
const memStore = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('tuning: knobs wrap within 108.00-117.95, the inner knob does not carry into the MHz', () => {
  const k = unit();
  k.s.freq = 117900;
  k.input('inner', 1); assert.equal(k.s.freq, 117000);
  k.input('outer', 1); assert.equal(k.s.freq, 108000);
  k.input('outer', -1); assert.equal(k.s.freq, 117000);
  k.input('pull'); assert.equal(k.s.freq, 117050); assert.ok(k.pulled);
  k.input('inner', -1); assert.equal(k.s.freq, 117950);
});

test('display: FREQ shows dashes and the frequency before lock, the range after', () => {
  const k = unit();
  assert.equal(text(k.view()), '---112.60');
  k.advance(SEARCH_MS + 100);
  assert.match(text(k.view()), /^\d\d\.\d112\.60$/);
});

test('no lock at field elevation (line of sight), lock in the air', () => {
  const k = unit();
  k.s.sim.alt = 900;                        // below the OKL DME antenna (1230 ft)
  k.advance(3000);
  assert.ok(!k.locked);
  k.s.sim.alt = 3000;
  k.advance(SEARCH_MS + 100);
  assert.ok(k.locked);
});

test('range format: 0.1 NM below 100, whole miles from 100 with the decimal point off', () => {
  const k = unit();
  k.s.sim.alt = 12000; k.s.sim.posId = 'LKPR'; k.s.freq = 114450;   // BNO BRNO, 110 NM from Ruzyne
  k.advance(SEARCH_MS + 100);
  const v = k.view();
  assert.ok(k.measured().range >= 100);
  assert.match(text(v).slice(0, 3), /^\d{3}$/);
  assert.equal(v.dp[1], false);
});

test('ground speed and time-to-station flying toward the station; TTS capped at 99', () => {
  const k = unit();
  k.s.sim.trk = 270; k.s.sim.gs = 120;
  k.input('func', 1);                       // GS/T on OKL 112.60
  k.advance(SEARCH_MS + 100);
  let m = k.measured();
  assert.equal(m.tts, 99, 'not moving: no groundspeed');
  k.setFlying(true); k.advance(6000);
  m = k.measured();
  assert.ok(m.gs > 105 && m.gs <= 121, `gs ${m.gs}`);
  assert.equal(m.tts, Math.round(m.range / m.gs * 60));
});

test('memory: the last values stay 11-15 s after the signal is lost, then dashes', () => {
  const k = unit();
  k.advance(SEARCH_MS + 100);
  const before = text(k.view());
  k.s.sim.alt = 0;                          // signal lost
  k.advance(MEMORY_MS - 500);
  assert.equal(text(k.view()), before);
  assert.equal(k.ident, null, 'no ident while on memory');
  k.advance(1000);
  assert.ok(!k.locked);
  assert.equal(text(k.view()).slice(0, 3), '---');
});

test('RMT follows the NAV receiver and re-searches on a new frequency', () => {
  const k = unit();
  k.input('func', -1);
  k.advance(SEARCH_MS + 100);
  assert.equal(k.measured().st.id, 'NER');
  k.s.remote = 112600; k.tick();
  assert.ok(!k.locked);
  k.advance(SEARCH_MS + 100);
  assert.equal(k.measured().st.id, 'OKL');
  assert.ok(k.view().ann.RMT);
});

test('every NAVAID has a DME antenna with an elevation', () => {
  for (const st of DME_STATIONS) assert.ok(st.dme.elev > 0 && st.dme.lat && st.dme.lon, st.id);
});

test('power: the avionics master and the ON/OFF switch; switch positions persist', () => {
  const store = memStore();
  const k = unit(store);
  k.setAircraftPower(false); assert.equal(k.view().power, false);
  k.setAircraftPower(true); assert.equal(k.view().power, true);
  k.input('func', 1); k.input('pull'); k.input('power');
  assert.equal(k.view().power, false);
  const k2 = unit(store);
  assert.equal(k2.s.func, 'GS/T'); assert.equal(k2.s.on, false);
  assert.ok(store.getItem(PERSIST_KEY));
});
