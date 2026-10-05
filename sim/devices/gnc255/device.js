// Garmin GNC 255A NAV/COM: the shared COM transceiver plus a VOR/LOC receiver
// (GNC 255A/255B Pilot's Guide 190-01182-01 Rev E).
import { clamp, wrap, S } from '../../core/util.js';
import { fmtTime } from '../../core/time.js';
import { radialFrom, wrap180, vorCdi, movePos, CDI_FULL_DEG } from '../../core/nav.js';
import { ComRadio } from '../../com/com-radio.js';
import { COM_BAND } from '../../com/band.js';
import { COM_MESSAGES, COM_SETTINGS, comDefaults } from '../../com/garmin-defs.js';
import { STUCK_WARN_MS } from '../../com/constants.js';
import { NAV_BAND, isLoc } from '../../nav/band.js';
import { NavDatabase, NAV_RANGE_NM } from '../../nav/nav-database.js';
import obsPage from '../../nav/obs-page.js';
import { AIRPORTS, STATIONS, FIR, POSITIONS, DB_INFO, USB_DB_INFO } from '../../data/lk.js';
import { NAVAIDS } from '../../data/lk-nav.js';
import { UNIT_INFO } from './info.js';

export const PERSIST_KEY = 'gnc255-sim-v2';
export const FLIGHT_VAR = 5;            // magnetic variation used to turn the flown track into true (Czech ~5E)
export const NAV_SIGNAL_NM = 150;       // simulator assumption: VOR/LOC usable within 150 NM (no altitude model)
const LOC_FULL_DEG = 2.5;               // simulator assumption: localizer full-scale deflection

// Messages (manual 5.1): the COM unit's plus the NAV / glideslope ones
export const MESSAGES = {
  ...COM_MESSAGES,
  GS_SERVICE: 'GLIDESLOPE - GLIDESLOPE RECEIVER NEEDS SERVICE.',
  GS_FAIL: 'GLIDESLOPE - GLIDESLOPE RECEIVER HAS FAILED.',
  NAV_XFR_STUCK: 'REMOTE KEY STUCK - NAV REMOTE TRANSFER KEY IS STUCK.',
  VLOC_SERVICE: 'VLOC RECEIVER - NAVIGATION RECEIVER NEEDS SERVICE.',
  VLOC_FAIL: 'VLOC RECEIVER - NAVIGATION RECEIVER HAS FAILED.',
};

// FUNC menu tree (manual 3.1): NAV FREQUENCY LIST added, Count Down before Count Up
export const MENU = [
  { title: 'COM FREQUENCY LIST', items: [['RECENT FREQS', 'recent'], ['USER FREQS', 'user'], ['DATABASE', 'db'], ['NEAREST APT', 'napt'], ['NEAREST ACC', 'nacc'], ['NEAREST FSS', 'nfss'], ['NEAREST WX', 'nwx']] },
  { title: 'NAV FREQUENCY LIST', items: [['RECENT FREQS', 'navrecent'], ['USER FREQS', 'navuser'], ['DATABASE', 'navdb'], ['NEAREST VOR', 'nvor']] },
  { title: 'ICS CONFIGURATION', items: [['ADJUST INTRCOM', 'adjics'], ['AUX AUDIO', 'aux'], ['INTRCOM ON/OFF', 'icsonoff'], ['SPEAKER ON/OFF', 'spk']] },
  { title: 'SYS CONFIGURATION', items: [['COM SPACING', 'spacing'], ['COM SIDETONE', 'sidetone'], ['DSPL BRT', 'brt'], ['DSPL CONTRAST', 'contrast'], ['DATABASE INFO', 'dbinfo'], ['LOAD DATABASE', 'load'], ['SOFTWARE VER', 'swver'], ['SERIAL NUMBER', 'serial']] },
  { title: 'TMR CONFIGURATION', items: [['COUNT DOWN', 'tmrdown'], ['COUNT UP', 'tmrup']] },
];

export function defaultSettings() {
  return {
    ...comDefaults(DB_INFO),
    act: 123610, stb: 120880,                // BOLESLAV RADIO (LKMB), KBELY TOWER (LKKB)
    recent: [123610, 120880],
    nav: {
      act: 112600, stb: 112250,              // OKL Praha DVOR/DME, NER Neratovice VOR/DME
      recent: [112600, 112250],
      user: [
        { freq: 112600, name: 'OKL', type: 'VOR' },
        { freq: 112250, name: 'NER', type: 'VOR' },
        { freq: 116950, name: 'VOZ', type: 'VOR' },
      ],
      vol: 50, id: false, obs: 0,
      tf: 'off',                             // off | to | from  (T/F key)
    },
    flight: { gs: 0, trk: 0 },
  };
}

