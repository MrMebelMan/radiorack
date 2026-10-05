// Garmin GTX 328 Mode S transponder (SW 5.00). Sources: Pilot's Guide 190-00420-03 Rev A (PG),
// Installation Manual 190-00420-04 Rev C (IM), Maintenance Manual 190-00420-05 Rev A (MM).
// Same shape as the other units: input(evt, arg), tick(), view(); keys arrive as down:KEY / up:KEY.
import { clamp, wrap } from '../../core/util.js';
import { Stopwatch, fmtTime } from '../../core/time.js';
import { makeStore } from '../../core/persist.js';
import { textWidth, unitWidth } from '../../ui/lcd-gtx.js';
import { UNIT_INFO } from './info.js';
import { PAGES, JUMP_TARGET, defaultConfig, pageOps, extraOps, entryOps, keyRows, keyChars } from './config.js';

export const PERSIST_KEY = 'gtx328-sim-v1';
export const IDENT_MS = 18000;            // PG: SPI pulse for 18 seconds
export const CLR_BACK_MS = 5000;          // PG: CLR up to five seconds after code entry returns the cursor
export const VFR_MSG_MS = 5000;           // IM 5.2.7: the advisory clears after 5 seconds or CLR
export const STBY_HOLD_MS = 2000;         // IM 5.1.1 "pressing and holding the STBY key selects GND" (hold time not stated)
export const BOOT_MS = 3000;              // start-up page while the self test runs (duration not stated)
export const EXT_STBY_FAIL_MS = 30000;    // IM 5.2.15: EXTERNAL STANDBY active at power-up -> FAIL after 30 s
export const GPS_AIRBORNE_KT = 35;        // MM 5.11: airborne when 35 knots from a GPS is sensed
const FLT_LEN = 8;                        // Flight ID field: 8 characters (figures)
const REPLY_PERIOD_MS = 1000, REPLY_SHOW_MS = 180;   // reply symbol shown per interrogation (rate not stated)

const RIGHT_X = 123, RIGHT_W = 77;        // FUNC page area (figures: the right part of the display)
const CODE_X = 42, CODE_Y = 5, CODE_PITCH = 18;   // squawk digits (PG main-screen figure)

export function defaultSettings() {
  return {
    code: '7000', vfrPrev: null,
    cfg: defaultConfig(),
    sim: { alt: 1200, vs: 0, onGround: true, gs: 0, oat: 15, radar: true, encoder: true, ambient: 60, lightBus: 0,
      extIdent: false, extStby: false, avMaster: false },
  };
}

export class GTX328 {
  constructor({ now = () => performance.now(), storage = null } = {}) {
    this.now = now;
    this.store = makeStore(storage, PERSIST_KEY);
    this.unitInfo = UNIT_INFO;
    this.s = defaultSettings();
    const saved = this.store.load();
    if (saved) Object.assign(this.s, saved, { cfg: { ...this.s.cfg, ...(saved.cfg || {}) }, sim: { ...this.s.sim, ...(saved.sim || {}) } });
    this.bus = true;              // aircraft power
    this.power = false;
    this.mode = 'STBY';           // selected with the mode keys: STBY | ON | ALT
    this.gnd = false;             // GND selected by holding STBY
    this.held = {};               // key -> { at, done }
    this.page = 'PALT';
    this.flightTimer = new Stopwatch();
    this.countUp = new Stopwatch();
    this.cd = { initial: 0, sw: new Stopwatch(), entry: null };
    this.altMon = { on: false, ref: 0, alert: false };
    this.alertSeq = 0; this.alert = null; this.toneOn = false;
    this.fault = false;
    this.lit = { disp: 0.6, key: 0.6 };
  }

  save() { this.store.save(this.s); }
  factoryReset() { const sim = this.s.sim; this.s = defaultSettings(); this.s.sim = sim; this.save(); }
  get c() { return this.s.cfg; }

  // ---------- power ----------
  powerOn(key) {
    if (this.power || !this.bus) return;
    const now = this.now();
    this.power = true;
    this.bootUntil = now + BOOT_MS;
    this.poweredAt = now;
    this.config = !!this.held.FUNC;           // IM 5.2: hold FUNC while powering on -> configuration pages
    if (this.held.FUNC) this.held.FUNC.done = true;
    this.mode = key === 'ON' || key === 'ALT' ? key : 'STBY';
    this.s.lastMode = this.mode;
    this.gnd = false;
    this.entry = null; this.lastDone = null; this.msg = null; this.identUntil = 0;
    this.page = 'PALT';
    this.flightTimer.reset(); this.countUp.reset(); this.cd = { initial: 0, sw: new Stopwatch(), entry: null, expired: false };
    this.altMon = { on: false, ref: 0, alert: false };
    this.toneOn = false;
    this.fault = false;
    this.wasAirborne = null; this.landedAt = null;
    this.cfgEdit = null; this.cfgPage = 0;
    // PG "Entering a Flight ID": with FLT ID PWR-UP ENTRY the crew must enter it before the unit operates
    this.fltEntry = !this.config && this.c.fltMode === 'PWR-UP ENTRY' ? { chars: [...this.c.fltId], pos: -1, ok: false, key: null } : null;
    // IM 5.2.12: no valid address -> the unit prompts for one
    this.addrPrompt = !this.config && !validAddr(this.c) ? { field: 1, chars: [], pos: 0, key: null, addrType: this.c.addrType } : null;
  }
  powerOff() { this.power = false; this.toneOn = false; this.flightTimer.stop(this.now()); this.countUp.stop(this.now()); this.cd.sw.stop(this.now()); }
  // aircraft power through the avionics master. With the avionics master turn-on wired (PG: "or by a remote
  // avionics master switch (if applicable)"; MM 1.2) the unit comes on with the master, in the last mode used
  setAircraftPower(on) {
    this.bus = on;
    if (!on && this.power) this.powerOff();
    if (on && !this.power && this.s.sim.avMaster) this.powerOn(this.s.lastMode || 'STBY');
  }
  setMasterWiring(on) { this.s.sim.avMaster = on; this.save(); this.setAircraftPower(this.bus); }
  get booting() { return this.power && this.now() < this.bootUntil; }
  get operating() { return this.power && !this.booting && !this.config && !this.fltEntry && !this.addrPrompt; }

