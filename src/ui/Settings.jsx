import { useState } from 'react';
import { useStore, setSettings, importHistory } from '../lib/store.js';
import { getCfg, isConfigured, fullSync, pendingCount, saveMaster } from '../lib/sync.js';
import { useAuth, logout, changeOwnPassword, ROLE_LABEL } from '../lib/auth.js';
import HISTORY from '../data/history.json';
import { Icon, Sheet, toast } from './common.jsx';
import { openLink } from '../lib/native.js';
import Users from './Users.jsx';
import { ping } from '../lib/drive.js';
import { useUpdate, checkUpdate, updateSupported, BUILD } from '../lib/update.js';

export default function Settings() {
  const { settings, locations, pts, inspections } = useStore();
  const { profile, session } = useAuth();
  const admin = !!profile && profile.role === 'admin';
  const cfg = getCfg();
  const [pt, setPt] = useState(null);
  const [about, setAbout] = useState(false);
  const { info: upd } = useUpdate();
  async function cekUpdate() {
    const r = await checkUpdate(true);
    toast(r.unsupported ? 'Pembaruan otomatis hanya di aplikasi Android hasil build GitHub' : r.error ? `Gagal memeriksa: ${r.error}` : r.info ? `Tersedia build ${r.info.build}` : 'Sudah versi terbaru');
  }
  const [durl, setDurl] = useState(settings.driveUrl || '');
  async function saveDrive() {
    const v = durl.trim();
    setSettings({ driveUrl: v });
    const r = await saveMaster(pts, locations);
    if (!v) return toast('Foto ke Drive dimatikan');
    try { await ping(); toast(r.sent || r.local ? 'Tersimpan. Skrip Drive aktif' : 'Skrip aktif, tetapi belum terkirim ke database'); }
    catch (e) { toast('Tersimpan, tetapi skrip tidak menjawab: ' + e.message); }
  }
  const [key, setKey] = useState(settings.firebase ? settings.firebase.apiKey : '');
  const [pid, setPid] = useState(settings.firebase ? settings.firebase.projectId : '');
  const [busy, setBusy] = useState('');
  const [edit, setEdit] = useState(null);
  const baked = !settings.firebase && isConfigured();

  function saveFb() {
    const k = key.trim(), p = pid.trim();
    setSettings({ firebase: k && p ? { apiKey: k, projectId: p } : null });
    toast(k && p ? 'Disimpan. Aplikasi meminta login setelah ini' : 'Disimpan');
  }
  async function sync() {
    setBusy('sync'); const r = await fullSync(); setBusy('');
    toast(r.skipped ? 'Database belum diatur' : r.failed ? `Gagal: ${r.lastErr}` : r.sent ? `Terkirim ${r.sent} penilaian` : r.pulled ? `${r.pulled} penilaian diperbarui dari database` : 'Semua sudah tersinkron');
  }
  function imp() {
    const n = importHistory();
    toast(n ? `${n} penilaian Jan–Sep 2026 diimpor. Kirim ke database dengan Sinkronkan.` : 'Data historis sudah ada');
  }
  const importable = HISTORY.filter((h) => !inspections[`${h.loc}_${h.periode}`]).length;
  const pend = pendingCount();

  return (
    <>
      <header className="topbar"><div className="row"><h1>Pengaturan</h1></div></header>
      <main className="page"><div className="wrap">
        {profile && !profile.local && (
          <section className="card set">
            <h3>Akun</h3>
            <div><b>{profile.name || 'Pengguna'}</b> <span className="chip off">{ROLE_LABEL[profile.role]}</span></div>
            <p className="muted">{profile.role === 'user' || profile.role === 'reader' ? `${profile.role === 'reader' ? 'Hanya melihat. ' : ''}Area: ${(profile.locs || []).join(', ') || '–'}` : profile.role === 'supervisi' ? 'Dapat melihat dan menilai semua PT dan estate/PKS (tidak bisa menghapus atau mengelola).' : 'Akses penuh semua PT dan estate/PKS.'}</p>
            <button className="btn alt" onClick={async () => { const np = window.prompt('Kata sandi baru (minimal 6 karakter):'); if (!np) return; try { await changeOwnPassword(np); toast('Kata sandi diubah'); } catch (e) { toast(e.message); } }}>Ubah kata sandi</button>
            <button className="btn alt" onClick={() => { const n = pendingCount(); if (window.confirm(n ? `${n} penilaian belum terkirim dan draf di HP ini akan hilang bila Keluar. Lanjutkan?` : 'Keluar dari akun? Data lokal di HP ini dibersihkan.')) logout(); }}>Keluar</button>
          </section>
        )}
        <section className="card set">
          <h3>Penilai</h3>
          <label className="f">Nama penilai bawaan<input className="in" value={settings.inspector || ''} onChange={(e) => setSettings({ inspector: e.target.value })} placeholder="Nama Anda" /></label>
        </section>

        {admin && (<>
        {!profile.local && <Users myUid={session && session.uid} />}
        <section className="card set">
          <h3>Database (Firebase)</h3>
          <p className="muted">Penilaian yang ditandai selesai dikirim ke Firebase Firestore agar muncul di dashboard tren.{baked ? ' Pengaturan bawaan aplikasi sedang dipakai.' : ''}</p>
          <label className="f">Web API key<input className="in" value={key} onChange={(e) => setKey(e.target.value)} placeholder={cfg.apiKey ? '••••••••' + cfg.apiKey.slice(-4) : 'AIza…'} autoCapitalize="off" autoCorrect="off" spellCheck={false} /></label>
          <label className="f">Project ID<input className="in" value={pid} onChange={(e) => setPid(e.target.value)} placeholder={cfg.projectId || 'nama-project-anda'} autoCapitalize="off" autoCorrect="off" spellCheck={false} /></label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" disabled={!!busy} onClick={saveFb}>Simpan</button>
            <button className="btn alt" disabled={!!busy || !isConfigured()} onClick={sync}>{Icon.sync}{busy === 'sync' ? 'Mengirim…' : `Sinkronkan${pend ? ` (${pend})` : ''}`}</button>
          </div>
          <p className="muted">{settings.lastSyncAt ? `Terakhir terkirim ${new Date(settings.lastSyncAt).toLocaleString('id-ID')}` : 'Belum pernah mengirim data.'}</p>
        </section>

        <section className="card set">
          <h3>Data historis 2026</h3>
          <p className="muted">Nilai Januari–September 2026 dari file Excel monitoring ({HISTORY.length} penilaian, 10 lokasi) bisa dimasukkan sebagai riwayat dan data awal dashboard.</p>
          <button className="btn alt" onClick={imp} disabled={!importable}>{importable ? `Impor ${importable} penilaian dari Excel` : 'Sudah diimpor'}</button>
        </section>

        <section className="card set">
          <h3>Foto ke Google Drive</h3>
          <p className="muted">Tempel alamat Web app dari Google Apps Script (lihat README). Foto penilaian diunggah ke Drive Anda dan bisa dilihat semua HP sesuai area. Kosongkan untuk mematikan.</p>
          <label className="f">Alamat Web app<input className="in" value={durl} onChange={(e) => setDurl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" autoCapitalize="off" autoCorrect="off" spellCheck={false} /></label>
          <button className="btn" onClick={saveDrive}>Simpan dan uji</button>
        </section>

        <section className="card" style={{ overflow: 'hidden' }}>
          <div className="set" style={{ paddingBottom: 6 }}><h3>Kelola PT</h3><p className="muted">Tambah atau ubah nama PT. Perubahan dikirim ke database dan dipakai semua pengguna.</p></div>
          {pts.map((p) => (
            <div className="lrow" key={p.code}>
              <div><b>{p.name}</b> <span className="muted">· {p.code} · {locations.filter((l) => l.pt === p.code).length} estate/PKS</span></div>
              <button className="btn alt sm" onClick={() => setPt({ ...p })}>Ubah</button>
            </div>
          ))}
          <div className="lrow"><span /><button className="btn sm" onClick={() => setPt({ code: '', name: '', isNew: true })}>{Icon.plus}Tambah PT</button></div>
        </section>

        <section className="card" style={{ overflow: 'hidden' }}>
          <div className="set" style={{ paddingBottom: 6 }}><h3>Kelola Estate/PKS</h3><p className="muted">Tambah, ubah, atau sembunyikan estate/PKS yang tidak dipakai.</p></div>
          {locations.map((l) => (
            <div className="lrow" key={l.code}>
              <div><b>{l.name}</b> <span className="muted">· {l.code} · {(pts.find((p) => p.code === l.pt) || {}).name || l.pt}{l.pupuk === false ? ' · tanpa aspek pupuk' : ''}{l.active ? '' : ' · disembunyikan'}</span></div>
              <button className="btn alt sm" onClick={() => setEdit({ ...l })}>Ubah</button>
            </div>
          ))}
          <div className="lrow"><span /><button className="btn sm" disabled={!pts.length} onClick={() => setEdit({ code: '', name: '', pt: pts[0] && pts[0].code, pupuk: true, active: true, isNew: true })}>{Icon.plus}Tambah estate/PKS</button></div>
        </section>
        </>)}

        <section className="card set">
          <h3>Pembaruan aplikasi</h3>
          <p className="muted">Build terpasang: {BUILD || '–'}. Pembaruan diambil dari GitHub Releases repo aplikasi ini.</p>
          {upd && <button className="btn go" onClick={() => openLink(upd.url)}>Unduh build {upd.build}</button>}
          <button className="btn alt" disabled={!updateSupported()} onClick={cekUpdate}>Periksa pembaruan</button>
        </section>

        <section className="card" style={{ overflow: 'hidden' }}>
          <button className="lrow" style={{ width: '100%', background: 'none', border: 0, textAlign: 'left', borderTop: 0 }} onClick={() => setAbout(true)}>
            <b>Tentang aplikasi</b>{Icon.chev}
          </button>
        </section>
      </div></main>

      {edit && <LocEdit loc={edit} pts={pts} locations={locations} onClose={() => setEdit(null)} />}
      {pt && <PtEdit pt={pt} pts={pts} locations={locations} onClose={() => setPt(null)} />}
      {about && (
        <Sheet title="Tentang aplikasi" onClose={() => setAbout(false)}>
          <div className="about" style={{ padding: '8px 0' }}>
            <b>Penilaian Gudang</b>
            <span>Create By Mohammad Fauzi</span>
            <span>Contact Me for Suggestion &amp; Feedback</span>
            <button className="wa" aria-label="WhatsApp" onClick={() => openLink('https://wa.me/6285252390543')}>{Icon.wa}</button>
            <span className="muted" style={{ marginTop: 18 }}>Versi Aplikasi 1.0</span>
          </div>
        </Sheet>
      )}
    </>
  );
}
function LocEdit({ loc, pts, locations, onClose }) {
  const [f, setF] = useState(loc);
  function save() {
    const code = f.code.trim().toUpperCase().replace(/\s+/g, '');
    if (!code || !f.name.trim()) return toast('Kode dan nama wajib diisi');
    if (f.isNew && locations.some((l) => l.code === code)) return toast('Kode sudah dipakai');
    const rec = { code, name: f.name.trim(), pt: f.pt, pupuk: f.pupuk, active: f.active };
    saveAndToast(pts, f.isNew ? [...locations, rec] : locations.map((l) => (l.code === loc.code ? rec : l)));
    onClose();
  }
  return (
    <Sheet title={f.isNew ? 'Tambah estate/PKS' : 'Ubah estate/PKS'} onClose={onClose}>
      <label className="f">Kode (mis. TL1)<input className="in" value={f.code} disabled={!f.isNew} onChange={(e) => setF({ ...f, code: e.target.value })} /></label>
      <label className="f">Nama tampilan<input className="in" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="f">PT<select className="in" value={f.pt} onChange={(e) => setF({ ...f, pt: e.target.value })}>{pts.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></label>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}><input type="checkbox" checked={f.pupuk} onChange={(e) => setF({ ...f, pupuk: e.target.checked })} />Nilai aspek penyimpanan pupuk</label>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Tampilkan di beranda (aktif)</label>
      <button className="btn go" onClick={save}>Simpan</button><button className="btn alt" onClick={onClose}>Batal</button>
    </Sheet>
  );
}

async function saveAndToast(pts, locations) {
  const r = await saveMaster(pts, locations);
  toast(r.local ? 'Disimpan di HP (database belum diatur)' : r.sent ? 'Disimpan dan dikirim ke database' : 'Disimpan di HP, gagal kirim ke database. Akan dicoba lagi saat Sinkronkan');
}

function PtEdit({ pt, pts, locations, onClose }) {
  const [f, setF] = useState(pt);
  function save() {
    const code = f.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || !f.name.trim()) return toast('Kode dan nama PT wajib diisi');
    if (f.isNew && pts.some((p) => p.code === code)) return toast('Kode PT sudah dipakai');
    const rec = { code, name: f.name.trim() };
    saveAndToast(f.isNew ? [...pts, rec] : pts.map((p) => (p.code === pt.code ? rec : p)), locations);
    onClose();
  }
  const used = locations.filter((l) => l.pt === pt.code).length;
  function del() {
    if (used) return toast('PT masih punya estate/PKS. Pindahkan atau hapus dulu');
    if (!window.confirm(`Hapus ${pt.name}?`)) return;
    saveAndToast(pts.filter((p) => p.code !== pt.code), locations); onClose();
  }
  return (
    <Sheet title={f.isNew ? 'Tambah PT' : 'Ubah PT'} onClose={onClose}>
      <label className="f">Kode singkat (mis. BPN)<input className="in" value={f.code} disabled={!f.isNew} onChange={(e) => setF({ ...f, code: e.target.value })} autoCapitalize="characters" /></label>
      <label className="f">Nama PT<input className="in" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="PT. Nama Perusahaan" /></label>
      <button className="btn go" onClick={save}>Simpan</button>
      {!f.isNew && <button className="btn danger" onClick={del}>{Icon.trash}Hapus PT</button>}
      <button className="btn alt" onClick={onClose}>Batal</button>
    </Sheet>
  );
}
