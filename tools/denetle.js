#!/usr/bin/env node
// Görev denetçisi: her görevi "kestirme" programlarla dener ve tasarım açıklarını raporlar.
// Örnek çözümün geçmesi yetmez; görevin öğrettiği kavram o görevde gerçekten gerekli mi,
// ona bakar. Elle bulunup düzeltilen açıkların (döngüde kalkan, şarjsız uçuş, tek yöne
// kaçış, gereksiz "olana kadar"...) her yeni görevde kendiliğinden aranması içindir.
//
//   npm run denetle            bütün görevler, yalnızca bulgular
//   npm run denetle -- 7-8     tek görev, bütün denemelerle
//
// Bulgu düzeyleri: HATA (görev bozuk), UYARI (kavram kullanılmadan tam yıldız alınıyor),
// BİLGİ (daha az yıldızla kestirme). Bilerek bırakılan uyarılar KABUL listesindedir.
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../src/content/levels.js';
import { EXTRAS } from '../src/content/extras.js';
import { parseField, simulate, stars } from '../src/engine/world.js';
import { count, clone, CONTAINERS, uid } from '../src/engine/blocks.js';

const MOVES = ['fwd', 'left', 'right'];
const LETTER = { fwd: 'F', left: 'L', right: 'R' };
const mv = (type) => ({ id: uid(), type });
const kids = (b) => (CONTAINERS[b.type] || []).map((k) => b[k]);
const walk = (program, fn) => { for (const b of program) { fn(b); for (const list of kids(b)) walk(list, fn); } };
const typesOf = (program) => { const s = new Set(); walk(program, (b) => s.add(b.type)); return s; };
const some = (program, pred) => { let hit = false; walk(program, (b) => { if (pred(b)) hit = true; }); return hit; };
/** Ağacı kopyalar; `fn(blok)` bir liste döndürürse blok o listeyle değişir (boş liste = sil). */
const rewrite = (program, fn) => program.flatMap((b) => {
  const out = fn(b);
  if (out) return out;
  const c = { ...b };
  for (const k of CONTAINERS[b.type] || []) c[k] = rewrite(b[k], fn);
  return [c];
});

const fly = (level, program, options) => level.waves.map((w) => simulate(parseField(w), program, options));
const wins = (results) => results.every((r) => r.outcome === 'win');
const grade = (level, program) => {
  const n = count(program), results = fly(level, program);
  return { n, fits: n <= level.maxBlocks, stars: stars(results, n, level.par), wins: wins(results) };
};
const pathOf = (field, program) => simulate(field, program).events.filter((e) => e.t === 'move').map((e) => e.kind);

/** Hareket dizisini en az blokla yazar: tek tek, "tekrarla" ile ya da sonu "sürekli tekrarla" ile. */
export function shortest(moves, tools) {
  const n = moves.length, best = Array(n + 1).fill(null);
  best[n] = { cost: 0, program: [] };
  const periodic = (i, p, upTo) => { for (let j = i + p; j < upTo; j++) if (moves[j] !== moves[j - p]) return false; return true; };
  for (let i = n - 1; i >= 0; i--) {
    let pick = { cost: 1 + best[i + 1].cost, program: [mv(moves[i]), ...best[i + 1].program] };
    for (let p = 1; p <= 4 && i + p <= n; p++) {
      const body = () => moves.slice(i, i + p).map(mv);
      if (tools.includes('forever') && periodic(i, p, n) && 1 + p < pick.cost) pick = { cost: 1 + p, program: [{ id: uid(), type: 'forever', body: body() }] };
      if (!tools.includes('repeat')) continue;
      for (let k = 2; k <= 9 && i + p * k <= n && periodic(i, p, i + p * k); k++) {
        const cost = 1 + p + best[i + p * k].cost;
        if (cost < pick.cost) pick = { cost, program: [{ id: uid(), type: 'repeat', count: k, body: body() }, ...best[i + p * k].program] };
      }
    }
    best[i] = pick;
  }
  return best[0].program;
}

const isSteer = (b) => b.type === 'ifelse' && b.cond === 'ahead' && b.then[0]?.type === 'ifelse';
const IF = (cond, a, b) => ({ id: uid(), type: 'ifelse', cond, then: a, else: b });
const oneSided = (type) => () => [IF('ahead', [mv(type)], [mv('fwd')])];
const mirrored = () => [IF('ahead', [IF('leftFree', [mv('left')], [mv('right')])], [mv('fwd')])];

