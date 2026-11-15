const test = require('node:test');
const assert = require('node:assert');
const B = require('./load.js');
const U = B.StoreUtil;

test('yıldızlar: 9+ doğru 3, 7+ doğru 2, 5+ doğru 1', () => {
  assert.strictEqual(U.starsFor(10, 10), 3);
  assert.strictEqual(U.starsFor(9, 10), 3);
  assert.strictEqual(U.starsFor(8, 10), 2);
  assert.strictEqual(U.starsFor(7, 10), 2);
  assert.strictEqual(U.starsFor(5, 10), 1);
  assert.strictEqual(U.starsFor(4, 10), 0);
  assert.strictEqual(U.starsFor(0, 0), 0);
});

test('beceri puanı doğruyla artar, yanlışla düşer, 1-4.9 arasında kalır', () => {
  assert.ok(U.nextSkill(1, 1, true) > 1);
  assert.strictEqual(U.nextSkill(1, 1, false), 1);
  assert.ok(U.nextSkill(2.5, 2, false) < 2.5);
  assert.strictEqual(U.nextSkill(4.9, 4, true), 4.9);
  let s = 1;
  for (let i = 0; i < 7; i++) s = U.nextSkill(s, 1, true);
  assert.ok(s >= 2, '7 doğru cevap bir üst seviyeye taşır: ' + s);
});

test('gün anahtarı ve seri', () => {
  assert.strictEqual(U.dayKey(new Date(2026, 10, 5)), '2026-11-05');
  assert.strictEqual(U.addDays('2026-11-01', -1), '2026-10-31');
  const days = { '2026-11-13': { n: 4 }, '2026-11-14': { n: 10 }, '2026-11-15': { n: 2 } };
  assert.strictEqual(U.streak(days, '2026-11-15'), 3);
  assert.strictEqual(U.streak(days, '2026-11-16'), 3, 'bugün henüz oynanmadıysa seri bozulmaz');
  assert.strictEqual(U.streak(days, '2026-11-17'), 0);
  assert.strictEqual(U.streak({}, '2026-11-15'), 0);
});

test('kayıt: cevaplar kategori ve gün istatistiklerine işlenir', () => {
  const S = B.Store;
  S.data = { v: 1, settings: { sound: true, len: 10 }, cats: {}, days: {}, exams: [] };
  S.recordAnswer('pattern', 1, true, 4000);
  S.recordAnswer('pattern', 1, false, 6000);
  const c = S.cat('pattern');
  assert.strictEqual(c.seen, 2);
  assert.strictEqual(c.ok, 1);
  assert.deepStrictEqual(c.recent, [1, 0]);
  assert.strictEqual(S.day().n, 2);
  S.setStars('pattern', 1, 2);
  S.setStars('pattern', 1, 1);
  assert.strictEqual(S.cat('pattern').stars[0], 2, 'en iyi yıldız korunur');
  assert.strictEqual(S.totalStars(), 2);
  assert.strictEqual(S.streak(), 1);
});

test('günün görevi: tekrarsız, geçerli kategorilerden oluşur', () => {
  const S = B.Store;
  S.data = { v: 1, settings: { sound: true, len: 10 }, cats: {}, days: {}, exams: [] };
  const plan = S.dailyPlan(new B.RNG(7), 10);
  assert.strictEqual(plan.length, 10);
  assert.strictEqual(new Set(plan.map((p) => p.type)).size, 10);
  for (const p of plan) { assert.ok(B.catById(p.type)); assert.ok(p.level >= 1 && p.level <= 3); }
});

test('günün görevi yıldızı toplama eklenir, aynı gün tekrar oynamak yıldızı katlamaz', () => {
  const S = B.Store;
  S.data = { v: 1, settings: { sound: true, len: 10 }, cats: {}, days: {}, exams: [] };
  S.finishDaily(2);
  assert.strictEqual(S.dailyDone(), true);
  assert.strictEqual(S.totalStars(), 2);
  S.finishDaily(3);
  S.finishDaily(1);
  assert.strictEqual(S.totalStars(), 3);
});

