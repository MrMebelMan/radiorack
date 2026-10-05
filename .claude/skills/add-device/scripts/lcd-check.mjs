// Walks a device page through steps and prints the LCD text and any overflow per step.
// S=<scratch> node lcd-check.mjs <device> steps.json
// steps.json: [{ "label": "...", "do": [["wheel","#sel",-100,1], ["click","#sel"], ["hold","#sel",2200], ["key","MDE",80], ["sleep",500], ["eval","js"]] }]
import { readFileSync } from 'node:fs';
import { open, BASE } from './cdp.mjs';

const [device, file] = process.argv.slice(2);
if (!device || !file) { console.log('usage: S=<scratch> node lcd-check.mjs <device> steps.json'); process.exit(1); }
const steps = JSON.parse(readFileSync(file, 'utf8'));
const b = await open();
await b.goto(device);
const LCD = `(() => {
  const lcd = document.getElementById('lcd'); if (!lcd) return 'no #lcd';
  const L = lcd.getBoundingClientRect(), out = [];
  for (const el of lcd.querySelectorAll('div,span,svg')) {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > L.right + 1 || r.bottom > L.bottom + 1 || r.left < L.left - 1 || r.top < L.top - 1))
      out.push((el.className.baseVal ?? el.className) + ' r' + Math.round(r.right - L.left) + '/' + Math.round(L.width) + ' b' + Math.round(r.bottom - L.top) + '/' + Math.round(L.height));
  }
  // drawn glyphs (svg[data-ch]) count as their character
  const c = lcd.cloneNode(true); c.querySelectorAll('svg[data-ch]').forEach(g => g.replaceWith(g.dataset.ch));
  c.style.cssText = 'position:absolute;left:-9999px'; document.body.appendChild(c); const text = c.innerText; c.remove();
  return lcd.className + ' | ' + text.replace(/\\s+/g, ' ').trim() + (out.length ? ' | OVERFLOW ' + out.join('; ') : '');
})()`;
for (const st of steps) {
  for (const [a, ...p] of st.do || []) {
    if (a === 'wheel') await b.wheel(p[0], p[1] ?? -100, p[2] ?? 1);
    else if (a === 'click') await b.click(p[0]);
    else if (a === 'hold') await b.hold(p[0], p[1]);
    else if (a === 'key') await b.hold(`.key[data-key="${p[0]}"]`, p[1] ?? 80);
    else if (a === 'sleep') await b.sleep(p[0]);
    else if (a === 'eval') await b.ev(`(async()=>{${p[0]}})()`, true);
  }
  await b.sleep(150);
  console.log(String(st.label).padEnd(18), '|', await b.ev(LCD));
}
b.errors.forEach(e => console.log(e));
const land = await fetch(`${BASE}/`).then(r => r.status).catch(() => 'down');
console.log('landing', land);
b.close(); process.exit(0);
