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
// pembaruan dalam aplikasi: izin pasang APK + plugin native yang mengunduh APK lalu membuka pemasang
m = fs.readFileSync(mf, 'utf8');
if (!m.includes('REQUEST_INSTALL_PACKAGES')) {
  m = m.replace('<application', `<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
    <application`);
  fs.writeFileSync(mf, m);
}
const appId = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8')).appId;
const jdir = `${A}/src/main/java/${appId.replaceAll('.', '/')}`;
fs.mkdirSync(jdir, { recursive: true });
fs.writeFileSync(`${jdir}/MainActivity.java`, `package ${appId};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);
fs.writeFileSync(`${jdir}/ApkUpdaterPlugin.java`, `package ${appId};

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    @PluginMethod
    public void canInstall(PluginCall call) {
        boolean ok = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ok = getContext().getPackageManager().canRequestPackageInstalls();
        }
        JSObject r = new JSObject();
        r.put("allowed", ok);
        call.resolve(r);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void downloadAndInstall(final PluginCall call) {
        final String link = call.getString("url");
        if (link == null || link.length() == 0) {
            call.reject("URL kosong");
            return;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection c = null;
                try {
                    File dir = new File(getContext().getCacheDir(), "update");
                    if (!dir.exists()) dir.mkdirs();
                    File[] old = dir.listFiles();
                    if (old != null) {
                        for (File f : old) f.delete();
                    }
                    File part = new File(dir, "PenilaianGudang.part");
                    File apk = new File(dir, "PenilaianGudang.apk");
                    c = (HttpURLConnection) new URL(link).openConnection();
                    c.setConnectTimeout(20000);
                    c.setReadTimeout(30000);
                    c.setInstanceFollowRedirects(true);
                    c.setRequestProperty("User-Agent", "PenilaianGudang");
                    int code = c.getResponseCode();
                    if (code != 200) throw new Exception("Server membalas " + code);
                    int total = c.getContentLength();
                    InputStream in = c.getInputStream();
                    FileOutputStream out = new FileOutputStream(part);
                    byte[] buf = new byte[32768];
                    long got = 0;
                    int last = -1;
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        got += n;
                        if (total > 0) {
                            int p = (int) (got * 100L / total);
                            if (p != last) {
                                last = p;
                                JSObject e = new JSObject();
                                e.put("percent", p);
                                notifyListeners("progress", e);
                            }
                        }
                    }
                    out.close();
                    in.close();
                    if (got < 100000) throw new Exception("Berkas terlalu kecil, bukan APK");
                    if (total > 0 && got != total) throw new Exception("Unduhan tidak lengkap, coba lagi");
                    if (!part.renameTo(apk)) throw new Exception("Gagal menyimpan APK");
                    Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                    Intent i = new Intent(Intent.ACTION_VIEW);
                    i.setDataAndType(uri, "application/vnd.android.package-archive");
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(i);
                    call.resolve();
                } catch (Exception ex) {
                    call.reject(String.valueOf(ex.getMessage()));
                } finally {
                    if (c != null) c.disconnect();
                }
            }
        }).start();
    }
}
`);
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