const pad3 = n => String(Math.round(n) % 360).padStart(3, '0');

const DEVICE = {
  persistKey: PERSIST_KEY,
  defaults: defaultSettings,
  menu: MENU,
  settingsDefs: COM_SETTINGS,
  messages: MESSAGES,
  unitInfo: UNIT_INFO,
  navBand: NAV_BAND,
  data: { airports: AIRPORTS, stations: STATIONS, fir: FIR, positions: POSITIONS, usbDb: USB_DB_INFO },
  pages: { obs: obsPage },
  // bezel keys; ignored while a message is shown (ENT acknowledges)
  keys: {
    // C/N: select the COM or NAV (VLOC) radio mode (manual 1.2)
    CN: r => { r.mode = r.mode === 'nav' ? 'com' : 'nav'; r.goMain(); },
    FUNC: r => { if (r.page.func) r.goMain(); else { r.menuPos = { cat: 0, item: -1 }; r.page = { id: 'menu', func: true }; } },   // FUNC opens at COM FREQUENCY LIST, no item (every manual procedure starts there)
    // OBS: current OBS setting and graphic CDI (manual 2.3); OBS again returns
    OBS: r => { if (r.page.id === 'obs') r.goMain(); else r.page = { id: 'obs', band: NAV_BAND }; },
    // T/F: bearing TO / radial FROM the active VOR, with the DST row (manual 2.4);
    // does not operate for localizer frequencies
    TF: r => {
      if (isLoc(r.s.nav.act)) return;
      const n = r.s.nav;
      n.tf = { off: 'to', to: 'from', from: 'off' }[n.tf] || 'to';
      r.save();
      if (r.page.id !== 'com') r.goMain();
    },
  },
  // work even while a message is shown
  alwaysKeys: {
    // monitor is a COM function; it stays on when switching to NAV (manual 2.1.2)
    MON: r => { if (r.mode !== 'nav') { r.s.mon = !r.s.mon; r.save(); } },
    remoteIcs: r => { r.s.ics.on = !r.s.ics.on; r.save(); },
  },
  itemBlocked(key) { return key === 'adjics' && !this.s.ics.on; },
  infoPage(kind) {
    const s = this.s, u = this.unitInfo;
    return {
      dbinfo: ['DATABASE INFO', `CYCLE: ${s.db.cycle}`, `EFCTV: ${s.db.effective}`, `REG: ${s.db.region}`],
      swver: ['SOFTWARE VERSIONS', `DISPLAY: ${u.displaySw}`, `COM: ${u.comSw}`],
      serial: ['SERIAL NUMBER', `S/N: ${u.serial}`, `ID: ${u.systemId}`],
    }[kind];
  },
};

export class GNC255 extends ComRadio {
  constructor(opts = {}) {
    super(opts, DEVICE);
    this.navDb = new NavDatabase(NAVAIDS);
    this.mode = 'com';
    this.livePos = null;       // flight-simulated position; null = the chosen start position
    this.flying = false;
    this.lastTick = this.now();
    // states saved by an older version may lack these
    const d = defaultSettings();
    this.s.nav = { ...d.nav, ...(this.s.nav || {}) };
    this.s.flight = { ...d.flight, ...(this.s.flight || {}) };
  }

  mainBand() { return this.mode === 'nav' ? NAV_BAND : COM_BAND; }
  showCom() { this.mode = 'com'; this.goCom(); }
  get pos() { return this.livePos || super.pos; }
  // "ID" left of the active NAV frequency when the Morse ident is on (manual 2.2.3)
  navAnn() { return this.s.nav.id ? 'ID' : ''; }

  // operating states reset at power-up, like MON / SQ (assumption, see ASSUMPTIONS.md)
  powerOn() { super.powerOn(); this.mode = 'com'; this.s.nav.tf = 'off'; this.s.nav.id = false; }

