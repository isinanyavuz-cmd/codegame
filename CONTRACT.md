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

Oklar **ekrana göredir**: ok hangi yönü gösteriyorsa robot o yöne döner ve
bir kare ilerler. Robotun baktığı yön yalnızca görüntüdür, dönme bloğu yoktur.

| type | Görünüm | Ne yapar |
|---|---|---|
| `up` / `down` / `left` / `right` | ⬆ ⬇ ⬅ ➡ | O yöne bir kare git |
| `pick` | 💎 | Elması topla |
| `loop` | 🔁 + sayı | İçindeki blokları `count` kez tekrarla (2–9) |

Program, blok dizisidir:

```js
[
  { type: 'right' },
  { type: 'loop', count: 3, body: [ { type: 'right' }, { type: 'down' } ] },
  { type: 'pick' }
]
```

Döngüler iç içe olabilir.

## `CodeGame.Blocks`

```js
Blocks.run(program, world, { maxSteps = 500 }) -> Generator
```
Her **eylemden sonra** `{ action: 'move'|'pick', path }` yield eder. `path`,
çalışan bloğun programdaki yeridir: `[2]` en üst düzeyde 3. blok, `[1, 0]`
2. bloğun (döngü) gövdesindeki ilk blok. Arayüz bunu o anki bloğu parlatmak
için kullanır.

World hataları (suya düşme, elmas olmayan yerde topla)
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
w.go(dir)   // robotu 'N'|'E'|'S'|'W' yönüne çevirip bir kare ilerletir; '#' ise crashed=true ve hata
w.pick()
w.atGoal(); w.hasGem(); w.isWon()
```

## `CodeGame.LEVELS`

```js
{
  id: 'b1', title: 'İlk Adım',
  description: 'Kısa, çocuk dostu görev (1-2 cümle)',
  map: [ '#####', '#S.G#', '#####' ],  // '#' su/duvar, '.' zemin, 'S' başlangıç, 'G' hedef, '*' elmas
  startDir: 'E',
  tools: ['up', 'down', 'left', 'right', 'loop'],  // paletteki bloklar
  maxBlocks: 6,                          // program alanına konabilecek en fazla blok (Blocks.count);
                                         // döngüsüz çözüm sığmayacak kadar dar tutulur
  par: 3,                                // 3 yıldız için en fazla blok
  solution: [ ... ]                      // testlerde doğrulanır, Blocks.count(solution) <= par
}
```

## Yıldızlar

Kazanınca: blok sayısı ≤ `par` ise 3, ≤ `par + 2` ise 2, aksi hâlde 1.
İlerleme `localStorage['kodrobot.v3.progress']` içinde `{ [levelId]: stars }`
(her erişim try/catch içinde). Bir bölüm, önceki bölüm geçilmişse açılır.

---

# Ryu'nun Kod Macerası — Mimari Sözleşme

`ryu.html`, KodRobot ile aynı kalıpta ikinci bir oyundur: yandan görünüşlü,
Mario tarzı bir platform dünyasında Ryu programı adım adım uygular. Aynı modül
kalıbı kullanılır; her şey `CodeGame.Ryu` altındadır.

Yükleme sırası: `js/ryu/world.js`, `js/ryu/blocks.js`, `js/ryu/code.js`,
`js/ryu/levels.js`, `js/ryu/renderer.js`, `js/ryu/app.js`.

| Dosya | İçerik |
|---|---|
| `js/ryu/world.js` | Saf oyun mantığı, DOM yok (`Ryu.World`, `Ryu.MOVES`, `Ryu.RULES`) |
| `js/ryu/blocks.js` | Blok programını çalıştıran motor (`Ryu.Blocks`, `Ryu.BlockError`) |
| `js/ryu/code.js` | Metin ⇄ blok çevirisi (`Ryu.Code`, `Ryu.CodeError`) |
| `js/ryu/levels.js` | `Ryu.LEVELS` |
| `js/ryu/renderer.js` | Canvas çizimi ve olay oynatma (`Ryu.Renderer`) |
| `ryu.html`, `css/ryu.css`, `js/ryu/app.js` | Sürükle-bırak, kod düzenleyici, oyun akışı |
| `tests/ryu-*.test.js` | `node --test` ile çalışır |

## Bloklar

| type | Kodda | Ne yapar |
|---|---|---|
| `forward` / `back` | `ileri()` / `geri()` | Bir kare yürür; önü kapalıysa program durur (`blocked`) |
| `jump` | `zıpla()` | 2 yukarı, 2 ileri, sonra düşer. Tavana çarpınca soru kutusunu açar; düşmanın üstüne düşerse 1 vurur (ezme) |
| `punch` | `yumruk()` | Önündeki kareye vurur: kutu kırılır, düşman 1 can kaybeder |
| `hadoken` | `hadoken()` | Ateş topu en fazla 12 kare gider; ilk düşmana vurur ya da ilk kutuyu kırar, duvarda söner |
| `shoryuken` | `shoryuken()` | 3 yukarı, 1 ileri, sonra düşer; yolundaki düşmana vurur, kutuyu kırıp geçer, soru kutusunu açar |
| `tatsumaki` | `tatsumaki()` | Aynı yükseklikte 3 kare ileri döner (düşmeden); yoldaki düşmanlara vurur, kutuları kırar |
| `loop` | `tekrarla(n) { … }` | Gövdeyi `count` kez (2–9) tekrarlar |
| `combo` | `kombo()` | Kombo serisini çalıştırır; seri `fonksiyon kombo() { … }` ile, en fazla 4 blok, kendini çağıramaz |

Program iki dizidir: ana program ve kombo serisi.

```js
program = [ { type: 'combo' }, { type: 'loop', count: 2, body: [ { type: 'jump' } ] } ]
combo   = [ { type: 'punch' }, { type: 'hadoken' } ]
```

## `CodeGame.Ryu.World`

Koordinatlar: `x` sütun, `y` satır, `y` aşağı doğru artar. Ryu tek hücrede durur
ve hep sağa bakar. Harita kenarları duvardır; alt kenarın altı boşluktur.

```js
const w = new Ryu.World(level);
w.width, w.height, w.ryu /* {x,y} */, w.flag /* {x,y} */
w.coins /* Set<"x,y"> */, w.totalCoins, w.collected, w.coinsLeft()
w.enemies /* [{id,type,x,y,hp,maxHp,flying,spiky}] */, w.enemyAt(x,y), w.enemiesLeft()
w.combo, w.maxCombo, w.needCombo
w.state   // 'play' | 'flag' | 'dead' | 'blocked'
w.reason  // 'fall' | 'spike' | 'enemy' | 'spiky' | 'wall'
w.cellAt(x, y)   // '.', '#', '=', 'B', '?', 'u' (açılmış soru kutusu), '^'
w.act(type) -> event
w.isWon()        // bayrağa değdi, altın kalmadı, maxCombo >= needCombo
```

Bayrak direği `F` hücresinden 4 hücre yukarı uzanır; herhangi bir kısmına değmek
oyunu bitirir (`state = 'flag'`). Bir hareket düşmana vurduysa `combo` vuruş
sayısı kadar artar, vurmadıysa sıfırlanır.

`act()` şu olayı döndürür (çizici bunu oynatır):

```js
{
  type: 'jump', from: { x, y },
  steps: [ { x, y, kind } ],      // kind: 'walk' | 'jump' | 'rise' | 'spin' | 'fall'
  fx: [ { at, kind, ... } ],      // at: etki olduğunda tamamlanmış adım sayısı
  result: 'ok' | 'flag' | 'dead' | 'blocked', reason, hits, combo
}
```

`fx.kind`: `coin`, `qcoin` (soru kutusundan altın), `bump`, `break`,
`hit` (`enemy`, `hp`, `ko`, `by`), `fireball` (`toX`, `target`), `punch`
(`target`), `hurt`, `wall`, `flag`.

## `CodeGame.Ryu.Blocks`

```js
Blocks.run(program, world, { combo, maxSteps = 400 }) -> Generator
```
Her hareketten sonra `{ action, path, calls, event }` verir ve Ryu bayrağa
varınca, düşünce ya da takılınca durur. `path`, çalışan bloğun yeridir; kombo
serisindeki bloklar `'k'` ile başlar (`['k', 1]`). `calls`, o an çalışan kombo
bloğunun ana programdaki yeridir (`[[0, 0]]`). Bilinmeyen blok, adım sınırı ve
kombo hataları `Ryu.BlockError(message, path)` olarak fırlatılır.

```js
Blocks.count(program)      // döngü 1 sayılır + gövdesi
Blocks.usesCombo(program)
```

## `CodeGame.Ryu.Code`

```js
Code.format(program, combo?) -> string
Code.parse(text, { tools? }) -> { program, combo }   // bloklarda `line` (1'den başlar)
```

Türkçe harfsiz yazım (`zipla`), büyük harf, `;` ve `//` yorumları kabul edilir.
Hatalar `Ryu.CodeError` olarak fırlatılır (`err.line`, `err.plain`); yanlış
yazılan komutlara en yakın komut önerilir. `tools` verilirse bölümde olmayan
bloklar reddedilir.

