// Oyun dünyası ve program yürütücü. Saf mantık; DOM yok.
//
// Alan: `lanes` şerit × `rows` sıra. Gemi (lane, y) karesindedir; y=0 başlangıç
// sırasıdır ve her uçuş komutu gemiyi bir sıra ilerletir (kaçışlar çapraz gider).
// Gemi y = rows değerine ulaşınca çıkış çizgisini geçmiş olur.
import { EVENTS, FUNCTIONS } from './blocks.js';

const key = (lane, y) => `${lane},${y}`;

/**
 * Alanı metinden okur. İlk satır en uzak sıra, son satır başlangıç sırasıdır.
 * '.' boş, M meteor (kaya), G kristalli kaya, D demir asteroit, K kristal, B işaret, P korsan,
 * E şarj, S başlangıç. Kristalli kaya da bir kayadır; lazerle kırılınca yerinde kristal kalır.
 * Demir asteroit de bir engeldir (çarpılır, sensörler görür) ama lazer onu kıramaz.
 * Satır dizisi `pilli()` ile işaretlendiyse alanın lazer pili de okunur (yoksa pil sınırsızdır).
 */
export function parseField(lines) {
  if (!Array.isArray(lines) || !lines.length || !lines[0].length) throw new Error('Alan boş olamaz');
  const rows = lines.length, lanes = lines[0].length;
  const meteors = new Set(), crystals = new Set(), geodes = new Set(), iron = new Set();
  const beacons = new Set(), pirates = new Set(), energyCells = new Set();
  let start = -1;
  lines.forEach((line, i) => {
    if (line.length !== lanes) throw new Error(`Satır uzunlukları eşit olmalı: "${line}"`);
    const y = rows - 1 - i;
    [...line].forEach((ch, lane) => {
      if (ch === 'M') meteors.add(key(lane, y));
      else if (ch === 'G') { meteors.add(key(lane, y)); geodes.add(key(lane, y)); }
      else if (ch === 'D') { meteors.add(key(lane, y)); iron.add(key(lane, y)); }
      else if (ch === 'K') crystals.add(key(lane, y));
      else if (ch === 'B') beacons.add(key(lane, y));
      else if (ch === 'P') pirates.add(key(lane, y));
      else if (ch === 'E') energyCells.add(key(lane, y));
      else if (ch === 'S') { if (y !== 0 || start >= 0) throw new Error('Son satırda yalnızca bir S olmalı'); start = lane; }
      else if (ch !== '.') throw new Error(`Bilinmeyen karakter: ${ch}`);
    });
  });
  if (start < 0) throw new Error('Başlangıç karesi (S) yok');
  const battery = Number.isInteger(lines.battery) ? lines.battery : null;
  return { lanes, rows, start, meteors, crystals, beacons, pirates, energyCells, geodes, iron, battery };
}

/**
 * Alanın satırlarına lazer pilini ekler: pilli(['..M', '.S.'], 4). Pil satır dizisinin üstünde
 * durduğu için alanı okuyan her yer (testler, denetçi, üreteçler) onu kendiliğinden görür.
 */
export function pilli(lines, battery) {
  const copy = [...lines];
  copy.battery = battery;
  return copy;
}

/** Lazer pilinden harcanan hücre: küçük lazer 1, şarjlı lazer 3. */
export const LASER_COST = { fire: 1, beam: 3 };
/** Pil göstergesinin en çok hücresi. */
export const BATTERY_MAX = 9;

export const hasMeteor = (field, lane, y) => field.meteors.has(key(lane, y));
export const isIron = (field, lane, y) => !!field.iron && field.iron.has(key(lane, y));
/** Şeritte gemiden ileride, ilk demir asteroide kadar kaç kırılabilir kaya var? */
export function rocksAhead(field, lane, y) {
  let n = 0;
  for (let ty = y + 1; ty < field.rows; ty++) { if (isIron(field, lane, ty)) break; if (hasMeteor(field, lane, ty)) n++; }
  return n;
}
export const hasCrystal = (field, lane, y) => field.crystals.has(key(lane, y));

