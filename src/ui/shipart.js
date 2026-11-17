// Geminin üstten görünüşü (SVG). Rota ekranındaki gemi işareti, hangar önizlemesi ve
// sertifika aynı çizimi kullanır; renkler ve biçim hangardaki seçime göre değişir.

/** @param look  content/hangar.js içindeki lookOf() sonucu */
export function shipSvg(look, cls = '') {
  const { hull, accent, flame, shape } = look;
  return `<svg viewBox="-24 -24 48 48" class="${cls}" style="overflow:visible" aria-hidden="true">`
    + `<path class="flame" d="M-7 13L-4.500 27-2 13zM2 13l2.500 14L7 13z" fill="${flame.color}"/>`
    + `<g transform="scale(${shape.wing} 1)"><path d="M-5-2L-21 11v5l16-3zM5-2l16 13v5L5 13z" fill="${hull.color}"/><path d="M-21 11v5l6-1.200V7zM21 11v5l-6-1.200V7z" fill="${accent.color}"/></g>`
    + `<g transform="translate(0 12) scale(1 ${shape.nose}) translate(0 -12)"><path d="M0-21C3.500-15 5-7 5 3v9h-10V3c0-10 1.500-18 5-24z" fill="${hull.color}"/><path d="M0-21C3.500-15 5-7 5 3v9H0z" fill="rgba(255,255,255,.22)"/>`
    + `<ellipse cx="0" cy="-6" rx="2.300" ry="5.500" fill="#2fc8ff"/><rect x="-1.200" y="3" width="2.400" height="8" rx="1" fill="${accent.color}"/></g></svg>`;
}
