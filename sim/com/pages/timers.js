// Count-up and count-down timer pages (manual 3.5).
import { S, wrap, clamp } from '../../core/util.js';

export const countUp = {
  handlers: {
    ENT() { this.cu.toggle(this.now()); },
    CLR() { this.cu.reset(); },
  },
  render(p, v) {
    v.right = { type: 'page', title: 'COUNT UP TIMER', rows: [[{ ...this.cuSeg(), big: true }]] };
    v.bottomLeft = [S('ENT=START/STOP  CLR=RESET')];
  },
};

export const countDown = {
  handlers: {
    push(p) {
      if (p.edit) return;
      const v = this.s.cdStart;
      p.edit = { h: Math.floor(v / 3600), m: Math.floor((v % 3600) / 60), s: v % 60, field: 1 };
    },
    outer(p, d) { if (p.edit) p.edit.field = clamp(p.edit.field + d, 0, 2); },
    inner(p, d) {
      if (!p.edit) return;
      const e = p.edit;
      if (e.field === 0) e.h = wrap(e.h + d, 24);
      else if (e.field === 1) e.m = wrap(e.m + d, 60);
      else e.s = wrap(e.s + d, 60);
    },
    ENT(p) {
      if (p.edit) {
        const e = p.edit;
        this.s.cdStart = e.h * 3600 + e.m * 60 + e.s;
        this.cd.reset();
        p.edit = null;
        this.save();
        return;
      }
      this.cd.toggle(this.now());
    },
    CLR(p) {
      if (p.edit) { p.edit = null; return; }
      this.cd.reset();
    },
  },
  render(p, v) {
    let big;
    if (p.edit) {
      const e = p.edit;
      big = [e.h, e.m, e.s].flatMap((x, i) => [S(String(x).padStart(2, '0'), { big: true, inv: e.field === i }), ...(i < 2 ? [S(':', { big: true })] : [])]);
      v.bottomLeft = [S('ENT=ACCEPT  CLR=CANCEL')];
    } else {
      big = [{ ...this.cdSeg(), big: true }];
      v.bottomLeft = [S('ENT=START/STOP CLR=RESET PUSH CRSR=SETTINGS')];
    }
    v.right = { type: 'page', title: 'COUNT DOWN TIMER', rows: [big] };
  },
};
