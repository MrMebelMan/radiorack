// Database update from the USB drive (manual 3.4.6).
import { S } from '../../core/util.js';

export const LOAD_MS = 6000;

export default {
  handlers: {
    ENT(p) {
      if (p.phase === 'prompt') {
        if (this.s.usb === 'none') { this.toast('NO USB DRIVE DETECTED'); return; }
        if (this.s.usb === 'corrupt') { this.raise('UNLOCK_FAIL'); this.goBack(p); return; }
        if (this.s.usb === 'nounlock') { this.raise('NO_UNLOCK'); this.goBack(p); return; }
        p.phase = 'version';
      } else if (p.phase === 'version') {
        p.phase = 'progress'; p.t0 = this.now();
      } else if (p.phase === 'done') {
        this.goBack(p);
      }
    },
    CLR(p) { if (p.phase !== 'progress') this.goBack(p); },
  },

  // called from tick(): finish the update after LOAD_MS
  tick(p) {
    if (p.phase === 'progress' && this.now() - p.t0 > LOAD_MS) {
      p.phase = 'done';
      this.s.db = { ...this.usbDb };
      this.save();
    }
  },

  render(p, v) {
    let rows;
    if (p.phase === 'prompt') rows = [[S('PRESS ENT TO LOAD')], [S('DATABASE FROM USB.')], [S('CLR TO CANCEL.')]];
    else if (p.phase === 'version') rows = [[S('INSTALLED   ON DRIVE')], [S(`CYCLE: ${this.s.db.cycle} CYCLE: ${this.usbDb.cycle}`)]];
    else if (p.phase === 'progress') {
      const pct = Math.min(100, Math.floor((this.now() - p.t0) / (LOAD_MS / 100)));
      rows = [[S('UPDATING DATABASE...')], [S('', { bar: pct }), S(` ${pct}%`)], [S('DO NOT REMOVE USB')]];
    } else rows = [[S('UPDATE COMPLETE')], [S(`CYCLE: ${this.s.db.cycle}`)], [S('ENT TO CONTINUE')]];
    v.right = { type: 'page', title: p.phase === 'version' ? 'DATABASE VERSIONS:' : 'DATABASE UPDATE', rows };
    v.bottomLeft = [S(p.phase === 'version' ? 'ENT=UPDATE  CLR=CANCEL' : '')];
  },
};
