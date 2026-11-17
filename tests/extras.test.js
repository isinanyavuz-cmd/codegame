import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, SECTORS, levelById } from '../src/content/levels.js';
import { EXTRAS, ALL_LEVELS, SECRET_STARS, extrasOf, findLevel } from '../src/content/extras.js';
import { STORY, CREW, BOTS, crewOf, botOf } from '../src/content/story.js';
import { parseField, simulate, stars } from '../src/engine/world.js';
import { count, CONTAINERS, F, R, rep } from '../src/engine/blocks.js';

const starsOf = (level, program) => stars(level.waves.map((w) => simulate(parseField(w), program)), count(program), level.par);
function types(program, out = new Set()) {
  for (const b of program) { out.add(b.type); for (const k of CONTAINERS[b.type] || []) types(b[k], out); }
  return out;
}
let n = 0;
async function freshStore() {
  const box = new Map();
  globalThis.localStorage = { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => box.set(k, v) };
  return (await import(`../src/storage.js?extras-test-${++n}`)).store;
}

test('yan görevler: kimlikler benzersiz, her biri kendi sektöründeki bir ana görevin yanında', () => {
  assert.equal(new Set(ALL_LEVELS.map((l) => l.id)).size, ALL_LEVELS.length);
  for (const x of EXTRAS) {
    const main = levelById(x.after);
    assert.ok(main, `${x.id}: ${x.after} yok`);
    assert.equal(main.sector, x.sector);
    assert.ok(['gizli', 'acil'].includes(x.extra));
    assert.ok(x.title && x.brief && x.hint, x.id);
    assert.equal(findLevel(x.id), x);
    if (x.extra === 'acil') assert.ok(x.alarm, `${x.id}: acil durum haberi yok`);
  }
  assert.equal(findLevel('1-1'), LEVELS[0]);
});

test('yan görevler: örnek çözüm tam yıldız alır ve paletteki bloklarla yazılabilir', () => {
  for (const x of EXTRAS) {
    const sol = x.solution();
    assert.equal(starsOf(x, sol), 3, x.id);
    assert.ok(count(sol) <= x.maxBlocks, x.id);
    for (const t of types(sol)) assert.ok(x.tools.includes(t), `${x.id}: palette ${t} yok`);
  }
});

test('gizli görev sektörde yeterince yıldız toplanınca, acil durum yanındaki görev geçilince açılır', async () => {
  const store = await freshStore();
  const secret = extrasOf(1).find((x) => x.extra === 'gizli'), alarm = extrasOf(2).find((x) => x.extra === 'acil');
  assert.equal(store.isUnlocked(secret, LEVELS), false);
  for (let i = 1; i <= 6; i++) store.setStars(`1-${i}`, 3);            // 18 yıldız
  assert.equal(store.isUnlocked(secret, LEVELS), false);
  store.setStars('1-7', SECRET_STARS - 18);
  assert.equal(store.isUnlocked(secret, LEVELS), true);
  assert.equal(store.isUnlocked(alarm, LEVELS), false);
  store.setStars(alarm.after, 1);
  assert.equal(store.isUnlocked(alarm, LEVELS), true);
  // Yan görev ana yolu kilitlemez: 2-6, 2-5 geçilince açıktır; acil durum beklenmez.
  assert.equal(store.isUnlocked(levelById('2-6'), LEVELS), true);
});

test('2-g: iç içe döngü tam yıldız, tek döngü geçer ama blok yıldızını alamaz', () => {
  const level = findLevel('2-g');
  assert.equal(starsOf(level, [rep(3, rep(3, F()), R())]), 3);
  const flat = [rep(3, F(), F(), F(), R())];
  assert.ok(count(flat) <= level.maxBlocks);
  assert.equal(starsOf(level, flat), 2);
});

test('hikâye: her sektörün telsiz mesajı, kurtarılacak mürettebatı; her gizli görevin robotu var', () => {
  for (const s of SECTORS) {
    assert.ok(STORY[s.id]?.open && STORY[s.id]?.close, `sektör ${s.id}`);
    assert.ok(crewOf(s.id), `sektör ${s.id} mürettebatı`);
  }
  assert.equal(new Set([...CREW, ...BOTS].map((c) => c.id)).size, CREW.length + BOTS.length);
  for (const x of EXTRAS.filter((e) => e.extra === 'gizli')) assert.ok(botOf(x.sector), x.id);
});
