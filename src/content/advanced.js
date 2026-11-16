// Sektör 4–8: her görevde yeni kavramı kullanan, oynanarak doğrulanan rotalar.
import { F, L, R, rep, forever, ifelse, until, on, shield, setEnergy, addEnergy, define, call, count, CONTAINERS } from '../engine/blocks.js';

const MOVES = ['fwd', 'left', 'right'];
const LOOPS = [...MOVES, 'repeat', 'forever', 'ifelse', 'until'];
const EVENT_TOOLS = [...LOOPS, 'on', 'shield'];
const ENERGY_TOOLS = [...EVENT_TOOLS, 'setEnergy', 'addEnergy'];
const ALL_TOOLS = [...ENERGY_TOOLS, 'define', 'call'];
const SENSORS = ['ahead', 'rightFree', 'leftFree'];
const cruise = () => forever(F());
const steer = () => ifelse('ahead', [ifelse('rightFree', [R()], [L()])], [F()]);
const steerAnd = () => ifelse('aheadAndRightFree', [R()], [F()]);
// İki ayrı sebep, tek hareket: mor halkada da meteor görünce de sağa kaç.
const steerOr = () => ifelse('atBeaconOrAhead', [R()], [F()]);

// Yolun her harfi bir uçuş adımıdır; son adım çıkış çizgisini geçer.
// Büyük harfli kaçışın (L, R) önüne meteor konur; böylece sensör gözle görünen engeli okur.
// Kaçılmayan yan da kapatılır: tek yöne kaçan program geçemez, iki yana da bakan geçer.
// Küçük harf (l, r) meteorsuz dönüştür: sensörlerin göremediği, mor halkanın haber verdiği dönüş.
function route(path, { start = 2, lanes = 5, beacons = [], pirates = [], energy = [], crystals = [], extra = [] } = {}) {
  const board = Array.from({ length: path.length }, () => Array(lanes).fill('.'));
  const positions = [start];
  for (let y = 1; y < path.length; y++) {
    const step = path[y - 1], delta = { F: 0, L: -1, R: 1 }[step.toUpperCase()], before = positions[y - 1], lane = before + delta;
    if (lane < 0 || lane >= lanes) throw new Error(`Rota şerit dışına çıkıyor: ${path}`);
    positions.push(lane);
    if (!delta || step !== step.toUpperCase()) continue;
    board[y][before] = 'M';
    const other = before - delta;
    if (other >= 0 && other < lanes) board[y][other] = 'M';
  }
  for (const [lane, y] of extra) {
    if (positions[y] === lane) throw new Error('Meteor rotanın üstünde');
    board[y][lane] = 'M';
  }
  for (const [symbol, steps] of [['B', beacons], ['P', pirates], ['E', energy], ['K', crystals]]) {
    for (const y of steps) {
      if (y < 1 || y >= path.length || board[y][positions[y]] !== '.') throw new Error(`Nesneler çakışıyor: ${path}, ${y}`);
      board[y][positions[y]] = symbol;
    }
  }
  board[0][start] = 'S';
  return board.reverse().map((r) => r.join(''));
}

const beaconWaves = (stops = [2, 4, 6], rows = 10) => stops.map((n) => route('F'.repeat(n) + 'R' + 'F'.repeat(rows - n - 1), {
  beacons: [n], crystals: [n + 1], extra: Array.from({ length: n }, (_, i) => [3, i + 1]),
}));
const safePaths = ['FRLFFRLFFF', 'FLRFLRFFFF', 'RFLRFLFFFF'];
const safeWaves = (options = {}) => safePaths.map((p) => route(p, options));
const longPaths = ['FRLFFRLFFFFF', 'FLRFFLRFFFFF', 'RFLFFRLFFFFF'];
const energyWaves = (options = {}) => longPaths.map((p) => route(p, { energy: [3, 6, 9], ...options }));
// Zikzak sayısı dalgadan dalgaya değişir. Halkadan sonra sağ şerit kapalıdır: zikzağı sürdüren çarpar.
const zigzagWaves = (counts = [2, 3, 4], rows = 10) => counts.map((n) => route('RL'.repeat(n) + 'F'.repeat(rows - 2 * n), {
  beacons: [2 * n], crystals: [2, 2 * n + 1], extra: [[3, 2 * n + 1]],
}));
// Dar geçit: mor halka bir meteor duvarının tek kapısında durur; iki sıra ileride ikinci duvar vardır
// ve onun boşluğu sağdadır. Kapıdan düz çıkan gemi ikinci duvara sıkışır; halkadaki sağa dönüşü (r)
// sensörler göremez. Geçitten önce de sonra da iki yöne kaçış gerekir.
const GATE = [[0, 5], [2, 5], [3, 5], [4, 5], [0, 7]];
// Son dalgada geçitten çıkınca sol yan kapalı, sağ yan çıkmaz sokaktır: meteor yokken de
// kaçan (hep çapraz giden ya da boş buldukça sağa kayan) program orada çarpar.
const wallRoutes = [['FRLFFrRRLFFF', []], ['FLRFFrRLFRFF', []], ['RFLFFrRFLRFF', [[2, 8]]]];
const wallWaves = (options = {}) => wallRoutes.map(([p, sides]) => route(p, { start: 1, beacons: [5], extra: [...GATE, ...sides], ...options }));

