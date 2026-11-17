// Kod Pilotu servis çalışanı: oyun bir kez açıldıktan sonra internetsiz de çalışır ve ana
// ekrana uygulama gibi eklenebilir.
//
// Kurallar:
// - Sayfanın kendisi (index.html) ve damgasız dosyalar: önce ağ. Böylece yeni sürüm yayımlanınca
//   hemen görülür; ağ yoksa önbellekteki son hal açılır.
// - Damgalı dosyalar (css/style.css?v=1a2b3c4d, src/…js?v=…): içerik değişince adres de değiştiği
//   için hiç bayatlamaz; önce önbellek.
// - Aynı adreste yaşayan öteki uygulamalara (bilsem/, kodrobot-eski/) dokunulmaz.
const CACHE = 'kodpilotu-v1';
const OTHER_APPS = ['/bilsem/', '/kodrobot-eski/'];
const FONTS = [500, 600, 700, 800].flatMap((w) => [`./vendor/fonts/exo-2-latin-${w}-normal.woff2`, `./vendor/fonts/exo-2-latin-ext-${w}-normal.woff2`]);
const EXTRA = ['./manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/apple-touch-icon.png'];

/** index.html içinde adı geçen damgalı dosyalar (stil, giriş modülü ve importmap'teki bütün modüller). */
function assetsOf(html) {
  const urls = new Set();
  for (const m of html.matchAll(/(?:href|src)="((?:css|src)\/[^"]+)"/g)) urls.add(`./${m[1]}`);
  const map = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html);
  if (map) { try { for (const u of Object.values(JSON.parse(map[1]).imports)) urls.add(u); } catch (e) { /* bozuk harita: yalnız bulunanlar */ } }
  return [...urls];
}

/** Sayfayı ve gereken her dosyayı önbelleğe alır; artık kullanılmayan eski damgalı dosyaları siler. */
async function sync() {
  const cache = await caches.open(CACHE);
  const res = await fetch('./index.html', { cache: 'no-store' });
  if (!res.ok) return;
  const html = await res.clone().text(), wanted = [...assetsOf(html), ...FONTS, ...EXTRA];
  await cache.put('./index.html', res);
  // Tek tek eklenir: biri indirilemezse ötekiler yine de girer. Önbellekte olan yeniden indirilmez.
  await Promise.all(wanted.map(async (u) => { if (!(await cache.match(u))) await cache.add(u).catch(() => {}); }));
  const keep = new Set(wanted.map((u) => new URL(u, self.registration.scope).href));
  for (const req of await cache.keys()) if (req.url.includes('?v=') && !keep.has(req.url)) await cache.delete(req);
}

self.addEventListener('install', (e) => { e.waitUntil(sync().catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (OTHER_APPS.some((p) => url.pathname.includes(p)) || !url.href.startsWith(self.registration.scope)) return;

  if (url.search.startsWith('?v=')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  const page = req.mode === 'navigate';
  e.respondWith(fetch(req).then((res) => {
    if (res.ok && !page) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    // Sayfa ağdan geldiyse arkada yeni sürümün dosyaları da önbelleğe alınır.
    if (res.ok && page) e.waitUntil(sync().catch(() => {}));
    return res;
  }).catch(async () => (await caches.match(req)) || (page ? caches.match('./index.html') : Response.error())));
});
