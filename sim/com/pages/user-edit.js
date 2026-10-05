// Save / edit a user frequency (COM manual 2.3 / 3.2.2, NAV 2.2.2 / 3.3.2):
// inner = character / value, outer = cursor; ENT accepts the name, then the OUTER
// knob moves to the TYPE field; ENT there saves, CLR cancels.
import { S, range, wrap, clamp } from '../../core/util.js';
import { cycleChar, fromChars } from '../../core/text.js';
import { MAX_USER, NAME_LEN } from '../constants.js';
import { COM_BAND } from '../band.js';

const bandOf = p => p.band || COM_BAND;

export function ueditFields(p) {
  const chars = range(0, NAME_LEN - 1).map(i => `c${i}`);
  return p.mode === 'edit' ? ['mhz', 'khz', ...chars, 'type'] : [...chars, 'type'];
}

export default {
  handlers: {
    outer(p, d) {
      const fields = ueditFields(p);
      if (p.nameDone) {
        p.nameDone = false;
        if (d > 0) p.cur = fields.indexOf('type');
        return;
      }
      p.cur = clamp(p.cur + d, 0, fields.length - 1);
    },
    inner(p, d) {
      if (p.nameDone) return;
      const band = bandOf(p);
      const f = ueditFields(p)[p.cur];
      if (f === 'mhz') p.freq = band.stepMhz(p.freq, d);
      else if (f === 'khz') p.freq = band.stepKhz(p.freq, d, this);
      else if (f === 'type') p.type = wrap(p.type + d, band.types.length);
      else { const i = +f.slice(1); p.name[i] = cycleChar(p.name[i], d); }
    },
    ENT(p) {
      const band = bandOf(p);
      const fields = ueditFields(p);
      if (fields[p.cur][0] === 'c' && !p.nameDone) { p.nameDone = true; return; }
      const user = band.state(this).user;
      const entry = { freq: p.freq, name: fromChars(p.name), type: band.types[p.type] };
      if (p.mode === 'save' || p.idx < 0) {
        if (user.length >= MAX_USER) return;
        user.push(entry);
      } else {
        user[p.idx] = entry;
      }
      this.save();
      this.goBack(p);
    },
    CLR(p) { this.goBack(p); },
  },

  render(p, v) {
    const band = bandOf(p);
    const user = band.state(this).user;
    const fields = ueditFields(p);
    const cf = p.nameDone ? null : fields[p.cur];
    const f = band.fmt(p.freq).split('.');
    const freqSegs = p.mode === 'edit'
      ? [S(f[0], { big: true, inv: cf === 'mhz' }), S('.', { big: true }), S(f[1], { big: true, inv: cf === 'khz' })]
      : [S(band.fmt(p.freq), { big: true })];
    // save screen: 'Number of Frequencies Saved' (manual 2.3); edit: position in list
    const n = p.mode === 'save' ? user.length : (p.idx < 0 ? user.length + 1 : p.idx + 1);
    const name = p.name.map((c, i) => S(c, { inv: cf === `c${i}`, ul: true }));
    v.right = {
      type: 'page', title: p.mode === 'save' ? 'SAVE USER FREQ' : 'EDIT USER FREQ',
      rows: [
        [...freqSegs, S(` ${n}`), S(` OF ${MAX_USER}`, { small: true })],
        [S('WPT '), ...name, S(' TYPE '), S(band.types[p.type] || '____', { inv: cf === 'type', ul: true })],
      ],
    };
    v.bottomLeft = [S(band.saveHint)];
  },
};