/**
 * Görev tanımını tamamlar: hedef blok sayısı örnek çözümden, palet çözümde ve hazır programda
 * geçen bloklardan çıkar. `rev`, görev baştan tasarlandığında artırılır; eski tasarım için
 * kaydedilmiş program yeniden açılmaz (bkz. levels.js, saveKey).
 */
function mission(options) {
  const solution = options.solution(), par = count(solution), types = new Set(MOVES);
  const visit = (list) => { for (const b of list) { types.add(b.type); for (const key of CONTAINERS[b.type] || []) visit(b[key]); } };
  visit(solution);
  if (options.initial) visit(options.initial());
  // Yeni kavramlar kendi görevinde açılır; gereksiz bloklar paleti doldurmaz.
  const tools = (options.tools || LOOPS).filter((t) => types.has(t));
  return { conds: [], events: [], functions: [], maxBlocks: par + 2, par, ...options, tools };
}

export const ADVANCED_SECTORS = [
  {
    id: 4, name: 'Karanlık Bulutsu', concept: '…olana kadar · ve / veya', hue: 265,
    intro: {
      title: 'Kaç adım değil, ne zamana kadar?',
      text: 'Mor halkaya varınca döngüyü bitir. VE iki koşulun birlikte, VEYA en az birinin doğru olmasını ister. Koşulun üstüne dokunarak değiştirebilirsin.',
      demo: () => [until('atBeacon', F()), R()],
    },
  },
  {
    id: 5, name: 'Korsan Bölgesi', concept: 'Olaylar', hue: 0,
    intro: {
      title: 'Bir olay olunca harekete geç',
      text: 'Olay bloklarını uçuş döngüsünden önce yerleştir. Kırmızı korsan gemisi görünce kalkan aç! Kalkan bir saldırıyı durdurur; sonraki korsanda yeniden açılır.',
      demo: () => [on('pirate', shield()), cruise()],
    },
  },
  {
    id: 6, name: 'Enerji Krizi', concept: 'Değişkenler', hue: 150,
    intro: {
      title: 'Enerjinin değeri değişir',
      text: 'Enerji bir sayı tutan değişkendir. Her uçuş adımı 1 enerji harcar. Başlangıç değerini ayarla; yeşil şarj istasyonlarında enerji ekle. Depo en çok 9 enerji alır. Sayılara dokunarak değerleri değiştir.',
      demo: () => [setEnergy(3), rep(3, F()), addEnergy(3)],
    },
  },
  {
    id: 7, name: 'Manevra Okulu', concept: 'Fonksiyonlar', hue: 50,
    intro: {
      title: 'Bir kez tanımla, tekrar çağır',
      text: 'Bir hareket grubuna ad ver: bu senin fonksiyonun. Tanım tek başına uçmaz; aynı adlı çağır bloğu içindeki komutları çalıştırır. Adına dokunarak manevrayı seç.',
      demo: () => [define('zigzag', R(), L()), rep(4, call('zigzag'))],
    },
  },
  {
    id: 8, name: 'Ana Gemi', concept: 'Büyük final', hue: 300,
    intro: {
      title: 'Kendi otopilotunu tamamla',
      text: 'Ana gemiye giden rotada bütün bilgilerini birleştir: sensörler yolu seçsin, olaylar kalkanı ve şarjı yönetsin, fonksiyonlar manevraları taşısın.',
      demo: () => [define('protect', shield()), on('pirate', call('protect')), cruise()],
    },
  },
];

const beaconSolution = () => [until('atBeacon', F()), R(), cruise()];
const andSolution = () => [until('atBeacon', steerAnd()), cruise()];
const orSolution = () => [forever(steerOr())];
const energyLoop = () => [setEnergy(3), forever(ifelse('atEnergy', [addEnergy(3), F()], [F()]))];
const zigzag = () => define('zigzag', R(), L());
// Bileşik koşullu karar: meteor VE sağ boşsa sağa; kalan durumda meteor varsa sola; yoksa düz.
const steerCompound = () => ifelse('aheadAndRightFree', [R()], [ifelse('ahead', [L()], [F()])]);
const finalSolution = (initialEnergy = 3, compound = false) => [
  define('safe', compound ? steerCompound() : steer()),
  define('protect', shield()),
  on('pirate', call('protect')), on('energy', addEnergy(3)), setEnergy(initialEnergy),
  until('atBeacon', call('safe')), rep(2, F()),
];
const finalWaves = () => energyWaves({ beacons: [10], pirates: [2, 5, 8], crystals: [1, 4, 7, 11] });

