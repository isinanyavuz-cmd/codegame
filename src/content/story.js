// Oyunun anlatı metinleri: görev sonu kancaları ve yakın hedefler.
// (Sektör hikâyeleri ve mürettebat da burada toplanır.)
import { nextRank } from './ranks.js';

const KIND_TEASER = {
  tanis: 'yeni bir şey öğreneceksin',
  dene: 'yarım kalmış bir program seni bekliyor',
  pekistir: 'bu kez programı sıfırdan sen yazacaksın',
  hata: 'bozuk bir program var; hatayı sen bulacaksın',
  final: 'sektör finali!',
};

/** Sonuç kartındaki "sırada ne var" cümlesi. */
export const teaser = (next) => (next ? `Sırada **${next.title}**: ${KIND_TEASER[next.kind] || 'yeni bir görev'}.` : '');

/**
 * Çocuğa en yakın hedefi söyler: sektörün bitmesine az kaldıysa onu, yoksa yeni rütbeyi.
 * @param total      toplam yıldız
 * @param leftInSector bu sektörde henüz geçilmemiş görev sayısı
 */
export function nearGoal({ total, leftInSector, sectorName }) {
  const rank = nextRank(total);
  if (leftInSector > 0 && leftInSector <= 2) return leftInSector === 1 ? `**${sectorName}** sektörünü bitirmene tek görev kaldı.` : `**${sectorName}** sektörünü bitirmene ${leftInSector} görev kaldı.`;
  if (rank && rank.need <= 8) return `Yeni rütbeye ${rank.need} yıldız kaldı: **${rank.name}**.`;
  if (leftInSector > 2) return `**${sectorName}** sektöründe ${leftInSector} görev daha var.`;
  return rank ? `Yeni rütbeye ${rank.need} yıldız kaldı: **${rank.name}**.` : '';
}
