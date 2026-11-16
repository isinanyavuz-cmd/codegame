// Ekranın ortasında açılan kartlar (giriş, sonuç, günlük, ipucu iskeleti) ve kutlama konfetisi.
const $ = (id) => document.getElementById(id);

export function showCard(card) { const o = $('overlay'); o.replaceChildren(card); o.hidden = false; }
export function hideCard() { $('overlay').hidden = true; }

/** Kart kurar. `data-act` taşıyan düğmelere basılınca `onAct(act)` çağrılır. */
export function makeCard(html, onAct, cls = '') {
  const card = document.createElement('div'); card.className = `card glass ${cls}`.trim();
  card.innerHTML = html;
  card.addEventListener('click', (e) => { const act = e.target.closest('[data-act]')?.dataset.act; if (act) onAct(act, e); });
  return card;
}

const COLORS = ['#ffd53d', '#37e39a', '#5ef2ff', '#ff6a9a', '#b58cff', '#ff8a1f'];
/** Ekranın üstünden dökülen konfeti; kendiliğinden temizlenir. */
export function confetti(n = 46) {
  const box = document.createElement('div'); box.className = 'confetti';
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.cssText = `left:${Math.random() * 100}%;background:${COLORS[i % COLORS.length]};animation-duration:${1.5 + Math.random() * 1.3}s;animation-delay:${Math.random() * 0.45}s;`
      + `width:${7 + Math.random() * 6}px;height:${10 + Math.random() * 8}px;--spin:${(Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540)}deg;--drift:${(Math.random() - 0.5) * 22}vw`;
    box.append(p);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 3400);
}
