# Kod Pilotu

Çocuklara (8–12 yaş) kodlamayı öğreten uzay oyunu. Çocuk gemiyi elle sürmez;
blokları dizerek **geminin otopilotunu yazar**, sonra programının uçuşunu izler.

Her sektör tek bir kodlama kavramı öğretir, her sahne o kavramın küçük bir
adımıdır. Bir sahne geçilince sıradaki açılır.

| Sektör | Kavram | Durum |
|---|---|---|
| 1. Kalkış | Sıralama | oynanabilir (8 sahne) |
| 2. Asteroit Kuşağı | Döngü | oynanabilir (8 sahne) |
| 3. Meteor Yağmuru | Eğer / değilse | oynanabilir (8 sahne) |
| 4–8 | …olana kadar, olaylar, değişkenler, fonksiyonlar, final | planlandı |

Her sektörün sahneleri aynı sırayı izler: **tanış** (hazır programı çalıştır,
küçük bir şeyi değiştir) → **dene** ×2 (yarım programı tamamla) → **pekiştir** ×3
(sıfırdan yaz) → **hata avı** (hatalı programı düzelt) → **final**.

## Çalıştırmak

Derleme adımı yok; dosyaları bir web sunucusundan açmak yeterli:

```bash
npm start
```

Sonra tarayıcıda `http://localhost:8080` adresini aç. Fare ve dokunmatik ekranla
çalışır; tablet (yatay) ve bilgisayar için tasarlandı.

- Adresin sonuna `?hepsi` (ya da `#hepsi`) eklersen bütün sahneler açılır (gözden geçirmek için).
- `#3-4` gibi bir ek doğrudan o sahneyi açar: `http://localhost:8080/?hepsi#3-4`.

## Nasıl oynanır

- Paletteki bir bloğa dokunmak onu programın sonuna ekler; sürükleyerek istediğin
  yere, döngünün ya da "eğer" bloğunun içine bırakabilirsin.
- Programdaki bir bloğu alanın dışına sürüklemek ya da dokunup çöp düğmesine
  basmak onu siler. Geri al düğmesi son değişikliği geri getirir.
- **Uçur** programı çalıştırır, **adım** tek tek ilerletir, **baştan** gemiyi
  başlangıca alır, **hız** 1×, 2× ve ½× arasında geçer.
- Her komut gemiyi bir sıra ileri taşır; kaçış blokları çapraz gider. Gemi
  çıkış çizgisini geçince görev tamamlanır.
- Yıldızlar: çıkışa ulaşmak 1, bütün kristalleri toplamak +1, hedef blok
  sayısını aşmamak +1.
- Sektör 3'te meteorların yeri her dalgada değişir; aynı program üç dalgayı da
  geçmelidir.

## Yayın

Oyun GitHub Pages ile ana daldan yayınlanır: ana dala giren her değişiklik bir
iki dakika içinde yayına çıkar.

- Kod Pilotu: `https://isinanyavuz-cmd.github.io/codegame/`
- BİLSEM uygulaması: `https://isinanyavuz-cmd.github.io/codegame/bilsem/`

Dosyaları değiştirdikten sonra şunu çalıştır:

```bash
npm run surum
```

Bu komut `index.html` içindeki dosya adreslerine içerik damgası ekler. Damga
olmazsa tarayıcı on dakikaya kadar eski dosyaları göstermeye devam edebilir.
Rota ekranının altındaki sürüm kodu, yayında hangi sürümün açık olduğunu gösterir.
Damgalar eskiyse testler hata verir.

## Geliştirme

```bash
npm test
```

| Dosya | Görev |
|---|---|
| `src/engine/world.js` | Alan, sensörler ve program yürütücü. Saf mantık; olay listesi üretir |
| `src/engine/blocks.js` | Blok modeli, ağaç işlemleri, Python görünümü |
| `src/content/levels.js` | Sektörler ve sahneler |
| `src/content/gen.js` | Sektör 3 için tohumlu rastgele dalga üreteci |
| `src/render/view.js`, `models.js` | 3B sahne ve animasyonlar (three.js) |
| `src/ui/editor.js` | Blok düzenleyici: sürükle-bırak, seçim, geri alma |
| `src/ui/game.js` | Görev ekranı: çalıştırma, dalgalar, sonuç |
| `src/ui/map.js` | Rota ekranı |
| `src/storage.js` | İlerleme kaydı (tarayıcıda) |
| `tests/` | Motor ve sahne testleri |

### Yeni sahne eklemek

`src/content/levels.js` içindeki `DEFS` listesine bir kayıt ekle. Alan metinle
çizilir: ilk satır en uzak sıra, son satır başlangıç sırasıdır.

```js
{
  kind: 'pekistir', title: 'Kristal Avı',
  brief: 'Kristaller ek yıldız kazandırır. Üçünü de toplayıp çıkışa var.',
  waves: [['.....', '...K.', '..K..', '.K...', '..S..']],   // . boş, M meteor, K kristal, S gemi
  tools: ['fwd', 'left', 'right'], maxBlocks: 7, par: 5,
  solution: () => [L(), R(), R(), F(), F()],
}
```

Testler her sahne için şunları doğrular: örnek çözüm bütün dalgaları 3 yıldızla
geçer, palet çözüme yeter, hazır verilen program işi çocuğa bırakır. Ayrıca
döngü sahneleri döngüsüz çözülemez ve Sektör 3'te ezberlenmiş bir rota öteki
dalgalarda işe yaramaz.

## Üçüncü taraf

- `vendor/three.bundle.min.js`: three.js r187 ve bloom için gereken eklentiler,
  esbuild ile tek dosyada paketlendi (MIT lisansı).
- `vendor/fonts/`: Exo 2 yazı tipi (SIL Open Font License).

## Eski oyun

Önceki ızgara bulmaca oyunu KodRobot `kodrobot-eski/` klasöründe duruyor.

## Bu depodaki diğer uygulama

[`bilsem/`](bilsem/README.md) klasöründe **Enes BİLSEM'e Hazırlanıyor** var: 2. sınıf için
BİLSEM hazırlık alıştırmaları (20 soru türü, sayı hafızası, günün görevi, deneme sınavı,
veli paneli). Açmak için `bilsem/index.html`. Testleri: `node --test bilsem/tests/*.test.js`.
