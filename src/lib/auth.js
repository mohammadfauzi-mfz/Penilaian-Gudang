// Login (Firebase Authentication email+sandi), profil peran/area, dan hak akses.
// Peran: admin (semua + kelola PT/Estate), supervisi (lihat semua), user (input & lihat estate/PKS miliknya).
import { useSyncExternalStore } from 'react';
import { useStore, clearInspections } from './store.js';
import { getCfg, isConfigured, jfetch, decDoc, docsUrl } from './fb.js';

const SK = 'pg.session', PK = 'pg.profile';
const rd = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const wr = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };

let snap = { session: rd(SK), profile: rd(PK) };
let tok = { id: null, exp: 0 };
const subs = new Set();
const set = (p) => { snap = { ...snap, ...p }; if ('session' in p) wr(SK, snap.session); if ('profile' in p) wr(PK, snap.profile); subs.forEach((f) => f()); };
const sub = (f) => { subs.add(f); return () => subs.delete(f); };

export const ROLE_LABEL = { admin: 'Admin', supervisi: 'Supervisi', user: 'Penilai', reader: 'Reader', none: 'Tanpa akses' };
const LOCAL = { role: 'admin', name: 'Mode lokal', locs: [], local: true };

/** Profil efektif. Bila database belum diatur, aplikasi berjalan lokal sebagai admin. */
export function currentProfile() {
  if (!isConfigured()) return LOCAL;
  return snap.session ? snap.profile : null;
}
export function authMode() { // 'local' | 'login' | 'denied' | 'in'
  if (!isConfigured()) return 'local';
  if (!snap.session) return 'login';
  if (!snap.profile || snap.profile.role === 'none') return snap.profile ? 'denied' : 'in';
  return 'in';
}
export function useAuth() {
  useStore(); // settings.firebase berubah -> hitung ulang
  const s = useSyncExternalStore(sub, () => snap);
  return { mode: authMode(), profile: currentProfile(), session: s.session };
}

export const isAdmin = () => { const p = currentProfile(); return !!p && p.role === 'admin'; };
export const isViewAll = () => { const p = currentProfile(); return !!p && (p.role === 'admin' || p.role === 'supervisi'); };
export function canSee(loc) { const p = currentProfile(); return !!p && (p.role === 'admin' || p.role === 'supervisi' || ((p.role === 'user' || p.role === 'reader') && (p.locs || []).includes(loc))); }
export function canInput(loc) { const p = currentProfile(); return !!p && (p.role === 'admin' || p.role === 'supervisi' || (p.role === 'user' && (p.locs || []).includes(loc))); }
/** Hapus penilaian: admin, atau penilai untuk estate miliknya (supervisi tidak). */
export function canDelete(loc) { const p = currentProfile(); return !!p && (p.role === 'admin' || (p.role === 'user' && (p.locs || []).includes(loc))); }
export const myLocs = () => { const p = currentProfile(); return p && (p.role === 'user' || p.role === 'reader') ? p.locs || [] : null; };

function errText(e) {
  const c = e.code || e.message || '';
  if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND|INVALID_EMAIL/.test(c)) return 'Nama pengguna atau kata sandi salah';
  if (/USER_DISABLED/.test(c)) return 'Akun dinonaktifkan. Hubungi admin';
  if (/TOO_MANY_ATTEMPTS/.test(c)) return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi';
  if (e instanceof TypeError || /Failed to fetch|NetworkError/i.test(e.message)) return 'Tidak ada koneksi internet';
  return e.message;
}

export async function getToken() {
  if (tok.id && Date.now() < tok.exp - 60000) return tok.id;
  const c = getCfg(), s = snap.session;
  if (!s || s.apiKey !== c.apiKey) throw Object.assign(new Error('Belum login'), { status: 401 });
  try {
    const j = await jfetch(`${c.tokenBase}/v1/token?key=${encodeURIComponent(c.apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}`,
    });
    tok = { id: j.id_token, exp: Date.now() + Number(j.expires_in) * 1000 };
    if (j.refresh_token && j.refresh_token !== s.refreshToken) set({ session: { ...s, refreshToken: j.refresh_token } });
    return tok.id;
  } catch (e) {
    if (e.status && e.status >= 400 && e.status < 500 && e.status !== 429) { tok = { id: null, exp: 0 }; set({ session: null, profile: null }); }
    throw e;
  }
}

async function loadProfile(uid, token) {
  try {
    const d = await jfetch(`${docsUrl()}/users/${encodeURIComponent(uid)}`, { headers: { Authorization: `Bearer ${token}` } });
    const p = decDoc(d);
    const role = p.active !== false && ['admin', 'supervisi', 'user', 'reader'].includes(p.role) ? p.role : 'none';
    return { name: p.name || '', role, locs: Array.isArray(p.locs) ? p.locs : [] };
  } catch (e) {
    if (e.status === 404 || e.status === 403) return { name: '', role: 'none', locs: [] };
    throw e;
  }
}

export async function login(username, password) {
  const c = getCfg();
  const u = String(username || '').trim().toLowerCase();
  if (!u || !password) throw new Error('Isi nama pengguna dan kata sandi');
  const email = u.includes('@') ? u : `${u}@pg.local`;
  try {
    const j = await jfetch(`${c.authBase}/v1/accounts:signInWithPassword?key=${encodeURIComponent(c.apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    tok = { id: j.idToken, exp: Date.now() + Number(j.expiresIn || 3600) * 1000 };
    const profile = await loadProfile(j.localId, j.idToken);
    // akun berbeda di HP yang sama: bersihkan data lokal akun sebelumnya
    let last = null; try { last = localStorage.getItem('pg.lastUid'); } catch { /* */ }
    if (last && last !== j.localId) clearInspections();
    try { localStorage.setItem('pg.lastUid', j.localId); } catch { /* */ }
    set({ session: { uid: j.localId, email, apiKey: c.apiKey, refreshToken: j.refreshToken }, profile });
    return profile;
  } catch (e) { throw new Error(errText(e)); }
}

/** Muat ulang profil dari server (peran/area bisa berubah). Gagal jaringan: pakai cache. */
export async function refreshProfile() {
  const s = snap.session; if (!s || !navigator.onLine) return;
  try { const t = await getToken(); const profile = await loadProfile(s.uid, t); set({ profile }); }
  catch { /* offline / sementara gagal: tetap pakai profil tersimpan */ }
}

export async function changeOwnPassword(newPw) {
  if (String(newPw).length < 6) throw new Error('Kata sandi minimal 6 karakter');
  const c = getCfg();
  try {
    await jfetch(`${c.authBase}/v1/accounts:update?key=${encodeURIComponent(c.apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: await getToken(), password: newPw, returnSecureToken: false }),
    });
  } catch (e) {
    if (/CREDENTIAL_TOO_OLD|TOKEN_EXPIRED/.test(e.code || '')) throw new Error('Keluar lalu masuk ulang, kemudian coba lagi');
    throw new Error(errText(e));
  }
}

export function logout() {
  tok = { id: null, exp: 0 };
  clearInspections();
  try { localStorage.removeItem('pg.lastUid'); } catch { /* */ }
  set({ session: null, profile: null });
}
