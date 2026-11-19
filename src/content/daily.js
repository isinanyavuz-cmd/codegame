// Günün Dalgası: her gün değişen, tarihten üretilen tek bir görev. Aynı gün herkes aynı alanı
// görür. Zorluğu çocuğun vardığı yere göre seçilir (basamak): henüz öğrenmediği bloğu istemez.
// Sonuç ana yıldızlara eklenmez; ayrı sayılır ("kaç gün uçtun"). Seri yoktur: gün atlamak
// bir şey kaybettirmez. Saf mantık; DOM yok.
import { F, L, R, rep, forever, ifelse, on, shield, setEnergy, addEnergy, fire } from '../engine/blocks.js';
import { rng } from '../engine/rng.js';
import { parseField, simulate, pilli } from '../engine/world.js';
import { genWaves } from './gen.js';
import { route, steer, MOVES, SENSORS } from './advanced.js';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const hashOf = (text) => { let h = 7; for (const ch of text) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0; return Math.abs(h); };
const pick = (next, list) => list[Math.floor(next() * list.length)];
const MOVE = { F, L, R };
const blocksOf = (path) => [...path.toUpperCase()].map((c) => MOVE[c]());

/**
 * Çocuğun basamağı: 1 sıralama, 2 döngü, 3 sensörler, 4 + korsanlar (olay), 5 + enerji (olayla şarj).
 * @param won(id)  o görevden (ya da öteki yolundan) yıldız alındı mı
 */
export function dailyTier(won) {
  if (won('6-8')) return 5;
  if (won('5-6')) return 4;
  if (won('3-5')) return 3;
  if (won('2-4')) return 2;
  return 1;
}

/** Alanın dışına çıkmayan rastgele bir yol; en az `dodges` kaçış içerir. */
function randomPath(next, rows, lanes) {
  for (;;) {
    let lane = Math.floor(next() * lanes), path = '', dodges = 0;
    const start = lane;
    for (let y = 0; y < rows; y++) {
      const options = ['F', 'F', lane > 0 ? 'L' : null, lane < lanes - 1 ? 'R' : null].filter(Boolean);
      // Çıkış adımı düz olsun: son karede yana kaçış göze karışık gelir.
      const step = y === rows - 1 ? 'F' : pick(next, options);
      path += step; lane += { F: 0, L: -1, R: 1 }[step]; if (step !== 'F') dodges++;
    }
    if (dodges >= 3 && dodges <= rows - 2) return { path, start };
  }
}

function sequence(next) {
  const rows = 7 + Math.floor(next() * 3), { path, start } = randomPath(next, rows, 5);
  const crystals = [2, Math.floor(rows / 2) + 1, rows - 1].filter((y, i, a) => a.indexOf(y) === i);
  return {
    sector: 1, chip: 'Sıralama', waves: [route(path, { start, crystals })], tools: MOVES, par: rows, maxBlocks: rows + 2,
    solution: () => blocksOf(path),
    brief: 'Bugünün rotası meteorların arasından geçiyor. Yolu gözünle çiz, blokları sırayla diz ve kristalleri topla.',
    hint: `Yol ${rows} adım. Önündeki meteora bak: hangi yana kaçarsan yol açık?`,
  };
}

