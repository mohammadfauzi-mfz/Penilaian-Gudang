import { useEffect, useState } from 'react';
import TrendView from './TrendView.jsx';
import { loadRecords } from '../lib/trend.js';
import { isConfigured } from '../lib/sync.js';
import { useStore } from '../lib/store.js';
import { Icon } from './common.jsx';

export default function Tren() {
  const { inspections } = useStore();
  const [st, setSt] = useState({ records: [], loading: true, error: null, remote: 0 });
  const load = async () => { setSt((s) => ({ ...s, loading: true })); const r = await loadRecords(); setSt({ ...r, loading: false }); };
  useEffect(() => { load(); }, [inspections]);
  return (
    <>
      <header className="topbar"><div className="row"><h1>Tren nilai<small>{isConfigured() ? (st.loading ? 'Memuat dari database…' : `Database + data lokal`) : 'Data lokal (database belum diatur)'}</small></h1>
        <button className="iconbtn" onClick={load} aria-label="Muat ulang">{Icon.sync}</button></div></header>
      <main className="page"><div className="wrap">
        {st.error && <div className="chip warn" style={{ justifySelf: 'start', whiteSpace: 'normal' }}>Database tidak terjangkau: {st.error}. Menampilkan data lokal.</div>}
        <TrendView records={st.records} />
      </div></main>
    </>
  );
}
