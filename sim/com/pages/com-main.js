// COM page: tune standby, save it as a user frequency, database look-up, timer prompts.
import { S } from '../../core/util.js';
import { fmtFreq, stepMhz, stepKhz } from '../../core/freq.js';
import { toChars } from '../../core/text.js';
import { TYPES, MAX_USER, NAME_LEN } from '../constants.js';

export default {
  handlers: {
    outer(p, d) { if (p.prompt) return; this.setStandby(stepMhz(this.s.stb, d)); },
    inner(p, d) { if (p.prompt) return; this.setStandby(stepKhz(this.s.stb, d, this.s.spacing)); },
    push(p) { if (p.prompt) return; this.openLookup('com', { id: 'com' }); },
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
      if (this.s.user.length >= MAX_USER) { this.toast('USER FREQ LIST FULL'); return; }
      this.page = { id: 'uedit', mode: 'save', freq: this.s.stb, name: toChars('', NAME_LEN), type: TYPES.length - 1, cur: 0, back: { id: 'com' } };
    },
    CLR(p) {
      if (p.prompt) { p.prompt = null; return; }
      const dt = this.displayedTimer();
      if (dt) p.prompt = { kind: 'reset', which: dt };
    },
  },

  render(p, v) {
    const s = this.s;
    v.right = { type: 'com', com: true, label: s.mon ? 'MN' : 'STB', big: [S(fmtFreq(s.stb))] };
    const dt = this.displayedTimer();
    if (p.prompt) {
      v.bottomLeft = [S(p.prompt.kind === 'stop' ? 'STOP TMR? ENT=STOP CLR=CANCEL' : 'RESET TMR? ENT=RESET CLR=CANCEL')];
      v.bottomRight = [this.timerSeg(p.prompt.which)];
      v.promptWide = true;
      return;
    }
    v.bottomLeft = [S(this.reverse(s.act) || 'COM ACTIVE')];
    v.bottomRight = dt ? [this.timerSeg(dt)] : [S(this.reverse(s.stb) || 'COM STANDBY')];
  },
};