const UNITS = ['RL', 'LR', 'FR', 'FL', 'RFL', 'LFR', 'FFR', 'FFL', 'RRL', 'LLR'];
function loops(next) {
  for (;;) {
    const unit = pick(next, UNITS), k = 3 + Math.floor(next() * 2), tail = 2 + Math.floor(next() * 2), path = unit.repeat(k) + 'F'.repeat(tail);
    if (path.length > 12) continue;
    // Yol şeritlerin içinde kalacak bir başlangıç şeridi var mı?
    let lane = 0, lo = 0, hi = 0;
    for (const c of path.slice(0, -1)) { lane += { F: 0, L: -1, R: 1 }[c]; lo = Math.min(lo, lane); hi = Math.max(hi, lane); }
    if (hi - lo > 4) continue;
    const start = -lo + Math.floor(next() * (5 - (hi - lo)));
    const rows = path.length, crystals = [unit.length, unit.length * 2, rows - 1].filter((y, i, a) => a.indexOf(y) === i && y < rows);
    const solution = () => [rep(k, ...blocksOf(unit)), rep(tail, F())];
    return {
      sector: 2, chip: 'Döngü', waves: [route(path, { start, crystals })], tools: [...MOVES, 'repeat'], par: 3 + unit.length, maxBlocks: 5 + unit.length,
      solution,
      brief: `Bugünün rotasında bir desen saklı: ${unit.length} hareket ${k} kez tekrar ediyor, sonra düz yol. Blok sayın sınırlı!`,
      hint: 'Önce tekrar eden hareketleri bul ve bir döngüye koy; düz yol için ikinci bir döngü kur.',
    };
  }
}

const twoSensor = () => [forever(steer())];
const oneSide = (side) => [forever(ifelse('ahead', [side()], [F()]))];
const twoSensorLeft = () => [forever(ifelse('ahead', [ifelse('leftFree', [L()], [R()])], [F()]))];

/** Sensörlü dalgalar; `pirates` ve `energy` verilirse çözümün yolu üstüne korsan ve şarj istasyonu da konur. */
function sensors(next, seed, { pirates = false, energy = false } = {}) {
  const lanes = 4 + Math.floor(next() * 2), rows = energy ? 10 + Math.floor(next() * 3) : 8 + Math.floor(next() * 3);
  let waves = null;
  for (let attempt = 0; attempt < 30 && !waves; attempt++) {
    try {
      waves = genWaves({ lanes, rows, start: Math.floor(lanes / 2), density: 0.28 + next() * 0.06, seed: seed + attempt * 101, solution: twoSensor(), minDodges: 3, needBoth: true, decoys: [oneSide(R), oneSide(L)], alts: [twoSensorLeft()] });
    } catch (e) { /* bu tohumla olmadı; sıradakini dene */ }
  }
  if (!waves) throw new Error('Günün dalgası üretilemedi');
  // Çözümün uçtuğu karelere kristal, korsan ve şarj istasyonu yerleştirilir (sensörler yalnız meteora bakar: yol değişmez).
  waves = waves.map((lines) => {
    const cells = simulate(parseField(lines), twoSensor()).events.filter((e) => e.t === 'move' && !e.exit).map((e) => e.to);
    const board = lines.map((l) => [...l]), put = (y, ch) => { const c = cells.find((x) => x.y === y); board[rows - 1 - y][c.lane] = ch; };
    const stations = energy ? [3, 6, 9].filter((y) => y < rows) : [];
    const free = cells.map((c) => c.y).filter((y) => !stations.includes(y));
    const take = () => free.splice(Math.floor(next() * free.length), 1)[0];
    for (const y of stations) put(y, 'E');
    if (pirates) for (let i = 0; i < 2; i++) put(take(), 'P');
    for (let i = 0; i < 2; i++) put(take(), 'K');
    return board.map((r) => r.join(''));
  });
  const base = { waves, conds: SENSORS, tools: [...MOVES, 'forever', 'ifelse'] };
  if (energy) {
    return {
      ...base, sector: 6, chip: 'Sensör · olay · enerji', tools: [...base.tools, 'on', 'shield', 'setEnergy', 'addEnergy'], events: ['pirate', 'energy'], par: 11, maxBlocks: 13,
      solution: () => [on('pirate', shield()), on('energy', addEnergy(3)), setEnergy(3), forever(steer())],
      brief: 'Bugün her şey bir arada: meteorlar, korsanlar ve azalan enerji. 3 enerjiyle kalk; olaylar kalkanı ve şarjı yönetsin, sensörler yolu seçsin.',
      hint: 'İki olay bloğu (korsan görünce kalkan, şarja varınca 3 enerji), enerji = 3 ve iki sensörlü uçuş döngüsü.',
    };
  }
  if (pirates) {
    return {
      ...base, sector: 5, chip: 'Sensör · olay', tools: [...base.tools, 'on', 'shield'], events: ['pirate'], par: 8, maxBlocks: 10,
      solution: () => [on('pirate', shield()), forever(steer())],
      brief: 'Bugünün dalgalarında meteorların arasına korsanlar saklanmış. Olayın kalkanı açsın, sensörlerin yolu seçsin.',
      hint: 'Korsan olayını döngünün dışında, en başta kur; döngüde iki sensörle yol seç.',
    };
  }
  return {
    ...base, sector: 3, chip: 'Eğer / değilse', par: 6, maxBlocks: 8, solution: twoSensor,
    brief: 'Bugünün meteor yağmuru üç dalga. Önüne bakıp boş yana kaçan tek bir program hepsini geçmeli.',
    hint: 'Önünde meteor varsa: sağın boşsa sağa, değilse sola. Yoksa düz uç.',
  };
}

