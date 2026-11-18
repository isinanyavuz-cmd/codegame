// Yan görevler: ana yolun dışındaki görevler. Her biri bir sektöre bağlıdır ve
// haritada o sektörün yolunun yanında durur. Türleri:
//   gizli   sektörde yeterince yıldız toplanınca açılır; ödülü Bip'in bir arkadaşıdır
//   acil    bir ana görev bitince araya giren beklenmedik görev (bir kez haber verilir)
//   catal   bir ana görevin öteki yolu: ikisinden hangisi geçilirse sıradaki görev açılır
//   tahmin  program yazılmaz, hazır program okunur: gemi nerede durur? (bkz. predict.js)
//   silah   ışın silahının deneme görevi: baştan açıktır, kayalar ateş edilerek parçalanır
// Alanları ana görevlerle aynıdır; ek olarak `extra` (tür), `after` (haritada yanında
// durduğu ana görev) ve `open(store, levels)` (açık mı) taşırlar. Ana yolu kilitlemezler.
import { F, L, R, fire, beam, rep, forever, ifelse, until, on, shield, setEnergy, addEnergy, setCounter, addCounter, define, call, defineN, callN } from '../engine/blocks.js';
import { pilli } from '../engine/world.js';
import { genWaves } from './gen.js';
import { route, mission, wallWaves, steer, cruise, MOVES, LOOPS, EVENT_TOOLS, ENERGY_TOOLS, ALL_TOOLS, SENSORS } from './advanced.js';
import { LEVELS, SECTORS, levelById, levelsOf } from './levels.js';
import { ROUNDS, PY_ROUNDS } from './predict.js';

/** Gizli görevin açılması için sektörde toplanması gereken yıldız (24 üzerinden). */
export const SECRET_STARS = 20;
export const EXTRA_LABEL = { gizli: 'GİZLİ GÖREV', acil: 'ACİL DURUM', catal: 'ÖTEKİ YOL', tahmin: 'TAHMİN TURU', python: 'PYTHON BULMACASI', silah: 'SİLAH DENEMESİ', gunluk: 'GÜNÜN DALGASI', atolye: 'ATÖLYE' };
const SUFFIX = { gizli: 'g', acil: 'a', tahmin: 't', silah: 's' };
export const sectorStars = (store, sector) => levelsOf(sector).reduce((a, l) => a + store.stars(l.id), 0);

const OPEN = {
  gizli: (l) => (store) => sectorStars(store, l.sector) >= SECRET_STARS,
  acil: (l) => (store) => store.passed(levelById(l.after)),
  catal: (l) => (store, levels) => store.isUnlocked(levelById(l.after), levels),
  tahmin: (l) => (store) => store.passed(levelById(l.after)),
  // Kanat lazerini 1. sektörde kurtarılan mühendis Defne takar, şarjlı lazeri 6. sektördeki enerji
  // teknisyeni Nil yapar: silah görevleri o kurtarmalardan sonra, yanındaki ana görev geçilince açılır.
  // Önceden yıldız alınmış silah görevi açık kalır.
  silah: (l) => (store) => store.stars(l.id) > 0 || (store.passed(levelById(LASER_FROM.fire)) && (!l.tools.includes('beam') || store.passed(levelById(LASER_FROM.beam))) && store.passed(levelById(l.after))),
};
/** Lazerlerin açıldığı sektör finalleri: kanat lazeri (Defne) ve şarjlı lazer (Nil). */
export const LASER_FROM = { fire: '1-8', beam: '6-8' };

/** @param after  haritada yanında duracağı ana görevin sırası (1–8) */
function extra(kind, sector, after, def) {
  const id = def.id || (kind === 'catal' ? `${sector}-${after}-b` : `${sector}-${SUFFIX[kind]}`);
  // `def.kind` verilirse korunur (ör. silah görevinin bir "hata avı" olması).
  const level = { conds: [], events: [], functions: [], ...def, id, saveKey: id, sector, extra: kind, kind: def.kind || kind, after: `${sector}-${after}` };
  level.open = OPEN[kind](level);
  // Çatal: ana görev öteki yolunu tanır; kayıt (storage.passed) ikisinden birini geçilmiş sayar.
  if (kind === 'catal') levelById(level.after).alt = id;
  return level;
}
const secret = (sector, def) => extra('gizli', sector, 8, def);
const alarm = (sector, after, def) => extra('acil', sector, after, def);
const fork = (sector, after, def) => extra('catal', sector, after, def);
// Tahmin turu: sektörün üçüncü görevinden sonra açılır; yıldızı doğru tahmin sayısıdır.
const quiz = (sector) => extra('tahmin', sector.id, 3, {
  tahmin: true, title: `Tahmin Turu: ${sector.concept}`,
  brief: 'Bu kez program hazır: **oku ve tahmin et**. Program bitince gemi hangi karede olur? Harflerden birine dokun.',
  hint: 'Programı blok blok oku; her blokta geminin hangi kareye geçtiğini parmağınla izle.',
  rounds: ROUNDS[sector.id], waves: ROUNDS[sector.id].map((r) => r.lines), tools: [], maxBlocks: 0, par: 0,
});

