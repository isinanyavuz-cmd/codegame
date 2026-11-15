// Sektörler ve sahneler. Her sektör tek bir kavram öğretir; içindeki 8 sahne
// tanış → dene → pekiştir → hata avı → final sırasıyla ilerler.
import { F, L, R, rep, forever, ifelse } from '../engine/blocks.js';
import { genWaves } from './gen.js';

export const KINDS = { tanis: 'tanış', dene: 'dene', pekistir: 'pekiştir', hata: 'hata avı', final: 'final' };

export const SECTORS = [
  {
    id: 1, name: 'Kalkış', concept: 'Sıralama', hue: 205,
    intro: {
      title: 'Komutlar sırayla çalışır',
      text: 'Gemin, yazdığın blokları yukarıdan aşağıya birer birer uygular. Her blok gemiyi bir sıra ileri taşır.',
      demo: () => [F(), R(), F()],
    },
  },
  {
    id: 2, name: 'Asteroit Kuşağı', concept: 'Döngü', hue: 28,
    intro: {
      title: 'Tekrarla: az blok, çok iş',
      text: 'Aynı hareketleri alt alta dizmek yerine "tekrarla" bloğunun içine koy. Bu sektörde blok sayın sınırlı!',
      demo: () => [rep(4, R(), L())],
    },
  },
  {
    id: 3, name: 'Meteor Yağmuru', concept: 'Eğer / değilse', hue: 340,
    intro: {
      title: 'Önüne bak, karar ver',
      text: 'Meteorların yeri artık her dalgada değişiyor; yolu ezberleyemezsin. "Eğer" bloğu gemiye sensörüne bakıp karar verdirir.',
      demo: () => [forever(ifelse('ahead', [R()], [F()]))],
    },
  },
  { id: 4, name: 'Karanlık Bulutsu', concept: '…olana kadar · ve / veya', hue: 265, soon: true },
  { id: 5, name: 'Korsan Bölgesi', concept: 'Olaylar', hue: 0, soon: true },
  { id: 6, name: 'Enerji Krizi', concept: 'Değişkenler', hue: 150, soon: true },
  { id: 7, name: 'Manevra Okulu', concept: 'Fonksiyonlar', hue: 50, soon: true },
  { id: 8, name: 'Ana Gemi', concept: 'Büyük final', hue: 300, soon: true },
];

const MOVES = ['fwd', 'left', 'right'];

// ---- Sektör 3 için örnek programlar ----
const dodge = (side) => () => [forever(ifelse('ahead', [side()], [F()]))];
const dodgeRight = dodge(R), dodgeLeft = dodge(L);
const twoSensor = () => [forever(ifelse('ahead', [ifelse('rightFree', [R()], [L()])], [F()]))];
const twoSensorSwapped = () => [forever(ifelse('ahead', [ifelse('rightFree', [L()], [R()])], [F()]))];

const waves1 = (seed, extra = {}) => genWaves({ lanes: 5, rows: 7, start: 2, density: 0.26, seed, solution: dodgeRight(), minDodges: 2, ...extra });
const waves2 = (seed, extra = {}) => genWaves({
  lanes: 5, rows: 8, start: 2, density: 0.3, seed, solution: twoSensor(), minDodges: 3, needBoth: true,
  decoys: [dodgeRight(), dodgeLeft()], ...extra,
});

const S3_TOOLS = [...MOVES, 'forever', 'ifelse'];

