// Foto -> Google Drive lewat Google Apps Script (drive/Code.gs). Alamat skrip disimpan admin di master/config.
import { getState } from './store.js';
import { getToken } from './auth.js';
import { begin, add, tick, end } from './progress.js';
import { getPhotosOf, putPhoto, blobToDataUrl } from './photos.js';

export const driveUrl = () => (getState().settings.driveUrl || '').trim();
export const driveOn = () => !!driveUrl();

async function call(body) {
  const r = await fetch(driveUrl(), { method: 'POST', body: JSON.stringify({ ...body, idToken: await getToken() }) }); // text/plain: tanpa preflight CORS
  let j; try { j = await r.json(); } catch { throw new Error('Layanan foto tidak menjawab (periksa alamat Apps Script)'); }
  if (!j.ok) throw new Error(j.error || 'Layanan foto menolak');
  return j;
}

export async function ping() {
  const r = await fetch(driveUrl()); const j = await r.json();
  if (!j.ok) throw new Error('Skrip tidak menjawab');
  return j.msg;
}

export async function uploadPhoto(insp, loc, ptName, itemId, blob) {
  const d = await blobToDataUrl(blob);
  const j = await call({ action: 'put', inspId: insp.id, itemId, loc: insp.loc, locName: loc ? loc.name : insp.loc, pt: loc ? loc.pt : '', ptName, periode: insp.periode, data: d.slice(d.indexOf(',') + 1) });
  return j.id;
}

async function b64ToBlob(b64) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: 'image/jpeg' }); }

/** Unduh foto yang ada di Drive tetapi belum ada di HP ini (mis. dinilai oleh orang lain). Gagal diam-diam bila offline. */
export async function ensurePhotos(insp) {
  const ids = insp && insp.driveIds; if (!ids || !driveOn() || !navigator.onLine) return 0;
  const have = await getPhotosOf(insp.id).catch(() => ({}));
  const need = Object.entries(ids).filter(([itemId]) => !have[itemId]);
  if (!need.length) return 0;
  let n = 0, bad = false;
  begin('down', 'Mengunduh foto'); add(need.length, 'down', 'Mengunduh foto');
  try {
    for (const [itemId, fileId] of need) {
      try {
        const j = await call({ action: 'get', inspId: insp.id, itemId, fileId });
        const blob = await b64ToBlob(j.data);
        const img = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = URL.createObjectURL(blob); });
        await putPhoto(insp.id, itemId, { blob, w: img ? img.naturalWidth : 0, h: img ? img.naturalHeight : 0 });
        n++;
      } catch { bad = true; /* lanjut ke foto berikut */ }
      tick();
    }
  } finally { end(bad); }
  return n;
}
