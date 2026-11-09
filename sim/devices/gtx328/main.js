// GTX 328 page entry
import { startGtx } from './app.js';
import { GTX328 } from './device.js';

const base = new URL('../../sounds/gtx328/', import.meta.url);
startGtx({ Device: GTX328, page: 'gtx328', clipUrl: (voice, id) => new URL(`${voice.toLowerCase()}-${id}.mp3`, base).href });
