/* İlerleme kaydı: yıldızlar, günlük seri, kategori istatistikleri, sayı hafızası rekorları */
(function (root) {
  'use strict';
  const Bilsem = root.Bilsem = root.Bilsem || {};
  const KEY = 'bilsem.v3';
  const OLD_KEYS = ['bilsem.v2', 'zekakasifi.v1'];     // kademeler değişmeden önceki kayıtlar

  const spanBlank = () => ({ plays: 0, best: { 1: { both: 0, fwd: 0, bwd: 0 }, 2: { both: 0, fwd: 0, bwd: 0 }, 3: { both: 0, fwd: 0, bwd: 0 } } });
  function blank() {
    return { v: 3, settings: { sound: true, len: 10, spanStart: 3, spanLevel: 1, spanTypeTimed: true }, cats: {}, days: {}, exams: [], span: spanBlank() };
  }

  /* Sayı hafızası kaydını bugünkü biçime getirir: rekorlar düzeye göre tutulur ve en çok MAX basamaktır.
     Düzeyler gelmeden önceki rekorlar (yazma süresi sınırsızdı) Kolay düzeye yazılır. */
  function normalizeSpan(sp, max) {
    const out = spanBlank(), cap = (v) => Math.max(0, Math.min(max, v || 0));
    if (!sp) return out;
    out.plays = sp.plays || 0;
    if (sp.best) {
      [1, 2, 3].forEach((l) => ['both', 'fwd', 'bwd'].forEach((m) => { out.best[l][m] = cap(sp.best[l] && sp.best[l][m]); }));
    } else ['both', 'fwd', 'bwd'].forEach((m) => { out.best[1][m] = cap(sp[m]); });
    return out;
  }

  /* Eski kayıtları bugünkü dört kademeye taşır (1 Kolay, 2 Orta, 3 Zor, 4 En Zor).
     v1 (ilk sürüm: kolay, orta, zor): eski orta = 1. kademe, eski zor = 2. kademe; eski kolayın karşılığı yok.
     v2 (üç kademe): her kademe bir yukarı kayar; altına yeni 1. kademe eklenir.
     Hiç çözülmemiş konular 1. kademeden başlar. */
  function migrate(d) {
    if (!d || (d.v !== 1 && d.v !== 2)) return d;
    Object.keys(d.cats || {}).forEach((k) => {
      const c = d.cats[k], st = c.stars || [0, 0, 0], sk = c.skill || 1;
      if (d.v === 1) { c.stars = [st[1] || 0, st[2] || 0, 0, 0]; c.skill = sk - 1; }
      else { c.stars = [0, st[0] || 0, st[1] || 0, st[2] || 0]; c.skill = sk + 1; }
      c.skill = c.seen ? Math.max(1, Math.min(4.9, Math.round(c.skill * 100) / 100)) : 1;
    });
    d.v = 3;
    return d;
  }

  function dayKey(d) {
    d = d || new Date();
    const p = (n) => (n < 10 ? '0' : '') + n;
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function addDays(key, n) {
    const p = key.split('-').map(Number);
    return dayKey(new Date(p[0], p[1] - 1, p[2] + n));
  }

  /* 10 soruda 9+ doğru: 3 yıldız, 7+: 2 yıldız, 5+: 1 yıldız */
  function starsFor(correct, total) {
    if (!total) return 0;
    const r = correct / total;
    return r >= 0.9 ? 3 : r >= 0.7 ? 2 : r >= 0.5 ? 1 : 0;
  }

  /* Beceri puanı 1 ile 4.9 arasında gezer; tam kısmı önerilen kademedir. */
  function nextSkill(skill, level, ok) {
    const cur = Math.floor(skill);
    const d = ok ? (level >= cur ? 0.15 : 0.05) : (level <= cur ? -0.2 : -0.05);
    return Math.max(1, Math.min(4.9, Math.round((skill + d) * 100) / 100));
  }

  /* Bugün (ya da bugün henüz oynanmadıysa dün) biten kesintisiz gün sayısı */
  function streak(days, today) {
    let k = today;
    if (!(days[k] && days[k].n > 0)) k = addDays(k, -1);
    let n = 0;
    while (days[k] && days[k].n > 0) { n++; k = addDays(k, -1); }
    return n;
  }

  const Store = {
    data: blank(),
    load() {
      try {
        const ls = root.localStorage;
        const raw = ls && [KEY].concat(OLD_KEYS).map((k) => ls.getItem(k)).find(Boolean);
        if (raw) {
          const d = migrate(JSON.parse(raw)), b = blank();
          if (d && d.v === 3) {
            const Sp = Bilsem.Span;
            this.data = Object.assign(b, d, { settings: Object.assign(b.settings, d.settings), span: normalizeSpan(d.span, Sp.MAX) });
            const set = this.data.settings;
            set.spanStart = Math.max(Sp.MIN, Math.min(Sp.MAX, set.spanStart));
            set.spanLevel = Sp.levelOf(set.spanLevel).id;
            set.spanTypeTimed = set.spanTypeTimed !== false;
          }
        }
      } catch (e) { /* kayıt okunamadıysa boş başla */ }
      return this.data;
    },
    save() {
      try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* kayıt kapalı olabilir */ }
    },
    reset() {
      const s = this.data.settings;
      this.data = blank();
      this.data.settings = s;
      try { OLD_KEYS.forEach((k) => root.localStorage && root.localStorage.removeItem(k)); } catch (e) { /* önemli değil */ }
      this.save();
    },
    cat(id) {
      const c = this.data.cats;
      if (!c[id]) c[id] = { stars: [0, 0, 0, 0], seen: 0, ok: 0, ms: 0, recent: [], skill: 1 };
      return c[id];
    },
    day(key) {
      const d = this.data.days;
      key = key || dayKey();
      if (!d[key]) d[key] = { n: 0, ok: 0, daily: false };
      return d[key];
    },
    recordAnswer(id, level, ok, ms) {
      const c = this.cat(id);
      c.seen++;
      if (ok) c.ok++;
      c.ms += Math.max(0, Math.min(ms || 0, 120000));
      c.recent.push(ok ? 1 : 0);
      if (c.recent.length > 20) c.recent.shift();
      c.skill = nextSkill(c.skill, level, ok);
      const d = this.day();
      d.n++;
      if (ok) d.ok++;
    },
    setStars(id, level, stars) {
      const c = this.cat(id);
      if (stars > c.stars[level - 1]) c.stars[level - 1] = stars;
    },
    workLevel(id) { return Math.max(1, Math.min(4, Math.floor(this.cat(id).skill))); },
    /* Toplam yıldız: kategori yıldızları + her günün görevinden kazanılan en iyi yıldız */
    totalStars() {
      let n = 0;
      Object.keys(this.data.cats).forEach((k) => { this.data.cats[k].stars.forEach((s) => { n += s; }); });
      Object.keys(this.data.days).forEach((k) => { n += this.data.days[k].stars || 0; });
      return n;
    },
    finishDaily(stars) {
      const d = this.day();
      d.daily = true;
      d.stars = Math.max(d.stars || 0, stars);
    },
    streak() { return streak(this.data.days, dayKey()); },
    dailyDone() { const d = this.data.days[dayKey()]; return !!(d && d.daily); },
    addExam(sum) {
      this.data.exams.push(sum);
      if (this.data.exams.length > 30) this.data.exams.shift();
    },
    /* Sayı Hafızası: her sayı denemesi günlük çalışmaya sayılır; rekor, ulaşılan en uzun basamak sayısıdır. */
    spanTrial(ok) {
      const d = this.day();
      d.n++;
      if (ok) d.ok++;
    },
    spanBest(level, mode, best) {
      const r = this.data.span.best[level];
      if (best > r[mode]) { r[mode] = best; return true; }
      return false;
    },
    spanPlayed() { this.data.span.plays++; },
    /* Günün görevi: az çalışılan ve zorlanılan kategoriler daha sık gelir. */
    dailyPlan(rng, n) {
      const pool = Bilsem.CATS.map((c) => {
        const s = this.cat(c.id);
        const recent = s.recent.slice(-10);
        const acc = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0.5;
        return { id: c.id, w: 1 + (1 - acc) * 2 + (s.seen < 5 ? 1 : 0) };
      });
      const plan = [];
      while (plan.length < n && pool.length) {
        let r = rng.next() * pool.reduce((a, p) => a + p.w, 0), i = 0;
        while (i < pool.length - 1 && r >= pool[i].w) { r -= pool[i].w; i++; }
        const p = pool.splice(i, 1)[0];
        plan.push({ type: p.id, level: this.workLevel(p.id) });
      }
      return plan;
    },
  };

  Bilsem.Store = Store;
  Bilsem.StoreUtil = { dayKey: dayKey, addDays: addDays, starsFor: starsFor, nextSkill: nextSkill, streak: streak, migrate: migrate, blank: blank, normalizeSpan: normalizeSpan };

  if (typeof module !== 'undefined') module.exports = Bilsem;
})(typeof window !== 'undefined' ? window : globalThis);
