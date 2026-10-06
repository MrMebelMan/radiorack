// The navbar and footer shared by every page, filled into the page's placeholders:
//   <nav class="topbar" data-back></nav>  device pages: back button to the landing page, the page's <h1> (shown on wide
//                                         screens, where the header hides it), then the language picker
//   <nav class="topbar">…</nav>           landing page: its own content (the title), then the language picker
//   <footer class="site-foot"></footer>   contact line
// Imported by ui/i18n.js before it translates the page and binds the picker. Runs on import.
const root = new URL('../', import.meta.url).href;   // site root, wherever the page sits
const CONTACT = 'pulse_dr1v3@proton.me';
const LANGS = [['en', 'us', 'EN', 'English'], ['uk', 'ua', 'UA', 'Українська'], ['cs', 'cz', 'CS', 'Čeština'], ['sk', 'sk', 'SK', 'Slovenčina']];

const back = `<a class="back-btn" href="${root}" title="Back to the list of simulators" data-i18n-title="common.tip.back-to-the-list-of-simulators"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span data-i18n="common.all-simulators">All simulators</span></a>`;
const picker = `<div class="lang">
  <button type="button" class="lang-btn" id="langBtn" aria-haspopup="listbox" aria-expanded="false" aria-controls="langList" aria-label="Language" title="Language" data-i18n-aria="common.tip.language" data-i18n-title="common.tip.language"><img src="${root}flags/us.svg" alt=""><span class="code">EN</span><svg class="caret" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
  <div class="lang-list" id="langList" role="listbox" aria-label="Language" hidden data-i18n-aria="common.tip.language">${LANGS.map(([l, flag, code, name]) =>
    `<div role="option" data-lang="${l}" tabindex="-1"><img src="${root}flags/${flag}.svg" alt=""><span class="code">${code}</span><span class="name" lang="${l}">${name}</span></div>`).join('')}</div>
</div>`;
const footer = `<span data-i18n="common.footer-contact">Bug reports, suggestions, or a unit you'd like added:</span> <a href="mailto:${CONTACT}">${CONTACT}</a>`;

const nav = document.querySelector('nav.topbar');
if (nav) {
  nav.insertAdjacentHTML('beforeend', (nav.hasAttribute('data-back') ? back : '') + picker);
  const h1 = nav.hasAttribute('data-back') && document.querySelector('main header h1');
  if (h1) {   // same text and translation key as the header title
    const title = Object.assign(document.createElement('span'), { className: 'nav-title', textContent: h1.textContent });
    if (h1.dataset.i18n) title.dataset.i18n = h1.dataset.i18n;
    nav.querySelector('.lang').before(title);
  }
}
const foot = document.querySelector('footer.site-foot');
if (foot) foot.innerHTML = footer;
