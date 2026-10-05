// Points every <a data-manual="<id>"> at the manual's PDF in manuals/ or at its public source,
// per SELF_HOST_MANUALS. Runs on import.
import { SELF_HOST_MANUALS } from '../config.js';
import { MANUALS, manualFile } from '../data/manuals.js';

export function manualHref(id) {
  return SELF_HOST_MANUALS ? new URL(`../manuals/${manualFile(id)}`, import.meta.url).href : MANUALS[id].source;
}

for (const a of document.querySelectorAll('a[data-manual]')) {
  const { note } = MANUALS[a.dataset.manual];
  a.href = manualHref(a.dataset.manual);
  // The note goes before the " — opens in a new window" tail of the device-page titles.
  if (note && !SELF_HOST_MANUALS) a.title = a.title ? a.title.replace(/( — |$)/, `. ${note}$1`) : note;
}
