// Table-driven settings page (ENT=DONE / CLR=UNDO): outer = field, inner = value.
// Definitions come from the device (this.settingsDefs).
import { S, clamp } from '../../core/util.js';

export default {
  handlers: {
    outer(p, d) {
      const def = this.settingsDefs[p.kind];
      const vis = def.fields.map((f, i) => i).filter(i => !def.fields[i].show || def.fields[i].show(p.vals));
      const pos = vis.indexOf(p.cur);
      p.cur = vis[clamp(pos + d, 0, vis.length - 1)];
    },
    inner(p, d) {
      const f = this.settingsDefs[p.kind].fields[p.cur];
      const i = f.vals.indexOf(p.vals[f.k]);
      p.vals[f.k] = f.vals[clamp(i + d, 0, f.vals.length - 1)];
    },
    ENT(p) {
      this.settingsDefs[p.kind].set.call(this, this.s, p.vals);
      this.save();
      this.goBack(p);
    },
    CLR(p) { this.goBack(p); },
  },

  render(p, v) {
    const def = this.settingsDefs[p.kind];
    const fieldSeg = (i) => {
      const f = def.fields[i];
      if (f.show && !f.show(p.vals)) return [];
      return [S(`${f.label}${f.sep ?? ': '}`), S(p.vals[f.k], { inv: i === p.cur }), S('  ')];
    };
    const rows = def.rows.map(r => r.flatMap(i => (i === 'info' ? [S(def.info(p.vals))] : fieldSeg(i))));
    v.right = { type: 'page', title: def.title, rows };
    v.bottomLeft = [S('ENT=DONE  CLR=UNDO')];
  },
};
