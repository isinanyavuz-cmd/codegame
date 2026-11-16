// Yan görevler: ana yolun dışındaki görevler. Her biri bir sektöre bağlıdır ve
// haritada o sektörün yolunun yanında durur. Türleri:
//   gizli   sektörün bütün yıldızları toplanınca açılır
//   catal   bir ana görevin öteki yolu; hangisi geçilirse sıradaki görev açılır
//   acil    bir görev bitince araya giren beklenmedik görev
// Alanları ana görevlerle aynıdır; ek olarak `extra` (tür), `after` (hangi ana görevin
// yanında durduğu) ve `open(store, levels)` (açık mı) taşırlar.
export const EXTRAS = [];

export const extraById = (id) => EXTRAS.find((l) => l.id === id);
export const extrasOf = (sectorId) => EXTRAS.filter((l) => l.sector === sectorId);
