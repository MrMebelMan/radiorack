// King KMA 20 TSO audio control system with marker beacon receiver, version 066-1024-03
// (standard panel: AUTO, COM 1, COM 2, NAV 1, NAV 2, ADF, DME, MKR). Source of truth: the brochure
// "Operating your KMA 20 Audio Control System" 006-8200-05 ("B") and the KMA 20/KR 21 Installation
// Manual 006-0044-02 Rev 2 ("IM"). Assumptions are listed in ASSUMPTIONS.md.
// Same shape as the other units: input(evt, arg), tick(), view(); mix() feeds sound.js.
import { clamp } from '../../core/util.js';
import { distNm } from '../../core/geo.js';
import { makeStore } from '../../core/persist.js';
import { NAVAIDS, NDBS, APPROACHES } from '../../data/lk-nav.js';

export const PERSIST_KEY = 'kma20-sim-v1';
// receiver audio selector toggles, left to right (IM 1.1: "a series of eight audio selector switches")
export const TOGGLES = ['AUTO', 'COM1', 'COM2', 'NAV1', 'NAV2', 'ADF', 'DME', 'MKR'];
export const RECEIVERS = TOGGLES.slice(1);
export const MIC_POS = ['COM1', 'COM2', 'EXT'];          // microphone selector (B figure)
// toggle positions: up = SPEAKER, center = OFF, down = PHONE (B "Audio reception control")
export const SPEAKER = 1, OFF = 0, PHONE = -1;

// Marker beacons (IM 3.1): outer 400 Hz dashes two per second (blue), middle 1300 Hz alternate
// dots and dashes (amber), inner / airway 3000 Hz (white). Dot and dash lengths are not stated:
// ICAO Annex 10 rates (dots 6 per second, dashes 2 per second, middle 95 combinations a minute).
export const MARKER = {
  OM: { hz: 400, lamp: 'O', cycle: 500, on: [[0, 375]] },
  MM: { hz: 1300, lamp: 'M', cycle: 632, on: [[0, 100], [200, 500]] },
  IM: { hz: 3000, lamp: 'A', cycle: 167, on: [[0, 83]] },
};
// Reception: the cone half-width on LO sensitivity (ICAO Annex 10 coverage, not in the KMA manuals);
// HI (500 µV against 2,000 µV) widens it so the outer marker tone begins about one mile before
// the station (IM 3.1).
export const LO_HALF_M = { OM: 300, MM: 150, IM: 75 };
export const HI_FACTOR = 6;
export const IDENT_HZ = { NAV: 1020, ADF: 1020, DME: 1350 };   // VOR/ILS 1020 Hz; NDB not published; DME 1350 Hz (ICAO)

const stationKey = n => `${n.id}/${n.f}`;
export const NAV_LIST = NAVAIDS.filter(n => n.type !== 'DME');
export const DME_LIST = NAVAIDS;                          // every VOR/DME, DME and ILS DME
export const ADF_LIST = NDBS;
export const findStation = (list, key) => list.find(n => stationKey(n) === key) || null;
export { stationKey };

export function defaultSettings() {
  const kd = stationKey(NAVAIDS.find(n => n.id === 'KD'));
  return {
    // B "AUTO SWITCH": COM toggles OFF, AUTO on SPEAKER; MKR audio on the speaker
    sw: { AUTO: SPEAKER, COM1: OFF, COM2: OFF, NAV1: OFF, NAV2: OFF, ADF: OFF, DME: OFF, MKR: SPEAKER },
    mic: 'COM1',
    hi: true,                                                // MKR sensitivity HI (up) / LO (center)
    tune: {
      COM1: 123610, COM2: 120880,                            // BOLESLAV RADIO (LKMB), KBELY TOWER (LKKB)
      NAV1: kd, NAV2: stationKey(NAVAIDS.find(n => n.id === 'OKL')),
      ADF: stationKey(NDBS.find(n => n.id === 'KD')), DME: kd,
    },
    appr: 'LKKB24',
    sim: { ambient: 70, headset: true, gs: 90 },
  };
}

export class KMA20 {
  constructor({ now = () => performance.now(), storage = null } = {}) {
    this.now = now;
    this.store = makeStore(storage, PERSIST_KEY);
    this.s = defaultSettings();
    const saved = this.store.load();
    if (saved) {
      const d = this.s;
      Object.assign(d, saved, { sw: { ...d.sw, ...(saved.sw || {}) }, tune: { ...d.tune, ...(saved.tune || {}) }, sim: { ...d.sim, ...(saved.sim || {}) } });
    }
    this.bus = true;          // avionics master
    this.ptt = false;
    this.test = false;        // MKR switch held in TEST
    this.calls = {};          // COM1 / COM2 -> { start, until, clip }
    this.dist = 8;            // approach: distance to the threshold (NM)
    this.flying = false;
    this.last = this.now();
  }
  save() { this.store.save(this.s); }
  factoryReset() { this.s = defaultSettings(); this.save(); }
  get power() { return this.bus; }
  setAircraftPower(on) { this.bus = on; if (!on) { this.calls = {}; } }

