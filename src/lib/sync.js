// Sinkron ke Firebase Firestore lewat REST API. Akses dibatasi aturan server per peran/area.
import { getState, getLoc, getPt, markSynced, setSettings, summarize, applyMaster, putRemoteInspections, patchInspection } from './store.js';
import { getCfg, isConfigured, jfetch, enc, decDoc, docsUrl } from './fb.js';
import { driveOn, uploadPhoto, ensurePhotos } from './drive.js';
import { getPhotosOf } from './photos.js';
import { begin, add, tick, end } from './progress.js';
import { getToken, currentProfile, canInput, canSee, isAdmin, myLocs, refreshProfile } from './auth.js';

export { getCfg, isConfigured, enc, getToken };
export { dec } from './fb.js';

export function toRemote(insp) {
  const loc = getLoc(insp.loc), pt = getPt(loc && loc.pt);
  const s = summarize(insp);
  return {
    loc: insp.loc, locName: loc ? loc.name : insp.loc, pt: loc ? loc.pt : '', ptName: pt ? pt.name : '',
    periode: insp.periode, date: insp.date || '', inspector: insp.inspector || '',
    total: s.total, count: s.count, n: s.n, aspects: s.aspects,
    answers: insp.answers || {}, notes: insp.notes || {}, photos: insp.driveIds || {}, updatedAt: insp.updatedAt,
  };
}

const auth = async () => ({ Authorization: `Bearer ${await getToken()}` });

export async function upload(insp) {
  const body = { fields: Object.fromEntries(Object.entries(toRemote(insp)).map(([k, v]) => [k, enc(v)])) };
  await jfetch(`${docsUrl()}/inspections/${encodeURIComponent(insp.id)}`, {
    method: 'PATCH', headers: { ...(await auth()), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
export async function removeRemote(id) {
  if (!isConfigured()) return;
  await jfetch(`${docsUrl()}/inspections/${encodeURIComponent(id)}`, { method: 'DELETE', headers: await auth() });
}

const recOf = (d) => { const r = decDoc(d); r.id = decodeURIComponent(d.name.split('/').pop()); return r; };

/** Ambil penilaian dari database sesuai hak akses: admin/supervisi semua; penilai per estate miliknya. */
export async function fetchRemote() {
  const headers = await auth();
  const locs = myLocs();
  if (locs) { // aturan server hanya meloloskan query dengan filter loc == X
    const out = [];
    await Promise.all(locs.map(async (code) => {
      const j = await jfetch(`${docsUrl()}:runQuery`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'inspections' }], where: { fieldFilter: { field: { fieldPath: 'loc' }, op: 'EQUAL', value: { stringValue: code } } } } }),
      });
      for (const x of j || []) if (x.document) out.push(recOf(x.document));
    }));
    return out;
  }
  const out = []; let page = '';
  do {
    const j = await jfetch(`${docsUrl()}/inspections?pageSize=300${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`, { headers });
    for (const d of (j && j.documents) || []) out.push(recOf(d));
    page = j && j.nextPageToken;
  } while (page);
  return out;
}

/** Tarik penilaian dari database ke HP (agar Beranda/Riwayat terisi di HP baru). Foto tidak ikut. */
export async function pullRemote() {
  const remote = await fetchRemote();
  const cur = getState().inspections, put = [];
  for (const r of remote) {
    if (!canSee(r.loc) || !getLoc(r.loc)) continue;
    const l = cur[r.id];
    if (l && l.syncedAt === l.updatedAt && String(l.updatedAt) >= String(r.updatedAt)) { // sama dengan database: ambil daftar foto baru (mis. diunggah dari HP lain)
      const rp = r.photos || {}, lp = l.driveIds || {};
      if (Object.keys(rp).some((k) => lp[k] !== rp[k])) patchInspection(l.id, { driveIds: { ...lp, ...rp }, photoIds: [...new Set([...(l.photoIds || []), ...Object.keys(rp)])] });
      continue;
    }
    if (l && (l.syncedAt !== l.updatedAt || String(l.updatedAt) >= String(r.updatedAt))) continue; // draf/perubahan lokal menang
    put.push({ id: r.id, loc: r.loc, periode: r.periode, date: r.date, inspector: r.inspector, answers: r.answers || {}, notes: r.notes || {}, driveIds: r.photos || {}, photoIds: Object.keys(r.photos || {}), status: 'final', updatedAt: r.updatedAt, syncedAt: r.updatedAt });
  }
  if (put.length) putRemoteInspections(put);
  return put.length;
}