## `CodeGame.Ryu.LEVELS`

```js
{
  id: 'r1', title: 'İlk Adım',
  description: 'Kısa görev (1-2 cümle)',
  theme: 'day',              // 'day' | 'sunset' | 'night' | 'cave' | 'castle'
  map: [ '.......', '.S...F.', '#######' ],
  tools: ['forward'],        // paletteki bloklar ('loop', 'combo' dahil)
  needCombo: 3,              // isteğe bağlı: en az bu kadar art arda vuruş
  maxBlocks: 4,              // program + kombo serisi toplam blok sınırı
  par: 4,                    // 3 yıldız için en fazla blok
  combo: [ ... ],            // isteğe bağlı: çözümün kombo serisi
  solution: [ ... ]          // testlerde doğrulanır
}
```

Harita: `.` hava, `#` toprak, `=` taş, `B` kutu, `?` soru kutusu (içinde
altın), `o` altın, `^` diken, `S` Ryu, `F` bayrak, `e` haydut (1 can), `E` koca
(3 can), `X` patron (4 can), `b` yarasa (uçar), `k` kirpi (dikenli; yalnızca
Hadoken yener). Testler her çözümün kazandığını, `par`'a sığdığını ve kombo
bölümlerinde kombosuz çözümün `maxBlocks`'a sığmadığını doğrular.

## Yıldızlar ve kayıt

Yıldızlar KodRobot'taki gibidir (blok sayısı: program + kombo serisi).
`js/ryu/app.js` içindeki `UNLOCK_ALL` true iken (test için) bütün bölümler
açıktır; false olunca bir bölüm, önceki bölüm geçilmişse açılır. Kayıtlar
`localStorage` içinde, her erişim try/catch ile: `ryu.v1.progress`,
`ryu.v1.program.<id>` (`{ program, combo }`), `ryu.v1.code.<id>` (yazılan
metin, yorumları korumak için), `ryu.v1.level`, `ryu.speed`, `ryu.mode`
(`'blocks'` | `'code'`).
