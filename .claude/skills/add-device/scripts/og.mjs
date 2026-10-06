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
const html = (img, cap, sub) => `<!doctype html><html><head><style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; background: #15181d; overflow: hidden; }
  body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #dfe4ea; }
  img { max-width: 1080px; max-height: 410px; border-radius: 6px; box-shadow: 0 16px 40px rgba(0,0,0,.55); }
  h1 { margin: 0; font-size: 50px; font-weight: 600; letter-spacing: .3px; }
  p { margin: -16px 0 0; font-size: 26px; color: #9aa4b1; }
</style></head><body><img src="${BASE}/previews/${img}.png"><h1>${cap}</h1><p>${sub}</p></body></html>`;

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
