// Character entry with the knobs (identifiers, waypoint names). '_' is a blank.
import { wrap } from './util.js';

export const CHARSET = '_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const cycleChar = (c, dir) => CHARSET[wrap(CHARSET.indexOf(c) + dir, CHARSET.length)];
export const toChars = (s, n) => (s.replace(/ /g, '_') + '_'.repeat(n)).slice(0, n).split('');
export const fromChars = a => a.join('').replace(/_+$/, '').replace(/_/g, ' ');
