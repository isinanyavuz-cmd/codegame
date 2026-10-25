const test = require('node:test');
const assert = require('node:assert');

require('../js/interpreter.js');
const CodeGame = require('../js/world.js');
const { Interpreter, CodeError, World } = CodeGame;

// Açık bir alan: 7x7 zemin, kenarlarda duvar.
const OPEN = {
  map: [
    '#########',
    '#.......#',
    '#.......#',
    '#.......#',
    '#...S...#',
    '#.......#',
    '#.......#',
    '#......G#',
    '#########',
  ],
  startDir: 'N',
};

// Sahte dünya: çağrıları kaydeder, sensör yanıtları ayarlanabilir.
function mockWorld(sensors) {
  const log = [];
  const s = Object.assign({ isPathAhead: true, isPathLeft: false, isPathRight: false, atGoal: false, hasGem: false }, sensors);
  const w = { log };
  for (const a of ['move', 'turnLeft', 'turnRight', 'pick']) w[a] = () => { log.push(a); };
  for (const k of Object.keys(s)) w[k] = () => (typeof s[k] === 'function' ? s[k](log) : s[k]);
  return w;
}

function runAll(source, world, opts) {
  const ast = Interpreter.parse(source);
  return [...Interpreter.run(ast, world, opts)];
}

function actions(source, sensors, opts) {
  const w = mockWorld(sensors);
  runAll(source, w, opts);
  return w.log;
}

function syntaxErr(source) {
  try {
    Interpreter.parse(source);
  } catch (e) {
    assert.ok(e instanceof CodeError, 'CodeError bekleniyordu: ' + e);
    assert.strictEqual(e.kind, 'syntax');
    return e;
  }
  assert.fail('sözdizimi hatası bekleniyordu');
}

function runtimeErr(source, world, opts) {
  try {
    runAll(source, world, opts);
  } catch (e) {
    assert.ok(e instanceof CodeError, 'CodeError bekleniyordu: ' + e);
    assert.strictEqual(e.kind, 'runtime');
    return e;
  }
  assert.fail('çalışma zamanı hatası bekleniyordu');
}

// ---------------------------------------------------------------------------

test('CodeError yapısı', () => {
  const e = new CodeError('x', 3, 'syntax');
  assert.ok(e instanceof Error);
  assert.strictEqual(e.message, 'x');
  assert.strictEqual(e.line, 3);
  assert.strictEqual(e.kind, 'syntax');
});

test('eylemler: İngilizce ve Türkçe adlar', () => {
  assert.deepStrictEqual(
    actions('move() turnLeft() turnRight() pick()'),
    ['move', 'turnLeft', 'turnRight', 'pick']);
  assert.deepStrictEqual(
    actions('ilerle() solaDon() sagaDon() topla()'),
    ['move', 'turnLeft', 'turnRight', 'pick']);
});

test('generator her eylemden sonra bir öğe yield eder (satır numarasıyla)', () => {
  const w = mockWorld();
  const ast = Interpreter.parse('ilerle()\n\nsolaDon();\nif onumBos() { sagaDon() }\ntopla()');
  const gen = Interpreter.run(ast, w);
  assert.deepStrictEqual(gen.next().value, { action: 'move', line: 1 });
  assert.deepStrictEqual(w.log, ['move']); // eylem yield'den önce yapılmış
  assert.deepStrictEqual(gen.next().value, { action: 'turnLeft', line: 3 });
  assert.deepStrictEqual(gen.next().value, { action: 'turnRight', line: 4 });
  assert.deepStrictEqual(gen.next().value, { action: 'pick', line: 5 });
  assert.strictEqual(gen.next().done, true);
});

test('sensörler yield etmez', () => {
  const items = runAll('if onumBos() && !hedefte() { } while elmasVar() { }', mockWorld());
  assert.deepStrictEqual(items, []);
});

