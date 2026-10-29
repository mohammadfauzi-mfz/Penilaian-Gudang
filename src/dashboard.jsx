import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import TrendView from './ui/TrendView.jsx';
import { fetchRemote, isConfigured } from './lib/sync.js';
import { mergeRecords } from './lib/trend.js';
import { useAuth, logout, refreshProfile } from './lib/auth.js';
import { Login, Denied, CfgSheet } from './ui/Login.jsx';
import { FIREBASE_CONFIG } from './config.js';
import { Icon, ToastHost } from './ui/common.jsx';

function Dash() {
  const { mode, profile } = useAuth();
  const [st, setSt] = useState({ loading: true, records: [], error: null, at: null });
  const [cfgOpen, setCfgOpen] = useState(false);
  const load = async () => {
    if (!isConfigured()) return setSt({ loading: false, records: [], error: 'config', at: null });
    setSt((s) => ({ ...s, loading: true }));
    try { await refreshProfile(); const r = await fetchRemote(); setSt({ loading: false, records: mergeRecords(r, {}), error: null, at: new Date() }); }
    catch (e) { setSt({ loading: false, records: [], error: e.message, at: null }); }
  };
  useEffect(() => { if (mode === 'in') load(); }, [mode]);
  if (mode === 'login') return <Login />;
  if (mode === 'denied') return <Denied />;
  return (
    <div className="shell">
      <header className="topbar"><div className="row">
        <h1>Dashboard penilaian gudang<small>{st.loading ? 'Memuat data…' : st.at ? `${profile ? profile.name || '' : ''} · diperbarui ${st.at.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}</small></h1>
        <button className="iconbtn" onClick={load} aria-label="Muat ulang">{Icon.sync}</button>
        <button className="btn alt sm" onClick={logout}>Keluar</button></div></header>
      <main className="page"><div className="wrap">
        {st.error === 'config'
          ? <div className="card empty"><b>Firebase belum diisi</b><span>Hasil build ini membawa: apiKey {FIREBASE_CONFIG.apiKey ? 'terisi' : 'KOSONG'}, projectId {FIREBASE_CONFIG.projectId ? 'terisi' : 'KOSONG'}. Jika KOSONG, isi secrets <code>FIREBASE_API_KEY</code> dan <code>FIREBASE_PROJECT_ID</code> (atau <code>src/config.js</code>), jalankan ulang workflow, lalu muat ulang halaman dengan Ctrl+F5.</span><span>Atau isi langsung untuk browser ini:</span><button className="btn" onClick={() => setCfgOpen(true)}>Isi koneksi di browser ini</button></div>
          : st.error ? <div className="card empty"><b>Data tidak bisa dimuat</b><span>{st.error}</span><span>Periksa aturan Firestore dan peran akun Anda.</span></div>
          : <TrendView records={st.records} />}
      </div></main>
      {cfgOpen && <CfgSheet onClose={() => { setCfgOpen(false); load(); }} />}
      <ToastHost />
    </div>
  );
}
createRoot(document.getElementById('root')).render(<Dash />);
