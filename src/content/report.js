// Veli raporu: kayıttan, çocuğun nereye vardığını, ne kadar uğraştığını ve nerede takıldığını
// çıkarır. Ekrandan bağımsızdır; veli paneli bunu gösterir. Saf mantık; DOM yok.
import { LEVELS, SECTORS, levelsOf } from './levels.js';
import { ALL_LEVELS } from './extras.js';

/** Başarısızlık nedenlerinin veliye söylenen adları. */
export const REASON_LABEL = {
  meteor: 'meteora çarpma', wall: 'şeridin dışına çıkma', pirate: 'korsana yakalanma', energy: 'enerjinin bitmesi',
  overflow: 'deponun taşması', station: 'istasyon dışında şarj', shield: 'kalkanı gereksiz açma', ended: 'programın erken bitmesi',
  idle: 'geminin komutsuz kalması', limit: 'bitmeyen döngü', nocond: 'koşulu boş bırakma', function: 'tanımlanmamış manevra',
  definition: 'aynı manevrayı iki kez tanımlama', counter: 'sayacı ayarlamadan artırma', param: 'manevraya sayı vermeme', tahmin: 'yanlış tahmin',
};
/** Sık görülen hata için veliye öneri. */
const REASON_TIP = {
  meteor: 'En sık meteora çarpıyor. Birlikte **adım** düğmesiyle tek tek ilerleyip "şimdi önünde ne var?" diye sorun; sensör bloklarının cevabını sesli okuyun.',
  wall: 'Gemi sık sık şeridin dışına çıkıyor. Kaçış bloklarının gemiyi hem yana hem ileri taşıdığını, kenardayken o yöne kaçılamayacağını birlikte deneyin.',
  pirate: 'Korsanlara yakalanıyor. Kalkanın tek saldırıyı durdurduğunu ve **olay** bloğunun onu her korsanda yeniden açtığını konuşun.',
  energy: 'Enerji sık bitiyor. Uçuş sırasında alttaki enerji göstergesini birlikte izleyin: her adımda bir azaldığını görmek değişken fikrini oturtur.',
  ended: 'Program çoğu kez çıkışa varmadan bitiyor. "Kaç adım gerekiyor, programın kaç adım atıyor?" diye sayın; döngülerde **sürekli tekrarla** işe yarar.',
  overflow: 'Depo sık taşıyor. "Ne zaman şarj etmeli?" sorusu koşulların konusu: yalnızca enerji azaldığında şarj etmeyi birlikte kurun.',
};
const dayKey = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };

/**
 * @param src.stars(id)      görevin yıldızı
 * @param src.tries          görev → { n, fails, streak, ms, reasons } (storage.allTries)
 * @param src.isSkipped(id)  sonraya bırakıldı mı
 * @param src.log            kaptan günlüğü kayıtları
 * @param src.dailyDays      geçilen günün dalgası sayısı
 */