test('tüm sensörler: İngilizce ve Türkçe adlar', () => {
  const pairs = [
    ['pathAhead', 'onumBos', 'isPathAhead'],
    ['pathLeft', 'solumBos', 'isPathLeft'],
    ['pathRight', 'sagimBos', 'isPathRight'],
    ['atGoal', 'hedefte', 'atGoal'],
    ['onGem', 'elmasVar', 'hasGem'],
  ];
  for (const [en, tr, method] of pairs) {
    for (const name of [en, tr]) {
      const src = `if ${name}() { move() } else { turnLeft() }`;
      assert.deepStrictEqual(actions(src, { [method]: true, isPathAhead: method === 'isPathAhead' }), ['move'], name);
      assert.deepStrictEqual(actions(src, { [method]: false, isPathAhead: false }), ['turnLeft'], name);
    }
  }
});

test('repeat / tekrarla', () => {
  assert.deepStrictEqual(actions('repeat 3 { move() }'), ['move', 'move', 'move']);
  assert.deepStrictEqual(actions('tekrarla 2 { ilerle(); solaDon(); }'), ['move', 'turnLeft', 'move', 'turnLeft']);
  assert.deepStrictEqual(actions('repeat 0 { move() }'), []);
  assert.deepStrictEqual(actions('tekrarla (2) { ilerle() }'), ['move', 'move']);
});

test('iç içe repeat', () => {
  const log = actions('repeat 2 {\n  repeat 3 { move() }\n  turnRight()\n}');
  assert.deepStrictEqual(log, ['move', 'move', 'move', 'turnRight', 'move', 'move', 'move', 'turnRight']);
});

test('while / iken', () => {
  let n = 0;
  const atGoal = () => n >= 3;
  const sensors = { atGoal: (log) => { n = log.length; return atGoal(); } };
  assert.deepStrictEqual(actions('while !atGoal() { move() }', sensors), ['move', 'move', 'move']);
  n = 0;
  assert.deepStrictEqual(actions('iken (!hedefte()) { ilerle() }', sensors), ['move', 'move', 'move']);
});

test('if / eger, else / degilse, else if', () => {
  assert.deepStrictEqual(actions('if pathAhead() { move() }'), ['move']);
  assert.deepStrictEqual(actions('if pathAhead() { move() }', { isPathAhead: false }), []);
  assert.deepStrictEqual(actions('eger onumBos() { ilerle() } degilse { solaDon() }', { isPathAhead: false }), ['turnLeft']);

  const src = `
    eger onumBos() {
      ilerle()
    } degilse eger solumBos() {
      solaDon()
    } else if (sagimBos()) {
      sagaDon()
    } else {
      topla()
    }`;
  assert.deepStrictEqual(actions(src, { isPathAhead: true }), ['move']);
  assert.deepStrictEqual(actions(src, { isPathAhead: false, isPathLeft: true }), ['turnLeft']);
  assert.deepStrictEqual(actions(src, { isPathAhead: false, isPathRight: true }), ['turnRight']);
  assert.deepStrictEqual(actions(src, { isPathAhead: false }), ['pick']);
});

test('iç içe while/if/repeat gerçek dünyada', () => {
  const w = new World(OPEN);
  // Kuzeydeki duvara kadar git, dön, tekrarla
  runAll(`
    tekrarla 2 {
      iken onumBos() {
        eger elmasVar() { topla() }
        ilerle()
      }
      sagaDon()
    }`, w);
  assert.deepStrictEqual(w.robot, { x: 7, y: 1, dir: 'S' });
});

