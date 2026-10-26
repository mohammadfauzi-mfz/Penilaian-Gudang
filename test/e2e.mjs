// Uji ujung-ke-ujung di Chromium (mock Firebase lokal). Jalankan: node test/e2e.mjs <wwwDir> <outDir>
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const [www, out, photosDir] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

// ---- mock Firebase (meniru aturan: admin semua; supervisi baca semua; user hanya estate miliknya) ----
const docs = new Map(); let master = null; const driveFiles = new Map();
const S = (v) => ({ stringValue: v });
const A = (arr) => ({ arrayValue: { values: arr.map(S) } });
const users = {
  U1: { name: S('Admin Pusat'), role: S('admin'), locs: A([]) },
  U2: { name: S('Budi BAS'), role: S('user'), locs: A(['BA1', 'MB1']) },
  U3: { name: S('Pak Supervisi'), role: S('supervisi'), locs: A([]) },
  U5: { name: S('Rina Reader'), role: S('reader'), locs: A(['MB1']) },
};
const accounts = { 'admin@pg.local': ['pw1', 'U1'], 'budi@pg.local': ['pw2', 'U2'], 'sup@pg.local': ['pw3', 'U3'], 'baru@pg.local': ['pw4', 'U4'], 'rd@pg.local': ['pw5', 'U5'] };
const roleOf = (uid) => (users[uid] ? users[uid].role.stringValue : null);
const locsOf = (uid) => (users[uid] ? users[uid].locs.arrayValue.values.map((v) => v.stringValue) : []);
const mock = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*'); res.setHeader('Access-Control-Allow-Methods', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  let body = ''; req.on('data', (c) => (body += c));
  req.on('end', () => {
    const u = new URL(req.url, 'http://x'); const j = (o, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const bad = (m, s = 400) => j({ error: { message: m } }, s);
    if (u.pathname === '/v1/accounts:signInWithPassword') {
      const q = JSON.parse(body); const a = accounts[q.email];
      if (!a || a[0] !== q.password) return bad('INVALID_LOGIN_CREDENTIALS');
      return j({ idToken: 'T-' + a[1], refreshToken: 'R-' + a[1], expiresIn: '3600', localId: a[1] });
    }
    if (u.pathname === '/repos/acme/pg/releases/latest') return j({ tag_name: 'build-5', name: 'Build 5', body: 'Perbaikan tampilan', assets: [{ name: 'PenilaianGudang.apk', browser_download_url: 'http://localhost:8097/dl.apk' }] });
    if (u.pathname === '/drive') { // tiruan Google Apps Script
      if (req.method === 'GET') return j({ ok: true, msg: 'aktif' });
      const q = JSON.parse(body); const mm = String(q.idToken || '').match(/^T-(.+)$/); const uid0 = mm && mm[1];
      if (!uid0 || !roleOf(uid0)) return j({ ok: false, error: 'Token tidak valid' });
      if (q.action === 'put') {
        if (!(roleOf(uid0) === 'admin' || roleOf(uid0) === 'supervisi' || (roleOf(uid0) === 'user' && locsOf(uid0).includes(q.loc)))) return j({ ok: false, error: 'Tidak berhak' });
        const id = 'F' + (driveFiles.size + 1); driveFiles.set(id, q.data); return j({ ok: true, id });
      }
      const d = docs.get(q.inspId); const ph = d && d.photos && d.photos.mapValue.fields;
      if (!d || !(roleOf(uid0) !== 'user' || locsOf(uid0).includes(d.loc.stringValue)) || !ph || !ph[q.itemId] || ph[q.itemId].stringValue !== q.fileId) return j({ ok: false, error: 'Foto tidak terdaftar' });
      return j({ ok: true, data: driveFiles.get(q.fileId) });
    }
    if (u.pathname === '/v1/accounts:signUp') {
      const q = JSON.parse(body); if (accounts[q.email]) return bad('EMAIL_EXISTS');
      if (q.password.length < 6) return bad('WEAK_PASSWORD');
      const id = 'U' + (Object.keys(accounts).length + 10); accounts[q.email] = [q.password, id]; return j({ localId: id });
    }
    if (u.pathname === '/v1/token') { const r = new URLSearchParams(body).get('refresh_token'); return j({ id_token: 'T-' + r.slice(2), refresh_token: r, expires_in: '3600' }); }
    const m0 = (req.headers.authorization || '').match(/^Bearer T-(.+)$/);
    if (!m0) return bad('unauth', 401);
    const uid = m0[1], role = roleOf(uid), locs = locsOf(uid);
    const deny = () => bad('Missing or insufficient permissions.', 403);
    if (/\/documents\/users$/.test(u.pathname) && req.method === 'GET') {
      if (role !== 'admin') return deny();
      return j({ documents: Object.entries(users).map(([id, f]) => ({ name: `projects/p/databases/(default)/documents/users/${id}`, fields: f })) });
    }
    const um = u.pathname.match(/\/documents\/users\/(.+)$/);
    if (um && req.method === 'PATCH') { if (role !== 'admin') return deny(); users[decodeURIComponent(um[1])] = JSON.parse(body).fields; return j({ name: um[1] }); }
    if (um) { if (um[1] !== uid || !users[uid]) return users[um[1]] ? deny() : bad('NOT_FOUND', 404); return j({ name: 'users/' + uid, fields: users[uid] }); }
    if (/\/documents\/master\/config$/.test(u.pathname)) {
      if (!role) return deny();
      if (req.method === 'GET') return master ? j({ name: 'master/config', fields: master }) : bad('NOT_FOUND', 404);
      if (role !== 'admin') return deny();
      master = JSON.parse(body).fields; return j({ name: 'master/config' });
    }
    if (u.pathname.endsWith('/documents:runQuery')) {
      const f = JSON.parse(body).structuredQuery.where.fieldFilter; const want = f.value.stringValue;
      if ((role === 'user' || role === 'reader') && !locs.includes(want)) return deny();
      if (!role) return deny();
      const out = [...docs.entries()].filter(([, v]) => v.loc.stringValue === want).map(([id, v]) => ({ document: { name: `projects/p/databases/(default)/documents/inspections/${id}`, fields: v } }));
      return j(out.length ? out : [{ readTime: 'x' }]);
    }
    const m = u.pathname.match(/\/documents\/inspections(?:\/(.+))?$/);
    if (!m || !role) return role ? bad('nf', 404) : deny();
    if (req.method === 'GET') {
      if (role === 'user' || role === 'reader') return deny();
      return j({ documents: [...docs.entries()].map(([id, f]) => ({ name: `projects/p/databases/(default)/documents/inspections/${id}`, fields: f })) });
    }
    const id = decodeURIComponent(m[1] || '');
    if (req.method === 'PATCH') {
      const fields = JSON.parse(body).fields;
      if (role === 'reader' || (role === 'user' && !locs.includes(fields.loc.stringValue))) return deny();
      docs.set(id, fields); return j({ name: id });
    }
    if (req.method === 'DELETE') { const d = docs.get(id); if (role === 'supervisi' || role === 'reader' || (role === 'user' && d && !locs.includes(d.loc.stringValue))) return deny(); docs.delete(id); return j({}); }
    j({}, 405);
  });
}).listen(8097);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.map': 'application/json' };
const stat = http.createServer((req, res) => {
  let p = new URL(req.url, 'http://x').pathname; if (p === '/') p = '/index.html';
  const f = path.join(www, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(8098);

const cfg = { apiKey: 'K', projectId: 'p', authBase: 'http://localhost:8097', tokenBase: 'http://localhost:8097', fsBase: 'http://localhost:8097' };
const br = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
page.on('dialog', (d) => d.accept());
const step = (s) => console.log('•', s);
const shot = (n) => page.screenshot({ path: path.join(out, n + '.png') });

await page.addInitScript(() => { localStorage.setItem('pg.ghApi', 'http://localhost:8097'); localStorage.setItem('pg.forceUpdateCheck', '1'); });
await page.addInitScript((c) => { if (!localStorage.getItem('pg.settings')) localStorage.setItem('pg.settings', JSON.stringify({ firebase: c, inspector: 'Budi Penilai' })); }, cfg);
await page.goto('http://localhost:8098/');
await page.waitForSelector('form');
await page.locator('input[autocomplete=username]').fill('admin'); await page.locator('input[type=password]').fill('salah');
await page.getByRole('button', { name: 'Masuk', exact: true }).click();
await page.waitForSelector('[role=alert]'); step('login salah: ' + await page.locator('[role=alert]').textContent());
await page.locator('input[type=password]').fill('pw1');
await page.getByRole('button', { name: 'Masuk', exact: true }).click();
await page.waitForSelector('.loc');
await page.waitForTimeout(500);
await page.waitForSelector('text=Versi baru tersedia', { timeout: 5000 });
step('BANNER update: ' + (await page.locator('[role=status]', { hasText: 'Versi baru' }).innerText()).replace(/\n+/g, ' | '));
await page.screenshot({ path: path.join(out, '18-update.png') });
const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 4000 }).catch(() => null), page.getByRole('button', { name: 'Perbarui', exact: true }).click()]);
step('klik Perbarui membuka: ' + (popup ? popup.url() : 'TIDAK ADA')); if (popup) await popup.close();
step('master di database setelah admin login: ' + (master ? 'ada' : 'TIDAK ADA'));
await shot('01-home');
step('home ok, lokasi: ' + (await page.locator('.loc').count()));

