import { useState } from 'react';
import { installUpdate } from '../lib/update.js';
import { toast } from './common.jsx';

/** Tombol pembaruan: mengunduh APK di dalam aplikasi (dengan persentase), lalu membuka pemasang Android. */
export default function UpdateButton({ info, label }) {
  const [pct, setPct] = useState(null);
  const busy = pct !== null;
  async function go() {
    setPct(0);
    const r = await installUpdate(info, (e) => setPct(typeof e.percent === 'number' ? e.percent : 0));
    setPct(null);
    if (r.needPermission) toast('Aktifkan "Izinkan dari sumber ini" untuk Penilaian Gudang, kembali ke aplikasi, lalu tekan Perbarui lagi');
    else if (r.error) toast(`Gagal memperbarui: ${r.error}`);
  }
  return <button className="btn go" disabled={busy} onClick={go}>{busy ? `Mengunduh… ${pct}%` : label}</button>;
}