/**
 * Lazer günü (2. basamaktan sonra arada bir): bütün şeritleri kapatan kaya duvarları düzenli aralıkla
 * gelir. Pil duvar sayısı kadardır; boşa atış yapan geçemez. Döngüyle kısa yazılır.
 */
function laserDay(next) {
  const n = 3 + Math.floor(next() * 2), k = 2 + Math.floor(next() * 2), lanes = 5, rows = n * k, start = Math.floor(next() * lanes);
  const board = Array.from({ length: rows }, () => Array(lanes).fill('.'));
  for (let i = 0; i < n; i++) {
    board[1 + i * k].fill('M');
    // Duvarların arasında yer yer kristalli kaya ya da kristal: ikisi de gemi şeridinde, duvardan hemen sonra.
    if (k > 2 && next() < 0.5) board[2 + i * k][(start + 1 + Math.floor(next() * (lanes - 1))) % lanes] = 'M';
    if (2 + i * k < rows) board[2 + i * k][start] = 'K';
  }
  board[0][start] = 'S';
  const lines = pilli(board.reverse().map((r) => r.join('')), n);
  const MOVE_K = () => Array.from({ length: k }, () => F());
  return {
    sector: 2, chip: 'Döngü · lazer', waves: [lines], tools: [...MOVES, 'repeat', 'fire'], par: 2 + k, maxBlocks: 4 + k,
    solution: () => [rep(n, fire(), ...MOVE_K())],
    brief: `Bugün lazer günü! Rotada ${n} kaya duvarı var, pilin de tam ${n} atışlık. Ateş et, uç, ateş et, uç… Bu deseni bir döngüye koy.`,
    hint: `Döngünün içi: bir ateş et ve ${k} düz uç. Döngü ${n} kez dönsün.`,
  };
}

/** "17 Kasım" */
export const dayTitle = (day) => { const [, m, d] = day.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };

/**
 * O günün görevi. Aynı gün ve basamak hep aynı görevi verir.
 * @param day   'YYYY-AA-GG' (storage.js, dayOf)
 * @param tier  dailyTier() sonucu
 */
export function dailyLevel(day, tier = 1) {
  const seed = hashOf(`${day}/${tier}`), next = rng(seed);
  for (let i = 0; i < 3; i++) next();
  // Lazer, Defne kurtarılınca (1. sektör) takılır; 2. basamaktan sonra her dört günden biri lazer günüdür.
  const made = tier === 1 ? sequence(next) : seed % 4 === 1 ? laserDay(next) : tier === 2 ? loops(next) : sensors(next, seed % 100000, { pirates: tier >= 4, energy: tier >= 5 });
  const id = `gun-${day}`;
  return {
    conds: [], events: [], functions: [], ...made,
    // Basamak gün içinde değişirse (çocuk ilerlerse) görev de değişir: program basamağa göre saklanır.
    id, saveKey: `${id}@${tier}`, hash: 'gunluk', day, tier, extra: 'gunluk', kind: 'gunluk', free: true, library: true,
    title: `Günün Dalgası · ${dayTitle(day)}`,
  };
}
