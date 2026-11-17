// Blok programı modeli: blok tanımları, kurucu yardımcılar ve ağaç işlemleri.
// Saf mantık; DOM yok. Hem oyun hem testler kullanır.

export const ACTIONS = {
  fwd: { label: 'düz uç', py: 'duz_uc()' },
  left: { label: 'sola kaç', py: 'sola_kac()' },
  right: { label: 'sağa kaç', py: 'saga_kac()' },
  shield: { label: 'kalkan aç', py: 'kalkan_ac()' },
  // Kanatlardan ışın: gemiyi ilerletmez, kendi şeridinde önündeki ilk kayayı parçalar.
  fire: { label: 'ateş et', py: 'ates_et()' },
  setEnergy: { label: 'enerjiyi ayarla', py: 'enerji' },
  addEnergy: { label: 'enerjiyi artır', py: 'enerji' },
  // Sayaç: çocuğun kendi değişkeni. Önce ayarlanır, sonra artırılır; koşullar ona bakabilir.
  setCounter: { label: 'sayacı ayarla', py: 'sayac' },
  addCounter: { label: 'sayacı artır', py: 'sayac' },
};

export const CONDS = {
  ahead: { label: 'önümde meteor var mı?', py: 'onumde_meteor_var()' },
  rightFree: { label: 'sağım boş mu?', py: 'sagim_bos()' },
  leftFree: { label: 'solum boş mu?', py: 'solum_bos()' },
  atBeacon: { label: 'işarete vardım mı?', py: 'isarette_miyim()' },
  aheadAndRightFree: { label: 'meteor var VE sağım boş mu?', py: 'onumde_meteor_var() and sagim_bos()' },
  atBeaconOrAhead: { label: 'işaretteyim VEYA meteor var mı?', py: 'isarette_miyim() or onumde_meteor_var()' },
  atBeaconAndAhead: { label: 'işaretteyim VE meteor var mı?', py: 'isarette_miyim() and onumde_meteor_var()' },
  // Artık hiçbir görevde sunulmuyor; eski kayıtlı programlar açılabilsin diye duruyor.
  aheadOrRightBlocked: { label: 'meteor var VEYA sağım dolu mu?', py: 'onumde_meteor_var() or not sagim_bos()' },
  atEnergy: { label: 'şarjda mıyım?', py: 'sarjda_miyim()' },
  energyLow: { label: 'enerji 3’ten az mı?', py: 'enerji < 3' },
  counter3: { label: 'sayaç 3 oldu mu?', py: 'sayac >= 3' },
};

export const EVENTS = {
  pirate: { label: 'korsan görünce', py: 'korsan_gorunce' },
  beacon: { label: 'işarete varınca', py: 'isarete_varinca' },
  crystal: { label: 'kristal toplayınca', py: 'kristal_toplayinca' },
  energy: { label: 'şarja varınca', py: 'sarja_varinca' },
};

export const FUNCTIONS = {
  zigzag: { label: 'zikzak', py: 'zikzak' },
  straight: { label: 'düz geçiş', py: 'duz_gecis' },
  safe: { label: 'güvenli uçuş', py: 'guvenli_ucus' },
  protect: { label: 'korunma', py: 'korunma' },
  refuel: { label: 'enerji takviyesi', py: 'enerji_takviyesi' },
};

export const CONTAINERS = {
  repeat: ['body'],
  forever: ['body'],
  ifelse: ['then', 'else'],
  until: ['body'],
  on: ['body'],
  define: ['body'],
};

/** Kapsayıcı blokların paletteki adları. */
export const TOOLS = { repeat: 'tekrarla', forever: 'sürekli tekrarla', ifelse: 'eğer / değilse', until: 'olana kadar', on: 'olay olunca', define: 'manevra tanımla', call: 'manevra çağır' };
export const toolLabel = (type) => (ACTIONS[type] ? ACTIONS[type].label : TOOLS[type]);

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
export const until = (cond, ...body) => ({ id: uid(), type: 'until', cond, body });
export const on = (event, ...body) => ({ id: uid(), type: 'on', event, body });
export const shield = () => ({ id: uid(), type: 'shield' });
export const fire = () => ({ id: uid(), type: 'fire' });
export const setEnergy = (value) => ({ id: uid(), type: 'setEnergy', value });
export const addEnergy = (value) => ({ id: uid(), type: 'addEnergy', value });
export const setCounter = (value) => ({ id: uid(), type: 'setCounter', value });
export const addCounter = (value) => ({ id: uid(), type: 'addCounter', value });
export const define = (name, ...body) => ({ id: uid(), type: 'define', name, body });
export const call = (name) => ({ id: uid(), type: 'call', name });
// Parametreli manevra: tanım bir sayı (n) alır, içindeki "tekrarla" o sayıyı kullanabilir (count: 'n');
// çağrı sayıyı verir. Aynı manevra farklı sayılarla çağrılabilir.
export const defineN = (name, ...body) => ({ id: uid(), type: 'define', name, param: true, body });
export const callN = (name, arg) => ({ id: uid(), type: 'call', name, arg });

