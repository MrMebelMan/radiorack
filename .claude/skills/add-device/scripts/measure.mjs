// Prints element boxes as % of the bezel (left right top bottom), to compare with a photo.
// S=<scratch> node measure.mjs <device> '#volKnob' '.key[data-key=MDE]' ...
import { open } from './cdp.mjs';
const [device, ...sels] = process.argv.slice(2);
if (!device || !sels.length) { console.log('usage: S=<scratch> node measure.mjs <device> <selector>...'); process.exit(1); }
const b = await open();
await b.goto(device);
for (const sel of sels) {
  console.log(sel.padEnd(28), await b.ev(`(() => {
    const z = document.getElementById('bezel').getBoundingClientRect(), e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return 'not found';
    const r = e.getBoundingClientRect(), p = (v, w) => (v / w * 100).toFixed(1);
    return [p(r.left - z.left, z.width), p(r.right - z.left, z.width), p(r.top - z.top, z.height), p(r.bottom - z.top, z.height)].join(' ');
  })()`));
}
b.errors.forEach(e => console.log(e));
b.close(); process.exit(0);
