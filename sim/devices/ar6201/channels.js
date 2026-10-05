// Preloaded user channels (user decision): AIP-verified frequencies from data/lk.js around
// Letnany, each with a label of at most 10 characters (Operating Instructions 4.8).
import { AIRPORTS, STATIONS } from '../../data/lk.js';

const PICK = [
  ['LKLT', 'ATF', 'LKLT RADIO'],
  ['LKKB', 'TWR', 'LKKB TWR'],
  ['LKPR', 'ATIS', 'LKPR ATIS'],
  ['LKPR', 'TWR', 'LKPR TWR'],
  ['LKVO', 'TWR', 'LKVO TWR'],
  ['LKMB', 'ATF', 'LKMB RADIO'],
  ['LKRO', 'ATF', 'LKRO RADIO'],
  ['LKBE', 'ATF', 'LKBE RADIO'],
];

export function presetChannels() {
  const ch = Array(99).fill(null), labels = {};
  let n = 0;
  for (const [id, type, label] of PICK) {
    const a = AIRPORTS.find(x => x.id === id);
    const f = a && a.freqs.find(x => x.type === type);
    if (!f) continue;
    ch[n++] = f.f;
    labels[f.f] = label;
  }
  const fis = (STATIONS || []).find(x => x.name === 'PRAHA INFO W');
  if (fis) { ch[n++] = fis.f; labels[fis.f] = 'PRAHA INFO'; }
  return { ch, labels };
}
