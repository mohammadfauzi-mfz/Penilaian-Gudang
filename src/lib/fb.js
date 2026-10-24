// Dasar akses Firebase (REST): konfigurasi, fetch JSON, encode/decode nilai Firestore.
import { FIREBASE_CONFIG } from '../config.js';
import { getState } from './store.js';

export function getCfg() {
  const o = getState().settings.firebase;
  const c = o && o.apiKey && o.projectId ? o : FIREBASE_CONFIG;
  return {
    apiKey: c.apiKey || '', projectId: c.projectId || '',
    authBase: c.authBase || 'https://identitytoolkit.googleapis.com',
    tokenBase: c.tokenBase || 'https://securetoken.googleapis.com',
    fsBase: c.fsBase || 'https://firestore.googleapis.com',
  };
}
export const isConfigured = () => { const c = getCfg(); return !!(c.apiKey && c.projectId); };

export async function jfetch(url, opt) {
  const r = await fetch(url, opt);
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch { /* bukan JSON */ }
  if (!r.ok) {
    const err = Array.isArray(j) ? j[0] && j[0].error : j && j.error;
    const msg = (err && (err.message || err)) || t || r.statusText;
    const e = new Error(`${r.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    e.status = r.status; e.code = typeof (err && err.message) === 'string' ? err.message : ''; throw e;
  }
  return j;
}

export function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
}
export function dec(f) {
  if ('stringValue' in f) return f.stringValue;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('doubleValue' in f) return f.doubleValue;
  if ('booleanValue' in f) return f.booleanValue;
  if ('nullValue' in f) return null;
  if ('timestampValue' in f) return f.timestampValue;
  if ('arrayValue' in f) return (f.arrayValue.values || []).map(dec);
  if ('mapValue' in f) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, x]) => [k, dec(x)]));
  return null;
}
export const docsUrl = (c = getCfg()) => `${c.fsBase}/v1/projects/${encodeURIComponent(c.projectId)}/databases/(default)/documents`;
export const decDoc = (d) => dec({ mapValue: { fields: d.fields || {} } });