// impor data historis
await page.getByText('Atur', { exact: true }).click();
await page.getByRole('button', { name: /Impor \d+ penilaian/ }).click();
await page.waitForTimeout(300);
await shot('02-settings');
step('impor ok: ' + (await page.locator('.toast').textContent()));
await page.getByRole('button', { name: /Sinkronkan/ }).click();
await page.waitForFunction(() => !document.querySelector('.toast') || /Terkirim|Gagal|sudah/.test(document.querySelector('.toast').textContent), null, { timeout: 15000 });
await page.waitForTimeout(500);
step('sinkron: ' + (await page.locator('.toast').textContent().catch(() => '')) + ' | mock docs=' + docs.size);

// riwayat
await page.getByText('Riwayat', { exact: true }).click();
await page.waitForSelector('.hrow');
step('riwayat rows: ' + (await page.locator('.hrow').count()));

// tren
await page.getByText('Tren', { exact: true }).click();
await page.waitForSelector('table.hm');
await page.waitForTimeout(600);
await shot('03-tren-top');
await page.evaluate(() => document.querySelector('.page').scrollTo(0, 700));
await shot('04-tren-mid');
await page.evaluate(() => document.querySelector('.page').scrollTo(0, 1600));
await shot('05-tren-bottom');

// form penilaian baru: BAAY periode 2026-10
await page.getByText('Nilai', { exact: true }).click();
await page.locator('input[type=month]').fill('2026-10');
await page.locator('.loc', { hasText: 'BA1' }).click();
await page.waitForSelector('.aspect');
const grades = ['S', 'BU', 'BA', 'SB'];
const items = page.locator('.item');
// buka semua aspek
await page.evaluate(() => document.querySelectorAll('details.aspect').forEach((d) => (d.open = true)));
const n = await page.locator('.item').count();
step('butir di form BAAY: ' + n);
for (let i = 0; i < n; i++) {
  const g = grades[(i * 7 + (i >> 2)) % 4];
  await page.locator('.item').nth(i).locator(`.g[data-k="${g}"]`).click();
}
// foto untuk 8 butir pertama
const files = fs.readdirSync(photosDir).filter((f) => f.endsWith('.jpg')).sort();
for (let i = 0; i < 8; i++) {
  await page.locator('.item').nth(i).locator('.thumb').click();
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Pilih dari galeri/ }).click()]);
  await fc.setFiles(path.join(photosDir, files[i % files.length]));
  await page.waitForSelector('.sheet', { state: 'detached' });
}
// catatan
await page.locator('.item').nth(0).getByRole('button', { name: /Catatan/ }).click();
await page.locator('.item').nth(0).locator('textarea').fill('Lantai berdebu di lorong A');
await page.evaluate(() => document.querySelector('.page').scrollTo(0, 0));
await shot('06-form-top');
await page.evaluate(() => document.querySelector('.page').scrollTo(0, 500));
await shot('07-form-items');
step('skor di form: ' + (await page.locator('.scorebar .score-hex').textContent()));
await page.getByRole('button', { name: 'Tandai selesai' }).click();
await page.waitForSelector('.loc');
await page.waitForTimeout(1200);
step('selesai; mock docs=' + docs.size + ' toast=' + (await page.locator('.toast').textContent().catch(() => '')));
await shot('08-home-after');