test('mantıksal operatörler: &&, ||, !, parantezler ve öncelik', () => {
  const T = { isPathAhead: true, isPathLeft: true, isPathRight: true };
  const cases = [
    ['pathAhead() && pathLeft()', { isPathAhead: true, isPathLeft: true }, true],
    ['pathAhead() && pathLeft()', { isPathAhead: true, isPathLeft: false }, false],
    ['pathAhead() || pathLeft()', { isPathAhead: false, isPathLeft: true }, true],
    ['pathAhead() || pathLeft()', { isPathAhead: false, isPathLeft: false }, false],
    ['!pathAhead()', { isPathAhead: false }, true],
    ['!!pathAhead()', { isPathAhead: false }, false],
    // && || den önce gelir: a || (b && c)
    ['pathAhead() || pathLeft() && pathRight()', { isPathAhead: true, isPathLeft: false, isPathRight: false }, true],
    ['(pathAhead() || pathLeft()) && pathRight()', { isPathAhead: true, isPathLeft: false, isPathRight: false }, false],
    ['!(pathAhead() && pathLeft())', T, false],
    ['!(pathAhead() && pathLeft())', { isPathAhead: true, isPathLeft: false }, true],
    ['((pathAhead()))', T, true],
  ];
  for (const [cond, sensors, expected] of cases) {
    const log = actions(`if ${cond} { pick() } else { turnLeft() }`, sensors);
    assert.deepStrictEqual(log, [expected ? 'pick' : 'turnLeft'], cond);
  }
});

test('kısa devre değerlendirme', () => {
  let leftCalled = false;
  actions('if pathAhead() || pathLeft() { }', { isPathAhead: true, isPathLeft: () => { leftCalled = true; return true; } });
  assert.strictEqual(leftCalled, false);
});

test('noktalı virgül isteğe bağlı, aynı satırda birden çok komut', () => {
  assert.deepStrictEqual(actions('move();move();;turnLeft()'), ['move', 'move', 'turnLeft']);
  assert.deepStrictEqual(actions('move() move()\nturnLeft();'), ['move', 'move', 'turnLeft']);
});

test('yorumlar', () => {
  const src = '// başlangıç\nmove() // ilerle\n// turnLeft()\nrepeat 2 { // döngü\n  move()\n}\n// son';
  assert.deepStrictEqual(actions(src), ['move', 'move', 'move']);
  assert.deepStrictEqual(actions(''), []);
  assert.deepStrictEqual(actions('// sadece yorum'), []);
});

test('Türkçe karakterli yazımlar da kabul edilir', () => {
  assert.deepStrictEqual(actions('eğer önümBoş() { solaDön() } değilse { sağaDön() }'), ['turnLeft']);
});

test('kullanıcı fonksiyonları: function / fonksiyon, çağrıdan sonra tanım', () => {
  const src = `
    zigzag()
    zigzag()
    function zigzag() {
      move()
      turnLeft()
    }`;
  assert.deepStrictEqual(actions(src), ['move', 'turnLeft', 'move', 'turnLeft']);

  const src2 = 'fonksiyon ikiAdim() { ilerle() ilerle() }\nfonksiyon kare() { tekrarla 2 { ikiAdim() sagaDon() } }\nkare()';
  assert.deepStrictEqual(actions(src2), ['move', 'move', 'turnRight', 'move', 'move', 'turnRight']);
});

test('fonksiyon satır numaraları: yield edilen satır, eylemin bulunduğu satırdır', () => {
  const items = runAll('f()\nfunction f() {\n  move()\n}', mockWorld());
  assert.deepStrictEqual(items, [{ action: 'move', line: 3 }]);
});

test('özyineleme', () => {
  const w = new World(OPEN);
  runAll(`
    function git() {
      if onumBos() {
        ilerle()
        git()
      }
    }
    git()`, w);
  assert.deepStrictEqual(w.robot, { x: 4, y: 1, dir: 'N' });
});

test('özyineleme derinlik sınırı → runtime hatası', () => {
  const e = runtimeErr('function f() {\n  f()\n}\nf()', mockWorld(), { maxSteps: 100000 });
  assert.match(e.message, /derin/);
  assert.strictEqual(e.line, 2);
});

test('maxSteps: sonsuz döngü hatası', () => {
  const e = runtimeErr('move()\nwhile pathAhead() {\n  turnLeft()\n}', mockWorld());
  assert.strictEqual(e.message, 'Çok fazla adım — sonsuz döngü olabilir mi?');
  assert.ok(e.line === 2 || e.line === 3);

  const e2 = runtimeErr('while !atGoal() { }', mockWorld(), { maxSteps: 50 });
  assert.strictEqual(e2.line, 1);

  // Eylemsiz özyineleme de adım sınırına takılır
  const e3 = runtimeErr('function f() { f() }\nf()', mockWorld(), { maxSteps: 50 });
  assert.match(e3.message, /Çok fazla adım/);
});