  // ---------- air / ground ----------
  // Automated Airborne Determination (PG, IM 5.2.10): squat switch, or GPS ground speed on a configured input
  get autoSource() {
    const c = this.c;
    if (c.squat === 'YES') return 'squat';
    if ([c.rs1In, c.rs2In, c.in1Data, c.in2Data, c.in3Data].includes('GPS')) return 'gps';
    return null;
  }
  get sensedGround() {
    const src = this.autoSource, sim = this.s.sim;
    if (src === 'squat') return sim.onGround;
    if (src === 'gps') return sim.gs < GPS_AIRBORNE_KT;
    return null;
  }
  get opMode() {
    if (!this.power) return 'OFF';
    if (this.fault || this.failExt) return 'FAIL';
    if (this.s.sim.extStby) return 'STBY';
    if (this.mode === 'STBY') return this.gnd ? 'GND' : 'STBY';
    if (this.autoGnd) return 'GND';
    return this.mode;
  }
  get replying() {
    const m = this.opMode;
    return this.operating && this.s.sim.radar && (m === 'ON' || m === 'ALT');
  }
  get identActive() { return this.operating && this.now() < this.identUntil; }
  get altValid() { return this.s.sim.encoder; }

  // ---------- inputs ----------
  input(evt, arg) {
    if (evt.startsWith('down:')) return this.keyDown(evt.slice(5));
    if (evt.startsWith('up:')) return this.keyUp(evt.slice(3));
  }
  keyDown(k) {
    if (this.held[k]) return;
    this.held[k] = { at: this.now(), done: false };
    if (k === 'OFF') { if (this.power) this.powerOff(); return; }
    if (k === 'STBY' || k === 'ON' || k === 'ALT') {
      if (!this.power) { this.powerOn(k); this.held[k].done = true; return; }
      if (this.booting || this.config) return;
      this.mode = k; this.gnd = false; this.s.lastMode = k; this.save();
      return;
    }
    if (!this.power || this.booting) return;
    if (this.config) return this.configKey(k);
    if (this.addrPrompt) return this.addrPromptKey(k);
    if (this.fltEntry) return this.fltEntryKey(k);
    this.key(k);
  }
  keyUp(k) { delete this.held[k]; }

  key(k) {
    const now = this.now();
    if (k === 'IDENT') { if (this.opMode !== 'STBY') this.identUntil = now + IDENT_MS; return; }
    if (k === 'VFR') return this.vfr();
    if (k === 'FUNC') { this.page = this.nextPage(); return; }
    if (this.msg && k === 'CLR') { this.msg = null; return; }
    // count down entry (PG Timer Operation): CRSR then all digits 0-9
    if (this.cd.entry) {
      const e = this.cd.entry;
      if (/^[0-9]$/.test(k)) { e.digits.push(k); if (e.digits.length === 6) this.finishCdEntry(); return; }
      if (k === 'CLR') { if (e.digits.length) e.digits.pop(); else this.cd.entry = null; return; }
      if (k === 'CRSR') { this.cd.entry = null; return; }
    }
    if (/^[0-7]$/.test(k)) return this.codeDigit(k);
    if (k === 'CLR' && this.entry) return this.codeBack();
    if (k === 'CLR' && this.lastDone && now - this.lastDone.at <= CLR_BACK_MS) {
      // PG: CLR within five seconds after entry returns the cursor to the fourth digit
      this.entry = { digits: this.lastDone.code.slice(0, 3).split(''), prev: this.lastDone.prev };
      this.lastDone = null;
      return;
    }
    if (k === 'CRSR' && this.entry) { this.entry = null; return; }   // cancels data entry, previous code stays
    if (k === 'CRSR' && this.page === 'CDOWN') { this.cd.entry = { digits: [] }; this.cd.sw.stop(now); return; }
    if (k === 'START') return this.startStop();
    if (k === 'CLR') return this.clrPage();
    if (k === '8' || k === '9') return this.adjust(k === '9' ? 1 : -1);
  }

  codeDigit(d) {
    if (!this.entry) this.entry = { digits: [], prev: this.s.code };
    this.entry.digits.push(d);
    this.lastDone = null;
    if (this.entry.digits.length === 4) {
      // the new code is activated when the fourth digit is entered
      const code = this.entry.digits.join('');
      this.lastDone = { code, prev: this.entry.prev, at: this.now() };
      this.s.code = code; this.entry = null; this.save();
    }
  }
  codeBack() {
    const e = this.entry;
    if (!e.digits.length) { this.s.code = e.prev; this.entry = null; this.save(); return; }   // CLR on the first digit restores the previous code
    e.digits.pop();
  }

