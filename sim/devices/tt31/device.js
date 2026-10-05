// Trig TT31 Mode S transponder (Operating Manual 00454-00-AF, Installation Manual 00455-00-AR,
// and photos of the real unit). Same shape as the radios: input(evt, arg), tick(), view().
import { S, clamp, wrap } from '../../core/util.js';
import { Stopwatch, fmtTime } from '../../core/time.js';
import { makeStore } from '../../core/persist.js';
import { CHARSET } from '../../core/text.js';
import { UNIT_INFO } from './info.js';

export const PERSIST_KEY = 'tt31-sim-v1';
export const MODES = ['OFF', 'SBY', 'GND', 'ON', 'ALT'];
export const IDENT_MS = 18000;            // SPI for 18 seconds
export const ENTRY_TIMEOUT_MS = 7000;     // code entry not completed within 7 s -> ignored
export const ALT_MON_FT = 250;            // Installation Manual AR (2017, SW 3.16): "more than 250 feet" (older issues and the Operating Manual: 200)
const BOOT_MS = 2000;                     // start-up screen duration (not documented)
const WARN_REPEAT_MS = 10000;             // a cleared warning reappears while the condition persists (timing not documented)
const ADSB_LOST_MS = 2000;                // Trig support: no valid GPS information for about 2 seconds -> warning
const SQUAWK_DIGITS = '01234567';
const FLT_LEN = 8;

// Warning / fault statements. ADSB: Installation Manual AR §12.6 ("WARNING – NO ADSB POSN"); the others are not documented (see ASSUMPTIONS.md)
export const WARNINGS = {
  ADSB: 'NO ADSB POSN',
  ANTENNA: 'CHECK ANTENNA',
};
export const FAULTS = {
  INTERNAL: 'INTERNAL FAULT',
};

export function defaultSettings() {
  return {
    squawk: '7000', vfrCode: '7000', prevSquawk: null,
    flightId: 'OKABC',
    primary: 'sq',                        // which value is shown big and edited: 'sq' | 'flt'
    inst: { squat: false, adsb: false },  // installation (configured by the installer)
    sim: { alt: 800, onGround: true, gpsValid: true, radar: true, lat: 50.1314, lon: 14.5256, ambient: 60 },
  };
}

export class TT31 {
  constructor({ now = () => performance.now(), storage = null } = {}) {
    this.now = now;
    this.store = makeStore(storage, PERSIST_KEY);
    this.unitInfo = UNIT_INFO;
    this.s = defaultSettings();
    const saved = this.store.load();
    if (saved) Object.assign(this.s, saved, { inst: { ...this.s.inst, ...(saved.inst || {}) }, sim: { ...this.s.sim, ...(saved.sim || {}) } });
    this.mode = 0;                        // mode knob position (index into MODES); starts OFF
    this.bus = true;                      // aircraft power
    this.power = false;
    this.bootUntil = 0;
    this.page = 'main';                   // main | flight | timer | adsb | altmon
    this.entry = null;                    // { field, chars, pos, last }
    this.identUntil = 0;
    this.flightTimer = new Stopwatch();
    this.stopwatch = new Stopwatch();
    this.altMon = { on: false, ref: 0 };
    this.warnAck = {};                    // warning id -> time it was cleared
    this.extraWarn = {};                  // warnings raised from the panel (e.g. antenna)
    this.adsbWarn = false;                // ADS-B position warning (latched)
    this.gpsLostAt = null;                // when the GPS position became invalid
    this.fault = null;                    // { id, recoverable }
  }

  save() { this.store.save(this.s); }
  factoryReset() { this.s = defaultSettings(); this.altMon = { on: false, ref: 0 }; this.save(); }

  // ---------- power and mode ----------
  applyPower() {
    const want = this.mode > 0 && this.bus;
    if (want && !this.power) {
      this.power = true;
      this.bootUntil = this.now() + BOOT_MS;
      this.page = 'main'; this.entry = null; this.identUntil = 0;
      this.flightTimer.reset(); this.stopwatch.reset();
      this.warnAck = {};
      this.adsbWarn = false; this.gpsLostAt = null;
      if (this.fault && this.fault.recoverable) this.fault = null;  // some faults recover by switching off and on
    } else if (!want && this.power) {
      this.power = false;
      this.flightTimer.stop(this.now()); this.stopwatch.stop(this.now());
      this.entry = null;
    }
  }
  get booting() { return this.power && this.now() < this.bootUntil; }
  // operating mode actually in use: with a squat switch / automatic air-ground, ON or ALT on
  // the ground stays in GND and switches to ON/ALT when airborne (Installation Manual 7)
  get opMode() {
    const m = MODES[this.mode];
    if (this.s.inst.squat && this.s.sim.onGround && (m === 'ON' || m === 'ALT')) return 'GND';
    return m;
  }
  // replying to interrogations right now (radar coverage simulated)
  get replying() {
    if (!this.power || this.booting || this.fault || !this.s.sim.radar) return false;
    const m = this.opMode;
    if (m === 'SBY' || m === 'OFF') return false;
    if (m === 'GND') return this.s.sim.onGround;        // only Mode S ground interrogations (surface movement radar)
    return true;
  }
  get identActive() { return this.power && this.now() < this.identUntil; }

