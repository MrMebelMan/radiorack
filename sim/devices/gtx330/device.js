// Garmin GTX 330 w/ES Mode S transponder (SW 8). Sources: Pilot's Guide 190-00207-00 Rev K (PG),
// Installation Manual 190-00207-02 Rev AE (IM). Same front panel, LCD and fonts as the GTX 328, so the unit
// is the GTX 328 class with the GTX 330 configuration pages, Flight ID dialog, ADS-B and TIS alerts.
import { GTX328, cycleChar, defaultSettings } from '../gtx328/device.js';
import { keyChars, keyRows } from '../gtx328/config.js';
import { PAGES, JUMP_TARGET, defaultConfig, extraOps } from './config.js';
import { UNIT_INFO } from './info.js';
import { textWidth } from '../../ui/lcd-gtx.js';

export { BOOT_MS, IDENT_MS } from '../gtx328/device.js';
export const PERSIST_KEY = 'gtx330-sim-v1';
const FLT_LEN = 8;                        // Flight ID field: 8 characters (PG "Editing the Flight ID" figure)
const RIGHT_X = 123, RIGHT_W = 77;        // FUNC page area, as on the GTX 328
const DLG_X = 118, DLG_PITCH = 9;         // Flight ID dialog entry cells (PG "Editing the Flight ID" figure)
// GPS position / ground speed inputs (IM Tables 5-11, 5-15)
const GPS_429 = ['GPS/FMS', 'GRMN DISPLAY', 'GRMN 743A'];
const GPS_RS = ['GPS', 'REMOTE', 'GNS'];

export class GTX330 extends GTX328 {
  static PERSIST_KEY = PERSIST_KEY;
  static UNIT_INFO = UNIT_INFO;

  get cfgPages() { return PAGES; }
  get jumpTarget() { return JUMP_TARGET; }
  cfgExtraOps(page) { return extraOps(page, this.c); }
  // IM Rev AE 5.1.1 has no "hold STBY selects GND" (Rev U, SW 7, had it)
  get stbyHoldGnd() { return false; }

  defaults() {
    const d = defaultSettings();
    d.cfg = defaultConfig();
    d.fltId = null;                       // Flight ID set by the crew; null: the Default Flight ID
    Object.assign(d.sim, { gpsPos: true, tis: true, adsbFault: false });
    return d;
  }

  powerOn(key) {
    const was = this.power;
    super.powerOn(key);
    if (was || !this.power) return;
    this.adsbOn = true;                   // PG ADS-B: defaults to ON at each power cycle
    this.dialog = null;
    this.tisWas = this.s.sim.tis;
  }

  input(evt, arg) {
    if (evt === 'traffic') return this.trafficAlert();
    return super.input(evt, arg);
  }

  // ---------- Flight ID (PG "Flight ID Entry Dialog", IM 5.2.13.2-5.2.13.3) ----------
  get defaultFltId() {
    const c = this.c;
    if (c.dfltMode === 'US TAIL') return c.addrType === 'US TAIL#' ? `N${c.addr}` : '';
    return c.fltId || '';
  }
  get fltId() { return this.c.pilotFlt === 'YES' && this.s.fltId ? this.s.fltId : this.defaultFltId; }

  key(k) {
    if (this.dialog) return this.dialogKey(k);
    // CRSR on the FLIGHT ID page opens the dialog when ALLOW PILOT TO EDIT FLT ID is enabled
    if (k === 'CRSR' && this.page === 'FLTID' && !this.entry) {
      if (this.c.pilotFlt === 'YES') this.dialog = { chars: [...this.fltId], editing: false, pos: 0, key: null };
      return;
    }
    super.key(k);
  }
  dialogKey(k) {
    const d = this.dialog;
    if (k === 'IDENT' || k === 'VFR') return super.key(k);
    if (!d.editing) {
      if (k === 'CRSR') { d.editing = true; d.pos = 0; d.key = null; return; }
      if (k === 'CLR') { this.dialog = null; return; }                           // closes without saving
      if (k === '8' && this.defaultFltId) { this.setFltId(this.defaultFltId); this.dialog = null; }   // 8=<DEFAULT>
      return;
    }
    if (/^[0-9]$/.test(k)) { cycleChar(d, k, keyChars(false)); return; }
    if (k === 'CRSR') {
      // to the next field; past the last one (over the remaining blanks) the entry is complete
      d.key = null;
      if (++d.pos < FLT_LEN) return;
      const id = d.chars.join('').replace(/[_ ]/g, '');
      if (!id) { d.editing = false; d.chars = [...this.fltId]; return; }          // blank: not saved, the dialog stays open
      this.setFltId(id);
      this.dialog = null;
      return;
    }
    if (k === 'CLR') {
      d.key = null;
      if (d.pos > 0) { d.pos--; return; }
      d.chars = [...this.fltId]; d.editing = false;                               // first character: back to the last Flight ID
    }
  }
  setFltId(id) { this.s.fltId = id; this.save(); }

  // ---------- ADS-B (IM 5.2.17, PG ADS-B) ----------
  get gpsSource() {
    const c = this.c;
    return [c.in1Data, c.in2Data, c.in3Data].some(v => GPS_429.includes(v)) || [c.rs1In, c.rs2In].some(v => GPS_RS.includes(v));
  }
  get adsbActive() { const t = this.c.adsbTx; return t === 'ENABLE' || (t === 'PILOT SET' && this.adsbOn); }
  // NO ADSB: configured ON but no position to transmit, or turned OFF by the pilot
  get noAdsb() {
    if (!this.operating || this.c.adsbTx === 'DISABLE') return false;
    return !this.adsbActive || !(this.gpsSource && this.s.sim.gpsPos);
  }
  get opMode() {
    const m = super.opMode;
    if (m !== 'OFF' && this.s.sim.adsbFault && this.adsbActive) return 'FAIL';   // PG Failure Annunciation
    return m;
  }

