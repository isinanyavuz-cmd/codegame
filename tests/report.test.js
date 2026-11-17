import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, REASON_LABEL } from '../src/content/report.js';
import { LEVELS, SECTORS } from '../src/content/levels.js';
import { ALL_LEVELS } from '../src/content/extras.js';
import { FAIL_TEXT } from '../src/engine/world.js';

const DAY = 86400000, NOW = Date.UTC(2026, 10, 17, 12);
const make = (stars = {}, tries = {}, extra = {}) => buildReport({ stars: (id) => stars[id] || 0, tries, ...extra }, NOW);

test('veli raporu: boş kayıt', () => {
  const r = make();
  assert.deepEqual([r.totals.stars, r.totals.passed, r.totals.sectors, r.totals.minutes, r.totals.days], [0, 0, 0, 0, 0]);
  assert.equal(r.totals.maxStars, ALL_LEVELS.length * 3);
  assert.equal(r.totals.missions, LEVELS.length);
  assert.equal(r.sectors.length, SECTORS.length);
  assert.ok(r.sectors.every((s) => s.state === 'yok' && s.ease === null));
  assert.deepEqual(r.stuck, []);
  assert.equal(r.tips.length, 1);
  assert.match(r.tips[0], /Henüz başlamamış/);
});

test('veli raporu: sektör durumu, uğraştırma düzeyi ve süre', () => {
  const stars = {}, tries = {};
  for (let n = 1; n <= 8; n++) { stars[`1-${n}`] = 3; tries[`1-${n}`] = { n: 2, fails: 1, streak: 0, ms: 60000, reasons: { meteor: 1 } }; }
  for (let n = 1; n <= 3; n++) { stars[`2-${n}`] = 1; tries[`2-${n}`] = { n: 7, fails: 6, streak: 0, ms: 300000, reasons: { ended: 4, wall: 2 } }; }
  tries['1-g'] = { n: 1, fails: 0, streak: 0, ms: 120000, reasons: {} };
  const r = make(stars, tries, { log: [{ t: NOW - DAY, kind: 'win', id: '1-1' }, { t: NOW - DAY - 5000, kind: 'win', id: '1-2' }, { t: NOW - 3 * DAY, kind: 'win', id: '2-1' }], dailyDays: 2 });
  const [s1, s2, s3] = r.sectors;
  assert.deepEqual([s1.state, s1.ease, s1.passed, s1.stars, s1.minutes], ['tamam', 'rahat', 8, 24, 10], 'gizli görevin süresi de sektöre yazılır');
  assert.deepEqual([s2.state, s2.ease, s2.passed, s2.stars], ['suruyor', 'zorlandi', 3, 3]);
  assert.equal(s3.state, 'yok');
  assert.deepEqual([r.totals.stars, r.totals.passed, r.totals.sectors, r.totals.days, r.totals.daily, r.totals.idleDays], [27, 11, 1, 2, 2, 1]);
  assert.equal(r.totals.minutes, 8 + 15 + 2);
  assert.deepEqual(r.reasons.map((x) => [x.reason, x.count]), [['ended', 12], ['meteor', 8], ['wall', 6]]);
  assert.ok(r.tips.some((t) => t.includes('Asteroit Kuşağı')), 'en çok uğraştıran sektör söylenir');
});

test('veli raporu: takıldığı görevler ve öneriler', () => {
  const stars = { '1-1': 3, '3-5-b': 2 };
  const tries = {
    '1-2': { n: 9, fails: 9, streak: 9, ms: 0, reasons: { meteor: 9 } },
    '1-3': { n: 2, fails: 2, streak: 2, ms: 0, reasons: {} },                 // az deneme: takılma sayılmaz
    '3-5': { n: 6, fails: 6, streak: 6, ms: 0, reasons: { meteor: 6 } },      // öteki yolundan geçti: takılı değil
    '2-1': { n: 1, fails: 1, streak: 1, ms: 0, reasons: {} },
  };
  const r = make(stars, tries, { isSkipped: (id) => id === '2-1', log: [{ t: NOW - 9 * DAY, kind: 'win', id: '1-1' }] });
  assert.deepEqual(r.stuck.map((s) => s.id), ['1-2', '2-1']);
  assert.equal(r.stuck[1].skipped, true);
  assert.match(r.tips[0], /İlk Manevra.*9 kez denedi/);
  assert.ok(r.tips.some((t) => t.includes('meteora')), 'en sık hata için öneri');
  assert.ok(r.tips.some((t) => t.includes('9 gün')), 'uzun aradan sonra hatırlatma');
});

test('veli raporu: bütün görevler bitince tebrik; her başarısızlık nedeninin adı var', () => {
  const stars = Object.fromEntries(LEVELS.map((l) => [l.id, 3]));
  const r = make(stars);
  assert.equal(r.totals.passed, LEVELS.length);
  assert.equal(r.totals.sectors, SECTORS.length);
  assert.ok(r.tips.some((t) => t.includes('Atölye')));
  for (const reason of Object.keys(FAIL_TEXT)) if (!['empty', 'value', 'noevent', 'recursion'].includes(reason)) assert.ok(REASON_LABEL[reason], `${reason} için veli etiketi yok`);
});
