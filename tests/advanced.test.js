import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseField, simulate, sense } from '../src/engine/world.js';
import { F, R, forever, ifelse, until, on, shield, setEnergy, addEnergy, define, call, clone, count, find, remove, toPython, CONTAINERS, create } from '../src/engine/blocks.js';
import { LEVELS, SECTORS, levelsOf } from '../src/content/levels.js';

const run = (lines, program) => simulate(parseField(lines), program);

test('sekiz sektör ve 64 görev tamam: ilk üç sektörün kimlikleri korunur', () => {
  assert.equal(SECTORS.length, 8);
  assert.equal(LEVELS.length, 64);
  assert.ok(SECTORS.every((s) => !s.soon && s.intro));
  for (const s of SECTORS) {
    assert.equal(levelsOf(s.id).length, 8);
    assert.equal(levelsOf(s.id)[0].id, `${s.id}-1`);
  }
  assert.equal(LEVELS[23].id, '3-8');
  assert.equal(LEVELS[24].id, '4-1');
});

test('eski ilerleme kaydı korunur ve üçüncü sektör finali yeni sektörü açar', async () => {
  const original = globalThis.localStorage;
  const saved = { stars: { '1-1': 3, '3-8': 2 }, programs: { '1-1': [F()] }, intros: { 3: true }, sound: false, speed: 2 };
  globalThis.localStorage = {
    getItem(key) { assert.equal(key, 'kodpilotu.v1'); return JSON.stringify(saved); },
    setItem() {},
  };
  try {
    const { store } = await import('../src/storage.js?legacy-progress-test');
    assert.equal(store.total(), 5);
    assert.deepEqual(store.program('1-1'), saved.programs['1-1']);
    assert.ok(store.introSeen(3));
    assert.equal(store.sound, false);
    assert.equal(store.speed, 2);
    assert.equal(store.isUnlocked(LEVELS[24], LEVELS), true);
    assert.equal(store.isUnlocked(LEVELS[25], LEVELS), false);
    store.setStars('4-1', 1);
    assert.equal(store.isUnlocked(LEVELS[25], LEVELS), true);
  } finally {
    if (original === undefined) delete globalThis.localStorage; else globalThis.localStorage = original;
  }
});

test('yeni nesneler ayrıdır ve alan çizimi geçersiz başlangıcı reddeder', () => {
  const f = parseField(['.B.', '.P.', '.E.', '.S.']);
  assert.ok(f.beacons.has('1,3'));
  assert.ok(f.pirates.has('1,2'));
  assert.ok(f.energyCells.has('1,1'));
  assert.throws(() => parseField([]));
  assert.throws(() => parseField(['...', 'SS.']));
});

test('olana kadar işarette durur ve sonraki komuta geçer', () => {
  const result = run(['...', '.M.', '.BK', '...', '.S.'], [until('atBeacon', F()), R(), forever(F())]);
  assert.equal(result.outcome, 'win');
  assert.deepEqual(result.events.filter((e) => e.t === 'move').map((e) => e.kind), ['fwd', 'fwd', 'right', 'fwd', 'fwd']);
  const f = parseField(['...', '.S.']); f.beacons.add('1,0');
  assert.equal(simulate(f, [until('atBeacon', R()), forever(F())]).outcome, 'win');
});

test('VE ile VEYA doğru doğruluk tablolarını ve şerit duvarını kullanır', () => {
  for (const [row, ahead, rightFree] of [['...', false, true], ['.M.', true, true], ['..M', false, false], ['.MM', true, false]]) {
    const f = parseField([row, '.S.']);
    assert.equal(sense(f, 1, 0, 'aheadAndRightFree').result, ahead && rightFree);
    assert.equal(sense(f, 1, 0, 'aheadOrRightBlocked').result, ahead || !rightFree);
  }
  assert.equal(sense(parseField(['...', '..S']), 2, 0, 'aheadOrRightBlocked').result, true);
});