/** Sensörün baktığı kare ve sonucu. */
export function sense(field, lane, y, cond, state = {}) {
  if (cond === 'ahead') return { cell: { lane, y: y + 1 }, result: hasMeteor(field, lane, y + 1) };
  // Önümdeki kırılabilir bir kaya mı? (demir asteroit ya da boşluk değil)
  if (cond === 'rockAhead') return { cell: { lane, y: y + 1 }, result: hasMeteor(field, lane, y + 1) && !isIron(field, lane, y + 1) };
  // Şeridim temiz mi? Gemiden çıkışa kadar şeritte hiç engel yok.
  if (cond === 'laneClear') {
    let clear = true;
    for (let ty = y + 1; ty < field.rows; ty++) if (hasMeteor(field, lane, ty)) clear = false;
    return { cell: { lane, y: y + 1 }, result: clear };
  }
  if (cond === 'rocks3') return { cell: { lane, y: y + 1 }, result: rocksAhead(field, lane, y) >= 3 };
  if (cond === 'atBeacon') return { cell: { lane, y }, result: field.beacons.has(key(lane, y)) };
  if (cond === 'atEnergy') return { cell: { lane, y }, result: field.energyCells.has(key(lane, y)) };
  if (cond === 'energyLow') return { cell: { lane, y }, result: state.energy !== null && state.energy < 3 };
  if (cond === 'counter3') return { cell: { lane, y }, result: Number.isInteger(state.counter) && state.counter >= 3 };
  if (cond === 'aheadAndRightFree' || cond === 'aheadOrRightBlocked') {
    const ahead = sense(field, lane, y, 'ahead').result;
    const right = sense(field, lane, y, 'rightFree').result;
    return { cell: { lane, y: y + 1 }, result: cond === 'aheadAndRightFree' ? ahead && right : ahead || !right };
  }
  if (cond === 'atBeaconOrAhead' || cond === 'atBeaconAndAhead') {
    const at = field.beacons.has(key(lane, y)), ahead = hasMeteor(field, lane, y + 1);
    return { cell: { lane, y: y + 1 }, result: cond === 'atBeaconOrAhead' ? at || ahead : at && ahead };
  }
  const d = cond === 'rightFree' ? 1 : cond === 'leftFree' ? -1 : null;
  if (d === null) throw new Error(`Bilinmeyen koşul: ${cond}`);
  const l = lane + d;
  return { cell: { lane: l, y: y + 1 }, result: l >= 0 && l < field.lanes && !hasMeteor(field, l, y + 1) };
}

const STOP = Symbol('stop');
const DELTA = { fwd: 0, left: -1, right: 1 };
/** Deponun alabildiği en çok enerji. Göstergedeki hücre sayısı da budur. */
export const ENERGY_MAX = 9;

/**
 * Programı alanda çalıştırır ve olay listesini döndürür.
 * Olaylar: sense, move, fire, beam, event, shield, variable, call, crash, win, fail.
 * Alanın lazer pili varsa her atış pilden harcar (LASER_COST); yetmezse uçuş 'battery' ile biter.
 * Her olay ilgili bloğun `id`sini taşır.
 * @param o.library  otopilot kitaplığı: { ad: gövde }. Programda tanımı olmayan bir manevra
 *                   çağrılırsa gövdesi buradan alınır; programdaki tanım kitaplıktakinin önüne geçer.
 */