  input(evt, arg) {
    const s = this.s;
    switch (evt) {
      case 'sw': {             // [toggle, +1 up / -1 down]
        const [k, dir] = arg;
        s.sw[k] = clamp(s.sw[k] + dir, PHONE, SPEAKER);
        this.save(); break;
      }
      case 'mic': {            // rotary: one detent per step, stops at both ends
        s.mic = MIC_POS[clamp(MIC_POS.indexOf(s.mic) + arg, 0, MIC_POS.length - 1)];
        this.save(); break;
      }
      case 'mkr':              // HI (up) / LO (center); TEST (down) is momentary
        if (arg > 0) { this.test = false; s.hi = true; } else if (s.hi) s.hi = false; else this.test = true;
        this.save(); break;
      case 'mkrUp': this.test = false; break;
      case 'pttDown': this.ptt = true; break;
      case 'pttUp': this.ptt = false; break;
    }
  }

  // a station transmits on COM 1 / COM 2 (clip = recorded call)
  simulateCall(com, ms = 4000, clip = 0) {
    if (!this.power) return;
    const now = this.now();
    this.calls[com] = { start: now, until: now + ms, clip };
  }

  tick() {
    const now = this.now(), dt = (now - this.last) / 1000;
    this.last = now;
    for (const k of Object.keys(this.calls)) if (now > this.calls[k].until) delete this.calls[k];
    if (this.flying) {
      this.dist = Math.max(0, this.dist - this.s.sim.gs * dt / 3600);
      if (this.dist === 0) this.flying = false;
    }
  }

  // transmitter keyed by the PTT: the one the mic selector feeds (EXT: the ramp hail speaker)
  get tx() { return this.ptt && this.power ? this.s.mic : null; }

  // IM 3.2 / B: each toggle sends its receiver to the speaker (up) or the phones (down); AUTO adds
  // the receiver of the COM the mic selector is on (IM 1.1). EXT moves the amplifier output from
  // the cockpit speaker to the ramp hail speaker. Keying the mic mutes the amplifier input.
  routes() {
    const s = this.s, speaker = new Set(), phone = new Set();
    for (const k of RECEIVERS) {
      if (s.sw[k] === SPEAKER) speaker.add(k);
      if (s.sw[k] === PHONE) phone.add(k);
    }
    if (s.mic !== 'EXT' && s.sw.AUTO !== OFF) (s.sw.AUTO === SPEAKER ? speaker : phone).add(s.mic);
    return { speaker: RECEIVERS.filter(k => speaker.has(k)), phone: RECEIVERS.filter(k => phone.has(k)), ext: s.mic === 'EXT', muted: this.ptt };
  }

  approach() { return APPROACHES.find(a => a.id === this.s.appr) || APPROACHES[0]; }
  // distance of each marker to the threshold (NM): published, else from the coordinates
  markerDist(m, a = this.approach()) { return m.toThr != null ? m.toThr / 1852 : distNm(m, a.thr); }
  // marker received now (power on, inside the cone for the sensitivity): { type } or null
  markerSignal() {
    if (!this.power) return null;
    const a = this.approach();
    for (const m of a.markers) {
      const half = LO_HALF_M[m.type] * (this.s.hi ? HI_FACTOR : 1) / 1852;
      if (Math.abs(this.dist - this.markerDist(m, a)) <= half) return { type: m.type };
    }
    return null;
  }
  // keying of a marker at time t (ms): tone and lamp on
  static keyed(type, t) {
    const k = MARKER[type], p = ((t % k.cycle) + k.cycle) % k.cycle;
    return k.on.some(([a, b]) => p >= a && p < b);
  }
  // lamp brightness follows the photocell: brighter in daylight, dimmer at night (B, IM 1.1)
  lampLevel() { return 0.35 + 0.65 * this.s.sim.ambient / 100; }

  // signals present on each receiver input
  inputs() {
    const now = this.now(), s = this.s, out = {};
    for (const c of ['COM1', 'COM2']) {
      const call = this.calls[c];
      // the transceiver keyed: no reception, its sidetone comes back on its audio line instead
      if (this.tx === c) out[c] = { sidetone: true };
      else if (call) out[c] = { call };
    }
    const st = { NAV1: findStation(NAV_LIST, s.tune.NAV1), NAV2: findStation(NAV_LIST, s.tune.NAV2), ADF: findStation(ADF_LIST, s.tune.ADF), DME: findStation(DME_LIST, s.tune.DME) };
    for (const [k, n] of Object.entries(st)) if (n) out[k] = { ident: n.id, hz: IDENT_HZ[k.replace(/\d/, '')] };
    const mk = this.markerSignal();
    if (mk) out.MKR = { marker: mk.type, keyed: KMA20.keyed(mk.type, now) };
    return out;
  }

  // what sound.js plays: per input its signal and the outputs it goes to
  mix() {
    if (!this.power) return { power: false };
    const r = this.routes();
    return { power: true, ...r, inputs: this.inputs(), headset: this.s.sim.headset, tx: this.tx };
  }

  view() {
    const mk = this.markerSignal(), lit = this.power ? this.lampLevel() : 0;
    const lamps = { A: 0, O: 0, M: 0 };
    if (this.power && this.test) lamps.A = lamps.O = lamps.M = lit;      // lamp test: all three
    else if (mk && KMA20.keyed(mk.type, this.now())) lamps[MARKER[mk.type].lamp] = lit;
    return { sw: { ...this.s.sw }, mic: this.s.mic, mkr: this.test ? 'TEST' : this.s.hi ? 'HI' : 'LO', lamps };
  }
}
