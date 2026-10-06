// Points every <a data-manual="<id>"> at the manual's PDF in manuals/ or at its public source,
// per SELF_HOST_MANUALS, and places the manual row for the layout. Runs on import.
import { SELF_HOST_MANUALS } from '../config.js';
import { MANUALS, manualFile } from '../data/manuals.js';
import { onLang, translated } from './i18n.js';

export function manualHref(id) {
  return SELF_HOST_MANUALS ? new URL(`../manuals/${manualFile(id)}`, import.meta.url).href : MANUALS[id].source;
}

const links = [...document.querySelectorAll('a[data-manual]')];
for (const a of links) a.href = manualHref(a.dataset.manual);
// The note follows the title (ui/i18n.js resets the title on every language change, so it's added again each time).
onLang(() => {
  if (SELF_HOST_MANUALS) return;
  for (const a of links) {
    const id = a.dataset.manual, note = MANUALS[id].note && (translated(`manual.note.${id}`) ?? MANUALS[id].note);
    if (note) a.title = a.title ? `${a.title}. ${note}` : note;
  }
});

// One column (phones): the manual row sits right above the procedures instead of between the header and the unit.
const nav = document.querySelector('nav.manuals'), header = nav?.closest('header'), help = document.querySelector('.help-col');
if (nav && header && help) {
  const oneCol = matchMedia('(max-width: 1000px)');   // = the single-column breakpoint of main in shared/style.css
  const place = () => (oneCol.matches ? help.prepend(nav) : header.append(nav));
  oneCol.addEventListener('change', place);
  place();
}
