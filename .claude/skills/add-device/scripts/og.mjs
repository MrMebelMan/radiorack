// Renders the link-preview images sim/og/<page>.jpg (1200 x 630): a unit's powered-on preview on the site background,
// with its name and "RadioRack" below. Needs the local server (SIM_URL, default http://localhost:8225) for the previews.
// S=<scratch> node og.mjs [page ...]   (default: every page in PAGES)
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { open, BASE } from './cdp.mjs';

// page -> [preview, caption, sub-caption]
export const PAGES = {
  landing: ['gtx328', 'RadioRack', 'Avionics simulators'],
  gtr225: ['gtr225', 'Garmin GTR 225A', 'RadioRack'],
  gnc255: ['gnc255', 'Garmin GNC 255A', 'RadioRack'],
  tt31: ['tt31', 'Trig TT31', 'RadioRack'],
  gtx328: ['gtx328', 'Garmin GTX 328', 'RadioRack'],
  kn64: ['kn64', 'Bendix/King KN 64', 'RadioRack'],
  kma20: ['kma20', 'King KMA 20 TSO', 'RadioRack'],
  ar6201: ['ar6201', 'Becker AR6201', 'RadioRack'],
};

const W = 1200, H = 630;
// a light slate background so the black bezels stand out; the previews carry a 2 px strip of the page background, cropped here
const html = (img, cap, sub) => `<!doctype html><html><head><style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; }
  body { display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: radial-gradient(ellipse at 50% 35%, #7d8a99, #5b6676 70%, #4c5664);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #10151c; }
  .unit { overflow: hidden; border-radius: 6px; box-shadow: 0 18px 44px rgba(0,0,0,.5); line-height: 0; }
  .unit img { margin: -2px; max-width: 1040px; max-height: 330px; }
  h1 { margin: 48px 0 0; font-size: 72px; font-weight: 700; line-height: 1; }
  p { margin: 18px 0 0; font-size: 50px; font-weight: 500; line-height: 1; color: #1f2833; }
</style></head><body><div class="unit"><img src="${BASE}/previews/${img}.png"></div><h1>${cap}</h1><p>${sub}</p></body></html>`;

const pages = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PAGES);
const b = await open({ width: W, height: H });
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await b.send('Page.enable');
for (const page of pages) {
  const [img, cap, sub] = PAGES[page];
  await b.send('Page.navigate', { url: `${BASE}/` }); await b.sleep(300);   // same origin as the previews
  await b.ev(`document.open(); document.write(${JSON.stringify(html(img, cap, sub))}); document.close(); 1`);
  await b.ev(`Promise.all([...document.images].map(i => i.decode())).then(() => document.fonts.ready).then(() => 1)`, true);
  const s = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
  const out = fileURLToPath(new URL(`../../../../sim/og/${page}.jpg`, import.meta.url));
  writeFileSync(out, Buffer.from(s.result.data, 'base64'));
  console.log('wrote', out);
}
b.errors.forEach(e => console.log(e));
b.close(); process.exit(0);
