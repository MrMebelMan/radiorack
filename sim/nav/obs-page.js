// OBS page (GNC 255 manual 2.3): NAV frequencies on top; bottom row = decoded ident,
// OBS setting, graphic CDI (5 dots each side, 2 deg/dot), TO/FROM triangle and the
// reference COM frequency. Without an external CDI the knobs set the OBS.
import { S, wrap } from '../core/util.js';
import { fmtFreq } from '../core/freq.js';
import { NAV_BAND } from './band.js';

const pad3 = n => String(n).padStart(3, '0');

export default {
  handlers: {
    // outer = 10 degree steps, inner = 1 degree (manual: "the outer and inner knobs can be used")
    outer(p, d) { this.s.nav.obs = wrap(this.s.nav.obs + d * 10, 360); this.save(); },
    inner(p, d) { this.s.nav.obs = wrap(this.s.nav.obs + d, 360); this.save(); },
  },
  render(p, v) {
    const nav = this.s.nav;
    v.right = { type: 'com', ann: 'NAV', label: 'STB', big: [S(NAV_BAND.fmt(nav.stb))] };
    const c = this.cdi();
    // localizer (photo of the unit): "RIS  LOC" instead of the OBS setting, circle at the center
    const mid = c.loc ? [S('LOC'), S(' ')] : [S(pad3(nav.obs)), S('OBS', { tiny: true }), S(' ')];
    v.bottomFull = [
      S(c.ident || ''), S(' '),
      ...mid,
      { t: '', cdi: c },
      S(' '), { t: '', stack: ['CM', 'ACT'] }, S(fmtFreq(this.s.act)),
    ];
  },
};