export function buildReport({ stars, tries = {}, isSkipped = () => false, log = [], dailyDays = 0 }, now = Date.now()) {
  const won = (l) => stars(l.id) > 0 || (!!l.alt && stars(l.alt) > 0);
  const t = (id) => tries[id] || { n: 0, fails: 0, streak: 0, ms: 0, reasons: {} };
  const minutes = (ms) => Math.round(ms / 60000);

  const sectors = SECTORS.map((s) => {
    const levels = levelsOf(s.id), passed = levels.filter(won);
    const got = levels.reduce((a, l) => a + stars(l.id), 0), fails = levels.reduce((a, l) => a + t(l.id).fails, 0);
    const ms = ALL_LEVELS.filter((l) => l.sector === s.id).reduce((a, l) => a + t(l.id).ms, 0);
    const perMission = passed.length ? passed.reduce((a, l) => a + t(l.id).fails, 0) / passed.length : 0;
    return {
      id: s.id, name: s.name, concept: s.concept, passed: passed.length, missions: levels.length, stars: got, maxStars: levels.length * 3, fails, minutes: minutes(ms),
      state: passed.length === levels.length ? 'tamam' : passed.length || fails ? 'suruyor' : 'yok',
      // Geçtiği görev başına ortalama başarısız deneme: kavramın ne kadar uğraştırdığı.
      ease: !passed.length ? null : perMission <= 1.5 ? 'rahat' : perMission <= 4 ? 'ugrasti' : 'zorlandi',
    };
  });

  // Takıldığı görevler: henüz geçemediği ve en az üç kez denediği ya da sonraya bıraktığı görevler.
  const stuck = ALL_LEVELS.filter((l) => !won(l) && !stars(l.id) && (t(l.id).fails >= 3 || isSkipped(l.id)))
    .map((l) => ({ id: l.id, title: l.title, sector: l.sector, fails: t(l.id).fails, skipped: isSkipped(l.id) }))
    .sort((a, b) => b.fails - a.fails).slice(0, 5);

  const tally = {};
  for (const rec of Object.values(tries)) for (const [reason, n] of Object.entries(rec.reasons || {})) tally[reason] = (tally[reason] || 0) + n;
  const reasons = Object.entries(tally).filter(([r]) => REASON_LABEL[r]).map(([reason, count]) => ({ reason, label: REASON_LABEL[reason], count })).sort((a, b) => b.count - a.count).slice(0, 4);

  const days = new Set(log.map((e) => dayKey(e.t))), last = log.length ? Math.max(...log.map((e) => e.t)) : null;
  const totals = {
    stars: ALL_LEVELS.reduce((a, l) => a + stars(l.id), 0), maxStars: ALL_LEVELS.length * 3,
    passed: LEVELS.filter(won).length, missions: LEVELS.length,
    sectors: sectors.filter((s) => s.state === 'tamam').length,
    minutes: minutes(Object.values(tries).reduce((a, r) => a + (r.ms || 0), 0)),
    attempts: Object.values(tries).reduce((a, r) => a + (r.n || 0), 0),
    days: days.size, daily: dailyDays,
    idleDays: last === null ? null : Math.floor((now - last) / 86400000),
  };

  const tips = [];
  if (stuck.length) {
    const s = stuck[0];
    tips.push(`**${s.title}** (${s.id}) görevinde ${s.skipped && s.fails < 3 ? 'takıldı ve sonraya bıraktı' : `${s.fails} kez denedi, henüz geçemedi`}. Cevabı söylemek yerine birlikte **adım** düğmesiyle programı tek tek çalıştırıp "gemi burada neden böyle yaptı?" diye sorun; oyundaki **İpucu** düğmesi de basamak basamak yardım eder.`);
  }
  if (reasons.length && REASON_TIP[reasons[0].reason] && reasons[0].count >= 5) tips.push(REASON_TIP[reasons[0].reason]);
  const hard = sectors.find((s) => s.ease === 'zorlandi');
  if (hard) tips.push(`**${hard.name}** (${hard.concept}) onu en çok uğraştıran sektör oldu. Bu kavramı gündelik hayatla bağlamak işe yarar; sektörün **tahmin turu** kod okuma alıştırması yaptırır.`);
  if (totals.idleDays !== null && totals.idleDays >= 7) tips.push(`Son oynayışının üzerinden ${totals.idleDays} gün geçti. Kısa ve sık oturumlar (15–20 dakika) uzun aralıklı uzun oturumlardan daha iyi öğretir; **Günün Dalgası** her gün yeni, kısa bir görev sunar.`);
  if (totals.passed === totals.missions) tips.push('Bütün ana görevleri bitirdi! **Atölye**de kendi görevlerini kurup sizinle paylaşabilir; eksik yıldızlar ve gizli görevler de onu bekliyor.');
  if (!tips.length) tips.push(totals.passed ? 'Düzenli ilerliyor; takıldığı bir yer görünmüyor. Ara sıra "bu program ne yapıyor, bana anlatır mısın?" diye sormak öğrendiklerini pekiştirir.' : 'Henüz başlamamış. İlk sektör birkaç dakikada biter; ilk görevleri birlikte oynamak iyi bir başlangıç olur.');

  return { totals, sectors, stuck, reasons, tips };
}