// bagikan (BAS periode 2026-10 -> BAAY saja) dari beranda
await page.getByRole('button', { name: /Bagikan/ }).first().click();
await page.waitForSelector('.sheet');
await shot('09-share');
const dls = [];
page.on('download', (d) => dls.push(d));
await page.getByRole('button', { name: /^Bagikan$/ }).click();
await page.waitForFunction(() => !document.querySelector('.sheet'), null, { timeout: 60000 });
await page.waitForTimeout(800);
for (const d of dls) { const f = path.join(out, d.suggestedFilename()); await d.saveAs(f); step('unduhan: ' + f + ' ' + fs.statSync(f).size); }

// periode Juli 2026 untuk PT BAS (3 lokasi) bagikan
await page.locator('input[type=month]').fill('2026-07');
await page.waitForTimeout(300);
await shot('10-home-jul');
const btns = page.getByRole('button', { name: /Bagikan \d/ });
step('tombol bagikan ptblock: ' + await btns.count());
for (let b = 0; b < await btns.count(); b++) {
  await btns.nth(b).click();
  await page.waitForSelector('.sheet');
  const t = await page.locator('.sheet .muted').first().textContent();
  step('share scope: ' + t);
  if (/Bima Agri/.test(t)) {
    await page.getByRole('button', { name: /^Bagikan$/ }).click();
    await page.waitForFunction(() => !document.querySelector('.sheet'), null, { timeout: 60000 });
    await page.waitForTimeout(800);
    break;
  }
  await page.getByRole('button', { name: 'Batal' }).click();
}
for (const d of dls.slice(2)) { const f = path.join(out, 'JUL_' + d.suggestedFilename()); await d.saveAs(f); step('unduhan: ' + f + ' ' + fs.statSync(f).size); }

