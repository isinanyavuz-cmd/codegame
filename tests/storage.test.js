import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/content/levels.js';
import { ALL_LEVELS } from '../src/content/extras.js';

let n = 0;
/** Boş (ya da verilen) kayıtla taze bir store yükler. */
async function load(saved = null, address = {}) {
  const box = new Map();
  if (saved) box.set('kodpilotu.v1', JSON.stringify(saved));
  globalThis.localStorage = { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => box.set(k, v) };
  globalThis.location = { search: '', hash: '', ...address };
  const { store, dayOf } = await import(`../src/storage.js?storage-test-${++n}`);
  return { store, dayOf, raw: () => JSON.parse(box.get('kodpilotu.v1') || 'null') };
}

test('çözüm adresi tüm ana ve yan görevleri açar; hepsi modu yalnız kilitleri kaldırır', async () => {
  for (const [search, hash, unlockAll, showSolutions] of [
    ['', '', false, false],
    ['?hepsi', '', true, false],
    ['', '#hepsi', true, false],
    ['?cozum', '#8-8', true, true],
    ['?kalite=dusuk&cozum', '', true, true],
    ['?hepsi&cozum', '', true, true],
    ['?foo=cozum', '', false, false],
    ['?cozumluk', '', false, false],
  ]) {
    const { store } = await load(null, { search, hash });
    assert.equal(store.unlockAll, unlockAll, search + hash);
    assert.equal(store.showSolutions, showSolutions, search + hash);
    if (unlockAll) for (const level of ALL_LEVELS) assert.equal(store.isUnlocked(level, LEVELS), true, level.id);
    else assert.equal(store.isUnlocked(LEVELS.at(-1), LEVELS), false);
    assert.equal(store.total(), 0, 'kilit açmak yıldız kazandırmaz');
  }
});

test('çözüm modunda düzenlemek kayıtlı programları korur; normal modda kaydetme sürer', async () => {
  const saved = { stars: { '1-1': 1 }, programs: { '1-2': [{ id: 'old', type: 'left' }] } };
  const { store, raw } = await load(saved, { search: '?cozum' });
  store.setProgram('1-2', [{ id: 'demo', type: 'right' }]);
  store.setProgram('8-8', [{ id: 'demo', type: 'fwd' }]);
  assert.deepEqual(store.program('1-2'), saved.programs['1-2']);
  assert.equal(store.program('8-8'), null);
  assert.deepEqual(raw(), saved, 'çözümler kalıcı kayda yazılmaz');
  const normal = await load(raw());
  assert.equal(normal.store.showSolutions, false);
  assert.equal(normal.store.unlockAll, false);
  normal.store.setProgram('1-2', [{ id: 'new', type: 'fwd' }]);
  assert.deepEqual(normal.raw().programs['1-2'], [{ id: 'new', type: 'fwd' }]);
});

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

test('günün dalgası kayıtları: eski günler silinir, bugünkü ve ana görevler kalır; atölye tasarımı saklanır', async () => {
  const { store, raw } = await load();
  store.setProgram('gun-2026-11-16@1', [{ id: 'a', type: 'fwd' }]); store.setProgram('gun-2026-11-17@2', [{ id: 'b', type: 'fwd' }]); store.setProgram('1-1', [{ id: 'c', type: 'fwd' }]);
  store.attempt('gun-2026-11-16', { won: true }); store.setBest('gun-2026-11-16', { blocks: 3 });
  store.prune('gun-', 'gun-2026-11-17');
  assert.deepEqual(Object.keys(raw().programs).sort(), ['1-1', 'gun-2026-11-17@2']);
  assert.equal(store.tries('gun-2026-11-16'), null);
  assert.equal(store.best('gun-2026-11-16'), null);
  store.setDaily('2026-11-17', 2); store.setDaily('2026-11-17', 1); store.setDaily('2026-11-16', 3);
  assert.equal(store.daily('2026-11-17'), 2);
  assert.equal(store.dailyDays(), 2);
  assert.equal(store.total(), 0, 'günlük yıldızlar ana toplama eklenmez');
  assert.equal(store.workshop, null);
  store.workshop = { lines: ['..S..'], par: 4, solved: true };
  assert.deepEqual(raw().workshop, { lines: ['..S..'], par: 4, solved: true });
});
