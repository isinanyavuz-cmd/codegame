// Sektörler arası geçiş: gemi bir gezegenden kalkar, yıldızların arasından uçar ve sıradaki
// gezegene varır. Kalkışta ve varışta ekranın tamamı kısa bir an parlar. Ekrana dokununca biter.
import { SECTORS } from '../content/levels.js';
import { shipSvg } from './shipart.js';

const planet = (s, cls) => {
  const i = SECTORS.indexOf(s);
  return `<div class="planet v${i % 4} ${cls}" style="--h:${s.hue};--r:var(--wr)"><i></i></div>`;
};

/**
 * @param from  ayrılan sektör (SECTORS öğesi)
 * @param to    varılan sektör
 * @returns     animasyon bitince (ya da dokunulunca) çözülen Promise
 */
export function warp({ from, to, look, sfx }) {
  const quick = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = document.createElement('div');
  el.className = 'warp';
  const streaks = Array.from({ length: 46 }, () => {
    const top = Math.random() * 140 - 20, left = Math.random() * 140 - 20, d = 0.35 + Math.random() * 0.55, w = 60 + Math.random() * 160;
    return `<b style="top:${top}%;left:${left}%;width:${w}px;animation-duration:${d}s;animation-delay:${-Math.random() * d}s"></b>`;
  }).join('');
  el.innerHTML = `<div class="streaks">${streaks}</div>${planet(from, 'wfrom')}${planet(to, 'wto')}
    <div class="wship">${shipSvg(look)}</div>
    <div class="wtitle"><small>SEKTÖR ${to.id}</small><b>${to.name}</b><span class="chip">${to.concept}</span></div>
    <div class="wflash"></div>`;
  document.body.append(el);

  const T = quick ? 1400 : 3600, $ = (s) => el.querySelector(s);
  const anim = (sel, frames, opts) => $(sel).animate(frames, { duration: T, fill: 'both', easing: 'ease-in-out', ...opts });
  const flash = (delay) => anim('.wflash', [{ opacity: 0 }, { opacity: 0.9, offset: 0.12 }, { opacity: 0 }], { duration: 650, delay, easing: 'ease-out', fill: 'none' });

  // Kalkış: ayrılan gezegen sol altta büyük; geri çekilip küçülür.
  anim('.wfrom', [{ transform: 'translate(0,0) scale(1)' }, { transform: 'translate(-30vw,30vh) scale(.35)', opacity: 0.2 }], { easing: 'ease-in' });
  // Varış: sağ üstte küçük bir nokta olarak görünür, yaklaşıp büyür.
  anim('.wto', [{ transform: 'scale(.12)', opacity: 0 }, { transform: 'scale(.3)', opacity: 1, offset: 0.35 }, { transform: 'scale(1)' }], { easing: 'cubic-bezier(.5,0,.3,1)' });
  // Gemi: ayrılan gezegenin üstünden çıkar, ekranın ortasından geçer, varılan gezegene alçalır.
  anim('.wship', [
    { left: '24%', top: '72%', transform: 'translate(-50%,-50%) rotate(40deg) scale(.7)' },
    { left: '38%', top: '52%', transform: 'translate(-50%,-50%) rotate(45deg) scale(1.5)', offset: 0.3 },
    { left: '58%', top: '40%', transform: 'translate(-50%,-50%) rotate(45deg) scale(1.5)', offset: 0.7 },
    { left: '70%', top: '32%', transform: 'translate(-50%,-50%) rotate(50deg) scale(.25)', opacity: 0.2 },
  ]);
  anim('.streaks', [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }]);
  anim('.wtitle', [{ opacity: 0, transform: 'translate(-50%, 14px)' }, { opacity: 0, offset: 0.6 }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.8 }, { opacity: 1, transform: 'translate(-50%, 0)' }]);
  if (!quick) { flash(80); flash(T * 0.72); }
  sfx?.launch?.(); sfx?.travel?.(T / 1000 * 0.8);

  return new Promise((done) => {
    let over = false;
    const end = () => {
      if (over) return; over = true;
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, fill: 'forwards' }).finished.then(() => el.remove());
      done();
    };
    setTimeout(end, T + 500);
    el.addEventListener('click', end);
  });
}