test('kalkan bir korsan saldırısını durdurur, olay her yeni saldırıda çalışır', () => {
  const lines = ['...', '.P.', '...', '.P.', '.S.'];
  assert.equal(run(lines, [shield(), forever(F())]).reason, 'pirate');
  const result = run(lines, [on('pirate', shield()), forever(F())]);
  assert.equal(result.outcome, 'win');
  assert.equal(result.events.filter((e) => e.t === 'event').length, 2);
  assert.equal(result.events.filter((e) => e.blocked).length, 2);
  assert.equal(result.shielded, false);
  assert.equal(run(['...', '.M.', '.S.'], [shield(), forever(F())]).reason, 'meteor');
});

test('işaret ve kristal olayları yalnızca varınca çalışır', () => {
  for (const [symbol, event] of [['B', 'beacon'], ['K', 'crystal']]) {
    const result = run(['...', '.P.', `.${symbol}.`, '.S.'], [on(event, shield()), forever(F())]);
    assert.equal(result.outcome, 'win');
    assert.equal(result.events.filter((e) => e.t === 'event')[0].y, 1);
  }
  assert.equal(run(['.K.', '.P.', '.S.'], [on('crystal', shield()), forever(F())]).reason, 'pirate');
});

test('olay içindeki manevra çakışan uçuş komutunun yerini alır', () => {
  const result = run(['...', '...', '.P.', '.S.'], [on('pirate', R()), forever(F())]);
  assert.equal(result.outcome, 'win');
  assert.equal(result.ticks, 4);
  assert.deepEqual(result.events.find((e) => e.t === 'move').to, { lane: 2, y: 1 });
});

test('bir olay gemiyi başka nesneye taşıyınca varış olayı iki kez tetiklenmez', () => {
  const result = run(['...', '..B', '.K.', '.S.'], [on('crystal', R()), on('beacon', shield()), forever(F())]);
  assert.equal(result.outcome, 'win');
  assert.equal(result.events.filter((e) => e.t === 'event' && e.event === 'beacon').length, 1);
});

test('enerji çıkış adımı dahil her uçuşta bir azalır; istasyon kendi kendine doldurmaz', () => {
  const lines = ['...', '...', '.E.', '.S.'];
  assert.equal(run(lines, [forever(F())]).reason, 'energy');
  assert.equal(run(lines, [setEnergy(3), forever(F())]).reason, 'energy');
  const result = run(lines, [setEnergy(4), forever(F())]);
  assert.equal(result.outcome, 'win');
  assert.equal(result.energy, 0);
  assert.deepEqual(result.events.filter((e) => e.t === 'move').map((e) => e.energy), [3, 2, 1, 0]);
});

test('enerji yalnızca istasyonda artırılır ve sensör güncel değeri okur', () => {
  assert.equal(run(['...', '.E.', '.S.'], [setEnergy(1), addEnergy(3)]).reason, 'station');
  const result = run(['...', '...', '.E.', '.S.'], [on('energy', addEnergy(3)), setEnergy(1), forever(F())]);
  assert.equal(result.outcome, 'win');
  assert.equal(result.energy, 0);
  assert.equal(run(['...', '.S.'], [setEnergy(-1), F()]).reason, 'value');
  const f = parseField(['...', '.S.']);
  assert.equal(sense(f, 1, 0, 'energyLow', { energy: 2 }).result, true);
  assert.equal(sense(f, 1, 0, 'energyLow', { energy: 3 }).result, false);
});

test('bir dalganın enerjisi, olayları ve fonksiyonları diğerine taşınmaz', () => {
  const f = parseField(['...', '.E.', '.S.']);
  const program = [on('energy', addEnergy(3)), setEnergy(1), forever(F())];
  assert.deepEqual(simulate(f, program), simulate(f, program));
  assert.equal(simulate(f, [forever(F())]).reason, 'energy');
  const plain = parseField(['...', '.S.']);
  assert.equal(simulate(plain, [define('straight', F()), call('straight'), call('straight')]).outcome, 'win');
  assert.equal(simulate(plain, [call('straight')]).reason, 'function');
});

