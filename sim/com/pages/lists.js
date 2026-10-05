// Recent / user / nearest lists, for the COM or NAV band (p.band). ENT = standby,
// FLIP/FLOP = active (both stay on the list); CLR returns to the functions display.
// User list: CLR then ENT deletes, PUSH CRSR edits. NEAREST APT lists airports;
// ENT shows that airport's frequencies.
import { S, wrap, clamp } from '../../core/util.js';
import { toChars } from '../../core/text.js';
import { NAME_LEN } from '../constants.js';
import { COM_BAND } from '../band.js';

export const LIST_KINDS = ['recent', 'user', 'napt', 'nacc', 'nfss', 'nwx', 'nvor'];
const NEAREST_TITLES = { napt: 'NEAREST AIRPORT', nacc: 'NEAREST ACC', nfss: 'NEAREST FSS', nwx: 'NEAREST WEATHER', nvor: 'NEAREST VOR' };
const bandOf = p => p.band || COM_BAND;

export default {
  handlers: {
    inner(p, d) {
      if (p.confirm) return;
      const n = this.listItems(p.kind, bandOf(p)).length;
      if (n) p.idx = wrap(p.idx + d, n);
    },
    ENT(p) {
      const band = bandOf(p);
      if (p.confirm) {
        band.state(this).user.splice(p.idx, 1);
        this.save();
        p.confirm = false;
        p.idx = clamp(p.idx, 0, Math.max(0, this.listItems('user', band).length - 1));
        return;
      }
      const it = this.listItems(p.kind, band)[p.idx];
      if (!it || it.empty) return;
      if (it.apt) { this.openAirportFreqs(it.apt, p); return; }
      this.setStandby(it.freq, band);
    },
    CLR(p) {
      if (p.confirm) { p.confirm = false; return; }
      if (p.kind === 'user') {
        const it = this.listItems('user', bandOf(p))[p.idx];
        if (it && !it.empty) { p.confirm = true; return; }
      }
      this.goBack(p);
    },
    push(p) {
      if (p.kind !== 'user' || p.confirm) return;
      const band = bandOf(p);
      const it = this.listItems('user', band)[p.idx];
      if (!it) return;
      const u = it.user;
      this.page = {
        id: 'uedit', mode: 'edit', band, idx: p.idx,
        freq: u.freq, name: toChars(u.name, NAME_LEN), type: band.types.indexOf(u.type), cur: 0,
        back: p, func: p.func,
      };
    },
  },

  render(p, v) {
    const band = bandOf(p);
    const items = this.listItems(p.kind, band);
    const it = items[p.idx];
    const count = p.kind === 'user' ? band.state(this).user.length : items.length;
    let rows;
    if (!items.length) {
      rows = [[S('')], [S('')]];   // no screenshot of an empty list
    } else {
      const l2 = p.kind === 'user'
        ? [S('WPT '), S(toChars(it.user.name, NAME_LEN).join(''), { ul: true }), S(' TYPE '), S(it.user.type || '____', { ul: true })]
        : it.l2;
      const head = it.apt ? it.apt.id : band.fmt(it.freq);
      rows = [[S(head, { big: true }), S(` ${p.idx + 1}`, { inv: true }), S(` OF ${count}`, { small: true })], l2];
    }
    v.right = { type: 'page', title: band.titles[p.kind] || NEAREST_TITLES[p.kind], rows };
    v.bottomLeft = [S(p.kind === 'napt' ? 'ENT=DONE' : '⇄=ACT  ENT=STB')];
    if (p.confirm) v.bottomFull = [S('DELETE FREQUENCY? ENT TO CONFIRM')];
  },
};