/** Fonksiyon çağrılarını gövdeleriyle değiştirir, tanımları siler. */
function inline(program) {
  const defs = new Map();
  walk(program, (b) => { if (b.type === 'define') defs.set(b.name, b); });
  // Sayı alan manevra açılırken döngülerindeki "n" yerine çağrıdaki sayı yazılır.
  const bind = (list, n) => rewrite(list, (b) => (b.type === 'repeat' && b.count === 'n' ? [{ ...b, count: n, body: bind(b.body, n) }] : null));
  const expand = (list, depth) => rewrite(list, (b) => {
    if (b.type === 'define') return [];
    if (b.type !== 'call') return null;
    const d = defs.get(b.name);
    return depth > 4 || !d ? [] : expand(d.param ? bind(clone(d.body), b.arg) : clone(d.body), depth + 1);
  });
  return expand(program, 0);
}

/** Olay bloklarını kaldırır; içlerindeki komutları ilk uçuş döngüsünün başına koyar ("her adımda yap"). */
function polled(program) {
  const bodies = [];
  const rest = rewrite(program, (b) => { if (b.type === 'on') { if (!some(b.body, (x) => MOVES.includes(x.type))) bodies.push(...b.body); return []; } return null; });
  if (!bodies.length) return null;
  let done = false;
  return rewrite(rest, (b) => {
    if (done || !['forever', 'until'].includes(b.type)) return null;
    done = true;
    return [{ ...b, body: [...clone(bodies), ...b.body] }];
  });
}

/** "Hata avı" görevinde hazır programı tek dokunuşla düzelten değişiklikler. */
function singleFixes(level) {
  const base = level.initial(), fixes = [];
  const ids = []; walk(base, (b) => ids.push(b.id));
  const variant = (id, change) => rewrite(clone0(base), (b) => (b.id === id ? change(b) : null));
  const clone0 = (p) => JSON.parse(JSON.stringify(p));
  const tryIt = (label, program) => { if (grade(level, program).stars > 0) fixes.push(label); };
  walk(base, (b) => {
    if (b.cond) for (const c of level.conds) if (c !== b.cond) tryIt(`koşul → ${c}`, variant(b.id, (x) => [{ ...x, cond: c }]));
    if (b.type === 'on') for (const e of level.events || []) if (e !== b.event) tryIt(`olay → ${e}`, variant(b.id, (x) => [{ ...x, event: e }]));
    if (b.type === 'call' || b.type === 'define') for (const f of level.functions || []) if (f !== b.name) tryIt(`${b.type === 'call' ? 'çağrı' : 'tanım'} adı → ${f}`, variant(b.id, (x) => [{ ...x, name: f }]));
    if (typeof b.value === 'number') for (let v = 0; v <= 9; v++) if (v !== b.value) tryIt(`değer ${b.value} → ${v}`, variant(b.id, (x) => [{ ...x, value: v }]));
    if (typeof b.count === 'number') for (let v = 2; v <= 9; v++) if (v !== b.count) tryIt(`tekrar ${b.count} → ${v}`, variant(b.id, (x) => [{ ...x, count: v }]));
    if (MOVES.includes(b.type)) for (const t of MOVES) if (t !== b.type) tryIt(`${LETTER[b.type]} → ${LETTER[t]}`, variant(b.id, (x) => [{ ...x, type: t }]));
  });
  // yan yana iki bloğun yerini değiştirmek
  const swapIn = (list, path) => {
    for (let i = 0; i + 1 < list.length; i++) {
      const copy = clone0(base); let l = copy;
      for (const [idx, key] of path) l = l[idx][key];
      [l[i], l[i + 1]] = [l[i + 1], l[i]];
      tryIt('iki bloğun sırası', copy);
    }
    list.forEach((b, i) => { for (const k of CONTAINERS[b.type] || []) swapIn(b[k], [...path, [i, k]]); });
  };
  swapIn(base, []);
  // eksik tek blok eklemek (tanış / dene görevleri için)
  for (const t of level.tools) {
    if (CONTAINERS[t]) continue;
    const block = () => (t === 'setEnergy' || t === 'addEnergy' ? { id: uid(), type: t, value: 3 } : t === 'call' ? { id: uid(), type: t, name: (level.functions || [])[0] } : mv(t));
    const addIn = (list, path) => {
      for (let i = 0; i <= list.length; i++) {
        const copy = clone0(base); let l = copy;
        for (const [idx, key] of path) l = l[idx][key];
        l.splice(i, 0, block());
        tryIt(`+ ${t}`, copy);
      }
      list.forEach((b, i) => { for (const k of CONTAINERS[b.type] || []) addIn(b[k], [...path, [i, k]]); });
    };
    addIn(base, []);
  }
  return [...new Set(fixes)];
}

