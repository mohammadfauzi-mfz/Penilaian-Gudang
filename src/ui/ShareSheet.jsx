import { useState } from 'react';
import { Sheet, Icon, toast } from './common.jsx';
import { getLoc, getPt, getState } from '../lib/store.js';
import { getPhotosOf, blobToDataUrl } from '../lib/photos.js';
import { buildExcel } from '../export/exportExcel.js';
import { buildPpt } from '../export/exportPpt.js';
import { shareFiles } from '../lib/native.js';
import { periodeLabel, prevPeriode } from '../lib/score.js';
import { loadRecords } from '../lib/trend.js';

/** ids: id inspeksi yang akan dibagikan (satu periode yang sama). */
export default function ShareSheet({ ids, periode, onClose }) {
  const [fmt, setFmt] = useState('both');
  const [busy, setBusy] = useState('');
  const insps = ids.map((i) => getState().inspections[i]).filter(Boolean);
  const first = getLoc(insps[0] && insps[0].loc);
  const pt = getPt(first && first.pt);
  const ptName = insps.every((i) => (getLoc(i.loc) || {}).pt === (first || {}).pt) ? (pt ? pt.name : '') : 'Gabungan';

  async function go() {
    try {
      setBusy('Menyiapkan data…');
      const entries = insps.map((insp) => { const loc = getLoc(insp.loc); return { insp, loc, pt: getPt(loc.pt) }; });
      const tag = `${periode}_${entries.length === 1 ? entries[0].loc.code : (ptName || 'Gudang').replace(/\W+/g, '')}`;
      const out = [];
      if (fmt === 'xlsx' || fmt === 'both') {
        setBusy('Membuat Excel…');
        const { records } = await loadRecords();
        const blob = await buildExcel({ periode, entries, records, title: ptName });
        out.push({ blob, filename: `Penilaian_Gudang_${tag}.xlsx` });
      }
      if (fmt === 'pptx' || fmt === 'both') {
        setBusy('Membuat PowerPoint (memuat foto)…');
        const withPhotos = [];
        for (const e of entries) {
          const raw = await getPhotosOf(e.insp.id);
          const photos = {};
          for (const [k, v] of Object.entries(raw)) photos[k] = { dataUrl: await blobToDataUrl(v.blob), w: v.w, h: v.h };
          withPhotos.push({ ...e, photos });
        }
        const prev = {};
        for (const e of entries) {
          const p = getState().inspections[`${e.loc.code}_${prevPeriode(periode)}`];
          if (p && p.status === 'final') { const { computeScore } = await import('../lib/score.js'); prev[e.loc.code] = computeScore(p.answers, e.loc).total; }
        }
        const blob = await buildPpt({ periode, ptName, entries: withPhotos, prev });
        out.push({ blob, filename: `Warehouse_Performance_${tag}.pptx` });
      }
      setBusy('Membuka menu bagikan…');
      const r = await shareFiles(out, `Penilaian gudang ${periodeLabel(periode)}`);
      if (r === 'downloaded') toast('File tersimpan di folder Unduhan');
      if (r !== 'cancel') onClose();
      setBusy('');
    } catch (e) { console.error(e); setBusy(''); toast('Gagal membuat file: ' + (e.message || e)); }
  }
  const Opt = ({ k, t, d }) => <button className="opt" aria-pressed={fmt === k} onClick={() => setFmt(k)}><div><b>{t}</b><span className="muted">{d}</span></div></button>;
  return (
    <Sheet title="Bagikan hasil penilaian" onClose={busy ? () => {} : onClose}>
      <p className="muted">{ptName ? ptName + ' · ' : ''}{insps.length} lokasi · {periodeLabel(periode)}</p>
      <Opt k="both" t="Excel + PowerPoint" d="Dua file dikirim sekaligus" />
      <Opt k="xlsx" t="Excel (.xlsx)" d="Format monitoring: nilai per butir, aspek, rekap, tren" />
      <Opt k="pptx" t="PowerPoint (.pptx)" d="Slide per aspek lengkap foto dan nilai, rekap, summary" />
      <button className="btn go" disabled={!!busy || !insps.length} onClick={go}>{Icon.share}{busy || 'Bagikan'}</button>
      {!busy && <button className="btn alt" onClick={onClose}>Batal</button>}
    </Sheet>
  );
}