// ---- Master PT & Estate/PKS (dokumen master/config) ----
export async function pushMaster() {
  const { pts, locations } = getState();
  const body = { fields: { pts: enc(pts), locs: enc(locations), driveUrl: enc(getState().settings.driveUrl || ''), updatedAt: enc(new Date().toISOString()) } };
  await jfetch(`${docsUrl()}/master/config`, { method: 'PATCH', headers: { ...(await auth()), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  setSettings({ masterDirty: false });
}
export async function pullMaster() {
  try {
    const d = await jfetch(`${docsUrl()}/master/config`, { headers: await auth() });
    if (getState().settings.masterDirty) return;
    const m = decDoc(d);
    if (Array.isArray(m.pts) && Array.isArray(m.locs) && m.pts.length) applyMaster(m.pts, m.locs);
    if ((m.driveUrl || '') !== (getState().settings.driveUrl || '')) setSettings({ driveUrl: m.driveUrl || '' });
  } catch (e) {
    if (e.status === 404 && isAdmin()) await pushMaster(); // pertama kali: admin menaruh daftar bawaan
    else throw e;
  }
}
/** Dipanggil Pengaturan setelah admin mengubah PT/Estate: tandai, lalu coba kirim. */
export async function saveMaster(pts, locations) {
  applyMaster(pts, locations);
  if (!isConfigured()) return { sent: false, local: true };
  setSettings({ masterDirty: true });
  try { await pushMaster(); return { sent: true }; } catch (e) { return { sent: false, error: e.message }; }
}

const unsentCount = (i) => (driveOn() ? (i.photoIds || []).filter((k) => !(i.driveIds || {})[k]).length : 0);
const unsentPhotos = (i) => driveOn() && (i.photoIds || []).some((k) => !(i.driveIds || {})[k]);
const pendingList = () => Object.values(getState().inspections).filter((i) => i.status === 'final' && canInput(i.loc) && (i.syncedAt !== i.updatedAt || unsentPhotos(i)));

/** Unggah foto yang belum ada di Drive; id file dicatat di inspeksi. Mengembalikan jumlah foto terkirim. */
async function sendPhotos(i) {
  if (!driveOn()) return 0;
  const loc = getLoc(i.loc), pt = getPt(loc && loc.pt);
  const local = await getPhotosOf(i.id).catch(() => ({}));
  const ids = { ...(i.driveIds || {}) }; let n = 0;
  for (const k of i.photoIds || []) {
    if (ids[k]) continue;
    if (!local[k]) { tick(); continue; }
    ids[k] = await uploadPhoto(i, loc, pt ? pt.name : '', k, local[k].blob); n++; tick();
    patchInspection(i.id, { driveIds: { ...ids } }); // simpan per foto agar tidak diulang bila terputus
  }
  return n;
}
export const pendingCount = () => pendingList().length;

/** Kirim semua penilaian selesai yang belum terkirim (hanya estate yang boleh diinput). */
export async function syncPending() {
  if (!isConfigured()) return { sent: 0, failed: 0, skipped: true };
  const list = pendingList();
  let sent = 0, failed = 0, lastErr = '';
  if (!list.length && !(isAdmin() && getState().settings.masterDirty)) return { sent, failed, lastErr, pending: 0 };
  begin('up', 'Mengirim data');
  try {
  add(list.length + list.reduce((a, i) => a + unsentCount(i), 0) + 1, 'up', 'Mengirim data');
  if (isAdmin() && getState().settings.masterDirty) { try { await pushMaster(); } catch (e) { lastErr = e.message; } }
  tick();
  for (const i of list) {
    try {
      let photoErr = '';
      try { await sendPhotos(i); } catch (e) { photoErr = e.message; lastErr = 'Foto: ' + e.message; }
      const cur = getState().inspections[i.id] || i;
      await upload(cur);
      if (photoErr) { failed++; continue; } // nilai terkirim, foto dicoba lagi pada sinkron berikutnya
      markSynced(i.id, i.updatedAt); sent++; tick();
    } catch (e) { failed++; lastErr = e.message; if (!navigator.onLine) break; }
  }
  } finally { end(!!lastErr || failed > 0); }
  if (sent) setSettings({ lastSyncAt: new Date().toISOString() });
  return { sent, failed, lastErr, pending: list.length };
}

/** Unduh foto yang belum ada di HP untuk 2 periode terbaru (periode lama diunduh saat penilaian dibuka). */
export async function prefetchPhotos() {
  if (!driveOn() || !navigator.onLine) return 0;
  const all = Object.values(getState().inspections).filter((i) => i.driveIds && Object.keys(i.driveIds).length && canSee(i.loc));
  const keep = [...new Set(all.map((i) => i.periode))].sort().reverse().slice(0, 2);
  let n = 0;
  for (const i of all.filter((x) => keep.includes(x.periode))) n += await ensurePhotos(i).catch(() => 0);
  return n;
}

/** Sinkron penuh: profil -> master -> kirim -> tarik. */
export async function fullSync() {
  if (!isConfigured()) return { sent: 0, failed: 0, skipped: true, pulled: 0 };
  await refreshProfile();
  if (!currentProfile() || currentProfile().role === 'none') return { sent: 0, failed: 0, pulled: 0, denied: true };
  let err = '';
  begin('down', 'Mengambil data'); add(2, 'down', 'Mengambil data');
  try {
    try { await pullMaster(); } catch (e) { err = e.message; }
    tick();
    const r = await syncPending();
    let pulled = 0;
    try { pulled = await pullRemote(); } catch (e) { err = err || e.message; }
    tick('Mengambil data', 'down');
    try { await prefetchPhotos(); } catch (e) { err = err || e.message; }
    return { ...r, pulled, lastErr: r.lastErr || err };
  } finally { end(!!err); }
}
