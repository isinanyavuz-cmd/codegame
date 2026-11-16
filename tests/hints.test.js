import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missing, skeleton, hintSteps } from '../src/content/hints.js';
import { welcome, groupLog, dayLabel } from '../src/content/logbook.js';
import { LEVELS, SECTORS, levelById } from '../src/content/levels.js';
import { F, R, forever, ifelse, count, CONTAINERS } from '../src/engine/blocks.js';

test('ikinci ipucu eksik olan ilk şeyi söyler, cevabı vermez', () => {
  assert.match(missing(levelById('2-4'), [F(), R()]), /\*\*tekrarla\*\* bloğu yok/);
  assert.match(missing(levelById('3-5'), [forever(ifelse('ahead', [R()], [F()]))]), /eğer \/ değilse\*\* bloğu daha/);
  assert.match(missing(levelById('5-4'), [forever(ifelse('ahead', [R()], [F()]))]), /olay olunca/);
  assert.match(missing(levelById('1-4'), [F(), F()]), /\*\*sola kaç\*\* daha gerekiyor/);
  assert.match(missing(levelById('1-4'), [F(), F(), F(), R(), R(), { id: 'x', type: 'left' }]), /fazla koymuşsun/);
});

test('her görevde: çözümün kendisinde eksik bulunmaz, boş programda bulunur', () => {
  for (const level of LEVELS) {
    const done = missing(level, level.solution());
    assert.match(done, /hepsi doğru sayıda|Gereken bloklar programında var/, `${level.id}: ${done}`);
    assert.doesNotMatch(missing(level, []), /Gereken bloklar programında var|hepsi doğru sayıda/, level.id);
    assert.ok(hintSteps(level) >= 2);
  }
});

test('iskelet yapıyı korur, komutların yarısını gizler', () => {
  for (const level of LEVELS) {
    const sol = level.solution(), sk = skeleton(sol);
    assert.equal(count(sk), count(sol), level.id);
    let hidden = 0, leaves = 0;
    const walk = (list) => { for (const b of list) { const keys = CONTAINERS[b.type]; if (keys) keys.forEach((k) => walk(b[k])); else { leaves++; if (b.type === 'gizli') hidden++; } } };
    walk(sk);
    assert.equal(hidden, Math.floor(leaves / 2), level.id);
  }
  assert.equal(skeleton(levelById('1-1').solution())[0].type, 'fwd', 'ilk komut açık kalır');
});

test('kaptan günlüğü: yeni günde dönene dünü özetler, aynı gün içinde sormaz', () => {
  const now = new Date(2026, 10, 16, 10).getTime(), yesterday = now - 86400000, old = now - 5 * 86400000;
  const ctx = { levelById, sectorName: (id) => SECTORS.find((s) => s.id === id).name, next: levelById('5-4') };
  assert.equal(welcome([], ctx, now), null);
  assert.equal(welcome([{ t: now - 3600000, kind: 'win', id: '5-1', gain: 3 }], ctx, now), null);
  const w = welcome([{ t: old, kind: 'win', id: '4-8', gain: 2 }, { t: yesterday, kind: 'win', id: '5-1', gain: 3 }, { t: yesterday + 60000, kind: 'win', id: '5-2', gain: 2 }, { t: yesterday + 90000, kind: 'skip', id: '5-3' }], ctx, now);
  assert.equal(w.text, 'Dün Korsan Bölgesi sektöründe 2 görev geçtin ve 5 yıldız topladın.');
  assert.equal(w.next, 'Sırada **Meteor ve Korsan** var.');
  const single = welcome([{ t: old, kind: 'win', id: '4-8', gain: 0 }], { ...ctx, next: levelById('5-8') }, now);
  assert.equal(single.text, '11 Kasım günü Karanlık Bulutsu sektöründe **Bulutsu Finali** görevini geçtin.');
  assert.match(single.next, /sektör finali!/);
  assert.equal(dayLabel(yesterday, now), 'Dün');
  assert.deepEqual(groupLog([{ t: old }, { t: now }, { t: yesterday }], now).map((g) => g.label), ['Bugün', 'Dün', '11 Kasım']);
});

test('görev sonu kancası: sırada ne var ve en yakın hedef', async () => {
  const { teaser, nearGoal } = await import('../src/content/story.js');
  assert.equal(teaser(levelById('1-5')), 'Sırada **Meteor Tarlası**: bu kez programı sıfırdan sen yazacaksın.');
  assert.match(teaser(levelById('2-8')), /sektör finali!/);
  assert.equal(teaser(undefined), '');
  assert.equal(nearGoal({ total: 20, leftInSector: 1, sectorName: 'Kalkış' }), '**Kalkış** sektörünü bitirmene tek görev kaldı.');
  assert.equal(nearGoal({ total: 20, leftInSector: 5, sectorName: 'Kalkış' }), 'Yeni rütbeye 4 yıldız kaldı: **Kıdemli Pilot**.');
  assert.equal(nearGoal({ total: 70, leftInSector: 5, sectorName: 'Korsan Bölgesi' }), '**Korsan Bölgesi** sektöründe 5 görev daha var.');
  assert.equal(nearGoal({ total: 500, leftInSector: 0, sectorName: 'Ana Gemi' }), '');
});
