import { getState } from './store.js';
import { toRemote, fetchRemote, isConfigured } from './sync.js';
import { canSee } from './auth.js';

/** Gabungkan data cloud dengan data lokal (yang terbaru menang). Hanya inspeksi selesai. */
export function mergeRecords(remote, local = getState().inspections) {
  const m = new Map();
  for (const r of remote || []) m.set(r.id, r);
  for (const i of Object.values(local)) {
    if (i.status !== 'final') continue;
    const cur = m.get(i.id);
    if (!cur || String(i.updatedAt) >= String(cur.updatedAt || '')) m.set(i.id, { id: i.id, ...toRemote(i) });
  }
  return [...m.values()].filter((r) => r.total != null && canSee(r.loc));
}

/** records -> { years, locs:[{code,name,pt,ptName}], byLoc: { code: { 'YYYY-MM': rec } } } */
export function index(records) {
  const byLoc = {}, locs = new Map(), years = new Set();
  for (const r of records) {
    (byLoc[r.loc] ||= {})[r.periode] = r;
    years.add(r.periode.slice(0, 4));
    if (!locs.has(r.loc)) locs.set(r.loc, { code: r.loc, name: r.locName || r.loc, pt: r.pt, ptName: r.ptName });
  }
  return { years: [...years].sort(), locs: [...locs.values()], byLoc };
}

export const avg = (a) => { const v = a.filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };

/** Muat data untuk tren: cloud (bila terkonfigurasi & online) digabung dengan data lokal. */
export async function loadRecords() {
  let remote = [], error = null;
  if (isConfigured() && navigator.onLine) {
    try { remote = await fetchRemote(); } catch (e) { error = e.message; }
  }
  return { records: mergeRecords(remote), error, remote: remote.length };
}
