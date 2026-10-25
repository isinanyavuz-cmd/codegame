const test = require('node:test');
const assert = require('node:assert');

const CodeGame = require('../js/ryu/code.js');
const { Code, CodeError } = CodeGame.Ryu;

const strip = (list) => list.map((b) => (b.type === 'loop'
  ? { type: 'loop', count: b.count, body: strip(b.body) }
  : { type: b.type }));

test('format: komutlar, döngü ve kombo fonksiyonu', () => {
  const text = Code.format(
    [{ type: 'forward' }, { type: 'loop', count: 3, body: [{ type: 'jump' }, { type: 'combo' }] }],
    [{ type: 'punch' }, { type: 'hadoken' }]
  );
  assert.strictEqual(text, [
    'fonksiyon kombo() {',
    '  yumruk()',
    '  hadoken()',
    '}',
    '',
    'ileri()',
    'tekrarla(3) {',
    '  zıpla()',
    '  kombo()',
    '}',
  ].join('\n'));
});

test('parse, format çıktısını aynı programa çevirir', () => {
  const program = [
    { type: 'forward' },
    { type: 'loop', count: 4, body: [{ type: 'tatsumaki' }, { type: 'loop', count: 2, body: [{ type: 'back' }] }] },
    { type: 'combo' },
  ];
  const combo = [{ type: 'shoryuken' }, { type: 'jump' }];
  const r = Code.parse(Code.format(program, combo));
  assert.deepStrictEqual(strip(r.program), program);
  assert.deepStrictEqual(strip(r.combo), combo);
});

test('satır numaraları bloklara yazılır', () => {
  const r = Code.parse('ileri()\n\ntekrarla(2) {\n  yumruk()\n}');
  assert.strictEqual(r.program[0].line, 1);
  assert.strictEqual(r.program[1].line, 3);
  assert.strictEqual(r.program[1].body[0].line, 4);
  assert.strictEqual(r.combo, null);
});

test('esnek yazım: Türkçe harfsiz, büyük harf, noktalı virgül, yorum', () => {
  const r = Code.parse('ZIPLA(); zipla()\n// yorum satırı\nİleri() // sonda yorum\ntatsumaki_senpukyaku()');
  assert.deepStrictEqual(strip(r.program).map((b) => b.type), ['jump', 'jump', 'forward', 'tatsumaki']);
});

function err(text, opts) {
  try {
    Code.parse(text, opts);
  } catch (e) {
    assert.ok(e instanceof CodeError, 'CodeError bekleniyordu: ' + e);
    return e;
  }
  assert.fail('hata bekleniyordu');
}

test('yanlış yazılan komut için öneri', () => {
  const e = err('ileri()\nhadokn()');
  assert.strictEqual(e.line, 2);
  assert.match(e.message, /hadoken\(\)' mı/);
});

test('parantez unutulursa', () => {
  assert.match(err('ileri').message, /ileri\(\)/);
  assert.match(err('ileri(3)').message, /içi boş/);
});

test('tekrarla hataları', () => {
  assert.match(err('tekrarla { ileri() }').message, /parantez/);
  assert.match(err('tekrarla(12) { ileri() }').message, /2 ile 9/);
  assert.match(err('tekrarla(3) ileri()').message, /'\{'/);
  const open = err('tekrarla(3) {\n  ileri()\n');
  assert.strictEqual(open.line, 1);
  assert.match(open.message, /kapanmadı/);
  assert.match(err('ileri() }').message, /Fazladan/);
});

test('bölümde olmayan bloklar reddedilir', () => {
  const tools = ['forward', 'jump'];
  assert.match(err('hadoken()', { tools }).message, /henüz yok/);
  assert.match(err('tekrarla(2) { ileri() }', { tools }).message, /tekrarla kullanılamaz/);
  assert.match(err('fonksiyon kombo() { ileri() }', { tools }).message, /kombo/);
  assert.doesNotThrow(() => Code.parse('ileri()\nzıpla()', { tools }));
});

test('kombo kuralları', () => {
  const tools = ['forward', 'punch', 'combo', 'loop'];
  assert.match(err('kombo()', { tools }).message, /önce fonksiyon/);
  assert.match(err('fonksiyon kombo() { kombo() }', { tools }).message, /kendini/);
  assert.match(err('fonksiyon kombo() { ileri() }\nfonksiyon kombo() { ileri() }', { tools }).message, /iki kez/);
  assert.match(err('tekrarla(2) { fonksiyon kombo() { ileri() } }', { tools }).message, /içinde/);
  assert.match(err('fonksiyon vur() { ileri() }', { tools }).message, /adı kombo/);
  const r = Code.parse('kombo()\nfonksiyon kombo() {\n yumruk()\n}', { tools });
  assert.strictEqual(r.combo.length, 1);
});

test('anlaşılmayan işaret', () => {
  const e = err('ileri()\n@');
  assert.strictEqual(e.line, 2);
});
