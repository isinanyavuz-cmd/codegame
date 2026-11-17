import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARTS, PART_KEYS, lookOf, unlockedBetween, nextUnlock } from '../src/content/hangar.js';
import { parseField, simulate } from '../src/engine/world.js';
import { F, L, R, forever, ifelse, define, call, toPython, undefinedCalls, sameBlocks, clone } from '../src/engine/blocks.js';

test('hangar: her parçanın ilk seçeneği baştan açık, kimlikler benzersiz', () => {
  for (const key of PART_KEYS) {
    const { options } = PARTS[key];
    assert.equal(options[0].need, 0, key);
    assert.equal(new Set(options.map((o) => o.id)).size, options.length, key);
    assert.deepEqual(options.map((o) => o.need), [...options.map((o) => o.need)].sort((a, b) => a - b), `${key}: açılma sırası`);
  }
});

test('hangar: seçilmemiş ya da henüz açılmamış parça ilk seçeneğe döner', () => {
  assert.equal(lookOf({}, 0).hull.id, 'kar');
  assert.equal(lookOf({ hull: 'gece' }, 5).hull.id, 'kar', '6 yıldız gerek');
  assert.equal(lookOf({ hull: 'gece' }, 6).hull.id, 'gece');
  assert.equal(lookOf({ hull: 'yok', shape: 'ok', seenAt: 3 }, 100).hull.id, 'kar');
  assert.equal(lookOf({ shape: 'ok' }, 100).shape.wing, 0.8);
});

test('hangar: yıldız artınca açılan parçalar ve sıradaki hedef', () => {
  assert.deepEqual(unlockedBetween(0, 3).map((u) => u.option.id), ['kirmizi']);
  assert.deepEqual(unlockedBetween(3, 3), []);
  assert.equal(unlockedBetween(0, 500).length, PART_KEYS.reduce((a, k) => a + PARTS[k].options.length - 1, 0));
  assert.deepEqual([nextUnlock(0).option.id, nextUnlock(0).need], ['kirmizi', 3]);
  assert.equal(nextUnlock(500), null);
});

const FIELD = parseField(['.....', '..M..', '.....', '..S..']);
const steer = () => ifelse('ahead', [ifelse('rightFree', [R()], [L()])], [F()]);

test('kitaplık: tanımlanmamış manevra kitaplıktan çağrılır; programdaki tanım önce gelir', () => {
  const program = [forever(call('safe'))];
  assert.equal(simulate(FIELD, program).reason, 'function');
  assert.equal(simulate(FIELD, program, { library: { safe: [steer()] } }).outcome, 'win');
  // Kitaplıktaki bozuk; programdaki doğru tanım onun önüne geçer.
  const own = [define('safe', steer()), forever(call('safe'))];
  assert.equal(simulate(FIELD, own, { library: { safe: [F()] } }).outcome, 'win');
  assert.equal(simulate(FIELD, program, { library: { safe: [F()] } }).reason, 'meteor');
});

test('kitaplık: Python görünümü içe aktarma satırı ekler; gövde karşılaştırması kimliklere bakmaz', () => {
  const program = [forever(call('safe'))];
  assert.deepEqual(undefinedCalls(program), ['safe']);
  assert.deepEqual(undefinedCalls([define('safe', F()), call('safe')]), []);
  assert.match(toPython(program, { library: ['safe'] }), /^from kitaplik import guvenli_ucus\n/);
  assert.doesNotMatch(toPython(program), /import/);
  const body = [steer()];
  assert.equal(sameBlocks(body, clone(body)), true);
  assert.equal(sameBlocks(body, [F()]), false);
});
