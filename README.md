# Kodlama Oyunları 🤖🥋

Çocuklara kodlama mantığını öğreten iki tarayıcı oyunu. Kurulum yok: dosyayı
tarayıcıda aç. Fare ve dokunmatik ekranla çalışır.

| Oyun | Dosya | Ne öğretir |
|---|---|---|
| **KodRobot** | `index.html` | Sıralama, elmas toplama, iç içe döngüler (Box Island tarzı, yukarıdan görünüş) |
| **Ryu'nun Kod Macerası** | `ryu.html` | Sıralama, döngüler, fonksiyonlar (kombo) ve yazarak kodlama (Mario tarzı, yandan görünüş) |

İki oyun da üst çubuktaki düğmeyle birbirine bağlı.

## Ryu'nun Kod Macerası

Ryu bayrağa ulaşmak için senin yazdığın programı adım adım uygular: zıplar,
Hadoken atar, kutuları kırar, düşmanları yener. 19 bölüm boyunca hareketler
birer birer açılır.

| Blok | Kodda | Ne yapar |
|---|---|---|
| ➡ İleri / ⬅ Geri | `ileri()` / `geri()` | Bir kare yürür |
| ⤴ Zıpla | `zıpla()` | 2 kare yükselir, 2 kare ileri gider; düşmanı ezer, soru kutusuna kafa atar |
| 👊 Yumruk | `yumruk()` | Önündeki kutuyu kırar ya da düşmana vurur |
| 🔵 Hadoken | `hadoken()` | Ateş topu: ilk düşmana ya da kutuya çarpar. Dikenli kirpiyi yalnızca o yener |
| 🐉 Shoryuken | `shoryuken()` | 3 kare yükselir, 1 ileri iner; yüksek soru kutularını açar, yarasaları yener |
| 🌪 Tatsumaki | `tatsumaki()` | Dönerek 3 kare uçar; yoldaki düşmanlara vurur, geniş çukurları geçer |
| 🔁 Tekrarla | `tekrarla(3) { … }` | İçindekileri 2–9 kez tekrarlar |
| ⚡ Kombo | `kombo()` | Kombo serisini (en fazla 4 blok) çalıştırır: `fonksiyon kombo() { … }` |

- **Bloklar** sekmesinde blokları sürükle ya da dokun; **Kod** sekmesinde aynı
  programı Türkçe komutlarla yaz. Yazım hatalarında satır numarası ve öneri
  gösterilir (`'zipa' diye bir komut yok. 'zıpla()' mı demek istedin?`).
- Art arda vuruşlar **kombo** sayılır: "3 HIT KOMBO!". Koca adam (3 can) ve
  patron (4 can) bölümleri 3'lü ve 4'lü seri ister.
- Çalışırken o anki blok ya da kod satırı parlar. Hata olursa ilgili blok
  kırmızı yanar ve Ryu ne olduğunu söyler.
- En az blokla bitirene 3 yıldız. Geniş haritaları sürükleyerek gezebilirsin.

Örnek kod (Kale Kapısı bölümü):

```
fonksiyon kombo() {
  ileri()
  shoryuken()
  hadoken()
  tatsumaki()
}

kombo()
zıpla()
kombo()
yumruk()
ileri()
kombo()
ileri()
```

## KodRobot

Yazı yok: ok bloklarını sürükleyip "Programım" alanına bırak, ▶ Başlat'a bas ve
robotun adadaki bayrağa ulaşmasını izle. 29 bölüm boyunca sıralama, elmas
toplama ve özellikle iç içe döngü mantığı öğrenilir.

| Blok | Ne yapar |
|---|---|
| ⬆ ⬇ ⬅ ➡ Oklar | Ok hangi yönü gösteriyorsa robot o yöne bir kare gider |
| 💎 Topla | Üstünde durduğun elması topla |
| 🔁 Tekrarla | İçine konan blokları 2–9 kez tekrarla (sayıya tıkla: artır, sağ tıkla: azalt) |

- Paletteki bir bloğa dokunmak onu programın sonuna ekler.
- Programdaki bir bloğa dokunmak onu siler; **Geri al** (ya da Ctrl+Z) son değişikliği geri getirir.
- Blokları sürükleyerek sırasını değiştirebilir, tekrar bloğunun içine koyabilirsin.
- Her bölümde konabilecek blok sayısı sınırlıdır; döngüsüz çözüm sığmaz. En az blokla bitirene 3 yıldız.

## Geliştirme

```
node --test
```

| Dosya | Görev |
|---|---|
| `js/world.js`, `js/blocks.js`, `js/levels.js`, `js/renderer.js`, `js/app.js` | KodRobot |
| `js/ryu/world.js` | Ryu: platform dünyası ve hareketler (DOM'suz) |
| `js/ryu/blocks.js` | Ryu: blok programını (döngü + kombo) çalıştıran motor |
| `js/ryu/code.js` | Ryu: Türkçe kod dilini bloklara çevirir ve geri yazar |
| `js/ryu/levels.js` | Ryu: bölümler |
| `js/ryu/renderer.js` | Ryu: sahne, karakter, düşmanlar ve efektler |
| `js/ryu/app.js` | Ryu: sürükle-bırak, kod düzenleyici ve oyun akışı |

Mimari ayrıntılar için [CONTRACT.md](CONTRACT.md).

Ryu, Capcom'un Street Fighter serisinin karakteridir; bu oyun ticari olmayan,
eğitim amaçlı bir hayran projesidir ve hiçbir resmi görsel kullanmaz (tüm
çizimler kodla yapılır).
