import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.js';
import { listUsers, createUser, updateUser } from '../lib/users.js';
import { currentProfile, ROLE_LABEL } from '../lib/auth.js';
import { Icon, Sheet, toast } from './common.jsx';

const ROLE_HELP = {
  admin: 'Akses penuh: semua PT/estate, kelola PT, estate, dan pengguna.',
  supervisi: 'Melihat dan menilai semua PT dan estate/PKS. Tidak bisa menghapus penilaian atau mengelola PT/pengguna.',
  user: 'Menginput dan melihat hanya estate/PKS yang dipilih.',
  reader: 'Hanya melihat estate/PKS yang dipilih (tanpa input).',
};

export default function Users({ myUid }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(null);
  const load = async () => { setErr(''); try { setList(await listUsers()); } catch (e) { setErr(e.message); setList([]); } };
  useEffect(() => { load(); }, []);
  return (
    <section className="card" style={{ overflow: 'hidden' }}>
      <div className="set" style={{ paddingBottom: 6 }}>
        <h3>Kelola pengguna</h3>
        <p className="muted">Tambah akun baru, atur peran dan area, atau nonaktifkan akun. Perubahan berlaku setelah pengguna membuka ulang atau menekan Sinkronkan.</p>
      </div>
      {err && <div className="lrow"><span className="chip warn" style={{ whiteSpace: 'normal' }}>{err}</span><button className="btn alt sm" onClick={load}>Coba lagi</button></div>}
      {list === null && <div className="lrow"><span className="muted">Memuat…</span><span /></div>}
      {(list || []).map((u) => (
        <div className="lrow" key={u.uid}>
          <div>
            <b>{u.name || u.username || u.uid.slice(0, 8)}</b> <span className="chip off">{ROLE_LABEL[u.role] || u.role}</span>{u.active === false && <span className="chip warn"> nonaktif</span>}
            <div className="muted">{u.username ? `${u.username} · ` : ''}{u.role === 'user' || u.role === 'reader' ? (u.locs || []).join(', ') || 'tanpa area' : u.role === 'supervisi' ? 'semua area (lihat + nilai)' : 'semua area'}</div>
          </div>
          <button className="btn alt sm" onClick={() => setEdit({ ...u, locs: u.locs || [] })}>Ubah</button>
        </div>
      ))}
      <div className="lrow"><span /><button className="btn sm" onClick={() => setEdit({ isNew: true, username: '', name: '', password: '', role: 'user', locs: [], active: true })}>{Icon.plus}Tambah pengguna</button></div>
      {edit && <UserEdit u={edit} me={myUid} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </section>
  );
}

function UserEdit({ u, me, onClose, onSaved }) {
  const { pts, locations } = useStore();
  const [f, setF] = useState(u);
  const [busy, setBusy] = useState(false);
  const self = !f.isNew && f.uid === me;
  const toggle = (code) => setF({ ...f, locs: f.locs.includes(code) ? f.locs.filter((x) => x !== code) : [...f.locs, code] });
  async function save() {
    setBusy(true);
    try {
      if (f.isNew) await createUser(f);
      else {
        if ((f.role === 'user' || f.role === 'reader') && !f.locs.length) throw new Error('Pilih minimal satu estate/PKS');
        if (!String(f.name || '').trim()) throw new Error('Nama wajib diisi');
        await updateUser(f.uid, { ...f, name: f.name.trim() });
      }
      toast(f.isNew ? 'Pengguna ditambahkan' : 'Disimpan'); onSaved();
    } catch (e) { toast(e.message); }
    setBusy(false);
  }
  return (
    <Sheet title={f.isNew ? 'Tambah pengguna' : 'Ubah pengguna'} onClose={onClose}>
      {f.isNew && <label className="f">Nama pengguna (untuk login)<input className="in" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="mis. budi.bas" /></label>}
      <label className="f">Nama lengkap<input className="in" value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      {f.isNew && <label className="f">Kata sandi awal (min. 6 karakter)<input className="in" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoCapitalize="off" autoCorrect="off" spellCheck={false} /></label>}
      <label className="f">Peran
        <select className="in" value={f.role} disabled={self} onChange={(e) => setF({ ...f, role: e.target.value })}>
          {['user', 'reader', 'supervisi', 'admin'].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </label>
      <p className="muted" style={{ margin: 0 }}>{ROLE_HELP[f.role]}</p>
      {(f.role === 'user' || f.role === 'reader') && (
        <div className="f">Area (estate/PKS)
          {pts.map((p) => { const ls = locations.filter((l) => l.pt === p.code); return ls.length ? (
            <div key={p.code} style={{ marginTop: 6 }}><div className="muted">{p.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>{ls.map((l) => (
                <label key={l.code} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={f.locs.includes(l.code)} onChange={() => toggle(l.code)} />{l.name}</label>
              ))}</div></div>) : null; })}
        </div>
      )}
      {!f.isNew && <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}><input type="checkbox" checked={f.active !== false} disabled={self} onChange={(e) => setF({ ...f, active: e.target.checked })} />Akun aktif</label>}
      {self && <p className="muted" style={{ margin: 0 }}>Peran dan status akun Anda sendiri tidak bisa diubah di sini.</p>}
      <button className="btn go" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
      <button className="btn alt" onClick={onClose}>Batal</button>
    </Sheet>
  );
}

export const myUidOf = (session) => (session && session.uid) || null;
