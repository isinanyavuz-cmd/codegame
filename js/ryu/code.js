/*
 * Ryu'nun Kod Macerası — yazarak kodlama.
 * Blok programını Türkçe komutlu bir metne çevirir (format) ve metni geri
 * blok programına çevirir (parse). Örnek:
 *
 *   fonksiyon kombo() {
 *     yumruk()
 *     hadoken()
 *   }
 *   tekrarla(3) {
 *     ileri()
 *   }
 *   kombo()
 *
 * Bkz. CONTRACT.md ("CodeGame.Ryu.Code").
 */
(function (root) {
  const CodeGame = root.CodeGame = root.CodeGame || {};
  const Ryu = CodeGame.Ryu = CodeGame.Ryu || {};

  const LOOP_MIN = 2;
  const LOOP_MAX = 9;

  /** blok türü -> yazılışı */
  const WORDS = {
    forward: 'ileri',
    back: 'geri',
    jump: 'zıpla',
    punch: 'yumruk',
    hadoken: 'hadoken',
    shoryuken: 'shoryuken',
    tatsumaki: 'tatsumaki',
    combo: 'kombo'
  };
  /** sadeleştirilmiş yazılış -> blok türü */
  const COMMANDS = {
    ileri: 'forward',
    geri: 'back',
    zipla: 'jump',
    yumruk: 'punch',
    hadoken: 'hadoken',
    shoryuken: 'shoryuken',
    tatsumaki: 'tatsumaki',
    tatsumakisenpukyaku: 'tatsumaki',
    tatsumaki_senpukyaku: 'tatsumaki',
    kombo: 'combo'
  };
  const LOOP_WORD = 'tekrarla';
  const FUNC_WORD = 'fonksiyon';

  class CodeError extends Error {
    constructor(message, line) {
      super(line ? line + '. satır: ' + message : message);
      this.name = 'CodeError';
      this.line = line || 0;
      this.plain = message;
    }
  }

  const TR = { 'ı': 'i', 'İ': 'i', 'I': 'i', 'ş': 's', 'Ş': 's', 'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ö': 'o', 'Ö': 'o', 'ü': 'u', 'Ü': 'u' };
  function simplify(word) {
    return String(word).replace(/[ıİIşŞçÇğĞöÖüÜ]/g, (c) => TR[c]).toLowerCase();
  }

  function distance(a, b) {
    const d = [];
    for (let i = 0; i <= a.length; i++) d[i] = [i];
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[a.length][b.length];
  }

  /** Yanlış yazılmış bir kelimeye en yakın komut (yoksa null). */
  function suggest(word, allowed) {
    const w = simplify(word);
    let best = null;
    let bestD = Infinity;
    for (const cand of allowed) {
      const d = distance(w, simplify(cand));
      if (d < bestD) { bestD = d; best = cand; }
    }
    return best && bestD <= Math.max(2, Math.floor(w.length / 3)) ? best : null;
  }

  // ---------------- format ----------------
  function formatList(list, indent, out) {
    for (const b of list || []) {
      if (b.type === 'loop') {
        out.push(indent + LOOP_WORD + '(' + b.count + ') {');
        formatList(b.body, indent + '  ', out);
        out.push(indent + '}');
      } else {
        out.push(indent + (WORDS[b.type] || b.type) + '()');
      }
    }
  }

  /** Programı metne çevirir. combo verilirse en üste fonksiyon olarak yazılır. */
  function format(program, combo) {
    const out = [];
    if (Array.isArray(combo)) {
      out.push(FUNC_WORD + ' kombo() {');
      formatList(combo, '  ', out);
      out.push('}');
      out.push('');
    }
    formatList(program, '', out);
    return out.join('\n');
  }

  // ---------------- parse ----------------
  function tokenize(text) {
    const tokens = [];
    let i = 0;
    let line = 1;
    const src = String(text || '');
    while (i < src.length) {
      const c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') {
        while (i < src.length && src[i] !== '\n') i++;
        continue;
      }
      if (/[0-9]/.test(c)) {
        let j = i;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
        tokens.push({ t: 'num', v: src.slice(i, j), line });
        i = j;
        continue;
      }
      if (/[A-Za-zÇĞİÖŞÜçğıöşü_]/.test(c)) {
        let j = i;
        while (j < src.length && /[A-Za-zÇĞİÖŞÜçğıöşü_0-9]/.test(src[j])) j++;
        tokens.push({ t: 'id', v: src.slice(i, j), line });
        i = j;
        continue;
      }
      if ('(){};'.indexOf(c) !== -1) {
        tokens.push({ t: c, v: c, line });
        i++;
        continue;
      }
      throw new CodeError("'" + c + "' işaretini anlamadım.", line);
    }
    tokens.push({ t: 'end', v: '', line });
    return tokens;
  }

  /**
   * Metni blok programına çevirir. Hata varsa CodeError (err.line) fırlatır.
   * options.tools: bu bölümde izin verilen bloklar (verilmezse hepsi).
   * Döner: { program, combo }  (combo: tanım yoksa null). Bloklarda `line` vardır.
   */
  function parse(text, options) {
    const tools = options && Array.isArray(options.tools) ? options.tools : null;
    const allowed = (type) => !tools || tools.indexOf(type) !== -1;
    const tokens = tokenize(text);
    let pos = 0;
    let combo = null;
    const comboCalls = [];

    const peek = () => tokens[pos];
    const next = () => tokens[pos++];

    function commandNames() {
      const names = [];
      for (const type of Object.keys(WORDS)) if (allowed(type)) names.push(WORDS[type] + '()');
      if (allowed('loop')) names.push(LOOP_WORD + '(3) { }');
      return names;
    }

    function expect(t, message) {
      const tok = peek();
      if (tok.t !== t) throw new CodeError(message, tok.t === 'end' ? tokens[Math.max(0, pos - 1)].line : tok.line);
      return next();
    }

    function parseList(inCombo, opener) {
      const list = [];
      for (;;) {
        const tok = peek();
        if (tok.t === 'end') {
          if (opener) throw new CodeError("'{' açıldı ama '}' ile kapanmadı.", opener.line);
          return list;
        }
        if (tok.t === '}') {
          if (!opener) throw new CodeError("Fazladan '}' var.", tok.line);
          next();
          return list;
        }
        if (tok.t === ';') { next(); continue; }
        const stmt = parseStatement(inCombo, !!opener);
        if (stmt) list.push(stmt);
      }
    }

    function parseStatement(inCombo, nested) {
      const tok = next();
      if (tok.t !== 'id') {
        throw new CodeError("Burada bir komut bekliyordum, '" + tok.v + "' geldi.", tok.line);
      }
      const word = simplify(tok.v);

      if (word === FUNC_WORD) {
        if (nested || inCombo) throw new CodeError('Fonksiyon başka bir bloğun içinde tanımlanamaz.', tok.line);
        if (!allowed('combo')) throw new CodeError('Bu bölümde fonksiyon (kombo) kullanılamaz.', tok.line);
        if (combo) throw new CodeError('kombo fonksiyonu iki kez tanımlanmış.', tok.line);
        const name = peek();
        if (name.t !== 'id' || simplify(name.v) !== 'kombo') {
          throw new CodeError('Fonksiyonun adı kombo olmalı: fonksiyon kombo() { ... }', tok.line);
        }
        next();
        expect('(', 'kombo sonrasına () yaz: fonksiyon kombo() { ... }');
        expect(')', "')' eksik: fonksiyon kombo() { ... }");
        const open = expect('{', "fonksiyon kombo() sonrasına '{' yaz.");
        combo = parseList(true, open);
        return null;
      }

      if (word === LOOP_WORD) {
        if (!allowed('loop')) throw new CodeError('Bu bölümde tekrarla kullanılamaz.', tok.line);
        expect('(', 'tekrarla sonrasına parantez içinde bir sayı yaz: tekrarla(3) { ... }');
        const num = peek();
        if (num.t !== 'num') throw new CodeError('tekrarla için 2 ile 9 arasında bir sayı yaz: tekrarla(3) { ... }', tok.line);
        next();
        const count = Number(num.v);
        if (count < LOOP_MIN || count > LOOP_MAX) {
          throw new CodeError('tekrarla sayısı 2 ile 9 arasında olmalı (' + count + ' yazdın).', num.line);
        }
        expect(')', "')' eksik: tekrarla(" + count + ') { ... }');
        const open = expect('{', "tekrarla(" + count + ") sonrasına '{' yaz.");
        const body = parseList(inCombo, open);
        return { type: 'loop', count, body, line: tok.line };
      }

      const type = COMMANDS[word];
      if (!type) {
        const names = commandNames().map((n) => n.replace(/\(.*$/, ''));
        const hint = suggest(tok.v, names);
        throw new CodeError("'" + tok.v + "' diye bir komut yok." + (hint ? " '" + hint + "()' mı demek istedin?" : ''), tok.line);
      }
      if (!allowed(type)) {
        throw new CodeError(type === 'combo'
          ? 'Bu bölümde kombo kullanılamaz.'
          : "'" + WORDS[type] + "' bu bölümde henüz yok.", tok.line);
      }
      if (peek().t !== '(') throw new CodeError(WORDS[type] + " sonrasına () yazmalısın: " + WORDS[type] + '()', tok.line);
      next();
      if (peek().t !== ')') throw new CodeError(WORDS[type] + "() parantezinin içi boş olmalı.", tok.line);
      next();
      if (type === 'combo') {
        if (inCombo) throw new CodeError('kombo kendini çağıramaz.', tok.line);
        comboCalls.push(tok.line);
      }
      return { type, line: tok.line };
    }

    const program = parseList(false, null);
    if (comboCalls.length && !combo) {
      throw new CodeError('kombo() kullanmak için önce fonksiyon kombo() { ... } yaz.', comboCalls[0]);
    }
    return { program, combo };
  }

  Ryu.CodeError = CodeError;
  Ryu.Code = { format, parse, simplify, suggest, WORDS, LOOP_MIN, LOOP_MAX };

  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