const twoSensor = () => [forever(steer())];
const oneSide = (side) => [forever(ifelse('ahead', [side()], [F()]))];
const twoSensorLeft = () => [forever(ifelse('ahead', [ifelse('leftFree', [L()], [R()])], [F()]))];

// Halka zinciri: her mor halka "bir şerit sağa" demektir; halka sayısı dalgadan dalgaya değişir.
// Halkanın önü ve sağı kapalıdır: geç dönen de erken dönen de çarpar, bir dalganın ezberi ötekini geçemez.
const chain = (path, start) => {
  let lane = start;
  const beacons = [], walls = [];
  [...path].forEach((step, y) => { if (step === 'r') { beacons.push(y); walls.push([lane, y + 1], [lane + 1, y]); lane++; } });
  return route(path, { start, beacons, crystals: beacons.map((y) => y + 1), extra: walls });
};

// Sayaçlı dönüş: üçüncü kristalde sağa dönülür. Orası her dalgada başka sıradadır ve hiçbir sensör
// göstermez; önü ve sağı kapalıdır (erken ya da geç dönen çarpar). `path` içindeki tek 'r' dönüştür.
const countTurn = (path, crystals, start = 1) => {
  const y = path.indexOf('r');
  return route(path, { start, crystals, extra: [[start, y + 1], [start + 1, y]] });
};

