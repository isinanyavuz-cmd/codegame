/* KodRobot — arayüz yapıştırıcısı (CodeGame.App)
 * Editör, kontroller, bölüm seçimi, ilerleme ve yorumlayıcı/dünya/renderer akışı.
 */
(function (root) {
  const CodeGame = root.CodeGame = root.CodeGame || {};

  // ---------------- yardımcılar ----------------
  const store = {
    get(key, def) {
      try {
        const raw = root.localStorage.getItem(key);
        return raw == null ? def : raw;
      } catch (e) { return def; }
    },
    set(key, value) {
      try { root.localStorage.setItem(key, value); } catch (e) { /* yoksay */ }
    },
    getJSON(key, def) {
      try {
        const raw = root.localStorage.getItem(key);
        if (raw == null) return def;
        const v = JSON.parse(raw);
        return v && typeof v === 'object' ? v : def;
      } catch (e) { return def; }
    },
    setJSON(key, value) {
      try { root.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* yoksay */ }
    }
  };

  const PROGRESS_KEY = 'kodrobot.progress';
  const LAST_KEY = 'kodrobot.lastLevel';
  const CODE_KEY = (id) => 'kodrobot.code.' + id;
  const SPEED_KEY = 'kodrobot.speed';
  const SPEEDS = [700, 450, 280, 160, 75]; // ms / eylem

  /** Yerel "kod satırı" sayacı (Interpreter.countLines yoksa). */
  function localCountLines(src) {
    let n = 0;
    for (const raw of String(src || '').split('\n')) {
      let line = raw;
      const ci = line.indexOf('//');
      if (ci >= 0) line = line.slice(0, ci);
      line = line.trim();
      if (!line) continue;
      if (/^[}\s;]*$/.test(line)) continue;
      n++;
    }
    return n;
  }
  function countLines(src) {
    const I = CodeGame.Interpreter;
    if (I && typeof I.countLines === 'function') {
      try { return I.countLines(src); } catch (e) { /* yerel sayaca düş */ }
    }
    return localCountLines(src);
  }
  function starsFor(lines, par) {
    if (lines <= par) return 3;
    if (lines <= par + 2) return 2;
    return 1;
  }
  function isCodeError(e) {
    return !!e && ((CodeGame.CodeError && e instanceof CodeGame.CodeError) || (typeof e.line === 'number' && e.kind));
  }

  // ---------------- komut referansı ----------------
  const REF = [
    { group: 'Hareket', items: [
      { tr: 'ilerle()', en: 'move()', desc: 'Bir kare ileri git.', keys: ['move', 'ilerle'], snippet: 'ilerle()' },
      { tr: 'solaDon()', en: 'turnLeft()', desc: 'Olduğun yerde sola dön.', keys: ['turnleft', 'soladon'], snippet: 'solaDon()' },
      { tr: 'sagaDon()', en: 'turnRight()', desc: 'Olduğun yerde sağa dön.', keys: ['turnright', 'sagadon'], snippet: 'sagaDon()' },
      { tr: 'topla()', en: 'pick()', desc: 'Bulunduğun karedeki elması topla.', keys: ['pick', 'topla'], snippet: 'topla()' }
    ] },
    { group: 'Sensörler', items: [
      { tr: 'onumBos()', en: 'pathAhead()', desc: 'Önün boşsa doğru.', keys: ['ispathahead', 'pathahead', 'onumbos'], snippet: 'onumBos()' },
      { tr: 'solumBos()', en: 'pathLeft()', desc: 'Solun boşsa doğru.', keys: ['ispathleft', 'pathleft', 'solumbos'], snippet: 'solumBos()' },
      { tr: 'sagimBos()', en: 'pathRight()', desc: 'Sağın boşsa doğru.', keys: ['ispathright', 'pathright', 'sagimbos'], snippet: 'sagimBos()' },
      { tr: 'hedefte()', en: 'atGoal()', desc: 'Hedefin üstündeysen doğru.', keys: ['atgoal', 'hedefte'], snippet: 'hedefte()' },
      { tr: 'elmasVar()', en: 'onGem()', desc: 'Bulunduğun karede elmas varsa doğru.', keys: ['hasgem', 'ongem', 'elmasvar'], snippet: 'elmasVar()' }
    ] },
    { group: 'Döngüler ve kararlar', items: [
      { tr: 'tekrarla 3 { }', en: 'repeat', desc: 'İçindekileri belirtilen sayıda tekrarla.', keys: ['repeat', 'tekrarla', 'loop'], snippet: 'tekrarla 3 {\n  |\n}' },
      { tr: 'iken (koşul) { }', en: 'while', desc: 'Koşul doğru olduğu sürece tekrarla.', keys: ['while', 'iken'], snippet: 'iken (!hedefte()) {\n  |\n}' },
      { tr: 'eger (koşul) { }', en: 'if', desc: 'Koşul doğruysa çalıştır.', keys: ['if', 'eger'], snippet: 'eger (onumBos()) {\n  |\n}' },
      { tr: 'degilse { }', en: 'else', desc: 'eger koşulu yanlışsa bunu çalıştır.', keys: ['else', 'degilse', 'elseif'], snippet: ' degilse {\n  |\n}' },
      { tr: '!  &&  ||', en: 'değil / ve / veya', desc: 'Koşulları ters çevir ya da birleştir.', keys: ['not', 'and', 'or', '!', '&&', '||', 'logic', 'operators', 've', 'veya', 'degil'], snippet: '!' }
    ] },
    { group: 'Fonksiyonlar', items: [
      { tr: 'fonksiyon ad() { }', en: 'function', desc: 'Kendi komutunu tanımla, sonra ad() diye çağır.', keys: ['function', 'fonksiyon', 'functions'], snippet: 'fonksiyon adim() {\n  |\n}' },
      { tr: '// yorum', en: 'comment', desc: 'Robot yorumları okumaz; notların için.', keys: ['comment', 'yorum'], snippet: '// ' }
    ] }
  ];

  // ---------------- uygulama ----------------
  function App() {
    const $ = (id) => document.getElementById(id);
    const el = {
      levelGrid: $('levelGrid'), totalStars: $('totalStars'),
      badge: $('levelBadge'), par: $('levelPar'), title: $('levelTitle'), desc: $('levelDesc'),
      hintToggle: $('hintToggle'), hintText: $('hintText'), refList: $('refList'),
      gemChip: $('gemChip'), stepChip: $('stepChip'), status: $('statusMsg'),
      boardWrap: $('boardWrap'), canvas: $('board'),
      lineCount: $('lineCount'), code: $('code'), gutter: $('gutterInner'),
      execBand: $('execBand'), errorBand: $('errorBand'), errorBox: $('errorBox'),
      btnRun: $('btnRun'), btnStep: $('btnStep'), btnStop: $('btnStop'), btnReset: $('btnReset'),
      speed: $('speed'),
      modal: $('winModal'), winStars: $('winStars'), winTitle: $('winTitle'), winText: $('winText'),
      btnRetry: $('btnRetry'), btnNext: $('btnNext')
    };

    const LEVELS = CodeGame.LEVELS || [];
    const missing = [];
    if (!CodeGame.Interpreter) missing.push('js/interpreter.js');
    if (!CodeGame.World) missing.push('js/world.js');
    if (!LEVELS.length) missing.push('js/levels.js');
    if (missing.length) {
      el.title.textContent = 'Oyun yüklenemedi';
      el.desc.textContent = 'Eksik dosya: ' + missing.join(', ');
      return;
    }

    const renderer = new CodeGame.Renderer(el.canvas, { container: el.boardWrap });

    let idx = 0;
    let level = null;
    let world = null;
    let session = null;   // { world, gen, source, actions, finished }
    let running = false;
    let busy = false;     // bir adım canlandırılıyor
    let runToken = 0;
    let execLine = null;
    let errorLine = null;
    let lastLineTotal = -1;

    // ---------- ilerleme ----------
    function progress() { return store.getJSON(PROGRESS_KEY, {}); }
    function isUnlocked(i, prog) {
      prog = prog || progress();
      if (i <= 0) return true;
      if ((prog[LEVELS[i].id] || 0) > 0) return true;
      return (prog[LEVELS[i - 1].id] || 0) > 0;
    }
    function saveStars(id, stars) {
      const prog = progress();
      const prev = prog[id] || 0;
      if (stars > prev) {
        prog[id] = stars;
        store.setJSON(PROGRESS_KEY, prog);
      }
      return Math.max(prev, stars);
    }

    // ---------- bölüm seçici ----------
    function renderLevelGrid() {
      const prog = progress();
      el.levelGrid.textContent = '';
      let total = 0;
      LEVELS.forEach((lv, i) => {
        const stars = prog[lv.id] || 0;
        total += stars;
        const unlocked = isUnlocked(i, prog);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'level-btn' + (i === idx ? ' current' : '') + (stars ? ' done' : '') + (unlocked ? '' : ' locked');
        b.disabled = !unlocked;
        b.setAttribute('aria-label', (i + 1) + '. bölüm: ' + lv.title + (unlocked ? (stars ? ', ' + stars + ' yıldız' : '') : ', kilitli'));
        b.title = unlocked ? (i + 1) + '. ' + lv.title : 'Kilitli — önce ' + i + '. bölümü geç';
        if (i === idx) b.setAttribute('aria-current', 'true');
        if (unlocked) {
          const num = document.createElement('span');
          num.className = 'num';
          num.textContent = String(i + 1);
          const st = document.createElement('span');
          st.className = 'stars';
          for (let k = 1; k <= 3; k++) {
            const s = document.createElement('span');
            s.textContent = '★';
            if (k <= stars) s.className = 'on';
            st.appendChild(s);
          }
          b.append(num, st);
          b.addEventListener('click', () => loadLevel(i));
        } else {
          const lock = document.createElement('span');
          lock.className = 'lock';
          lock.textContent = '🔒';
          const num = document.createElement('span');
          num.className = 'stars';
          num.textContent = String(i + 1);
          b.append(lock, num);
        }
        el.levelGrid.appendChild(b);
      });
      el.totalStars.textContent = '★ ' + total + ' / ' + LEVELS.length * 3;
    }

    // ---------- komut referansı ----------
    function conceptSets() {
      const norm = (a) => (Array.isArray(a) ? a : []).map((s) => String(s).toLowerCase());
      const cur = new Set(norm(level.newConcepts));
      const before = new Set();
      const later = new Set();
      LEVELS.forEach((lv, i) => {
        const list = norm(lv.newConcepts);
        if (i < idx) list.forEach((k) => before.add(k));
        else if (i > idx) list.forEach((k) => later.add(k));
      });
      return { cur, before, later };
    }
    function renderReference() {
      const { cur, before, later } = conceptSets();
      el.refList.textContent = '';
      for (const g of REF) {
        const group = document.createElement('div');
        group.className = 'ref-group';
        const h = document.createElement('p');
        h.className = 'ref-group-title';
        h.textContent = g.group;
        const items = document.createElement('div');
        items.className = 'ref-items';
        for (const it of g.items) {
          const isNew = it.keys.some((k) => cur.has(k));
          const seen = isNew || it.keys.some((k) => before.has(k));
          const isLater = !seen && it.keys.some((k) => later.has(k));
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'ref-item' + (isNew ? ' is-new' : '') + (isLater ? ' is-later' : '');
          b.title = isLater ? 'İleriki bölümlerde öğreneceksin — yine de kullanabilirsin' : 'Koda ekle';
          const code = document.createElement('code');
          code.textContent = it.tr;
          const alias = document.createElement('span');
          alias.className = 'alias';
          alias.textContent = it.en;
          const desc = document.createElement('span');
          desc.className = 'desc';
          desc.textContent = it.desc;
          b.append(code, alias, desc);
          b.addEventListener('click', () => insertSnippet(it.snippet));
          items.appendChild(b);
        }
        group.append(h, items);
        el.refList.appendChild(group);
      }
    }

    // ---------- editör ----------
    const ta = el.code;
    function metrics() {
      const cs = getComputedStyle(ta);
      return { lh: parseFloat(cs.lineHeight) || 23, pad: parseFloat(cs.paddingTop) || 12 };
    }
    function renderGutter() {
      const total = ta.value.split('\n').length;
      if (total !== lastLineTotal) {
        lastLineTotal = total;
        const frag = document.createDocumentFragment();
        for (let i = 1; i <= total; i++) {
          const d = document.createElement('div');
          d.textContent = String(i);
          frag.appendChild(d);
        }
        el.gutter.textContent = '';
        el.gutter.appendChild(frag);
      }
      const kids = el.gutter.children;
      for (let i = 0; i < kids.length; i++) {
        const n = i + 1;
        kids[i].className = (n === execLine ? 'exec' : '') + (n === errorLine ? ' err' : '');
      }
      syncScroll();
    }
    function syncScroll() {
      const st = ta.scrollTop;
      el.gutter.style.transform = 'translateY(' + -st + 'px)';
      const m = metrics();
      placeBand(el.execBand, execLine, m, st);
      placeBand(el.errorBand, errorLine, m, st);
    }
    function placeBand(band, line, m, st) {
      if (!line) { band.classList.remove('show'); return; }
      band.style.top = (m.pad + (line - 1) * m.lh - st) + 'px';
      band.classList.add('show');
    }
    function revealLine(line) {
      if (!line) return;
      const m = metrics();
      const top = m.pad + (line - 1) * m.lh;
      const h = ta.clientHeight;
      if (top < ta.scrollTop + m.lh) ta.scrollTop = Math.max(0, top - m.lh * 2);
      else if (top + m.lh > ta.scrollTop + h - m.lh) ta.scrollTop = top - h + m.lh * 3;
    }
    function setExecLine(line) {
      execLine = line || null;
      if (execLine) revealLine(execLine);
      renderGutter();
    }
    function setErrorLine(line) {
      errorLine = line || null;
      if (errorLine) revealLine(errorLine);
      renderGutter();
    }
    function updateLineCount() {
      const n = countLines(ta.value);
      const par = level.par;
      el.lineCount.textContent = 'kod satırı: ' + n + ' / par ' + par;
      el.lineCount.classList.remove('ok', 'near', 'over');
      if (n > 0) el.lineCount.classList.add(n <= par ? 'ok' : n <= par + 2 ? 'near' : 'over');
    }
    function onCodeChanged() {
      store.set(CODE_KEY(level.id), ta.value);
      updateLineCount();
      if (session && !running) {
        session = null;
        setExecLine(null);
        setUi();
      }
      if (errorLine) { setErrorLine(null); hideError(); }
      renderGutter();
    }

    function insertText(text) {
      ta.focus();
      let ok = false;
      try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
      if (!ok) {
        const s = ta.selectionStart;
        ta.setRangeText(text, s, ta.selectionEnd, 'end');
        onCodeChanged();
      }
    }
    function lineStartOf(pos) { return ta.value.lastIndexOf('\n', pos - 1) + 1; }

    function insertSnippet(snippet) {
      if (ta.readOnly) return;
      const pos = ta.selectionStart;
      const ls = lineStartOf(pos);
      const lineBefore = ta.value.slice(ls, pos);
      const indent = (lineBefore.match(/^\s*/) || [''])[0];
      let text = snippet.replace(/\n/g, '\n' + indent);
      const isCall = /\)$/.test(snippet) || /^\/\//.test(snippet);
      const isBlock = snippet.indexOf('\n') >= 0 && snippet[0] !== ' ';
      if ((isCall || isBlock) && lineBefore.trim() !== '') text = '\n' + indent + text;
      if (isCall && snippet.indexOf('\n') < 0 && !/^\/\//.test(snippet)) {
        const rest = ta.value.slice(ta.selectionEnd);
        if (rest && rest[0] !== '\n') text += '\n' + indent;
      }
      const caret = text.indexOf('|');
      text = text.replace('|', '');
      insertText(text);
      if (caret >= 0) {
        const p = pos + caret;
        ta.setSelectionRange(p, p);
      }
    }

    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        run();
        return;
      }
      if (ta.readOnly) return;
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        const s = ta.selectionStart;
        const en = ta.selectionEnd;
        const v = ta.value;
        const multi = v.slice(s, en).indexOf('\n') >= 0;
        if (e.shiftKey || multi) {
          const ls = lineStartOf(s);
          let le = v.indexOf('\n', en > s && v[en - 1] === '\n' ? en - 1 : en);
          if (le < 0) le = v.length;
          const block = v.slice(ls, le);
          const out = block.split('\n').map((l) => (e.shiftKey ? l.replace(/^ {1,2}/, '') : '  ' + l)).join('\n');
          ta.setSelectionRange(ls, le);
          insertText(out);
          ta.setSelectionRange(ls, ls + out.length);
        } else {
          insertText('  ');
        }
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        const s = ta.selectionStart;
        const v = ta.value;
        const ls = lineStartOf(s);
        const before = v.slice(ls, s);
        const indent = (before.match(/^\s*/) || [''])[0];
        const opens = /\{\s*$/.test(before.replace(/\/\/.*$/, ''));
        const after = v.slice(ta.selectionEnd);
        const closesNext = /^\s*\}/.test(after.split('\n')[0]);
        if (opens && closesNext) {
          const inner = indent + '  ';
          const trimmedAfter = after.replace(/^[ \t]+/, '');
          ta.setSelectionRange(s, ta.selectionEnd + (after.length - trimmedAfter.length));
          insertText('\n' + inner + '\n' + indent);
          const p = s + 1 + inner.length;
          ta.setSelectionRange(p, p);
        } else {
          insertText('\n' + indent + (opens ? '  ' : ''));
        }
        return;
      }
      if (e.key === '}' && !e.ctrlKey && !e.metaKey) {
        const s = ta.selectionStart;
        const ls = lineStartOf(s);
        const before = ta.value.slice(ls, s);
        if (s === ta.selectionEnd && /^ {2,}$/.test(before)) {
          e.preventDefault();
          ta.setSelectionRange(s - 2, s);
          insertText('}');
        }
      }
    }

    // ---------- mesajlar ----------
    function setStatus(text, kind) {
      el.status.textContent = text || '';
      el.status.className = 'status-msg' + (kind ? ' ' + kind : '');
    }
    function showError(e) {
      const line = typeof e.line === 'number' && e.line > 0 ? e.line : null;
      let msg = e.message || String(e);
      if (line && !/sat[ıi]r/i.test(msg)) msg = line + '. satır: ' + msg;
      el.errorBox.className = 'error-box';
      el.errorBox.textContent = '';
      const kind = document.createElement('span');
      kind.className = 'err-kind';
      kind.textContent = e.kind === 'syntax' ? 'Yazım hatası' : e.kind === 'runtime' ? 'Çalışma hatası' : 'Hata';
      el.errorBox.append(kind, document.createTextNode(msg));
      el.errorBox.hidden = false;
      // animasyonu yeniden tetikle
      el.errorBox.style.animation = 'none';
      void el.errorBox.offsetWidth;
      el.errorBox.style.animation = '';
      setErrorLine(line);
    }
    function showInfo(title, msg) {
      el.errorBox.className = 'error-box info';
      el.errorBox.textContent = '';
      const kind = document.createElement('span');
      kind.className = 'err-kind';
      kind.textContent = title;
      el.errorBox.append(kind, document.createTextNode(msg));
      el.errorBox.hidden = false;
    }
    function hideError() {
      el.errorBox.hidden = true;
      el.errorBox.textContent = '';
    }

    function updateChips(w) {
      w = w || world;
      if (!w) return;
      el.gemChip.textContent = '💎 ' + (w.collected || 0) + ' / ' + (w.totalGems || 0);
      el.stepChip.textContent = '👣 ' + (session ? session.actions : 0);
    }

    function setUi() {
      const paused = !!session && !session.finished && !running;
      el.btnRun.disabled = running;
      el.btnRun.classList.toggle('running', running);
      el.btnRun.innerHTML = running
        ? '<span aria-hidden="true">⚙</span> Çalışıyor'
        : paused ? '<span aria-hidden="true">▶</span> Devam et' : '<span aria-hidden="true">▶</span> Çalıştır';
      el.btnStep.innerHTML = running ? '<span aria-hidden="true">⏸</span> Duraklat' : '<span aria-hidden="true">⏭</span> Adım';
      el.btnStep.title = running ? 'Duraklat' : 'Tek adım ilerle';
      el.btnStop.disabled = !(running || paused);
      ta.readOnly = running;
    }

    // ---------- oyun akışı ----------
    function speedMs() {
      const v = Math.max(1, Math.min(5, parseInt(el.speed.value, 10) || 3));
      return SPEEDS[v - 1];
    }

    function freshWorld() {
      world = new CodeGame.World(level);
      renderer.setWorld(world);
      updateChips(world);
    }

    function startSession() {
      hideError();
      setErrorLine(null);
      closeModal();
      const source = ta.value;
      let ast;
      try {
        ast = CodeGame.Interpreter.parse(source);
      } catch (e) {
        showError(e);
        setStatus('Kodda bir yazım hatası var', 'bad');
        return false;
      }
      try {
        freshWorld();
        session = { world, gen: CodeGame.Interpreter.run(ast, world, { maxSteps: 2000 }), source, actions: 0, finished: false };
      } catch (e) {
        showError(e);
        session = null;
        return false;
      }
      updateChips(world);
      return true;
    }

    /** Bir eylem ilerletir; devam edilebilirse true döner. */
    async function advance() {
      const s = session;
      if (!s || s.finished) return false;
      busy = true;
      try {
        let res;
        try {
          res = s.gen.next();
        } catch (e) {
          s.finished = true;
          await onRuntimeError(e, s);
          return false;
        }
        if (res.done) {
          s.finished = true;
          onFinished(s);
          return false;
        }
        const a = res.value || {};
        s.actions++;
        updateChips(s.world);
        setExecLine(a.line);
        await renderer.animate(a.action, s.world, speedMs());
        updateChips(s.world);
        return session === s;
      } finally {
        busy = false;
      }
    }

    async function onRuntimeError(e, s) {
      setExecLine(null);
      if (s.world.crashed) {
        setStatus('Ah! Robot duvara çarptı', 'bad');
        showError(isCodeError(e) ? e : { message: e.message, kind: 'runtime' });
        await renderer.crash(s.world, speedMs());
      } else {
        setStatus('Kod çalışırken bir sorun çıktı', 'bad');
        showError(isCodeError(e) ? e : { message: 'Beklenmeyen hata: ' + (e && e.message), kind: 'runtime' });
      }
      setUi();
    }

    function onFinished(s) {
      setExecLine(null);
      const w = s.world;
      if (w.isWon()) {
        const lines = countLines(s.source);
        const stars = starsFor(lines, level.par);
        saveStars(level.id, stars);
        renderLevelGrid();
        renderer.celebrate();
        setStatus('Hedefe ulaşıldı! 🎉', 'good');
        const myLevel = level;
        setTimeout(() => { if (level === myLevel) openModal(stars, lines); }, 650);
      } else {
        const left = w.gems ? w.gems.size : Math.max(0, (w.totalGems || 0) - (w.collected || 0));
        if (!w.atGoal()) {
          setStatus('Robot hedefe ulaşamadı', 'warn');
          showInfo('Neredeyse!', 'Robot hedefe ulaşamadı. Kodun bitti ama robot hâlâ yolda.' +
            (left ? ' Ayrıca ' + left + ' elmas toplanmadı.' : ''));
        } else {
          setStatus('Hâlâ toplanmamış elmas var', 'warn');
          showInfo('Az kaldı!', 'Hedeftesin ama hâlâ toplanmamış ' + left + ' elmas var. 💎 Hepsini topla, sonra hedefe gel.');
        }
      }
      setUi();
    }

    async function run() {
      if (running) return;
      if (busy) return;
      if (!session || session.finished) {
        if (!startSession()) { setUi(); return; }
      } else {
        hideError();
      }
      running = true;
      const token = ++runToken;
      setStatus('Robot çalışıyor…');
      setUi();
      while (running && token === runToken) {
        const cont = await advance();
        if (!cont) break;
      }
      if (token === runToken) {
        running = false;
        if (session && !session.finished) setStatus('Duraklatıldı');
        setUi();
      }
    }

    function pause() {
      if (!running) return;
      running = false;
      runToken++;
      setStatus('Duraklatıldı — Adım ile ilerleyebilirsin');
      setUi();
    }

    async function step() {
      if (running) { pause(); return; }
      if (busy) return;
      if (!session || session.finished) {
        if (!startSession()) { setUi(); return; }
      }
      setStatus('Adım adım…');
      setUi();
      await advance();
      if (session && !session.finished) setStatus('Adım ' + session.actions);
      setUi();
    }

    function stop() {
      runToken++;
      running = false;
      const had = !!session && !session.finished;
      session = null;
      renderer.snap();
      setExecLine(null);
      if (had) setStatus('Durduruldu');
      setUi();
    }

    function reset() {
      stop();
      closeModal();
      hideError();
      setErrorLine(null);
      freshWorld();
      setStatus('Robot başa döndü');
      setUi();
    }

    // ---------- kazanma penceresi ----------
    function openModal(stars, lines) {
      el.winStars.textContent = '';
      for (let i = 1; i <= 3; i++) {
        const s = document.createElement('span');
        s.className = 'star' + (i <= stars ? ' on' : '');
        s.textContent = '★';
        el.winStars.appendChild(s);
      }
      const titles = ['', 'Başardın!', 'Çok iyi!', 'Mükemmel!'];
      el.winTitle.textContent = titles[stars] || 'Harika iş!';
      let text = lines + ' satır kodla bitirdin (par ' + level.par + ').';
      if (stars < 3) text += ' 3 yıldız için en fazla ' + level.par + ' satır dene — döngüler yardımcı olabilir!';
      else text += ' Kodun tam bir usta işi.';
      const hasNext = idx + 1 < LEVELS.length;
      if (!hasNext) text += ' Tüm bölümleri tamamladın! 🎉';
      el.winText.textContent = text;
      el.btnNext.hidden = !hasNext;
      el.modal.hidden = false;
      setTimeout(() => (hasNext ? el.btnNext : el.btnRetry).focus(), 50);
    }
    function closeModal() {
      el.modal.hidden = true;
    }

    // ---------- bölüm yükleme ----------
    function loadLevel(i) {
      i = Math.max(0, Math.min(LEVELS.length - 1, i));
      runToken++;
      running = false;
      session = null;
      closeModal();
      idx = i;
      level = LEVELS[i];
      store.set(LAST_KEY, level.id);

      el.badge.textContent = 'Bölüm ' + (i + 1) + ' / ' + LEVELS.length;
      el.par.textContent = 'par ' + level.par + ' satır';
      el.title.textContent = level.title;
      el.desc.textContent = level.description || '';
      el.hintText.textContent = level.hint || '';
      el.hintText.hidden = true;
      el.hintToggle.setAttribute('aria-expanded', 'false');
      el.hintToggle.querySelector('.hint-label').textContent = 'İpucu göster';
      el.hintToggle.parentElement.hidden = !level.hint;

      const saved = store.get(CODE_KEY(level.id), null);
      ta.value = saved != null ? saved : (level.starterCode || '');
      ta.scrollTop = 0;
      lastLineTotal = -1;
      execLine = null;
      errorLine = null;
      hideError();
      renderGutter();
      updateLineCount();
      renderLevelGrid();
      renderReference();
      freshWorld();
      setStatus('Hazır! Kodunu yaz ve Çalıştır\'a bas.');
      setUi();
    }

    // ---------- olaylar ----------
    ta.addEventListener('input', onCodeChanged);
    ta.addEventListener('scroll', syncScroll);
    ta.addEventListener('keydown', onKeyDown);
    el.btnRun.addEventListener('click', run);
    el.btnStep.addEventListener('click', step);
    el.btnStop.addEventListener('click', stop);
    el.btnReset.addEventListener('click', reset);
    el.speed.addEventListener('input', () => store.set(SPEED_KEY, el.speed.value));
    el.hintToggle.addEventListener('click', () => {
      const open = el.hintText.hidden;
      el.hintText.hidden = !open;
      el.hintToggle.setAttribute('aria-expanded', String(open));
      el.hintToggle.querySelector('.hint-label').textContent = open ? 'İpucunu gizle' : 'İpucu göster';
    });
    el.btnRetry.addEventListener('click', () => { closeModal(); reset(); ta.focus(); });
    el.btnNext.addEventListener('click', () => { if (idx + 1 < LEVELS.length) loadLevel(idx + 1); });
    el.modal.addEventListener('click', (e) => { if (e.target === el.modal) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !el.modal.hidden) closeModal();
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && e.target !== ta) { e.preventDefault(); run(); }
    });

    // ---------- başlangıç ----------
    const refDetails = document.getElementById('refDetails');
    try {
      if (refDetails && root.matchMedia && root.matchMedia('(max-width: 820px)').matches) refDetails.open = false;
    } catch (e) { /* yoksay */ }
    const sp = parseInt(store.get(SPEED_KEY, '3'), 10);
    if (sp >= 1 && sp <= 5) el.speed.value = String(sp);
    const lastId = store.get(LAST_KEY, null);
    let start = Math.max(0, LEVELS.findIndex((l) => l.id === lastId));
    if (!isUnlocked(start)) {
      start = 0;
      for (let i = 0; i < LEVELS.length; i++) if (isUnlocked(i)) start = i;
    }
    loadLevel(start);

    return { loadLevel, run, step, stop, reset, get session() { return session; }, renderer };
  }

  CodeGame.countLinesLocal = localCountLines;
  CodeGame.starsFor = starsFor;

  if (typeof document !== 'undefined') {
    const boot = () => { CodeGame.app = App(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
