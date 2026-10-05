// Database look-up (COM manual 2.4 / 3.2.3, NAV 3.3.3): enter the identifier, then
// pick the frequency type. NAV: "DUPLICATES FOUND" -> ENT -> pick the station by
// name -> ENT. From the main page the look-up ends back on the main page.
import { S, wrap, clamp } from '../../core/util.js';
import { cycleChar, toChars, fromChars } from '../../core/text.js';
import { IDENT_LEN } from '../constants.js';
import { COM_BAND } from '../band.js';

const bandOf = p => p.band || COM_BAND;

function toTypes(r, p, facility) {
  p.entries = bandOf(p).db(r).typeEntries(facility);
  if (p.idx >= p.entries.length) p.idx = 0;
  p.phase = 'type';
}

export default {
  handlers: {
    inner(p, d) {
      if (p.phase === 'type') { p.idx = wrap(p.idx + d, p.entries.length); return; }
      if (p.phase === 'dups') { p.dupIdx = wrap(p.dupIdx + d, p.dups.length); return; }
      if (p.phase === 'dupmsg') return;
      p.ident[p.cur] = cycleChar(p.ident[p.cur], d);
      // Garmin-style auto-complete from the characters up to the cursor
      const prefix = p.ident.slice(0, p.cur + 1).join('');
      if (!prefix.includes('_')) {
        const m = bandOf(p).db(this).allIdents().map(a => a.id).sort().find(id => id.startsWith(prefix));
        if (m) p.ident = toChars(m, IDENT_LEN);
        else for (let i = p.cur + 1; i < IDENT_LEN; i++) p.ident[i] = '_';
      }
    },
    outer(p, d) {
      if (p.phase === 'type') { if (d < 0 && !p.fromList) p.phase = 'ident'; return; }
      if (p.phase !== 'ident') return;
      p.cur = clamp(p.cur + d, 0, IDENT_LEN - 1);
    },
    push(p) {
      if (p.from === 'com') this.goMain();
    },
    ENT(p) {
      const db = bandOf(p).db(this);
      if (p.phase === 'ident') {
        const all = db.findAll(fromChars(p.ident));
        if (!all.length) return;
        if (all.length > 1) { p.dups = all; p.dupIdx = 0; p.phase = 'dupmsg'; return; }
        toTypes(this, p, all[0]);
        return;
      }
      if (p.phase === 'dupmsg') { p.phase = 'dups'; return; }
      if (p.phase === 'dups') { toTypes(this, p, p.dups[p.dupIdx]); return; }
      const e = p.entries[p.idx];
      this.dbMemory[bandOf(p).key] = { ident: p.ident.join(''), idx: p.idx, t: this.now() };
      this.setStandby(e.f, bandOf(p));
      if (p.from === 'com') this.goMain(); // manual 2.4: then FLIP/FLOP swaps on the main page
    },
    CLR(p) {
      if (p.phase === 'dups' || p.phase === 'dupmsg') { p.phase = 'ident'; return; }
      if (p.phase === 'type' && !p.fromList) { p.phase = 'ident'; return; }
      this.goBack(p);
    },
  },

  render(p, v) {
    const band = bandOf(p);
    const db = band.db(this);
    const ident = fromChars(p.ident);
    if (p.phase === 'dupmsg' || p.phase === 'dups') {
      // manual 3.3.3 "Duplicate Identifiers" screenshots
      const second = p.phase === 'dupmsg' ? [S('DUPLICATES FOUND')] : [S(p.dups[p.dupIdx].name, { inv: true })];
      v.right = { type: 'page', title: band.titles.db, rows: [[S(ident, { big: true })], second] };
      v.bottomLeft = [S(p.phase === 'dupmsg' ? 'ENT=DONE' : 'ENT=ACCEPT  CLR=UNDO')];
      return;
    }
    if (p.phase === 'ident') {
      const field = p.ident.map((c, i) => S(c, { inv: i === p.cur }));
      const a = db.findIdent(ident);
      const name = a ? a.name : 'ENTER IDENTIFIER';
      if (p.from === 'com') {
        v.right = { type: 'com', ann: band.label, label: '', big: field };
        v.bottomLeft = [S(band.idle.act)];
        v.bottomRight = [S(name)];
      } else {
        v.right = { type: 'page', title: band.titles.db, rows: [field.map(x => ({ ...x, big: true })), [S(name)]] };
        v.bottomLeft = [S('ENT=DONE')];
      }
      return;
    }
    // manual 2.4 / 3.3.3 screenshots: title, frequency, "WPT xxxx TYPE yyy" (no count)
    const e = p.entries[p.idx];
    v.right = {
      type: 'page', title: band.titles.db,
      rows: [
        [S(band.fmtDb(e.f), { big: true })],
        band.key === 'com' && ident === db.fir.id
          ? [S(db.stationName(e.f)), S(' '), S(e.type, { inv: true })]
          : [S('WPT '), S(ident, { ul: true }), S(' TYPE '), S(e.label, { inv: true })],
      ],
    };
    v.bottomLeft = [S('⇄=ACT  ENT=STB')];
  },
};
