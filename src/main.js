// Kod Pilotu — giriş noktası: sahneyi kurar, rota ve görev ekranları arasında geçiş yapar.
import { View } from './render/view.js';
import { Game } from './ui/game.js';
import { MapScreen } from './ui/map.js';
import { Hangar } from './ui/hangar.js';
import { Workshop } from './ui/workshop.js';
import { decodeField, customLevel } from './content/custom.js';
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
  const play = (level) => { map.hide(); music.mood('game'); game.open(level); };
  const workshop = new Workshop({ store, sfx, onPlay: play });
  const map = new MapScreen({ store, sfx, music, voice, hangar, workshop, onOpen: play });
  const game = new Game({ view, store, sfx, music, voice, hangar, workshop, onExit: () => { music.mood('map'); map.show(); } });

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
  window.addEventListener('hashchange', () => { const level = shared(); if (level) play(level); });

  const fromHash = shared() || findLevel(location.hash.slice(1));
  if (fromHash && (fromHash.free || store.isUnlocked(fromHash, LEVELS))) { music.mood('game'); game.open(fromHash); } else map.show();
  window.__kp = { view, game, map, store, hangar, workshop };
}

boot();