export function simulate(field, program, { maxTicks = 200, maxIdle = 2000, maxOps = 20000, library = null } = {}) {
  const events = [];
  const left = new Set(field.crystals);
  let lane = field.start, y = 0, ticks = 0, idle = 0, collected = 0;
  let outcome = null, reason = null;
  let energy = field.energyCells.size ? 0 : null, shielded = false, ops = 0, callDepth = 0;
  let counter = null;        // sayaç: ayarlanana kadar yoktur
  const args = [];           // çağrı yığını: parametreli manevralara verilen sayılar
  const handlers = new Map(), functions = new Map(), activeEvents = new Set();
  // Işın silahıyla kırılan kayalar alandan silinir; asıl alan değişmesin diye kopyası kullanılır.
  const rocks = new Set(field.meteors), live = { ...field, meteors: rocks };
  let broken = 0, battery = field.battery ?? null;
  const iron = field.iron || new Set(), geodes = field.geodes || new Set();
  // Kristalli kaya kırılınca yerinde kristal kalır; kristal yıldızı onları da sayar.
  const total = field.crystals.size + geodes.size;
  const smash = (lane, ty) => {
    rocks.delete(key(lane, ty)); broken++;
    if (!geodes.has(key(lane, ty))) return { lane, y: ty };
    left.add(key(lane, ty));
    return { lane, y: ty, gem: true };
  };
  const pay = (b) => {
    if (battery === null) return;
    if (battery < LASER_COST[b.type]) stop('fail', 'battery', { t: 'fail', reason: 'battery', id: b.id });
    battery -= LASER_COST[b.type];
  };

  const stop = (o, r, ev) => { outcome = o; reason = r; events.push(ev); throw STOP; };
  // İlerlemeden dönen hatalı programlar binlerce animasyon biriktirmesin.
  const announce = (ev) => { if (idle <= 24) events.push(ev); };

  function act(b) {
    const before = { lane, y };
    if (field.pirates.has(key(lane + DELTA[b.type], y + 1))) dispatch('pirate');
    // Kaya görünce: gidilecek karede kırılabilir bir kaya var; olay ona ateş edebilir.
    const next = key(lane + DELTA[b.type], y + 1);
    if (rocks.has(next) && !iron.has(next)) dispatch('rock');
    // Bir olayın manevrası bu uçuş adımının yerini alabilir.
    if (lane !== before.lane || y !== before.y) return;
    idle = 0;
    if (++ticks > maxTicks) stop('fail', 'limit', { t: 'fail', reason: 'limit', id: b.id });
    const from = { lane, y }, to = { lane: lane + DELTA[b.type], y: y + 1 };
    if (energy !== null && energy < 1) stop('fail', 'energy', { t: 'fail', reason: 'energy', id: b.id });
    if (energy !== null) energy--;
    const base = { id: b.id, kind: b.type, from, to, energy };
    if (to.lane < 0 || to.lane >= field.lanes) stop('crash', 'wall', { t: 'crash', reason: 'wall', ...base });
    if (to.y >= field.rows) {
      lane = to.lane; y = to.y;
      events.push({ t: 'move', ...base, exit: true, collect: false });
      stop('win', null, { t: 'win', id: b.id });
    }
    if (iron.has(key(to.lane, to.y))) stop('crash', 'iron', { t: 'crash', reason: 'iron', ...base });
    if (hasMeteor(live, to.lane, to.y)) stop('crash', 'meteor', { t: 'crash', reason: 'meteor', ...base });
    const blocked = field.pirates.has(key(to.lane, to.y));
    if (blocked && !shielded) stop('crash', 'pirate', { t: 'crash', reason: 'pirate', ...base });
    if (blocked) shielded = false;
    lane = to.lane; y = to.y;
    const collect = left.delete(key(lane, y));
    if (collect) collected++;
    events.push({ t: 'move', ...base, exit: false, collect, blocked, shielded });
    const arrived = key(lane, y);
    if (collect) dispatch('crystal');
    if (field.beacons.has(arrived)) dispatch('beacon');
    if (field.energyCells.has(arrived)) dispatch('energy');
  }

  function spin(b) {
    if (++idle > maxIdle) stop('fail', 'idle', { t: 'fail', reason: 'idle', id: b.id });
  }

  function run(list) { for (const b of list) exec(b); }

  function dispatch(event) {
    if (activeEvents.has(event)) return;
    activeEvents.add(event);
    try {
      for (const b of handlers.values()) if (b.event === event) {
        spin(b); announce({ t: 'event', event, id: b.id, lane, y }); run(b.body);
      }
    } finally { activeEvents.delete(event); }
  }

  function check(b) {
    spin(b);
    if (!b.cond) stop('fail', 'nocond', { t: 'fail', reason: 'nocond', id: b.id });
    const s = sense(live, lane, y, b.cond, { energy, counter });
    if (idle <= 8) events.push({ t: 'sense', id: b.id, cond: b.cond, result: s.result, cell: s.cell, lane, y });
    return s.result;
  }

  function exec(b) {
    if (++ops > maxOps) stop('fail', 'limit', { t: 'fail', reason: 'limit', id: b.id });
    switch (b.type) {
      case 'fwd': case 'left': case 'right': act(b); return;
      case 'fire': {
        // Kanatlardaki ışın silahı: gemi yerinde durur, kendi şeridinde önündeki ilk kaya parçalanır.
        // Demir asteroit ışını durdurur ve kırılmaz.
        spin(b); pay(b);
        let hit = null, wall = null;
        for (let ty = y + 1; ty < field.rows; ty++) {
          if (iron.has(key(lane, ty))) { wall = { lane, y: ty }; break; }
          if (rocks.has(key(lane, ty))) { hit = smash(lane, ty); break; }
        }
        announce({ t: 'fire', id: b.id, from: { lane, y }, hit, iron: wall, battery });
        return;
      }
      case 'beam': {
        // Şarjlı lazer: şarj olur, sonra kesintisiz bir ışınla şeritteki bütün kayaları parçalar.
        // Demir asteroide kadar: demir ışını durdurur, arkasındaki kayalar yerinde kalır.
        spin(b); pay(b);
        const hits = [];
        let wall = null;
        for (let ty = y + 1; ty < field.rows; ty++) {
          if (iron.has(key(lane, ty))) { wall = { lane, y: ty }; break; }
          if (rocks.has(key(lane, ty))) hits.push(smash(lane, ty));
        }
        announce({ t: 'beam', id: b.id, from: { lane, y }, hits, iron: wall, battery });
        return;
      }
      case 'repeat': {
        // 'n': içinde durduğu manevraya çağrıda verilen sayı
        const times = b.count === 'n' ? args[args.length - 1] : b.count;
        if (!Number.isInteger(times)) stop('fail', 'param', { t: 'fail', reason: 'param', id: b.id });
        for (let i = 0; i < times; i++) { spin(b); run(b.body); }
        return;
      }
      case 'forever': for (;;) { spin(b); run(b.body); }
      case 'until': while (!check(b)) run(b.body); return;
      case 'ifelse': {
        run(check(b) ? b.then : b.else);
        return;
      }
      case 'on':
        spin(b);
        if (!EVENTS[b.event]) stop('fail', 'noevent', { t: 'fail', reason: 'noevent', id: b.id });
        handlers.set(b.id, b); return;
      case 'shield':
        spin(b);
        // Açık kalkan yeniden açılamaz: "her adımda kalkan aç" demek, olayın işini döngüye yaptırmaktır.
        if (shielded) stop('fail', 'shield', { t: 'fail', reason: 'shield', id: b.id });
        shielded = true; announce({ t: 'shield', id: b.id, shielded }); return;
      case 'setEnergy': case 'addEnergy': {
        spin(b);
        if (!Number.isInteger(b.value) || b.value < 0 || b.value > 9) stop('fail', 'value', { t: 'fail', reason: 'value', id: b.id });
        if (b.type === 'addEnergy' && !field.energyCells.has(key(lane, y))) stop('fail', 'station', { t: 'fail', reason: 'station', id: b.id });
        energy = b.type === 'setEnergy' ? b.value : (energy ?? 0) + b.value;
        // Depo sınırlıdır: gerekmeden yapılan şarj taşar. Sayaç dolu depoyu göstersin diye önce duyurulur.
        const overflow = energy > ENERGY_MAX;
        if (overflow) energy = ENERGY_MAX;
        announce({ t: 'variable', id: b.id, name: 'energy', value: energy });
        if (overflow) stop('fail', 'overflow', { t: 'fail', reason: 'overflow', id: b.id });
        return;
      }
      case 'setCounter': case 'addCounter': {
        spin(b);
        if (!Number.isInteger(b.value) || b.value < 0 || b.value > 9) stop('fail', 'value', { t: 'fail', reason: 'value', id: b.id });
        // Değişken kullanılmadan önce bir değere ayarlanmalıdır.
        if (b.type === 'addCounter' && counter === null) stop('fail', 'counter', { t: 'fail', reason: 'counter', id: b.id });
        counter = b.type === 'setCounter' ? b.value : Math.min(99, counter + b.value);
        announce({ t: 'variable', id: b.id, name: 'counter', value: counter });
        return;
      }
      case 'define':
        spin(b);
        if (!FUNCTIONS[b.name] || functions.has(b.name)) stop('fail', 'definition', { t: 'fail', reason: 'definition', id: b.id });
        functions.set(b.name, b); return;
      case 'call': {
        spin(b);
        const fn = functions.get(b.name) || (library && library[b.name] ? { body: library[b.name] } : null);
        if (!fn) stop('fail', 'function', { t: 'fail', reason: 'function', id: b.id });
        if (++callDepth > 32) stop('fail', 'recursion', { t: 'fail', reason: 'recursion', id: b.id });
        if (fn.param && !Number.isInteger(b.arg)) stop('fail', 'param', { t: 'fail', reason: 'param', id: b.id });
        announce({ t: 'call', id: b.id, name: b.name, arg: fn.param ? b.arg : undefined });
        args.push(fn.param ? b.arg : null);
        try { run(fn.body); } finally { callDepth--; args.pop(); }
        return;
      }
      default: throw new Error(`Bilinmeyen blok: ${b.type}`);
    }
  }

  try {
    run(program);
    outcome = 'fail'; reason = program.length ? 'ended' : 'empty';
    events.push({ t: 'fail', reason, id: null });
  } catch (e) {
    if (e !== STOP) throw e;
  }
  return { events, outcome, reason, ticks, collected, total, ship: { lane, y }, energy, shielded, counter, broken, battery };
}