// admin: aktifkan foto ke Google Drive (tiruan Apps Script), lalu sinkron
await page.getByText('Atur', { exact: true }).click();
await page.locator('input[placeholder^="https://script.google.com"]').fill('http://localhost:8097/drive');
await page.getByRole('button', { name: 'Simpan dan uji' }).click(); await page.waitForTimeout(800);
step('toast drive: ' + await page.locator('.toast').textContent().catch(() => ''));
await page.getByRole('button', { name: /Sinkronkan/ }).click(); await page.waitForTimeout(2500);
const ph = [...docs.values()].find((d) => d.loc.stringValue === 'BA1' && d.periode.stringValue === '2026-10');
step('foto di Drive (tiruan): ' + driveFiles.size + ' file; doc BA1 mencatat ' + Object.keys(ph.photos.mapValue.fields || {}).length + ' foto');
// admin: tambah PT & estate baru, ubah master, lalu cek Tentang aplikasi
await page.getByText('Atur', { exact: true }).click();
await page.getByRole('button', { name: /Tambah PT/ }).click();
await page.locator('.sheet input').nth(0).fill('PXY'); await page.locator('.sheet input').nth(1).fill('PT. Contoh Area Baru');
await page.locator('.sheet .btn.go').click(); await page.waitForTimeout(500);
await page.getByRole('button', { name: /Tambah estate\/PKS/ }).click();
await page.locator('.sheet input').nth(0).fill('XY1'); await page.locator('.sheet input').nth(1).fill('XY1');
await page.locator('.sheet select').selectOption('PXY');
await page.locator('.sheet .btn.go').click(); await page.waitForTimeout(600);
const mpts = JSON.stringify(master).includes('PT. Contoh Area Baru') && JSON.stringify(master).includes('XY1');
step('master memuat PT & estate baru: ' + mpts);
await page.getByRole('button', { name: /Tambah pengguna/ }).click();
await page.locator('.sheet input').nth(0).fill('andi.mb'); await page.locator('.sheet input').nth(1).fill('Andi MB');
await page.locator('.sheet input').nth(2).fill('rahasia1');
await page.locator('.sheet label', { hasText: 'MB1' }).locator('input').check();
await page.locator('.sheet .btn.go').click(); await page.waitForTimeout(700);
step('pengguna baru di database: ' + JSON.stringify(Object.values(users).filter((x) => x.username && x.username.stringValue === 'andi.mb').map((x) => [x.role.stringValue, x.locs.arrayValue.values.map((v) => v.stringValue)])) + ' | daftar: ' + (await page.locator('.lrow', { hasText: 'Andi MB' }).count()));
await page.getByText('Tentang aplikasi').click();
const about = await page.locator('.sheet').innerText();
step('tentang: ' + about.replace(/\n+/g, ' | '));
await page.screenshot({ path: path.join(out, '12-about.png') });
await page.locator('.scrim').click({ position: { x: 5, y: 5 } });
await page.getByText('Nilai', { exact: true }).click();
step('lokasi admin di beranda: ' + await page.locator('.loc').count() + ' (harus 13)');
await page.screenshot({ path: path.join(out, '13-admin-home.png') });