test('maxSteps: sınırın altında kalan program sorunsuz çalışır', () => {
  assert.strictEqual(actions('repeat 10 { move() }', {}, { maxSteps: 11 }).length, 10);
  assert.throws(() => actions('repeat 10 { move() }', {}, { maxSteps: 10 }), /Çok fazla adım/);
});

test('duvara çarpma runtime CodeError olarak, doğru satırla sarılır', () => {
  const w = new World({ map: ['#####', '#S.G#', '#####'], startDir: 'E' });
  const ast = Interpreter.parse('ilerle()\nilerle()\n\nilerle()');
  const gen = Interpreter.run(ast, w);
  assert.deepStrictEqual(gen.next().value, { action: 'move', line: 1 });
  assert.deepStrictEqual(gen.next().value, { action: 'move', line: 2 });
  assert.throws(() => gen.next(), (e) => {
    assert.ok(e instanceof CodeError);
    assert.strictEqual(e.kind, 'runtime');
    assert.strictEqual(e.line, 4);
    assert.strictEqual(e.message, 'Robot duvara çarptı!');
    return true;
  });
  assert.strictEqual(w.crashed, true);
});

test('elmas yokken toplama runtime CodeError', () => {
  const w = new World({ map: ['#SG#'], startDir: 'E' });
  const e = runtimeErr('\ntopla()', w);
  assert.strictEqual(e.line, 2);
  assert.strictEqual(e.message, 'Burada toplanacak elmas yok!');
});

test('fonksiyon içindeki çarpma, fonksiyon gövdesindeki satırla', () => {
  const w = new World({ map: ['#SG#'], startDir: 'E' });
  const e = runtimeErr('f()\nfunction f() {\n  repeat 5 {\n    move()\n  }\n}', w);
  assert.strictEqual(e.line, 4);
});

// --- Sözdizimi hataları -------------------------------------------------------

test("sözdizimi: '}' eksik", () => {
  const e = syntaxErr('move()\nrepeat 3 {\n  move()\n');
  assert.strictEqual(e.line, 2);
  assert.match(e.message, /^2\. satır: '\}' eksik görünüyor/);
  const e2 = syntaxErr('if onumBos() {\n  move()\n  repeat 2 {\n    move()\n}');
  assert.strictEqual(e2.line, 1);
});

test("sözdizimi: '{' bekleniyordu", () => {
  const e = syntaxErr('move()\n\nrepeat 3 move()');
  assert.strictEqual(e.line, 3);
  assert.strictEqual(e.message, "3. satır: '{' bekleniyordu");
});

test('sözdizimi: fazladan }', () => {
  const e = syntaxErr('move()\n}\n');
  assert.strictEqual(e.line, 2);
  assert.match(e.message, /fazladan/);
});

test('sözdizimi: bilinmeyen komut ve öneri', () => {
  const e = syntaxErr('move()\nilerl()');
  assert.strictEqual(e.line, 2);
  assert.strictEqual(e.message, "2. satır: 'ilerl' diye bir komut yok. 'ilerle' mi demek istedin?");

  const e2 = syntaxErr('turnleft()');
  assert.match(e2.message, /'turnLeft' mi demek istedin\?/);

  const e3 = syntaxErr('zigzak()\nfunction zigzag() { move() }');
  assert.match(e3.message, /'zigzag' mi demek istedin\?/);

  const e4 = syntaxErr('\n\nqwertyuiop()');
  assert.strictEqual(e4.line, 3);
  assert.strictEqual(e4.message, "3. satır: 'qwertyuiop' diye bir komut yok.");
});

