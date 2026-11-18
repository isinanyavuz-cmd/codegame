// Oyunun hikâyesi ve anlatı metinleri.
//
// Ana Gemi Atlas, yeni yuva gezegeni Nova'ya giderken Kızıl Kanca'nın korsanlarına
// yakalandı. Mürettebat kurtarma kapsülleriyle uzaya dağıldı, Atlas'ın otopilotu bozuldu.
// Çocuk genç bir pilottur; kopilot robotu Bip ile otopilotu baştan yazarak sektör sektör
// ilerler, her sektörün sonunda bir mürettebatı kurtarır ve Atlas'ı Nova'ya götürür.
// Her sektör kısa bir telsiz mesajıyla açılır, bir sonrakini merak ettiren cümleyle biter.
import { nextRank } from './ranks.js';

export const SHIP = 'Atlas', VILLAIN = 'Kızıl Kanca';

/** Kurtarılan mürettebat: her sektörün finalinde biri. `hue` kaskının rengidir. */
export const CREW = [
  { id: 'defne', sector: 1, name: 'Defne', role: 'Mühendis', hue: 205, line: 'Her işin bir sırası vardır. Sen bunu çoktan öğrenmişsin!' },
  { id: 'kerem', sector: 2, name: 'Kerem', role: 'Rotacı', hue: 28, line: 'Aynı yolu on kez çizmektense bir döngü kurarım.' },
  { id: 'elif', sector: 3, name: 'Elif', role: 'Gözcü', hue: 340, line: 'Önüne bakmadan uçan pilot, yağmura şemsiyesiz çıkar.' },
  { id: 'umut', sector: 4, name: 'Umut', role: 'Fener Bekçisi', hue: 265, line: 'Mor halkaları ben bıraktım. İyi ki izledin!' },
  { id: 'yaman', sector: 5, name: 'Yaman', role: 'Güvenlik Şefi', hue: 4, line: 'Korsan görünce kalkan! Refleks dediğin böyle olur.' },
  { id: 'nil', sector: 6, name: 'Nil', role: 'Enerji Teknisyeni', hue: 150, line: 'Sayıyı takip eden yolda kalmaz.' },
  { id: 'aras', sector: 7, name: 'Aras', role: 'Uçuş Öğretmeni', hue: 46, line: 'İyi bir manevraya ad verirsin, sonra hep onu çağırırsın.' },
  { id: 'ada', sector: 8, name: 'Ada', role: 'Kaptan', hue: 300, line: `${SHIP}'ın yeni otopilotunu sen yazdın, pilot. Rota: Nova!` },
];
export const crewOf = (sector) => CREW.find((c) => c.sector === sector);

/** Gizli görevlerde bulunan küçük robotlar: Bip'in arkadaşları. */
export const BOTS = ['Çıt', 'Vızz', 'Pır', 'Lop', 'Zıp', 'Tık', 'Fıs', 'Bom'].map((name, i) => ({
  id: ['cit', 'vizz', 'pir', 'lop', 'zip', 'tik', 'fis', 'bom'][i], sector: i + 1, name, hue: (40 + i * 43) % 360,
}));
export const botOf = (sector) => BOTS.find((b) => b.sector === sector);

/**
 * Sektör hikâyeleri. `open` sektöre girerken Bip'in telsiz mesajı; `close` final geçilince
 * kurtarılan kişinin söylediği ve bir sonraki sektörü merak ettiren cümle.
 */
export const STORY = {
  1: {
    open: `Pilot, ben Bip! ${SHIP}'tan kopan kapsüllerin sinyalini alıyorum; ilki çok yakında. Önce kalkmayı öğrenelim.`,
    close: 'Teşekkürler pilot! Kanatlarına bir lazer taktım: rotada silah görevleri açıldı. Ama dikkat: ileride asteroit kuşağı var. Orada komutları tek tek dizmeye bloğun yetmeyecek…',
  },
  2: {
    open: 'Asteroit kuşağına girdik. Yol uzun, blok hakkımız az. Tekrar eden işi döngüye bırakalım.',
    close: 'Haritalarım artık işe yaramıyor: ilerideki meteorlar durmadan yer değiştiriyor!',
  },
  3: {
    open: 'Meteor yağmuru! Yolu ezberleyemeyiz. Gemiye önüne bakıp karar vermeyi öğretelim.',
    close: 'Bulutsunun içinde bir ışık gördüm… mor bir halka. Biri bize yol mu gösteriyor?',
  },
  4: {
    open: 'Karanlık Bulutsu. Göz gözü görmüyor ama mor halkalar yol gösteriyor. Halkaya varana kadar uç!',
    close: `Acele et pilot: ${VILLAIN}'nın korsanları ${SHIP}'ın yolunu tutmuş!`,
  },
  5: {
    open: 'Korsan bölgesi! Her an karşımıza çıkabilirler. Onları beklemeyelim: bir olay olunca gemi kendiliğinden karşılık versin.',
    close: `${VILLAIN} kaçarken enerji hatlarımızı kesti. Yakıt göstergesine bak!`,
    villain: 'Bu iş burada bitmedi, çaylak!',
  },
  6: {
    open: 'Enerjimiz azalıyor. Artık her adımı saymalıyız: enerji bir sayı ve o sayı durmadan değişiyor.',
    close: `Depo tamam! Artan enerjiyle sana bir şarjlı lazer yaptım. ${SHIP}'a yaklaşıyoruz ama enkazın arasından ancak usta işi manevralarla geçilir…`,
  },
  7: {
    open: 'Manevra Okulu’nun eski parkuru. İyi manevralara ad verip onları tekrar tekrar çağıracağız.',
    close: `Hazırsın. ${SHIP} tam karşıda… ama ışıkları sönük. ${VILLAIN} orada mı?`,
  },
  8: {
    open: `${SHIP} göründü! Otopilotu bozuk, Kaptan Ada içeride mahsur. Öğrendiğin her şeyi birleştirme zamanı.`,
    close: `Bütün mürettebat gemide ve ${SHIP} yeniden uçuyor. Hepsi senin yazdığın otopilot sayesinde.`,
    villain: 'Olamaz! Bir çocuğun yazdığı otopilot beni yendi!',
  },
};

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
