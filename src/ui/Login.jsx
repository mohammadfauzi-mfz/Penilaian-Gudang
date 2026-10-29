import { useState } from 'react';
import { login, logout } from '../lib/auth.js';
import { getCfg } from '../lib/fb.js';
import { useStore, setSettings } from '../lib/store.js';
import { Sheet, toast } from './common.jsx';

export function Login() {
  const [u, setU] = useState(''); const [p, setP] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [cfgOpen, setCfgOpen] = useState(false);
  async function go(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await login(u, p); } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  return (
    <div className="shell" style={{ placeContent: 'center' }}>
      <main className="page"><div className="wrap" style={{ alignContent: 'center', minHeight: '80vh' }}>
        <form className="card set" onSubmit={go}>
          <h2 style={{ margin: 0 }}>Penilaian Gudang</h2>
          <p className="muted">Masuk dengan akun yang dibuat admin.</p>
          <label className="f">Nama pengguna<input className="in" value={u} onChange={(e) => setU(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="username" /></label>
          <label className="f">Kata sandi<input className="in" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></label>
          {err && <div className="chip warn" style={{ whiteSpace: 'normal' }} role="alert">{err}</div>}
          <button className="btn go" type="submit" disabled={busy}>{busy ? 'Masuk…' : 'Masuk'}</button>
          <button type="button" className="btn alt sm" onClick={() => setCfgOpen(true)}>Atur koneksi database</button>
        </form>
      </div></main>
      {cfgOpen && <CfgSheet onClose={() => setCfgOpen(false)} />}
    </div>
  );
}

export function CfgSheet({ onClose }) {
  useStore();
  const c = getCfg();
  const [k, setK] = useState(c.apiKey); const [pid, setPid] = useState(c.projectId);
  return (
    <Sheet title="Koneksi database" onClose={onClose}>
      <label className="f">Web API key<input className="in" value={k} onChange={(e) => setK(e.target.value)} autoCapitalize="off" spellCheck={false} /></label>
      <label className="f">Project ID<input className="in" value={pid} onChange={(e) => setPid(e.target.value)} autoCapitalize="off" spellCheck={false} /></label>
      <button className="btn go" onClick={() => { setSettings({ firebase: k.trim() && pid.trim() ? { apiKey: k.trim(), projectId: pid.trim() } : null }); toast('Disimpan'); onClose(); }}>Simpan</button>
      <button className="btn alt" onClick={onClose}>Batal</button>
    </Sheet>
  );
}

export function Denied() {
  return (
    <div className="shell"><main className="page"><div className="wrap" style={{ alignContent: 'center', minHeight: '80vh' }}>
      <div className="card empty"><b>Akun belum diberi akses</b><span>Akun Anda sudah login tetapi belum memiliki peran dan area. Hubungi admin, lalu masuk ulang.</span>
        <button className="btn alt" onClick={logout}>Keluar</button></div>
    </div></main></div>
  );
}
