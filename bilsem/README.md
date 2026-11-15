# Zekâ Kâşifi

2. sınıf öğrencileri için BİLSEM genel zihinsel yetenek sınavına hazırlık uygulaması.
20 soru türü, her biri üç seviyede (Kolay, Orta, Zor). Sorular hazır bir havuzdan
gelmez; her seferinde yeniden üretilir, bu yüzden ezberlenemez.

## Açmak

Kurulum yok: `bilsem/index.html` dosyasını tarayıcıda aç. Tablet, telefon ve
bilgisayarda çalışır; dokunma, fare ve klavye (1–4 ya da A–D, Enter) desteklenir.

Tek dosya hâlinde taşımak için:

```
node bilsem/tools/tek-dosya.js zeka-kasifi.html
```

## Çalışma biçimleri

| Biçim | Ne yapar |
|---|---|
| Günün Görevi | Farklı konulardan 10 soru. Az çalışılan ve zorlanılan konular daha sık gelir. |
| Konu alıştırması | Seçilen konu ve seviyede 5, 10 ya da 15 soru. Her cevaptan sonra açıklama gösterilir. |
| Deneme Sınavı | 20, 40 ya da 60 soru; süreli; cevaplar sınav bitince gösterilir. |
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
| `js/store.js` | Yıldızlar, gün serisi, konu istatistikleri (`localStorage`) |
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
