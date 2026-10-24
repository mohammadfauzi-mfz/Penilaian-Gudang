/**
 * Penilaian Gudang - layanan foto ke Google Drive (Google Apps Script).
 * Deploy sebagai Web app: Execute as = Me, Who has access = Anyone.
 * Isi Script properties (Project Settings > Script properties):
 *   API_KEY    = Web API key Firebase (sama dengan di aplikasi)
 *   PROJECT_ID = Project ID Firebase
 *   ROOT_FOLDER_ID (opsional) = ID folder Drive tujuan; kosong = dibuat otomatis "Penilaian Gudang - Foto"
 * Keamanan: setiap permintaan harus membawa ID token Firebase yang valid. Peran/area dibaca dari
 * Firestore memakai token pengguna itu sendiri, jadi aturan Firestore tetap berlaku.
 */
var P = PropertiesService.getScriptProperties();

function doGet() { return out_({ ok: true, msg: 'Layanan foto Penilaian Gudang aktif' }); }

function doPost(e) {
  try {
    var q = JSON.parse(e.postData.contents);
    var uid = verify_(q.idToken);
    if (q.action === 'put') return out_(put_(q, uid));
    if (q.action === 'get') return out_(get_(q));
    return out_({ ok: false, error: 'Aksi tidak dikenal' });
  } catch (err) { return out_({ ok: false, error: String(err && err.message || err) }); }
}

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function fs_(path, token) {
  return UrlFetchApp.fetch('https://firestore.googleapis.com/v1/projects/' + P.getProperty('PROJECT_ID') + '/databases/(default)/documents/' + path,
    { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
}

function verify_(token) {
  if (!token) throw new Error('Belum login');
  var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + P.getProperty('API_KEY'), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: token }), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Token tidak valid');
  return JSON.parse(r.getContentText()).users[0].localId;
}

function profile_(uid, token) {
  var r = fs_('users/' + encodeURIComponent(uid), token);
  if (r.getResponseCode() !== 200) throw new Error('Akun belum diberi akses');
  var f = JSON.parse(r.getContentText()).fields || {};
  var vals = (f.locs && f.locs.arrayValue && f.locs.arrayValue.values) || [];
  return {
    role: f.role ? f.role.stringValue : 'none',
    active: !f.active || f.active.booleanValue !== false,
    locs: vals.map(function (v) { return v.stringValue; })
  };
}

function folder_(parent, name) {
  name = String(name || '-').replace(/[\\\/:*?"<>|]/g, '_').substring(0, 80);
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function root_() {
  var id = P.getProperty('ROOT_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  var it = DriveApp.getFoldersByName('Penilaian Gudang - Foto');
  var f = it.hasNext() ? it.next() : DriveApp.createFolder('Penilaian Gudang - Foto');
  P.setProperty('ROOT_FOLDER_ID', f.getId());
  return f;
}

function put_(q, uid) {
  var p = profile_(uid, q.idToken);
  var ok = p.active && (p.role === 'admin' || (p.role === 'user' && p.locs.indexOf(q.loc) >= 0));
  if (!ok) throw new Error('Tidak berhak mengunggah foto untuk ' + q.loc);
  if (!q.data || q.data.length > 8 * 1024 * 1024) throw new Error('Data foto tidak valid atau terlalu besar');
  var dir = folder_(folder_(folder_(root_(), q.ptName || q.pt), q.locName || q.loc), q.periode);
  var name = q.inspId + '_' + q.itemId + '_' + Date.now() + '.jpg';
  var file = dir.createFile(Utilities.newBlob(Utilities.base64Decode(q.data), 'image/jpeg', name));
  return { ok: true, id: file.getId() };
}

function get_(q) {
  // boleh mengunduh hanya bila pengguna berhak membaca penilaiannya (aturan Firestore) dan file tercatat di sana
  var r = fs_('inspections/' + encodeURIComponent(q.inspId), q.idToken);
  if (r.getResponseCode() !== 200) throw new Error('Tidak berhak melihat penilaian ini');
  var f = JSON.parse(r.getContentText()).fields || {};
  var m = f.photos && f.photos.mapValue && f.photos.mapValue.fields;
  if (!m || !m[q.itemId] || m[q.itemId].stringValue !== q.fileId) throw new Error('Foto tidak terdaftar');
  var blob = DriveApp.getFileById(q.fileId).getBlob();
  return { ok: true, data: Utilities.base64Encode(blob.getBytes()) };
}
