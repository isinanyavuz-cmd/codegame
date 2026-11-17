// Yan görevler: ana yolun dışındaki görevler. Her biri bir sektöre bağlıdır ve
// haritada o sektörün yolunun yanında durur. Türleri:
//   gizli   sektörde yeterince yıldız toplanınca açılır; ödülü Bip'in bir arkadaşıdır
//   acil    bir ana görev bitince araya giren beklenmedik görev (bir kez haber verilir)
// Alanları ana görevlerle aynıdır; ek olarak `extra` (tür), `after` (haritada yanında
// durduğu ana görev) ve `open(store)` (açık mı) taşırlar. Ana yolu kilitlemezler.
import { F, L, R, rep, forever, ifelse, until, on, shield, setEnergy, addEnergy, define, call } from '../engine/blocks.js';
import { genWaves } from './gen.js';
import { route, mission, wallWaves, steer, cruise, MOVES, LOOPS, EVENT_TOOLS, ENERGY_TOOLS, ALL_TOOLS, SENSORS } from './advanced.js';
import { LEVELS, levelById, levelsOf } from './levels.js';

/** Gizli görevin açılması için sektörde toplanması gereken yıldız (24 üzerinden). */
export const SECRET_STARS = 20;
export const EXTRA_LABEL = { gizli: 'GİZLİ GÖREV', acil: 'ACİL DURUM' };
export const sectorStars = (store, sector) => levelsOf(sector).reduce((a, l) => a + store.stars(l.id), 0);

const OPEN = {
  gizli: (l) => (store) => sectorStars(store, l.sector) >= SECRET_STARS,
  acil: (l) => (store) => store.passed(levelById(l.after)),
};

/** @param after  haritada yanında duracağı ana görevin sırası (1–8) */
function extra(kind, sector, after, def) {
  const id = `${sector}-${kind === 'gizli' ? 'g' : 'a'}`;
  const level = { conds: [], events: [], functions: [], ...def, id, saveKey: id, sector, extra: kind, kind, after: `${sector}-${after}` };
  level.open = OPEN[kind](level);
  return level;
}
const secret = (sector, def) => extra('gizli', sector, 8, def);
const alarm = (sector, after, def) => extra('acil', sector, after, def);

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
  secret(8, mission({
    title: 'Atlas\'ın Kalbi', tools: ALL_TOOLS, functions: ['safe'], events: ['pirate', 'energy'], conds: ['atBeacon', ...SENSORS],
    brief: 'En zor rota: dar geçit, korsanlar **ve** azalan enerji. Güvenli uçuşu tanımla; olaylar kalkanı ve şarjı yönetsin. Halkada sağa kaç!',
    waves: wallWaves({ energy: [3, 6, 9], pirates: [2, 10], crystals: [4, 7, 11] }),
    solution: () => [define('safe', steer()), on('pirate', shield()), on('energy', addEnergy(3)), setEnergy(3), until('atBeacon', call('safe')), R(), forever(call('safe'))],
    maxBlocks: 17,
    hint: 'Manevra Okulu finalindeki programın aynısı; üstüne şarj olayını ve 3 enerjilik kalkışı ekle.',
  })),

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
export const extrasOf = (sectorId) => EXTRAS.filter((l) => l.sector === sectorId);
/** Ana ya da yan, kimliği verilen görev. */
export const findLevel = (id) => levelById(id) || extraById(id);
export const ALL_LEVELS = [...LEVELS, ...EXTRAS];