/** Yıldız: geçmek 1, bütün kristaller +1, `par` blok veya azı +1. Geçemediyse 0. */
export function stars(results, blockCount, par) {
  if (!results.length || results.some((r) => r.outcome !== 'win')) return 0;
  const allCrystals = results.every((r) => r.collected === r.total);
  return 1 + (allCrystals ? 1 : 0) + (blockCount <= par ? 1 : 0);
}

export const FAIL_TEXT = {
  meteor: 'Meteora çarptın!',
  iron: 'Demir asteroide çarptın! Lazer demiri kıramaz; onun yanından kaç.',
  battery: 'Lazer pili bitti! Küçük lazer 1, şarjlı lazer 3 hücre harcar. Yalnızca gerektiğinde ateş et.',
  wall: 'Şeridin dışına çıktın!',
  ended: 'Program bitti ama çıkışa varamadın.',
  empty: 'Program boş. Önce blok ekle.',
  idle: 'Gemi komut bekliyor! Bu turda hiçbir manevra çalışmadı.',
  limit: 'Uçuş çok uzun sürdü.',
  nocond: 'Bu bloğun koşulu eksik. Sensörüne dokunarak koşul seç.',
  pirate: 'Korsan saldırısı! Bu geçiş için kalkan açmalısın.',
  shield: 'Kalkan zaten açık! Onu her adımda değil, yalnızca gerektiğinde aç.',
  energy: 'Enerji bitti! Başlangıç değerini ve şarj istasyonlarını kontrol et.',
  station: 'Enerji yalnızca yeşil şarj istasyonunda artırılabilir.',
  overflow: `Depo taştı! Depo en çok ${ENERGY_MAX} enerji alır; daha az ekle ya da enerji azalınca şarj et.`,
  value: 'Değer 0–9 arasında tam sayı olmalı.',
  counter: 'Sayaç henüz ayarlanmadı. Önce "sayaç = 0" bloğunu koy.',
  param: 'Bu manevra bir sayı bekliyor: çağrıya sayı ver; "n kez tekrarla" yalnızca sayı alan bir manevranın içinde çalışır.',
  noevent: 'Olay bloğunda hangi olayı beklediğini seç.',
  definition: 'Her manevrayı bir kez tanımla; farklı manevralara farklı adlar ver.',
  function: 'Bu manevra henüz tanımlanmadı. Önce aynı adlı tanımı ekle.',
  recursion: 'Manevra kendisini tekrar çağırıyor. İçindeki çağrıyı kontrol et.',
};