  vfr() {
    if (this.c.vfrKey === 'DISABLE') { this.msg = { lines: ['VFR KEY', 'DISABLED'], until: this.now() + VFR_MSG_MS }; return; }
    const s = this.s;
    this.entry = null;
    if (s.code !== this.c.vfrId) { s.vfrPrev = s.code; s.code = this.c.vfrId; }
    else if (s.vfrPrev) { s.code = s.vfrPrev; s.vfrPrev = null; }
    this.save();
  }

  // FUNC pages (PG Function Display order); OAT/DALT only with a temperature input, CONTRAST / DISPLAY only in manual mode
  pages() {
    const c = this.c;
    return ['PALT', 'FTIME', 'ALTMON', ...(c.tempSensor === 'YES' ? ['OAT'] : []), 'CUP', 'CDOWN',
      ...(c.contrastMode === 'MAN' ? ['CONTRAST'] : []), ...(c.bkltMode === 'MAN' ? ['DISPLAY'] : [])];
  }
  nextPage() { const p = this.pages(); return p[(p.indexOf(this.page) + 1) % p.length]; }

  startStop() {
    const now = this.now();
    if (this.page === 'FTIME') { this.flightTimer.toggle(now); return; }
    if (this.page === 'CUP') { this.countUp.toggle(now); return; }
    if (this.page === 'CDOWN') { if (this.cd.initial || this.cd.expired || this.cd.sw.elapsed(now)) this.cd.sw.toggle(now); return; }
    if (this.page === 'ALTMON') {
      // START/STOP starts monitoring the current altitude; again cancels
      this.altMon = this.altMon.on ? { on: false, ref: 0, alert: false } : { on: true, ref: this.s.sim.alt, alert: false };
    }
  }
  clrPage() {
    if (this.page === 'FTIME') this.flightTimer.reset();
    if (this.page === 'CUP') this.countUp.reset();
    if (this.page === 'CDOWN') { this.cd.sw.reset(); this.cd.expired = false; }   // back to the initial time value
  }
  finishCdEntry() {
    const d = this.cd.entry.digits.map(Number);
    this.cd.initial = (d[0] * 10 + d[1]) * 3600 + (d[2] * 10 + d[3]) * 60 + d[4] * 10 + d[5];
    this.cd.entry = null; this.cd.sw.reset(); this.cd.expired = false;
  }
  // CONTRAST / DISPLAY pages: 8 reduces, 9 increases
  adjust(d) {
    const c = this.c;
    if (this.page === 'CONTRAST') c.contrast = clamp(c.contrast + d * 5, 0, 99);
    else if (this.page === 'DISPLAY') c.bkltLvl = clamp(c.bkltLvl + d * 50, 0, 999);
    else return;
    this.save();
  }

  // ---------- Flight ID entry at power-up (PG "Entering a Flight ID Number") ----------
  fltEntryKey(k) {
    const e = this.fltEntry;
    if (/^[0-9]$/.test(k)) {
      if (e.ok) return;
      if (e.pos < 0) { e.pos = 0; }
      cycleChar(e, k, keyChars(false));
      return;
    }
    if (k === 'CRSR') {
      if (e.ok) { this.c.fltId = e.chars.join('').replace(/[_ ]/g, ''); this.fltEntry = null; this.save(); return; }   // accept; spaces removed
      if (e.pos < 0) { e.ok = true; return; }
      e.key = null;
      if (e.pos < FLT_LEN - 1 && e.chars[e.pos] !== undefined) e.pos++;
      else e.ok = true;
      return;
    }
    if (k === 'CLR') {
      if (e.ok) { e.ok = false; e.pos = e.pos < 0 ? -1 : Math.min(e.pos, FLT_LEN - 1); return; }
      e.key = null;
      if (e.pos > 0) e.pos--;
    }
  }

  // ---------- address prompt (IM 5.2.12: no valid address at power-up) ----------
  addrPromptKey(k) {
    const e = this.addrPrompt;
    if (/^[0-9]$/.test(k)) { cycleChar(e, k, keyChars(e.addrType === 'HEX')); return; }
    if (k === 'CRSR') {
      e.key = null;
      const len = e.addrType === 'HEX' ? 6 : 5;
      if (e.pos < len - 1 && e.chars[e.pos] !== undefined) { e.pos++; return; }
      const v = e.chars.join('');
      if (validAddr({ addrType: e.addrType, addr: v })) { this.c.addr = v; this.addrPrompt = null; this.save(); }
      return;
    }
    if (k === 'CLR' && e.pos > 0) { e.key = null; e.pos--; }
  }

