import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, getLoc, getPt, inspId, saveInspection, setSettings } from '../lib/store.js';
import { GRADES, GRADE, aspectsFor, computeScore, fmtAspect, fmtTotal, periodeLabel, scoreTone, todayISO } from '../lib/score.js';
import { getPhotosOf, putPhoto, delPhoto, shrinkImage } from '../lib/photos.js';
import { pickPhoto } from '../lib/native.js';
import { ensurePhotos } from '../lib/drive.js';
import { syncPending } from '../lib/sync.js';
import { Icon, ScoreHex, Sheet, toast } from './common.jsx';

export default function Form({ locCode, periode, onClose }) {
  const { settings, inspections } = useStore();
  const loc = getLoc(locCode);
  const id = inspId(locCode, periode);
  const [draft, setDraft] = useState(() => inspections[id] ? { photoIds: [], ...inspections[id] } : {
    id, loc: locCode, periode, date: todayISO(), inspector: settings.inspector || '', answers: {}, notes: {}, photoIds: [], status: 'draft',
  });
  const [photos, setPhotos] = useState({}); // itemId -> objectURL
  const [sheet, setSheet] = useState(null); // itemId
  const [open, setOpen] = useState({ 1: true });
  const [noteOpen, setNoteOpen] = useState({});
  const aspects = useMemo(() => aspectsFor(loc), [loc]);
  const sc = computeScore(draft.answers, loc);
  const first = useRef(true), timer = useRef(null), latest = useRef(draft);
  const snap = (d) => JSON.stringify([d.date, d.inspector, d.answers, d.notes, d.photoIds, d.driveIds, d.status]);
  const saved = useRef(existingSnap());
  function existingSnap() { return inspections[id] ? snap({ photoIds: [], ...inspections[id] }) : ''; }
  latest.current = draft;

  useEffect(() => { // muat foto
    let alive = true; const urls = [];
    (inspections[id] ? ensurePhotos(inspections[id]) : Promise.resolve()).catch(() => {}).then(() => getPhotosOf(id)).then((m) => {
      if (!alive) return; const o = {};
      for (const [k, v] of Object.entries(m)) { const u = URL.createObjectURL(v.blob); urls.push(u); o[k] = u; }
      setPhotos(o);
    }).catch(() => {});
    return () => { alive = false; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [id]);

  const hasContent = (d) => Object.keys(d.answers).length || Object.values(d.notes).some(Boolean) || d.photoIds.length;
  const flush = () => { clearTimeout(timer.current); const d = latest.current; if (hasContent(d) && snap(d) !== saved.current) { saved.current = snap(d); saveInspection(d); } };
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
    return () => clearTimeout(timer.current);
  }, [draft]);
  useEffect(() => () => flush(), []); // simpan saat keluar

  const upd = (p) => setDraft((d) => ({ ...d, ...p }));
  const setGrade = (itemId, k) => setDraft((d) => {
    const a = { ...d.answers }; if (a[itemId] === k) delete a[itemId]; else a[itemId] = k; return { ...d, answers: a };
  });
  const setNote = (itemId, t) => setDraft((d) => ({ ...d, notes: { ...d.notes, [itemId]: t } }));

  async function addPhoto(itemId, source) {
    try {
      const raw = await pickPhoto(source);
      if (!raw) return;
      const sm = await shrinkImage(raw);
      await putPhoto(id, itemId, sm);
      setPhotos((p) => { if (p[itemId]) URL.revokeObjectURL(p[itemId]); return { ...p, [itemId]: URL.createObjectURL(sm.blob) }; });
      setDraft((d) => { const { [itemId]: _x, ...dr } = d.driveIds || {}; return { ...d, driveIds: dr, photoIds: d.photoIds.includes(itemId) ? d.photoIds : [...d.photoIds, itemId] }; });
      setSheet(null);
    } catch (e) { toast('Foto gagal: ' + (e.message || e)); }
  }
  async function removePhoto(itemId) {
    await delPhoto(id, itemId);
    setPhotos((p) => { const { [itemId]: u, ...r } = p; if (u) URL.revokeObjectURL(u); return r; });
    setDraft((d) => { const { [itemId]: _x, ...dr } = d.driveIds || {}; return { ...d, driveIds: dr, photoIds: d.photoIds.filter((x) => x !== itemId) }; });
    setSheet(null);
  }

  function close() { flush(); onClose(); }
  async function finish() {
    if (!sc.count) { toast('Belum ada butir yang dinilai. Isi minimal satu butir.'); return; }
    const missing = sc.n - sc.count;
    if (missing && !window.confirm(`${missing} butir belum dinilai. Tetap tandai selesai?`)) return;
    clearTimeout(timer.current);
    const fin = { ...latest.current, status: 'final' };
    latest.current = fin; setDraft(fin);
    saved.current = snap(fin);
    saveInspection(fin);
    onClose();
    toast('Penilaian disimpan');
    syncPending().then((r) => { if (r.sent) toast(`Terkirim ke database (${r.sent})`); else if (r.failed) toast('Belum terkirim, akan dicoba lagi'); });
  }
  const isFinal = draft.status === 'final';
  const pt = getPt(loc.pt);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="row">
          <button className="iconbtn" onClick={close} aria-label="Kembali">{Icon.back}</button>
          <h1>{loc.name}<small>{pt ? pt.name : ''} · {periodeLabel(periode)}</small></h1>
          {isFinal && <span className="chip ok">{Icon.check && <span style={{ width: 14, height: 14, display: 'inline-flex' }}>{Icon.check}</span>}Selesai</span>}
        </div>
      </header>
      <div className="scorebar">
        <ScoreHex v={sc.total} />
        <div className="m"><b>{sc.count} dari {sc.n} butir dinilai</b><div className="bar"><i style={{ width: `${(sc.count / sc.n) * 100}%` }} /></div></div>
      </div>
      <main className="page" style={{ paddingBottom: 96 }}>
        <div className="wrap">
          <div className="card meta">
            <label className="f">Tanggal penilaian<input className="in" type="date" value={draft.date} onChange={(e) => upd({ date: e.target.value })} /></label>
            <label className="f">Nama penilai<input className="in" value={draft.inspector} placeholder="Nama Anda" onChange={(e) => upd({ inspector: e.target.value })} onBlur={(e) => setSettings({ inspector: e.target.value })} /></label>
            <details style={{ gridColumn: '1 / -1' }}>
              <summary className="muted" style={{ cursor: 'pointer', fontWeight: 650 }}>Arti nilai SB / BA / S / BU</summary>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {GRADES.map((g) => <div key={g.k} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}><span className="gdot" style={{ background: g.color, color: g.ink }}>{g.k}</span><span><b>{g.label} ({g.p})</b> – {g.desc}</span></div>)}
              </div>
            </details>
          </div>

          {aspects.map((a) => {
            const s = sc.aspects[a.id], t = scoreTone(s.avg);
            return (
              <details key={a.id} className="card aspect" open={!!open[a.id]} onToggle={(e) => { const o = e.currentTarget.open; setOpen((p) => (p[a.id] === o ? p : { ...p, [a.id]: o })); }}>
                <summary>
                  <span className="chev">{Icon.chev}</span>
                  <span className="nm">{a.name}<small>{s.count} dari {s.n} butir</small></span>
                  <span className="mini" style={s.avg != null ? { background: t.bg, color: t.fg } : { background: 'var(--line-2)', color: 'var(--ink-3)' }}>{fmtAspect(s.avg)}</span>
                </summary>
                {a.items.map((it, i) => {
                  const cur = draft.answers[it.id];
                  return (
                    <div className="item" key={it.id}>
                      <p><b>{i + 1}.</b>{it.text}</p>
                      <div className="grades" role="group" aria-label={`Nilai butir ${it.id}`}>
                        {GRADES.map((g) => (
                          <button key={g.k} className="g" data-k={g.k} style={{ '--gc': g.color, '--gi': g.ink }} aria-pressed={cur === g.k} aria-label={`${g.label} (${g.p})`} onClick={() => setGrade(it.id, g.k)}><span>{g.k}</span></button>
                        ))}
                      </div>
                      <div className="itemtools">
                        <button className="thumb" aria-label={photos[it.id] ? 'Lihat atau ganti foto' : 'Tambah foto'} style={photos[it.id] ? { backgroundImage: `url(${photos[it.id]})` } : null} onClick={() => setSheet(it.id)}>{!photos[it.id] && Icon.camera}</button>
                        {noteOpen[it.id] || draft.notes[it.id]
                          ? <textarea className="notein" rows={1} placeholder="Catatan (opsional)" value={draft.notes[it.id] || ''} onChange={(e) => setNote(it.id, e.target.value)} />
                          : <button className="btn alt sm" onClick={() => setNoteOpen((p) => ({ ...p, [it.id]: true }))}>{Icon.note}Catatan</button>}
                      </div>
                    </div>
                  );
                })}
              </details>
            );
          })}
        </div>
      </main>
      <div className="actionbar">
        {isFinal
          ? <><button className="btn alt" onClick={close}>Tutup</button><button className="btn go" onClick={finish}>Simpan perubahan</button></>
          : <><button className="btn alt" onClick={() => { close(); toast('Draf tersimpan'); }}>Simpan draf</button><button className="btn go" onClick={finish}>Tandai selesai</button></>}
      </div>

      {sheet && (
        <Sheet title="Foto butir" onClose={() => setSheet(null)}>
          {photos[sheet] && <img className="preview" src={photos[sheet]} alt="Foto butir penilaian" />}
          <button className="btn" onClick={() => addPhoto(sheet, 'camera')}>{Icon.camera}{photos[sheet] ? 'Ambil ulang dengan kamera' : 'Ambil foto'}</button>
          <button className="btn alt" onClick={() => addPhoto(sheet, 'gallery')}>Pilih dari galeri</button>
          {photos[sheet] && <button className="btn danger" onClick={() => removePhoto(sheet)}>{Icon.trash}Hapus foto</button>}
          <button className="btn alt" onClick={() => setSheet(null)}>Tutup</button>
        </Sheet>
      )}
    </div>
  );
}
