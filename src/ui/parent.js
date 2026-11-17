// Veli paneli: çocuğun ilerlemesinin raporu, ilerlemeyi başka cihaza aktarma ve sıfırlama.
// Şifreyle açılır; şifre yalnızca çocuğun kaydı kazara silmesini önlemek içindir, gerçek bir
// güvenlik önlemi değildir (BİLSEM uygulamasıyla aynı şifre).
import { buildReport } from '../content/report.js';
import { showCard, hideCard, makeCard } from './overlay.js';

export const PARENT_PIN = '321321';
const svg = (id, cls = '') => `<svg viewBox="0 0 32 32" class="${cls}"><use href="#${id}"/></svg>`;
const rich = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const STATE = { yok: 'başlamadı', suruyor: 'sürüyor', tamam: 'tamamlandı' };
const EASE = { rahat: 'rahat geçti', ugrasti: 'uğraştırdı', zorlandi: 'zorlandı' };
const duration = (min) => (min < 60 ? `${min} dk` : `${Math.floor(min / 60)} sa ${min % 60} dk`);

export class ParentPanel {
  constructor({ store, sfx }) { Object.assign(this, { store, sfx }); this.unlocked = false; }

  /** Şifre sorulur; sayfa yenilenene kadar bir kez yeter. */
  open() {
    if (this.unlocked) { this.show(); return; }
    const card = makeCard(`<span class="tag">VELİ PANELİ</span><h1>Veli şifresi</h1>
      <p class="fine">Bu bölüm veliler içindir: ilerleme raporu ve kayıt işlemleri.</p>
      <form class="pinform"><input id="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" autocomplete="off" aria-label="Veli şifresi"><p class="pinerr" id="pinErr" hidden>Şifre yanlış.</p></form>
      <div class="btns"><button class="btn" data-act="close">Vazgeç</button><button class="btn primary" data-act="ok">Aç</button></div>`, (act) => {
      this.sfx.click();
      if (act === 'close') { hideCard(); return; }
      this.tryPin(card);
    });
    card.querySelector('.pinform').addEventListener('submit', (e) => { e.preventDefault(); this.tryPin(card); });
    showCard(card);
    card.querySelector('#pin').focus();
  }

  tryPin(card) {
    const input = card.querySelector('#pin');
    if (input.value.trim() === PARENT_PIN) { this.unlocked = true; this.show(); return; }
    this.sfx.bad(); card.querySelector('#pinErr').hidden = false; input.value = ''; input.focus();
  }

  report() {
    const { store } = this;
    return buildReport({ stars: (id) => store.stars(id), tries: store.allTries(), isSkipped: (id) => store.isSkipped(id), log: store.log(), dailyDays: store.dailyDays() });
  }

  show() {
    const r = this.report(), t = r.totals;
    const tiles = [[t.stars, `/ ${t.maxStars} yıldız`], [t.passed, `/ ${t.missions} görev`], [duration(t.minutes), 'oyun süresi'], [t.days, 'gün oynadı']]
      .map(([big, small]) => `<div><b>${big}</b><small>${small}</small></div>`).join('');
    const rows = r.sectors.map((s) => `<tr class="${s.state}"><td><b>${s.id}. ${s.name}</b><small>${s.concept}</small></td><td>${s.passed} / ${s.missions}</td><td>${s.stars} / ${s.maxStars}</td><td>${s.minutes ? duration(s.minutes) : '–'}</td><td>${s.ease ? `<i class="ease ${s.ease}">${EASE[s.ease]}</i>` : `<i class="ease">${STATE[s.state]}</i>`}</td></tr>`).join('');
    const stuck = r.stuck.length ? `<h3>TAKILDIĞI GÖREVLER</h3><ul class="plist">${r.stuck.map((s) => `<li><b>${s.id} · ${s.title}</b><span>${s.fails} başarısız deneme${s.skipped ? ' · sonraya bıraktı' : ''}</span></li>`).join('')}</ul>` : '';
    const reasons = r.reasons.length ? `<h3>EN SIK HATALAR</h3><ul class="plist">${r.reasons.map((x) => `<li><b>${x.label}</b><span>${x.count} kez</span></li>`).join('')}</ul>` : '';
    const card = makeCard(`<span class="tag">VELİ PANELİ</span><h1>İlerleme raporu</h1>
      <div class="ptiles">${tiles}</div>
      <div class="pscroll">
        <h3>ÖNERİLER</h3><ul class="ptips">${r.tips.map((x) => `<li>${rich(x)}</li>`).join('')}</ul>
        ${stuck}
        <h3>SEKTÖRLER</h3>
        <table class="ptable"><thead><tr><th>Sektör · kavram</th><th>Görev</th><th>Yıldız</th><th>Süre</th><th>Durum</th></tr></thead><tbody>${rows}</tbody></table>
        ${reasons}
        <p class="fine">Toplam ${t.attempts} uçuş denemesi${t.daily ? ` · ${t.daily} günün dalgası` : ''}. Kayıt yalnızca bu cihazda, tarayıcıda tutulur; hiçbir yere gönderilmez.</p>
      </div>
      <div class="btns"><button class="btn" data-act="move">İlerlemeyi aktar</button><button class="btn" data-act="reset">Sıfırla</button><button class="btn primary" data-act="close">Kapat</button></div>`, (act) => {
      this.sfx.click();
      if (act === 'move') this.transfer(); else if (act === 'reset') this.confirmReset(); else hideCard();
    }, 'wide parent');
    showCard(card);
  }

