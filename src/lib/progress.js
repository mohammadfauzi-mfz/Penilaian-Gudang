// Progres kirim/ambil data (penilaian & foto) untuk garis tipis di header.
import { useSyncExternalStore } from 'react';

let depth = 0, hideT = 0;
let S = { show: false, kind: 'up', label: '', done: 0, total: 0, err: false };
const subs = new Set();
const set = (p) => { S = { ...S, ...p }; subs.forEach((f) => f()); };

/** Mulai satu pekerjaan (boleh bertingkat). Selalu pasangkan dengan end(). */
export function begin(kind, label) {
  clearTimeout(hideT);
  if (!depth) S = { ...S, done: 0, total: 0, err: false };
  depth++; set({ show: true, kind, label });
}
/** Tambah jumlah langkah yang akan dikerjakan. */
export const add = (n, kind, label) => set({ total: S.total + n, ...(kind ? { kind } : {}), ...(label ? { label } : {}) });
export const tick = (label, kind) => set({ done: Math.min(S.done + 1, Math.max(S.total, S.done + 1)), ...(label ? { label } : {}), ...(kind ? { kind } : {}) });
export function end(err) {
  depth = Math.max(0, depth - 1);
  if (err) set({ err: true });
  if (depth) return;
  set({ done: S.total }); // penuhkan garis, lalu sembunyi
  hideT = setTimeout(() => set({ show: false, done: 0, total: 0, err: false }), S.err ? 1800 : 700);
}

export function useProgress() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => S);
}