  // ---------- inputs ----------
  input(evt, arg) {
    if (evt === 'mode') {           // rotary mode switch with end stops
      this.mode = clamp(this.mode + arg, 0, MODES.length - 1);
      this.applyPower();
      this.tick();                  // flight timer follows the new mode at once
      return;
    }
    if (!this.power || this.booting) return;
    if (this.currentWarning() || this.fault) {
      if (evt === 'ENT') this.clearWarning();
      return;
    }
    switch (evt) {
      case 'IDENT': this.identUntil = this.now() + IDENT_MS; return;
      case 'VFR': this.vfr(); return;
      case 'FLTSQ': this.entry = null; this.s.primary = this.s.primary === 'sq' ? 'flt' : 'sq'; this.save(); return;
      case 'FUNC': this.entry = null; this.page = this.nextPage(); return;
      case 'inner': if (this.page === 'main') this.turnCode(arg); return;
      case 'ENT': return this.ent();
      case 'BACK': if (this.entry && this.entry.pos > 0) { this.entry.pos--; this.entry.last = this.now(); } return;
    }
  }

  vfr() {
    // sets the pre-programmed conspicuity code; pressing again restores the previous code
    const s = this.s;
    this.entry = null;
    if (s.squawk !== s.vfrCode) { s.prevSquawk = s.squawk; s.squawk = s.vfrCode; }
    else if (s.prevSquawk) { s.squawk = s.prevSquawk; s.prevSquawk = null; }
    this.save();
  }

  // FUNC pages (order as listed in the Operating Manual; ADS-B monitor only when installed)
  pages() { return ['main', 'flight', 'timer', ...(this.s.inst.adsb ? ['adsb'] : []), 'altmon']; }
  nextPage() { const p = this.pages(); return p[(p.indexOf(this.page) + 1) % p.length]; }

  // code selector: turning highlights the first digit and changes it; ENT advances
  turnCode(d) {
    const s = this.s;
    if (!this.entry) {
      const field = s.primary;
      const chars = field === 'sq' ? s.squawk.split('') : (s.flightId.replace(/ /g, '_') + '_'.repeat(FLT_LEN)).slice(0, FLT_LEN).split('');
      this.entry = { field, chars, pos: 0, last: this.now() };
    }
    const e = this.entry;
    const set = e.field === 'sq' ? SQUAWK_DIGITS : CHARSET;
    e.chars[e.pos] = set[wrap(set.indexOf(e.chars[e.pos]) + d, set.length)];
    e.last = this.now();
  }

  ent() {
    const e = this.entry;
    if (e) {
      // Flight ID: entering a blank character ends it
      if (e.field === 'flt' && e.chars[e.pos] === '_') return this.commit();
      e.pos++;
      e.last = this.now();
      if (e.pos >= e.chars.length) this.commit();
      return;
    }
    if (this.page === 'timer') {
      // ENT resets and starts the timer; ENT again stops it
      if (this.stopwatch.running) this.stopwatch.stop(this.now());
      else { this.stopwatch.reset(); this.stopwatch.start(this.now()); }
    } else if (this.page === 'altmon') {
      // ENT toggles the altitude monitor at the current altitude
      this.altMon = this.altMon.on ? { on: false, ref: 0 } : { on: true, ref: this.s.sim.alt };
    }
  }

  commit() {
    const e = this.entry;
    this.entry = null;
    if (e.field === 'sq') this.s.squawk = e.chars.join('');
    else {
      const id = e.chars.join('').split('_')[0];
      if (id) this.s.flightId = id;
    }
    this.save();
  }

  // ---------- warnings / faults ----------
  warningConditions() {
    const c = { ...this.extraWarn };
    if (this.adsbWarn) c.ADSB = true;   // latched: stays until ENT even when GPS is valid again
    return Object.keys(c).filter(k => c[k]);
  }
  currentWarning() {
    if (!this.power || this.booting) return null;
    const now = this.now();
    return this.warningConditions().find(id => id === 'ADSB' || !(this.warnAck[id] && now - this.warnAck[id] < WARN_REPEAT_MS)) || null;
  }
  clearWarning() {
    const w = this.currentWarning();
    if (w) this.warnAck[w] = this.now();
    if (w === 'ADSB') this.adsbWarn = false;
  }
  raiseWarning(id, on = true) { this.extraWarn[id] = on; if (on) delete this.warnAck[id]; }
  raiseFault(recoverable) { this.fault = { id: 'INTERNAL', recoverable }; }

