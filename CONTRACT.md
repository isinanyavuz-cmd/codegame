# KodRobot — Mimari Sözleşme

Tarayıcıda çalışan bir kodlama oyunu: oyuncu küçük bir dille robotu ızgara
üzerinde hedefe götürür, elmasları toplar. Derleme adımı yok; `index.html`
doğrudan açılabilmeli (file:// dahil), bu yüzden ES modülü **yok**.

## Modül kalıbı (tüm js dosyaları)

```js
(function (root) {
  const CodeGame = root.CodeGame = root.CodeGame || {};
  // ... CodeGame.X = ...
  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
```

Yükleme sırası: `js/interpreter.js`, `js/world.js`, `js/levels.js`, `js/renderer.js`, `js/app.js`.

## Dosyalar ve sahipleri

| Dosya | İçerik |
|---|---|
| `js/interpreter.js` | Tokenizer, parser, yorumlayıcı (`CodeGame.Interpreter`, `CodeGame.CodeError`) |
| `js/world.js` | Saf oyun mantığı, DOM yok (`CodeGame.World`) |
| `tests/*.test.js` | `node --test` ile çalışır, bağımlılık yok |
| `js/levels.js` | `CodeGame.LEVELS` |
| `index.html`, `css/style.css`, `js/renderer.js`, `js/app.js` | Arayüz |

## Dil

Yorum: `// satır sonuna kadar`. Noktalı virgül isteğe bağlı.

```
program   := stmt*
stmt      := call ';'?
           | REPEAT NUMBER block
           | WHILE cond block
           | IF cond block (ELSE (block | ifStmt))?
           | FUNCTION IDENT '(' ')' block
block     := '{' stmt* '}'
cond      := orExpr ; orExpr := andExpr ('||' andExpr)* ; andExpr := unary ('&&' unary)*
unary     := '!' unary | '(' cond ')' | call
call      := IDENT '(' ')'
```

Koşulları parantez içinde yazmak da serbesttir: `while (!atGoal()) { }`.

Anahtar kelimeler (İngilizce / Türkçe eşdeğer, ikisi de geçerli):
`repeat`/`tekrarla`, `while`/`iken`, `if`/`eger`, `else`/`degilse`, `function`/`fonksiyon`.

Eylemler (world metodu ← dil adları):
- `move` ← `move()`, `ilerle()`
- `turnLeft` ← `turnLeft()`, `solaDon()`
- `turnRight` ← `turnRight()`, `sagaDon()`
- `pick` ← `pick()`, `topla()`

Sensörler (boolean döner):
- `isPathAhead` ← `pathAhead()`, `onumBos()`
- `isPathLeft` ← `pathLeft()`, `solumBos()`
- `isPathRight` ← `pathRight()`, `sagimBos()`
- `atGoal` ← `atGoal()`, `hedefte()`
- `hasGem` ← `onGem()`, `elmasVar()`

Kullanıcı fonksiyonları: `function zigzag() { ... }` sonra `zigzag()`. Tanım
programın herhangi bir yerinde olabilir (çağrıdan sonra bile). Özyineleme
serbest, adım sınırıyla korunur. Eylem/sensör yerine koşulda kullanıcı
fonksiyonu çağrılırsa hata.

## `CodeGame.CodeError`

```js
class CodeError extends Error { constructor(message, line, kind) } // kind: 'syntax' | 'runtime'
```
Mesajlar Türkçe ve oyuncu dostu olmalı, ör. `3. satır: '{' bekleniyordu`.

## `CodeGame.Interpreter`

```js
Interpreter.parse(source) -> ast        // hata: CodeError(kind 'syntax')
Interpreter.run(ast, world, { maxSteps = 2000 }) -> Generator
```
`run` her **eylemden sonra** `{ action: 'move'|'turnLeft'|'turnRight'|'pick', line }`
yield eder. Yalnızca sensör değerlendirmesi yield etmez. Her deyim ve koşul
değerlendirmesi bir adım sayar; `maxSteps` aşılırsa
`CodeError('Çok fazla adım — sonsuz döngü olabilir mi?', line, 'runtime')`.
World metodlarının fırlattığı hatalar `CodeError(kind 'runtime')`'a,
o satırla sarılır. Bilinmeyen fonksiyon adı da runtime hatası (veya parse
sonrası statik kontrol — tercih: parse aşamasında `syntax` olarak yakala).

## `CodeGame.World`

Koordinatlar: `x` sütun, `y` satır, `y` aşağı doğru artar. Yönler `'N','E','S','W'`; N = y-1.

```js
const w = new CodeGame.World(level);
w.width, w.height
w.robot      // { x, y, dir }
w.gems       // Set<"x,y"> — kalan elmaslar
w.totalGems, w.collected
w.crashed    // boolean
w.cellAt(x, y)   // '#' (harita dışı dahil), '.', 'G'
w.move()         // önü duvarsa crashed=true ve Error('Robot duvara çarptı!') fırlatır
w.turnLeft(); w.turnRight()
w.pick()         // elmas yoksa Error('Burada toplanacak elmas yok!')
w.isPathAhead(); w.isPathLeft(); w.isPathRight(); w.atGoal(); w.hasGem()
w.isWon()        // robot G üzerinde && tüm elmaslar toplandı
```

## `CodeGame.LEVELS`

```js
{
  id: 'l1', title: 'İlk Adım',
  description: 'Türkçe görev metni (kısa)',
  hint: 'Türkçe ipucu',
  map: [ '#####', '#S.G#', '#####' ],  // '#' duvar, '.' zemin, 'S' başlangıç (zemin), 'G' hedef, '*' elmas (zemin)
  startDir: 'E',
  starterCode: '// buraya kodunu yaz\n',
  par: 3,              // 3 yıldız için en fazla "kod satırı" (boş/yorum satırları ve tek başına '}' sayılmaz)
  newConcepts: ['move'],  // bu bölümde tanıtılan komutlar (referans panelinde vurgulanır)
  solution: '...'      // testlerde doğrulanan çözüm, satır sayısı <= par
}
```

## Yıldızlar

Kazanınca: 1 yıldız temel, satır sayısı ≤ `par` ise 3, ≤ `par + 2` ise 2.
İlerleme `localStorage['kodrobot.progress']` içinde `{ [levelId]: stars }`
(her erişim try/catch içinde). Bir bölüm, önceki bölüm geçilmişse açılır.