  /** İlerlemeyi başka cihaza taşıma: kod ya da bağlantı verilir; öteki cihazda kod yapıştırılır. */
  transfer() {
    const code = this.store.exportCode(), link = `${location.origin}${location.pathname}#aktar=${code}`;
    const card = makeCard(`<span class="tag">VELİ PANELİ</span><h1>İlerlemeyi aktar</h1>
      <p class="fine"><b>Bu cihazdan almak için</b> kodu kopyalayın ve öteki cihazda bu ekrana yapıştırın. Bağlantıyı kendinize gönderip öteki cihazda açmak da olur.</p>
      <textarea class="pcode" id="outCode" readonly aria-label="İlerleme kodu">${code}</textarea>
      <div class="btns small"><button class="btn" data-act="copy">Kodu kopyala</button><button class="btn" data-act="link">Bağlantıyı kopyala</button></div>
      <p class="fine"><b>Bu cihaza yüklemek için</b> öteki cihazdan aldığınız kodu buraya yapıştırın. Bu cihazdaki kayıt onunla değişir.</p>
      <textarea class="pcode" id="inCode" placeholder="Kodu buraya yapıştırın" aria-label="Yüklenecek kod"></textarea>
      <p class="pinerr" id="inErr" hidden>Bu kod okunamadı. Tamamını kopyaladığınızdan emin olun.</p>
      <div class="btns"><button class="btn" data-act="back">Rapora dön</button><button class="btn primary" data-act="load">Kodu yükle</button></div>`, async (act, e) => {
      this.sfx.click();
      if (act === 'back') { this.show(); return; }
      if (act === 'copy' || act === 'link') {
        const text = act === 'copy' ? code : link;
        try { await navigator.clipboard.writeText(text); } catch (err) { const out = card.querySelector('#outCode'); out.value = text; out.select(); try { document.execCommand('copy'); } catch (x) { /* elle kopyalanır */ } }
        e.target.closest('button').textContent = 'Kopyalandı';
        return;
      }
      if (!this.load(card.querySelector('#inCode').value)) { this.sfx.bad(); card.querySelector('#inErr').hidden = false; }
    }, 'wide');
    showCard(card);
  }

  /** Kodu yükler ve sayfayı yeniden açar (her ekran yeni kayıttan kurulsun). Geçersizse false. */
  load(code) {
    const text = String(code || '').trim().replace(/^.*#aktar=/, '');
    if (!text || !this.store.importCode(text)) return false;
    location.hash = ''; location.reload();
    return true;
  }

  /** Bağlantıyla gelen ilerleme (#aktar=...): yüklemeden önce sorulur, çünkü bu cihazdaki kaydın yerini alır. */
  offer(code) {
    const card = makeCard(`<span class="tag">İLERLEME AKTARMA</span><h1>Kayıt yüklensin mi?</h1>
      <p>Bu bağlantı başka bir cihazdan bir ilerleme kaydı taşıyor. Yüklerseniz <b>bu cihazdaki kaydın yerini alır</b>.</p>
      <p class="pinerr" id="inErr" hidden>Bağlantıdaki kod okunamadı.</p>
      <div class="btns"><button class="btn" data-act="no">Vazgeç</button><button class="btn primary" data-act="yes">Yükle</button></div>`, (act) => {
      this.sfx.click();
      if (act === 'no') { history.replaceState(null, '', location.pathname + location.search); hideCard(); return; }
      if (!this.load(code)) { this.sfx.bad(); card.querySelector('#inErr').hidden = false; }
    });
    showCard(card);
  }

  confirmReset() {
    const card = makeCard(`<span class="tag">VELİ PANELİ</span><h1>Her şey silinsin mi?</h1>
      <p>Yıldızlar, yazılan programlar, mürettebat, hangar ve günlük silinir. <b>Bu işlem geri alınamaz.</b> Önce "İlerlemeyi aktar" ile bir yedek kodu alabilirsiniz.</p>
      <div class="btns"><button class="btn" data-act="back">Vazgeç</button><button class="btn danger" data-act="yes">Evet, sıfırla</button></div>`, (act) => {
      this.sfx.click();
      if (act === 'back') { this.show(); return; }
      this.store.reset(); location.hash = ''; location.reload();
    });
    showCard(card);
  }
}
