import { useMemo, useState } from 'react';
import { index, avg } from '../lib/trend.js';
import { MONTHS_SHORT, MONTHS, scoreTone, fmtTotal, fmtAspect, aspectsFor, prevPeriode, periodeLabel } from '../lib/score.js';

const PAL = ['#0072B2', '#E69F00', '#009E73', '#D55E00', '#CC79A7', '#56B4E9', '#6B4E9B', '#8A9A1B', '#B8860B', '#555555', '#E4572E', '#1B9AAA'];

export default function TrendView({ records }) {
  const idx = useMemo(() => index(records), [records]);
  const years = idx.years.length ? idx.years : [String(new Date().getFullYear())];
  const [year, setYear] = useState(years[years.length - 1]);
  const [pt, setPt] = useState('*');
  const [off, setOff] = useState({});
  const pts = useMemo(() => [...new Map(idx.locs.map((l) => [l.pt, l.ptName || l.pt])).entries()], [idx]);
  const locs = idx.locs.filter((l) => pt === '*' || l.pt === pt).sort((a, b) => (a.pt + a.name).localeCompare(b.pt + b.name));
  const color = (code) => PAL[idx.locs.findIndex((l) => l.code === code) % PAL.length];

  const periodes = useMemo(() => {
    const s = new Set(); for (const l of locs) for (const p of Object.keys(idx.byLoc[l.code] || {})) if (p.startsWith(year)) s.add(p);
    return [...s].sort();
  }, [idx, locs, year]);
  const [sel, setSel] = useState(null);
  const cur = periodes.includes(sel) ? sel : periodes[periodes.length - 1];

  if (!records.length) return <div className="card empty"><b>Belum ada data penilaian</b><span>Selesaikan penilaian lalu sinkronkan, atau impor data historis dari Pengaturan.</span></div>;

  const val = (code, p) => (idx.byLoc[code] && idx.byLoc[code][p] ? idx.byLoc[code][p].total : null);
  const rows = locs.map((l) => ({ l, v: cur ? val(l.code, cur) : null, pv: cur ? val(l.code, prevPeriode(cur)) : null })).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  const meanNow = avg(rows.map((r) => r.v)), meanPrev = avg(rows.filter((r) => r.pv != null).map((r) => r.pv));
  const meanPrevSame = avg(rows.filter((r) => r.pv != null).map((r) => r.v));

  return (
    <>
      <div className="seg" role="group" aria-label="Tahun">
        {years.map((y) => <button key={y} aria-pressed={y === year} onClick={() => setYear(y)}>{y}</button>)}
        <span style={{ width: 8 }} />
        <button aria-pressed={pt === '*'} onClick={() => setPt('*')}>Semua PT</button>
        {pts.map(([c, n]) => <button key={c} aria-pressed={pt === c} onClick={() => setPt(c)}>{c}</button>)}
      </div>

      {cur && (
        <div className="kpis">
          <div className="card kpi"><span className="k">Rata-rata {periodeLabel(cur)}</span><span className="v">{fmtTotal(meanNow)}</span>
            <span className="s">{meanPrev != null && meanPrevSame != null ? <Delta d={meanPrevSame - meanPrev} /> : 'Belum ada pembanding'}</span></div>
          <div className="card kpi"><span className="k">Tertinggi</span><span className="v">{rows[0] ? rows[0].l.name : '–'}</span><span className="s">{rows[0] ? fmtTotal(rows[0].v) : ''}</span></div>
          <div className="card kpi"><span className="k">Terendah</span><span className="v">{rows.length ? rows[rows.length - 1].l.name : '–'}</span><span className="s">{rows.length ? fmtTotal(rows[rows.length - 1].v) : ''}</span></div>
        </div>
      )}

      <div className="sec-h"><span>Tren nilai per lokasi, {year}</span></div>
      <div className="lgd seg" style={{ marginBottom: -4 }}>
        {locs.map((l) => <button key={l.code} style={{ '--c': color(l.code) }} aria-pressed={!off[l.code]} onClick={() => setOff({ ...off, [l.code]: !off[l.code] })}><i />{l.name}</button>)}
      </div>
      <LineChart year={year} locs={locs.filter((l) => !off[l.code])} val={val} color={color} />

      {cur && (
        <>
          <div className="sec-h"><span>Peringkat</span>
            <select className="in" style={{ width: 'auto', minHeight: 36, padding: '4px 10px' }} value={cur} onChange={(e) => setSel(e.target.value)} aria-label="Periode">
              {periodes.map((p) => <option key={p} value={p}>{periodeLabel(p)}</option>)}
            </select></div>
          <div className="card rank">
            {rows.map((r) => (
              <div className="rk" key={r.l.code}>
                <span className="nm">{r.l.name}</span>
                <span className="tr"><i style={{ width: `${((r.v - 2) / 3) * 100}%`, background: scoreTone(r.v).bg }} /></span>
                <span className="v">{fmtTotal(r.v)}</span>
                <span className="d"><DeltaCell d={r.pv != null ? r.v - r.pv : null} /></span>
              </div>
            ))}
            {!rows.length && <span className="muted">Tidak ada data pada periode ini.</span>}
          </div>
        </>
      )}

      <div className="sec-h"><span>Nilai bulanan {year}</span></div>
      <div className="card tblwrap" style={{ padding: 8 }}>
        <table className="hm">
          <thead><tr><th className="l">Lokasi</th>{MONTHS_SHORT.map((m) => <th key={m}>{m}</th>)}<th>RATA</th></tr></thead>
          <tbody>
            {locs.map((l) => {
              const vs = MONTHS_SHORT.map((_, i) => val(l.code, `${year}-${String(i + 1).padStart(2, '0')}`));
              const a = avg(vs);
              return (
                <tr key={l.code}>
                  <td className="l">{l.name}</td>
                  {vs.map((v, i) => { const t = scoreTone(v); return v == null ? <td key={i} className="none">·</td> : <td key={i} style={{ background: t.bg, color: t.fg }}>{fmtTotal(v)}</td>; })}
                  <td style={{ background: '#f1f3f6' }}>{a != null ? fmtTotal(a) : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cur && <AspectTable idx={idx} locs={locs} cur={cur} />}
    </>
  );
}

function Delta({ d }) {
  if (Math.abs(d) < 0.005) return <span className="d eq">Sama dengan bulan lalu</span>;
  return <span className={`d ${d > 0 ? 'up' : 'dn'}`}>{d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(2)} dari bulan lalu</span>;
}
function DeltaCell({ d }) {
  if (d == null) return <span className="d eq">–</span>;
  if (Math.abs(d) < 0.005) return <span className="d eq">=</span>;
  return <span className={`d ${d > 0 ? 'up' : 'dn'}`}>{d > 0 ? '▲' : '▼'}{Math.abs(d).toFixed(2)}</span>;
}

function AspectTable({ idx, locs, cur }) {
  const asp = aspectsFor({ pupuk: true });
  const data = locs.map((l) => ({ l, r: idx.byLoc[l.code] && idx.byLoc[l.code][cur] })).filter((x) => x.r);
  if (!data.length) return null;
  return (
    <>
      <div className="sec-h"><span>Nilai per aspek, {periodeLabel(cur)}</span></div>
      <div className="card tblwrap" style={{ padding: 8 }}>
        <table className="hm">
          <thead><tr><th className="l">Lokasi</th>{asp.map((a) => <th key={a.id} title={a.name}>{a.short.split(' ').slice(0, 2).join(' ')}</th>)}</tr></thead>
          <tbody>
            {data.map(({ l, r }) => (
              <tr key={l.code}><td className="l">{l.name}</td>
                {asp.map((a) => { const v = r.aspects && r.aspects[a.id]; const t = scoreTone(v); return v == null ? <td key={a.id} className="none">–</td> : <td key={a.id} style={{ background: t.bg, color: t.fg }}>{fmtAspect(v)}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LineChart({ year, locs, val, color }) {
  const W = 720, H = 300, L = 44, R = 38, T = 14, B = 28;
  const x = (i) => L + (i * (W - L - R)) / 11, y = (v) => T + ((5 - v) * (H - T - B)) / 3;
  const [hov, setHov] = useState(null);
  const series = locs.map((l) => ({ l, pts: MONTHS_SHORT.map((_, i) => val(l.code, `${year}-${String(i + 1).padStart(2, '0')}`)) }));
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHov(Math.max(0, Math.min(11, Math.round(((px - L) / (W - L - R)) * 11))));
  };
  const tipItems = hov == null ? [] : series.filter((s) => s.pts[hov] != null).sort((a, b) => b.pts[hov] - a.pts[hov]);
  const tipLeft = hov == null ? 0 : (x(hov) / W) * 100;
  return (
    <div className="card chartbox">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Grafik tren nilai ${year}`} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHov(null)}>
        {[2, 3, 4, 5].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="#E1E6EC" />
            <text x={L - 8} y={y(g) + 4} textAnchor="end" fontSize="12" fill="#6b7a8c">{g}</text>
            <text x={W - R + 6} y={y(g) + 4} fontSize="11" fill="#9aa5b1" fontWeight="700">{['', '', 'BU', 'S', 'BA', 'SB'][g]}</text>
          </g>
        ))}
        {MONTHS_SHORT.map((m, i) => <text key={m} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11.5" fill="#6b7a8c">{m}</text>)}
        {hov != null && <line x1={x(hov)} x2={x(hov)} y1={T} y2={H - B} stroke="#0F253E" strokeOpacity=".25" />}
        {series.map(({ l, pts }) => {
          const c = color(l.code); let d = '', pen = false;
          pts.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
          return (
            <g key={l.code}>
              <path d={d} fill="none" stroke={c} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((v, i) => v != null && <circle key={i} cx={x(i)} cy={y(v)} r={hov === i ? 4.5 : 3} fill="#fff" stroke={c} strokeWidth="2" />)}
            </g>
          );
        })}
      </svg>
      {hov != null && tipItems.length > 0 && (
        <div className="tip" style={tipLeft > 55 ? { right: `${100 - tipLeft + 2}%` } : { left: `${tipLeft + 2}%` }}>
          <b>{MONTHS[hov]} {year}</b>
          {tipItems.map(({ l, pts }) => <div key={l.code}><span><i style={{ background: color(l.code) }} />{l.name}</span><span>{fmtTotal(pts[hov])}</span></div>)}
        </div>
      )}
    </div>
  );
}
