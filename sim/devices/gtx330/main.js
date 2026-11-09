// GTX 330 page entry: the GTX 328 page wiring plus the GPS position, TIS and ADS-B failure inputs
import { startGtx } from '../gtx328/app.js';
import { GTX330 } from './device.js';

// TIS clips are this unit's own; Leaving Altitude / Timer Expired are the GTX 328 recordings
const own = new URL('../../sounds/gtx330/', import.meta.url), shared = new URL('../../sounds/gtx328/', import.meta.url);
const clipUrl = (voice, id) => new URL(`${voice.toLowerCase()}-${id}.mp3`, id.startsWith('traffic') ? own : shared).href;

startGtx({
  Device: GTX330, page: 'gtx330', clipUrl,
  extra: {
    wire(xpdr, { $, render, sync }) {
      const sw = (id, fn) => { $(id).onchange = e => { fn(e.target.checked); xpdr.save(); sync(); render(); }; };
      sw('gpsSw', v => { xpdr.s.sim.gpsPos = v; });
      sw('tisSw', v => { xpdr.s.sim.tis = v; });
      sw('adsbFail', v => { xpdr.s.sim.adsbFault = v; });
      $('tisAlert').onclick = () => { xpdr.input('traffic'); render(); };
    },
    sync(s) {
      const $ = id => document.getElementById(id);
      $('gpsSw').checked = s.gpsPos; $('tisSw').checked = s.tis; $('adsbFail').checked = s.adsbFault;
    },
  },
});
