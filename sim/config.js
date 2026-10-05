// Site configuration. The deploy workflow rewrites this file (see .github/workflows/ci.yml).

// true: manual buttons open the PDFs in manuals/ (served with the site).
// false: they open each manual's public source (data/manuals.js), and manuals/ is not deployed.
export const SELF_HOST_MANUALS = true;