  // ---------- periodic ----------
  tick() {
    const now = this.now();
    if (!this.power) return;
    // flight timer: powered on and operating in flight mode (ON or ALT); with a squat switch
    // it starts and stops automatically on the ground / airborne state
    const m = this.opMode;
    const flying = !this.booting && (m === 'ON' || m === 'ALT');
    if (flying && !this.flightTimer.running) this.flightTimer.start(now);
    if (!flying && this.flightTimer.running) this.flightTimer.stop(now);
    if (this.entry && now - this.entry.last > ENTRY_TIMEOUT_MS) this.entry = null;   // changes ignored
    // ADS-B: no valid GPS position for about 2 s raises the warning; only ENT clears it (Trig support)
    const lost = this.s.inst.adsb && !this.s.sim.gpsValid;
    if (!lost) this.gpsLostAt = null;
    else if (this.gpsLostAt == null) this.gpsLostAt = now;
    const acked = this.warnAck.ADSB && now - this.warnAck.ADSB < WARN_REPEAT_MS;
    if (lost && !this.booting && now - this.gpsLostAt >= ADSB_LOST_MS && !acked) this.adsbWarn = true;
  }

  // ---------- simulation (panel) ----------
  setAircraftPower(on) { this.bus = on; this.applyPower(); }
  get altAlert() {
    return this.power && this.altMon.on && Math.abs(this.s.sim.alt - this.altMon.ref) > ALT_MON_FT;
  }
  audio() { return { src: this.power ? 'quiet' : 'off' }; }
  alertAudio() { return this.altAlert; }

  // ---------- view model ----------
  flightLevel() {
    const fl = Math.max(0, Math.round(this.s.sim.alt / 100));
    return `FL${String(fl).padStart(3, '0')}`;
  }
  view() {
    const now = this.now();
    if (!this.power) return { off: true };
    if (this.booting) {
      const u = this.unitInfo;
      return { photo: this.s.sim.ambient, xpdr: { boot: { logo: 'TRIG', lines: [`${u.model} Mode S`, `Version ${u.sw}`, `FPGA ${u.fpga}`] } } };
    }
    if (this.fault) return { photo: this.s.sim.ambient, xpdr: { alert: { title: 'FAULT', text: FAULTS[this.fault.id] } } };
    const w = this.currentWarning();
    if (w) return { photo: this.s.sim.ambient, xpdr: { alert: { title: 'WARNING', text: WARNINGS[w], key: 'ENT' } } };

    const s = this.s;
    const x = {
      mode: this.opMode,
      ident: this.identActive,
      reply: this.replying && now % 1000 < 180,
      fl: this.flightLevel(),
      pointer: this.altMon.on ? (s.sim.alt > this.altMon.ref + ALT_MON_FT / 2 ? 'down' : s.sim.alt < this.altMon.ref - ALT_MON_FT / 2 ? 'up' : 'level') : null,
    };
    if (this.page === 'main') {
      const sq = s.squawk, id = s.flightId;
      const e = this.entry;
      const bigOf = (field, value) => (e && e.field === field
        ? e.chars.map((c, i) => S(c === '_' ? ' ' : c, { inv: i === e.pos }))
        : [S(value)]);
      if (s.primary === 'sq') { x.small = [S(id)]; x.big = bigOf('sq', sq); }
      else { x.small = [S(sq)]; x.big = bigOf('flt', id); }
      return { photo: this.s.sim.ambient, xpdr: x };
    }
    // FUNC pages (photos): squawk small top-right; label lines; big value
    x.small = [S(s.squawk)];
    if (this.page === 'flight') { x.label = [[S('FLIGHT')], [S('TIME')]]; x.big = [S(fmtTime(this.flightTimer.elapsed(now) / 1000))]; }
    if (this.page === 'timer') { x.label = [[S('TIMER')], [S('ENT', { inv: true })]]; x.big = [S(fmtTime(this.stopwatch.elapsed(now) / 1000))]; }
    if (this.page === 'altmon') { x.label = [[S('ALTITUDE MONITOR')], [S('ON/OFF? '), S('ENT', { inv: true })]]; x.wide = true; }
    if (this.page === 'adsb') {
      const ok = s.sim.gpsValid;
      x.label = [[S('ADS-B')], [S('MONITOR')]];
      x.lines = ok ? [[S(fmtLat(s.sim.lat))], [S(fmtLon(s.sim.lon))]] : [[S('---°--.--')], [S('----°--.--')]];
    }
    return { photo: this.s.sim.ambient, xpdr: x };
  }
}

function fmtDeg(v, w, pos, neg) {
  const h = v >= 0 ? pos : neg, a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60;
  return `${h}${String(d).padStart(w, '0')}°${m.toFixed(2).padStart(5, '0')}`;
}
const fmtLat = v => fmtDeg(v, 2, 'N', 'S');
const fmtLon = v => fmtDeg(v, 3, 'E', 'W');
