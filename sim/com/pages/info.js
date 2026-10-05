// Read-only information pages; content from the device (this.infoPage(kind)).
import { S } from '../../core/util.js';

export default {
  handlers: {
    ENT(p) { this.goBack(p); },
    CLR(p) { this.goBack(p); },
  },
  render(p, v) {
    const [title, ...lines] = this.infoPage(p.kind);
    v.right = { type: 'page', title, rows: lines.map(l => [S(l)]) };
    v.bottomLeft = [S('')];
  },
};
