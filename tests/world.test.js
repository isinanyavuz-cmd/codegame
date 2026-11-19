import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseField, simulate, sense, stars, FAIL_TEXT } from '../src/engine/world.js';
import { F, L, R, rep, forever, ifelse, count, clone, find, remove, toPython } from '../src/engine/blocks.js';

const field = (lines) => parseField(lines);
const kinds = (res) => res.events.map((e) => e.t);

test('alan metinden okunur: ilk satır en uzak sıra', () => {
  const f = field(['.K.', '.M.', '..S']);
  assert.equal(f.lanes, 3); assert.equal(f.rows, 3); assert.equal(f.start, 2);
  assert.ok(f.meteors.has('1,1')); assert.ok(f.crystals.has('1,2'));
});

test('başlangıç karesi yoksa hata verir', () => {
  assert.throws(() => field(['...', '...']));
});

test('her komut gemiyi bir sıra ilerletir; son sırayı geçince kazanır', () => {
  const res = simulate(field(['...', '...', '.S.']), [F(), F(), F()]);
  assert.equal(res.outcome, 'win');
  assert.deepEqual(kinds(res), ['move', 'move', 'move', 'win']);
  assert.equal(res.ticks, 3);
});

test('kaçış blokları çapraz gider', () => {
  const res = simulate(field(['...', '.S.']), [L(), R()]);
  assert.deepEqual(res.events[0].to, { lane: 0, y: 1 });
  assert.equal(res.outcome, 'win');
});

test('meteora çarpınca durur ve sorumlu bloğu bildirir', () => {
  const bad = F();
  const res = simulate(field(['...', '.M.', '.S.']), [bad, F()]);
  assert.equal(res.outcome, 'crash'); assert.equal(res.reason, 'meteor');
  assert.equal(res.events.at(-1).id, bad.id);
});

test('şeridin dışına çıkmak çarpışmadır', () => {
  const res = simulate(field(['...', 'S..']), [L()]);
  assert.equal(res.outcome, 'crash'); assert.equal(res.reason, 'wall');
});

test('program erken biterse başarısız', () => {
  const res = simulate(field(['...', '...', '.S.']), [F()]);
  assert.equal(res.outcome, 'fail'); assert.equal(res.reason, 'ended');
  assert.equal(simulate(field(['...', '.S.']), []).reason, 'empty');
});

test('kristaller toplanır ve sayılır', () => {
  const res = simulate(field(['...', 'K..', '.K.', '.S.']), [F(), L(), F(), F()]);
  assert.equal(res.outcome, 'win'); assert.equal(res.collected, 2); assert.equal(res.total, 2);
  assert.equal(res.events[0].collect, true);
});

test('tekrarla gövdeyi sayı kadar çalıştırır', () => {
  const res = simulate(field(['...', '...', '...', '...', '.S.']), [rep(5, F())]);
  assert.equal(res.outcome, 'win'); assert.equal(res.ticks, 5);
});

test('sürekli döngü kazanınca durur', () => {
  const res = simulate(field(['...', '...', '...', '.S.']), [forever(F())]);
  assert.equal(res.outcome, 'win'); assert.equal(res.ticks, 4);
});

test('eğer/değilse sensöre göre dal seçer ve sense olayı üretir', () => {
  const res = simulate(field(['...', '.M.', '...', '.S.']), [forever(ifelse('ahead', [R()], [F()]))]);
  assert.equal(res.outcome, 'win');
  const senses = res.events.filter((e) => e.t === 'sense').map((e) => e.result);
  assert.deepEqual(senses, [false, true, false, false]);
  assert.deepEqual(res.events.filter((e) => e.t === 'move').map((e) => e.kind), ['fwd', 'right', 'fwd', 'fwd']);
});

test('hiç manevra yapmayan döngü "komut bekliyor" hatası verir', () => {
  const empty = simulate(field(['...', '.S.']), [forever()]);
  assert.equal(empty.reason, 'idle');
  const res = simulate(field(['...', '...', '.S.']), [forever(ifelse('ahead', [R()], []))]);
  assert.equal(res.outcome, 'fail'); assert.equal(res.reason, 'idle');
  assert.ok(res.events.length < 20, 'olay listesi şişmemeli');
});

