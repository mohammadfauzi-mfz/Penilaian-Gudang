import CRITERIA from '../data/criteria.json';

export const GRADES = [
  { k: 'SB', p: 5, label: 'Sangat Baik', color: '#0070C0', ink: '#fff', desc: 'Telah mengikuti semua arahan sesuai SOP dan IK' },
  { k: 'BA', p: 4, label: 'Baik', color: '#00B050', ink: '#fff', desc: 'Telah mengikuti semua arahan sesuai SOP dan IK dan masih perlu penyempurnaan' },
  { k: 'S', p: 3, label: 'Sedang', color: '#FFFF00', ink: '#1a1a1a', desc: 'Terdapat beberapa kondisi yang tidak mengikuti sesuai SOP dan IK' },
  { k: 'BU', p: 2, label: 'Buruk', color: '#FF0000', ink: '#fff', desc: 'Tidak mengikuti sesuai SOP dan IK' },
];
export const GRADE = Object.fromEntries(GRADES.map((g) => [g.k, g]));
export const PUPUK_ASPECT_ID = 8;

/** Daftar aspek (beserta butir) yang berlaku untuk sebuah lokasi. */
export function aspectsFor(loc) {
  const noPupuk = loc && loc.pupuk === false;
  return CRITERIA.filter((a) => !(noPupuk && a.id === PUPUK_ASPECT_ID));
}
export function itemCount(loc) {
  return aspectsFor(loc).reduce((s, a) => s + a.items.length, 0);
}

/** Hitung skor. total = rata-rata poin seluruh butir terjawab (sama dengan rumus Excel: jumlah poin / jumlah butir). */
export function computeScore(answers, loc) {
  const aspects = {};
  let sum = 0, cnt = 0, n = 0;
  for (const a of aspectsFor(loc)) {
    let s = 0, c = 0;
    for (const it of a.items) {
      n++;
      const g = GRADE[answers && answers[it.id]];
      if (g) { s += g.p; c++; }
    }
    aspects[a.id] = { avg: c ? s / c : null, count: c, n: a.items.length };
    sum += s; cnt += c;
  }
  return { total: cnt ? sum / cnt : null, count: cnt, n, aspects };
}

/** Skor aspek/total: 1 desimal untuk aspek ("3", "2.3"), 2 desimal untuk total ("2.98"). */
export function fmtAspect(v) {
  if (v == null) return '–';
  return String(Math.round(v * 10) / 10);
}
export function fmtTotal(v) {
  if (v == null) return '–';
  return (Math.round(v * 100) / 100).toFixed(2);
}

export const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
export const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGU','SEP','OKT','NOV','DES'];
export function periodeLabel(p) { // '2026-07' -> 'Juli 2026'
  const [y, m] = p.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
export function currentPeriode(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function prevPeriode(p) {
  let [y, m] = p.split('-').map(Number);
  m -= 1; if (m === 0) { m = 12; y -= 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** Warna sel skor (2..5) untuk heatmap: merah -> kuning -> hijau -> biru, selaras warna nilai di PPT. */
export function scoreTone(v) {
  if (v == null) return { bg: 'transparent', fg: 'inherit' };
  const stops = [[2, [217, 56, 41]], [3, [250, 204, 21]], [4, [64, 176, 108]], [5, [0, 112, 192]]];
  const x = Math.max(2, Math.min(5, v));
  let i = 0;
  while (i < stops.length - 2 && x > stops[i + 1][0]) i++;
  const [a, ca] = stops[i], [b, cb] = stops[i + 1];
  const t = (x - a) / (b - a);
  const c = ca.map((q, k) => Math.round(q + (cb[k] - q) * t));
  const lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  return { bg: `rgb(${c.join(',')})`, fg: lum > 0.6 ? '#1a1a1a' : '#fff' };
}

/** Seperti scoreTone tetapi dalam hex (#RRGGBB) untuk Excel / PowerPoint. */
export function scoreToneHex(v) {
  const t = scoreTone(v);
  if (v == null) return { bg: '#FFFFFF', fg: '#1A1A1A' };
  const m = t.bg.match(/\d+/g).map(Number);
  return { bg: '#' + m.map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase(), fg: t.fg === '#fff' ? '#FFFFFF' : '#1A1A1A' };
}