  // ---------- configuration pages (IM 5.2) ----------
  configKey(k) {
    const pages = PAGES, page = pages[this.cfgPage], e = this.cfgEdit;
    if (k === 'FUNC') { this.cfgEdit = null; this.cfgPage = (this.cfgPage + 1) % pages.length; return; }   // next page; a highlighted change is not saved
    if (k === 'START') { this.cfgEdit = null; this.cfgPage = Math.max(0, this.cfgPage - 1); return; }      // back, stopping at the menu page
    if (k === 'CRSR') {
      if (!e) { const i = this.editable(page, 0); if (i >= 0) this.beginEdit(page, i); return; }
      const f = page.fields[e.field];
      if (f.kind === 'chars' && !this.charsDone(f, e)) { e.key = null; e.pos++; return; }
      this.commitEdit(page, e);
      const i = this.editable(page, e.field + 1);
      this.cfgEdit = null;
      if (page.id === 'JUMP') { this.cfgPage = pages.findIndex(p => p.id === JUMP_TARGET[e.draft]); return; }
      if (i >= 0) this.beginEdit(page, i);
      return;
    }
    if (!e) return;
    const f = page.fields[e.field];
    if (f.kind === 'list' && (k === '8' || k === '9')) { const o = f.opts, i = o.indexOf(e.draft); e.draft = o[wrap(i + (k === '9' ? 1 : -1), o.length)]; return; }
    if ((f.kind === 'bar' || f.kind === 'step') && (k === '8' || k === '9')) { e.draft = clamp(e.draft + (k === '9' ? 1 : -1) * f.step, 0, f.max); return; }
    if (f.kind === 'num' && /^[0-9]$/.test(k)) {
      if (f.octal && k > '7') return;
      e.draft = Number((String(e.draft).padStart(f.digits, '0') + k).slice(-f.digits));
      if (f.key === 'message') this.playMessage(e.draft);
      return;
    }
    if (f.kind === 'chars') {
      if (/^[0-9]$/.test(k)) { cycleChar(e, k, keyChars(f.key === 'addr' && this.c.addrType === 'HEX')); return; }
      if (k === 'CLR' && e.pos > 0) { e.key = null; e.pos--; }
    }
  }
  editable(page, from) {
    for (let i = from; i < page.fields.length; i++) {
      const f = page.fields[i];
      if (f.kind === 'show' || (f.only && !f.only(this.c))) continue;
      if (f.autoOnly && this.c[f.autoOnly] !== 'AUTO') continue;
      if (f.manOnly && this.c[f.manOnly] !== 'MAN') continue;
      return i;
    }
    return -1;
  }
  beginEdit(page, i) {
    const f = page.fields[i], c = this.c;
    if (f.kind === 'chars') { this.cfgEdit = { field: i, chars: [...(c[f.key] || '')], pos: 0, key: null }; return; }
    const v = f.local ? (f.key === 'jump' ? f.opts[0] : 0) : c[f.key];
    this.cfgEdit = { field: i, draft: f.kind === 'num' && typeof v === 'string' ? Number(v) : v };
  }
  charsDone(f, e) { const len = f.key === 'addr' ? (this.c.addrType === 'HEX' ? 6 : 5) : FLT_LEN; return e.pos >= len - 1 || e.chars[e.pos] === undefined; }
  commitEdit(page, e) {
    const f = page.fields[e.field], c = this.c;
    if (f.local) return;
    if (f.kind === 'chars') {
      const v = e.chars.join('').replace(/[_ ]/g, '');
      if (f.key === 'addr' && !validAddr({ addrType: c.addrType, addr: v })) return;
      c[f.key] = v;
    } else if (f.kind === 'num' || f.kind === 'step') {
      let v = clamp(e.draft, f.min ?? 0, f.max ?? 10 ** f.digits - 1);
      c[f.key] = f.octal ? String(v).padStart(4, '0') : v;
    } else c[f.key] = e.draft;
    if (f.key === 'addrType') c.addr = '';      // a new address type needs a new address
    this.save();
  }
  playMessage(n) {
    // AUDIO MODE page MESSAGE: 0 toggles a continuous tone, 1 attention tone, 2 "Leaving Altitude", 4 "Timer Expired"
    if (n === 0) { this.toneOn = !this.toneOn; return; }
    const id = { 1: 'attention', 2: 'leaving-altitude', 4: 'timer-expired' }[n];
    if (id) this.sound(id === 'attention' ? 'tone' : 'msg', id);
  }
  sound(type, id) { this.alert = { type, id, voice: this.c.voice, volume: this.c.volume }; this.alertSeq++; }

