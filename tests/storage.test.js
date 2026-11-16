import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/content/levels.js';

let n = 0;
/** Boş (ya da verilen) kayıtla taze bir store yükler. */
async function load(saved = null) {
  const box = new Map();
  if (saved) box.set('kodpilotu.v1', JSON.stringify(saved));
  globalThis.localStorage = { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => box.set(k, v) };
  const { store, dayOf } = await import(`../src/storage.js?storage-test-${++n}`);
  return { store, dayOf, raw: () => JSON.parse(box.get('kodpilotu.v1') || 'null') };
}

test('eski kayıt yeni alanlarla açılır; hiçbir şey kaybolmaz', async () => {
  const { store } = await load({ stars: { '1-1': 3 }, programs: { '1-1': [{ id: 'a', type: 'fwd' }] }, intros: { 1: true }, sound: false, speed: 2 });
  assert.equal(store.stars('1-1'), 3);
  assert.equal(store.sound, false);
  assert.equal(store.voice, false);
  assert.deepEqual(store.crew(), []);
  assert.deepEqual(store.library(), {});
  assert.equal(store.tries('1-1'), null);
});

test('deneme kaydı: art arda başarısızlık sayılır, kazanınca sıfırlanır', async () => {
  const { store } = await load();
  store.attempt('4-2', { won: false, reason: 'meteor', ms: 4000 });
  store.attempt('4-2', { won: false, reason: 'meteor', ms: 4000 });
  let t = store.attempt('4-2', { won: false, reason: 'energy', ms: 2000 });
  assert.equal(t.n, 3); assert.equal(t.fails, 3); assert.equal(t.streak, 3);
  assert.deepEqual(t.reasons, { meteor: 2, energy: 1 });
  assert.equal(t.ms, 10000);
  t = store.attempt('4-2', { won: true, ms: 1000 });
  assert.equal(t.streak, 0); assert.equal(t.fails, 3); assert.equal(t.n, 4);
});

test('sonraya bırakılan görev sıradakini açar ama yıldız vermez', async () => {
  const { store } = await load({ stars: { '1-1': 1 } });
  assert.equal(store.isUnlocked(LEVELS[2], LEVELS), false);
  store.skip('1-2');
  assert.equal(store.isUnlocked(LEVELS[2], LEVELS), true);
  assert.equal(store.isSkipped('1-2'), true);
  assert.equal(store.total(), 1);
  store.setStars('1-2', 2);
  assert.equal(store.isSkipped('1-2'), false, 'sonradan geçilen görev artık "bırakılmış" değildir');
});

test('yan yolu geçmek ana görevi geçmiş sayar', async () => {
  const { store } = await load({ stars: { 'x-yan': 2 } });
  const main = { id: 'x', index: 5, alt: 'x-yan' }, next = { id: 'y', index: 6 }, levels = Array(7).fill(null);
  levels[5] = main; levels[6] = next;
  assert.equal(store.passed(main), true);
  assert.equal(store.isUnlocked(next, levels), true);
  assert.equal(store.isUnlocked({ id: 'g', extra: 'gizli', open: (s) => s.stars('x-yan') > 2 }, levels), false);
});

test('mürettebat, kitaplık, rekor ve bir kez gösterilenler kaydedilir', async () => {
  const { store, raw } = await load();
  assert.equal(store.rescue('ada'), true);
  assert.equal(store.rescue('ada'), false, 'aynı kişi iki kez kurtarılmaz');
  store.keepFunction('safe', [{ id: 'a', type: 'fwd' }]);
  store.setBest('1-1', { blocks: 3, stars: 3, paths: ['FFF'] });
  store.markSeen('hikaye:1'); store.setShip('hull', 'mavi');
  assert.deepEqual(store.crew(), ['ada']);
  assert.equal(store.library().safe.length, 1);
  assert.equal(store.best('1-1').blocks, 3);
  assert.ok(store.seen('hikaye:1')); assert.ok(!store.seen('hikaye:2'));
  assert.equal(raw().ship.hull, 'mavi');
});

test('günlük en çok 300 kayıt tutar; günün dalgası en iyi sonucu saklar', async () => {
  const { store, dayOf } = await load();
  for (let i = 0; i < 320; i++) store.addLog({ id: '1-1', stars: 1 });
  assert.equal(store.log().length, 300);
  const day = dayOf(new Date(2026, 10, 16, 9).getTime());
  assert.equal(day, '2026-11-16');
  store.setDaily(day, 2); store.setDaily(day, 1);
  assert.equal(store.daily(day), 2);
  assert.equal(store.dailyDays(), 1);
});

test('ilerleme kodu başka cihazda aynı kaydı kurar; bozuk kod kaydı değiştirmez', async () => {
  const a = await load({ stars: { '1-1': 3, '2-4': 2 }, name: 'Çağrı' });
  a.store.rescue('ada');
  const code = a.store.exportCode();
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  const b = await load({ stars: { '1-1': 1 } });
  assert.equal(b.store.importCode('bu bir kod değil'), false);
  assert.equal(b.store.stars('1-1'), 1);
  assert.equal(b.store.importCode(code), true);
  assert.equal(b.store.stars('2-4'), 2);
  assert.equal(b.store.name, 'Çağrı');
  assert.deepEqual(b.store.crew(), ['ada']);
});
