import { useEffect, useMemo, useState } from 'react';
import { useStore, inspId } from '../lib/store.js';
import { computeScore, fmtTotal, periodeLabel, itemCount } from '../lib/score.js';
import { pendingCount, isConfigured, fullSync } from '../lib/sync.js';
import { canSee, canInput, useAuth } from '../lib/auth.js';
import { useUpdate, checkUpdate } from '../lib/update.js';
import UpdateButton from './UpdateButton.jsx';
import { Icon, ScoreHex, toast } from './common.jsx';

export default function Home({ periode, setPeriode, openForm, openDetail, share }) {
  const { locations, pts, inspections } = useStore();
  const [busy, setBusy] = useState(false);
  useAuth();
  const { info: upd } = useUpdate();
  useEffect(() => { checkUpdate(); }, []);
  const groups = useMemo(() => pts.map((p) => ({ pt: p, locs: locations.filter((l) => l.pt === p.code && l.active && canSee(l.code)) })).filter((g) => g.locs.length), [pts, locations]);
  const pend = pendingCount();
  async function sync() {
    setBusy(true); const r = await fullSync(); setBusy(false);
    toast(r.skipped ? 'Database belum diatur (Pengaturan)' : r.failed ? `Gagal kirim: ${r.lastErr || 'periksa koneksi'}` : r.sent ? `Terkirim ${r.sent} penilaian` : r.pulled ? `${r.pulled} penilaian diperbarui dari database` : 'Semua sudah tersinkron');
  }
  return (
    <>
      <header className="topbar">
        <div className="row"><h1>Penilaian gudang<small>Pilih estate/PKS untuk mulai menilai</small></h1>
          {(isConfigured() || pend > 0) && <button className="iconbtn" onClick={sync} disabled={busy} aria-label="Sinkronkan">{Icon.sync}</button>}</div>
      </header>
      <main className="page"><div className="wrap">
        <div className="periode">
          <label className="f">Periode penilaian<input className="in" type="month" value={periode} onChange={(e) => e.target.value && setPeriode(e.target.value)} /></label>
          <span className="muted" style={{ alignSelf: 'end', paddingBottom: 12 }}>{periodeLabel(periode)}</span>
        </div>
        {upd && (
          <div className="card set" role="status" style={{ borderColor: 'var(--orange)' }}>
            <b>Versi baru tersedia (build {upd.build})</b>
            {upd.notes && <span className="muted" style={{ whiteSpace: 'pre-line' }}>{upd.notes}</span>}
            <UpdateButton info={upd} label="Perbarui" />
            <span className="muted">Aplikasi mengunduh pembaruan, lalu tekan Pasang. Data di HP tetap aman.</span>
          </div>
        )}
        {pend > 0 && <div className="chip warn" style={{ justifySelf: 'start' }}>{pend} penilaian menunggu dikirim ke database</div>}
        {groups.map(({ pt, locs }) => {
          const done = locs.map((l) => inspections[inspId(l.code, periode)]).filter((i) => i && i.status === 'final');
          return (
            <section className="ptblock" key={pt.code}>
              <div className="sec-h"><span>{pt.name}</span>
                {done.length > 0 && <button className="btn sm alt" onClick={() => share(done.map((d) => d.id), periode)}>{Icon.share}Bagikan {done.length}</button>}
              </div>
              {locs.map((l) => {
                const i = inspections[inspId(l.code, periode)];
                const sc = i ? computeScore(i.answers, l) : null;
                const n = itemCount(l);
                const fin = i && i.status === 'final';
                return (
                  <button className="loc" key={l.code} disabled={!canInput(l.code) && !fin} onClick={() => (canInput(l.code) ? openForm(l.code) : openDetail(i.id))}>
                    <ScoreHex v={sc && sc.count ? sc.total : null} />
                    <div>
                      <h3>{l.name}</h3>
                      <div className="sub">{fin ? `Selesai · ${i.inspector || 'tanpa nama'}` : i ? `Draf · ${sc.count}/${n} butir` : 'Belum dinilai'}</div>
                      {i && !fin && <div className="bar"><i style={{ width: `${(sc.count / n) * 100}%` }} /></div>}
                    </div>
                    {fin ? <span className={`chip ${i.syncedAt === i.updatedAt ? 'ok' : 'warn'}`}>{i.syncedAt === i.updatedAt ? 'Terkirim' : 'Lokal'}</span> : <span className="chip off">{!canInput(l.code) ? 'Belum ada' : i ? 'Lanjutkan' : 'Mulai'}</span>}
                  </button>
                );
              })}
            </section>
          );
        })}
        {!groups.length && <div className="card empty"><b>Belum ada lokasi aktif</b><span>Tambahkan lokasi di Pengaturan.</span></div>}
      </div></main>
    </>
  );
}
