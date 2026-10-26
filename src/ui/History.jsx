import { useState } from 'react';
import { useStore, getLoc, getPt, removeInspection } from '../lib/store.js';
import { aspectsFor, computeScore, fmtAspect, fmtTotal, periodeLabel, scoreTone, GRADE } from '../lib/score.js';
import { delPhotosOf } from '../lib/photos.js';
import { removeRemote } from '../lib/sync.js';
import { canSee, canInput, canDelete } from '../lib/auth.js';
import { Icon, ScoreHex, toast } from './common.jsx';

export function History({ openDetail }) {
  const { inspections, locations } = useStore();
  const [f, setF] = useState('*');
  const list = Object.values(inspections).filter((i) => canSee(i.loc) && (f === '*' || i.loc === f)).sort((a, b) => (b.periode + (getLoc(a.loc) || {}).name).localeCompare(a.periode + (getLoc(b.loc) || {}).name));
  return (
    <>
      <header className="topbar"><div className="row"><h1>Riwayat<small>{list.length} penilaian</small></h1></div></header>
      <main className="page"><div className="wrap">
        <select className="in" value={f} onChange={(e) => setF(e.target.value)} aria-label="Filter lokasi">
          <option value="*">Semua lokasi</option>{locations.filter((l) => canSee(l.code)).map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
        {list.map((i) => {
          const l = getLoc(i.loc); if (!l) return null;
          const sc = computeScore(i.answers, l);
          return (
            <button key={i.id} className="hrow" onClick={() => openDetail(i.id)}>
              <ScoreHex v={sc.total} />
              <div><b>{l.name}</b><div className="muted">{periodeLabel(i.periode)} · {i.status === 'final' ? 'Selesai' : `Draf ${sc.count}/${sc.n}`}</div></div>
              {i.status === 'final' ? <span className={`chip ${i.syncedAt === i.updatedAt ? 'ok' : 'warn'}`}>{i.syncedAt === i.updatedAt ? 'Terkirim' : 'Lokal'}</span> : <span className="chip">Draf</span>}
            </button>
          );
        })}
        {!list.length && <div className="card empty"><b>Belum ada riwayat</b><span>Penilaian yang Anda simpan akan muncul di sini. Data Excel 2026 bisa diimpor dari Pengaturan.</span></div>}
      </div></main>
    </>
  );
}

export function Detail({ id, onBack, edit, share, canEdit }) {
  const { inspections } = useStore();
  const i = inspections[id];
  if (!i) return null;
  const l = getLoc(i.loc), pt = getPt(l.pt), sc = computeScore(i.answers, l);
  async function del() {
    if (!window.confirm(`Hapus penilaian ${l.name} ${periodeLabel(i.periode)}? Data di database juga ikut dihapus.`)) return;
    try { await removeRemote(id); } catch (e) { toast('Data lokal dihapus; hapus di database gagal: ' + e.message); }
    await delPhotosOf(id); removeInspection(id); onBack();
  }
  return (
    <div className="shell">
      <header className="topbar"><div className="row"><button className="iconbtn" onClick={onBack} aria-label="Kembali">{Icon.back}</button>
        <h1>{l.name}<small>{pt ? pt.name : ''} · {periodeLabel(i.periode)}</small></h1></div></header>
      <main className="page"><div className="wrap">
        <div className="card" style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'center' }}>
          <ScoreHex v={sc.total} big />
          <div style={{ flex: 1 }}><b>{sc.count}/{sc.n} butir dinilai</b><div className="muted">Tanggal {i.date || '–'} · Penilai {i.inspector || '–'}</div></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn go" onClick={() => share([id], i.periode)} disabled={sc.count === 0}>{Icon.share}Bagikan</button>
          {canInput(i.loc) && <button className="btn alt" onClick={() => edit(i.loc, i.periode)}>Ubah</button>}
          {canDelete(i.loc) && <button className="btn danger" onClick={del}>{Icon.trash}Hapus</button>}
        </div>
        {aspectsFor(l).map((a) => {
          const s = sc.aspects[a.id], t = scoreTone(s.avg);
          return (
            <section className="card" key={a.id}>
              <div style={{ display: 'flex', gap: 10, padding: '12px 14px', alignItems: 'center' }}><b style={{ flex: 1 }}>{a.name}</b><span className="mini" style={s.avg != null ? { background: t.bg, color: t.fg } : null}>{fmtAspect(s.avg)}</span></div>
              {a.items.map((it, k) => { const g = GRADE[i.answers[it.id]]; return (
                <div className="dline" key={it.id}><span>{k + 1}. {it.text}{i.notes && i.notes[it.id] ? <i className="muted" style={{ display: 'block' }}>Catatan: {i.notes[it.id]}</i> : null}</span>
                  <span className="gdot" style={g ? { background: g.color, color: g.ink } : { background: 'var(--line-2)', color: 'var(--ink-3)' }}>{g ? g.k : '–'}</span></div>
              ); })}
            </section>
          );
        })}
      </div></main>
    </div>
  );
}
