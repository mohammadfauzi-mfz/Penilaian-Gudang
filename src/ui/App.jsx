import { useEffect, useState } from 'react';
import Home from './Home.jsx';
import Form from './Form.jsx';
import { History, Detail } from './History.jsx';
import Tren from './Tren.jsx';
import Settings from './Settings.jsx';
import ShareSheet from './ShareSheet.jsx';
import { Icon, ToastHost, SyncBar } from './common.jsx';
import { currentPeriode } from '../lib/score.js';
import { fullSync } from '../lib/sync.js';
import { useAuth, canInput } from '../lib/auth.js';
import { Login, Denied } from './Login.jsx';

const TABS = [['nilai', 'Nilai', Icon.clipboard], ['riwayat', 'Riwayat', Icon.history], ['tren', 'Tren', Icon.trend], ['atur', 'Atur', Icon.gear]];

export default function App() {
  const [tab, setTab] = useState('nilai');
  const [periode, setPeriode] = useState(currentPeriode());
  const [route, setRoute] = useState(null); // {t:'form',loc,periode} | {t:'detail',id}
  const [shareReq, setShareReq] = useState(null);
  const { mode } = useAuth();

  // tombol Kembali Android: gunakan history agar layar form/detail tertutup lebih dulu
  useEffect(() => {
    const pop = () => setRoute((history.state && history.state.route) || null);
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const go = (r) => { history.pushState({ route: r }, ''); setRoute(r); };
  const back = () => { if (history.state && history.state.route) history.back(); else setRoute(null); };

  useEffect(() => { if (mode !== 'in' && mode !== 'local') return; const f = () => fullSync().catch(() => {}); f(); window.addEventListener('online', f); return () => window.removeEventListener('online', f); }, [mode]);

  const share = (ids, p) => setShareReq({ ids, periode: p });
  if (mode === 'login') return <><Login /><ToastHost /></>; // tanpa SyncBar: belum ada data
  if (mode === 'denied') return <><Denied /><ToastHost /></>;

  let body;
  if (route && route.t === 'form' && canInput(route.loc)) body = <Form key={route.loc + route.periode} locCode={route.loc} periode={route.periode} onClose={back} />;
  else if (route && route.t === 'detail') body = <Detail id={route.id} onBack={back} canEdit={canInput} edit={(l, p) => { history.replaceState({ route: { t: 'form', loc: l, periode: p } }, ''); setRoute({ t: 'form', loc: l, periode: p }); }} share={share} />;
  else body = (
    <div className="shell">
      {tab === 'nilai' && <Home periode={periode} setPeriode={setPeriode} openForm={(loc) => go({ t: 'form', loc, periode })} openDetail={(id) => go({ t: 'detail', id })} share={share} />}
      {tab === 'riwayat' && <History openDetail={(id) => go({ t: 'detail', id })} />}
      {tab === 'tren' && <Tren />}
      {tab === 'atur' && <Settings />}
      <nav className="tabbar" aria-label="Menu utama">
        {TABS.map(([k, t, ic]) => <button key={k} className="tab" aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>{ic}{t}</button>)}
      </nav>
    </div>
  );
  return <><SyncBar />{body}{shareReq && <ShareSheet ids={shareReq.ids} periode={shareReq.periode} onClose={() => setShareReq(null)} />}<ToastHost /></>;
}
