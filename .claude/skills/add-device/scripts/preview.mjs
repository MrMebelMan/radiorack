// Captures the previews sim/previews/<device>.png (README) and .webp (landing page) with the unit powered on.
// S=<scratch> node preview.mjs <device> [power-on js]
// Default power-on: clear saved state, scroll the first .knob up 10 notches, wait 4 s.
import { fileURLToPath } from 'node:url';
import { open } from './cdp.mjs';
const [device, js] = process.argv.slice(2);
if (!device) { console.log('usage: S=<scratch> node preview.mjs <device> [power-on js]'); process.exit(1); }
const out = ext => fileURLToPath(new URL(`../../../../sim/previews/${device}.${ext}`, import.meta.url));
const b = await open();
await b.goto(device);
await b.ev('localStorage.clear(); location.reload(); 1'); await b.sleep(1500);
if (js) await b.ev(`(async()=>{${js}})()`, true);
else { await b.wheel('.knob', -100, 10); await b.sleep(4000); }
await b.shot(out('png'));
await b.shot(out('webp'));
b.errors.forEach(e => console.log(e));
console.log('wrote', out('png'), out('webp'));
b.close(); process.exit(0);
