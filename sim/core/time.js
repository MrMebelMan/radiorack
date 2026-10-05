export class Stopwatch {
  constructor() { this.acc = 0; this.t0 = null; }
  get running() { return this.t0 !== null; }
  elapsed(now) { return this.acc + (this.t0 !== null ? now - this.t0 : 0); }
  start(now) { if (this.t0 === null) this.t0 = now; }
  stop(now) { if (this.t0 !== null) { this.acc += now - this.t0; this.t0 = null; } }
  toggle(now) { this.running ? this.stop(now) : this.start(now); }
  reset() { this.acc = 0; this.t0 = null; }
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}
