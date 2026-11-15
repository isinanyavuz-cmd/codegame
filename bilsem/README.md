# Enes BİLSEM'e Hazırlanıyor

2. sınıf için BİLSEM genel zihinsel yetenek sınavına hazırlık uygulaması.
20 soru türü, her biri dört kademede (Kolay, Orta, Zor, En Zor), ayrıca bir Sayı Hafızası
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
| Konu alıştırması | Seçilen konu ve kademede 5, 10 ya da 15 soru. Her cevaptan sonra açıklama gösterilir. |
| Deneme Sınavı | 20, 40 ya da 60 soru; süreli; cevaplar sınav bitince gösterilir. |
| Sayı Hafızası | Sayı bir süre görünür ve kapanır; süre bitmeden klavyeyle düzden ve tersten yazılır. 3 basamaktan 7 basamağa kadar uzar, üç yanlışta oyun biter. Süre (hem görünme hem her yazım için): Kolay basamak sayısının iki katı, Orta basamak sayısı, Zor basamak sayısının üçte ikisi kadar saniye. Yazma süresi isteğe bağlıdır (veli panelinden): "Süresiz" seçilirse sayı yine süreyle görünür ama yazarken süre yoktur. |
| Veli paneli | Şifreyle açılır (321321). Konu konu doğru oranı, ortalama süre, son 7 gün, öneriler, ayarlar. |

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

## Kademeler

Her soru türünün dört kademesi var: 1 Kolay, 2 Orta, 3 Zor, 4 En Zor. Örnekler:

| Tür | Kolay | Orta | Zor | En Zor |
|---|---|---|---|---|
| Şekil Örüntüsü | yinelenen birim, dönen şekil, artan sayı | iki özellik birlikte değişir | dönüş + renk + boyut; halkada dolaşan kare | iki kare farklı hızlarda dolaşır |
| Şekil Tablosu | satır bir özelliği, sütun başka bir özelliği belirler | her satır ve sütunda her şekil ve renk | üç özellik; sayıların toplamı; üst üste koyma | ortak kareler silinir; dört özellik |
| Döndürme | 3×3 kareli şekil | 4×4 şekil | 5×5 şekil, tek karesi kaymış çeldiriciler | iki adım: dönüş ve yansıma |
| Küp Sayma | 6–10 küp | 3×3 taban, 10–17 küp | 4×4 taban, 16–26 küp | büyük küpe tamamlama; 26–40 küp |
| Sayı Örüntüsü | sabit artış ve azalış, iki adımın sırayla yinelenmesi | büyüyen artış, 2 katı, iç içe iki dizi | önceki iki sayının toplamı, 2 katı + k | önceki üç sayının toplamı, ×2 ve +k sırayla |
| Sayı Makinesi | ekleme, çıkarma, 2 katı | 2 katı ± 1, 3 katı | 3 katı ± 1, kendisiyle çarpma, yarısı | iki sayı girer, bir sayı çıkar |
| Terazi | 4 şekil, en ağır ya da en hafif | 4–5 şekil sıralanır | 6 şekil, "kaç şekil daha ağır?" | dengede duran terazilerle "kaç tane eder?" |
| Ok Yolu | 5×5 alan, 5–6 ok | 5×5 alan, 6–8 ok, yol seçme | 6×6 alan, tekrar sayılı oklar | baktığı yöne göre komut alan robot |
| Kim Hangisi? | 3 kişi, 2 ipucu | 3–4 kişi, "değil" ipuçları | 4 kişi, en az sayıda ipucu | "ne … ne …" ve "ya … ya da …" ipuçları |

Öncüllü sorularda (Kim Hangisi?, Sıralama) soru cümlesi öncüllerin altında gösterilir.

Sayı Hafızası'nın düzeyleri ayrıdır (Kolay, Orta, Zor) ve yalnızca süreyi belirler.

Eski kayıt varsa ilk açılışta taşınır: üç kademeli kayıttaki her kademe bir yukarı kayar
ve altına yeni Kolay kademe eklenir; hiç çözülmemiş konular Kolay'dan başlar.

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
| `js/gen-*.js` | Soru üreticileri: `Bilsem.GEN[tür](rng, kademe)`; kademe 1–4 |
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