/** Bir görevin bulguları: [{ duzey: 'HATA' | 'UYARI' | 'BİLGİ', kod, metin }] */
export function audit(level) {
  const out = [], add = (duzey, kod, metin) => out.push({ duzey, kod, metin });
  if (level.tahmin) return out;   // tahmin turunda çocuk program yazmaz; soruları tests/predict.test.js doğrular
  const sol = level.solution(), types = typesOf(sol), concept = [...types].filter((t) => !MOVES.includes(t));
  const fields = level.waves.map(parseField);
  const short = (g) => `${g.n} blok, ${g.stars} yıldız`;

  const official = grade(level, sol);
  if (official.stars !== 3) add('HATA', 'cozum', `örnek çözüm 3 yıldız almıyor (${short(official)})`);
  if (level.initial && !level.watch && grade(level, level.initial()).stars > 0) add('HATA', 'baslangic', 'hazır program zaten geçiyor');

  // Ezber: bir dalganın hareket dizisi öteki dalgaları da geçiyor mu?
  if (fields.length > 1) {
    fields.forEach((f, i) => {
      const memo = pathOf(f, sol).map(mv);
      if (fields.every((o) => simulate(o, memo).outcome === 'win')) add('UYARI', 'ezber', `${i + 1}. dalganın ezberi bütün dalgaları geçiyor`);
    });
  } else if (concept.length) {
    // Tek dalga: rotayı elle (en çok sayılı döngüyle) yazmak sınıra sığıyor mu?
    const plain = shortest(pathOf(fields[0], sol), level.tools.filter((t) => t === 'repeat' || t === 'forever')), g = grade(level, plain);
    const skipped = concept.filter((t) => !typesOf(plain).has(t));
    if (g.fits && g.wins && skipped.length) add(g.stars === 3 ? 'UYARI' : 'BİLGİ', 'elle', `rota elle yazılabiliyor (${short(g)}); kullanılmayan: ${skipped.join(', ')}`);
  }

  // Budama: örnek çözümden bir blok çıkarılınca (ya da kabı açılınca) hâlâ tam yıldız mı?
  const pruned = new Set();
  walk(sol, (b) => {
    const variants = [['sil', []], ...(CONTAINERS[b.type] || []).map((k) => [`aç:${k}`, b[k]])];
    for (const [how, repl] of variants) {
      if (how !== 'sil' && !repl.length) continue;
      const g = grade(level, rewrite(sol, (x) => (x.id === b.id ? clone(repl) : null)));
      if (g.stars === 3) pruned.add(`${b.type}${how === 'sil' ? '' : ' kabı'}`);
    }
  });
  if (pruned.size) add('UYARI', 'budama', `örnek çözümde gereksiz: ${[...pruned].join(', ')}`);

  // "Olana kadar" gerçekten bir şeyi bitiriyor mu? Yerine "sürekli tekrarla" konup sonrası atılınca da tam yıldızsa hayır.
  sol.forEach((b, i) => {
    if (b.type !== 'until' || !level.tools.includes('forever')) return;
    const g = grade(level, [...clone(sol.slice(0, i)), { id: uid(), type: 'forever', body: clone(b.body) }]);
    if (g.stars === 3) add('UYARI', 'surekli', `"olana kadar" yerine "sürekli tekrarla" yetiyor (${short(g)})`);
  });

  if (some(sol, isSteer)) {
    for (const [type, name] of [['left', 'sola'], ['right', 'sağa']]) {
      const g = grade(level, rewrite(sol, (b) => (isSteer(b) ? oneSided(type)() : null)));
      if (g.wins) add(g.stars === 3 ? 'UYARI' : 'BİLGİ', 'tek-yon', `yalnız ${name} kaçmak yetiyor (${short(g)})`);
    }
    const g = grade(level, rewrite(sol, (b) => (isSteer(b) ? mirrored() : null)));
    if (level.conds.includes('leftFree') && g.stars !== 3) add('UYARI', 'ayna', `önce sola bakan ayna mantık tam yıldız almıyor (${short(g)})`);
  }

  if (types.has('on')) {
    const p = polled(sol);
    if (p) { const g = grade(level, p); if (g.wins) add(g.stars === 3 ? 'UYARI' : 'BİLGİ', 'olaysiz', `olay yerine döngüde yapmak yetiyor (${short(g)})`); }
  }
  if (types.has('call')) {
    const g = grade(level, inline(sol));
    if (g.fits && g.wins) add(g.stars === 3 ? 'UYARI' : 'BİLGİ', 'fonksiyonsuz', `fonksiyonsuz yazım sığıyor (${short(g)})`);
  }
  if (types.has('addEnergy')) {
    const g = grade(level, rewrite(sol, (b) => (b.type === 'addEnergy' ? [] : b.type === 'setEnergy' ? [{ ...b, value: 9 }] : null)));
    if (g.wins) add('UYARI', 'sarjsiz', `9 enerjiyle hiç şarj etmeden bitiyor (${short(g)})`);
  }
  if (level.initial && !level.watch && ['hata', 'tanis', 'dene'].includes(level.kind)) {
    const fixes = singleFixes(level);
    if (level.kind === 'hata' && !fixes.length) add('UYARI', 'duzeltme', 'hazır program tek değişiklikle düzelmiyor');
    if (level.kind === 'hata' && fixes.length) add('AYRINTI', 'duzeltme', `tek değişiklikle düzeltmeler: ${fixes.join(' | ')}`);
  }
  return out;
}

