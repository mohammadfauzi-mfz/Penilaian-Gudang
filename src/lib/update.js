// Pembaruan dari GitHub Releases: bandingkan nomor build aplikasi dengan rilis terbaru repo.
// Android tidak mengizinkan pemasangan senyap, jadi tombol "Perbarui" mengunduh APK lalu pengguna menekan Pasang.
import { useSyncExternalStore } from 'react';
import { isNative } from './native.js';

/* global __BUILD__, __REPO__ */
export const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 0;
const REPO = typeof __REPO__ !== 'undefined' ? __REPO__ : '';
const K = 'pg.update';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } };

let snap = (() => { try { return JSON.parse(lsGet(K)) || { at: 0, info: null }; } catch { return { at: 0, info: null }; } })();
if (snap.info && snap.info.build <= BUILD) snap = { ...snap, info: null }; // sudah terpasang
const subs = new Set();
const set = (p) => { snap = { ...snap, ...p }; lsSet(K, JSON.stringify(snap)); subs.forEach((f) => f()); };
export const useUpdate = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => snap);

export const updateSupported = () => !!REPO && BUILD > 0 && (isNative() || !!lsGet('pg.forceUpdateCheck'));

/** Periksa rilis terbaru. force=true mengabaikan jeda 6 jam. Mengembalikan {info} atau {error}. */
export async function checkUpdate(force = false) {
  if (!updateSupported()) return { unsupported: true };
  if (!force && Date.now() - snap.at < 6 * 3600 * 1000) return { info: snap.info };
  try {
    const api = lsGet('pg.ghApi') || 'https://api.github.com';
    const r = await fetch(`${api}/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (r.status === 404) throw new Error('Rilis tidak ditemukan (repo harus publik dan sudah punya Release)');
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const j = await r.json();
    const build = Number(String(j.tag_name || '').replace(/\D/g, ''));
    const apk = (j.assets || []).find((a) => /\.apk$/i.test(a.name));
    const info = build > BUILD && apk ? { build, url: apk.browser_download_url, notes: String(j.body || '').slice(0, 300), name: j.name || `Build ${build}` } : null;
    set({ at: Date.now(), info });
    return { info };
  } catch (e) { return { error: e.message }; }
}
