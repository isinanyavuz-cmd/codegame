// Blok programı modeli: blok tanımları, kurucu yardımcılar ve ağaç işlemleri.
// Saf mantık; DOM yok. Hem oyun hem testler kullanır.

export const ACTIONS = {
  fwd: { label: 'düz uç', py: 'duz_uc()' },
  left: { label: 'sola kaç', py: 'sola_kac()' },
  right: { label: 'sağa kaç', py: 'saga_kac()' },
};

export const CONDS = {
  ahead: { label: 'önümde meteor var mı?', py: 'onumde_meteor_var()' },
  rightFree: { label: 'sağım boş mu?', py: 'sagim_bos()' },
  leftFree: { label: 'solum boş mu?', py: 'solum_bos()' },
};

export const CONTAINERS = {
  repeat: ['body'],
  forever: ['body'],
  ifelse: ['then', 'else'],
};

export const isAction = (type) => type in ACTIONS;
export const isCond = (type) => type in CONDS;

let counter = 0;
export const uid = () => `b${++counter}`;

// ---- kurucular (bölüm içerikleri ve testler için) ----
export const F = () => ({ id: uid(), type: 'fwd' });
export const L = () => ({ id: uid(), type: 'left' });
export const R = () => ({ id: uid(), type: 'right' });
export const rep = (count, ...body) => ({ id: uid(), type: 'repeat', count, body });
export const forever = (...body) => ({ id: uid(), type: 'forever', body });
export const ifelse = (cond, thenList = [], elseList = []) => ({ id: uid(), type: 'ifelse', cond, then: thenList, else: elseList });

/** Paletten yeni blok: kapsayıcılar boş gövdeyle gelir. */
export function create(type, defaults = {}) {
  if (isAction(type)) return { id: uid(), type };
  if (type === 'repeat') return { id: uid(), type, count: defaults.count || 3, body: [] };
  if (type === 'forever') return { id: uid(), type, body: [] };
  if (type === 'ifelse') return { id: uid(), type, cond: defaults.cond || null, then: [], else: [] };
  throw new Error(`Bilinmeyen blok: ${type}`);
}

/** Derin kopya; her bloğa yeni kimlik verir. */
export function clone(program) {
  return program.map((b) => {
    const c = { ...b, id: uid() };
    for (const key of CONTAINERS[b.type] || []) c[key] = clone(b[key] || []);
    return c;
  });
}

/** Toplam blok sayısı: kapsayıcı 1 sayılır, içindekiler ayrıca. */
export function count(program) {
  let n = 0;
  for (const b of program) {
    n += 1;
    for (const key of CONTAINERS[b.type] || []) n += count(b[key] || []);
  }
  return n;
}

/** Bloğu ve içinde durduğu listeyi bulur. */
export function find(program, id) {
  for (let i = 0; i < program.length; i++) {
    const b = program[i];
    if (b.id === id) return { block: b, list: program, index: i };
    for (const key of CONTAINERS[b.type] || []) {
      const hit = find(b[key], id);
      if (hit) return hit;
    }
  }
  return null;
}

/** Bloğu ağaçtan çıkarır ve döndürür (yoksa null). */
export function remove(program, id) {
  const hit = find(program, id);
  if (!hit) return null;
  hit.list.splice(hit.index, 1);
  return hit.block;
}

/** Hedef listeyi döndürür: parentId null ise en üst düzey. */
export function listOf(program, parentId, key) {
  if (!parentId) return program;
  const hit = find(program, parentId);
  return hit ? hit.block[key] : null;
}

/** Programı Python benzeri metne çevirir (salt okunur görünüm için). */
export function toPython(program) {
  const out = [];
  const walk = (list, depth) => {
    const pad = '    '.repeat(depth);
    if (!list.length) { out.push(`${pad}pass`); return; }
    for (const b of list) {
      if (isAction(b.type)) out.push(pad + ACTIONS[b.type].py);
      else if (b.type === 'repeat') { out.push(`${pad}for i in range(${b.count}):`); walk(b.body, depth + 1); }
      else if (b.type === 'forever') { out.push(`${pad}while True:`); walk(b.body, depth + 1); }
      else if (b.type === 'ifelse') {
        out.push(`${pad}if ${b.cond ? CONDS[b.cond].py : '...'}:`); walk(b.then, depth + 1);
        out.push(`${pad}else:`); walk(b.else, depth + 1);
      }
    }
  };
  if (!program.length) return '# program boş';
  walk(program, 0);
  return out.join('\n');
}
