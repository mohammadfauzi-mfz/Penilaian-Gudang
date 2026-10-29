// Dijalankan di CI setelah `npx cap add android`: izin kamera, ikon, dan tanda tangan tetap.
import fs from 'node:fs';
import path from 'node:path';
const A = 'android/app';
const mf = `${A}/src/main/AndroidManifest.xml`;
let m = fs.readFileSync(mf, 'utf8');
if (!m.includes('android.permission.CAMERA')) {
  m = m.replace('<application',
    `<uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <queries><intent><action android:name="android.media.action.IMAGE_CAPTURE" /></intent></queries>
    <application`);
  fs.writeFileSync(mf, m);
}
// ikon: pakai PNG lama di semua versi Android
const res = `${A}/src/main/res`;
fs.rmSync(`${res}/mipmap-anydpi-v26`, { recursive: true, force: true });
for (const d of fs.readdirSync('android-res')) {
  fs.mkdirSync(`${res}/${d}`, { recursive: true });
  for (const f of fs.readdirSync(`android-res/${d}`)) fs.copyFileSync(`android-res/${d}/${f}`, `${res}/${d}/${f}`);
}
// tanda tangan tetap supaya APK baru bisa menimpa versi lama
const gf = `${A}/build.gradle`;
let g = fs.readFileSync(gf, 'utf8');
if (!g.includes('signingConfigs')) {
  const ver = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
  const run = process.env.GITHUB_RUN_NUMBER || '1';
  g = g.replace(/android\s*\{/, `android {
    signingConfigs {
        pg {
            storeFile file("${path.resolve('keystore/release.keystore').replaceAll('\\', '/')}")
            storePassword "penilaiangudang"
            keyAlias "pg"
            keyPassword "penilaiangudang"
        }
    }`);
  g = g.replace(/buildTypes\s*\{\s*release\s*\{/, 'buildTypes {\n        release {\n            signingConfig signingConfigs.pg');
  g = g.replace(/versionCode\s+\d+/, `versionCode ${run}`).replace(/versionName\s+"[^"]*"/, `versionName "${ver}"`);
  fs.writeFileSync(gf, g);
}
console.log('Patch Android selesai');
