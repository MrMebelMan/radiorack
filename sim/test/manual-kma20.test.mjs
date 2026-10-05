// KMA 20 brochure ("Operating your KMA 20", 006-8200-05) and Installation Manual (006-0044-02 Rev 2)
// procedures, replayed literally, one input per step, on a unit used elsewhere first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KMA20, SPEAKER, OFF, PHONE } from '../devices/kma20/device.js';

function unit() {
  let t = 0;
  const k = new KMA20({ now: () => t });
  k.advance = ms => { for (let i = 0; i < ms; i += 10) { t += 10; k.tick(); } };
  // used elsewhere first: NAV 1 on the phones, mic on EXT, MKR on LO, COM 2 on the speaker
  k.input('sw', ['NAV1', -1]); k.input('mic', 1); k.input('mic', 1); k.input('mkr', -1); k.input('sw', ['COM2', 1]);
  return k;
}
const hearSpeaker = (k, r) => { const m = k.mix(); return !m.muted && !m.ext && m.speaker.includes(r); };
const hearPhone = (k, r) => k.mix().phone.includes(r);

test('B AUTO SWITCH: COM toggles OFF, AUTO to SPEAKER, the COM receiver follows the microphone selector', () => {
  const k = unit();
  // "Put both COMM receiver toggle switches on OFF"
  while (k.s.sw.COM1 !== OFF) k.input('sw', ['COM1', k.s.sw.COM1 > OFF ? -1 : 1]);
  while (k.s.sw.COM2 !== OFF) k.input('sw', ['COM2', k.s.sw.COM2 > OFF ? -1 : 1]);
  // "Set AUTO to either SPEAKER or PHONE"
  while (k.s.sw.AUTO !== SPEAKER) k.input('sw', ['AUTO', 1]);
  // "you will automatically hear the receiver of the COMM transmitter selected as you change the rotary"
  k.input('mic', -1);                       // EXT -> COM 2
  assert.ok(hearSpeaker(k, 'COM2') && !hearSpeaker(k, 'COM1'));
  k.input('mic', -1);                       // COM 2 -> COM 1
  assert.ok(hearSpeaker(k, 'COM1') && !hearSpeaker(k, 'COM2'));
  k.input('mic', 1);                        // back to COM 2
  assert.ok(hearSpeaker(k, 'COM2') && !hearSpeaker(k, 'COM1'));
});

test('B Audio reception control: one radio on the speaker while the copilot listens to another on the phones', () => {
  const k = unit();
  k.input('mic', -1);                       // EXT -> COM 2: the amplifier feeds the cockpit speaker (IM 3.2)
  k.input('sw', ['NAV2', 1]);               // NAV 2 up: SPEAKER
  while (k.s.sw.ADF !== PHONE) k.input('sw', ['ADF', -1]);   // ADF down: PHONE
  assert.ok(hearSpeaker(k, 'NAV2') && !hearPhone(k, 'NAV2'));
  assert.ok(hearPhone(k, 'ADF') && !hearSpeaker(k, 'ADF'));
  k.input('sw', ['ADF', 1]);                // middle: OFF
  assert.ok(!hearPhone(k, 'ADF') && !hearSpeaker(k, 'ADF'));
});

test('B Microphone transmission control: pressing the mike button mutes the receivers; EXT feeds the external speaker', () => {
  const k = unit();
  k.input('mic', -1); k.input('mic', -1);   // COM 1
  k.input('sw', ['NAV2', 1]);
  k.input('pttDown');
  assert.equal(k.tx, 'COM1'); assert.ok(!hearSpeaker(k, 'NAV2'));
  k.input('pttUp');
  assert.ok(hearSpeaker(k, 'NAV2'));
  k.input('mic', 1); k.input('mic', 1);     // EXT: receivers heard in the EXT speaker until the mic is keyed
  assert.ok(k.mix().ext && k.mix().speaker.includes('NAV2'));
  k.input('pttDown');
  assert.equal(k.tx, 'EXT'); assert.ok(k.mix().muted);
});

test('IM 3.1: HI until the indication, then LO for passage, then the marker audio off and the light only', () => {
  const k = unit();
  const om = k.approach().markers.find(m => m.type === 'OM'), d = k.markerDist(om);
  k.dist = d + 1.5; k.s.sim.gs = 120;
  k.input('mkr', 1);                        // high sensitivity first
  while (!k.markerSignal()) { k.flying = true; k.advance(100); }
  const hiAt = k.dist - d;
  assert.ok(hiAt > 0.8 && hiAt < 1.1, `aural tone about one mile before the outer marker (${hiAt.toFixed(2)} NM)`);
  k.input('mkr', -1);                       // low sensitivity: shorter indication
  assert.equal(k.markerSignal(), null);
  while (!k.markerSignal()) k.advance(100);
  const loAt = k.dist - d;
  assert.ok(loAt < hiAt / 3);
  while (k.s.sw.MKR !== OFF) k.input('sw', ['MKR', k.s.sw.MKR > OFF ? -1 : 1]);   // marker audio off
  assert.ok(!hearSpeaker(k, 'MKR') && !hearPhone(k, 'MKR'));
  let lit = false;
  for (let i = 0; i < 10; i++) { k.advance(50); if (k.view().lamps.O > 0) lit = true; }
  assert.ok(lit, 'passage from the light only');
});
