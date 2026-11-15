# KodRobot 🤖

Çocuklara kodlama mantığını öğreten, Box Island tarzı bir oyun. Yazı yok:
ok bloklarını sürükleyip "Programım" alanına bırak, ▶ Başlat'a bas ve
robotun adadaki bayrağa ulaşmasını izle. 29 bölüm boyunca sıralama,
elmas toplama ve özellikle iç içe döngü mantığı öğrenilir.

## Oynamak

Kurulum yok: `index.html` dosyasını tarayıcıda aç. Fare ve dokunmatik ekranla çalışır.

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
| `js/world.js` | Oyun dünyası mantığı (DOM'suz) |
| `js/blocks.js` | Blok programını çalıştıran motor |
| `js/levels.js` | Bölümler |
| `js/renderer.js` | Ada, deniz ve robot çizimi, animasyonlar |
| `js/app.js` | Sürükle-bırak arayüzü ve oyun akışı |

Mimari ayrıntılar için [CONTRACT.md](CONTRACT.md).
