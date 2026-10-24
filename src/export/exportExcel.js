import { Workbook, ref } from './xlsx.js';
import { GRADES, GRADE, aspectsFor, computeScore, periodeLabel, MONTHS_SHORT, scoreToneHex as scoreTone } from '../lib/score.js';

const NAVY = '#0F253E', ORANGE = '#F79320', SOFT = '#FDE9D0';
const B = { border: 'thin', borderColor: '#9AA5B1' };

/**
 * entries: [{ insp, loc, pt }]  (lokasi yang dinilai pada periode ini)
 * records: semua rekaman (cloud+lokal) untuk sheet Tren: [{loc,locName,pt,ptName,periode,total}]
 */
export async function buildExcel({ periode, entries, records = [], title }) {
  const wb = new Workbook();
  const year = periode.slice(0, 4);
  const rekap = wb.addSheet('Rekap');
  const locSheets = [];

  // ---------- Sheet per lokasi (format sama dengan file monitoring) ----------
  for (const e of entries) {
    const { insp, loc, pt } = e;
    const sh = wb.addSheet(loc.code);
    sh.tab = ORANGE;
    const aspects = aspectsFor(loc);
    const N = aspects.reduce((s, a) => s + a.items.length, 0);
    sh.width(1, 30); sh.width(2, 78); [3, 4, 5, 6].forEach((c) => sh.width(c, 7)); sh.width(7, 46);

    sh.set(1, 1, 'FORMAT PENILAIAN GUDANG', { bold: true, size: 16, color: NAVY });
    const lab = { bold: true, color: NAVY };
    sh.set(3, 1, 'Tanggal', lab); sh.set(3, 2, insp.date || '', { h: 'left' });
    sh.set(4, 1, 'Estate', lab); sh.set(4, 2, loc.name, { h: 'left', bold: true });
    sh.set(5, 1, 'PT', lab); sh.set(5, 2, pt ? pt.name : '', { h: 'left' });
    sh.set(6, 1, 'Penilai', lab); sh.set(6, 2, insp.inspector || '', { h: 'left' });
    // legenda
    sh.set(3, 4, 'KATEGORI', { bold: true, bg: NAVY, color: '#FFFFFF', ...B }); sh.merge(3, 4, 3, 5);
    sh.set(3, 5, null, { bg: NAVY, ...B });
    sh.set(3, 6, 'NILAI', { bold: true, bg: NAVY, color: '#FFFFFF', h: 'center', ...B });
    GRADES.forEach((g, i) => {
      sh.set(4 + i, 4, g.label, B); sh.merge(4 + i, 4, 4 + i, 5); sh.set(4 + i, 5, null, B);
      sh.set(4 + i, 6, g.p, { h: 'center', bold: true, bg: g.color, color: g.ink, ...B });
    });
    // judul periode
    const r0 = 9;
    sh.set(r0, 1, `PERIODE ${periodeLabel(periode).toUpperCase()}`, { bold: true, bg: ORANGE, color: '#FFFFFF', h: 'center', ...B });
    sh.merge(r0, 1, r0, 7); for (let c = 2; c <= 7; c++) sh.set(r0, c, null, { bg: ORANGE, ...B });
    const hr = r0 + 1;
    sh.set(hr, 1, 'KOMPONEN', { bold: true, bg: NAVY, color: '#FFFFFF', h: 'center', ...B });
    sh.set(hr, 2, 'ITEM YANG DINILAI', { bold: true, bg: NAVY, color: '#FFFFFF', h: 'center', ...B });
    GRADES.forEach((g, i) => sh.set(hr, 3 + i, g.k, { bold: true, bg: g.color, color: g.ink, h: 'center', ...B }));
    sh.set(hr, 7, 'CATATAN', { bold: true, bg: NAVY, color: '#FFFFFF', h: 'center', ...B });
    sh.freeze = { r: hr + 1, c: 3 };

    let r = hr + 1;
    const first = r; const aspRows = [];
    for (const a of aspects) {
      const a0 = r;
      a.items.forEach((it, j) => {
        sh.set(r, 1, j === 0 ? a.name : null, { bold: true, wrap: true, v: 'top', h: 'left', bg: SOFT, ...B });
        sh.set(r, 2, `${j + 1}. ${it.text}`, { wrap: true, v: 'center', ...B });
        const g = insp.answers && insp.answers[it.id];
        GRADES.forEach((gr, k) => sh.set(r, 3 + k, g === gr.k ? 1 : null, { h: 'center', bold: true, numFmt: '"✓";;', ...B, ...(g === gr.k ? { bg: gr.color, color: gr.ink } : {}) }));
        sh.set(r, 7, (insp.notes && insp.notes[it.id]) || '', { wrap: true, v: 'center', size: 10, ...B });
        sh.height(r, Math.max(18, Math.ceil(it.text.length / 85) * 15 + 3));
        r++;
      });
      if (a.items.length > 1) sh.merge(a0, 1, r - 1, 1);
      aspRows.push([a, a0, r - 1]);
    }
    const last = r - 1;
    const sc = computeScore(insp.answers, loc);
    const sums = GRADES.map((g) => (insp.answers ? a_count(insp.answers, aspects, g.k) : 0));
    // TOTAL
    sh.set(r, 1, 'TOTAL', { bold: true, bg: NAVY, color: '#FFFFFF', ...B }); sh.set(r, 2, null, { bg: NAVY, ...B });
    GRADES.forEach((g, i) => {
      const col = String.fromCharCode(67 + i);
      sh.set(r, 3 + i, { f: `SUM(${col}${first}:${col}${last})*${g.p}`, v: sums[i] * g.p }, { bold: true, h: 'center', ...B });
    });
    sh.set(r, 7, null, B);
    const totRow = r; r++;
    const pts = sums.reduce((s, n, i) => s + n * GRADES[i].p, 0);
    sh.set(r, 1, 'NILAI', { bold: true, bg: ORANGE, color: '#FFFFFF', ...B });
    sh.set(r, 2, `Jumlah poin ÷ ${N} butir`, { italic: true, ...B });
    sh.set(r, 3, { f: `(C${totRow}+D${totRow}+E${totRow}+F${totRow})/${N}`, v: pts / N }, { bold: true, size: 14, h: 'center', numFmt: '0.00', ...B });
    sh.merge(r, 3, r, 6); [4, 5, 6].forEach((c) => sh.set(r, c, null, B)); sh.set(r, 7, null, B);
    const scoreRow = r; r += 2;
    // Tabel aspek
    sh.set(r, 1, 'ASPEK', { bold: true, bg: NAVY, color: '#FFFFFF', h: 'center', ...B });
    sh.set(r, 2, 'Uraian', { bold: true, bg: NAVY, color: '#FFFFFF', h: 'center', ...B });
    sh.set(r, 3, 'NILAI', { bold: true, bg: NAVY, color: '#FFFFFF', h: 'center', ...B }); sh.merge(r, 3, r, 4); sh.set(r, 4, null, { bg: NAVY, ...B });
    r++;
    const aspCell = {};
    for (const [a, a0, a1] of aspRows) {
      const f = `((SUM(C${a0}:C${a1})*5)+(SUM(D${a0}:D${a1})*4)+(SUM(E${a0}:E${a1})*3)+(SUM(F${a0}:F${a1})*2))/${a.items.length}`;
      const v = sc.aspects[a.id].avg;
      sh.set(r, 1, a.short, B); sh.set(r, 2, a.name, B);
      sh.set(r, 3, { f, v: v == null ? undefined : v }, { h: 'center', numFmt: '0.0', bold: true, ...B }); sh.merge(r, 3, r, 4); sh.set(r, 4, null, B);
      aspCell[a.id] = `C${r}`;
      r++;
    }
    sh.set(r + 1, 1, '* Tanda ✓ pada kolom SB / BA / S / BU menunjukkan penilaian tiap butir.', { italic: true, size: 9, color: '#555555' });
    locSheets.push({ e, sh, scoreRow, aspCell, sc, aspects });
  }

  // ---------- Rekap ----------
  {
    const sh = rekap; sh.tab = NAVY;
    const allAsp = aspectsFor({ pupuk: true });
    sh.set(1, 1, 'REKAP PENILAIAN GUDANG', { bold: true, size: 16, color: NAVY });
    sh.set(2, 1, `${title || ''} · Periode ${periodeLabel(periode)}`.replace(/^ · /, ''), { color: '#555555' });
    const hr = 4;
    const heads = ['PT', 'Lokasi gudang', ...allAsp.map((a) => a.short), 'NILAI'];
    heads.forEach((h, i) => sh.set(hr, 1 + i, h, { bold: true, bg: NAVY, color: '#FFFFFF', h: 'center', wrap: true, ...B }));
    sh.height(hr, 48); sh.width(1, 24); sh.width(2, 20); for (let c = 3; c <= heads.length; c++) sh.width(c, 14); sh.width(heads.length, 11);
    let r = hr + 1;
    for (const ls of locSheets) {
      const { e, sc } = ls; const q = `'${ls.sh.name}'!`;
      sh.set(r, 1, e.pt ? e.pt.name : '', { ...B, v: 'center' });
      sh.set(r, 2, e.loc.name, { bold: true, ...B });
      allAsp.forEach((a, i) => {
        const cell = ls.aspCell[a.id]; const v = cell ? sc.aspects[a.id].avg : null;
        const tone = scoreTone(v);
        sh.set(r, 3 + i, cell ? { f: `${q}${cell}`, v } : '–', { h: 'center', numFmt: '0.0', ...B, ...(cell && v != null ? { bg: tone.bg, color: tone.fg } : { color: '#999999' }) });
      });
      const tone = scoreTone(sc.total);
      sh.set(r, 3 + allAsp.length, { f: `${q}C${ls.scoreRow}`, v: sc.total }, { h: 'center', bold: true, numFmt: '0.00', size: 12, ...B, bg: tone.bg, color: tone.fg });
      r++;
    }
    sh.freeze = { r: hr + 1, c: 3 };
    // rata-rata
    if (locSheets.length > 1) {
      sh.set(r, 1, 'RATA-RATA', { bold: true, ...B, bg: SOFT }); sh.set(r, 2, null, { ...B, bg: SOFT });
      const lc = 3 + allAsp.length, c0 = ref(hr + 1, lc), c1 = ref(r - 1, lc);
      for (let c = 3; c < lc; c++) sh.set(r, c, null, { ...B, bg: SOFT });
      const m = locSheets.reduce((s, x) => s + x.sc.total, 0) / locSheets.length;
      sh.set(r, lc, { f: `AVERAGE(${c0}:${c1})`, v: m }, { h: 'center', bold: true, numFmt: '0.00', ...B, bg: SOFT });
    }
  }

  // ---------- Tren tahun berjalan ----------
  const yr = records.filter((x) => x.periode.startsWith(year));
  if (yr.length) {
    const sh = wb.addSheet(`Tren ${year}`); sh.tab = '#44668D';
    sh.set(1, 1, `TREN NILAI PER LOKASI ${year}`, { bold: true, size: 16, color: NAVY });
    const heads = ['PT', 'Lokasi', ...MONTHS_SHORT, 'RATA'];
    heads.forEach((h, i) => sh.set(3, 1 + i, h, { bold: true, bg: NAVY, color: '#FFFFFF', h: 'center', ...B }));
    sh.width(1, 24); sh.width(2, 18); for (let c = 3; c <= 15; c++) sh.width(c, 8.5);
    const locs = new Map();
    for (const x of yr) if (!locs.has(x.loc)) locs.set(x.loc, { name: x.locName || x.loc, ptName: x.ptName || x.pt || '' });
    let r = 4;
    for (const [code, info] of [...locs].sort((a, b) => (a[1].ptName + a[1].name).localeCompare(b[1].ptName + b[1].name))) {
      sh.set(r, 1, info.ptName, B); sh.set(r, 2, info.name, { bold: true, ...B });
      const vals = [];
      for (let m = 1; m <= 12; m++) {
        const rec = yr.find((x) => x.loc === code && x.periode === `${year}-${String(m).padStart(2, '0')}`);
        const v = rec ? rec.total : null; vals.push(v);
        const t = scoreTone(v);
        sh.set(r, 2 + m, v, { h: 'center', numFmt: '0.00', ...B, ...(v != null ? { bg: t.bg, color: t.fg } : {}) });
      }
      const ok = vals.filter((v) => v != null);
      sh.set(r, 15, ok.length ? { f: `AVERAGE(C${r}:N${r})`, v: ok.reduce((s, x) => s + x, 0) / ok.length } : null, { h: 'center', bold: true, numFmt: '0.00', ...B, bg: SOFT });
      r++;
    }
    sh.freeze = { r: 4, c: 3 };
  }
  return wb.toBlob();
}

function a_count(answers, aspects, k) {
  let n = 0; for (const a of aspects) for (const it of a.items) if (answers[it.id] === k) n++; return n;
}