// ===== PENILAI (budi): hanya BA1 & MB1 =====
// (foto BA1 dari HP lain harus ikut turun lewat Drive)
async function loginAs(user, pw, vp = { width: 390, height: 844 }) {
  const c = await br.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: vp.width < 600, hasTouch: vp.width < 600 });
  const pg = await c.newPage();
  pg.on('pageerror', (e) => errs.push('PAGEERROR(' + user + ') ' + e.message));
  pg.on('dialog', (d) => d.accept());
  await pg.addInitScript((c0) => { if (!localStorage.getItem('pg.settings')) localStorage.setItem('pg.settings', JSON.stringify({ firebase: c0 })); }, cfg);
  return { c, pg, user, pw };
}
async function doLogin(h, url = 'http://localhost:8098/') {
  await h.pg.goto(url); await h.pg.waitForSelector('form');
  await h.pg.locator('input[autocomplete=username]').fill(h.user); await h.pg.locator('input[type=password]').fill(h.pw);
  await h.pg.getByRole('button', { name: 'Masuk', exact: true }).click();
}
const b = await loginAs('budi', 'pw2');
await doLogin(b);
await b.pg.waitForSelector('.loc'); await b.pg.waitForTimeout(1200);
const bNames = await b.pg.locator('.loc h3').allTextContents();
step('PENILAI lokasi terlihat: ' + bNames.join(','));
step('PENILAI grup PT: ' + (await b.pg.locator('.sec-h span').allTextContents()).join(' | '));
await b.pg.screenshot({ path: path.join(out, '14-user-home.png') });
await b.pg.locator('.loc', { hasText: 'BA1' }).click(); await b.pg.waitForSelector('.aspect'); await b.pg.waitForTimeout(2500);
step('PENILAI buka form BA1: foto terunduh dari Drive = ' + await b.pg.locator('.thumb[style*="background-image"]').count());
await b.pg.goBack(); await b.pg.waitForSelector('.loc');
// riwayat terisi dari database (tarik), hanya BA1/MB1
await b.pg.getByText('Riwayat', { exact: true }).click(); await b.pg.waitForSelector('.hrow');
const hn = await b.pg.locator('.hrow b').allTextContents();
step('PENILAI riwayat: ' + hn.length + ' baris, lokasi unik: ' + [...new Set(hn)].join(','));
await b.pg.getByText('Tren', { exact: true }).click(); await b.pg.waitForSelector('table.hm'); await b.pg.waitForTimeout(500);
step('PENILAI baris tren: ' + (await b.pg.locator('table.hm tbody tr').allTextContents()).map((t) => t.slice(0, 6)).join(' / '));
await b.pg.screenshot({ path: path.join(out, '15-user-tren.png') });
await b.pg.getByText('Atur', { exact: true }).click();
step('PENILAI menu kelola PT terlihat: ' + await b.pg.getByText('Kelola PT').count() + ' | akun: ' + (await b.pg.locator('section.set').first().innerText()).replace(/\n+/g, ' | '));
await b.pg.screenshot({ path: path.join(out, '16-user-settings.png') });
// penilai menilai MB1 lalu kirim: harus berhasil; tulis ke estate lain ditolak server (uji langsung)
const deniedWrite = await b.pg.evaluate(async () => {
  const t = JSON.parse(localStorage.getItem('pg.session')); const r = await fetch('http://localhost:8097/v1/token?key=K', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + t.refreshToken }); const tk = (await r.json()).id_token;
  const w = await fetch('http://localhost:8097/v1/projects/p/databases/(default)/documents/inspections/TL1_x', { method: 'PATCH', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { loc: { stringValue: 'TL1' } } }) });
  const l = await fetch('http://localhost:8097/v1/projects/p/databases/(default)/documents/inspections', { headers: { Authorization: 'Bearer ' + tk } });
  return [w.status, l.status];
});
step('PENILAI tulis TL1 -> ' + deniedWrite[0] + ', list semua -> ' + deniedWrite[1] + ' (harus 403, 403)');
await b.c.close();

