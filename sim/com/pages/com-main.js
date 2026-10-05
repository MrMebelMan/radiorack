// Main page for a band (COM, or NAV on a NAV/COM): tune standby, save it as a user
// frequency (ENT), database look-up (PUSH CRSR), timer prompts.
import { S } from '../../core/util.js';
import { toChars } from '../../core/text.js';
import { MAX_USER, NAME_LEN } from '../constants.js';
import { COM_BAND } from '../band.js';

const bandOf = p => p.band || COM_BAND;

export default {
  handlers: {
    outer(p, d) { if (p.prompt) return; const b = bandOf(p); this.setStandby(b.stepMhz(b.state(this).stb, d), b); },
    inner(p, d) { if (p.prompt) return; const b = bandOf(p); this.setStandby(b.stepKhz(b.state(this).stb, d, this), b); },
    push(p) { if (p.prompt) return; this.openLookup('com', { id: 'com', band: p.band }, bandOf(p)); },
    ENT(p) {
      if (p.prompt) {
        const sw = p.prompt.which === 'down' ? this.cd : this.cu;
        if (p.prompt.kind === 'stop') sw.stop(this.now());
        else sw.reset();
        p.prompt = null;
        return;
      }
      const dt = this.displayedTimer();
      if (dt && (dt === 'down' ? this.cd : this.cu).running) {
        p.prompt = { kind: 'stop', which: dt };
        return;
      }
      const band = bandOf(p);
      if (band.state(this).user.length >= MAX_USER) return;
      this.page = { id: 'uedit', mode: 'save', band, freq: band.state(this).stb, name: toChars('', NAME_LEN), type: band.types.length - 1, cur: 0, back: { id: 'com', band: p.band } };
    },
    CLR(p) {
      if (p.prompt) { p.prompt = null; return; }
      const dt = this.displayedTimer();
      if (dt) p.prompt = { kind: 'reset', which: dt };
    },
  },

  render(p, v) {
    const band = bandOf(p);
    const st = band.state(this);
    const stbLabel = band.key === 'com' && this.s.mon ? 'MN' : 'STB';
    v.right = { type: 'com', ann: band.label, label: stbLabel, big: [S(band.fmt(st.stb))] };
    const dt = this.displayedTimer();
    if (p.prompt) {
      // only the STOP prompt is shown in the manual (3.6.3); CLR then ENT resets without a prompt text
      if (p.prompt.kind === 'stop') {
        v.bottomLeft = [S('STOP TMR? ENT=STOP CLR=CANCEL')];
        v.bottomRight = [this.timerSeg(p.prompt.which)];
        v.promptWide = true;
        return;
      }
    }
    // NAV/COM: T/F shows the distance/speed/time row instead (manual 2.4)
    const dst = this.dstRow?.();
    if (dst) { v.bottomFull = dst; return; }
    v.bottomLeft = [S(this.reverse(st.act, band) || band.idle.act)];
    v.bottomRight = dt ? [this.timerSeg(dt)] : [S(this.reverse(st.stb, band) || band.idle.stb)];
  },
};
