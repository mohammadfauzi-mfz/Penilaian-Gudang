import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { blobToDataUrl } from './photos.js';

export const isNative = () => Capacitor.isNativePlatform();

/** Ambil foto dari kamera / galeri. Mengembalikan Blob atau null bila dibatalkan. */
export async function pickPhoto(source /* 'camera' | 'gallery' */) {
  if (isNative()) {
    try {
      const r = await Camera.getPhoto({
        quality: 75, width: 1600, height: 1600, correctOrientation: true,
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      });
      if (!r || !r.dataUrl) return null;
      return await (await fetch(r.dataUrl)).blob();
    } catch (e) {
      if (/cancel/i.test(String(e && e.message))) return null;
      throw e;
    }
  }
  return new Promise((res) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    if (source === 'camera') inp.setAttribute('capture', 'environment');
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.onchange = () => { const f = inp.files && inp.files[0]; inp.remove(); res(f || null); };
    inp.addEventListener('cancel', () => { inp.remove(); res(null); });
    inp.click();
  });
}

/** Bagikan / simpan satu atau beberapa file hasil ekspor. files: [{blob, filename}] */
export async function shareFiles(files, title) {
  if (isNative()) {
    const uris = [];
    for (const f of files) {
      const dataUrl = await blobToDataUrl(f.blob);
      const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const w = await Filesystem.writeFile({ path: f.filename, data, directory: Directory.Cache });
      uris.push(w.uri);
    }
    try { await Share.share({ title: title || files[0].filename, dialogTitle: 'Bagikan hasil penilaian', files: uris }); }
    catch (e) { if (/cancel/i.test(String(e && e.message))) return 'cancel'; throw e; }
    return 'shared';
  }
  const objs = files.map((f) => new File([f.blob], f.filename, { type: f.blob.type }));
  if (navigator.canShare && navigator.canShare({ files: objs })) {
    try { await navigator.share({ files: objs, title: title || files[0].filename }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
  }
  for (const f of files) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f.blob); a.download = f.filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  return 'downloaded';
}

export async function openLink(url) {
  // Di Android, navigasi ke URL luar dialihkan Capacitor ke browser/pengunduh sistem; WebView aplikasi tetap di tempat.
  if (isNative()) window.location.href = url; else window.open(url, '_blank');
}
