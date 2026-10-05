// FUNC menu over the device's tree: outer = category, inner = item, ENT opens.
import { S, wrap } from '../../core/util.js';

export default {
  handlers: {
    outer(p, d) { this.menuPos.cat = wrap(this.menuPos.cat + d, this.menu.length); this.menuPos.item = 0; },
    inner(p, d) { const c = this.menu[this.menuPos.cat]; this.menuPos.item = wrap(this.menuPos.item + d, c.items.length); },
    ENT() { this.openItem(this.menu[this.menuPos.cat].items[this.menuPos.item][1]); },
    CLR() { this.goCom(); },
  },

  render(p, v) {
    const c = this.menu[this.menuPos.cat];
    const i = this.menuPos.item;
    const item = (k) => {
      const [label, key] = c.items[k];
      return label + (this.itemBlocked(key) ? ' (OFF)' : '');
    };
    v.right = {
      type: 'page', title: c.title,
      rows: [
        [S(item(i), { inv: true }), S(`  ${i + 1}/${c.items.length}`, { small: true })],
        [S(c.items.length > 1 ? item(wrap(i + 1, c.items.length)) : '', { dim: true })],
      ],
    };
    v.bottomLeft = [S('ENT=SELECT  FUNC=EXIT')];
  },
};
