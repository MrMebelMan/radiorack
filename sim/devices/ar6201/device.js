// Becker AR6201-(X0X) VHF transceiver. Source of truth: Operating Instructions Issue 5 (2013)
// ("OI") and Installation and Operation Manual DV 14300.03 Issue 5 ("IM"); gaps from the AR620X
// family manual DV14307.03 ("FAM") are listed in ASSUMPTIONS.md.
// Same shape as the other units: input(evt, arg), tick(), view(), audio().
import { clamp, wrap } from '../../core/util.js';
import { fmtFreq, stepMhz, khzList, is833Only, snapTo25 } from '../../core/freq.js';
import { makeStore } from '../../core/persist.js';
import { UNIT_INFO } from './info.js';
import { presetChannels } from './channels.js';
import { SETUP_PAGES, SETUP_PASSWORD, setupDefaults, FAIL_TYPES } from './setup.js';

export const PERSIST_KEY = 'ar6201-sim-v1';
export const LONG_MS = 2000;             // OI 4.1: "at least 2 seconds" = long press
export const BOOT_MS = 3000;             // WAIT "for a few seconds" (FAM)
export const FLASH_MS = 300;             // display inverted "for a short time" (not stated)
export const MENU_MS = 5000;             // Intercom Menu 5 s (OI); Pilots Menu "a few seconds" (FAM: 5 s)
export const CHSEL_MS = 5000;            // channel number selection: 5 s timeout (OI 4.4.3)
export const STO_MS = 7000;              // storage: 7 s without action -> back without storing (OI 4.8.1)
export const LAST_MS = 10000;            // Last Channels: active frequency selected for 10 s (OI 4.8.2)
export const STUCK_MS = 120000;          // TX cut off after 120 s (OI 4.3.2)
export const WARN_CYCLE_MS = 5000;       // "Reappear every 5 seconds" (OI 4.13)
export const WARN_SHOW_MS = 2000;        // how long each time (not stated)
export const BLINK_MS = 500;             // preset inverted "in a sequence of approximately one second" (IM CONFIGURATION)
export const KNOB_STEPS = 100;           // volume knob: 1 % per step after OFF
const VOX_OFF = 11;                      // VOX threshold above +10 = "OFF"
export const MODES = ['std', 'dir', 'chn'];
export const STRENGTH_DBM = { poor: -95, good: -85, strong: -75 };   // simulated signals (not from the manual)
// label characters (OI 4.8.1 "blank A B C …", FAM: A…Z 0…9 - / blank)
export const LABEL_CHARS = [' ', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/'];

export function defaultSettings() {
  const { ch, labels } = presetChannels();
  return {
    act: 120335, pre: 122160, spacing: 833, mode: 'std',
    vol: 50,
    sqThr: 12, brt: 50, icVol: 37, vox: -15,
    ch, labels, last: [],
    setup: setupDefaults(),
    fail: {},
    sim: { volts: 13.8, dimBus: 12, hot: false, failStart: false, strength: 'good', micLevel: -10 },
  };
}

// squelch threshold 6..26 opens at about -105..-87 dBm (OI 4.12.2)
export const thrDbm = thr => -105 + (thr - 6) * 18 / 20;
// field strength triangle (FAM 3.7): empty just passing squelch, half -88..-80, full above -80 dBm
export const triLevel = dbm => (dbm > -80 ? 'full' : dbm > -88 ? 'half' : 'empty');

export class AR6201 {
  constructor({ now = () => performance.now(), storage = null } = {}) {
    this.now = now;
    this.store = makeStore(storage, PERSIST_KEY);
    this.unitInfo = UNIT_INFO;
    this.s = defaultSettings();
    const saved = this.store.load();
    if (saved) {
      const d = this.s;
      Object.assign(d, saved, {
        sim: { ...d.sim, ...(saved.sim || {}) },
        setup: { ...d.setup, ...(saved.setup || {}), cfg: { ...d.setup.cfg, ...(saved.setup?.cfg || {}) } },
      });
    }
    this.knob = 0;                       // volume knob: 0 = OFF (starts OFF)
    this.bus = true;                     // aircraft power
    this.power = false;
    this.held = {};                      // key -> { at, long, pre }
    this.ptt = false; this.tx = false; this.txStart = 0; this.stuck = false;
    this.rx = [];                        // simulated transmissions { f, start, until, clip, dbm }
    this.beeps = 0;                      // counts up for each beep (ui/audio.js plays one)
    this.extIc = false; this.speaking = false;
    this.runFail = false;                // internal failure during operation
    this.warnSince = {};
    this.reset();
  }
  reset() {
    this.scan = false; this.edit = null; this.chsel = null; this.sto = null; this.menu = null;
    this.setup = null; this.failStart = false; this.flashUntil = 0; this.preHoldUntil = 0;
    this.activeSince = this.now(); this.lastLogged = false; this.sqlOn = true;
  }
  save() { this.store.save(this.s); }
  factoryReset() { this.s = defaultSettings(); this.save(); this.reset(); }
  recallDefaults() { this.s.setup = setupDefaults(); this.s.sqThr = 12; this.s.brt = 50; }

  // ---------- power ----------
  get switchOn() { return this.knob > 0; }
  applyPower() {
    const want = this.switchOn && this.bus;
    if (want && !this.power) {
      this.power = true;
      this.reset();
      if (!this.modes.includes(this.s.mode)) this.s.mode = this.modes[0];   // page disabled in MDE PAGES
      this.bootUntil = this.now() + BOOT_MS;
      // keys already held when switching on (MDE -> Installation Setup) are not presses
      for (const k of Object.keys(this.held)) this.held[k].pre = true;
      this.setupReq = !!this.held.MDE || !!this.held.COMBO;
      this.failStart = !!this.s.sim.failStart;
      if (this.failStart) this.s.fail['P_INTERNAL IC'] = 1;
      this.runFail = false; this.warnSince = {};
    } else if (!want && this.power) {
      this.power = false; this.tx = false; this.stuck = false;
      this.save();
    }
  }
  setAircraftPower(on) { this.bus = on; this.applyPower(); }
  get booting() { return this.power && this.now() < this.bootUntil; }
  flash() { this.flashUntil = this.now() + FLASH_MS; }

  // ---------- derived state ----------
  get speakerEnabled() { return !!this.s.setup.io[0].spk; }
  get voxDisabled() { return this.speakerEnabled || this.s.vox >= VOX_OFF; }
  get icActive() {
    if (!this.power || this.tx) return false;
    return this.extIc || (!this.voxDisabled && this.speaking && this.s.sim.micLevel >= this.s.vox);
  }
  get modes() {
    const p = this.s.setup.pages;
    return MODES.filter(m => (m === 'std' ? p.std : m === 'dir' ? p.bat : p.chn));
  }
  get backlight() {
    if (this.s.sim.volts < 9) return 0;   // FAM: backlight off at 9 V
    const st = this.s.setup;
    if (st.dim === 'NONE') return this.s.brt / 100;
    const c = st.illum[st.dim], v = this.s.sim.dimBus;
    if (v < c.v1) return 0;
    return clamp(c.b1 + c.rate * (Math.min(v, c.v2) - c.v1), 0, 100) / 100;
  }
  chanOf(f) { const i = this.s.ch.indexOf(f); return i < 0 ? null : i + 1; }
  usable(f) { return f != null && !(this.s.spacing === 25 && is833Only(f)); }
  sig(f) { const now = this.now(); return this.rx.find(r => r.f === f && now < r.until) || null; }
  // signal level of a transmission: fixed (tests) or the panel's Signal setting, live
  dbm(r) { return r.dbm ?? STRENGTH_DBM[this.s.sim.strength]; }
  opens(r) { return !!r && (!this.sqlOn || this.dbm(r) >= thrDbm(this.s.sqThr)); }
  get rxAct() { const r = this.sig(this.s.act); return this.opens(r) ? r : null; }
  get rxPre() { const r = this.scan ? this.sig(this.s.pre) : null; return this.opens(r) ? r : null; }
  // what is audible: active has priority; in Scan the preset when only it receives
  get hearing() {
    if (this.tx) return null;
    if (this.rxAct) return 'act';
    if (this.rxPre || (this.scan && this.now() < this.preHoldUntil)) return 'pre';
    return null;
  }

  setActive(f) {
    if (f === this.s.act) return;
    this.s.act = f; this.activeSince = this.now(); this.lastLogged = false;
    if (this.s.setup.cfg.fcBeep) this.beeps++;   // FREQ CHANGE BEEP
  }

  // ---------- inputs ----------
  input(evt, arg) {
    if (evt.includes(':')) [evt, arg] = evt.split(':');   // 'down:MDE' from the bezel hold bindings
    switch (evt) {
      case 'vol': {   // volume knob with OFF end stop
        this.knob = clamp(this.knob + arg, 0, KNOB_STEPS);
        if (this.knob > 0) this.s.vol = Math.round(this.knob / KNOB_STEPS * 100);
        this.applyPower(); this.save(); this.tick(); return;
      }
      case 'down': this.keyDown(arg); return;
      case 'up': this.keyUp(arg); return;
      case 'pttDown': this.pttDown(); return;
      case 'pttUp': this.pttUp(); return;
      case 'inner': this.turn(arg); this.save(); return;
      case 'push': this.push(); this.save(); return;
    }
  }
  keyDown(k) {
    if (this.held[k]) return;
    this.held[k] = { at: this.now(), long: false, pre: !this.power };
    if (this.power && !this.booting && this.failStart) { this.failStart = false; this.held[k].pre = true; this.afterStart(); }   // PRESS ANY KEY
  }
  keyUp(k) {
    const h = this.held[k];
    delete this.held[k];
    if (!h || h.pre || h.long || !this.power || this.booting) return;
    this.short(k); this.save();
  }
  pttDown() {
    this.ptt = true;
    if (!this.power || this.stuck) return;   // after STUCK PTT the line must first become inactive
    this.tx = true; this.txStart = this.now();
  }
  pttUp() { this.ptt = false; this.tx = false; this.stuck = false; }

  get busy() { return !this.power || this.booting || this.failStart; }

  short(k) {
    if (this.busy) return;
    if (this.setup) return this.setupKey(k);
    const now = this.now();
    if (this.menu) {
      this.menu.last = now;
      if (this.menu.kind === 'pilot' && k === 'MDE') return this.menuNext();
      if (this.menu.kind === 'ic' && k === 'ICSQL') return this.menuNext();
      return this.flash();
    }
    if (this.sto) return this.stoKey(k, false);
    switch (k) {
      case 'MDE':
        if (this.tx) return this.flash();
        if (this.scan) { this.scan = false; this.edit = null; return; }   // short MDE ends Scan, stays in Standard
        return this.nextMode();
      case 'STO': return this.startSto();
      case 'ICSQL': this.sqlOn = !this.sqlOn; return;   // independent of the selected operation menu
      case 'SCN':
        if (this.s.mode !== 'std' && !this.scan) return this.flash();
        if (this.tx) return this.flash();   // exchange disabled while transmitting
        [this.s.act, this.s.pre] = [this.s.pre, this.s.act]; this.activeSince = now; this.lastLogged = false;
        if (this.s.setup.cfg.fcBeep) this.beeps++;
        return;
      case 'COMBO': return;
    }
  }
  long(k) {
    if (this.busy) return;
    if (this.setup) return;
    if (this.menu) {
      if (k === 'MDE') { this.menu = null; return; }   // long MDE terminates both menus
      return this.flash();
    }
    if (this.sto) return this.stoKey(k, true);
    switch (k) {
      case 'MDE': return this.openMenu('pilot');
      case 'ICSQL': return this.openMenu('ic');
      case 'SCN':
        if (this.tx) return this.flash();
        if (this.scan) { this.scan = false; return; }
        this.scan = true; this.s.mode = 'std'; this.edit = null; this.chsel = null;
        return;
      case 'COMBO': {   // MDE + STO for 2 s: 8.33 / 25 kHz
        if (this.tx) return this.flash();
        this.s.spacing = this.s.spacing === 25 ? 833 : 25;
        if (this.s.spacing === 25) { this.s.act = snapTo25(this.s.act); this.s.pre = snapTo25(this.s.pre); }
        this.edit = null; this.chsel = null;
        return;
      }
      case 'STO': return;
    }
  }
  nextMode() {
    const ms = this.modes;
    this.s.mode = ms[(ms.indexOf(this.s.mode) + 1) % ms.length] || ms[0];
    this.edit = null; this.chsel = null;
  }

  // ---------- rotary encoder ----------
  turn(dir) {
    if (this.busy) return;
    const now = this.now();
    if (this.setup) return this.setupTurn(dir);
    if (this.menu) { this.menu.last = now; return this.menuTurn(dir); }
    if (this.sto) return this.stoTurn(dir);
    if (this.s.mode === 'chn' && !this.scan) return this.chanTurn(dir);
    if (!this.edit) return this.flash();
    const target = this.s.mode === 'dir' && !this.scan ? 'act' : 'pre';
    if (target === 'act' && this.tx) return this.flash();
    const f = this.stepField(this.s[target], this.edit.field, dir);
    if (target === 'act') this.setActive(f); else this.s.pre = f;
  }
  push() {
    if (this.busy) return;
    if (this.setup) return this.setupPush();
    if (this.menu) {
      this.menu.last = this.now();
      if (this.menu.kind === 'pilot') {
        if (this.menuPages[this.menu.page] === 'SQUELCH') { this.menu = null; return; }   // push on SQUELCH leaves
        return this.menuNext();
      }
      return this.flash();
    }
    if (this.sto) return this.stoPush();
    if (this.s.mode === 'chn' && !this.scan) {
      if (this.chsel) { this.chsel = null; return; }
      return this.chanStart('CH');
    }
    // 1st push MHz, 2nd 100 kHz, 3rd 25/8.33 kHz digits, then editing ends
    const field = this.edit ? this.edit.field + 1 : 0;
    this.edit = field > 2 ? null : { field };
  }
  stepField(f, field, dir) {
    const mhz = Math.floor(f / 1000), k = f % 1000;
    if (field === 0) return stepMhz(f, dir);
    if (field === 1) return mhz * 1000 + wrap(Math.floor(k / 100) + dir, 10) * 100 + (k % 100);
    const list = this.s.spacing === 25 ? khzList(25) : khzList(833).filter(x => Math.floor(x / 100) === Math.floor(k / 100));
    let i = list.indexOf(k);
    if (i < 0) i = 0;
    return mhz * 1000 + list[wrap(i + dir, list.length)];
  }

  // ---------- Channel Mode (OI 4.4.3) ----------
  chanList(db) {
    if (db === 'LAST') return this.s.last.map((f, i) => ({ f, n: i + 1 })).filter(x => this.usable(x.f));
    return this.s.ch.map((f, i) => ({ f, n: i + 1 })).filter(x => this.usable(x.f));
  }
  chanStart(db) {
    if (db === 'LAST' && !this.s.setup.mem.last) return this.flash();   // no access without STORE LAST CHANNEL
    const list = this.chanList(db);
    if (!list.length || this.tx) return this.flash();
    let i = db === 'CH' ? list.findIndex(x => x.f === this.s.act) : 0;
    if (i < 0) i = 0;
    this.chsel = { db, n: list[i].n, last: this.now() };
    this.setActive(list[i].f);
  }
  chanTurn(dir) {
    if (!this.chsel) return this.chanStart(dir > 0 ? 'CH' : 'LAST');   // one CW turn: user channels; CCW: Last Channels
    if (this.tx) return this.flash();
    const list = this.chanList(this.chsel.db);
    if (!list.length) return;
    let i = list.findIndex(x => x.n === this.chsel.n);
    i = wrap((i < 0 ? 0 : i) + dir, list.length);
    this.chsel.n = list[i].n; this.chsel.last = this.now();
    this.setActive(list[i].f);
  }

  // ---------- storage (OI 4.8.1) ----------
  startSto() {
    if (this.tx || !this.s.setup.mem.chStore) return this.flash();
    const own = this.chanOf(this.s.act);
    const free = this.s.ch.indexOf(null) + 1;
    this.sto = { stage: 'chan', n: own || free || 1, prevScan: this.scan, last: this.now() };
    this.edit = null; this.chsel = null;
  }
  stoKey(k, isLong) {
    const st = this.sto;
    st.last = this.now();
    if (k !== 'STO') return isLong ? undefined : this.flash();
    if (st.stage === 'chan') {
      if (isLong) return;
      const lab = (this.s.labels[this.s.act] || '').padEnd(10, ' ').slice(0, 10);
      Object.assign(st, { stage: 'label', chars: [...lab], pos: 0 });
      return;
    }
    if (isLong) { st.chars = Array(10).fill(' '); st.pos = 0; return; }   // long STO clears the label
    // short STO stores the frequency and its label, back to the previous mode
    this.s.ch[st.n - 1] = this.s.act;
    const label = st.chars.join('').trimEnd();
    if (label) this.s.labels[this.s.act] = label; else delete this.s.labels[this.s.act];
    this.sto = null;
  }
  stoTurn(dir) {
    const st = this.sto;
    st.last = this.now();
    if (st.stage === 'chan') { st.n = wrap(st.n - 1 + dir, 99) + 1; return; }
    const i = LABEL_CHARS.indexOf(st.chars[st.pos]);
    st.chars[st.pos] = LABEL_CHARS[wrap((i < 0 ? 0 : i) + dir, LABEL_CHARS.length)];
  }
  stoPush() {
    const st = this.sto;
    st.last = this.now();
    if (st.stage === 'label') st.pos = (st.pos + 1) % 10;   // cursor to the next position
  }

  // ---------- menus (OI 4.12) ----------
  get menuPages() {
    if (!this.menu) return [];
    if (this.menu.kind === 'ic') return ['IC VOLUME', 'IC VOX'];
    return this.s.setup.dim === 'NONE' ? ['BRIGHTNESS', 'SQUELCH'] : ['SQUELCH'];
  }
  openMenu(kind) { this.menu = { kind, page: 0, last: this.now() }; this.edit = null; this.chsel = null; }
  menuNext() { this.menu.page = (this.menu.page + 1) % this.menuPages.length; }
  menuTurn(dir) {
    const s = this.s;
    switch (this.menuPages[this.menu.page]) {
      case 'BRIGHTNESS': s.brt = clamp(s.brt + dir, 0, 100); break;
      case 'SQUELCH': s.sqThr = clamp(s.sqThr + dir, 6, 26); break;
      case 'IC VOLUME': s.icVol = clamp(s.icVol + dir, 0, 46); break;
      case 'IC VOX':
        if (this.speakerEnabled) return this.flash();   // VOX forced OFF by the enabled speaker
        s.vox = clamp(s.vox + dir, -30, VOX_OFF); break;
    }
  }

  // ---------- Installation Setup (IM 2.8) ----------
  afterStart() { if (this.setupReq) { this.setupReq = false; this.setup = { stage: 'pw', digits: [0, 0, 0, 0], pos: 0 }; } }
  get setupPages() { return SETUP_PAGES.filter(p => !p.show || p.show(this)); }
  get setupPage() { return this.setupPages.find(p => p.id === this.setup.id) || this.setupPages[0]; }
  setupGo(dir) {
    const ps = this.setupPages;
    const i = ps.indexOf(this.setupPage) + dir;
    if (i < 0 || i >= ps.length) return this.flash();
    this.setup.id = ps[i].id; this.setup.st = {};
  }
  setupKey(k) {
    const su = this.setup;
    if (su.stage === 'pw') {
      if (k !== 'STO') return this.flash();
      if (su.digits.join('') === SETUP_PASSWORD) { this.setup = { stage: 'pages', id: SETUP_PAGES[0].id, st: {} }; return; }
      su.digits = [0, 0, 0, 0]; su.pos = 0;
      return this.flash();
    }
    if (k === 'SCN') return this.setupGo(1);
    if (k === 'ICSQL') return this.setupGo(-1);
    if (k === 'STO') { const p = this.setupPage; return p.sto ? p.sto(this, su.st) : this.flash(); }
    this.flash();
  }
  setupTurn(dir) {
    const su = this.setup;
    if (su.stage === 'pw') { su.digits[su.pos] = wrap(su.digits[su.pos] + dir, 10); return; }
    const p = this.setupPage;
    if (p.turn) p.turn(this, su.st, dir); else this.flash();
  }
  setupPush() {
    const su = this.setup;
    if (su.stage === 'pw') { su.pos = (su.pos + 1) % 4; return; }
    this.setupGo(1);
  }
  micVu() { return this.speaking ? clamp((this.s.sim.micLevel + 30) / 40, 0, 1) : 0; }

  // ---------- warnings (OI 4.13) ----------
  warnConditions() {
    return {
      FAILURE: this.runFail,
      'STUCK PTT': this.stuck,
      'TX HOT': this.s.sim.hot,
      'LOW BATT': this.s.sim.volts < this.s.setup.lowBatt,
    };
  }
  get warning() {
    const now = this.now();
    for (const [id, on] of Object.entries(this.warnConditions())) {
      if (!on) continue;
      const t0 = this.warnSince[id] ?? now;
      if ((now - t0) % WARN_CYCLE_MS < WARN_SHOW_MS) return id;
    }
    return null;
  }
  raiseRunFailure() { if (!this.power) return; this.runFail = true; this.s.fail['C_INTERNAL IC'] = 1; this.save(); }

  // ---------- periodic ----------
  tick() {
    const now = this.now();
    this.rx = this.rx.filter(r => now < r.until);
    if (!this.power) return;
    if (this.booting) return;
    if (this.setupReq && !this.failStart && !this.setup) this.afterStart();
    for (const [k, h] of Object.entries(this.held)) {
      if (!h.pre && !h.long && now - h.at >= LONG_MS) { h.long = true; this.long(k); this.save(); }
    }
    // stuck microphone: back to receive after 120 s, STUCK PTT until the line is released
    if (this.tx && now - this.txStart >= STUCK_MS) { this.tx = false; this.stuck = true; this.s.fail['C_STUCK PTT'] = 1; this.save(); }
    if (this.s.sim.hot) this.s.fail['C_OVER TEMP'] = 1;
    for (const [id, on] of Object.entries(this.warnConditions())) {
      if (on && this.warnSince[id] == null) this.warnSince[id] = now;
      if (!on) delete this.warnSince[id];
    }
    if (this.menu && now - this.menu.last > MENU_MS) this.menu = null;
    if (this.chsel && now - this.chsel.last > CHSEL_MS) this.chsel = null;
    if (this.sto && now - this.sto.last > STO_MS) this.sto = null;   // back without storing
    // Scan: preset heard alone; SCAN HOLD TIME keeps it after the signal ends; beep on the preset
    const pre = this.scan ? this.sig(this.s.pre) : null;
    if (pre && this.opens(pre)) {
      if (!this.rxAct) this.preHoldUntil = now + this.s.setup.scanHold * 1000;
      if (!pre.beeped && this.s.setup.cfg.scanBeep) { pre.beeped = true; this.beeps++; }
    }
    // Last Channels Database (only Standard, Direct Tune or Scan)
    const mode = this.scan ? 'std' : this.s.mode;
    if (this.s.setup.mem.last && !this.lastLogged && (mode === 'std' || mode === 'dir') && now - this.activeSince >= LAST_MS) {
      this.lastLogged = true;
      if (this.s.last[0] !== this.s.act) {
        this.s.last = [this.s.act, ...this.s.last.filter(f => f !== this.s.act)].slice(0, 9);
        this.save();
      }
    }
  }

  // ---------- simulation (panel) ----------
  simulateRx(which, ms = 4000, clip = 0, dbm = null) {
    if (!this.power) return;
    const now = this.now();
    const f = which === 'act' ? this.s.act : this.s.pre;
    this.rx = this.rx.filter(r => r.f !== f);
    this.rx.push({ f, start: now, until: now + ms, clip, dbm });
  }
  audio() {
    if (!this.power || this.booting) return { src: this.power ? 'quiet' : 'off' };
    if (this.tx) return { src: 'tx', freq: this.s.act };
    const h = this.hearing;
    const quality = r => (this.dbm(r) > -80 ? 'strong' : this.dbm(r) > -88 ? 'good' : 'poor');   // same steps as the field strength triangle
    if (h === 'act') return { src: 'act', freq: this.s.act, call: this.rxAct, quality: quality(this.rxAct) };
    if (h === 'pre' && this.rxPre) return { src: 'stb', freq: this.s.pre, call: this.rxPre, quality: quality(this.rxPre) };
    if (!this.sqlOn) return { src: 'static' };
    return { src: 'quiet' };
  }
  beepAudio() { return this.beeps; }

  // ---------- view model ----------
  freqSegs(f, field = null, extra = {}) {
    const t = this.s.spacing === 25 ? fmtFreq(f).slice(0, 6) : fmtFreq(f);
    if (field == null) return [{ t, ...extra }];
    const parts = this.s.spacing === 25
      ? [[0, 3], [4, 5], [4, 6]][field]
      : [[0, 3], [4, 5], [5, 7]][field];
    const [a, b] = parts;
    return [{ t: t.slice(0, a) }, { t: t.slice(a, b), inv: true }, { t: t.slice(b) }].filter(x => x.t);
  }
  topAnn() {
    const ann = this.tx ? 'TX' : this.icActive ? 'IC' : this.voxDisabled ? 'NOVOX' : null;
    const spk = this.speakerEnabled && this.s.sim.volts >= 10 ? (this.tx || this.icActive ? 'mute' : 'on') : null;
    return { ann, spk };
  }
  view() {
    const now = this.now();
    if (!this.power) return { off: true };
    const bk = { flash: now < this.flashUntil, lit: this.backlight };
    if (this.booting) return { bk: { ...bk, scr: 'wait', lines: ['WAIT', `CH-SW V ${UNIT_INFO.chSw}`, `CM-SW V ${UNIT_INFO.cmSw}`] } };
    if (this.failStart) return { bk: { ...bk, scr: 'failstart' } };
    if (this.setup) {
      if (this.setup.stage === 'pw') return { bk: { ...bk, scr: 'pw', digits: this.setup.digits.join(''), pos: this.setup.pos } };
      const p = this.setupPage;
      return { bk: { ...bk, scr: 'setup', title: p.title, body: p.view(this, this.setup.st) } };
    }
    const s = this.s;
    const { ann, spk } = this.topAnn();
    const actEdit = this.edit && s.mode === 'dir' && !this.scan ? this.edit.field : null;
    const top = { ann, spk, tri: null, l: this.freqSegs(s.act, actEdit) };
    const ra = this.rxAct;
    if (ra) top.tri = triLevel(this.dbm(ra));
    else if (!this.sqlOn) top.tri = 'empty';   // squelch OFF: the arrow stays visible
    if (this.menu) {
      const page = this.menuPages[this.menu.page];
      const v = { BRIGHTNESS: [s.brt, s.brt / 100], SQUELCH: [s.sqThr, (s.sqThr - 6) / 20], 'IC VOLUME': [s.icVol, s.icVol / 46],
        'IC VOX': s.vox >= VOX_OFF ? ['OFF', 1] : [s.vox, (s.vox + 30) / 40] }[page];
      return { bk: { ...bk, scr: 'menu', top, label: page, value: String(v[0]), bar: v[1] } };
    }
    const bot = { ann: [], tri: null };
    if (this.sto) {
      bot.ann = ['STO'];
      if (this.sto.stage === 'chan') {
        bot.kind = 'sto'; bot.status = s.ch[this.sto.n - 1] == null ? 'FREE' : 'USED'; bot.num = String(this.sto.n).padStart(2, '0');
      } else {
        bot.kind = 'label';
        bot.l = this.sto.chars.map((c, i) => ({ t: c === ' ' ? '_' : c, inv: i === this.sto.pos }));
      }
    } else {
      if (this.sqlOn) bot.ann.push('SQL');
      if (this.scan) bot.ann.push('SCAN');
      const warn = this.warning;
      const mode = this.scan ? 'std' : s.mode;
      if (warn) { bot.kind = 'msg'; bot.t = warn; }
      else if (mode === 'std') {
        const sigPre = this.scan ? this.sig(s.pre) : null;
        const both = ra && sigPre && this.opens(sigPre);
        const blink = both && Math.floor(now / BLINK_MS) % 2 === 0;
        bot.kind = 'freq';
        bot.l = this.freqSegs(s.pre, this.edit ? this.edit.field : null, blink ? { inv: true } : {});
        if (!ra && this.hearing === 'pre') bot.tri = this.rxPre ? triLevel(this.dbm(this.rxPre)) : 'empty';
      } else if (mode === 'dir') {
        bot.kind = 'bat'; bot.t = `BAT ${s.sim.volts.toFixed(2)}V`;
      } else {
        bot.kind = 'chan';
        if (this.chsel) {
          bot.db = this.chsel.db; bot.num = this.chsel.db === 'LAST' ? String(this.chsel.n) : String(this.chsel.n).padStart(2, '0'); bot.inv = true;
        } else {
          const n = this.chanOf(s.act);
          bot.db = 'CH'; bot.num = n ? String(n).padStart(2, '0') : '--';
        }
        bot.label = s.labels[s.act] || '';
      }
    }
    return { bk: { ...bk, scr: 'main', top, bot } };
  }
}

export { FAIL_TYPES };
