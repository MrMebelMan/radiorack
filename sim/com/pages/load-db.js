// Database update from the USB drive (manual 3.4.6).
import { S } from '../../core/util.js';

export default {
  handlers: {
    ENT(p) {
      if (p.phase === 'prompt') {
        if (this.s.usb === 'none') return;
        if (this.s.usb === 'corrupt') { this.raise('UNLOCK_FAIL'); this.goBack(p); return; }
        if (this.s.usb === 'nounlock') { this.raise('NO_UNLOCK'); this.goBack(p); return; }
        p.phase = 'version';
      } else if (p.phase === 'version') {
        // the manual shows no update-progress screen: load and return (verify on DATABASE INFO)
        this.s.db = { ...this.usbDb };
        this.save();
        this.goBack(p);
      }
    },
    CLR(p) { this.goBack(p); },
  },

  render(p, v) {
    let rows;
    if (p.phase === 'prompt') rows = [[S('PRESS ENT TO LOAD')], [S('DATABASE FROM USB.')], [S('CLR TO CANCEL.')]];
    else rows = [[S('INSTALLED   ON DRIVE')], [S(`CYCLE: ${this.s.db.cycle} CYCLE: ${this.usbDb.cycle}`)]];
    v.right = { type: 'page', title: p.phase === 'version' ? 'DATABASE VERSIONS:' : 'DATABASE UPDATE', rows };
    v.bottomLeft = [S(p.phase === 'version' ? 'ENT=UPDATE  CLR=CANCEL' : '')];
  },
};