  // ---------- NAV receiver ----------
  // station received on the active NAV frequency: { st, d } or null
  navSignal() {
    if (!this.power) return null;
    const b = this.navDb.stationOn(this.s.nav.act, this.pos, NAV_SIGNAL_NM);
    return b && b.st.type !== 'DME' ? b : null;
  }
  // CDI state for the OBS page and tests
  cdi() {
    const sig = this.navSignal();
    if (!sig) return { ident: null, needle: null, toFrom: null };
    const st = sig.st;
    const radial = radialFrom(st, this.pos);
    if (st.type === 'ILS') {
      if (st.course == null) return { ident: st.id, needle: null, toFrom: null, loc: true };
      // inbound on the course the aircraft is on the reciprocal radial of the LOC antenna
      const dev = wrap180(radial - wrap(st.course + 180, 360));
      return { ident: st.id, needle: clamp(dev / LOC_FULL_DEG, -1, 1), toFrom: null, loc: true };
    }
    const c = vorCdi(this.s.nav.obs, radial);
    return { ident: st.id, needle: c.needleDeg / CDI_FULL_DEG, toFrom: c.toFrom, radial };
  }
  // DST row (manual 2.4): ident, bearing TO / radial FROM, distance, ground speed,
  // time to station, active NAV frequency. Needs a GPS source; stations within 200 NM.
  dstRow() {
    const n = this.s.nav;
    if (n.tf === 'off' || this.page.id !== 'com') return null;
    const navFreq = [{ t: '', stack: ['NV', 'ACT'] }, S(NAV_BAND.fmt(n.act))];
    const b = this.s.gps ? this.navDb.stationOn(n.act, this.pos, NAV_RANGE_NM) : null;
    if (!b) return [S('---  ---'), { t: '', stack: n.tf === 'to' ? ['TO', 'BRG'] : [] }, S(' --.-'), { t: '', stack: ['N', 'M'] }, S(' ---'), { t: '', stack: ['K', 'T'] }, S(' -:--  '), ...navFreq];
    const radial = radialFrom(b.st, this.pos);
    const ang = n.tf === 'to' ? (radial + 180) % 360 : radial;
    const gs = Math.round(this.s.flight.gs * (this.flying ? 1 : 0));
    const ete = gs > 0 ? fmtTime(b.d / gs * 3600).slice(1, 5) : '-:--';
    const dist = b.d < 100 ? b.d.toFixed(1) : String(Math.round(b.d));
    return [
      S(b.st.id), S(' '), S(pad3(ang)), { t: '', stack: n.tf === 'to' ? ['TO', 'BRG'] : [] },
      S(` ${dist}`), { t: '', stack: ['N', 'M'] }, S(` ${gs}`), { t: '', stack: ['K', 'T'] },
      S(` ${ete}  `), ...navFreq,
    ];
  }

  // ---------- inputs ----------
  input(evt, arg) {
    if (this.power && !this.booting) {
      const now = this.now();
      switch (evt) {
        case 'navVol': this.s.nav.vol = clamp(this.s.nav.vol + arg * 5, 0, 100); this.save(); return;
        // NAV ident is enabled by pressing the NAV volume knob when the NAV display is active
        case 'navIdDown': return;
        case 'navIdUp': if (this.mode === 'nav') { this.s.nav.id = !this.s.nav.id; this.save(); } return;
        case 'navXfrDown': this.hold.navXfr = { t: now }; return;
        case 'navXfrUp': {
          const h = this.hold.navXfr; this.hold.navXfr = null;
          if (h && !h.stuck) this.swap(NAV_BAND);
          return;
        }
      }
    } else if (evt === 'navVol') {
      this.s.nav.vol = clamp(this.s.nav.vol + arg * 5, 0, 100); this.save(); return;
    }
    super.input(evt, arg);
  }

  // ---------- flight simulation ----------
  setStartPos(id) { this.s.posId = id; this.livePos = null; this.save(); }
  setFlying(on) { this.flying = on; this.lastTick = this.now(); }
  tick() {
    const now = this.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    const f = this.s.flight;
    if (this.flying && f.gs > 0 && dt > 0) {
      this.livePos = movePos(this.pos, wrap(f.trk + FLIGHT_VAR, 360), f.gs * dt / 3600000);
    }
    const h = this.hold.navXfr;
    if (this.power && h && !h.stuck && now - h.t >= STUCK_WARN_MS) { h.stuck = true; this.raise('NAV_XFR_STUCK'); }
    super.tick();
  }

  // COM VOL line also shows the active NAV frequency (manual 1.2 screenshot)
  view() {
    const v = super.view();
    if (v.bottomFull && this.now() < this.volShowUntil && !this.stuck) {
      v.bottomFull = [...v.bottomFull, S(' '), { t: '', stack: ['NV', 'ACT'] }, S(NAV_BAND.fmt(this.s.nav.act))];
    }
    return v;
  }

  // what is heard on the NAV side: Morse ident of the received station while ID is on
  navAudio() {
    const sig = this.navSignal();
    if (!sig || !this.s.nav.id) return null;
    return { ident: sig.st.id, vol: this.s.nav.vol };
  }
}