/** Paletten yeni blok: kapsayıcılar boş gövdeyle gelir. */
export function create(type, defaults = {}) {
  if (type === 'setEnergy' || type === 'addEnergy') return { id: uid(), type, value: 3 };
  if (type === 'setCounter' || type === 'addCounter') return { id: uid(), type, value: type === 'setCounter' ? 0 : 1 };
  if (isAction(type)) return { id: uid(), type };
  if (type === 'repeat') return { id: uid(), type, count: defaults.count || 3, body: [] };
  if (type === 'forever') return { id: uid(), type, body: [] };
  if (type === 'ifelse') return { id: uid(), type, cond: defaults.cond || null, then: [], else: [] };
  if (type === 'until') return { id: uid(), type, cond: defaults.untilCond || defaults.cond || 'atBeacon', body: [] };
  if (type === 'on') return { id: uid(), type, event: defaults.event || 'pirate', body: [] };
  // `params`: bu görevde manevralar sayı alır (bkz. defineN, callN).
  if (type === 'define') return { id: uid(), type, name: defaults.name || 'zigzag', ...(defaults.params ? { param: true } : {}), body: [] };
  if (type === 'call') return { id: uid(), type, name: defaults.name || 'zigzag', ...(defaults.params ? { arg: 2 } : {}) };
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

/** İki blok listesi aynı mı (kimliklere bakmadan)? */
export const sameBlocks = (a, b) => { const strip = (p) => JSON.stringify(p, (k, v) => (k === 'id' ? undefined : v)); return strip(a) === strip(b); };

/** Programda çağrılan ama tanımlanmayan manevralar (kitaplıktan gelmesi gerekenler). */
export function undefinedCalls(program) {
  const defined = new Set(), called = new Set();
  const walk = (list) => { for (const b of list) { if (b.type === 'define') defined.add(b.name); if (b.type === 'call') called.add(b.name); for (const k of CONTAINERS[b.type] || []) walk(b[k] || []); } };
  walk(program);
  return [...called].filter((n) => !defined.has(n));
}

/**
 * Programı Python benzeri satırlara çevirir: [{ text, id }]. `id` satırı üreten bloğun
 * kimliğidir (yoksa null); uçuş sırasında çalışan satırı vurgulamak için kullanılır.
 * @param o.library  kitaplıktaki manevra adları; tanımsız çağrılanlar "import" satırıyla gösterilir
 */
export function pythonLines(program, { library = [] } = {}) {
  const out = [];
  let handlers = 0;
  const push = (text, id = null) => out.push({ text, id });
  const imported = undefinedCalls(program).filter((n) => library.includes(n));
  if (imported.length) { push(`from kitaplik import ${imported.map((n) => FUNCTIONS[n].py).join(', ')}`); push(''); }
  const walk = (list, depth) => {
    const pad = '    '.repeat(depth);
    if (!list.length) { push(`${pad}pass`); return; }
    for (const b of list) {
      if (b.type === 'setEnergy') push(`${pad}enerji = ${b.value}`, b.id);
      else if (b.type === 'addEnergy') push(`${pad}enerji += ${b.value}  # şarj istasyonunda`, b.id);
      else if (b.type === 'setCounter') push(`${pad}sayac = ${b.value}`, b.id);
      else if (b.type === 'addCounter') push(`${pad}sayac += ${b.value}`, b.id);
      else if (isAction(b.type)) push(pad + ACTIONS[b.type].py, b.id);
      else if (b.type === 'repeat') { push(`${pad}for i in range(${b.count}):`, b.id); walk(b.body, depth + 1); }
      else if (b.type === 'forever') { push(`${pad}while True:`, b.id); walk(b.body, depth + 1); }
      else if (b.type === 'until') { push(`${pad}while not (${b.cond ? CONDS[b.cond].py : '...'}):`, b.id); walk(b.body, depth + 1); }
      else if (b.type === 'on') { push(`${pad}@${EVENTS[b.event].py}`); push(`${pad}def olay_${++handlers}():`, b.id); walk(b.body, depth + 1); }
      else if (b.type === 'define') { push(`${pad}def ${FUNCTIONS[b.name].py}(${b.param ? 'n' : ''}):`, b.id); walk(b.body, depth + 1); }
      else if (b.type === 'call') push(`${pad}${FUNCTIONS[b.name].py}(${b.arg ?? ''})`, b.id);
      else if (b.type === 'ifelse') {
        push(`${pad}if ${b.cond ? CONDS[b.cond].py : '...'}:`, b.id); walk(b.then, depth + 1);
        push(`${pad}else:`); walk(b.else, depth + 1);
      }
    }
  };
  if (!program.length) return [{ text: '# program boş', id: null }];
  walk(program, 0);
  return out;
}

/** Programı Python benzeri metne çevirir (salt okunur görünüm için). */
export const toPython = (program, options) => pythonLines(program, options).map((l) => l.text).join('\n');
