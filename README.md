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
| 4. Karanlık Bulutsu | …olana kadar, VE / VEYA | oynanabilir (8 sahne) |
| 5. Korsan Bölgesi | Olaylar | oynanabilir (8 sahne) |
| 6. Enerji Krizi | Değişkenler | oynanabilir (8 sahne) |
| 7. Manevra Okulu | Fonksiyonlar | oynanabilir (8 sahne) |
| 8. Ana Gemi | Bütün kavramlarla büyük final | oynanabilir (8 sahne) |

Ana yolda **64 görev**, yanında **24 yan görev** var; bütün yıldızlar toplandığında
**264 yıldız**. İlerleme ve yazılan programlar tarayıcıda saklanır.

Her sektörün sahneleri aynı sırayı izler: **tanış** (hazır programı çalıştır,
küçük bir şeyi değiştir) → **dene** ×2 (yarım programı tamamla) → **pekiştir** ×3
(sıfırdan yaz) → **hata avı** (hatalı programı düzelt) → **final**.

### Hikâye

Ana Gemi **Atlas**, yeni yuva gezegeni Nova'ya giderken **Kızıl Kanca**'nın korsanlarına
yakalandı; mürettebat kurtarma kapsülleriyle uzaya dağıldı, otopilot bozuldu. Çocuk genç
bir pilottur: kopilot robotu **Bip** ile otopilotu baştan yazar. Her sektör Bip'in bir
telsiz mesajıyla açılır, finalinde mürettebattan biri kurtulur; son görevde gemi Atlas'a
yanaşır. Bip ipuçlarını, hata mesajlarını ve sonuçları da söyler.

### Ana yolun dışında

Yan görevler rota ekranında ana görevlerin yanında, kesik çizgili düğümler olarak durur;
ana yolu kilitlemezler.

