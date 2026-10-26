// Manajemen pengguna oleh admin: buat akun (Firebase Auth) + profil peran/area (Firestore users/{uid}).
import { getCfg, jfetch, enc, decDoc, docsUrl } from './fb.js';
import { getToken } from './auth.js';

export const emailOf = (u) => { const x = String(u || '').trim().toLowerCase(); return x.includes('@') ? x : `${x}@pg.local`; };
export const validUsername = (u) => /^[a-z0-9][a-z0-9._-]{2,29}$/.test(String(u || '').trim().toLowerCase());

export async function listUsers() {
  const headers = { Authorization: `Bearer ${await getToken()}` };
  const out = []; let page = '';
  do {
    const j = await jfetch(`${docsUrl()}/users?pageSize=300${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`, { headers });
    for (const d of (j && j.documents) || []) { const u = decDoc(d); u.uid = decodeURIComponent(d.name.split('/').pop()); out.push(u); }
    page = j && j.nextPageToken;
  } while (page);
  return out.sort((a, b) => String(a.name || a.username || a.uid).localeCompare(String(b.name || b.username || b.uid)));
}

async function putProfile(uid, p) {
  const fields = { name: p.name, username: p.username || '', role: p.role, locs: p.role === 'user' || p.role === 'reader' ? p.locs : [], active: p.active !== false };
  await jfetch(`${docsUrl()}/users/${encodeURIComponent(uid)}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, enc(v)])) }),
  });
}

export async function createUser({ username, name, password, role, locs }) {
  const u = String(username || '').trim().toLowerCase();
  if (!validUsername(u)) throw new Error('Nama pengguna 3–30 karakter: huruf kecil, angka, titik, minus, garis bawah');
  if (!String(name || '').trim()) throw new Error('Nama wajib diisi');
  if (String(password || '').length < 6) throw new Error('Kata sandi minimal 6 karakter');
  if ((role === 'user' || role === 'reader') && !(locs || []).length) throw new Error('Pilih minimal satu estate/PKS untuk penilai/reader');
  const c = getCfg();
  let uid;
  try {
    // signUp tidak mengganti sesi admin: sesi memakai token sendiri, bukan hasil panggilan ini
    const j = await jfetch(`${c.authBase}/v1/accounts:signUp?key=${encodeURIComponent(c.apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailOf(u), password, returnSecureToken: false }),
    });
    uid = j.localId;
  } catch (e) {
    if (/EMAIL_EXISTS/.test(e.code || '')) throw new Error('Nama pengguna sudah ada di Authentication. Jika dibuat lewat Firebase Console, tambahkan profilnya di Firestore (users) dengan UID akun itu');
    if (/WEAK_PASSWORD/.test(e.code || '')) throw new Error('Kata sandi terlalu lemah (minimal 6 karakter)');
    if (/OPERATION_NOT_ALLOWED/.test(e.code || '')) throw new Error('Login Email/Password belum diaktifkan di Firebase');
    throw e;
  }
  await putProfile(uid, { name: name.trim(), username: u, role, locs, active: true });
  return uid;
}

export async function updateUser(uid, p) { await putProfile(uid, p); }
