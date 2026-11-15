// Oyun dünyası ve program yürütücü. Saf mantık; DOM yok.
//
// Alan: `lanes` şerit × `rows` sıra. Gemi (lane, y) karesindedir; y=0 başlangıç
// sırasıdır ve her komut gemiyi bir sıra ileri taşır (sola/sağa kaç çapraz gider).
// Gemi y = rows değerine ulaşınca çıkış çizgisini geçmiş olur.

const key = (lane, y) => `${lane},${y}`;

/**
 * Alanı metinden okur. İlk satır en uzak sıra, son satır başlangıç sırasıdır.
 * '.' boş, 'M' meteor, 'K' kristal, 'S' geminin başladığı kare.
 */
export function parseField(lines) {
  const rows = lines.length, lanes = lines[0].length;
  const meteors = new Set(), crystals = new Set();
  let start = -1;
  lines.forEach((line, i) => {
    if (line.length !== lanes) throw new Error(`Satır uzunlukları eşit olmalı: "${line}"`);
    const y = rows - 1 - i;
    [...line].forEach((ch, lane) => {
      if (ch === 'M') meteors.add(key(lane, y));
      else if (ch === 'K') crystals.add(key(lane, y));
      else if (ch === 'S') { if (y !== 0) throw new Error('S yalnızca son satırda olabilir'); start = lane; }
      else if (ch !== '.') throw new Error(`Bilinmeyen karakter: ${ch}`);
    });
  });
  if (start < 0) throw new Error('Başlangıç karesi (S) yok');
  return { lanes, rows, start, meteors, crystals };
}

export const hasMeteor = (field, lane, y) => field.meteors.has(key(lane, y));
export const hasCrystal = (field, lane, y) => field.crystals.has(key(lane, y));

/** Sensörün baktığı kare ve sonucu. */
export function sense(field, lane, y, cond) {
  if (cond === 'ahead') return { cell: { lane, y: y + 1 }, result: hasMeteor(field, lane, y + 1) };
  const d = cond === 'rightFree' ? 1 : cond === 'leftFree' ? -1 : null;
  if (d === null) throw new Error(`Bilinmeyen koşul: ${cond}`);
  const l = lane + d;
  return { cell: { lane: l, y: y + 1 }, result: l >= 0 && l < field.lanes && !hasMeteor(field, l, y + 1) };
}

const STOP = Symbol('stop');
const DELTA = { fwd: 0, left: -1, right: 1 };

/**
 * Programı alanda çalıştırır ve olay listesini döndürür.
 * Olaylar: sense, move, crash, win, fail. Her olay ilgili bloğun `id`sini taşır.
 */
export function simulate(field, program, { maxTicks = 200, maxIdle = 2000 } = {}) {
  const events = [];
  const left = new Set(field.crystals);
  let lane = field.start, y = 0, ticks = 0, idle = 0, collected = 0;
  let outcome = null, reason = null;

  const stop = (o, r, ev) => { outcome = o; reason = r; events.push(ev); throw STOP; };

  function act(b) {
    idle = 0;
    if (++ticks > maxTicks) stop('fail', 'limit', { t: 'fail', reason: 'limit', id: b.id });
    const from = { lane, y }, to = { lane: lane + DELTA[b.type], y: y + 1 };
    const base = { id: b.id, kind: b.type, from, to };
    if (to.lane < 0 || to.lane >= field.lanes) stop('crash', 'wall', { t: 'crash', reason: 'wall', ...base });
    if (to.y >= field.rows) {
      lane = to.lane; y = to.y;
      events.push({ t: 'move', ...base, exit: true, collect: false });
      stop('win', null, { t: 'win', id: b.id });
    }
    if (hasMeteor(field, to.lane, to.y)) stop('crash', 'meteor', { t: 'crash', reason: 'meteor', ...base });
    lane = to.lane; y = to.y;
    const collect = left.delete(key(lane, y));
    if (collect) collected++;
    events.push({ t: 'move', ...base, exit: false, collect });
  }

  function spin(b) {
    if (++idle > maxIdle) stop('fail', 'idle', { t: 'fail', reason: 'idle', id: b.id });
  }

  function run(list) { for (const b of list) exec(b); }

  function exec(b) {
    switch (b.type) {
      case 'fwd': case 'left': case 'right': act(b); return;
      case 'repeat': for (let i = 0; i < b.count; i++) { spin(b); run(b.body); } return;
      case 'forever': for (;;) { spin(b); run(b.body); }
      case 'ifelse': {
        spin(b);
        if (!b.cond) stop('fail', 'nocond', { t: 'fail', reason: 'nocond', id: b.id });
        const s = sense(field, lane, y, b.cond);
        if (idle <= 3) events.push({ t: 'sense', id: b.id, cond: b.cond, result: s.result, cell: s.cell, lane, y });
        run(s.result ? b.then : b.else);
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
  return { events, outcome, reason, ticks, collected, total: field.crystals.size, ship: { lane, y } };
}

/** Yıldız: geçmek 1, bütün kristaller +1, `par` blok veya azı +1. Geçemediyse 0. */
export function stars(results, blockCount, par) {
  if (!results.length || results.some((r) => r.outcome !== 'win')) return 0;
  const allCrystals = results.every((r) => r.collected === r.total);
  return 1 + (allCrystals ? 1 : 0) + (blockCount <= par ? 1 : 0);
}

export const FAIL_TEXT = {
  meteor: 'Meteora çarptın!',
  wall: 'Şeridin dışına çıktın!',
  ended: 'Program bitti ama çıkışa varamadın.',
  empty: 'Program boş. Önce blok ekle.',
  idle: 'Gemi komut bekliyor! Bu turda hiçbir manevra çalışmadı.',
  limit: 'Uçuş çok uzun sürdü.',
  nocond: 'Bu "eğer" bloğunun koşulu eksik.',
};
