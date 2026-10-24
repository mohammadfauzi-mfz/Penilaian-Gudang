// Build web app + dashboard ke folder www/ memakai esbuild.
// TEST_STUBS=1 -> pakai stub plugin native (untuk uji di browser/desktop).
import { build } from 'esbuild';
import { mkdirSync, copyFileSync, rmSync, readFileSync, writeFileSync } from 'node:fs';

const stubs = process.env.TEST_STUBS === '1';
const out = process.env.OUT_DIR || 'www';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const alias = stubs
  ? {
      '@capacitor/core': './test/stubs/core.js',
      '@capacitor/camera': './test/stubs/camera.js',
      '@capacitor/filesystem': './test/stubs/filesystem.js',
      '@capacitor/share': './test/stubs/share.js',
    }
  : {};

await build({
  entryPoints: { app: 'src/main.jsx', dashboard: 'src/dashboard.jsx' },
  bundle: true,
  outdir: out,
  format: 'iife',
  target: ['chrome90'],
  jsx: 'automatic',
  loader: { '.json': 'json' },
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: !stubs,
  sourcemap: stubs,
  alias,
  logLevel: 'info',
});

const ver = JSON.parse(readFileSync('package.json', 'utf8')).version;
for (const f of ['index.html', 'dashboard.html']) {
  writeFileSync(`${out}/${f}`, readFileSync(`web/${f}`, 'utf8').replaceAll('__VERSION__', ver));
}
copyFileSync('web/icon.svg', `${out}/icon.svg`);
console.log('Build selesai ->', out);