| Tür | Ne zaman açılır | Ne yapar |
|---|---|---|
| **Tahmin turu** (göz) | sektörün 3. görevinden sonra | Program hazırdır, yazılmaz: çocuk okur ve geminin hangi karede duracağını tahmin eder. Üç soru, doğru sayısı kadar yıldız |
| **Öteki yol** (çatal) | ana görevle birlikte | Aynı kavramın başka bir görevi. İkisinden hangisi geçilirse sıradaki açılır (1-5, 2-6, 3-5, 4-5, 6-5) |
| **Acil durum** (!) | bir görev bitince bir kez haber verilir | Araya giren hikâyeli görev (2-5, 5-4 ve 6-6'dan sonra) |
| **Gizli görev** (?) | sektörde 24 yıldızın 20'si toplanınca | Daha zor bir görev; ödülü Bip'in bir arkadaşıdır. 2, 4, 6 ve 7. sektörlerinki yeni bir fikir tanıtır: iç içe döngü, döngü içinde "olana kadar", **sayaç değişkeni**, **sayı alan manevra** |

Rota ekranının altındaki **köprü** çubuğu:

- **Mürettebat**: kurtarılanlar ve gizli görevlerde bulunan robotlar.
- **Hangar**: yıldızlarla açılan gövde, şerit ve alev renkleri, gövde biçimleri; rütbe,
  sektör armaları, otopilot kitaplığı ve yazdırılabilir sertifika.
- **Günün Dalgası**: tarihten üretilen, her gün değişen tek görev. Zorluğu çocuğun vardığı
  yere göre seçilir. Yıldızları ayrı sayılır; seri yoktur, gün atlamak bir şey kaybettirmez.
- **Atölye**: çocuk kareleri doldurarak kendi görevini kurar. Görevi kendisi çözünce
  bağlantıyla paylaşabilir; bağlantıyı açan herkes o görevi oynar.
- **Günlük**: son günlerde geçilen görevler. Oyuna başka bir gün dönülünce Bip kısa bir
  özetle karşılar.
- **Veli**: şifreyle açılan veli paneli (aşağıda).

## Çalıştırmak

Derleme adımı yok; dosyaları bir web sunucusundan açmak yeterli:

```bash
npm start
```

Sonra tarayıcıda `http://localhost:8080` adresini aç. Fare ve dokunmatik ekranla
çalışır; tablet (yatay) ve bilgisayar için tasarlandı.

- Adresin sonuna `?hepsi` (ya da `#hepsi`) eklersen bütün sahneler açılır (gözden geçirmek için).
- Gizli çözüm modu: `?cozum` bütün sahneleri açar ve her görevin kod alanına örnek çözümünü yükler
  (Python sekmesinde kod karşılığı da görünür). Örneğin `?cozum#8-8` doğrudan son görevin çözümünü açar.
  Tahmin turlarında doğru kare işaretlenir. Bu modda programı değiştirmek kayıtlı programlarının üzerine yazmaz;
  parametreyi kaldırınca normal oyuna dönersin. Atölyede oluşturulan görevlerin hazır çözümü yoktur.
- `#3-4` gibi bir ek doğrudan o sahneyi açar: `http://localhost:8080/?hepsi#3-4`.
  Yan görevlerin kimlikleri: `3-t` tahmin turu, `3-g` gizli görev, `2-a` acil durum, `1-5-b` öteki yol.
- `?kalite=yuksek|orta|dusuk` görüntü kalitesini sabitler (yazılmazsa cihaz yavaşsa kendiliğinden düşer).
- `#oyna=...` atölyede kurulmuş bir görevi, `#aktar=...` başka cihazdan gelen ilerlemeyi açar.

## Nasıl oynanır

- Paletteki bir bloğa dokunmak onu programın sonuna ekler; sürükleyerek istediğin
  yere, döngünün ya da "eğer" bloğunun içine bırakabilirsin.
- Programdaki bir bloğu alanın dışına sürüklemek ya da dokunup çöp düğmesine
  basmak onu siler. Geri al düğmesi son değişikliği geri getirir.
- **Uçur** programı çalıştırır, **adım** tek tek ilerletir, **baştan** gemiyi
  başlangıca alır, **hız** 1×, 2× ve ½× arasında geçer.
- **Rota** açtığın görevin haritadaki yerine döner. Tarayıcının geri/ileri düğmeleri de
  rota ve görevler arasında gezinir; günlük ve atölye görevleri sayfa yenilenince yeniden açılır.
- Her uçuş komutu gemiyi bir sıra ileri taşır; kaçış blokları çapraz gider. Gemi
  çıkış çizgisini geçince görev tamamlanır.
- Yıldızlar: çıkışa ulaşmak 1, bütün kristalleri toplamak +1, hedef blok
  sayısını aşmamak +1.
- Bazı görevlerde birden çok **dalga** vardır: alan her dalgada değişir ve aynı
  program hepsini geçmelidir (yolu ezberleyen değil, sensöre bakan program geçer).
  Böyle görevlerde görev metninin altında numaralı dalga düğmeleri durur. Uçuş
  yokken bir numaraya dokunarak o dalganın alanına bakabilirsin; program bir
  dalgada takılırsa sen onu düzeltirken o dalga ekranda kalır.
- **Olana kadar** bloğu koşulu her turdan önce denetler. Mor halka bir işarettir;
  işarete varınca döngü biter ve altındaki komutlar devam eder. Koşula dokunarak
  sensör, VE veya VEYA seçebilirsin.
- **Olay olunca** bloğunu uçuş döngüsünden önce yerleştir. Olay adına dokunarak
  korsan, işaret, kristal veya şarj olayını seç. Kırmızı korsan gemisine karşı
  **kalkan aç** bir saldırıyı durdurur; meteor için kaçış yapmak gerekir. Açık
  kalkan yeniden açılamaz: kalkanı her adımda değil, bir olay olunca aç.
- **Enerji** bir değişkendir. Enerji görevlerinde başlangıçta 0'dır; ilk uçuş öncesi
  değerini ayarla. Her hareket, çıkış adımı dahil 1 enerji harcar. **Enerjiye ekle**
  yalnızca yeşil şarj istasyonunda çalışır ve gemiyi ilerletmez. Depo en çok 9
  enerji alır; fazlası taşar ve uçuş biter. Üstündeki sayıya dokunarak değeri
  değiştir; ekrandaki sayaçtan güncel enerjiyi izle.
- **Manevra tanımla** içine bir hareket grubu yaz. **Manevra çağır** aynı adlı
  tanımı çalıştırır; adlara dokunarak eşleştir. Tanımı çağrıdan önce yerleştir.
  Fonksiyonlar koşullar, döngüler ve olayların içinde de kullanılabilir.
- Blok ve Python sekmeleri aynı programı gösterir. Python görünümü salt okunurdur;
  uçuş sırasında çalışan satır vurgulanır.
- **Otopilot kitaplığı**: kazanılan bir uçuşta çağrılan her manevra tanımı kitaplığa
  girer. Final görevlerinde, günün dalgasında ve atölyede bu manevralar yeniden
  tanımlanmadan çağrılabilir (palette kitap işaretli blok).
- **Sayaç** (6. sektörün gizli görevi) çocuğun kendi değişkenidir: önce bir değere
  ayarlanır, sonra artırılır; ayarlanmadan artırılırsa uçuş biter.
- **Sayı alan manevra** (7. sektörün gizli görevi): tanım bir sayı (n) alır, içindeki
  döngü "n kez" döner; sayı çağrıda verilir.

### Takılınca

- Başarısız uçuştan sonra Bip ne olduğunu söyler. **İpucu** düğmesi basamak basamak
  derinleşir: önce yön gösteren bir cümle, sonra programda eksik olan şey, en sonda
  örnek çözümün iskeleti (komutların yarısı soru işareti). Cevabın kendisi verilmez.
- Kaydırıcıyla uçuş **geri sarılır**: gemi adım adım geri gider, o adımı üreten blok
  vurgulanır.
- Aynı görevde beş kez üst üste başarısız olunursa görev **sonraya bırakılabilir**:
  sıradaki açılır, bırakılan görev rota ekranında kesik çerçeveyle bekler.
- **Sesli okuma** (rota ekranındaki konuşma balonu düğmesi) görev metnini, ipuçlarını
  ve Bip'in söylediklerini tarayıcının Türkçe sesiyle okur.
- Görev ekranındaki kamera düğmesi **pilot kamerasına** geçer; kazanılan uçuş sonuç
  kartındaki **İzle** ile öteki kameradan yeniden oynatılır.

## Veli paneli

Köprüdeki **Veli** düğmesi şifreyle açılır: **321321** (BİLSEM uygulamasıyla aynı). Şifre
yalnızca çocuğun kaydı kazara silmesini önlemek içindir; gerçek bir güvenlik önlemi değildir.

- **Rapor**: toplam yıldız, geçilen görev, oyun süresi, oynanan gün; sektör sektör geçilen
  görev, yıldız, süre ve kavramın ne kadar uğraştırdığı; takıldığı görevler, en sık
  başarısızlık nedenleri ve veliye öneriler.
- **İlerlemeyi aktar**: kayıt bir koda (ya da bağlantıya) çevrilir; öteki cihazda kod
  yapıştırılınca kayıt oraya yüklenir.
- **Sıfırla**: bütün kaydı siler.

Kayıt yalnızca o cihazın tarayıcısında tutulur; hiçbir yere gönderilmez.

## Çevrimdışı ve ana ekran

Oyun bir kez açıldıktan sonra internetsiz de çalışır ve telefonda/tablette ana ekrana
uygulama gibi eklenebilir (`manifest.webmanifest`, `sw.js`). Servis çalışanı sayfayı her
açılışta önce ağdan ister, bu yüzden yeni sürüm yayımlanınca hemen görülür; aynı adresteki
öteki uygulamalara (`bilsem/`, `kodrobot-eski/`) dokunmaz. Geliştirme sırasında eski dosya
sunmasın diye `localhost`ta kurulmaz; denemek için adrese `?sw` ekle.

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

Her PR'da ve ana dala giren her değişiklikte `.github/workflows/test.yml` testleri ve
görev denetçisini çalıştırır; damga unutulduysa ya da bir görev bozulduysa orada görünür.

## Geliştirme

```bash
npm test          # motor, görevler, kayıt, rapor, üreteçler
npm run denetle   # görev denetçisi (aşağıda)
```

| Dosya | Görev |
|---|---|
| `src/engine/world.js` | Alan, sensörler ve program yürütücü. Saf mantık; olay listesi üretir |
| `src/engine/blocks.js` | Blok modeli, ağaç işlemleri, Python görünümü |
| `src/content/levels.js` | Sektörler ve ilk üç sektörün sahneleri |
| `src/content/advanced.js` | Sektör 4–8 için 40 görev; `route()` ve `mission()` yardımcıları |
| `src/content/extras.js` | Yan görevler: gizli, acil durum, öteki yol, tahmin turu |
| `src/content/predict.js` | Tahmin turunun soruları ve seçenek üretimi |
| `src/content/gen.js` | Tohumlu rastgele dalga üreteci |
| `src/content/daily.js` | Günün Dalgası: tarihten görev üretimi |
| `src/content/custom.js` | Atölye: alan kodu, bağlantı, alandan görev kurma |
| `src/content/story.js` | Hikâye metinleri, mürettebat, robotlar |
| `src/content/hints.js` | Kademeli ipucu: eksik blok cümlesi, çözüm iskeleti |
| `src/content/hangar.js`, `ranks.js` | Gemi parçaları ve açılma koşulları, rütbeler |
| `src/content/logbook.js`, `report.js` | Kaptan günlüğü ve veli raporu (kayıttan özet) |
| `src/render/view.js`, `models.js` | 3B sahne, kameralar, efektler ve animasyonlar (three.js) |
| `src/render/themes.js` | Sektör görünümleri: gökyüzü, gezegen, ızgara rengi, ışık |
| `src/ui/editor.js` | Blok düzenleyici: sürükle-bırak, seçim, geri alma |
| `src/ui/game.js` | Görev ekranı: çalıştırma, dalgalar, ipuçları, tahmin turu, sonuç |
| `src/ui/map.js` | Rota ekranı: yıldız haritası, yan görev düğümleri, köprü |
| `src/ui/hangar.js`, `workshop.js`, `parent.js` | Hangar, atölye ve veli paneli ekranları |
| `src/ui/copilot.js`, `shipart.js`, `overlay.js` | Bip ve yüz çizimleri, gemi çizimi, kartlar ve konfeti |
| `src/ui/sfx.js`, `voice.js` | Ses efektleri, sektör müzikleri (Web Audio), sesli okuma |
| `src/storage.js` | İlerleme kaydı (tarayıcıda) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Çevrimdışı çalışma ve ana ekran simgesi |
| `tools/denetle.js` | Görev denetçisi |
| `tests/` | Motor, görev, üreteç, kayıt ve rapor testleri |

### Görev denetçisi

`npm run denetle` her görevi "kestirme" programlarla dener: örnek çözümün geçmesi yetmez,
görevin öğrettiği kavram o görevde gerçekten gerekli mi, ona bakar (rotayı elle yazmak,
tek yöne kaçmak, olayın işini döngüye yaptırmak, hiç şarj etmemek, fonksiyonsuz yazmak,
"olana kadar" yerine "sürekli tekrarla" koymak, bir dalgayı ezberlemek…). Kavramı atlayıp
tam yıldız alan her yol bir **uyarı**dır; bilerek bırakılanlar nedenleriyle `KABUL`
listesinde durur. Listede olmayan yeni bir uyarı testleri kırar. Tek görev:
`npm run denetle -- 7-8`.

### Yeni sahne eklemek

İlk üç sektör `src/content/levels.js`, sonraki sektörler `src/content/advanced.js`
içindedir. Her sektörün sekiz görevlik sırasını koru. Alan metinle
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
döngü sahneleri döngüsüz çözülemez ve çok dalgalı görevlerde ezberlenmiş bir rota
öteki dalgalarda işe yaramaz. Yeni sektörlerde B mor işaret, P korsan, E şarj istasyonudur.
Şarj istasyonu bulunan bir alanda enerji sistemi etkinleşir. Olay adları `events`,
fonksiyon adları `functions`, seçilebilir sensörler `conds` listesinde tanımlanır.
Motor testleri enerji tüketimini, depo sınırını, olay sırasını, kalkanın tek kullanımını,
fonksiyon çağrılarını ve hareketsiz/özyinelemeli programların durdurulmasını da kapsar.

Bir görevin öğrettiği kavram o görevde gerçekten işe yaramalıdır; testler bunu da
denetler: iki sensörlü görevlerde tek yöne kaçmak yetmez ama önce sola bakan ayna
mantık da tam yıldız alır, kalkanı olaya bağlamayan program Sektör 5'i geçemez,
şarj etmeden ya da enerjiye bakmadan Sektör 6'nın ilgili görevleri bitmez.

`src/content/advanced.js` içindeki `route()` alanı uçuş yolundan üretir: `F` düz,
`L`/`R` kaçış (öne ve kaçılmayan yana meteor konur), küçük `l`/`r` ise meteorsuz
dönüştür (sensörlerin göremediği, mor halkanın haber verdiği dönüş). Bir görevi
baştan tasarlarsan `rev` değerini artır: eski tasarım için kaydedilmiş program
yeniden açılmaz, kazanılan yıldızlar kalır.

Yan görevler `src/content/extras.js` içindedir: `secret(sektör, …)`, `alarm(sektör,
yanındakiGörev, …)`, `fork(sektör, anaGörev, …)`. Alanları ana görevlerle aynıdır;
denetçi ve testler onları da kapsar. Tahmin turunun soruları `src/content/predict.js`
içindeki `ROUNDS` tablosundadır: her soru bir alan, bir program ve programın bittiği
karedir (testler doğrular); program çıkışa varmamalı, alanın içinde bitmelidir.
Görev bayrakları: `boss` (son korsan kaptandır), `dock` (çıkışta Atlas'ın kapısı),
`library` (kitaplıktaki manevralar çağrılabilir), `params` (manevralar sayı alır).

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
