# KodRobot 🤖

Çocuklara kodlama mantığını öğreten, Box Island tarzı bir oyun. Yazı yok:
ok bloklarını sürükleyip "Programım" alanına bırak, ▶ Başlat'a bas ve
robotun adadaki bayrağa ulaşmasını izle. 32 bölüm boyunca sıralama,
yön, elmas toplama ve tekrar (döngü) mantığı öğrenilir.

## Oynamak

Kurulum yok: `index.html` dosyasını tarayıcıda aç. Fare ve dokunmatik ekranla çalışır.

| Blok | Ne yapar |
|---|---|
| ⬆ İleri | Bir kare ileri git |
| ↶ Sola / ↷ Sağa | Olduğun yerde dön |
| 💎 Topla | Üstünde durduğun elması topla |
| 🔁 Tekrarla | İçine konan blokları 2–9 kez tekrarla (sayıya dokunarak değiştir) |

- Bir bloğa dokunmak onu programın sonuna ekler.
- Programdaki bir bloğu palete ya da program alanının dışına sürüklemek onu siler.
- Her bölümde konabilecek blok sayısı sınırlıdır. Ne kadar az blokla bitirirsen o kadar çok yıldız alırsın.

## Geliştirme

```
node --test
```

| Dosya | Görev |
|---|---|
| `js/world.js` | Oyun dünyası mantığı (DOM'suz) |
| `js/blocks.js` | Blok programını çalıştıran motor |
| `js/levels.js` | Bölümler |
| `js/renderer.js` | Ada, deniz ve robot çizimi, animasyonlar |
| `js/app.js` | Sürükle-bırak arayüzü ve oyun akışı |

Mimari ayrıntılar için [CONTRACT.md](CONTRACT.md).