  // ---------- periodic ----------
  tick() {
    const now = this.now();
    this.updateLighting(now);
    if (!this.power) return;
    if (this.msg && now >= this.msg.until) this.msg = null;
    // EXTERNAL STANDBY grounded at power-up: FAIL after 30 s
    this.failExt = this.s.sim.extStby && this.extStbyAtPowerUp() && now - this.poweredAt >= EXT_STBY_FAIL_MS;
    if (this.booting || this.config) return;
    // STBY held -> GND (only without automatic airborne determination)
    const h = this.held.STBY;
    if (h && !h.done && now - h.at >= STBY_HOLD_MS) { h.done = true; if (!this.autoSource && this.mode === 'STBY') this.gnd = true; }
    if (this.s.sim.extIdent && !this.extIdentWas) this.identUntil = now + IDENT_MS;
    this.extIdentWas = this.s.sim.extIdent;
    this.airGround(now);
    this.timers(now);
    this.monitor(now);
  }
  extStbyAtPowerUp() { if (this.extStbyPU === undefined || this.extStbyPUAt !== this.poweredAt) { this.extStbyPU = this.s.sim.extStby; this.extStbyPUAt = this.poweredAt; } return this.extStbyPU; }
  airGround(now) {
    const g = this.sensedGround;
    if (g === null) { this.autoGnd = false; return; }
    const air = !g;
    if (air) { this.landedAt = null; this.autoGnd = false; }
    else {
      if (this.landedAt == null) this.landedAt = this.wasAirborne ? now : now - this.c.delay * 1000;   // on the ground at power-up: GND at once
      this.autoGnd = now - this.landedAt >= this.c.delay * 1000;   // IM 5.2.10 DELAY TIME after landing
    }
    // automatic flight timer: starts at lift-off, stops on the ground (PG Timer Operation 2, 5)
    if (this.c.autoFlt === 'YES' && this.wasAirborne !== null && air !== this.wasAirborne) {
      if (air) { this.flightTimer.reset(); this.flightTimer.start(now); } else this.flightTimer.stop(now);
    }
    this.wasAirborne = air;
  }
  timers(now) {
    const cd = this.cd;
    if (cd.initial && !cd.expired && cd.sw.elapsed(now) >= cd.initial * 1000) {
      cd.expired = true;
      if (this.c.cdAudio !== 'OFF') this.sound(this.c.cdAudio === 'MSG' ? 'msg' : 'tone', 'timer-expired');
    }
  }
  monitor(now) {
    const m = this.altMon;
    if (!m.on || !this.altValid) return;
    const dev = this.s.sim.alt - m.ref, lim = this.c.altDev;
    if (Math.abs(dev) > lim + 1000) { this.altMon = { on: false, ref: 0, alert: false }; return; }   // GTX 330 PG: stops beyond 1000 ft + deviation
    if (!m.alert && Math.abs(dev) > lim) {
      m.alert = true;
      if (this.c.altMonAudio !== 'OFF') this.sound(this.c.altMonAudio === 'MSG' ? 'msg' : 'tone', 'leaving-altitude');
      if (this.c.pageChange === 'ENABLE') this.page = 'ALTMON';
    } else if (m.alert && Math.abs(dev) <= 100) m.alert = false;   // GTX 330 PG: flashes until back within 100 ft
  }
  get altAlert() { return this.power && this.altMon.alert; }
  alertAudio() { return false; }

  // ---------- lighting (IM 5.2.3-5.2.6) ----------
  photo() { return this.s.sim.ambient; }                          // photocell, 0..100
  lightInput(src) {
    const v = this.s.sim.lightBus, full = { '14V': 14, '28V': 28, '5V': 5 }[src];
    // a lighting bus at its minimum (daytime) setting: the brightness tracks the photocell (IM 5.2.4 NOTE)
    if (src === 'PHOTO' || !full || v < 0.5) return this.photo() / 100;
    return clamp(v / full, 0, 1);
  }
  autoLevel(src, slope, offset, min) {
    const x = this.lightInput(src);
    return clamp(x * slope / 50 + (offset - 50) / 100, min / 99, 1);
  }
  updateLighting(now) {
    const c = this.c, dt = this.lastLight ? Math.min(1000, now - this.lastLight) : 1000;
    this.lastLight = now;
    const d = c.bkltMode === 'MAN' ? c.bkltLvl / 999 : this.autoLevel(c.bkltSrc, c.bkltSlope, c.bkltOffset, c.bkltMin);
    const k = c.bkltMode === 'MAN' ? 1 : this.autoLevel(c.keySrc, c.keySlope, c.keyOffset, c.keyMin);
    const ease = (cur, t, rsp) => cur + (t - cur) * (1 - Math.exp(-dt / (150 + rsp * 250)));   // RSP TIME: higher = slower
    this.lit.disp = ease(this.lit.disp, d, c.bkltRsp);
    this.lit.key = c.bkltMode === 'MAN' ? this.lit.disp : ease(this.lit.key, k, c.keyRsp);
  }
  bkltLevelShown() { return Math.round(this.lit.disp * 999); }
  keyLevelShown() { return Math.round(this.lit.key * 999); }
  get positive() { const m = this.c.dispMode; return m === 'PSTV' || (m === 'AUTO' && this.photo() > this.c.dispLevel); }
  get contrastLevel() { return this.c.contrast / 99; }

  // ---------- simulation helpers ----------
  pressureAltitude() { return this.s.sim.alt; }
  densityAltitude() {
    // standard approximation: DA = PA + 120 ft per degree C above ISA
    const pa = this.s.sim.alt, isa = 15 - 2 * pa / 1000;
    return Math.round(pa + 120 * (this.s.sim.oat - isa));
  }
  raiseFault(on = true) { this.fault = on; }
  audio() { return { src: this.power ? 'quiet' : 'off' }; }

