// Small generic helpers.
export const range = (a, b, step = 1) => { const r = []; for (let v = a; v <= b; v += step) r.push(v); return r; };
export const wrap = (i, n) => ((i % n) + n) % n;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Display segment for the view model: { t: text, inv, ul, big, small, dim, box, bar }.
export const S = (t, o = {}) => ({ t: String(t), ...o });
