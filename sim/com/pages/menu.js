// FUNC menu (photos of the unit + manual 3.1): one line per category. First the outer knob
// picks the category (its short name inverted, title shown); turning the inner knob then
// replaces the title with the item, inverted ("Turn the inner knob to RECENT FREQS").
// Four lines fit; the list scrolls only when the active line would leave the window.
import { S, wrap } from '../../core/util.js';

const MENU_LINES = 4;
const NONE = -1;   // category chosen, no item yet

export default {
  handlers: {
    outer(p, d) { this.menuPos.cat = wrap(this.menuPos.cat + d, this.menu.length); this.menuPos.item = NONE; },
    inner(p, d) {
      const n = this.menu[this.menuPos.cat].items.length;
      const i = this.menuPos.item;
      // from "no item" the first click lands on the first (or, turning back, the last) item
      this.menuPos.item = i === NONE ? wrap(d > 0 ? d - 1 : n + d, n) : wrap(i + d, n);
    },
    ENT() {
      if (this.menuPos.item === NONE) return;   // nothing selected yet
      this.openItem(this.menu[this.menuPos.cat].items[this.menuPos.item][1]);
    },
    CLR() { this.goMain(); },
  },

  render(p, v) {
    const n = this.menu.length, cat = this.menuPos.cat, i = this.menuPos.item;
    const first = Math.max(0, Math.min(cat - (MENU_LINES - 1), n - MENU_LINES));
    const lines = this.menu.slice(first, first + MENU_LINES).map((m, k) => {
      const [short, ...rest] = m.title.split(' ');
      if (first + k !== cat) return [S(short), S(' '), S(rest.join(' '))];
      return i === NONE
        ? [S(short, { inv: true }), S(' '), S(rest.join(' '))]
        : [S(short, { inv: true }), S(' '), S(m.items[i][0], { inv: true })];
    });
    v.right = { type: 'menu', lines };
    v.bottomLeft = [];
  },
};