test('koşulu olmayan eğer bloğu hata verir', () => {
  assert.equal(simulate(field(['...', '.S.']), [ifelse(null, [F()], [F()])]).reason, 'nocond');
});

test('yan sensörler duvarı dolu sayar', () => {
  const f = field(['M..', 'S..']);
  assert.equal(sense(f, 0, 0, 'leftFree').result, false);
  assert.equal(sense(f, 0, 0, 'rightFree').result, true);
  assert.equal(sense(f, 0, 0, 'ahead').result, true);
  assert.equal(sense(f, 1, 0, 'leftFree').result, false);
});

test('yıldızlar: geçmek 1, bütün kristaller +1, az blok +1', () => {
  const win = { outcome: 'win', collected: 2, total: 2 }, missed = { outcome: 'win', collected: 1, total: 2 };
  assert.equal(stars([win], 3, 3), 3);
  assert.equal(stars([win], 4, 3), 2);
  assert.equal(stars([missed], 3, 3), 2);
  assert.equal(stars([missed], 5, 3), 1);
  assert.equal(stars([win, { outcome: 'crash' }], 3, 3), 0);
});

test('blok ağacı işlemleri', () => {
  const inner = R();
  const prog = [F(), rep(2, L(), ifelse('ahead', [inner], [F()]))];
  assert.equal(count(prog), 6);
  assert.equal(find(prog, inner.id).block, inner);
  const copy = clone(prog);
  assert.equal(count(copy), 6); assert.notEqual(copy[0].id, prog[0].id);
  assert.equal(remove(prog, inner.id), inner); assert.equal(count(prog), 5);
});

test('Python görünümü', () => {
  const py = toPython([rep(3, F()), forever(ifelse('ahead', [R()], []))]);
  assert.equal(py, [
    'for i in range(3):', '    duz_uc()', 'while True:', '    if onumde_meteor_var():', '        saga_kac()', '    else:', '        pass',
  ].join('\n'));
});

// ---------- sayaç değişkeni ve sayı alan manevra ----------
import { until, on, define, call, setCounter, addCounter, defineN, callN, pythonLines } from '../src/engine/blocks.js';

test('sayaç: ayarlanmadan artırılamaz; olayla artar ve koşul ona bakar', () => {
  const f = field(['.....', '.....', '..K..', '..K..', '..K..', '..S..']);
  assert.equal(simulate(f, [on('crystal', addCounter(1)), forever(F())]).reason, 'counter');
  const res = simulate(f, [setCounter(0), on('crystal', addCounter(1)), until('counter3', F()), R()]);
  assert.equal(res.counter, 3);
  assert.deepEqual(res.ship, { lane: 3, y: 4 }, 'üçüncü kristalde döngü biter, sağa kaçış bir kez çalışır');
  assert.deepEqual(res.events.filter((e) => e.t === 'variable').map((e) => [e.name, e.value]), [['counter', 0], ['counter', 1], ['counter', 2], ['counter', 3]]);
  assert.equal(sense(f, 2, 0, 'counter3', { counter: null }).result, false);
  assert.equal(sense(f, 2, 0, 'counter3', { counter: 4 }).result, true);
});

test('sayı alan manevra: çağrıdaki sayı tanımdaki "n kez tekrarla"ya gider', () => {
  const f = field(Array.from({ length: 9 }, (_, i) => (i === 8 ? '.S..' : '....')));
  const zig = () => defineN('zigzag', rep('n', R(), L()));
  const moves = (p) => simulate(f, p).events.filter((e) => e.t === 'move').map((e) => e.kind[0]).join('');
  assert.equal(moves([zig(), callN('zigzag', 1), F(), callN('zigzag', 2)]), 'rlfrlrl');
  // Sayı verilmeden çağrı ve manevra dışında "n" hatadır.
  assert.equal(simulate(f, [zig(), call('zigzag')]).reason, 'param');
  assert.equal(simulate(f, [rep('n', F())]).reason, 'param');
  // İç içe çağrıda her manevra kendi sayısını görür.
  const nested = [defineN('zigzag', rep('n', R(), L())), defineN('straight', rep('n', F()), callN('zigzag', 1)), callN('straight', 2)];
  assert.equal(moves(nested), 'ffrl');
});