const DEFS = [
  // ───────────── Sektör 1 · Sıralama ─────────────
  {
    kind: 'tanis', title: 'İlk Uçuş',
    brief: 'Gemin blokları sırayla uygular; her blok onu bir sıra ilerletir. Çıkışa varmak için bir **düz uç** daha ekle ve **Uçur**\'a bas.',
    waves: [['...', '...', '.S.']],
    tools: MOVES, maxBlocks: 5, par: 3,
    initial: () => [F(), F()],
    solution: () => [F(), F(), F()],
    hint: 'Alttaki "düz uç" bloğuna dokun ya da programın sonuna sürükle.',
  },
  {
    kind: 'dene', title: 'İlk Manevra',
    brief: 'Yolun üstünde bir meteor var! Programı tamamla: meteorun yanından **kaç**, sonra çıkışa uç.',
    waves: [['...', '.M.', '...', '.S.']],
    tools: MOVES, maxBlocks: 6, par: 4,
    initial: () => [F()],
    solution: () => [F(), R(), F(), F()],
    hint: 'Kaçış blokları gemiyi hem yana hem ileri taşır.',
  },
  {
    kind: 'dene', title: 'Dar Geçit',
    brief: 'Meteorların arasında tek bir yol var. Programın başı hazır; devamını sen yaz.',
    waves: [['..M', '.M.', 'M..', '.M.', '.S.']],
    tools: MOVES, maxBlocks: 7, par: 5,
    initial: () => [R(), F(), F()],
    solution: () => [R(), F(), F(), L(), F()],
    hint: '"Adım" düğmesiyle programı tek tek çalıştır; geminin nerede kaldığına bak.',
  },
  {
    kind: 'pekistir', title: 'Kristal Avı',
    brief: 'Kristaller ek yıldız kazandırır. Üçünü de toplayıp çıkışa var.',
    waves: [['.....', '...K.', '..K..', '.K...', '..S..']],
    tools: MOVES, maxBlocks: 7, par: 5,
    solution: () => [L(), R(), R(), F(), F()],
    hint: 'Her kristal bir üst sırada. Hangi yöne kaçarsan üstüne gelirsin?',
  },
  {
    kind: 'pekistir', title: 'Meteor Tarlası',
    brief: 'Yolunu önce gözünle çiz, sonra blokları sırayla diz.',
    waves: [['..M..', '.M.M.', '..K..', 'M.M.M', '.M...', '..S..']],
    tools: MOVES, maxBlocks: 8, par: 6,
    solution: () => [F(), L(), R(), F(), L(), F()],
    hint: 'Altı sıra var, yani altı blok gerekiyor.',
  },
  {
    kind: 'pekistir', title: 'Uzun Rota',
    brief: 'İki kristal, yedi adım. Her adımı sırayla düşün.',
    waves: [['.M...', '..MK.', '...M.', '.K.M.', '..M..', '...M.', '..S..']],
    tools: MOVES, maxBlocks: 9, par: 7,
    solution: () => [L(), F(), F(), R(), R(), F(), F()],
    hint: 'İlk kristal solda. Oraya gitmek için baştan sola geç.',
  },
  {
    kind: 'hata', title: 'Bozuk Rota',
    brief: 'Bu programda **tek bir hata** var. **Adım** düğmesiyle tek tek çalıştır, hatalı bloğu bul ve değiştir.',
    waves: [['.....', '..M..', '.M...', '...M.', '..M..', '..S..']],
    tools: MOVES, maxBlocks: 8, par: 6,
    initial: () => [R(), F(), F(), R(), F(), F()],
    solution: () => [R(), L(), F(), R(), F(), F()],
    hint: 'Gemi ikinci adımda çarpıyor. O bloğu sürükleyip at, yerine doğrusunu koy.',
  },
  {
    kind: 'final', title: 'Kalkış Sınavı',
    brief: 'Sektör finali! Üç kristali topla ve çıkışa ulaş.',
    waves: [['..M..', '.K.M.', 'M...M', '..MK.', '.M...', '...M.', '.K.M.', '..S..']],
    tools: MOVES, maxBlocks: 10, par: 8,
    solution: () => [L(), R(), F(), R(), L(), L(), F(), F()],
    hint: 'Kristalden kristale git: önce sol alttaki, sonra sağdaki, sonra yine soldaki.',
  },

  // ───────────── Sektör 2 · Döngü ─────────────
  {
    kind: 'tanis', title: 'Uzun Yol',
    brief: 'Sekiz tane **düz uç** dizmene gerek yok. Tekrar sayısına dokun ve **8** yap.',
    waves: [['...', '...', '...', '...', '...', '...', '...', '.S.']],
    tools: [...MOVES, 'repeat'], maxBlocks: 4, par: 2,
    initial: () => [rep(3, F())],
    solution: () => [rep(8, F())],
    hint: '"tekrarla" bloğundaki sayıya dokun.',
  },
  {
    kind: 'dene', title: 'Zikzak',
    brief: 'Zikzak hep aynı iki hareket: sağa, sola. Döngünün içine eksik bloğu ekle.',
    waves: [['M..', '.MM', 'M..', '.MM', 'M..', '.MM', 'M..', 'S..']],
    tools: [...MOVES, 'repeat'], maxBlocks: 5, par: 3,
    initial: () => [rep(4, R())],
    solution: () => [rep(4, R(), L())],
    hint: 'Bloğu "tekrarla"nın içine, "sağa kaç"ın altına bırak.',
  },
  {
    kind: 'dene', title: 'Manevra ve Düz Yol',
    brief: 'Önce bir manevra, sonra uzun bir düz yol, sonunda kristal. Tekrar sayısını düzelt ve programı tamamla.',
    waves: [['..K..', '..M..', '..M..', '..M..', '..M..', '..M..', '..M..', '..M..', '..S..']],
    tools: [...MOVES, 'repeat'], maxBlocks: 7, par: 5,
    initial: () => [R(), rep(3, F())],
    solution: () => [R(), rep(6, F()), L(), F()],
    hint: 'Döngü bittikten sonraki bloklar bir kez çalışır.',
  },
  {
    kind: 'pekistir', title: 'Merdiven',
    brief: 'Merdiven gibi bir yol: aynı iki hareket dört kez tekrar ediyor. En fazla 5 blok kullanabilirsin!',
    waves: [['..M.M', '..M..', '.M.M.', '.M...', 'M.M..', 'M....', '.M...', 'S....']],
    tools: [...MOVES, 'repeat'], maxBlocks: 5, par: 3,
    solution: () => [rep(4, F(), R())],
    hint: 'İlk iki adımı bul: düz, sonra sağa. Gerisi aynısı.',
  },
  {
    kind: 'pekistir', title: 'Üç Parça',
    brief: 'Yol üç parçadan oluşuyor: ileri, çapraz, yine ileri. Her parça için bir döngü kur.',
    waves: [['MMM..', 'MM...', 'M...K', '.M.K.', '.MK..', '.....', '..M..', '..M..', '.S...']],
    tools: [...MOVES, 'repeat'], maxBlocks: 8, par: 6,
    solution: () => [rep(3, F()), rep(3, R()), rep(3, F())],
    hint: 'Döngüleri alt alta koy: biri bitince sıradaki başlar.',
  },
  {
    kind: 'pekistir', title: 'Desen Avcısı',
    brief: 'Kristalleri izle: yol dört hareketlik bir desenden oluşuyor ve desen tekrar ediyor.',
    waves: [['M.K.M', '..MK.', '.MK..', '.K.M.', '..K.M', 'M..K.', '..K..', '.S...']],
    tools: [...MOVES, 'repeat'], maxBlocks: 7, par: 5,
    solution: () => [rep(2, R(), R(), L(), L())],
    hint: 'İlk dört adım: sağa, sağa, sola, sola.',
  },
  {
    kind: 'hata', title: 'Sıra Hatası',
    brief: 'Bu döngüde bir hata var: gemi daha ilk adımda çarpıyor. Düzelt.',
    waves: [['.M...', '..M..', 'M.M..', '.M.M.', '.M.M.', '..M.M', '..M.M', '....S']],
    tools: [...MOVES, 'repeat'], maxBlocks: 5, par: 3,
    initial: () => [rep(4, F(), L())],
    solution: () => [rep(4, L(), F())],
    hint: 'Bloklar doğru, sıraları yanlış. Birini sürükleyip ötekinin üstüne al.',
  },
  {
    kind: 'final', title: 'Kuşak Finali',
    brief: 'Sektör finali! On iki adımlık yol, en fazla 9 blok. Döngüleri arka arkaya kullan.',
    waves: [['..M.M', 'M.M..', 'M.K..', '.M..M', '..M..', '.M..K', 'M.M..', '.M...', 'M....', '..K.M', '...M.', 'S....']],
    tools: [...MOVES, 'repeat'], maxBlocks: 9, par: 7,
    solution: () => [rep(4, R()), rep(3, F()), rep(4, L()), F()],
    hint: 'Yol dört parça: çapraz sağa, düz, çapraz sola ve son bir adım.',
  },

  // ───────────── Sektör 3 · Eğer / değilse ─────────────
  {
    kind: 'tanis', title: 'İlk Dalga',
    brief: 'Meteorların yeri **her dalgada değişiyor**. Bu program önüne bakıp karar veriyor. **Uçur**\'a bas ve üç dalgayı izle.',
    waves: waves1(101),
    tools: S3_TOOLS, conds: ['ahead'], maxBlocks: 6, par: 4, watch: true,
    initial: dodgeRight,
    solution: dodgeRight,
    hint: 'Sarı parlayan bloğu izle: sensör "evet" dediğinde hangi dal çalışıyor?',
  },
  {
    kind: 'dene', title: 'Kararı Sen Ver',
    brief: 'İskelet hazır, kararlar eksik: önünde meteor **varsa** gemi ne yapsın, **yoksa** ne yapsın?',
    waves: waves1(202),
    tools: S3_TOOLS, conds: ['ahead'], maxBlocks: 6, par: 4,
    initial: () => [forever(ifelse('ahead', [], []))],
    solution: dodgeRight,
    hint: 'Üst boşluk "meteor varsa", alt boşluk "yoksa" çalışır.',
  },
  {
    kind: 'dene', title: 'Sola da Kaçılır',
    brief: 'Bu bölgede sağ taraf tehlikeli. Meteor görünce gemi hangi yöne kaçmalı? Eksik bloğu koy.',
    waves: genWaves({ lanes: 5, rows: 7, start: 2, density: 0.26, seed: 303, solution: dodgeLeft(), minDodges: 2, decoys: [dodgeRight()] }),
    tools: S3_TOOLS, conds: ['ahead'], maxBlocks: 6, par: 4,
    initial: () => [forever(ifelse('ahead', [], [F()]))],
    solution: dodgeLeft,
    hint: 'Üç dalgaya da bak: sağa kaçış hepsinde işe yarıyor mu?',
  },
  {
    kind: 'pekistir', title: 'Meteor Yağmuru',
    brief: 'Meteorların yeri **her uçuşta değişiyor**. Ezberleyemezsin: önüne bak, ona göre kaç.',
    waves: waves1(404),
    tools: S3_TOOLS, conds: ['ahead'], maxBlocks: 6, par: 4,
    solution: dodgeRight,
    hint: 'Önce "sürekli tekrarla", içine "eğer / değilse". Her dala bir hareket.',
  },
  {
    kind: 'pekistir', title: 'İki Sensör',
    brief: 'Bazen sağın da dolu! Kaçmadan önce ikinci bir sensöre sor: **sağım boş mu?**',
    waves: waves2(505),
    tools: S3_TOOLS, conds: ['ahead', 'rightFree', 'leftFree'], maxBlocks: 8, par: 6,
    solution: twoSensor,
    hint: '"Eğer" bloğunun içine ikinci bir "eğer" koyabilirsin. Koşulu değiştirmek için üstüne dokun.',
  },
  {
    kind: 'pekistir', title: 'Dar Koridor',
    brief: 'Koridor daraldı ve duvarlar da engel sayılıyor. Aynı mantık burada da çalışır mı?',
    waves: waves2(606, { lanes: 3, start: 1, rows: 9, density: 0.3 }),
    tools: S3_TOOLS, conds: ['ahead', 'rightFree', 'leftFree'], maxBlocks: 8, par: 6,
    solution: twoSensor,
    hint: 'Duvarın yanındayken "sağım boş mu?" sensörü "hayır" der.',
  },
  {
    kind: 'hata', title: 'Ters Mantık',
    brief: 'Bu programın mantığı ters kurulmuş: gemi boş tarafa değil, dolu tarafa kaçıyor. Hatayı bul ve düzelt.',
    waves: waves2(707, { decoys: [dodgeRight(), dodgeLeft(), twoSensorSwapped()] }),
    tools: S3_TOOLS, conds: ['ahead', 'rightFree', 'leftFree'], maxBlocks: 8, par: 6,
    initial: twoSensorSwapped,
    solution: twoSensor,
    hint: 'Sağ boşsa sağa kaçmalı. İçteki iki bloğun yerini değiştir.',
  },
  {
    kind: 'final', title: 'Yağmur Finali',
    brief: 'Sektör finali! Uzun ve yoğun üç dalga. Tek bir program hepsini geçmeli.',
    waves: waves2(808, { lanes: 4, start: 1, rows: 11, density: 0.34, minDodges: 4 }),
    tools: S3_TOOLS, conds: ['ahead', 'rightFree', 'leftFree'], maxBlocks: 8, par: 6,
    solution: twoSensor,
    hint: 'Önünde meteor varsa: sağın boşsa sağa, değilse sola. Yoksa düz uç.',
  },
];

export const LEVELS = DEFS.map((d, i) => {
  const sector = Math.floor(i / 8) + 1, n = (i % 8) + 1;
  return { conds: [], ...d, id: `${sector}-${n}`, sector, n, index: i };
});

export const levelById = (id) => LEVELS.find((l) => l.id === id);
export const levelsOf = (sectorId) => LEVELS.filter((l) => l.sector === sectorId);