test('sözdizimi: koşuldaki bilinmeyen ad', () => {
  const e = syntaxErr('move()\nwhile !hedeftee() { move() }');
  assert.strictEqual(e.line, 2);
  assert.match(e.message, /'hedefte' mi demek istedin\?/);
});

test('sözdizimi: koşulda eylem veya kullanıcı fonksiyonu kullanılamaz', () => {
  assert.strictEqual(syntaxErr('if move() { }').line, 1);
  const e = syntaxErr('function f() { move() }\n\nif f() { move() }');
  assert.strictEqual(e.line, 3);
});

test('sözdizimi: sensör tek başına deyim olamaz', () => {
  const e = syntaxErr('move()\nonumBos()');
  assert.strictEqual(e.line, 2);
});

test('sözdizimi: parantezsiz çağrı, eksik ) ve diğerleri', () => {
  assert.strictEqual(syntaxErr('move()\nmove').line, 2);
  assert.strictEqual(syntaxErr('move(\n').line, 2);
  assert.strictEqual(syntaxErr('if (onumBos() { move() }').line, 1);
  assert.strictEqual(syntaxErr('repeat { move() }').line, 1);
  assert.strictEqual(syntaxErr('while { move() }').line, 1);
  assert.strictEqual(syntaxErr('\nelse { move() }').line, 2);
  assert.strictEqual(syntaxErr('if onumBos() & solumBos() { }').line, 1);
  assert.strictEqual(syntaxErr('move() @').line, 1);
  assert.strictEqual(syntaxErr('\n\n3').line, 3);
  assert.strictEqual(syntaxErr('if onumBos() && { }').line, 1);
  assert.strictEqual(syntaxErr('function () { }').line, 1);
  assert.strictEqual(syntaxErr('function ilerle() { }').line, 1);
  assert.strictEqual(syntaxErr('function f() { }\nfunction f() { }').line, 2);
  assert.strictEqual(syntaxErr('repeat 3 {\n  move()\n} else { }').line, 3);
});

test('anahtar kelimeler komut adı olarak kullanılamaz', () => {
  syntaxErr('function repeat() { }');
  syntaxErr('tekrarla()');
});

test('AST düğümlerinde satır numarası var', () => {
  const ast = Interpreter.parse('move()\nrepeat 2 {\n  if !onumBos() || solumBos() {\n    solaDon()\n  }\n}\nfunction f() { move() }');
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (node.type) assert.strictEqual(typeof node.line, 'number', node.type + ' düğümünde line yok');
    for (const k of Object.keys(node)) if (k !== 'functions') visit(node[k]);
  };
  visit(ast);
  assert.strictEqual(ast.body[1].line, 2);
  assert.strictEqual(ast.body[1].body[0].line, 3);
  assert.strictEqual(ast.body[1].body[0].then[0].line, 4);
});

test('aynı AST birden çok kez çalıştırılabilir', () => {
  const ast = Interpreter.parse('repeat 2 { move() }');
  for (let i = 0; i < 2; i++) {
    const w = mockWorld();
    [...Interpreter.run(ast, w)];
    assert.deepStrictEqual(w.log, ['move', 'move']);
  }
});

// --- countLines ---------------------------------------------------------------

test('countLines: boş, yorum ve tek başına } satırları sayılmaz', () => {
  assert.strictEqual(Interpreter.countLines(''), 0);
  assert.strictEqual(Interpreter.countLines('move()'), 1);
  assert.strictEqual(Interpreter.countLines('move()\n\n   \n// yorum\n  // girintili yorum\nmove() // sonda yorum'), 2);
  assert.strictEqual(Interpreter.countLines('repeat 3 {\n  move()\n}\n'), 2);
  assert.strictEqual(Interpreter.countLines('if a() {\n  move()\n} else {\n  turnLeft()\n  }  // kapanış\n}}'), 4);
  assert.strictEqual(Interpreter.countLines('repeat 3 { move() }'), 1);
  assert.strictEqual(Interpreter.countLines('move()\r\nmove()\r\n}\r\n'), 2);
});
