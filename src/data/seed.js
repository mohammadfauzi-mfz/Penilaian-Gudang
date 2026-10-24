// Data awal PT dan Estate/PKS. Admin bisa mengubah/menambah dari Pengaturan; hasilnya
// tersimpan di database (master/config) dan dipakai semua pengguna.
export const SEED_PTS = [
  { code: 'BPN', name: 'PT. Bima Palma Nugraha' },
  { code: 'BAS', name: 'PT. Bima Agri Sawit' },
  { code: 'DIL', name: 'PT. Dharma Intisawit Lestari' },
  { code: 'PUL', name: 'PT. Putra Utama Lestari' },
];

// pupuk=false -> aspek "Ketentuan penyimpanan pupuk" tidak dinilai (PKS)
export const SEED_LOCATIONS = [
  { code: 'TL1', name: 'TL1', pt: 'BPN', pupuk: true, active: true },
  { code: 'DP1', name: 'DP1', pt: 'BPN', pupuk: true, active: true },
  { code: 'SM1', name: 'SM1', pt: 'BPN', pupuk: true, active: true },
  { code: 'SM2', name: 'SM2', pt: 'BPN', pupuk: true, active: true },
  { code: 'KT1', name: 'KT1', pt: 'BPN', pupuk: true, active: true },
  { code: 'PKS9', name: 'PKS9', pt: 'BPN', pupuk: false, active: true },
  { code: 'BA1', name: 'BA1', pt: 'BAS', pupuk: true, active: true },
  { code: 'MB1', name: 'MB1', pt: 'BAS', pupuk: true, active: true },
  { code: 'PKS10', name: 'PKS10', pt: 'BAS', pupuk: false, active: true },
  { code: 'MSE', name: 'MSE', pt: 'DIL', pupuk: true, active: true },
  { code: 'KB1', name: 'KB1', pt: 'DIL', pupuk: true, active: true },
  { code: 'BR1', name: 'BR1', pt: 'PUL', pupuk: true, active: true },
];
