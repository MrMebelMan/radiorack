// Headless Chromium over CDP for functional checks of the simulators.
// As a module: import { open } from './cdp.mjs'; const b = await open(); … b.close().
// As a CLI:    S=<scratch> node cdp.mjs shot <device> out.png [js]   (screenshot of the bezel)
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const BASE = process.env.SIM_URL || 'http://localhost:8225';
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function open({ width = 1500, height = 1000, port = 9300 + Math.floor(Math.random() * 500) } = {}) {
  const scratch = process.env.S || '/tmp';
  const prof = `${scratch}/cdp-prof-${Date.now()}`;
  mkdirSync(prof, { recursive: true });
  const chrome = spawn('chromium', ['--headless=new', `--remote-debugging-port=${port}`, `--window-size=${width},${height}`,
    '--no-first-run', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
  let ws;
  for (let i = 0; i < 60 && !ws; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find(x => x.type === 'page'); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {}
    if (!ws) await sleep(200);
  }
  if (!ws) throw new Error('chromium did not start');
  await new Promise(r => { ws.onopen = r; });
  let id = 0; const pend = {}; const errors = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.method === 'Runtime.exceptionThrown') errors.push('EXC ' + JSON.stringify(d.params.exceptionDetails).slice(0, 400));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon/.test(d.params.entry.url || '')) errors.push('LOG ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
    if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Log.enable');
  const ev = async (expression, awaitPromise = false) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise })).result.result?.value;
  const center = async sel => JSON.parse(await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) throw new Error('no ${sel}'); const b=e.getBoundingClientRect(); return JSON.stringify({x:b.x+b.width/2,y:b.y+b.height/2});})()`));
  const mouse = (type, c, extra = {}) => send('Input.dispatchMouseEvent', { type, x: c.x, y: c.y, button: 'left', clickCount: 1, ...extra });
  const b = {
    send, ev, center, errors, sleep,
    async goto(device) { await send('Page.navigate', { url: `${BASE}/devices/${device}/` }); await sleep(1500); },
    async wheel(sel, dy = -100, n = 1) { const c = await center(sel); for (let i = 0; i < n; i++) { await mouse('mouseWheel', c, { deltaX: 0, deltaY: dy }); await sleep(40); } },
    async click(sel) { const c = await center(sel); await mouse('mousePressed', c); await mouse('mouseReleased', c); await sleep(120); },
    async hold(sel, ms) { const c = await center(sel); await mouse('mousePressed', c); await sleep(ms); await mouse('mouseReleased', c); await sleep(120); },
    async shot(out, sel = '#bezel') {
      const r = JSON.parse(await ev(`JSON.stringify(document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect())`));
      const format = out.endsWith('.webp') ? 'webp' : 'png';
      const s = await send('Page.captureScreenshot', { format, ...(format === 'webp' && { quality: 85 }), clip: { x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4, scale: 1 } });
      writeFileSync(out, Buffer.from(s.result.data, 'base64'));
    },
    close() { chrome.kill(); },
  };
  return b;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, device, out, js] = process.argv.slice(2);
  if (cmd !== 'shot' || !device || !out) { console.log('usage: S=<scratch> node cdp.mjs shot <device> out.png [js]'); process.exit(1); }
  const b = await open();
  await b.goto(device);
  if (js) await b.ev(`(async()=>{${js}})()`, true);
  await b.sleep(600);
  await b.shot(out);
  b.errors.forEach(e => console.log(e));
  b.close(); process.exit(0);
}
