// Recent / user / nearest lists. ENT = standby, FLIP/FLOP = active (both stay on the
// list); CLR returns to the functions display. User list: CLR then ENT deletes,
// PUSH CRSR edits. NEAREST APT lists airports; ENT shows that airport's frequencies.
import { S, wrap, clamp } from '../../core/util.js';
import { fmtFreq } from '../../core/freq.js';
import { toChars } from '../../core/text.js';
import { TYPES, MAX_USER, NAME_LEN } from '../constants.js';

export const LIST_KINDS = ['recent', 'user', 'napt', 'nacc', 'nfss', 'nwx'];
const TITLES = { recent: 'COM RECENT FREQS', user: 'COM USER FREQS', napt: 'NEAREST AIRPORT', nacc: 'NEAREST ACC', nfss: 'NEAREST FSS', nwx: 'NEAREST WEATHER' };

export default {
  handlers: {
    inner(p, d) {
      if (p.confirm) return;
      const n = this.listItems(p.kind).length;
      if (n) p.idx = wrap(p.idx + d, n);
    },
    ENT(p) {
      if (p.confirm) {
        this.s.user.splice(p.idx, 1);
        this.save();
        p.confirm = false;
        p.idx = clamp(p.idx, 0, Math.max(0, this.listItems('user').length - 1));
        return;
      }
      const it = this.listItems(p.kind)[p.idx];
      if (!it || it.empty) return;
      if (it.apt) { this.openAirportFreqs(it.apt, p); return; }
      this.setStandby(it.freq);
    },
    CLR(p) {
      if (p.confirm) { p.confirm = false; return; }
      if (p.kind === 'user') {
        const it = this.listItems('user')[p.idx];
        if (it && !it.empty) { p.confirm = true; return; }
      }
      this.goBack(p);
    },
    push(p) {
      if (p.kind !== 'user' || p.confirm) return;
      const it = this.listItems('user')[p.idx];
      const u = it.empty ? { freq: this.s.stb, name: '', type: '' } : it.user;
      this.page = {
        id: 'uedit', mode: 'edit', idx: it.empty ? -1 : p.idx,
        freq: u.freq, name: toChars(u.name, NAME_LEN), type: TYPES.indexOf(u.type), cur: 0,
        back: p, func: p.func,
      };
    },
  },

  render(p, v) {
    const items = this.listItems(p.kind);
    const it = items[p.idx];
    const count = p.kind === 'user' ? this.s.user.length : items.length;
    let rows;
    if (!items.length) {
      rows = [[S(['recent', 'user'].includes(p.kind) ? 'LIST EMPTY' : 'NO POSITION')], [S('')]];
    } else if (it.empty) {
      rows = [[S('---.---', { big: true }), S(` ${p.idx + 1}`, { inv: true }), S(` OF ${MAX_USER}`, { small: true })],
        [S('EMPTY - PUSH CRSR TO ADD')]];
    } else {
      const l2 = p.kind === 'user'
        ? [S('WPT '), S(toChars(it.user.name, NAME_LEN).join(''), { ul: true }), S(' TYPE '), S(it.user.type || '____', { ul: true })]
        : it.l2;
      const head = it.apt ? it.apt.id : fmtFreq(it.freq);
      rows = [[S(head, { big: true }), S(` ${p.idx + 1}`, { inv: true }), S(` OF ${count}`, { small: true })], l2];
    }
    v.right = { type: 'page', title: TITLES[p.kind], rows };
    v.bottomLeft = [S(p.kind === 'napt' ? 'ENT=DONE' : '⇄=ACT  ENT=STB')];
    if (p.confirm) v.bottomFull = [S('DELETE FREQUENCY? ENT TO CONFIRM')];
  },
};