test('Python satırları: her satır kendi bloğunu bilir; sayaç ve parametre yazılır', () => {
  const prog = [setCounter(0), defineN('zigzag', rep('n', R(), L())), callN('zigzag', 2), define('safe', F()), call('safe'), addCounter(1)];
  const lines = pythonLines(prog);
  assert.deepEqual(lines.map((l) => l.text), ['sayac = 0', 'def zikzak(n):', '    for i in range(n):', '        saga_kac()', '        sola_kac()', 'zikzak(2)', 'def guvenli_ucus():', '    duz_uc()', 'guvenli_ucus()', 'sayac += 1']);
  assert.equal(lines[0].id, prog[0].id);
  assert.equal(lines[5].id, prog[2].id);
  assert.equal(toPython(prog), lines.map((l) => l.text).join('\n'));
});

test('ateş et: gemi yerinde kalır, şeridindeki ilk kaya parçalanır ve yol açılır', async () => {
  const { fire } = await import('../src/engine/blocks.js');
  const f = field(['.M.', '.M.', '...', '.S.']);
  // Ateş etmeden duvara çarpar.
  assert.equal(simulate(f, [F(), F()]).reason, 'meteor');
  const res = simulate(f, [fire(), fire(), F(), F(), F(), F()]);
  assert.equal(res.outcome, 'win');
  assert.equal(res.broken, 2);
  const shots = res.events.filter((e) => e.t === 'fire');
  assert.deepEqual(shots.map((e) => e.hit), [{ lane: 1, y: 2 }, { lane: 1, y: 3 }]);
  assert.deepEqual(shots[0].from, { lane: 1, y: 0 });
  // Asıl alan değişmez: aynı alanda yeni uçuş kayaları yerinde bulur.
  assert.ok(f.meteors.has('1,2'));
  // Boşa atış hata değildir; sensör kırılan kayayı görmez.
  const miss = simulate(field(['...', '.S.']), [fire(), F(), F()]);
  assert.equal(miss.outcome, 'win'); assert.equal(miss.events.find((e) => e.t === 'fire').hit, null);
  const sensed = simulate(field(['...', '.M.', '.S.']), [fire(), forever(ifelse('ahead', [R()], [F()]))]);
  assert.equal(sensed.outcome, 'win');
  assert.ok(!sensed.events.some((e) => e.t === 'move' && e.kind === 'right'));
  // Hiç uçmadan sürekli ateş eden program durdurulur.
  assert.equal(simulate(f, [forever(fire())]).reason, 'idle');
  assert.match(toPython([fire()]), /ates_et\(\)/);
});

test('lazer pili: küçük lazer 1, güçlü lazer 3 hücre harcar; yetmezse uçuş biter', async () => {
  const { fire, beam } = await import('../src/engine/blocks.js');
  const { pilli, LASER_COST } = await import('../src/engine/world.js');
  assert.deepEqual(LASER_COST, { fire: 1, beam: 3 });
  const lines = pilli(['...', '.M.', '.M.', '.S.'], 3);
  assert.equal(parseField(lines).battery, 3);
  // Pilsiz alan sınırsızdır; pilli() asıl diziyi değiştirmez.
  assert.equal(parseField(['...', '.S.']).battery, null);
  const res = simulate(parseField(lines), [fire(), fire(), F(), F(), F(), F()]);
  assert.equal(res.outcome, 'win'); assert.equal(res.battery, 1);
  assert.deepEqual(res.events.filter((e) => e.t === 'fire').map((e) => e.battery), [2, 1]);
  assert.equal(simulate(parseField(lines), [beam(), F(), F(), F(), F()]).battery, 0);
  assert.equal(simulate(parseField(lines), [fire(), beam()]).reason, 'battery');
  // Boşa giden atış da pil yer: durmadan ateş eden program pili bitirir.
  assert.equal(simulate(parseField(pilli(['....', '.M..', '....', '.S..'], 3)), [forever(fire(), F())]).reason, 'battery');
  assert.ok(FAIL_TEXT.battery && FAIL_TEXT.iron);
});