export const EXTRAS = [
  // ───────────── gizli görevler ─────────────
  secret(1, {
    title: 'Kayıp Sinyal',
    brief: 'Bip\'in arkadaşı **Çıt** bu meteorların arasında bir yerde! On adımlık yolu gözünle çiz, üç kristali topla.',
    waves: [route('RRFLLFLFRF', { crystals: [2, 5, 8] })],
    tools: MOVES, maxBlocks: 12, par: 10,
    solution: () => [R(), R(), F(), L(), L(), F(), L(), F(), R(), F()],
    hint: 'Yol on adım. Önce iki kez sağa, sonra düz; kristaller yolu gösteriyor.',
  }),
  secret(2, {
    title: 'Döngünün İçinde Döngü',
    brief: 'Üç adım düz, bir sağa kaçış: bu desen üç kez tekrar ediyor. Bir döngünün **içine başka bir döngü** koyabilirsin. Üç yıldız için 4 blok!',
    waves: [route('FFFRFFFRFFFR', { start: 1, crystals: [2, 6, 10] })],
    tools: [...MOVES, 'repeat'], maxBlocks: 5, par: 4,
    solution: () => [rep(3, rep(3, F()), R())],
    hint: 'Dıştaki döngü deseni 3 kez tekrarlar. Desenin içindeki üç düz uçuşu da bir döngüye topla.',
  }),
  secret(3, {
    title: 'Fırtınanın Gözü',
    brief: 'Dört uzun ve yoğun dalga! Önünde meteor varsa boş yana kaçan tek bir program hepsini geçmeli.',
    waves: genWaves({ lanes: 5, rows: 12, start: 2, density: 0.34, seed: 3131, count: 4, solution: twoSensor(), minDodges: 5, needBoth: true, decoys: [oneSide(R), oneSide(L)], alts: [twoSensorLeft()] }),
    tools: [...MOVES, 'forever', 'ifelse'], conds: SENSORS, maxBlocks: 8, par: 6,
    solution: twoSensor,
    hint: 'Önünde meteor varsa: sağın boşsa sağa, değilse sola. Yoksa düz uç.',
  }),
  secret(4, mission({
    title: 'Halka Zinciri',
    brief: 'Her mor halka **bir şerit sağa** demek. Halka sayısı her dalgada farklı: halkaya kadar uç, sağa kaç ve bunu **sürekli tekrarla**.',
    waves: [chain('FFrFFFrFFF', 0), chain('FrFFrFFrFF', 0), chain('FFFrFrFFFF', 1)], conds: ['atBeacon'],
    solution: () => [forever(until('atBeacon', F()), R())],
    hint: 'Olana kadar döngüsünü ve sağa kaçışı bir sürekli tekrarla bloğunun içine koy.',
  })),
  secret(5, mission({
    title: 'Olay Manevra Yapar', tools: EVENT_TOOLS, events: ['beacon', 'pirate'],
    brief: 'Olaylar yalnızca kalkan açmaz: **işarete varınca sağa kaç** da diyebilirsin. Korsanları da unutma; uçuş döngün yalnızca düz uçsun.',
    waves: [
      route('FFrFFrFFFF', { start: 1, beacons: [2, 5], pirates: [4, 8], crystals: [3, 6], extra: [[1, 3], [2, 6]] }),
      route('FrFFFFrFFF', { start: 0, beacons: [1, 6], pirates: [3, 8], crystals: [2, 7], extra: [[0, 2], [1, 7]] }),
      route('FFFrFrFFFF', { start: 2, beacons: [3, 5], pirates: [2, 7], crystals: [4, 6], extra: [[2, 4], [3, 6]] }),
    ],
    solution: () => [on('pirate', shield()), on('beacon', R()), cruise()],
    hint: 'İki olay bloğu kur: biri korsan görünce kalkan açsın, öteki işarete varınca sağa kaçsın.',
  })),
  secret(6, mission({
    title: 'Kristal Sayacı', tools: [...EVENT_TOOLS, 'setCounter', 'addCounter'], events: ['crystal'], conds: ['counter3'],
    brief: 'Yeni bir değişken: **sayaç**! Onu 0\'a ayarla, her kristalde 1 artır. Sayaç **3 olana kadar** düz uç, sonra sağa kaç: üçüncü kristalin ötesi kapalı.',
    waves: [countTurn('FFFFrFFFFF', [1, 3, 4, 7]), countTurn('FFFFFFrFFF', [2, 3, 6, 8]), countTurn('FFFrFFFFFF', [1, 2, 3, 6])],
    solution: () => [setCounter(0), on('crystal', addCounter(1)), until('counter3', F()), R(), cruise()],
    hint: 'Önce sayaç = 0. Kristal toplayınca olayının içine "sayacı 1 artır" koy. Uçuş: sayaç 3 olana kadar düz, sonra sağa, sonra hep düz.',
  })),
  secret(7, mission({
    title: 'Sayı Alan Manevra', tools: ALL_TOOLS, functions: ['zigzag'], params: true,
    brief: 'Manevralar **sayı alabilir**: zikzak (n) tanımında döngü **n kez** döner; çağırırken sayıyı sen verirsin. Bir zikzak, düz; iki zikzak, düz; iki zikzak daha.',
    waves: [route('RLFRLRLFRLRL', { start: 1, lanes: 4, crystals: [3, 8, 11] })],
    solution: () => [defineN('zigzag', rep('n', R(), L())), callN('zigzag', 1), F(), callN('zigzag', 2), F(), callN('zigzag', 2)],
    maxBlocks: 10,
    hint: 'Tanımın içine bir tekrarla koy ve sayısına dokunup n seç. Sonra zikzağı 1, 2 ve 2 sayılarıyla çağır; aralara birer düz uç.',
  })),
  secret(8, mission({
    title: 'Atlas\'ın Kalbi', tools: ALL_TOOLS, functions: ['safe'], events: ['pirate', 'energy'], conds: ['atBeacon', ...SENSORS], library: true,
    brief: 'En zor rota: dar geçit, korsanlar **ve** azalan enerji. Güvenli uçuşu tanımla; olaylar kalkanı ve şarjı yönetsin. Halkada sağa kaç!',
    waves: wallWaves({ energy: [3, 6, 9], pirates: [2, 10], crystals: [4, 7, 11] }),
    solution: () => [define('safe', steer()), on('pirate', shield()), on('energy', addEnergy(3)), setEnergy(3), until('atBeacon', call('safe')), R(), forever(call('safe'))],
    maxBlocks: 17,
    hint: 'Manevra Okulu finalindeki programın aynısı; üstüne şarj olayını ve 3 enerjilik kalkışı ekle.',
  })),

  // ───────────── çatallar: aynı kavram, başka bir yol ─────────────
  fork(1, 5, {
    title: 'Kristal Koridoru',
    brief: 'Meteor Tarlası\'nın öteki yolu: daha az meteor, daha çok kristal. Altı adımda üç kristali topla.',
    waves: [route('LFRRFL', { crystals: [1, 3, 5] })],
    tools: MOVES, maxBlocks: 8, par: 6,
    solution: () => [L(), F(), R(), R(), F(), L()],
    hint: 'Kristaller yolu gösteriyor: önce sola, sonra düz, sonra iki kez sağa.',
  }),
  fork(2, 6, {
    title: 'Dalga Deseni',
    brief: 'Desen Avcısı\'nın öteki yolu: bu kez desen üç hareketten oluşuyor ve üç kez tekrar ediyor.',
    waves: [route('RFLRFLRFL', { start: 1, crystals: [2, 5, 8] })],
    tools: [...MOVES, 'repeat'], maxBlocks: 6, par: 4,
    solution: () => [rep(3, R(), F(), L())],
    hint: 'İlk üç adım: sağa, düz, sola. Gerisi aynısı.',
  }),
  fork(3, 5, {
    title: 'Önce Sola Bak',
    brief: 'İki Sensör\'ün öteki yolu: önünde meteor varsa bu kez **solum boş mu?** diye sor. Karar ağacının aynası da iş görür.',
    waves: genWaves({ lanes: 5, rows: 8, start: 2, density: 0.3, seed: 3535, solution: twoSensorLeft(), minDodges: 3, needBoth: true, decoys: [oneSide(R), oneSide(L)], alts: [twoSensor()] }),
    tools: [...MOVES, 'forever', 'ifelse'], conds: ['ahead', 'leftFree', 'rightFree'], maxBlocks: 8, par: 6,
    solution: twoSensorLeft,
    hint: 'Önünde meteor varsa: solun boşsa sola, değilse sağa. Yoksa düz uç.',
  }),
  fork(4, 5, mission({
    title: 'Ters Duraklar',
    brief: 'İki Durak\'ın aynası: ilk mor halkaya kadar düz uç, **sola** kaç. İkinci halkaya kadar düz uç, **sağa** kaç ve çıkışa devam et.',
    waves: [route('FFFLFFRFFF', { beacons: [3, 6], crystals: [4, 7], extra: [[1, 1], [1, 2], [1, 3], [2, 5], [2, 6]] })], conds: ['atBeacon'],
    solution: () => [until('atBeacon', F()), L(), until('atBeacon', F()), R(), cruise()],
    hint: 'İki olana kadar döngüsü gerekiyor; arada bir sola, sonda bir sağa kaçış.',
  })),
  fork(6, 5, mission({
    title: 'Yalnızca Gerekince', tools: ENERGY_TOOLS, conds: ['energyLow', 'atEnergy'],
    brief: 'İstasyon çok, depo küçük: her istasyonda şarj edersen depo taşar! 6 enerjiyle kalk; enerji **3\'ten azsa** 6 ekle, sonra hep düz uç.',
    // Enerji yalnızca 4. ve 10. sırada 3'ün altına iner; öteki istasyonlarda şarj etmek depoyu taşırır.
    waves: [route('FFFFFFFFFFFF', { energy: [1, 2, 4, 6, 7, 10], crystals: [3, 5, 8, 11] })],
    solution: () => [setEnergy(6), forever(ifelse('energyLow', [addEnergy(6)], []), F())],
    hint: 'İstasyona değil enerjiye bak: "enerji 3\'ten az mı?" sensörünü seç. Düz uç, eğer bloğunun dışında olsun.',
  })),

  // ───────────── silah denemesi ─────────────
  extra('silah', 1, 1, {
    title: 'Kaya Duvarı',
    brief: 'Mühendis Defne gemine **kanat lazeri** taktı! **Ateş et** bloğu kanatlardan ışın yollar ve şeridindeki ilk kayayı parçalar; gemi yerinde kalır. Her atış **lazer pilinden** 1 hücre harcar. İki kaya duvarını del, iki kristali topla.',
    // İki duvar bütün şeritleri kapatır: kaçarak geçilemez, ateş etmek gerekir.
    waves: [pilli(['.....', '...K.', 'MMMMM', '..M..', '..K..', 'MMMMM', '.....', '..S..'], 3)],
    tools: [...MOVES, 'fire'], maxBlocks: 13, par: 10,
    solution: () => [fire(), F(), F(), F(), R(), fire(), F(), F(), F(), F()],
    hint: 'Önce ateş et, sonra açılan delikten geç. İkinci kristal sağda: kayanın yanından sağa kaç, sonra yine ateş et.',
  }),

  extra('silah', 1, 2, {
    id: '1-s2', title: 'Kaya Sütunu',
    brief: 'Enerji teknisyeni Nil yeni bir silah yaptı: **şarjlı lazer**! Önce şarj olur, sonra kesintisiz bir ışınla şeridindeki **bütün kayaları** birden parçalar ama pilden 3 hücre harcar. Küçük lazer her atışta tek kaya kırar; burada ne blok ne pil yeter.',
    // Her şerit kaya sütunu: küçük lazerle 6 atış gerekir, şarjlı lazerle tek atış.
    waves: [pilli(['.....', 'MMMMM', 'MMKMM', 'MMMMM', 'MMMMM', 'MMKMM', 'MMMMM', 'MMMMM', 'MMMMM', '..S..'], 4)],
    tools: [...MOVES, 'fire', 'beam'], maxBlocks: 13, par: 11,
    solution: () => [beam(), F(), F(), F(), F(), F(), F(), F(), F(), F(), F()],
    hint: 'Önce şarjlı lazeri ateşle: bütün sütun temizlenir. Sonra düz uçarak iki kristali topla.',
  }),

  extra('silah', 1, 4, {
    id: '1-s3', title: 'Kristal Madeni',
    brief: 'Parlayan kayaların içinde **kristal** var! Kristalli kayayı vurursan kristal yerinde kalır, üstünden geçip topla. Pilin yalnızca 2 atışlık: sıradan kayadan **kaç**, kristalli kayayı **vur**.',
    // Kristaller yalnızca kayaların içinde; düz kaya kaçılarak geçilmeli (pil iki atışlık).
    waves: [pilli(['.....', '.....', '..K..', '.....', '.G...', '..M..', '..G..', '..S..'], 2)],
    tools: [...MOVES, 'fire'], maxBlocks: 12, par: 10,
    solution: () => [fire(), F(), L(), fire(), F(), F(), R(), F(), F(), F()],
    hint: 'İlk kristalli kaya tam önünde. Sonra önündeki düz kayanın soluna kaç: ikinci kristalli kaya orada.',
  }),

  extra('silah', 1, 6, {
    id: '1-s4', kind: 'hata', title: 'Ters Atış',
    brief: '**Hata avı!** Bu program duvara çarpıyor: gemi önce uçuyor, sonra ateş ediyor. Blokların **sırasını** düzelt; ateş, duvara varmadan önce gelmeli.',
    waves: [pilli(['.....', '..K..', 'MMMMM', '.....', '..S..'], 2)],
    tools: [...MOVES, 'fire'], maxBlocks: 7, par: 6,
    initial: () => [F(), F(), fire(), F(), F(), F()],
    solution: () => [F(), fire(), F(), F(), F(), F()],
    hint: 'Gemi hangi karede duvara çarpıyor? Ateş et bloğu o hareketten önce çalışmalı.',
  }),

  // ───────────── silah serisi: her sektörde lazer o sektörün kavramını ister ─────────────
  extra('silah', 2, 5, {
    title: 'Duvar Kuşağı',
    brief: 'Her üç sırada bir kaya duvarı! Bir atış, üç düz uçuş… Bu deseni bir **döngüye** koy. Pilin tam dört atışlık: boşa ateş etme.',
    waves: [pilli(['..K..', 'MMMMM', '.....', '..K..', 'MMMMM', '.....', '..K..', 'MMMMM', '.....', '..K..', 'MMMMM', '..S..'], 4)],
    tools: [...MOVES, 'repeat', 'fire'], maxBlocks: 7, par: 5,
    solution: () => [rep(4, fire(), F(), F(), F())],
    hint: 'Döngünün içi: bir ateş et, üç düz uç. Döngü dört kez dönsün.',
  }),

  extra('silah', 3, 6, {
    title: 'Son Çare',
    brief: 'Pilin yalnızca **2 atışlık**. Önünde meteor varsa önce **kaçmayı** dene: sağın boşsa sağa, solun boşsa sola. İki yan da kapalıysa ancak o zaman **ateş et**.',
    // Çıkmaz sokaklar: önü ve iki yanı kapalı. Her kayayı vuran program pili bitirir, hiç vurmayan çarpar.
    waves: [
      pilli(['.....', '.MMM.', '..K..', '.M...', '.K...', 'MMM..', '.....', '..MM.', '..S..'], 2),
      pilli(['.....', '.MMM.', '..K..', '...MM', '...K.', '..MMM', '.....', '.MM..', '..S..'], 2),
    ],
    tools: [...MOVES, 'forever', 'ifelse', 'fire'], conds: ['ahead', 'rightFree', 'leftFree'], maxBlocks: 10, par: 8,
    solution: () => [forever(ifelse('ahead', [ifelse('rightFree', [R()], [ifelse('leftFree', [L()], [fire()])])], [F()]))],
    hint: 'İç içe üç karar: meteor var mı? Sağım boş mu? Solum boş mu? En içteki "değilse" kısmına ateş et.',
  }),

  extra('silah', 3, 7, {
    id: '3-s2', title: 'Kaya mı, Demir mi?',
    brief: 'Koyu, parlak taşlar **demir asteroit**: lazer onları kıramaz! Önündeki **kaya** ise ateş et; değilse ve önünde yine bir engel varsa (demir) **sağa kaç**; yol boşsa düz uç.',
    waves: [pilli(['...K', 'MMMM', '..D.', '..K.', 'MMMM', '....', '.D..', '.K..', 'MMMM', '.S..'], 3)],
    tools: [...MOVES, 'forever', 'ifelse', 'fire'], conds: ['rockAhead', 'ahead'], maxBlocks: 8, par: 6,
    solution: () => [forever(ifelse('rockAhead', [fire()], [ifelse('ahead', [R()], [F()])]))],
    hint: 'İlk soru "önümdeki kaya mı?" olsun: evetse ateş et. Değilse ikinci bir eğer: önümde engel varsa sağa kaç, yoksa düz uç.',
  }),

  extra('silah', 4, 6, mission({
    title: 'Kayalar Bitene Kadar', tools: [...MOVES, 'until', 'forever', 'fire'], conds: ['laneClear'],
    brief: 'Kaya koridorunda her dalgada başka sayıda kaya var. Saymaya çalışma: **şeridin temiz olana kadar** ateş et, sonra hep düz uç. Pil tam yetecek kadar!',
    // Koridorun yanları kapalı; kaya sayısı (ve pil) dalgadan dalgaya değişir: sayıyı ezberleyen geçemez.
    waves: [
      pilli(['MMKMM', 'MM.MM', 'MM.MM', 'MM.MM', 'MMMMM', 'MM.MM', 'MMKMM', 'MMMMM', 'MM.MM', 'MMSMM'], 2),
      pilli(['MM.MM', 'MMKMM', 'MMMMM', 'MM.MM', 'MM.MM', 'MMMMM', 'MMKMM', 'MM.MM', 'MMMMM', 'MMSMM'], 3),
      pilli(['MMKMM', 'MMMMM', 'MM.MM', 'MMMMM', 'MM.MM', 'MMKMM', 'MMMMM', 'MMMMM', 'MM.MM', 'MMSMM'], 4),
    ],
    solution: () => [until('laneClear', fire()), forever(F())],
    hint: 'Olana kadar bloğunun koşulu "şeridim temiz mi?" olsun, içine ateş et koy. Altına sürekli düz uç.',
  })),

  extra('silah', 5, 5, mission({
    title: 'Korsan ve Kaya', tools: [...LOOPS, 'on', 'shield', 'fire'], events: ['pirate', 'rock'],
    brief: 'Yeni bir olay: **kaya görünce**. Korsan görünce kalkan, kaya görünce lazer! Uçuş döngün yalnızca düz uçsun; pil kaya sayısı kadar.',
    waves: [pilli(['MMKMM', 'MM.MM', 'MMMMM', 'MMPMM', 'MM.MM', 'MMMMM', 'MMKMM', 'MMPMM', 'MMMMM', 'MM.MM', 'MMSMM'], 3)],
    solution: () => [on('pirate', shield()), on('rock', fire()), forever(F())],
    hint: 'İki olay bloğu: korsan görünce kalkan aç, kaya görünce ateş et. Sonra sürekli düz uç.',
  })),

  extra('silah', 6, 4, mission({
    title: 'Pil Hesabı', tools: [...MOVES, 'forever', 'ifelse', 'fire', 'beam'], conds: ['rocks3', 'ahead'],
    brief: 'Küçük lazer 1, şarjlı lazer 3 hücre harcar. Şeridinde **3 ya da daha çok kaya** varsa şarjlı lazer ucuz; azsa küçük lazer. Pil ancak doğru seçime yetiyor!',
    // Bir dalgada 4 kaya ve 3 hücre (yalnızca şarjlı lazer yeter), ötekinde 2 kaya ve 2 hücre (yalnızca küçük lazer).
    waves: [
      pilli(['MMKMM', 'MMMMM', 'MM.MM', 'MMMMM', 'MMKMM', 'MMMMM', 'MM.MM', 'MMMMM', 'MMSMM'], 3),
      pilli(['MMKMM', 'MM.MM', 'MM.MM', 'MMMMM', 'MMKMM', 'MM.MM', 'MMMMM', 'MM.MM', 'MMSMM'], 2),
    ],
    solution: () => [forever(ifelse('rocks3', [beam()], [ifelse('ahead', [fire()], [F()])]))],
    hint: 'Önce sor: şeridimde 3+ kaya var mı? Evetse şarjlı lazer. Değilse: önümde kaya varsa küçük lazer, yoksa düz uç.',
  })),

  extra('silah', 7, 5, mission({
    title: 'Delici Manevra', tools: [...MOVES, 'repeat', 'define', 'call', 'fire'], functions: ['drill'], params: true,
    brief: 'Duvarların kalınlığı farklı: 2, 3, 2. **Kaya kır (n)** manevrası n kez ateş etsin, sonra n kez düz uçsun. Her duvarda doğru sayıyla çağır!',
    waves: [pilli(['MMKMM', 'MMMMM', 'MMMMM', 'MMKMM', 'MMMMM', 'MMMMM', 'MMMMM', 'MMKMM', 'MMMMM', 'MMMMM', 'MMSMM'], 7)],
    solution: () => [defineN('drill', rep('n', fire()), rep('n', F())), callN('drill', 2), F(), callN('drill', 3), F(), callN('drill', 2), F(), F()],
    maxBlocks: 14,
    hint: 'Tanımda iki "tekrarla" olsun, sayılarını n yap: birinde ateş et, ötekinde düz uç. Sonra kaya kır 2, düz, kaya kır 3, düz, kaya kır 2, iki düz.',
  })),

  extra('silah', 8, 6, mission({
    title: 'Kızıl Kanca\'nın Barikatı', tools: [...LOOPS, 'on', 'shield', 'fire'], events: ['pirate'], conds: ['rockAhead', 'ahead', 'rightFree'], boss: true,
    brief: 'Kızıl Kanca Atlas\'ın yolunu kayalar ve demir asteroitlerle kapattı! Korsan görünce kalkan aç. Uçuşta: önündeki **kaya** ise ateş et; değilse engel varsa sağ boşsa sağa, değilse sola kaç; yoksa düz uç.',
    waves: [pilli(['..K..', '.MMM.', '..P..', '...DM', '.....', '..MMM', '...K.', '..D..', '..K..', '..P..', '.MMM.', '..S..'], 3)],
    solution: () => [on('pirate', shield()), forever(ifelse('rockAhead', [fire()], [ifelse('ahead', [ifelse('rightFree', [R()], [L()])], [F()])]))],
    hint: 'Korsan olayı en başta. Döngüde ilk soru "önümdeki kaya mı?"; değilse iki sensörlü kaçış kararı.',
  })),

  // Python bulmacası: program Python dilinde, bir satırı boş; gemiyi çıkışa götüren satır seçilir.
  extra('tahmin', 3, 7, {
    id: '3-p', tahmin: true, python: true, title: 'Python Bulmacası',
    brief: 'Bloklar yerine bu kez **Python**! Programın bir satırı boş (____). Gemiyi çıkışa götüren satırı seç: A, B ya da C.',
    hint: 'Satırları yukarıdan aşağıya oku. duz_uc() bir sıra ileri, saga_kac() sağa çapraz, ates_et() önündeki ilk kayayı kırar.',
    rounds: PY_ROUNDS, waves: PY_ROUNDS.map((r) => r.lines), tools: [], maxBlocks: 0, par: 0,
  }),

  // Lazer tahmini: küçük lazer şeritteki ilk kayayı, şarjlı lazer hepsini kırar.
  extra('tahmin', 2, 4, {
    id: '2-t2', tahmin: true, title: 'Tahmin Turu: Lazer',
    brief: 'Program hazır: **oku ve tahmin et**. Küçük lazer şeritteki **ilk** kayayı, şarjlı lazer **hepsini** kırar. Program bitince gemi hangi karede olur?',
    hint: 'Her ateş et bloğunda hangi kayanın kırıldığını parmağınla göster, sonra hareketleri izle.',
    rounds: ROUNDS.lazer, waves: ROUNDS.lazer.map((r) => r.lines), tools: [], maxBlocks: 0, par: 0,
  }),

  // ───────────── tahmin turları ─────────────
  ...SECTORS.filter((s) => ROUNDS[s.id]).map(quiz),

  // ───────────── acil durumlar ─────────────
  alarm(2, 5, {
    title: 'Çifte Merdiven',
    alarm: 'Kuşağın içinden bir imdat sinyali geliyor! Sinyale giden yol iki merdivenden geçiyor.',
    brief: 'Önce sağa tırmanan bir merdiven, sonra sola inen bir merdiven. Her merdiven için bir döngü kur.',
    waves: [route('FRFRFRFLFLFL', { start: 1, crystals: [2, 6, 10] })],
    tools: [...MOVES, 'repeat'], maxBlocks: 8, par: 6,
    solution: () => [rep(3, F(), R()), rep(3, F(), L())],
    hint: 'İlk döngü: düz, sağa. İkinci döngü: düz, sola. İkisi de üçer kez.',
  }),
  alarm(5, 4, mission({
    title: 'Korsan Baskını', tools: EVENT_TOOLS, events: ['pirate'], conds: ['ahead'],
    alarm: 'Kızıl Kanca beş gemisini birden üstümüze saldı! Kalkanı her biri için elle açmaya blok yetmez.',
    brief: 'Beş korsan, arada meteorlar. Olayın her korsanda yeniden çalışır; döngün meteorlara baksın.',
    waves: [route('FFRFFFFRFFFF', { start: 1, pirates: [2, 4, 6, 9, 11], crystals: [3, 7, 10] })],
    solution: () => [on('pirate', shield()), forever(ifelse('ahead', [R()], [F()]))],
    hint: 'Korsan olayı en başta, döngünün dışında dursun. Kalkan bir saldırıyı durdurur, olay onu yeniden açar.',
  })),
  alarm(6, 6, mission({
    title: 'Kayan İstasyonlar', tools: ENERGY_TOOLS, conds: ['atEnergy'],
    alarm: 'Enerji hatları koptu: şarj istasyonları yerinden oynuyor! Yerlerini ezberleyemeyiz.',
    brief: 'İstasyonlar her dalgada başka sırada. 3 enerjiyle kalk; **şarjdaysan** 3 ekle, sonra hep düz uç.',
    waves: [[3, 6, 9], [2, 5, 8, 11], [3, 5, 8, 11]].map((energy) => route('FFFFFFFFFFFF', { energy, crystals: [1, 4, 7, 10].filter((y) => !energy.includes(y)) })),
    solution: () => [setEnergy(3), forever(ifelse('atEnergy', [addEnergy(3)], []), F())],
    hint: 'Döngüde önce "şarjda mıyım?" diye sor; şarjdaysan 3 ekle. Düz uç, eğer bloğunun dışında olsun.',
  })),
];

export const extraById = (id) => EXTRAS.find((l) => l.id === id);
/** Bir ana görev, kendisinden ya da öteki yolundan yıldız alındıysa geçilmiştir. */
export const wonEither = (store, level) => store.stars(level.id) > 0 || (!!level.alt && store.stars(level.alt) > 0);
export const extrasOf = (sectorId) => EXTRAS.filter((l) => l.sector === sectorId);
/** Ana ya da yan, kimliği verilen görev. */
export const findLevel = (id) => levelById(id) || extraById(id);
export const ALL_LEVELS = [...LEVELS, ...EXTRAS];
