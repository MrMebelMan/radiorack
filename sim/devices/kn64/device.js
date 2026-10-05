// Bendix/King KN 64 DME (066-1088-00, black face plate). Source of truth: the Silver Crown Plus
// Pilot's Guide, KN 62A and KN 64 pages 25-26 ("PG"), and the KN 62/62A/64 Installation Manual
// 006-00144-0007 Rev 7 ("IM": 1.3 specifications, 3.1 operation). Assumptions are listed in
// ASSUMPTIONS.md. Same shape as the other units: input(evt, arg), tick(), view().
import { wrap, clamp } from '../../core/util.js';
import { distNm } from '../../core/geo.js';
import { movePos, FLIGHT_VAR } from '../../core/nav.js';
import { makeStore } from '../../core/persist.js';
import { POSITIONS } from '../../data/lk.js';
import { NAVAIDS } from '../../data/lk-nav.js';

export const PERSIST_KEY = 'kn64-sim-v1';
export const FUNCS = ['RMT', 'FREQ', 'GS/T'];           // function switch, left to right (PG figure)
export const MHZ_MIN = 108, MHZ_MAX = 117;               // 200 channels, 108.00-117.95 (IM 1.2, tables 1-1..1-3)
export const SEARCH_MS = 1000;                           // IM 1.3 "SEARCH TIME: 1.0 second nominal"
export const MEMORY_MS = 13000;                          // IM 1.3 "MEMORY TIME: 11 to 15 seconds" (midpoint, not stated)
export const MAX_RANGE_NM = 389;                         // IM 1.3 "MAXIMUM DISPLAY RANGE: 389 nautical miles"
export const LOS_K = 1.23;                               // radio line of sight 1.23 * sqrt(ft) NM (not in the manuals)
export const GS_WINDOW_MS = 3000;                        // ground speed: range rate over the last 3 s (not stated)
const FT_PER_NM = 6076.12;

// the stations a DME channel can lock to: every navaid with a DME (AIP ENR 4.1 / AD 2.19)
export const DME_STATIONS = NAVAIDS.filter(n => n.dme);
// what the NAV receiver can be tuned to (RMT channeling): VORs and ILSs
export const NAV_LIST = NAVAIDS.filter(n => n.type !== 'DME');

export function defaultSettings() {
  return {
    on: true,
    func: 'FREQ',
    freq: 112600,            // kHz, internal channel (OKL PRAHA DVOR/DME); x.x5 when the inner knob is out
    held: 112600,            // GS/T frequency hold
    remote: 112250,          // NAV receiver frequency for RMT (NER NERATOVICE VOR/DME)
    sim: { posId: 'LKKB', gs: 120, trk: 0, alt: 3000, ambient: 70 },
  };
}

export class KN64 {
  constructor({ now = () => performance.now(), storage = null } = {}) {
    this.now = now;
    this.store = makeStore(storage, PERSIST_KEY);
    this.s = defaultSettings();
    const saved = this.store.load();
    if (saved) Object.assign(this.s, saved, { sim: { ...this.s.sim, ...(saved.sim || {}) } });
    this.bus = true;           // avionics master
    this.livePos = null;       // flown position; null = the start position
    this.flying = false;
    this.last = this.now();
    this.wasOn = false;
    this.startSearch();
    this.tick();
  }
  save() { this.store.save(this.s); }
  factoryReset() { this.s = defaultSettings(); this.livePos = null; this.flying = false; this.save(); this.startSearch(); }
  get power() { return this.bus && this.s.on; }
  setAircraftPower(on) { this.bus = on; this.tick(); }

  // ---------- controls ----------
  get pulled() { return this.s.freq % 100 === 50; }
  input(evt, arg) {
    const s = this.s;
    switch (evt) {
      case 'power': s.on = !s.on; break;
      case 'func': {           // slide one position left (-1) / right (+1)
        const i = clamp(FUNCS.indexOf(s.func) + arg, 0, FUNCS.length - 1);
        if (FUNCS[i] === s.func) return;
        if (FUNCS[i] === 'GS/T') s.held = s.freq;          // PG: GS/T holds the internally selected frequency
        s.func = FUNCS[i];
        this.gstBlock = false;                              // IM 3.1: FREQ or RMT re-establishes normal operation
        break;
      }
      case 'outer': case 'inner': {
        // PG: "Rotating the frequency selector will have no effect" in GS/T (frequency hold)
        if (s.func === 'GS/T') return;
        let mhz = Math.floor(s.freq / 1000), tenth = Math.floor(s.freq % 1000 / 100);
        const f50 = s.freq % 100;
        if (evt === 'outer') mhz = MHZ_MIN + wrap(mhz - MHZ_MIN + arg, MHZ_MAX - MHZ_MIN + 1);
        else tenth = wrap(tenth + arg, 10);
        s.freq = mhz * 1000 + tenth * 100 + f50;
        break;
      }
      case 'pull':             // inner knob out: +0.05 MHz; pushed in: -0.05 MHz (PG)
        s.freq += this.pulled ? -50 : 50;
        if (s.func === 'GS/T') { this.save(); return; }     // held: shows when back on FREQ
        break;
      default: return;
    }
    this.save();
    this.tick();
  }