test('kristalli kaya kırılınca kristal bırakır; demir asteroit lazeri durdurur ve kırılmaz', async () => {
  const { fire, beam } = await import('../src/engine/blocks.js');
  const geo = field(['...', '.G.', '.S.']);
  assert.equal(simulate(geo, [F(), F()]).reason, 'meteor');
  const won = simulate(geo, [fire(), F(), F(), F()]);
  assert.equal(won.outcome, 'win'); assert.equal(won.collected, 1); assert.equal(won.total, 1);
  assert.deepEqual(won.events.find((e) => e.t === 'fire').hit, { lane: 1, y: 1, gem: true });
  const iron = field(['.M.', '.D.', '.M.', '.S.']);
  const shot = simulate(iron, [fire(), fire(), F(), F()]);
  assert.equal(shot.reason, 'iron');
  assert.deepEqual(shot.events.filter((e) => e.t === 'fire').map((e) => [e.hit, e.iron]), [[{ lane: 1, y: 1 }, null], [null, { lane: 1, y: 2 }]]);
  const b = simulate(iron, [beam()]).events.find((e) => e.t === 'beam');
  assert.deepEqual(b.hits, [{ lane: 1, y: 1 }]); assert.deepEqual(b.iron, { lane: 1, y: 2 });
  // Sensörler demiri engel olarak görür ama kaya saymaz.
  assert.equal(sense(iron, 1, 1, 'ahead').result, true);
  assert.equal(sense(iron, 1, 1, 'rockAhead').result, false);
  assert.equal(sense(iron, 1, 0, 'rockAhead').result, true);
});

test('lazer sensörleri ve "kaya görünce" olayı', async () => {
  const { fire, until, on } = await import('../src/engine/blocks.js');
  const f = field(['.M.', '...', '.M.', '.M.', '.S.']);
  assert.equal(sense(f, 1, 0, 'laneClear').result, false);
  assert.equal(sense(f, 0, 0, 'laneClear').result, true);
  assert.equal(sense(f, 1, 0, 'rocks3').result, true);
  assert.equal(sense(f, 1, 2, 'rocks3').result, false);
  assert.equal(simulate(f, [until('laneClear', fire()), forever(F())]).outcome, 'win');
  const ev = simulate(f, [on('rock', fire()), forever(F())]);
  assert.equal(ev.outcome, 'win'); assert.equal(ev.broken, 3);
  assert.equal(ev.events.filter((e) => e.t === 'event' && e.event === 'rock').length, 3);
});

test('güçlü lazer: şeritteki bütün kayaları birden parçalar, öteki şeritlere dokunmaz', async () => {
  const { beam, fire } = await import('../src/engine/blocks.js');
  const f = field(['MMM', 'M.M', 'MMM', '.S.']);
  const res = simulate(f, [beam(), F(), F(), F(), F()]);
  assert.equal(res.outcome, 'win');
  assert.equal(res.broken, 2);
  const ev = res.events.find((e) => e.t === 'beam');
  assert.deepEqual(ev.hits, [{ lane: 1, y: 1 }, { lane: 1, y: 3 }]);
  assert.deepEqual(ev.from, { lane: 1, y: 0 });
  assert.ok(f.meteors.has('1,1') && f.meteors.has('0,1') && f.meteors.has('2,3'));
  // Küçük lazer aynı işi tek tek yapar.
  assert.equal(simulate(f, [fire(), fire(), F(), F(), F(), F()]).outcome, 'win');
  assert.equal(simulate(f, [fire(), F(), F(), F(), F()]).reason, 'meteor');
  // Boş şeritte de çalışır; hiç uçmayan sürekli lazer durdurulur.
  assert.deepEqual(simulate(field(['...', '.S.']), [beam(), F(), F()]).events.find((e) => e.t === 'beam').hits, []);
  assert.equal(simulate(f, [forever(beam())]).reason, 'idle');
  assert.match(toPython([beam()]), /guclu_lazer\(\)/);
});
