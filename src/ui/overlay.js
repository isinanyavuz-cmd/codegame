// Ekranın ortasında açılan kartlar (giriş, sonuç, günlük, ipucu iskeleti).
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