/** Bilerek bırakılan uyarılar: "görev:kod" → neden. Buraya eklenmeyen her uyarı testleri kırar. */
export const KABUL = {
  // Kısa gövdeli fonksiyon programı kısaltmaz; bu görevler tanımla-çağır alıştırmasıdır.
  '7-1:fonksiyonsuz': 'tanış: zikzak tanımı hazır geliyor', '7-2:fonksiyonsuz': 'dene: tanım hazır geliyor',
  '7-3:fonksiyonsuz': 'dene: iki tanım hazır geliyor', '7-7:fonksiyonsuz': 'hata avı: tanım hazır geliyor',
  '7-4:fonksiyonsuz': 'tek çağrı yeri: fonksiyon alıştırması', '7-5:fonksiyonsuz': 'iki blokluk gövde',
  '7-6:fonksiyonsuz': 'olay fonksiyon çağırır alıştırması', '8-2:fonksiyonsuz': 'dene: tanımın içi doldurulur',
  '8-5:fonksiyonsuz': 'olay fonksiyon çağırır alıştırması', '8-6:fonksiyonsuz': 'iki fonksiyon alıştırması',
  '8-7:fonksiyonsuz': 'hata avı: program hazır geliyor', '8-8:fonksiyonsuz': 'final: fonksiyonlar istenir, zorlanmaz',
  // "Olana kadar"dan sonra düz uçuş, karar ağacını sürdürmekle aynı sonucu verir; yanlış değil.
  '4-3:surekli': 'halkadan sonra yol düz', '4-6:surekli': 'halkadan sonra yol düz', '4-8:surekli': 'halkadan sonra yol düz', '5-8:surekli': 'halkadan sonra yol düz',
  '8-1:surekli': 'halkadan sonra yol düz', '8-4:surekli': 'halkadan sonra yol düz',
  '6-4:budama': 'şarjdan sonra uçmak iki biçimde yazılabilir; görev metni uzun olanı anlatır',
  // Hazır programı silip rotayı elle yazmak da geçer; bu görevlerde kavram hazır programla gösterilir.
  '4-1:elle': 'tanış: olana kadar hazır geliyor', '7-1:elle': 'tanış: tanım hazır geliyor', '7-2:elle': 'dene: tanım hazır geliyor',
  '7-3:elle': 'dene: iki tanım hazır geliyor', '7-7:elle': 'hata avı: tanım hazır geliyor',
};

export function auditAll(levels = [...LEVELS, ...EXTRAS]) {
  return levels.map((level) => ({ level, findings: audit(level) }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const only = process.argv[2], rows = auditAll().filter((r) => !only || r.level.id === only);
  let errors = 0, fresh = 0, known = 0;
  for (const { level, findings } of rows) {
    const shown = findings.filter((f) => only || f.duzey !== 'AYRINTI');
    for (const f of shown) {
      const accepted = f.duzey === 'UYARI' && KABUL[`${level.id}:${f.kod}`];
      if (f.duzey === 'HATA') errors++; else if (f.duzey === 'UYARI') { if (accepted) known++; else fresh++; }
      if (accepted && !only) continue;
      console.log(`${level.id.padEnd(5)} ${(accepted ? 'kabul' : f.duzey).padEnd(7)} ${f.kod.padEnd(13)} ${f.metin}${accepted ? `  (${accepted})` : ''}`);
    }
  }
  console.log(`\n${rows.length} görev denetlendi: ${errors} hata, ${fresh} yeni uyarı, ${known} kabul edilmiş uyarı.`);
  process.exit(errors || fresh ? 1 : 0);
}
