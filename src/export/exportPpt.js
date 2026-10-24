import PptxGenJS from 'pptxgenjs';
import { GRADES, GRADE, aspectsFor, computeScore, fmtAspect, fmtTotal, periodeLabel, scoreToneHex } from '../lib/score.js';

const C = { bg: 'F7F6F4', navy: '0F253E', orange: 'F79320', peach: 'FCD7AA', sand: 'DCD3CC', blue: 'AEC0D9', grey: '8A94A0', white: 'FFFFFF' };
const FONT = 'Arial';
const INTRO = [
  'Mewujudkan gudang yang memenuhi unsur 5R (Ringkas, Rapi, Resik, Rawat, Rajin) sehingga dapat meningkatkan efisiensi operasional, produktivitas, dan keselamatan kerja melalui penataan lingkungan yang terorganisir.',
  'Dengan penerapan SOP dan IK yang telah mengandung unsur 5R yang baik maka dapat menghilangkan pemborosan, mempermudah pencarian barang, menghilangkan resiko selisih stock barang, mencegah kerusakan barang, dan menciptakan budaya kerja disiplin serta menjamin keamanan dan keselamatan kerja.',
];

/**
 * entries: [{ loc, insp, photos: { itemId: { dataUrl, w, h } } }]
 * prev: { locCode: totalPeriodeLalu } (opsional)
 */
