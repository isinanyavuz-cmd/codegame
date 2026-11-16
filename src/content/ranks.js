// Rütbeler: toplam yıldıza göre. Rota ekranı, sonuç kartı ve hangar kullanır.
export const RANKS = [[0, 'Çaylak Pilot'], [9, 'Pilot'], [24, 'Kıdemli Pilot'], [45, 'Kaptan'], [66, 'As Kaptan'], [120, 'Uzay Kaşifi'], [192, 'Galaksi Ustası']];

export const rankOf = (total) => RANKS.filter(([min]) => total >= min).pop()[1];
/** Sıradaki rütbe ve ona kalan yıldız; en üstteyse null. */
export function nextRank(total) {
  const next = RANKS.find(([min]) => total < min);
  return next ? { name: next[1], need: next[0] - total } : null;
}
