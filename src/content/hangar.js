// Hangar: geminin görünümü. Parçalar toplam yıldızla açılır; seçim kayıtta `ship` alanında durur.
// Saf veri ve mantık; DOM yok.

/** Her parçanın seçenekleri. `need`: açılması için gereken toplam yıldız. */
export const PARTS = {
  hull: {
    label: 'Gövde',
    options: [
      { id: 'kar', name: 'Kar Beyazı', color: '#dfe6f3', need: 0 },
      { id: 'gece', name: 'Gece Mavisi', color: '#4a6cf0', need: 6 },
      { id: 'nane', name: 'Nane', color: '#7be0c3', need: 15 },
      { id: 'gunes', name: 'Güneş', color: '#ffd53d', need: 30 },
      { id: 'lila', name: 'Lila', color: '#b79cff', need: 51 },
      { id: 'komur', name: 'Kömür', color: '#39425f', need: 84 },
      { id: 'altin', name: 'Altın', color: '#f2b632', need: 150 },
    ],
  },
  accent: {
    label: 'Şerit',
    options: [
      { id: 'turuncu', name: 'Turuncu', color: '#ff6a2b', need: 0 },
      { id: 'kirmizi', name: 'Kırmızı', color: '#ff3b5c', need: 3 },
      { id: 'camgobegi', name: 'Camgöbeği', color: '#2fc8ff', need: 12 },
      { id: 'yesil', name: 'Yeşil', color: '#37e39a', need: 24 },
      { id: 'pembe', name: 'Pembe', color: '#ff7ad9', need: 42 },
      { id: 'beyaz', name: 'Beyaz', color: '#ffffff', need: 72 },
    ],
  },
  flame: {
    label: 'Alev',
    options: [
      { id: 'mavi', name: 'Mavi', color: '#49c8ff', need: 0 },
      { id: 'yesil', name: 'Yeşil', color: '#4cffa4', need: 9 },
      { id: 'mor', name: 'Mor', color: '#b58cff', need: 21 },
      { id: 'turuncu', name: 'Turuncu', color: '#ff9a3c', need: 36 },
      { id: 'pembe', name: 'Pembe', color: '#ff6ad5', need: 60 },
    ],
  },
  // bolt: küçük lazerin mermisi, beam: şarjlı lazerin ışını (3B sahnedeki renkler)
  laser: {
    label: 'Lazer',
    options: [
      { id: 'kizil', name: 'Kızıl', color: '#ff3b5c', bolt: 0xff3b5c, beam: 0xa16bff, need: 0 },
      { id: 'zumrut', name: 'Zümrüt', color: '#37e39a', bolt: 0x37e39a, beam: 0x2fd6a0, need: 10 },
      { id: 'buz', name: 'Buz Mavisi', color: '#49c8ff', bolt: 0x49c8ff, beam: 0x3d7bff, need: 27 },
      { id: 'altin', name: 'Altın', color: '#ffc83d', bolt: 0xffc83d, beam: 0xff9a3c, need: 54 },
      { id: 'gokkusagi', name: 'Pembe Nova', color: '#ff6ad5', bolt: 0xff6ad5, beam: 0xd04bff, need: 96 },
    ],
  },
  // wing: kanat açıklığı, nose: gövde boyu çarpanı
  shape: {
    label: 'Biçim',
    options: [
      { id: 'klasik', name: 'Klasik', wing: 1, nose: 1, need: 0 },
      { id: 'ok', name: 'Ok', wing: 0.8, nose: 1.16, need: 18 },
      { id: 'kartal', name: 'Kartal', wing: 1.2, nose: 0.92, need: 45 },
    ],
  },
};
export const PART_KEYS = Object.keys(PARTS);

/** Kayıttaki seçimden geçerli görünümü çıkarır; seçilmemiş ya da henüz açılmamış parça ilk seçeneğe döner. */
export function lookOf(ship = {}, total = Infinity) {
  const look = {};
  for (const key of PART_KEYS) {
    const options = PARTS[key].options, picked = options.find((o) => o.id === ship[key]);
    look[key] = picked && picked.need <= total ? picked : options[0];
  }
  return look;
}

/** Toplam yıldız `before`dan `after`a çıkınca açılan parçalar: [{ key, label, option }] */
export function unlockedBetween(before, after) {
  const out = [];
  for (const key of PART_KEYS) for (const option of PARTS[key].options) if (option.need > before && option.need <= after) out.push({ key, label: PARTS[key].label, option });
  return out;
}

/** Açılmayı bekleyen en yakın parça ve ona kalan yıldız; hepsi açıksa null. */
export function nextUnlock(total) {
  const locked = PART_KEYS.flatMap((key) => PARTS[key].options.filter((o) => o.need > total).map((option) => ({ key, label: PARTS[key].label, option })));
  locked.sort((a, b) => a.option.need - b.option.need);
  return locked.length ? { ...locked[0], need: locked[0].option.need - total } : null;
}
