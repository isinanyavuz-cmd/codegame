// Rastgele "dalga" üreteci. Koşul sektörlerinde meteorların yeri her dalgada
// değişir; aynı program bütün dalgaları geçmelidir. Üretim tohumludur: aynı
// tanım hep aynı dalgaları verir, böylece oyun ve testler aynı alanı görür.
import { rng } from '../engine/rng.js';
import { parseField, simulate } from '../engine/world.js';

function randomLines({ lanes, rows, start, density }, next) {
  const lines = [];
  for (let y = rows - 1; y >= 1; y--) {
    let row = '';
    for (let l = 0; l < lanes; l++) row += next() < density ? 'M' : '.';
    if (!row.includes('.')) { const i = Math.floor(next() * lanes); row = row.slice(0, i) + '.' + row.slice(i + 1); }
    lines.push(row);
  }
  lines.push('.'.repeat(start) + 'S' + '.'.repeat(lanes - start - 1));
  return lines;
}

/**
 * @param spec.solution   örnek çözüm; her dalgayı geçmek zorunda
 * @param spec.minDodges  çözümün dalga başına yapması gereken en az kaçış
 * @param spec.needBoth   her dalgada hem sola hem sağa kaçış gereksin
 * @param spec.decoys     "kolay yol" programları; her biri en az bir dalgada başarısız olmalı
 * Ayrıca bir dalganın ezber çözümü en az bir başka dalgada başarısız olur.
 */
export function genWaves(spec) {
  const { count = 3, seed, solution, minDodges = 2, needBoth = false, decoys = [] } = spec;
  for (let attempt = 0; attempt < 400; attempt++) {
    const waves = [];
    for (let i = 0; i < 300 && waves.length < count; i++) {
      const lines = randomLines(spec, rng(seed + attempt * 7919 + i * 31));
      const res = simulate(parseField(lines), solution);
      if (res.outcome !== 'win') continue;
      const moves = res.events.filter((e) => e.t === 'move');
      const lefts = moves.filter((e) => e.kind === 'left').length, rights = moves.filter((e) => e.kind === 'right').length;
      if (lefts + rights < minDodges) continue;
      if (needBoth && (!lefts || !rights)) continue;
      if (waves.some((w) => w.join() === lines.join())) continue;
      waves.push(lines);
    }
    if (waves.length < count) continue;
    const fields = waves.map(parseField);
    const failsSomewhere = (prog, skip = -1) => fields.some((f, i) => i !== skip && simulate(f, prog).outcome !== 'win');
    // Bir dalganın ezberlenmiş hareket dizisi öteki dalgalarda işe yaramamalı.
    const memoFails = fields.every((f, i) => {
      const memo = simulate(f, solution).events.filter((e) => e.t === 'move').map((e) => ({ id: 'm', type: e.kind }));
      return failsSomewhere(memo, i);
    });
    if (memoFails && decoys.every((d) => failsSomewhere(d))) return waves;
  }
  throw new Error(`Dalga üretilemedi (tohum ${seed})`);
}
