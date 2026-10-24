// Foto disimpan di IndexedDB (lokal di HP). Kunci: "<inspectionId>|<itemId>"
const DB = 'pg-photos', STORE = 'photos';
let dbp;
function open() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
}
export const photoKey = (inspId, itemId) => `${inspId}|${itemId}`;
export const putPhoto = (inspId, itemId, rec) => tx('readwrite', (s) => s.put(rec, photoKey(inspId, itemId)));
export const getPhoto = (inspId, itemId) => tx('readonly', (s) => s.get(photoKey(inspId, itemId)));
export const delPhoto = (inspId, itemId) => tx('readwrite', (s) => s.delete(photoKey(inspId, itemId)));
export async function delPhotosOf(inspId) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, 'readwrite');
    const s = t.objectStore(STORE);
    const rq = s.openCursor(IDBKeyRange.bound(inspId + '|', inspId + '|￿'));
    rq.onsuccess = () => { const c = rq.result; if (c) { c.delete(); c.continue(); } };
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
/** Ambil semua foto sebuah inspeksi -> { itemId: {blob,w,h} } */
export async function getPhotosOf(inspId) {
  const db = await open();
  return new Promise((res, rej) => {
    const out = {};
    const t = db.transaction(STORE, 'readonly');
    const rq = t.objectStore(STORE).openCursor(IDBKeyRange.bound(inspId + '|', inspId + '|￿'));
    rq.onsuccess = () => {
      const c = rq.result;
      if (c) { out[String(c.key).slice(inspId.length + 1)] = c.value; c.continue(); }
    };
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
  });
}

/** Kecilkan foto -> JPEG (sisi terpanjang <= max). */
export async function shrinkImage(blob, max = 1000, quality = 0.68) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('Foto tidak bisa dibaca'));
      im.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    const out = await new Promise((res) => cv.toBlob(res, 'image/jpeg', quality));
    return { blob: out, w, h };
  } finally { URL.revokeObjectURL(url); }
}
export function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