// pengguna yang dibuat admin dari aplikasi bisa login & hanya melihat MB1
const an = await loginAs('andi.mb', 'rahasia1'); await doLogin(an); await an.pg.waitForSelector('.loc'); await an.pg.waitForTimeout(800);
step('USER BARU (dibuat dari app) lokasi: ' + (await an.pg.locator('.loc h3').allTextContents()).join(',')); await an.c.close();

// ===== SUPERVISI =====
const sv = await loginAs('sup', 'pw3');
await doLogin(sv); await sv.pg.waitForSelector('.loc'); await sv.pg.waitForTimeout(1200);
step('SUPERVISI jumlah lokasi: ' + await sv.pg.locator('.loc').count() + ', bisa dinilai (tombol aktif): ' + await sv.pg.locator('.loc:not([disabled])').count());
await sv.pg.locator('.loc', { hasText: 'MSE' }).click(); await sv.pg.waitForSelector('.aspect');
await sv.pg.locator('.item').first().locator('.g[data-k="SB"]').click();
step('SUPERVISI buka form MSE (estate lain): tombol selesai=' + await sv.pg.getByRole('button', { name: 'Tandai selesai' }).count());
await sv.pg.getByRole('button', { name: 'Simpan draf' }).click(); await sv.pg.waitForTimeout(500);
await sv.pg.getByText('Riwayat', { exact: true }).click(); await sv.pg.waitForSelector('.hrow');
await sv.pg.locator('.hrow').first().click(); await sv.pg.waitForTimeout(300);
step('SUPERVISI detail: Ubah=' + await sv.pg.getByRole('button', { name: 'Ubah', exact: true }).count() + ', Hapus=' + await sv.pg.getByRole('button', { name: /Hapus/ }).count() + ' (Hapus harus 0)');
const svw = await sv.pg.evaluate(async () => {
  const t = JSON.parse(localStorage.getItem('pg.session')); const r = await fetch('http://localhost:8097/v1/token?key=K', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + t.refreshToken }); const tk = (await r.json()).id_token;
  const base = 'http://localhost:8097/v1/projects/p/databases/(default)/documents/';
  const w = await fetch(base + 'inspections/TL1_zz', { method: 'PATCH', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { loc: { stringValue: 'TL1' } } }) });
  const d = await fetch(base + 'inspections/TL1_zz', { method: 'DELETE', headers: { Authorization: 'Bearer ' + tk } });
  return [w.status, d.status];
});
step('SUPERVISI tulis TL1 -> ' + svw[0] + ' (harus 200), hapus -> ' + svw[1] + ' (harus 403)');
await sv.c.close();

