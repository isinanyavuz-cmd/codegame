import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyLevel, dailyTier, dayTitle } from '../src/content/daily.js';
import { blankField, encodeField, decodeField, hasRoute, customLevel, SIZE } from '../src/content/custom.js';
import { parseField, simulate, stars } from '../src/engine/world.js';
import { count, CONTAINERS } from '../src/engine/blocks.js';

const types = (program, out = new Set()) => { for (const b of program) { out.add(b.type); for (const k of CONTAINERS[b.type] || []) types(b[k], out); } return out; };
const days = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(2026, 0, 1 + i * 3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });

test('günün dalgası: basamak çocuğun geçtiği görevlere göre seçilir', () => {
  const won = (...ids) => (id) => ids.includes(id);
  assert.equal(dailyTier(won()), 1);
  assert.equal(dailyTier(won('2-4')), 2);
  assert.equal(dailyTier(won('2-4', '3-5')), 3);
  assert.equal(dailyTier(won('3-5', '5-6')), 4);
  assert.equal(dailyTier(won('5-6', '6-8')), 5);
});

test('günün dalgası: her gün ve her basamakta çözülebilir, tam yıldız alınabilir ve paletle yazılabilir', () => {
  for (let tier = 1; tier <= 5; tier++) for (const day of days(40)) {
    const level = dailyLevel(day, tier), sol = level.solution(), name = `${day} / ${tier}`;
    const results = level.waves.map((w) => simulate(parseField(w), sol));
    assert.equal(stars(results, count(sol), level.par), 3, name);
    assert.ok(count(sol) <= level.maxBlocks, name);
    for (const t of types(sol)) assert.ok(level.tools.includes(t), `${name}: palette ${t} yok`);
    assert.ok(level.free && level.day === day && level.id === `gun-${day}` && level.brief && level.hint, name);
    assert.ok(results.every((r) => r.total >= 2), `${name}: kristal yok`);
  }
});

test('günün dalgası: aynı gün aynı görevi verir, başka gün başkasını', () => {
  for (let tier = 1; tier <= 5; tier++) {
    assert.deepEqual(dailyLevel('2026-11-17', tier).waves, dailyLevel('2026-11-17', tier).waves);
    const seen = new Set(days(20).map((d) => dailyLevel(d, tier).waves.flat().join('/')));
    assert.ok(seen.size >= 18, `basamak ${tier}: ${seen.size} farklı görev`);
  }
  assert.equal(dayTitle('2026-11-07'), '7 Kasım');
});

test('atölye: alan koda çevrilir ve geri okunur; bozuk kod reddedilir', () => {
  const lines = ['..K..', '.MPM.', '..B..', 'E....', '..S..'];
  const code = encodeField(lines, 7);
  assert.match(code, /^[.MKBPES~0-9-]+$/, 'bağlantıda kaçış gerektirmeyen karakterler');
  assert.deepEqual(decodeField(code), { lines, par: 7 });
  for (const bad of ['', 'abc', '..S..~5', '.....-.....-.....-.....-.....~4', '..X..-.....-.....-.....-..S..~4', `${lines.join('-')}~0`, lines.join('-'), `${'.'.repeat(9)}-`.repeat(4) + '....S....~3']) assert.equal(decodeField(bad), null, bad);
  const blank = blankField(SIZE.lanes[0], SIZE.rows[0]);
  assert.equal(parseField(blank).start, 1);
  assert.deepEqual(decodeField(encodeField(blank, 5)).lines, blank);
});

test('atölye: çıkışa yol yoksa görev denenemez', () => {
  assert.equal(hasRoute(['.....', '.....', '..S..']), true);
  assert.equal(hasRoute(['.....', 'MMMMM', '.....', '.....', '..S..']), false);
  assert.equal(hasRoute(['.....', 'MMM..', '.....', '.....', 'S....']), true, 'üç sırada üç şerit yana gidilir');
  assert.equal(hasRoute(['.....', 'MMMM.', '.....', '.....', 'S....']), false, 'dört şerit uzaktaki boşluğa üç sırada varılamaz');
  assert.equal(hasRoute(['....M', 'MMMM.', 'MMM.M', '.....', 'S....']), false, 'tek boşluk gemiden üç şerit uzakta, iki sıra ötede');
});

test('atölye: palet alanın içindekilere göre kurulur; çözülmemiş görevde blok hedefi yoktur', () => {
  const plain = customLevel(['.M...', '.....', '.....', '.....', '..S..']);
  assert.deepEqual(plain.tools, ['fwd', 'left', 'right', 'repeat', 'forever', 'ifelse']);
  assert.equal(plain.par, 0);
  assert.equal(plain.own, true);
  const rich = customLevel(['..K..', '.MPM.', '..B..', 'E....', '..S..'], { par: 9, own: false, library: ['safe'] });
  for (const t of ['until', 'on', 'shield', 'setEnergy', 'addEnergy']) assert.ok(rich.tools.includes(t), t);
  assert.deepEqual(rich.events, ['pirate', 'energy', 'beacon', 'crystal']);
  assert.ok(rich.conds.includes('atBeacon') && rich.conds.includes('energyLow'));
  assert.equal(rich.par, 9);
  assert.equal(rich.sector, 6);
  assert.deepEqual(rich.functions, ['safe']);
  assert.notEqual(rich.id, plain.id);
  assert.equal(decodeField(rich.hash.slice('oyna='.length)).par, 9);
});

test('günün dalgası: 2. basamaktan sonra arada bir lazer günü gelir; pil duvar sayısı kadardır', async () => {
  const { fire, forever, F } = await import('../src/engine/blocks.js');
  const laser = days(40).map((d) => dailyLevel(d, 3)).filter((l) => l.tools.includes('fire'));
  assert.ok(laser.length >= 5 && laser.length <= 20, `${laser.length} lazer günü`);
  assert.ok(days(40).every((d) => !dailyLevel(d, 1).tools.includes('fire')), 'ilk basamakta lazer yok');
  for (const level of laser) {
    const f = parseField(level.waves[0]);
    assert.equal(f.battery, level.solution()[0].count);
    assert.notEqual(simulate(f, [forever(fire(), F())]).outcome, 'win');
  }
});

test('atölye: lazer pili bağlantıda taşınır; kristalli kaya ve demir konabilir', () => {
  const lines = ['..K..', 'MMGMM', '..D..', '.....', '..S..'];
  assert.deepEqual(decodeField(encodeField(lines, 6, 3)), { lines, par: 6, battery: 3 });
  assert.deepEqual(decodeField(encodeField(lines, 6)), { lines, par: 6 });
  assert.equal(hasRoute(lines), false);
  assert.equal(hasRoute(lines, { laser: true }), true);
  assert.equal(hasRoute(['.....', 'DDDDD', '.....', '.....', '..S..'], { laser: true }), false, 'demiri lazer de kıramaz');
  const level = customLevel(lines, { battery: 3 });
  assert.ok(level.tools.includes('fire') && level.tools.includes('beam') && level.events.includes('rock'));
  assert.equal(parseField(level.waves[0]).battery, 3);
  assert.ok(!customLevel(lines).tools.includes('fire'));
});