test('fonksiyon tanımı uçmaz; çağrı gövdeyi çalıştırır ve olaylardan da çağrılabilir', () => {
  assert.equal(run(['...', '.S.'], [define('straight', F())]).ticks, 0);
  const result = run(['...', '.P.', '.S.'], [define('protect', shield()), on('pirate', call('protect')), forever(F())]);
  assert.equal(result.outcome, 'win');
  assert.ok(result.events.some((e) => e.t === 'call' && e.name === 'protect'));
  assert.equal(run(['...', '.S.'], [define('safe'), define('safe')]).reason, 'definition');
  assert.equal(run(['...', '.S.'], [define('safe', call('safe')), call('safe')]).reason, 'recursion');
});

test('hareketsiz yeni döngüler ve boş fonksiyonlar sınırlı olayla durur', () => {
  for (const program of [[until('atBeacon')], [forever(shield())], [forever(setEnergy(3))], [define('safe'), forever(call('safe'))]]) {
    const result = run(['...', '.S.'], program);
    assert.equal(result.outcome, 'fail');
    assert.equal(result.reason, 'idle');
    assert.ok(result.events.length < 30);
  }
});

test('yeni kapsayıcıların tamamı kopyalanır, sayılır ve içlerinden blok silinir', () => {
  const action = addEnergy(3);
  const program = [define('refuel', action), on('energy', call('refuel')), until('atBeacon', F())];
  const copy = clone(program);
  assert.equal(count(program), 6);
  assert.notEqual(copy[0].body[0].id, action.id);
  assert.equal(find(program, action.id).block, action);
  assert.equal(remove(program, action.id), action);
  assert.equal(count(program), 5);
  for (const type of ['until', 'on', 'define', 'call', 'shield', 'setEnergy', 'addEnergy']) assert.equal(create(type).type, type);
});

test('Python görünümü yeni mantığı, olayları, değişkenleri ve fonksiyonları gösterir', () => {
  const py = toPython([define('protect', shield()), on('pirate', call('protect')), setEnergy(3), until('atBeacon', ifelse('aheadAndRightFree', [R()], [F()])), addEnergy(3)]);
  assert.match(py, /def korunma\(\):\n    kalkan_ac\(\)/);
  assert.match(py, /@korsan_gorunce/);
  assert.match(py, /enerji = 3/);
  assert.match(py, /while not \(isarette_miyim\(\)\):/);
  assert.match(py, /onumde_meteor_var\(\) and sagim_bos\(\)/);
  assert.match(py, /enerji \+= 3/);
});

test('her görevde olay ve fonksiyon adları düzenleyiciden seçilebilir', () => {
  function check(program, level) {
    for (const b of program) {
      if (b.type === 'on') assert.ok(level.events.includes(b.event), `${level.id}: olay ${b.event}`);
      if (['define', 'call'].includes(b.type)) assert.ok(level.functions.includes(b.name), `${level.id}: fonksiyon ${b.name}`);
      for (const k of CONTAINERS[b.type] || []) check(b[k], level);
    }
  }
  for (const level of LEVELS.filter((l) => l.sector >= 4)) {
    check(level.solution(), level);
    if (level.initial) check(level.initial(), level);
  }
});

test('değişen işaret dalgaları tek bir sabit mesafeye indirgenmez', () => {
  const level = LEVELS.find((l) => l.id === '4-2');
  const positions = level.waves.map((w) => [...parseField(w).beacons][0]);
  assert.equal(new Set(positions).size, 3);
  for (const n of [2, 4, 6]) {
    const fixed = [...Array.from({ length: n }, F), R(), forever(F())];
    assert.ok(level.waves.some((w) => simulate(parseField(w), fixed).outcome !== 'win'));
  }
});
