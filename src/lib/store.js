import { useSyncExternalStore } from 'react';
import { SEED_LOCATIONS, SEED_PTS } from '../data/seed.js';
import HISTORY from '../data/history.json';
import { computeScore } from './score.js';

const K = { settings: 'pg.settings', locs: 'pg.locations', pts: 'pg.pts', insp: 'pg.inspections' };
const rd = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('simpan gagal', e); } };

let state = {
  settings: { inspector: '', firebase: null, lastSyncAt: null, ...rd(K.settings, {}) },
  locations: rd(K.locs, SEED_LOCATIONS),
  pts: rd(K.pts, SEED_PTS),
  inspections: rd(K.insp, {}),
};
const subs = new Set();
const emit = () => subs.forEach((f) => f());
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const getState = () => state;
export const useStore = () => useSyncExternalStore(subscribe, getState);

function commit(patch) {
  state = { ...state, ...patch };
  if (patch.settings) wr(K.settings, state.settings);
  if (patch.locations) wr(K.locs, state.locations);
  if (patch.pts) wr(K.pts, state.pts);
  if (patch.inspections) wr(K.insp, state.inspections);
  emit();
}

export const inspId = (loc, periode) => `${loc}_${periode}`;
export const setSettings = (p) => commit({ settings: { ...state.settings, ...p } });
export const setLocations = (l) => commit({ locations: l });
export const setPts = (l) => commit({ pts: l });
export const getLoc = (code) => state.locations.find((l) => l.code === code);
export const getPt = (code) => state.pts.find((p) => p.code === code);

export function saveInspection(insp) {
  const rec = { ...insp, updatedAt: new Date().toISOString() };
  commit({ inspections: { ...state.inspections, [rec.id]: rec } });
  return rec;
}
/** Terapkan master PT/Estate dari database tanpa menandai perubahan lokal. */
export function applyMaster(pts, locations) { commit({ pts, locations }); }
export function clearInspections() { commit({ inspections: {} }); }
/** Simpan data hasil tarik dari database (tanpa mengubah updatedAt). */
export function putRemoteInspections(list) {
  const next = { ...state.inspections };
  for (const r of list) next[r.id] = r;
  commit({ inspections: next });
}
export function markSynced(id, updatedAt) {
  const cur = state.inspections[id];
  if (!cur) return;
  commit({ inspections: { ...state.inspections, [id]: { ...cur, syncedAt: updatedAt } } });
}
export function removeInspection(id) {
  const { [id]: _drop, ...rest } = state.inspections;
  commit({ inspections: rest });
}

/** Impor data historis Jan–Agu 2026 dari Excel. Tidak menimpa data yang sudah ada. */
export function importHistory() {
  const next = { ...state.inspections };
  let added = 0;
  const now = new Date().toISOString();
  for (const h of HISTORY) {
    const id = inspId(h.loc, h.periode);
    if (next[id] || !getLoc(h.loc)) continue;
    next[id] = {
      id, loc: h.loc, periode: h.periode, date: `${h.periode}-01`, inspector: 'Impor Excel 2026',
      answers: h.answers, notes: {}, status: 'final', updatedAt: now, imported: true,
    };
    added++;
  }
  commit({ inspections: next });
  return added;
}

/** Ringkasan sebuah inspeksi (dipakai untuk sinkron & dashboard). */
export function summarize(insp) {
  const loc = getLoc(insp.loc);
  const sc = computeScore(insp.answers, loc);
  const aspects = {};
  for (const [k, v] of Object.entries(sc.aspects)) if (v.avg != null) aspects[k] = v.avg;
  return { total: sc.total, count: sc.count, n: sc.n, aspects };
}
