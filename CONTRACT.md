# KodRobot — Mimari Sözleşme (blok sürümü)

Çocuklara kodlama mantığını öğreten, Box Island tarzı bir oyun. Yazı yok:
oyuncu ok bloklarını sürükleyip program alanına bırakır, Başlat'a basar ve
robot programı adım adım uygular. Derleme adımı yok; `index.html` doğrudan
açılabilmeli (file:// dahil), bu yüzden ES modülü **yok**.

## Modül kalıbı (tüm js dosyaları)

```js
(function (root) {
  const CodeGame = root.CodeGame = root.CodeGame || {};
  // ... CodeGame.X = ...
  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
```

Yükleme sırası: `js/world.js`, `js/blocks.js`, `js/levels.js`, `js/renderer.js`, `js/app.js`.

| Dosya | İçerik |
|---|---|
| `js/world.js` | Saf oyun mantığı, DOM yok (`CodeGame.World`) |
| `js/blocks.js` | Blok programını çalıştıran motor (`CodeGame.Blocks`) |
| `js/levels.js` | `CodeGame.LEVELS` |
| `js/renderer.js` | Canvas çizimi (`CodeGame.Renderer`) |
| `index.html`, `css/style.css`, `js/app.js` | Sürükle-bırak arayüzü |
| `tests/*.test.js` | `node --test` ile çalışır |

## Bloklar

| type | Görünüm | Ne yapar |
|---|---|---|
| `move` | ⬆ ileri ok | Bir kare ileri |
| `left` | ↶ | Sola dön |
| `right` | ↷ | Sağa dön |
| `pick` | 💎 | Elması topla |
| `loop` | 🔁 + sayı | İçindeki blokları `count` kez tekrarla (2–9) |

Program, blok dizisidir:

```js
[
  { type: 'move' },
  { type: 'loop', count: 3, body: [ { type: 'move' }, { type: 'right' } ] },
  { type: 'pick' }
]
```

Döngüler iç içe olabilir.

## `CodeGame.Blocks`

```js
Blocks.run(program, world, { maxSteps = 500 }) -> Generator
```
Her **eylemden sonra** `{ action: 'move'|'turnLeft'|'turnRight'|'pick', path }`
yield eder. `path`, çalışan bloğun programdaki yeridir: `[2]` en üst düzeyde
3. blok, `[1, 0]` 2. bloğun (döngü) gövdesindeki ilk blok. Arayüz bunu o anki
bloğu parlatmak için kullanır.

World hataları (duvara çarpma, elmas olmayan yerde topla)
`CodeGame.BlockError(message, path)` olarak sarılıp fırlatılır (`err.path`).

```js
Blocks.count(program) -> number   // toplam blok sayısı; döngü 1 sayılır + gövdesi
```

## `CodeGame.World`

Koordinatlar: `x` sütun, `y` satır, `y` aşağı doğru artar. Yönler `'N','E','S','W'`.

```js
const w = new CodeGame.World(level);
w.width, w.height, w.robot /* {x,y,dir} */, w.gems /* Set<"x,y"> */, w.totalGems, w.collected, w.crashed
w.cellAt(x, y)   // '#', '.', 'G'
w.move(); w.turnLeft(); w.turnRight(); w.pick()
w.atGoal(); w.hasGem(); w.isWon()
```

## `CodeGame.LEVELS`

```js
{
  id: 'b1', title: 'İlk Adım',
  description: 'Kısa, çocuk dostu görev (1-2 cümle)',
  map: [ '#####', '#S.G#', '#####' ],  // '#' su/duvar, '.' zemin, 'S' başlangıç, 'G' hedef, '*' elmas
  startDir: 'E',
  tools: ['move', 'left', 'right'],     // paletteki bloklar
  maxBlocks: 6,                          // program alanına konabilecek en fazla blok (Blocks.count)
  par: 3,                                // 3 yıldız için en fazla blok
  solution: [ ... ]                      // testlerde doğrulanır, Blocks.count(solution) <= par
}
```

## Yıldızlar

Kazanınca: blok sayısı ≤ `par` ise 3, ≤ `par + 2` ise 2, aksi hâlde 1.
İlerleme `localStorage['kodrobot.blocks.progress']` içinde `{ [levelId]: stars }`
(her erişim try/catch içinde). Bir bölüm, önceki bölüm geçilmişse açılır.
