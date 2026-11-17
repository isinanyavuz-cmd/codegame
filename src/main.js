// Kod Pilotu — giriş noktası: sahneyi kurar, rota ve görev ekranları arasında geçiş yapar.
import { View } from './render/view.js';
import { Game } from './ui/game.js';
import { MapScreen } from './ui/map.js';
import { Hangar } from './ui/hangar.js';
import { Workshop } from './ui/workshop.js';
import { ParentPanel } from './ui/parent.js';
import { decodeField, customLevel, hasRoute } from './content/custom.js';
import { hideCard } from './ui/overlay.js';
import { sfx, music } from './ui/sfx.js';
import { voice } from './ui/voice.js';
import { store } from './storage.js';
import { LEVELS } from './content/levels.js';
import { findLevel } from './content/extras.js';
import { CREW, BOTS } from './content/story.js';

async function boot() {
  try { await Promise.all(['500', '700', '800'].map((w) => document.fonts.load(`${w} 20px "Exo 2"`, 'ÇIKIŞ ğşı'))); } catch (e) { /* yedek yazı tipiyle devam */ }
  sfx.enabled = store.sound; music.enabled = store.music; voice.enabled = store.voice;
  // Tarayıcı bir kullanıcı hareketinden önce ses çalmaz. Hangi olayın "hareket" sayıldığı
  // tarayıcıya göre değişir (iPad dokunmayı bırakınca sayar), bu yüzden hepsi dinlenir.
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => music.start(), { passive: true });

  const view = new View(document.getElementById('stage'));
  // Hangardaki seçim sahnedeki gemiye ve rota ekranındaki işarete hemen yansır.
  const hangar = new Hangar({ store, sfx, onLook: (look) => { view.setLook(look); if (!document.getElementById('map').hidden) map.render(false); } });
  view.setLook(hangar.look());
  const play = (level) => game.open(level);
  const workshop = new Workshop({ store, sfx, onPlay: play });
  const parent = new ParentPanel({ store, sfx });
  const map = new MapScreen({ store, sfx, music, voice, hangar, workshop, parent, onOpen: play });
  const game = new Game({ view, store, sfx, music, voice, hangar, workshop,
    onEnter: () => { map.hide(); music.mood('game'); },
    onExit: (level) => { music.mood('map'); map.show(level); },
  });

  let timer = 0;
  window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { view.resize(); game.layout(); }, 120); });

  // Bu özellikten önce geçilmiş finallerin mürettebatı da gemide sayılır.
  for (const c of CREW) if (store.stars(`${c.sector}-8`) > 0) store.rescue(c.id);
  for (const b of BOTS) if (store.stars(`${b.sector}-g`) > 0) store.rescue(b.id);

  // Paylaşılan görev: bağlantının ucundaki kod (#oyna=...) bir arkadaşın atölyede kurduğu alandır.
  const shared = () => {
    const m = /^#oyna=(.+)$/.exec(location.hash);
    let field = null;
    try { field = m && decodeField(decodeURIComponent(m[1])); } catch (e) { /* bozuk bağlantı */ }
    return field ? customLevel(field.lines, { par: field.par, own: false, library: Object.keys(store.library()) }) : null;
  };
  let offered = null;
  const route = () => {
    // Eski #hepsi bağlantısı hem ilk açılışta hem sonradan yazıldığında çalışsın.
    const reveal = location.hash === '#hepsi';
    if (reveal) {
      const url = new URL(location.href); url.hash = ''; url.searchParams.set('hepsi', '');
      history.replaceState(null, '', url); store.unlockAll = true;
    }
    const hash = location.hash, visible = !document.getElementById('game').hidden;
    if (offered && offered !== hash) { hideCard(); offered = null; }
    // Geri/ileri gezinmede popstate ve hashchange birlikte gelebilir: aynı görevi iki kez açma.
    if (visible && hash === `#${game.level.hash ?? game.level.id}`) return;
    if (hash === '#gunluk') { map.openDaily(); return; }
    if (hash === '#atolye') {
      workshop.load();
      if (hasRoute(workshop.design.lines)) { workshop.play(); return; }
      // Başka sekmede yolu kapatılmış bir tasarım varsa boş ekran yerine düzenleyiciyi aç.
      if (visible) game.close({ navigate: false }); else map.show();
      history.replaceState(null, '', location.pathname + location.search);
      workshop.open(); return;
    }
    const level = shared() || findLevel(hash.slice(1));
    if (level && (level.free || store.isUnlocked(level, LEVELS))) game.open(level, { navigate: false });
    else {
      if (visible) game.close({ navigate: false });
      else if (document.getElementById('map').hidden || reveal) map.show();
      // İlerleme aktarma bağlantısı: kaydın yerini almadan önce mutlaka sorulur.
      const moved = /^#aktar=(.+)$/.exec(hash);
      if (moved) {
        if (offered !== hash) parent.offer(moved[1]);
        offered = hash;
      } else if (hash) history.replaceState(null, '', location.pathname + location.search);
    }
  };
  window.addEventListener('popstate', route);
  window.addEventListener('hashchange', route);
  route();
  window.__kp = { view, game, map, store, hangar, workshop, parent };

  // Çevrimdışı çalışma: servis çalışanı dosyaları önbelleğe alır. Geliştirme sırasında (localhost)
  // eski dosya sunmasın diye yalnızca adrese ?sw eklenirse kurulur.
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && (!local || new URLSearchParams(location.search).has('sw'))) navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
