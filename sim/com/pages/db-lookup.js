// COM database look-up (manual 2.4 / 3.2.3): enter identifier, then pick the
// frequency type. From the COM page it ends back on the COM page.
import { S, wrap, clamp } from '../../core/util.js';
import { fmtFreq } from '../../core/freq.js';
import { cycleChar, toChars, fromChars } from '../../core/text.js';
import { IDENT_LEN } from '../constants.js';

export default {
  handlers: {
    inner(p, d) {
      if (p.phase === 'type') { p.idx = wrap(p.idx + d, p.entries.length); return; }
      p.ident[p.cur] = cycleChar(p.ident[p.cur], d);
      // Garmin-style auto-complete from the characters up to the cursor
      const prefix = p.ident.slice(0, p.cur + 1).join('');
      if (!prefix.includes('_')) {
        const m = this.db.allIdents().map(a => a.id).sort().find(id => id.startsWith(prefix));
        if (m) p.ident = toChars(m, IDENT_LEN);
        else for (let i = p.cur + 1; i < IDENT_LEN; i++) p.ident[i] = '_';
      }
    },
    outer(p, d) {
      if (p.phase === 'type') { if (d < 0 && !p.fromList) p.phase = 'ident'; return; }
      p.cur = clamp(p.cur + d, 0, IDENT_LEN - 1);
    },
    push(p) {
      if (p.from === 'com') this.goCom();
    },
    ENT(p) {
      if (p.phase === 'ident') {
        const a = this.db.findIdent(fromChars(p.ident));
        if (!a) { this.toast('NO MATCHING IDENTIFIER'); return; }
        p.entries = this.db.typeEntries(a);
        if (p.idx >= p.entries.length) p.idx = 0;
        p.phase = 'type';
        return;
      }
      const e = p.entries[p.idx];
      this.dbMemory = { ident: p.ident.join(''), idx: p.idx, t: this.now() };
      this.setStandby(e.f);
      if (p.from === 'com') this.goCom(); // manual 2.4: then FLIP/FLOP swaps on the COM page
    },
    CLR(p) {
      if (p.phase === 'type' && !p.fromList) { p.phase = 'ident'; return; }
      this.goBack(p);
    },
  },

  render(p, v) {
    if (p.phase === 'ident') {
      const field = p.ident.map((c, i) => S(c, { inv: i === p.cur }));
      const a = this.db.findIdent(fromChars(p.ident));
      const name = a ? a.name : 'ENTER IDENTIFIER';
      if (p.from === 'com') {
        v.right = { type: 'com', com: true, label: '', big: field };
        v.bottomLeft = [S('COM ACTIVE')];
        v.bottomRight = [S(name)];
      } else {
        v.right = { type: 'page', title: 'COM DATABASE', rows: [field.map(x => ({ ...x, big: true })), [S(name)]] };
        v.bottomLeft = [S('ENT=DONE')];
      }
      return;
    }
    // manual 2.4 screenshot: title, frequency, "WPT xxxx TYPE yyy" (no count)
    const e = p.entries[p.idx];
    const ident = fromChars(p.ident);
    v.right = {
      type: 'page', title: 'COM DATABASE',
      rows: [
        [S(fmtFreq(e.f), { big: true })],
        ident === this.db.fir.id
          ? [S(this.db.stationName(e.f)), S(' '), S(e.type, { inv: true })]
          : [S('WPT '), S(ident, { ul: true }), S(' TYPE '), S(e.label, { inv: true })],
      ],
    };
    v.bottomLeft = [S('⇄=ACT  ENT=STB')];
  },
};