// ===== READER: hanya lihat MB1 =====
const rd = await loginAs('rd', 'pw5'); await doLogin(rd); await rd.pg.waitForSelector('.loc'); await rd.pg.waitForTimeout(1200);
step('READER lokasi: ' + (await rd.pg.locator('.loc h3').allTextContents()).join(',') + ' | tombol input aktif: ' + await rd.pg.locator('.loc:not([disabled]) .chip.off').count());
await rd.pg.locator('input[type=month]').fill('2026-07'); await rd.pg.waitForTimeout(300);
await rd.pg.locator('.loc:not([disabled])').first().click(); await rd.pg.waitForTimeout(300);
step('READER detail MB1: tombol Ubah=' + await rd.pg.getByRole('button', { name: 'Ubah', exact: true }).count() + ', Hapus=' + await rd.pg.getByRole('button', { name: /Hapus/ }).count());
await rd.pg.goBack(); await rd.pg.getByText('Tren', { exact: true }).click(); await rd.pg.waitForSelector('table.hm');
step('READER baris tren: ' + (await rd.pg.locator('table.hm tbody tr').allTextContents()).map((t) => t.slice(0, 4)).join('/'));
const rdw = await rd.pg.evaluate(async () => {
  const t = JSON.parse(localStorage.getItem('pg.session')); const r = await fetch('http://localhost:8097/v1/token?key=K', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + t.refreshToken }); const tk = (await r.json()).id_token;
  const h = { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }; const base = 'http://localhost:8097/v1/projects/p/databases/(default)/documents/';
  const w = await fetch(base + 'inspections/MB1_x', { method: 'PATCH', headers: h, body: JSON.stringify({ fields: { loc: { stringValue: 'MB1' } } }) });
  const q = await fetch(base.slice(0, -1) + ':runQuery', { method: 'POST', headers: h, body: JSON.stringify({ structuredQuery: { where: { fieldFilter: { value: { stringValue: 'TL1' } } } } }) });
  return [w.status, q.status];
});
step('READER tulis MB1 -> ' + rdw[0] + ', baca TL1 -> ' + rdw[1] + ' (harus 403, 403)');
await rd.c.close();

// ===== AKUN TANPA PROFIL =====
const nb = await loginAs('baru', 'pw4'); await doLogin(nb); await nb.pg.waitForSelector('text=belum diberi akses', { timeout: 8000 });
step('AKUN tanpa profil: layar akses ditolak'); await nb.c.close();

// dashboard web (admin login)
const dh = await loginAs('admin', 'pw1', { width: 1200, height: 900 });
await doLogin(dh, 'http://localhost:8098/dashboard.html');
await dh.pg.waitForSelector('table.hm', { timeout: 10000 }); await dh.pg.waitForTimeout(500);
await dh.pg.screenshot({ path: path.join(out, '11-dashboard.png'), fullPage: true });
step('dashboard ok');
console.log('ERRORS:', JSON.stringify(errs, null, 1));
await br.close(); mock.close(); stat.close();