  // ---------- flight ----------
  get pos() {
    if (this.livePos) return this.livePos;
    const p = POSITIONS.find(q => q.id === this.s.sim.posId) || POSITIONS[0];
    return { lat: p.lat, lon: p.lon };
  }
  setStartPos(id) { this.s.sim.posId = id; this.livePos = null; this.save(); }
  setFlying(on) { this.flying = on; this.last = this.now(); }

  // channel the unit is tuned to now (IM 3.1)
  get channel() {
    const s = this.s;
    return s.func === 'RMT' ? s.remote : s.func === 'GS/T' ? s.held : s.freq;
  }
  // slant range to a station's DME antenna (NM), or null when it cannot be received
  slant(st) {
    const d = distNm(this.pos, st.dme), h = this.s.sim.alt - st.dme.elev;
    if (h <= 0 || d > LOS_K * Math.sqrt(h)) return null;
    const r = Math.hypot(d, h / FT_PER_NM);
    return r <= MAX_RANGE_NM ? r : null;
  }
  // the nearest receivable DME on the channel
  station() {
    let best = null;
    for (const st of DME_STATIONS) {
      if (st.f !== this.channel) continue;
      const r = this.slant(st);
      if (r != null && (!best || r < best.range)) best = { st, range: r };
    }
    return best;
  }

  startSearch() { this.trk = { chan: this.channel, since: this.now(), lock: null, samples: [] }; }

  tick() {
    const now = this.now(), dt = now - this.last;
    this.last = now;
    const f = this.s.sim;
    if (this.flying && f.gs > 0 && dt > 0) this.livePos = movePos(this.pos, wrap(f.trk + FLIGHT_VAR, 360), f.gs * dt / 3600000);
    if (!this.power) { this.wasOn = false; return; }
    if (!this.wasOn) {             // power applied (or restored after an interruption)
      this.wasOn = true;
      this.startSearch();
      // IM 3.1: dashes and "search" after power-up in GS/T until switched to FREQ or RMT
      this.gstBlock = this.s.func === 'GS/T';
    }
    if (this.trk.chan !== this.channel) this.startSearch();
    const t = this.trk, rx = this.gstBlock ? null : this.station();
    if (!t.lock) {
      if (rx && now - t.since >= SEARCH_MS) { t.lock = { st: rx.st, good: now }; t.samples = []; }
      else return;
    }
    if (rx && rx.st === t.lock.st) {
      t.lock.good = now;
      t.samples.push([now, rx.range]);
      while (t.samples.length > 2 && now - t.samples[1][0] >= GS_WINDOW_MS) t.samples.shift();
      t.range = rx.range;
    } else if (now - t.lock.good > MEMORY_MS) this.startSearch();   // memory expired: back to search
  }

  // ground speed from the rate of change of slant range (PG), and time to station
  measured() {
    const t = this.trk;
    if (!t.lock) return null;
    const a = t.samples[0], b = t.samples[t.samples.length - 1];
    const gs = a && b && b[0] > a[0] ? Math.abs(b[1] - a[1]) / ((b[0] - a[0]) / 3600000) : 0;
    const tts = gs > 0 ? t.range / gs * 60 : Infinity;
    return { range: t.range, gs: Math.min(999, Math.round(gs)), tts: Math.min(99, Math.round(tts)), st: t.lock.st };
  }
  get locked() { return !!this.trk.lock; }
  // the station heard: locked and receiving now (not on memory)
  get ident() {
    const t = this.trk;
    return this.power && t.lock && t.lock.good === this.last ? t.lock.st.id : null;
  }
  lampLevel() { return 0.35 + 0.65 * this.s.sim.ambient / 100; }   // photocell dimming (IM 3.1); curve not stated

  // display: 8 digit slots [3][3][2], decimal points after slots 2 and 6, annunciators
  view() {
    if (!this.power) return { type: 'seg7', power: false };
    const s = this.s, m = this.measured();
    const ch = [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '], dp = Array(8).fill(false);
    const put = (str, at) => { [...str].forEach((c, i) => { ch[at + i] = c; }); };
    if (m) {
      // IM 3.1: 0.1 NM to 99.9, then whole miles to 389
      if (m.range < 99.95) { put(m.range.toFixed(1).replace('.', '').padStart(3, ' '), 0); dp[1] = true; }
      else put(String(Math.round(m.range)).padStart(3, ' '), 0);
    } else put('---', 0);
    const ann = { NM: true, RMT: s.func === 'RMT', KT: false, MHZ: false, MIN: false };
    if (s.func === 'FREQ') {
      put(String(s.freq / 10).padStart(5, ' '), 3); dp[5] = true;          // "112.30" (Fig 3-1)
      ann.MHZ = true;
    } else {
      if (m) { put(String(m.gs).padStart(3, ' '), 3); put(String(m.tts).padStart(2, ' '), 6); }
      else { put('---', 3); put('--', 6); }                                // Fig 22 "Prior to Lock On"
      ann.KT = ann.MIN = true;
    }
    return { type: 'seg7', power: true, ch, dp, ann, level: this.lampLevel() };
  }
}