  // ---------- view ----------
  view() {
    const now = this.now();
    if (!this.power) return { off: true };
    const ops = this.booting ? bootOps(this.unitInfo)
      : this.config ? this.configOps()
      : this.addrPrompt ? this.addrPromptOps()
      : this.fltEntry ? this.fltEntryOps(now)
      : this.mainOps(now);
    return { gtx: { ops, pos: this.positive, lit: this.lit.disp, contrast: this.contrastLevel } };
  }
  configOps() {
    const page = PAGES[this.cfgPage];
    const ops = [...pageOps(page, this.c, this, this.cfgEdit), ...extraOps(page, this.c)];
    if (page.diag) ops.push(...this.diagOps(page.id));
    return ops;
  }
  addrPromptOps() {
    const e = this.addrPrompt, hex = e.addrType === 'HEX';
    const ops = [{ t: 'txt', f: 'b', x: 1, y: 2, s: 'ADDRESS' }];
    if (hex) ops.push({ t: 'txt', f: 'b', x: 54, y: 2, s: 'HEX' });
    else ops.push({ t: 'txt', f: 'b', x: 54, y: 2, s: 'US' }, { t: 'txt', f: 'b', x: 72, y: 2, s: 'TAIL#' }, { t: 'txt', f: 'e', x: 106, y: 2, s: 'N' });
    ops.push(...entryOps(114, 2, e.chars, e.pos, hex ? 6 : 5), ...keyRows(hex));
    return ops;
  }
  fltEntryOps(now) {
    // three PG figures: whole field highlighted at power-up; one character cursor; OK? highlighted
    const e = this.fltEntry;
    const ops = [{ t: 'txt', f: 'b', x: 1, y: 2, s: 'FLT' }, { t: 'txt', f: 'b', x: 23, y: 2, s: 'ID' },
      { t: 'txt', f: 'b', x: 36, y: 2, s: 'PWR-UP' }, { t: 'txt', f: 'b', x: 83, y: 2, s: 'ENTRY' }];
    ops.push(...entryOps(121, 2, e.chars, e.ok ? -1 : e.pos, FLT_LEN));
    if (e.pos < 0 && !e.ok) ops.push({ t: 'inv', x: 121, y: 1, w: 57, h: 12 });
    ops.push({ t: 'txt', f: 'b', x: 179, y: 2, s: 'OK?' });
    if (e.ok) ops.push({ t: 'inv', x: 178, y: 1, w: 22, h: 12 });
    ops.push(...keyRows());
    return ops;
  }