export async function buildPpt({ periode, ptName, entries, prev = {}, outputType = 'blob' }) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
  pptx.title = `Warehouse Performance Periode ${periodeLabel(periode)}`;
  pptx.author = 'Penilaian Gudang';
  const footer = `Warehouse Performance Periode ${periodeLabel(periode)}`;
  pptx.defineSlideMaster({
    title: 'ISI', background: { color: C.bg },
    objects: [{ text: { text: footer, options: { x: 0.5, y: 7.0, w: 6, h: 0.3, fontFace: FONT, fontSize: 8, color: C.navy } } }],
    slideNumber: { x: 12.3, y: 7.0, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 8, color: C.navy, align: 'right' },
  });
  pptx.defineSlideMaster({ title: 'COVER', background: { color: C.bg } });
  const HEX = pptx.ShapeType.hexagon;
  const hex = (s, x, y, w, o = {}) => s.addShape(HEX, { x, y, w, h: w * 0.866, fill: o.fill ? { color: o.fill } : { type: 'none' }, line: o.line ? { color: o.line, width: o.lw || 1.5 } : { type: 'none' }, ...(o.extra || {}) });
  const title = (s, t, o = {}) => s.addText(t, { x: 0.6, y: 0.7, w: 7, h: 0.9, fontFace: FONT, fontSize: 32, bold: true, color: C.navy, valign: 'middle', ...o });

  // 1. Cover
  {
    const s = pptx.addSlide({ masterName: 'COVER' });
    hex(s, 10.5, 0.9, 1.9, { line: '4A78C2', lw: 1 }); hex(s, 8.0, 3.3, 1.9, { fill: C.peach }); hex(s, 6.9, 4.9, 0.95, { fill: C.sand });
    s.addText('Warehouse\nPerformance\nPeriode ' + periodeLabel(periode), { x: 1.0, y: 1.5, w: 6.8, h: 2.7, fontFace: FONT, fontSize: 38, bold: true, color: C.navy, valign: 'top', lineSpacingMultiple: 0.95 });
    s.addShape(pptx.ShapeType.line, { x: 1.0, y: 4.75, w: 0, h: 0.5, line: { color: C.orange, width: 2 } });
    s.addText((ptName || '').toUpperCase(), { x: 1.15, y: 4.7, w: 6, h: 0.6, fontFace: FONT, fontSize: 18, color: C.navy, valign: 'middle' });
  }
  // 2. Introduction
  {
    const s = pptx.addSlide({ masterName: 'ISI' });
    title(s, 'Introduction'); hex(s, 8.4, 0.5, 1.2, { line: 'D9583B' });
    s.addText(INTRO.map((t, i) => ({ text: t, options: { breakLine: true, paraSpaceAfter: 12 } })), { x: 0.6, y: 2.0, w: 11.2, h: 3.6, fontFace: FONT, fontSize: 15, color: C.navy, valign: 'top', align: 'justify', lineSpacingMultiple: 1.15 });
    hex(s, 10.6, 4.9, 2.6, { fill: C.peach });
  }
  // 3. Unsur penilaian
  {
    const s = pptx.addSlide({ masterName: 'ISI' });
    hex(s, 0.6, 1.5, 3.8, { fill: C.peach }); hex(s, 3.0, 0.6, 1.3, { fill: C.blue }); hex(s, 0.5, 4.2, 1.5, { line: C.navy, lw: 1 });
    title(s, 'Unsur Penilaian', { x: 5.2, y: 1.2, w: 7, h: 0.7, fontSize: 28 });
    const asp = aspectsFor({ pupuk: entries.some((e) => e.loc.pupuk !== false) });
    s.addText(asp.map((a) => ({ text: a.name, options: { bullet: { type: 'number' }, breakLine: true, paraSpaceAfter: 6 } })), { x: 5.2, y: 2.1, w: 7.4, h: 3.8, fontFace: FONT, fontSize: 16, color: C.navy, valign: 'top' });
  }
  // 4. Bobot
  {
    const s = pptx.addSlide({ masterName: 'ISI' });
    title(s, 'Bobot Penilaian', { y: 0.5 });
    const hd = (t) => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.navy }, align: 'center', valign: 'middle', fontFace: FONT, fontSize: 14 } });
    const rows = [[hd('Kriteria'), hd('Singkatan'), hd('Point'), hd('Uraian')]];
    for (const g of GRADES) rows.push([
      { text: g.label, options: { bold: true, fontFace: FONT, fontSize: 14, color: C.navy, valign: 'middle' } },
      { text: g.k, options: { bold: true, align: 'center', valign: 'middle', fontFace: FONT, fontSize: 14, fill: { color: g.color }, color: g.k === 'S' ? '1A1A1A' : C.white } },
      { text: String(g.p), options: { align: 'center', valign: 'middle', fontFace: FONT, fontSize: 14, color: C.navy } },
      { text: g.desc, options: { fontFace: FONT, fontSize: 13, color: C.navy, valign: 'middle' } },
    ]);
    s.addTable(rows, { x: 0.6, y: 1.8, w: 12.1, colW: [2.2, 1.5, 1.1, 7.3], rowH: [0.55, 0.85, 0.85, 0.85, 0.85], border: { type: 'solid', pt: 1, color: C.orange }, fill: { color: C.white } });
  }
  // 5. Agenda (sarang lebah)
  {
    const s = pptx.addSlide({ masterName: 'ISI' });
    title(s, 'Penilaian\nGudang', { x: 0.7, y: 2.7, w: 4.8, h: 1.7, fontSize: 34 });
    hex(s, 0.7, 0.6, 1.6, { line: C.sand, lw: 1 });
    const n = entries.length, rows = 3, cols = Math.max(1, Math.ceil(n / rows));
    const w = Math.min(2.0, 6.9 / (0.75 * (cols - 1) + 1)), h = w * 0.866;
    const ox = 6.0, oy = 0.7;
    entries.forEach((e, i) => {
      const c = Math.floor(i / rows), r = i % rows;
      const x = ox + c * 0.75 * w, y = oy + r * h * 1.0 + (c % 2 ? h / 2 : 0);
      hex(s, x, y, w - 0.06, { fill: c % 2 ? 'FBBB77' : 'FACB96', line: C.bg, lw: 2 });
      s.addText(e.loc.name, { x: x + 0.1, y, w: w - 0.26, h, align: 'center', valign: 'middle', fontFace: FONT, fontSize: n > 9 ? 11 : 13, bold: true, color: C.navy, fit: 'shrink' });
    });
  }

  // Per lokasi
  const totals = [];
  for (const e of entries) {
    const { loc, insp, photos = {} } = e;
    const aspects = aspectsFor(loc);
    const sc = computeScore(insp.answers, loc);
    totals.push({ loc, total: sc.total });
    const shots = Object.values(photos).filter((p) => p && p.dataUrl).slice(0, 3);
    // Pembuka lokasi
    {
      const s = pptx.addSlide({ masterName: 'ISI' });
      s.addText(loc.name, { x: 0.8, y: 2.4, w: 6.8, h: 1.8, fontFace: FONT, fontSize: 60, bold: true, color: C.navy, valign: 'middle', fit: 'shrink' });
      if (shots.length) {
        const bw = 4.3, bh = 1.75;
        shots.forEach((p, i) => {
          const y = 0.55 + i * (bh + 0.12) + (3 - shots.length) * (bh + 0.12) / 2;
          s.addShape(pptx.ShapeType.rect, { x: 8.2, y, w: bw, h: bh, fill: { color: C.white }, line: { color: C.orange, width: 2.5 } });
          s.addImage({ data: p.dataUrl.replace(/^data:/, ''), x: 8.25, y: y + 0.05, w: bw - 0.1, h: bh - 0.1, sizing: { type: 'contain', w: bw - 0.1, h: bh - 0.1 } });
        });
      } else {
        hex(s, 8.4, 1.4, 4.4, { fill: C.peach, line: C.orange, lw: 3 });
      }
    }
    // Detail per aspek
    for (const a of aspects) {
      const chunks = [];
      for (let i = 0; i < a.items.length; i += 6) chunks.push(a.items.slice(i, i + 6));
      chunks.forEach((chunk, ci) => {
        const s = pptx.addSlide({ masterName: 'ISI' });
        s.addText(`Penilaian Gudang ${loc.name} - ${a.name}${chunks.length > 1 ? ` (${ci + 1}/${chunks.length})` : ''}`, { x: 0.45, y: 0.15, w: 12.4, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: C.navy, fit: 'shrink' });
        chunk.forEach((it, k) => {
          const col = Math.floor(k / 3), row = k % 3;
          const x0 = 0.45 + col * 6.4, y0 = 0.85 + row * 2.0;
          const ph = photos[it.id];
          s.addShape(pptx.ShapeType.rect, { x: x0, y: y0, w: 2.3, h: 1.8, fill: { color: ph ? C.white : 'ECEAE6' }, line: { color: ph ? C.sand : 'D5D1CA', width: 1 } });
          if (ph && ph.dataUrl) s.addImage({ data: ph.dataUrl.replace(/^data:/, ''), x: x0 + 0.04, y: y0 + 0.04, w: 2.22, h: 1.72, sizing: { type: 'contain', w: 2.22, h: 1.72 } });
          else s.addText('Tanpa foto', { x: x0, y: y0, w: 2.3, h: 1.8, align: 'center', valign: 'middle', fontFace: FONT, fontSize: 10, color: C.grey });
          const note = insp.notes && insp.notes[it.id];
          const runs = [{ text: it.text, options: { fontSize: 12, color: C.navy, breakLine: !!note } }];
          if (note) runs.push({ text: `Catatan: ${note}`, options: { fontSize: 9, italic: true, color: '5B6770' } });
          s.addText(runs, { x: x0 + 2.4, y: y0, w: 2.6, h: 1.8, fontFace: FONT, valign: 'middle', align: 'left', fit: 'shrink' });
          const g = GRADE[insp.answers && insp.answers[it.id]];
          const hx = x0 + 5.1;
          s.addShape(HEX, { x: hx, y: y0 + 0.5, w: 0.95, h: 0.82, fill: { color: g ? g.color : 'D5D1CA' }, line: { color: 'F9B36A', width: 2.25 } });
          s.addText(g ? g.k : '–', { x: hx, y: y0 + 0.5, w: 0.95, h: 0.82, align: 'center', valign: 'middle', fontFace: FONT, fontSize: 14, bold: true, color: g ? (g.k === 'S' ? '1A1A1A' : C.white) : C.grey });
        });
      });
    }
    // Rekap lokasi
    {
      const s = pptx.addSlide({ masterName: 'ISI' });
      s.addShape(pptx.ShapeType.rect, { x: 1.4, y: 0.7, w: 10.5, h: 0.95, fill: { color: C.bg }, line: { color: C.peach, width: 2 } });
      s.addText(`REKAP PENILAIAN GUDANG ${loc.name.toUpperCase()}`, { x: 1.4, y: 0.7, w: 10.5, h: 0.95, align: 'center', valign: 'middle', fontFace: FONT, fontSize: 28, bold: true, color: C.navy, fit: 'shrink' });
      const n = aspects.length, cw = 11.4 / n;
      const top = aspects.map((a) => { const v = sc.aspects[a.id].avg, t = scoreToneHex(v); return { text: fmtAspect(v), options: { bold: true, fontFace: FONT, fontSize: 20, align: 'center', valign: 'middle', color: t.fg.replace('#', ''), fill: { color: t.bg.replace('#', '') } } }; });
      const nm = aspects.map((a) => ({ text: a.name, options: { fontFace: FONT, fontSize: 11, align: 'center', valign: 'top', color: C.navy, fill: { color: C.white } } }));
      s.addTable([top, nm], { x: 0.95, y: 2.2, w: 11.4, colW: Array(n).fill(cw), rowH: [0.75, 1.9], border: { type: 'solid', pt: 1, color: C.orange } });
      s.addShape(pptx.ShapeType.rect, { x: 0.95, y: 5.2, w: 11.4, h: 1.0, fill: { color: C.white }, line: { color: C.orange, width: 2 } });
      s.addText(fmtTotal(sc.total), { x: 0.95, y: 5.2, w: 11.4, h: 1.0, align: 'center', valign: 'middle', fontFace: FONT, fontSize: 40, bold: true, color: C.navy });
      s.addText('Nilai total (rata-rata seluruh butir)', { x: 0.95, y: 6.25, w: 11.4, h: 0.3, align: 'center', fontFace: FONT, fontSize: 10, color: C.grey });
    }
  }

  // Summary
  {
    const s = pptx.addSlide({ masterName: 'ISI' });
    hex(s, 0.2, 3.8, 3.2, { fill: C.peach }); hex(s, 2.3, 5.0, 0.8, { fill: C.blue });
    title(s, 'Summary', { x: 0.7, y: 0.5, h: 0.8, fontSize: 30 });
    const withPrev = totals.some((t) => prev[t.loc.code] != null);
    const hd = (t, al = 'center') => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.orange }, align: al, valign: 'middle', fontFace: FONT, fontSize: 13 } });
    const rows = [[hd('LOKASI GUDANG', 'left'), hd('Nilai'), ...(withPrev ? [hd('Periode lalu'), hd('Selisih')] : [])]];
    totals.forEach((t, i) => {
      const f = { color: i % 2 ? C.white : 'FDEBD6' };
      const base = { fontFace: FONT, fontSize: 13, color: C.navy, valign: 'middle', fill: f };
      const p = prev[t.loc.code];
      const d = p != null && t.total != null ? t.total - p : null;
      rows.push([{ text: t.loc.name, options: { ...base } }, { text: fmtTotal(t.total), options: { ...base, align: 'center', bold: true } },
        ...(withPrev ? [{ text: p != null ? fmtTotal(p) : '–', options: { ...base, align: 'center' } },
          { text: d == null ? '–' : `${d > 0 ? '+' : ''}${d.toFixed(2)}`, options: { ...base, align: 'center', bold: true, color: d == null ? C.navy : d > 0.005 ? '1E8449' : d < -0.005 ? 'C0392B' : C.navy } }] : [])]);
    });
    const avg = totals.filter((t) => t.total != null);
    if (avg.length > 1) {
      const m = avg.reduce((a, t) => a + t.total, 0) / avg.length;
      const base = { fontFace: FONT, fontSize: 13, bold: true, color: C.navy, valign: 'middle', fill: { color: C.sand } };
      rows.push([{ text: 'RATA-RATA', options: base }, { text: fmtTotal(m), options: { ...base, align: 'center' } }, ...(withPrev ? [{ text: '', options: base }, { text: '', options: base }] : [])]);
    }
    const w = withPrev ? 8.6 : 6.4;
    s.addTable(rows, { x: 3.6, y: 1.7, w, colW: withPrev ? [3.8, 1.6, 1.7, 1.5] : [4.4, 2.0], rowH: 0.46, border: { type: 'solid', pt: 1, color: C.orange } });
  }
  // Penutup
  {
    const s = pptx.addSlide({ masterName: 'COVER' });
    hex(s, 9.4, 1.0, 2.6, { fill: C.peach }); hex(s, 8.4, 3.4, 1.2, { line: C.navy, lw: 1 }); hex(s, 11.6, 3.1, 0.9, { fill: C.blue });
    s.addText('Thank you', { x: 1.0, y: 2.6, w: 7, h: 1.6, fontFace: FONT, fontSize: 54, bold: true, color: C.navy, valign: 'middle' });
  }
  return pptx.write({ outputType });
}