test('ilk sürüm kaydı taşınır: eski orta 1. kademe, eski zor 2. kademe olur', () => {
  const old = { v: 1, settings: { sound: false, len: 5 }, cats: { cubes: { stars: [3, 2, 1], seen: 30, ok: 20, ms: 9000, recent: [1, 0], skill: 3.4 }, odd: { stars: [3, 0, 0], seen: 10, ok: 9, ms: 100, recent: [1], skill: 1.6 } }, days: { '2026-11-14': { n: 10, ok: 8, daily: true, stars: 2 } }, exams: [] };
  const d = U.migrate(JSON.parse(JSON.stringify(old)));
  assert.strictEqual(d.v, 3);
  assert.deepStrictEqual(d.cats.cubes.stars, [2, 1, 0, 0]);
  assert.strictEqual(d.cats.cubes.skill, 2.4);
  assert.deepStrictEqual(d.cats.odd.stars, [0, 0, 0, 0]);
  assert.strictEqual(d.cats.odd.skill, 1);
  assert.strictEqual(d.cats.cubes.seen, 30, 'çözülen soru sayısı korunur');
  assert.strictEqual(d.days['2026-11-14'].stars, 2, 'günlük yıldızlar korunur');
});

test('üç kademeli kayıt taşınır: her kademe bir yukarı kayar, altına yeni Kolay eklenir', () => {
  const d = U.migrate({ v: 2, cats: { same: { stars: [2, 1, 0], seen: 12, skill: 2.3 }, who: { stars: [0, 0, 0], seen: 0, skill: 1 }, path: { stars: [3, 3, 3], seen: 90, skill: 3.9 } } });
  assert.strictEqual(d.v, 3);
  assert.deepStrictEqual(d.cats.same.stars, [0, 2, 1, 0]);
  assert.strictEqual(d.cats.same.skill, 3.3);
  assert.strictEqual(d.cats.who.skill, 1, 'hiç çözülmemiş konu yeni Kolay kademeden başlar');
  assert.deepStrictEqual(d.cats.path.stars, [0, 3, 3, 3]);
  assert.strictEqual(d.cats.path.skill, 4.9);
  assert.deepStrictEqual(U.migrate({ v: 3, x: 1 }), { v: 3, x: 1 }, 'güncel kayıt değişmez');
});

test('yeni konu dört kademe için yıldız tutar ve 1. kademeden başlar', () => {
  const S = B.Store;
  S.data = U.blank();
  assert.deepStrictEqual(S.cat('cubes').stars, [0, 0, 0, 0]);
  assert.strictEqual(S.workLevel('cubes'), 1);
  S.setStars('cubes', 4, 3);
  assert.strictEqual(S.totalStars(), 3);
  S.cat('cubes').skill = 4.9;
  assert.strictEqual(S.workLevel('cubes'), 4);
});

test('sayı hafızası kaydı: rekor düzeye göre tutulur ve yalnız yükselir, denemeler güne işlenir', () => {
  const S = B.Store;
  S.data = U.blank();
  assert.strictEqual(S.spanBest(1, 'both', 5), true);
  assert.strictEqual(S.spanBest(1, 'both', 4), false);
  assert.strictEqual(S.spanBest(3, 'both', 4), true, 'Zor düzeyin rekoru ayrıdır');
  assert.strictEqual(S.spanBest(2, 'fwd', 7), true);
  assert.deepStrictEqual([S.data.span.best[1].both, S.data.span.best[3].both, S.data.span.best[2].fwd, S.data.span.best[2].bwd], [5, 4, 7, 0]);
  S.spanTrial(true); S.spanTrial(false); S.spanPlayed();
  assert.deepStrictEqual([S.day().n, S.day().ok, S.data.span.plays], [2, 1, 1]);
  assert.strictEqual(S.streak(), 1);
});

test('sayı hafızası: düzeylerden önceki rekorlar Kolay düzeye geçer ve 7 basamakla sınırlanır', () => {
  const n = U.normalizeSpan({ both: 9, fwd: 5, bwd: 0, plays: 4 }, 7);
  assert.deepStrictEqual(n.best[1], { both: 7, fwd: 5, bwd: 0 });
  assert.deepStrictEqual(n.best[2], { both: 0, fwd: 0, bwd: 0 });
  assert.strictEqual(n.plays, 4);
  const again = U.normalizeSpan(n, 7);
  assert.deepStrictEqual(again, n, 'yeni biçim değişmeden kalır');
  assert.deepStrictEqual(U.normalizeSpan(undefined, 7), U.blank().span);
  assert.deepStrictEqual([U.blank().settings.spanStart, U.blank().settings.spanLevel], [3, 1]);
});