  mainOps(now) {
    const ops = [];
    const m = this.opMode;
    ops.push({ t: 'txt', f: 'a', x: 0, y: 12, s: m });                                  // mode annunciator
    if (this.identActive) ops.push({ t: 'txt', f: 'a', x: 0, y: 2, s: 'IDENT' });     // PG: upper left corner
    if (this.replying && now % REPLY_PERIOD_MS < REPLY_SHOW_MS) ops.push({ t: 'unit', id: 'reply', x: 1, y: 22 });
    // squawk code; during entry the digits not yet entered appear as dashes, the cursor on the next one
    const e = this.entry;
    const digits = e ? [...e.digits, ...'----'.slice(e.digits.length)] : [...this.s.code];
    digits.forEach((d, i) => ops.push({ t: 'txt', f: 'c', x: CODE_X + i * CODE_PITCH, y: CODE_Y, s: d }));
    if (e) ops.push({ t: 'inv', x: CODE_X + e.digits.length * CODE_PITCH, y: CODE_Y - 2, w: 19, h: 27 });
    ops.push(...this.rightOps(now));
    return ops;
  }
  rightOps(now) {
    const T = (f, x, y, s) => ({ t: 'txt', f, x, y, s });
    const title = (s, y = 6) => ({ t: 'txt', f: 's', x: RIGHT_X, y, s, align: 'c', w: RIGHT_W });
    const center = (items, y) => {   // items: [{ w, op: x => op }] laid out side by side, centered
      const W = items.reduce((a, it) => a + it.w + (it.gap ?? 0), 0);
      let x = RIGHT_X + Math.floor((RIGHT_W - W) / 2);
      return items.map(it => { x += it.gap ?? 0; const o = it.op(x, y); x += it.w; return o; });
    };
    if (this.msg) return [title(this.msg.lines[0]), title(this.msg.lines[1], 20)];
    const s = this.s, c = this.c;
    switch (this.page) {
      case 'PALT': {
        const ops = [title('PRESSURE ALT')];
        const alt = this.pressureAltitude();
        const valid = this.altValid;
        let items;
        if (c.format === 'FLIGHT LVL') {
          const fl = Math.round(alt / 100), v = !valid ? '---' : (fl < 0 ? '-' : '') + String(Math.abs(fl)).padStart(3, '0');   // three digits, minus in front below sea level (not shown in the manuals)
          items = [{ w: textWidth('a', 'FL'), op: x => T('a', x, 23, 'FL') }, { gap: 3, w: textWidth('m', v), op: x => T('m', x, 18, v) }];
        } else {
          const v = !valid ? '-----' : String(c.format === 'METERS' ? Math.round(alt * 0.3048) : Math.round(alt / 100) * 100);
          const u = c.format === 'METERS' ? 'mM' : 'ftM';
          items = [{ w: textWidth('m', v), op: x => T('m', x, 18, v) }, { gap: 1, w: unitWidth(u), op: x => ({ t: 'unit', id: u, x, y: 18 }) }];
        }
        // altitude trend arrow (PG): two sizes depending on the vertical speed; VS RATE sets the sensitivity
        const vs = s.sim.vs, r = c.vsRate;
        if (valid && Math.abs(vs) >= r) {
          const id = (vs > 0 ? 'up' : 'dn') + (Math.abs(vs) >= 2 * r ? 'L' : '');
          items.push({ gap: 2, w: unitWidth(id), op: x => ({ t: 'unit', id, x, y: id.endsWith('L') ? 19 : 21 }) });
        }
        return [...ops, ...center(items, 18)];
      }
      case 'FTIME': return [title('FLIGHT TIME'), { t: 'txt', f: 'm', x: RIGHT_X, y: 18, s: fmtTime(this.flightTimer.elapsed(now) / 1000), align: 'c', w: RIGHT_W }];
      case 'CUP': return [title('COUNT UP'), { t: 'txt', f: 'm', x: RIGHT_X, y: 18, s: fmtTime(this.countUp.elapsed(now) / 1000), align: 'c', w: RIGHT_W }];
      case 'CDOWN': {
        const cd = this.cd;
        const ops = [];
        // expired: the COUNT DOWN banner is replaced with a flashing EXPIRED and the time counts up
        if (cd.expired) { if (now % 1000 < 600) ops.push(title('EXPIRED')); } else ops.push(title('COUNT DOWN'));
        if (cd.entry) {
          const d = [...cd.entry.digits, ...'000000'.slice(cd.entry.digits.length)];
          const str = `${d[0]}${d[1]}:${d[2]}${d[3]}:${d[4]}${d[5]}`;
          const x0 = RIGHT_X + Math.floor((RIGHT_W - textWidth('m', str)) / 2);
          ops.push(T('m', x0, 18, str));
          const i = cd.entry.digits.length, cx = x0 + i * 9 + Math.floor(i / 2) * 3;
          ops.push({ t: 'inv', x: cx - 1, y: 17, w: 10, h: 14 });
          return ops;
        }
        const el = cd.sw.elapsed(now) / 1000;
        const sec = cd.expired ? el - cd.initial : cd.initial - el;
        ops.push({ t: 'txt', f: 'm', x: RIGHT_X, y: 18, s: fmtTime(Math.max(0, cd.expired ? Math.floor(sec) : Math.ceil(sec))), align: 'c', w: RIGHT_W });
        return ops;
      }
      case 'ALTMON': {
        const ops = [title('ALT MONITOR', 5)];
        const m = this.altMon;
        if (!m.on || !this.altValid) return ops;
        const dev = s.sim.alt - m.ref;
        const hundreds = String(Math.round(Math.abs(dev) / 100) * 100);
        const word = dev >= 0 ? 'ABOVE' : 'BELOW';
        const items = [{ w: textWidth('m', hundreds), op: x => T('m', x, 17, hundreds) }, { gap: 1, w: unitWidth('ftM'), op: x => ({ t: 'unit', id: 'ftM', x, y: 17 }) }];
        // over the deviation limit ABOVE / BELOW flashes (GTX 330 Pilot's Guide)
        const shown = !m.alert || now % 1000 < 600;
        items.push({ gap: 5, w: textWidth('s', word), op: x => shown && T('s', x, 21, word) });
        return [...ops, ...center(items, 17).filter(Boolean)];
      }
      case 'OAT': {
        const oat = c.tempUnits === 'F' ? Math.round(s.sim.oat * 9 / 5 + 32) : Math.round(s.sim.oat);
        const da = String(this.densityAltitude());
        return [T('s', RIGHT_X + 9, 9, 'OAT'), { t: 'txt', f: 'm', x: RIGHT_X, y: 4, s: String(oat), align: 'r', w: 67 },
          { t: 'unit', id: c.tempUnits === 'F' ? 'degF' : 'degCM', x: RIGHT_X + 68, y: 4 },
          T('s', RIGHT_X + 3, 25, 'DALT'), { t: 'txt', f: 'm', x: RIGHT_X, y: 20, s: da, align: 'r', w: 71 }, { t: 'unit', id: 'ftM', x: RIGHT_X + 72, y: 20 }];
      }
      case 'CONTRAST': case 'DISPLAY': {
        const v = this.page === 'CONTRAST' ? c.contrast / 99 : c.bkltLvl / 999;
        return [title(this.page), { t: 'frame', x: RIGHT_X + 7, y: 18, w: 62, h: 12 },
          { t: 'rect', x: RIGHT_X + 8, y: 19, w: 1 + Math.round(59 * v), h: 10 }];
      }
    }
    return [];
  }

