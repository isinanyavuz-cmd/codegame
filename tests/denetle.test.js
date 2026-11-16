import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditAll, shortest, KABUL } from '../tools/denetle.js';
import { parseField, simulate } from '../src/engine/world.js';
import { count } from '../src/engine/blocks.js';

const rows = auditAll();

test('görev denetçisi hata bulmuyor', () => {
  const errors = rows.flatMap(({ level, findings }) => findings.filter((f) => f.duzey === 'HATA').map((f) => `${level.id}: ${f.metin}`));
  assert.deepEqual(errors, []);
});

test('kavramı atlayıp tam yıldız almanın her yolu ya kapalı ya da bilerek kabul edilmiş', () => {
  const warnings = rows.flatMap(({ level, findings }) => findings.filter((f) => f.duzey === 'UYARI').map((f) => `${level.id}:${f.kod}`));
  const fresh = warnings.filter((w) => !KABUL[w]);
  assert.deepEqual(fresh, [], 'yeni uyarı: görevi düzelt ya da tools/denetle.js içindeki KABUL listesine nedeniyle ekle');
  const stale = Object.keys(KABUL).filter((k) => !warnings.includes(k));
  assert.deepEqual(stale, [], 'KABUL listesinde artık geçerli olmayan kayıt var');
});

test('en kısa yazım: tekrarları döngüye toplar ve aynı rotayı uçar', () => {
  const moves = [...'FFFFRLRLRLFF'].map((c) => ({ F: 'fwd', L: 'left', R: 'right' }[c]));
  const lines = Array.from({ length: 12 }, () => '.....'); lines[11] = '..S..';
  const flown = (p) => simulate(parseField(lines), p).events.filter((e) => e.t === 'move').map((e) => e.kind);
  const plain = shortest(moves, []), looped = shortest(moves, ['repeat', 'forever']);
  assert.equal(count(plain), 12);
  assert.ok(count(looped) <= 8, `${count(looped)} blok`);
  assert.deepEqual(flown(looped), moves);
  assert.deepEqual(flown(plain), moves);
});
