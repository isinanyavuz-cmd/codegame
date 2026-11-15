# Enes BİLSEM'e Hazırlanıyor

2. sınıf için BİLSEM genel zihinsel yetenek sınavına hazırlık uygulaması.
20 soru türü, her biri üç seviyede (Kolay, Orta, Zor), ayrıca bir Sayı Hafızası
bölümü. Sorular hazır bir havuzdan gelmez; her seferinde yeniden üretilir, bu
yüzden ezberlenemez.

## Açmak

Kurulum yok: `bilsem/index.html` dosyasını tarayıcıda aç. Tablet, telefon ve
bilgisayarda çalışır; dokunma, fare ve klavye (1–4 ya da A–D, Enter) desteklenir.

Tek dosya hâlinde taşımak için:

```
node bilsem/tools/tek-dosya.js enes-bilsem.html
```

## Çalışma biçimleri

| Biçim | Ne yapar |
|---|---|
| Günün Görevi | Farklı konulardan 10 soru. Az çalışılan ve zorlanılan konular daha sık gelir. |
| Konu alıştırması | Seçilen konu ve seviyede 5, 10 ya da 15 soru. Her cevaptan sonra açıklama gösterilir. |
| Deneme Sınavı | 20, 40 ya da 60 soru; süreli; cevaplar sınav bitince gösterilir. |
| Sayı Hafızası | Sayı, basamak sayısı kadar saniye görünür ve kapanır; klavyeyle düzden ve tersten yazılır. 3 basamaktan 10 basamağa kadar uzar, üç yanlışta oyun biter. |
| Veli paneli | Konu konu doğru oranı, ortalama süre, son 7 gün, öneriler, ayarlar. |

Resmî sınavın soru sayısı ve süresi her yıl MEB kılavuzunda duyurulur; deneme
uzunluğu bu yüzden seçilebilir bırakıldı.

## Soru türleri

| Alan | Türler |
|---|---|
| Şekil Bulmacaları | Şekil Örüntüsü, Şekil Tablosu, Şekil Benzetmesi, Farklı Olan |
| Döndür ve Hayal Et | Döndürme, Ayna Görüntüsü, Küp Sayma, Üst Üste Şekiller |
| Sayı Bulmacaları | Sayı Örüntüsü, Meyve İşlemleri, Şifre Çözme, Sayı Makinesi |
| Dikkat ve Hafıza | Aynısını Bul, Şekil Sayma, Görsel Hafıza, Gölge Bulma |
| Mantık Yürütme | Sıralama, Ok Yolu, Terazi, Kim Hangisi? |

## Seviyeler

Seviyeler bir kez yukarı kaydırıldı: ilk sürümün Zor düzeyi şimdi Kolay düzeydir.
Orta ve Zor düzeyler bunun üstüne eklendi. Örnekler:

| Tür | Kolay | Orta | Zor |
|---|---|---|---|
| Şekil Örüntüsü | iki özellik birlikte değişir | dönüş + renk + boyut; halkada dolaşan kare | iki kare farklı hızlarda dolaşır |
| Şekil Tablosu | her satır ve sütunda her şekil ve renk | üç özellik; sayıların toplamı; üst üste koyma | ortak kareler silinir; dört özellik |
| Döndürme | 4×4 kareli şekil | 5×5 şekil, tek karesi kaymış çeldiriciler | iki adım: dönüş ve yansıma |
| Küp Sayma | 3×3 taban, 10–17 küp | 4×4 taban, 16–26 küp | büyük küpe tamamlama; 26–40 küp |
| Sayı Örüntüsü | büyüyen artış, 2 katı, iç içe iki dizi | önceki iki sayının toplamı, 2 katı + k | önceki üç sayının toplamı, ×2 ve +k sırayla |
| Sayı Makinesi | 2 katı ± 1, 3 katı | 3 katı ± 1, kendisiyle çarpma, yarısı | iki sayı girer, bir sayı çıkar |
| Terazi | 4–5 şekil sıralanır | 6 şekil, "kaç şekil daha ağır?" | dengede duran terazilerle "kaç tane eder?" |
| Ok Yolu | 5×5 alan, 6–8 ok | 6×6 alan, tekrar sayılı oklar | baktığı yöne göre komut alan robot |

Eski kayıt varsa ilk açılışta taşınır: eski Zor yıldızları Kolay düzeye geçer.

## Geliştirme

```
node --test
```

Testler her soru türünü her seviyede yüzlerce kez üretip şunları denetler:
şıklar birbirinden farklı mı, tek doğru cevap var mı, açıklama dolu mu, doğru
cevap hep aynı şıkka mı düşüyor. Küp sayma, ok yolu, sıralama, terazi ve
"Kim Hangisi?" gibi türlerde cevabın gerçekten doğru olduğu ayrıca hesaplanır.

| Dosya | Görev |
|---|---|
| `js/core.js` | Tohumlu rastgele sayı üreteci, kategori listesi, şık yardımcıları |
| `js/shapes.js` | Şekil, kareli şekil ve küp çizimleri (SVG metni; DOM gerekmez) |
| `js/gen-*.js` | Soru üreticileri: `Bilsem.GEN[tür](rng, seviye)` |
| `js/span.js` | Sayı Hafızası: sayı üretimi ve oyun kuralları |
| `js/store.js` | Yıldızlar, gün serisi, konu istatistikleri, rekorlar (`localStorage`) |
| `js/app.js` | Arayüz |

Yeni bir soru türü eklemek için: `core.js` içindeki `CATS` listesine satır ekle,
bir `gen-*.js` dosyasında `B.GEN.yeniTur` üreticisini yaz, `app.js` içindeki
`ICONS` nesnesine simgesini ekle. Üretici şu biçimde bir nesne döndürür:

```js
{
  prompt: 'Soru metni',
  stem: '<svg …>',              // soru görseli (HTML metni)
  options: [{ html, key }],     // 3–4 şık; key aynı görünen şıkları ayıklamak için
  answer: 2,                    // doğru şıkkın sırası
  explain: 'Neden bu cevap?',
  memo: { html, seconds },      // isteğe bağlı: önce gösterilip gizlenen resim
  layout: 'wide',               // isteğe bağlı: geniş şıklar
}
```