  // live values on the diagnostics pages
  diagOps(id) {
    const T = (f, x, y, s) => ({ t: 'txt', f, x, y, s });
    const sim = this.s.sim, n3 = v => String(clamp(Math.round(v), 0, 999)).padStart(3, '0');
    if (id === 'GRAY') {
      const alt = Math.round(sim.alt / 100) * 100;
      const bits = sim.encoder ? grayBits(alt) : '0000000000';
      const ops = [T('s', 5, 13, 'GRAY'), T('s', 5, 23, 'CODE'), T('s', 108, 13, 'DECODED'), T('s', 108, 23, 'ALTITUDE')];
      [...'4124124124'].forEach((ch, i) => ops.push(T('s', [35, 42, 49, 56, 63, 70, 77, 84, 91, 98][i], 11, ch)));
      [...bits].forEach((b, i) => ops.push(T('b', 35 + i * 7, 21, b)));
      const v = sim.encoder ? String(alt) : '0';
      ops.push({ t: 'txt', f: 'b', x: 150, y: 21, s: v, align: 'r', w: 41 }, { t: 'unit', id: 'ft', x: 192, y: 21 });
      return ops;
    }
    if (id === 'EXTSW') {
      const box = (x, on) => (on ? { t: 'rect', x, y: 20, w: 7, h: 8 } : { t: 'frame', x, y: 20, w: 7, h: 8 });
      return [box(46, sim.extIdent), box(116, sim.extStby), box(186, this.squatActive())];
    }
    if (id === 'ANALOG') {
      const bus = sim.lightBus;
      return [T('b', 53, 3, n3(bus <= 14 ? bus / 14 * 999 : 999)), T('b', 108, 3, n3(this.photo() * 9.99)), T('b', 178, 3, n3(512)),
        T('b', 53, 21, n3(bus / 28 * 999)), T('b', 108, 21, n3(this.c.tempSensor === 'YES' ? 500 + sim.oat * 5 : 0)), T('b', 178, 21, n3(540))];
    }
    if (id === 'RSDISP') {
      return [T('b', 62, 3, this.c.rs1In), T('s', 100, 5, '+______.__'), T('s', 164, 5, 'n/a'),
        T('b', 62, 20, this.c.rs2In), T('s', 100, 22, '+______.__'), T('s', 164, 22, 'n/a')];
    }
    if (id === 'RX12' || id === 'RX34') {
      const row = y => [T('b', 43, y - 2, '000'), ...[...'00000000'].map((ch, i) => T('s', 66 + i * 6, y, ch)), T('s', 119, y, '+______.__'), T('s', 183, y, 'n/a')];
      return [...row(5), ...row(22)];
    }
    return [];
  }
  squatActive() { return this.c.squat === 'YES' && this.s.sim.onGround; }
}

// a number key pressed repeatedly scrolls through the digit/alpha characters of that key (IM 5.2.12.1 step 6;
// PG: "to enter the letter R press the 5 Key four times" -> the digit comes first)
function cycleChar(e, k, table) {
  const set = table[+k];
  if (e.key === k) e.idx = (e.idx + 1) % set.length;
  else { e.key = k; e.idx = 0; }
  e.chars[e.pos] = set[e.idx];
}

export function validAddr(c) {
  if (c.addrType === 'HEX') return /^[0-9A-F]{6}$/.test(c.addr || '') && c.addr !== '000000' && c.addr !== 'FFFFFF';
  return !!usTailToHex(c.addr || '');
}

// US N-number -> ICAO 24-bit address (FAA registry allocation); the unit converts it automatically (IM 5.2.12.1 NOTE)
const NLETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // letters used in N-numbers (no I, O)
const SUFFIX = 1 + 24 * 25, B4 = 1 + 24 + 10, B3 = 10 * B4 + SUFFIX, B2 = 10 * B3 + SUFFIX, B1 = 10 * B2 + SUFFIX;
export function usTailToHex(tail) {
  const t = tail.toUpperCase();
  if (!/^[1-9][0-9]{0,4}$|^[1-9][0-9]{0,3}[A-HJ-NP-Z]{1,2}$/.test(t) || t.length > 5) return null;
  const suffix = s => 1 + NLETTERS.indexOf(s[0]) * 25 + (s.length === 2 ? 1 + NLETTERS.indexOf(s[1]) : 0);
  let out = 0xA00001 + (+t[0] - 1) * B1;
  const sizes = [B2, B3, B4];
  for (let i = 1; i < t.length; i++) {
    const ch = t[i];
    if (i === 4) { out += /[A-Z]/.test(ch) ? 1 + NLETTERS.indexOf(ch) : 1 + 24 + +ch; break; }
    if (/[A-Z]/.test(ch)) { out += suffix(t.slice(i)); break; }
    out += SUFFIX + +ch * sizes[i - 1];
  }
  return out.toString(16).toUpperCase();
}

// Gillham (gray) code of an altitude, bits in the order of the GRAY CODE page header: D4 A1 A2 A4 B1 B2 B4 C1 C2 C4
const C_BITS = ['001', '011', '010', '110', '100'];   // C1 C2 C4 for the five 100-ft steps
export function grayBits(alt) {
  const n = Math.round(alt / 100) + 12;                 // 100-ft increments from -1200 ft
  const n500 = Math.floor(n / 5);
  let n100 = n % 5;
  if (n500 % 2) n100 = 4 - n100;                        // the 100-ft code runs backwards in odd 500-ft bands
  const g = n500 ^ (n500 >> 1);                         // 500-ft gray code, bits D1 D2 D4 A1 A2 A4 B1 B2 B4
  const bit = i => (g >> i) & 1;
  return `${bit(6)}${bit(5)}${bit(4)}${bit(3)}${bit(2)}${bit(1)}${bit(0)}${C_BITS[n100]}`;
}


// start-up page (PG figure): "Garmin GTX 328 ©1999-2007 / SW Version 5.00 Garmin Ltd or subs / Self Test In Progress"
function bootOps(u) {
  return [
    { t: 'txt', f: 'b', x: 16, y: 1, s: `Garmin GTX ${u.model}` },
    { t: 'txt', f: 's', x: 134, y: 3, s: `©1999-${u.year}` },
    { t: 'txt', f: 's', x: 0, y: 14, s: `SW Version ${u.sw}`, align: 'c', w: 100 },
    { t: 'txt', f: 's', x: 100, y: 14, s: 'Garmin Ltd or subs', align: 'c', w: 100 },
    { t: 'txt', f: 's', x: 0, y: 24, s: 'Self Test In Progress', align: 'c', w: 200 },
  ];
}
