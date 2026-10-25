# KodRobot 🤖

Tarayıcıda oynanan bir kodlama oyunu. Küçük bir programlama diliyle robotu
ızgara üzerinde hedefe götür, yol boyunca elmasları topla. 15 bölüm boyunca
komutlar, döngüler, fonksiyonlar, koşullar ve labirent çözme algoritmaları
öğrenilir.

## Oynamak

Kurulum yok: `index.html` dosyasını tarayıcıda aç.

```
ilerle()
tekrarla 3 {
  sagaDon()
  ilerle()
}
iken !hedefte() {
  eger onumBos() { ilerle() } degilse { solaDon() }
}
```

Komutların İngilizce karşılıkları da geçerlidir (`move()`, `repeat`, `while`, `if`...).
Dilin tam tanımı için [CONTRACT.md](CONTRACT.md) dosyasına bak.

## Geliştirme

```
node --test
```

| Dosya | Görev |
|---|---|
| `js/interpreter.js` | Dilin ayrıştırıcısı ve yorumlayıcısı |
| `js/world.js` | Oyun dünyası mantığı (DOM'suz) |
| `js/levels.js` | Bölümler |
| `js/renderer.js` | Canvas çizimi ve animasyon |
| `js/app.js` | Arayüz ve oyun akışı |