  // ---------- air / ground ----------
  get autoSource() {
    const c = this.c;
    if (c.squat === 'YES') return 'squat';
    return this.gpsSource ? 'gps' : null;
  }
  liftOffLanding(air, now) {
    const c = this.c, ft = this.flightTimer;
    // IM Table 5-18: CLEAR resets to zero at every lift-off, ACCUM continues; both stop on the ground (PG Timer 5)
    if (c.autoFlt !== 'MAN') {
      if (air) { if (c.autoFlt === 'CLEAR') ft.reset(); ft.start(now); } else ft.stop(now);
    }
    // IM 5.2.11 AUTO ALT: STBY switches to ALT when lift-off is detected
    if (air && c.autoAlt === 'ON' && this.mode === 'STBY') { this.mode = 'ALT'; this.s.lastMode = 'ALT'; this.save(); }
  }

  // ---------- TIS voice alerts (IM 5.2.2 messages 3 and 5, 5.2.3) ----------
  get tisOutput() { const c = this.c; return [c.out1, c.out2].includes('GARMIN W/TIS') || [c.rs1Out, c.rs2Out].includes('REMOTE + TIS'); }
  tisSound(id) { this.sound(this.c.tisAudio === 'TONE' ? 'tone' : 'msg', id); }   // OFF is not available for TIS
  trafficAlert() { if (this.tisOutput && this.replying && this.s.sim.tis) this.tisSound('traffic'); }
  tick() {
    super.tick();
    if (!this.power) return;
    const cov = this.s.sim.tis;
    if (this.tisWas && !cov && this.tisOutput && this.replying) this.tisSound('traffic-not-available');
    this.tisWas = cov;
  }
  playMessage(n) {
    const id = { 3: 'traffic', 5: 'traffic-not-available' }[n];
    if (id) return this.sound('msg', id);
    super.playMessage(n);
  }

  // ---------- FUNC pages (IM 5.1.3 order) ----------
  pages() {
    const c = this.c;
    return ['FLTID', 'PALT', 'FTIME', 'ALTMON', ...(c.tempSensor === 'YES' ? ['OAT'] : []), 'CUP', 'CDOWN',
      ...(c.contrastMode === 'MAN' ? ['CONTRAST'] : []), ...(c.bkltMode === 'MAN' ? ['DISPLAY'] : []),
      ...(c.adsbTx === 'PILOT SET' ? ['ADSB'] : [])];
  }
  startStop() {
    if (this.page === 'ADSB') { this.adsbOn = !this.adsbOn; return; }
    super.startStop();
  }

  // ---------- view ----------
  // start-up page: no GTX 330 figure; the GTX 328 layout without its copyright years and software version
  bootOps() {
    return [{ t: 'txt', f: 'b', x: 16, y: 1, s: `Garmin GTX ${this.unitInfo.model}` },
      { t: 'txt', f: 's', x: 0, y: 24, s: 'Self Test In Progress', align: 'c', w: 200 }];
  }
  mainOps(now) {
    if (this.dialog) return this.dialogOps();
    const ops = super.mainOps(now);
    if (this.noAdsb && !this.identActive) ops.push({ t: 'txt', f: 'a', x: 0, y: 2, s: 'NO ADSB' });   // PG: upper left corner
    return ops;
  }
  rightOps(now) {
    // positions from the PG figures
    if (!this.msg && this.page === 'FLTID') {
      return [{ t: 'txt', f: 's', x: 137, y: 6, s: 'FLIGHT ID' }, { t: 'txt', f: 'm', x: RIGHT_X, y: 18, s: this.fltId, align: 'c', w: RIGHT_W }];
    }
    if (!this.msg && this.page === 'ADSB') return [{ t: 'txt', f: 's', x: 132, y: 4, s: 'ADS-B TX' }, { t: 'txt', f: 'm', x: 144, y: 16, s: this.adsbOn ? 'ON' : 'OFF' }];
    return super.rightOps(now);
  }
  // PG figures "Flight ID Entry Dialog" and "Editing the Flight ID"
  dialogOps() {
    const d = this.dialog;
    const ops = [{ t: 'txt', f: 'm', x: 1, y: 2, s: 'FLIGHT ID:' }];
    if (!d.editing) {
      ops.push({ t: 'txt', f: 'm', x: 118, y: 2, s: d.chars.join('') });
      const dflt = this.defaultFltId;
      // one line ending at the right edge (figure); 8= only with a configured default
      ops.push({ t: 'txt', f: 's', x: 0, y: 24, w: 199, align: 'r', s: `CLR=CANCEL  CRSR=EDIT${dflt ? `  8=${dflt}` : ''}` });
      return ops;
    }
    // fixed 9-dot cells, blanks as underscores; the cursor inverts its cell
    for (let i = 0; i < FLT_LEN; i++) {
      const ch = d.chars[i] || '_', cx = DLG_X + i * DLG_PITCH, hl = i === d.pos;
      ops.push({ t: 'txt', f: 'm', x: cx + Math.ceil((DLG_PITCH - textWidth('m', ch)) / 2) - (hl ? 1 : 0), y: 2, s: ch });
      if (hl) ops.push({ t: 'inv', x: cx - 1, y: 1, w: DLG_PITCH + 1, h: 14 });
    }
    return [...ops, ...keyRows(false, 2, 1)];
  }
}