export const ADVANCED_LEVELS = [
  // ───────────── 4 · Olana kadar, VE / VEYA ─────────────
  mission({
    kind: 'tanis', title: 'Mor İşaret',
    brief: 'Mor halkaya varınca döngü durur. Sonra **sağa kaç** ve çıkışa kadar **düz uç**. Eksik uçuş döngüsünü ekle.',
    waves: beaconWaves([3], 7), conds: ['atBeacon'],
    initial: () => [until('atBeacon', F()), R()], solution: beaconSolution,
    hint: 'İşaret döngüyü bitirir; uçuşu bitirmez. Sağa kaçıştan sonra sürekli düz uç.',
  }),
  mission({
    kind: 'dene', title: 'İşaret Yer Değiştiriyor',
    brief: 'Halka her dalgada başka sırada. Kaç adım olduğunu sayma: **işarete varana kadar** uç. Döngünün içini tamamla.',
    waves: beaconWaves(), conds: ['atBeacon'],
    initial: () => [until('atBeacon'), R(), cruise()], solution: beaconSolution,
    hint: 'Olana kadar bloğunun içine düz uç koy. Üç farklı işarette de durmalı.',
  }),
  mission({
    kind: 'dene', title: 'İki Koşul Birlikte',
    brief: '**Meteor varsa VE sağın boşsa** sağa kaç; değilse düz uç. Eksik kaçışı ekle, mor halkadan sonra düz devam et.',
    waves: [route('FRFFRFFF', { beacons: [6], crystals: [2, 5] })], conds: ['atBeacon', 'aheadAndRightFree'],
    initial: () => [until('atBeacon', ifelse('aheadAndRightFree', [], [F()])), cruise()], solution: andSolution,
    hint: 'VE koşulunda ikisi de doğru olmalı. Üst dala sağa kaç koy.',
  }),
  mission({
    kind: 'pekistir', title: 'İkisinden Biri Yeter', rev: 2,
    brief: 'Mor halkadaysan **VEYA** önünde meteor varsa sağa kaç; ikisi de yoksa düz uç. Koşulun doğru olması için birinin olması yeter.',
    waves: [route('FFrFRFFFF', { start: 1, beacons: [2], crystals: [3, 6] })], conds: ['atBeaconOrAhead'], solution: orSolution,
    hint: 'Sürekli tekrarla içine eğer / değilse koy; koşulu VEYA sensörü olsun. Üst dala sağa kaç, alt dala düz uç.',
  }),
  mission({
    kind: 'pekistir', title: 'İki Durak',
    brief: 'İlk mor halkaya kadar düz uç, sağa kaç. İkinci halkaya kadar düz uç, sola kaç ve çıkışa devam et.',
    waves: [route('FFFRFFLFFF', { beacons: [3, 6], crystals: [4, 7] })], conds: ['atBeacon'],
    solution: () => [until('atBeacon', F()), R(), until('atBeacon', F()), L(), cruise()],
    hint: 'İlk halkadan bir kaçışla ayrıldıktan sonra ikinci olana kadar döngüsü başlayabilir.',
  }),
  mission({
    kind: 'pekistir', title: 'Bulutsuda Sensörler',
    brief: 'Halkaya kadar meteorları sensörlerle aş. Sağ doluysa sola kaç. Halkadan sonra yol düz; üç dalgayı da geç.',
    waves: safeWaves({ beacons: [7], crystals: [3, 6] }), conds: ['atBeacon', ...SENSORS],
    solution: () => [until('atBeacon', steer()), cruise()],
    hint: 'Olana kadar döngüsünün içine iki sensörlü karar ağacını koy.',
  }),
  mission({
    kind: 'hata', title: 'VE mi VEYA mı?', rev: 2,
    brief: 'Bu program meteoru görse de kaçmıyor: halka ile meteorun birlikte olmasını bekliyor. Koşula dokun: burada **VE** mi, **VEYA** mı olmalı?',
    waves: [route('FFRFFrRFF', { start: 1, beacons: [5], crystals: [4, 7] })], conds: ['atBeaconAndAhead', 'atBeaconOrAhead'],
    initial: () => [forever(ifelse('atBeaconAndAhead', [R()], [F()]))], solution: orSolution,
    hint: 'Mor halkada da kaçmalı, meteor görünce de. Birinin doğru olması yetmeli: VEYA sensörünü seç.',
  }),
  mission({
    kind: 'final', title: 'Bulutsu Finali',
    brief: 'Mor işarete kadar iki yönü de denetle: meteor **VE** sağ boşsa sağa; başka bir meteor varsa sola; yoksa düz.',
    waves: longPaths.map((p) => route(p, { beacons: [9], crystals: [3, 6] })), conds: ['atBeacon', 'aheadAndRightFree', 'ahead'],
    solution: () => [until('atBeacon', ifelse('aheadAndRightFree', [R()], [ifelse('ahead', [L()], [F()])])), cruise()],
    hint: 'VE koşulunun değilse dalına ikinci bir eğer koy: önünde meteor var mı?',
  }),

  // ───────────── 5 · Olaylar ─────────────
  mission({
    kind: 'tanis', title: 'Korsan Alarmı', tools: EVENT_TOOLS, events: ['pirate'], rev: 2,
    brief: 'Kırmızı gemiler korsan! **Korsan görünce** bloğunun içine **kalkan aç** koy. Olay her korsanda kendiliğinden yeniden çalışır.',
    waves: [route('FFFFFFF', { pirates: [2, 5], crystals: [3] })],
    initial: () => [on('pirate'), cruise()], solution: () => [on('pirate', shield()), cruise()],
    hint: 'Kalkan aç bloğunu sarı olay bloğunun içine bırak; en başa ya da uçuş döngüsünün içine değil.',
  }),
  mission({
    kind: 'dene', title: 'İşaretten Gelen Uyarı', tools: EVENT_TOOLS, events: ['beacon', 'crystal'], rev: 2,
    brief: 'Mor işaretler korsanlardan önce geliyor. Olayın adını **işarete varınca** yap; kalkan bir sonraki saldırıya kadar açık kalır.',
    waves: [route('FFFFFFFFF', { beacons: [2, 5], pirates: [4, 7], crystals: [8] })],
    initial: () => [on('crystal', shield()), cruise()], solution: () => [on('beacon', shield()), cruise()],
    hint: 'Olay bloğunun adına dokun. Kristal korsandan sonra geliyor, uyarı için geç!',
  }),
  mission({
    kind: 'dene', title: 'Kristal Sinyali', tools: EVENT_TOOLS, events: ['crystal', 'beacon'], rev: 2,
    brief: 'Kristali toplayınca kalkan açılsın. Olayın içini tamamla ve iki korsanın yanından güvenle geç.',
    waves: [route('FFFFFFFF', { crystals: [2, 5], pirates: [4, 7] })],
    initial: () => [on('crystal'), cruise()], solution: () => [on('crystal', shield()), cruise()],
    hint: 'Kalkan aç bloğu, kristal toplayınca olayının içinde olmalı.',
  }),
  mission({
    kind: 'pekistir', title: 'Meteor ve Korsan', tools: EVENT_TOOLS, events: ['pirate'], conds: ['ahead'],
    brief: 'Meteorları sağa kaçarak aş, korsanlara kalkanla karşılık ver. Sensör kararları ile olaylar birlikte çalışabilir.',
    waves: [route('FFRFFRFFFF', { pirates: [2, 5, 8], crystals: [3, 6] })],
    solution: () => [on('pirate', shield()), forever(ifelse('ahead', [R()], [F()]))],
    hint: 'Kalkan meteorları durdurmaz; önünde meteor varsa yine kaçmalısın.',
  }),
  mission({
    kind: 'pekistir', title: 'İki Ayrı Haberci', tools: EVENT_TOOLS, events: ['beacon', 'crystal'],
    brief: 'Korsan sensörü kapalı. Hem mor işaret hem kristal kalkanı açsın. Her saldırıdan sonra yeni bir uyarı gerekiyor.',
    waves: [route('FFFFFFFFFF', { beacons: [2, 8], crystals: [5], pirates: [3, 6, 9] })],
    solution: () => [on('beacon', shield()), on('crystal', shield()), cruise()],
    hint: 'İki olay bloğu ekle. Her birinin içine kendi kalkan aç bloğunu koy.',
  }),
  mission({
    kind: 'pekistir', title: 'Değişen Devriye', tools: EVENT_TOOLS, events: ['pirate'], conds: SENSORS,
    brief: 'Üç dalgada da meteorlar ve korsanlar var. Önce olayını hazırla, sonra iki sensörle güvenli yönü seç.',
    waves: safeWaves({ pirates: [2, 5, 8], crystals: [3, 6] }),
    solution: () => [on('pirate', shield()), forever(steer())],
    hint: 'Korsan olayı kalkanı açarken, eğer blokları meteorlar için yol seçer.',
  }),
  mission({
    kind: 'hata', title: 'Yanlış Alarm', tools: EVENT_TOOLS, events: ['pirate', 'beacon', 'crystal'],
    brief: 'Kalkan komutu doğru ama hiç çalışmıyor. Beklenen olay doğru mu? Olayın adını değiştirerek programı düzelt.',
    waves: [route('FFFFFFFF', { pirates: [2, 5], crystals: [6] })],
    initial: () => [on('beacon', shield()), cruise()], solution: () => [on('pirate', shield()), cruise()],
    hint: 'Bu rotada mor işaret yok. Kalkan korsan görünce açılmalı.',
  }),
  mission({
    kind: 'final', title: 'Korsan Bölgesi Finali', tools: EVENT_TOOLS, events: ['pirate'], conds: ['atBeacon', ...SENSORS],
    brief: 'Mor işarete kadar meteorları aş, sonra düz uç. Korsanlar iki tarafta da saldırabilir; olayın bütün uçuşu korusun.',
    waves: safeWaves({ beacons: [7], pirates: [2, 5, 8], crystals: [3, 6] }),
    solution: () => [on('pirate', shield()), until('atBeacon', steer()), cruise()],
    hint: 'Korsan olayını olana kadar döngüsünün dışında, en başta kur.',
  }),

  // ───────────── 6 · Değişkenler ─────────────
  mission({
    kind: 'tanis', title: 'İlk Enerji Değeri', tools: ENERGY_TOOLS,
    brief: 'Altı uçuş adımı için **6 enerji** gerekiyor. Enerji bloğundaki sayıya dokun; uçarken değerin azalışını izle.',
    waves: [route('FFFFFF', { energy: [3], crystals: [2, 4] })],
    initial: () => [setEnergy(2), rep(6, F())], solution: () => [setEnergy(6), rep(6, F())],
    hint: 'Çıkış çizgisini geçmek de bir adım. Başlangıç enerjisini 6 yap.',
  }),
  mission({
    kind: 'dene', title: 'Şarj Molaları', tools: ENERGY_TOOLS, rev: 2,
    brief: 'Üç adımda bir yeşil şarj istasyonu var. Her molada **enerjiye 3 ekle**, sonra 3 adım uç. Yanlış sayıyı düzelt ve son molayı ekle.',
    // Yol depodan (9) uzun: baştan 9 enerji alıp hiç şarj etmeden bitirilemez.
    waves: [route('FFFFFFFFFFFF', { energy: [3, 6, 9], crystals: [2, 5, 8, 11] })],
    initial: () => [setEnergy(3), rep(3, F()), addEnergy(3), rep(3, F()), addEnergy(1), rep(3, F())],
    solution: () => [setEnergy(3), rep(3, F()), addEnergy(3), rep(3, F()), addEnergy(3), rep(3, F()), addEnergy(3), rep(3, F())],
    hint: 'Her istasyonda enerjiye 3 ekle. Şarj komutu gemiyi ilerletmez; ardından yine 3 adım uç.',
  }),
  mission({
    kind: 'dene', title: 'İstasyona Bak', tools: ENERGY_TOOLS, conds: ['atEnergy'],
    brief: 'Başlangıç enerjisi hazır. İstasyondaysan **3 enerji ekle ve düz uç**; değilse düz uç. Eksik dalı doldur.',
    waves: [route('FFFFFFFFFFFF', { energy: [3, 6, 9], crystals: [2, 5, 8, 11] })],
    initial: () => [setEnergy(3), forever(ifelse('atEnergy', [], [F()]))], solution: energyLoop,
    hint: 'Şarjdan sonra aynı dalda düz uç da olmalı; yoksa gemi istasyonda bekler.',
  }),
  mission({
    kind: 'pekistir', title: 'Azalan Sayı', tools: ENERGY_TOOLS, conds: ['energyLow'],
    brief: 'Enerji **3’ten azsa** istasyonda 3 ekle, sonra uç. İstasyonlar bu düşük enerji anlarına göre yerleştirildi.',
    waves: [route('FFFFFFFFFFFF', { energy: [1, 4, 7, 10], crystals: [2, 5, 8, 11] })],
    solution: () => [setEnergy(3), forever(ifelse('energyLow', [addEnergy(3), F()], [F()]))],
    hint: 'Enerji = 3 başlangıçta koşulu sağlamaz. İlk uçuş sonrası enerji 2 olur.',
  }),
  mission({
    kind: 'pekistir', title: 'Gerektiği Kadar Şarj', tools: ENERGY_TOOLS, conds: ['atEnergy', 'energyLow'], rev: 2,
    brief: '6 enerjiyle başla. Depo en çok 9 alır; taşarsa uçuş biter! Yalnızca **istasyondaysan** ve **enerji 3’ten azsa** 6 ekle: sonrası uzun yol.',
    // İstasyonlar art arda, sonra sekiz sıra boş: her istasyonda şarj eden taşar, yalnızca enerjiye bakan istasyon dışında şarja kalkar.
    waves: [route('FFFFFFFFFFFF', { energy: [1, 2, 3, 4], crystals: [5, 7, 9, 11] })],
    solution: () => [setEnergy(6), forever(ifelse('atEnergy', [ifelse('energyLow', [addEnergy(6)], [])], []), F())],
    hint: 'İstasyon koşulunun içine enerji koşulunu koy. Düz uç, iki eğer bloğunun da dışında olsun.',
  }),
  mission({
    kind: 'pekistir', title: 'Enerjili Manevralar', tools: ENERGY_TOOLS, conds: ['atEnergy', ...SENSORS],
    brief: 'Sağa ve sola kaçış da 1 enerji harcar. İstasyonda 3 enerji ekle, sonra sensörlerle yol seç; üç dalgayı da geç.',
    waves: energyWaves({ crystals: [2, 5, 8, 11] }),
    solution: () => [setEnergy(3), forever(ifelse('atEnergy', [addEnergy(3)], []), steer())],
    hint: 'Döngüde önce şarjı denetle, sonra meteorlar için manevranı seç.',
  }),
  mission({
    kind: 'hata', title: 'Sıfırla Kalkılmaz', tools: ENERGY_TOOLS, conds: ['atEnergy'],
    brief: 'Şarj mantığı doğru ama gemi kalkamıyor. Enerji değişkeninin başlangıç değerini düzelt.',
    waves: [route('FFFFFFFFFFFF', { energy: [3, 6, 9], crystals: [2, 5, 8, 11] })],
    initial: () => [setEnergy(0), forever(ifelse('atEnergy', [addEnergy(3), F()], [F()]))], solution: energyLoop,
    hint: 'İlk istasyon üç adım uzakta. Başlangıçta en az 3 enerji gerekli.',
  }),
  mission({
    kind: 'final', title: 'Enerji Krizi Finali', tools: ENERGY_TOOLS, events: ['energy', 'pirate'], conds: SENSORS,
    brief: 'Şarja varınca 3 enerji ekle, korsan görünce kalkan aç. 3 enerjiyle başla; sensörler geminin yolunu seçsin.',
    waves: energyWaves({ pirates: [2, 5, 8], crystals: [1, 4, 7, 11] }),
    solution: () => [on('energy', addEnergy(3)), on('pirate', shield()), setEnergy(3), forever(steer())],
    hint: 'İki olay da uçuş döngüsünden önce tanımlanmalı. Her dalgada enerji baştan başlar.',
  }),

  // ───────────── 7 · Fonksiyonlar ─────────────
  mission({
    kind: 'tanis', title: 'İlk Manevran', tools: ALL_TOOLS, functions: ['zigzag'],
    brief: '**Zikzak** tanımı bir sağa, bir sola kaçmalı. Eksik sola kaçışı tanımın içine ekle; döngü aynı manevrayı çağırır.',
    waves: [route('RLRLRLRL', { crystals: [2, 4, 6] })],
    initial: () => [define('zigzag', R()), rep(4, call('zigzag'))], solution: () => [zigzag(), rep(4, call('zigzag'))],
    hint: 'Tanımı düzeltince onu çağıran dört uçuşun hepsi düzelir.',
  }),
  mission({
    kind: 'dene', title: 'Tanımlamak Yetmez', tools: ALL_TOOLS, functions: ['zigzag'],
    brief: 'Zikzak tanımı hazır ama gemi hareket etmiyor. Bir döngü ekle ve manevranı **5 kez çağır**.',
    waves: [route('RLRLRLRLRL', { crystals: [2, 5, 8] })],
    initial: () => [zigzag()], solution: () => [zigzag(), rep(5, call('zigzag'))],
    hint: 'Tanım bir tarif gibidir. Çağır bloğu tarifi uygular.',
  }),
  mission({
    kind: 'dene', title: 'İki Tarif', tools: ALL_TOOLS, functions: ['zigzag', 'straight'],
    brief: 'İki zikzak, ardından bir düz geçiş: bu deseni iki kez yap. Düz geçiş iki düz uçuştan oluşur; eksik çağrıyı ekle.',
    waves: [route('RLRLFFRLRLFF', { crystals: [2, 5, 8, 11] })],
    initial: () => [zigzag(), define('straight', F(), F()), rep(2, call('zigzag'), call('zigzag'))],
    solution: () => [zigzag(), define('straight', F(), F()), rep(2, call('zigzag'), call('zigzag'), call('straight'))],
    hint: 'Çağır bloğunun adına dokunarak düz geçişi seç; döngüde üçüncü sıraya koy.',
  }),
  mission({
    kind: 'pekistir', title: 'Akıllı Bir Fonksiyon', tools: ALL_TOOLS, functions: ['safe'], conds: SENSORS,
    brief: '**Güvenli uçuş** fonksiyonunun içine iki sensörlü kararı koy. Sürekli bu fonksiyonu çağır; üç rotada da çalışmalı.',
    waves: safeWaves({ crystals: [3, 6] }),
    solution: () => [define('safe', steer()), forever(call('safe'))],
    hint: 'Fonksiyonlar sadece hareket değil, eğer bloklarını da içerebilir.',
  }),
  mission({
    kind: 'pekistir', title: 'İşarete Kadar Çağır', tools: ALL_TOOLS, functions: ['zigzag'], conds: ['atBeacon'], rev: 2,
    brief: 'Zikzak sayısı her dalgada farklı. **Zikzak** manevranı tanımla ve halkaya varana kadar çağır; sonra çıkışa düz uç.',
    waves: zigzagWaves(),
    solution: () => [zigzag(), until('atBeacon', call('zigzag')), cruise()],
    hint: 'Olana kadar bloğunun içine zikzak çağır koy. Halkadan sonra zikzak yapma: sağ şerit kapalı.',
  }),
  mission({
    kind: 'pekistir', title: 'Olay Fonksiyonu Çağırıyor', tools: ALL_TOOLS, functions: ['protect'], events: ['pirate'], conds: SENSORS,
    brief: '**Korunma** fonksiyonu kalkan açsın. Korsan olayı bu fonksiyonu çağırsın; uçuş döngüsü meteorlarla ilgilensin.',
    waves: safeWaves({ pirates: [2, 5, 8], crystals: [3, 6] }),
    solution: () => [define('protect', shield()), on('pirate', call('protect')), forever(steer())],
    hint: 'Önce korunmayı tanımla; sonra korsan olayının içine aynı adlı çağrıyı koy.',
  }),
  mission({
    kind: 'hata', title: 'Adlar Eşleşmiyor', tools: ALL_TOOLS, functions: ['zigzag', 'straight'],
    brief: 'Program tanımlanmamış bir manevrayı çağırıyor. Tanım ile çağrıların adlarını eşleştir.',
    waves: [route('RLRLRLRL', { crystals: [2, 4, 6] })],
    initial: () => [zigzag(), rep(4, call('straight'))], solution: () => [zigzag(), rep(4, call('zigzag'))],
    hint: 'Tarifin adı zikzak. Çağır bloğundaki düz geçiş adını değiştir.',
  }),
  mission({
    kind: 'final', title: 'Manevra Okulu Finali', tools: ALL_TOOLS, functions: ['safe'], events: ['pirate'], conds: ['atBeacon', ...SENSORS], rev: 2,
    brief: 'Güvenli uçuşu tanımla, halkaya kadar çağır. Halkada **sağa kaç**: öndeki duvarı sensörler aşamaz. Sonra yine güvenli uçuşu çağır. Korsanları unutma!',
    waves: wallWaves({ pirates: [2, 9], crystals: [3, 6, 10] }),
    solution: () => [define('safe', steer()), on('pirate', shield()), until('atBeacon', call('safe')), R(), forever(call('safe'))],
    // Fonksiyonsuz yazım (karar ağacı iki döngüde iki kez) bu sınıra sığmaz.
    maxBlocks: 14,
    hint: 'Aynı fonksiyon iki döngüden çağrılır: önce olana kadar, sağa kaçıştan sonra sürekli tekrarla. Tanımı bir kez yazman yeter.',
  }),

  // ───────────── 8 · Bütün kavramların birleştiği final ─────────────
  mission({
    kind: 'tanis', title: 'Ana Gemiye Doğru', tools: ALL_TOOLS, events: ['pirate'], conds: ['atBeacon', ...SENSORS],
    brief: 'Son sektöre hoş geldin! Sensörlü rota hazır. Korsan olayına eksik **kalkan aç** bloğunu ekle ve üç dalgayı geç.',
    waves: safeWaves({ beacons: [7], pirates: [2, 5, 8], crystals: [3, 6] }),
    initial: () => [on('pirate'), until('atBeacon', steer()), cruise()],
    solution: () => [on('pirate', shield()), until('atBeacon', steer()), cruise()],
    hint: 'Korsan olayı hem halkaya kadar hem de halkadan sonra çalışır.',
  }),
  mission({
    kind: 'dene', title: 'Otopilotun Beyni', tools: ALL_TOOLS, functions: ['safe'], conds: SENSORS,
    brief: 'Sürekli güvenli uçuş çağrılıyor ama tanım boş. Sensörlerle karar veren fonksiyonun içini tamamla.',
    waves: safeWaves({ crystals: [3, 6] }),
    initial: () => [define('safe'), forever(call('safe'))],
    solution: () => [define('safe', steer()), forever(call('safe'))],
    hint: 'Fonksiyonda meteor varsa sağın boşluğunu denetle; meteor yoksa düz uç.',
  }),
  mission({
    kind: 'dene', title: 'Otomatik Şarj', tools: ALL_TOOLS, events: ['energy'],
    brief: 'Üç enerjiyle başlıyoruz. **Şarja varınca** olayının içine 3 enerji eklemeyi koy; uzun uçuş kesilmesin.',
    waves: [route('FFFFFFFFFFFF', { energy: [3, 6, 9], crystals: [2, 5, 8, 11] })],
    initial: () => [on('energy'), setEnergy(3), cruise()],
    solution: () => [on('energy', addEnergy(3)), setEnergy(3), cruise()],
    hint: 'Olayın içindeki enerji komutu, istasyona vardığın anda çalışır.',
  }),
  mission({
    kind: 'pekistir', title: 'Mantık ve Savunma', tools: ALL_TOOLS, events: ['pirate'], conds: ['atBeacon', 'aheadAndRightFree'],
    brief: 'Meteor **VE** sağ boşsa sağa kaç, yoksa düz uç. İşaretten sonra düz devam et. Korsanlara olayla karşılık ver.',
    waves: ['FFRFFRFFFF', 'FRFFRFFFFF'].map((p) => route(p, { beacons: [7], pirates: [2, 5, 8], crystals: [3, 6] })),
    solution: () => [on('pirate', shield()), until('atBeacon', steerAnd()), cruise()],
    hint: 'Kalkanı hareketlerin arasına elle dizme; korsan olayına yerleştir.',
  }),
  mission({
    kind: 'pekistir', title: 'Şarj Tarifin', tools: ALL_TOOLS, functions: ['refuel'], events: ['energy'], conds: SENSORS,
    brief: '**Enerji takviyesi** fonksiyonu 3 enerji eklesin. Şarj olayı fonksiyonu çağırsın. Uçuşu sensörlerle yönet.',
    waves: energyWaves({ crystals: [2, 5, 8, 11] }),
    solution: () => [define('refuel', addEnergy(3)), on('energy', call('refuel')), setEnergy(3), forever(steer())],
    hint: 'Şarj fonksiyonunu yalnızca şarja varınca çağır: başka yerde enerji eklenmez.',
  }),
  mission({
    kind: 'pekistir', title: 'İki Fonksiyonlu Pilot', tools: ALL_TOOLS, functions: ['safe', 'protect'], events: ['pirate'], conds: SENSORS, rev: 2,
    brief: 'Güvenli uçuş yolu seçsin, korunma kalkanı açsın. Korsan olayı korunmayı, uçuş döngüsü güvenli uçuşu çağırsın.',
    waves: longPaths.map((p) => route(p, { pirates: [2, 5, 8], crystals: [3, 6, 10] })),
    solution: () => [define('safe', steer()), define('protect', shield()), on('pirate', call('protect')), forever(call('safe'))],
    hint: 'İki tanımın adları farklı olmalı. Her çağrı kendi tanımıyla eşleşmeli.',
  }),
  mission({
    kind: 'hata', title: 'Kalkıştan Önce Son Kontrol', tools: ALL_TOOLS, functions: ['safe', 'protect'], events: ['pirate', 'energy'], conds: ['atBeacon', ...SENSORS],
    brief: 'Otopilotta tek bir yanlış değer var. Enerjiyi adım adım izle; ilk istasyona ulaşmaya yetecek şekilde düzelt.',
    waves: finalWaves(), initial: () => finalSolution(2), solution: () => finalSolution(),
    hint: 'İlk istasyon üçüncü sırada. 2 enerji yetmez; başlangıç değerini 3 yap.',
  }),
  mission({
    kind: 'final', title: 'Ana Gemiye Dönüş', tools: ALL_TOOLS, functions: ['safe', 'protect'], events: ['pirate', 'energy'], conds: ['atBeacon', 'aheadAndRightFree', 'ahead'], rev: 2,
    brief: 'Büyük final! Güvenli uçuş: meteor **VE** sağ boşsa sağa, başka meteor varsa sola, yoksa düz. Olaylarla şarj ol ve korun; halkadan sonra iki kez düz uç.',
    waves: finalWaves(), solution: () => finalSolution(3, true),
    hint: 'Önce iki fonksiyon ve iki olay. 3 enerjiyle kalk. Halkaya kadar güvenli uçuşu çağır; sonunda 2 düz uçuş.',
  }),
];
