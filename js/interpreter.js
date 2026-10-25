/*
 * KodRobot — dil yorumlayıcısı.
 * Tokenizer + özyinelemeli iniş (recursive-descent) ayrıştırıcı + generator tabanlı yorumlayıcı.
 * Bkz. CONTRACT.md ("Dil", "CodeGame.CodeError", "CodeGame.Interpreter").
 */
(function (root) {
  const CodeGame = root.CodeGame = root.CodeGame || {};

  // ---------------------------------------------------------------------------
  // Hata sınıfı
  // ---------------------------------------------------------------------------
  class CodeError extends Error {
    constructor(message, line, kind) {
      super(message);
      this.name = 'CodeError';
      this.line = line;
      this.kind = kind; // 'syntax' | 'runtime'
    }
  }

  // ---------------------------------------------------------------------------
  // Dil tanımları
  // ---------------------------------------------------------------------------
  const KEYWORDS = {
    repeat: 'REPEAT', tekrarla: 'REPEAT',
    while: 'WHILE', iken: 'WHILE',
    if: 'IF', eger: 'IF',
    else: 'ELSE', degilse: 'ELSE',
    function: 'FUNCTION', fonksiyon: 'FUNCTION',
  };

  // dil adı -> world metodu
  const ACTIONS = {
    move: 'move', ilerle: 'move',
    turnLeft: 'turnLeft', solaDon: 'turnLeft',
    turnRight: 'turnRight', sagaDon: 'turnRight',
    pick: 'pick', topla: 'pick',
  };

  const SENSORS = {
    pathAhead: 'isPathAhead', onumBos: 'isPathAhead',
    pathLeft: 'isPathLeft', solumBos: 'isPathLeft',
    pathRight: 'isPathRight', sagimBos: 'isPathRight',
    atGoal: 'atGoal', hedefte: 'atGoal',
    onGem: 'hasGem', elmasVar: 'hasGem',
  };

  const MAX_CALL_DEPTH = 200;
  const DEFAULT_MAX_STEPS = 2000;

  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  // Türkçe karakterleri ASCII karşılıklarına indirger: "solaDön" -> "solaDon", "eğer" -> "eger".
  const TR_FOLD = { 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U' };
  function foldTurkish(s) {
    return s.replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TR_FOLD[c]);
  }

  function at(line, msg) {
    return line + '. satır: ' + msg;
  }

  function syntaxError(line, msg) {
    return new CodeError(at(line, msg), line, 'syntax');
  }

  // ---------------------------------------------------------------------------
  // Öneri (edit distance)
  // ---------------------------------------------------------------------------
  function editDistance(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    const prev = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      let diag = prev[0];
      prev[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = prev[j];
        prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
        diag = tmp;
      }
    }
    return prev[b.length];
  }

  function suggest(name, candidates) {
    let best = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = editDistance(name, c);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    const limit = Math.max(1, Math.min(3, Math.floor(name.length / 3)));
    return bestDist <= limit ? best : null;
  }

  // ---------------------------------------------------------------------------
  // Tokenizer
  // ---------------------------------------------------------------------------
  // Token: { type, value, line } ; type: IDENT NUMBER KEYWORD(REPEAT…) { } ( ) ; && || ! EOF
  function tokenize(source) {
    const tokens = [];
    let i = 0;
    let line = 1;
    const n = source.length;
    const identStart = /[A-Za-z_çÇğĞıİöÖşŞüÜ]/;
    const identPart = /[A-Za-z0-9_çÇğĞıİöÖşŞüÜ]/;

    while (i < n) {
      const ch = source[i];
      if (ch === '\n') { line++; i++; continue; }
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\f' || ch === '\v' || ch === ' ') { i++; continue; }
      if (ch === '/' && source[i + 1] === '/') {
        while (i < n && source[i] !== '\n') i++;
        continue;
      }
      if (ch === '/' && source[i + 1] === '*') {
        throw syntaxError(line, "yorumlar '//' ile başlar ('/*' desteklenmiyor)");
      }
      if (identStart.test(ch)) {
        let j = i + 1;
        while (j < n && identPart.test(source[j])) j++;
        const raw = source.slice(i, j);
        const name = foldTurkish(raw);
        if (has(KEYWORDS, name)) tokens.push({ type: KEYWORDS[name], value: raw, line });
        else tokens.push({ type: 'IDENT', value: name, raw, line });
        i = j;
        continue;
      }
      if (ch >= '0' && ch <= '9') {
        let j = i + 1;
        while (j < n && source[j] >= '0' && source[j] <= '9') j++;
        if (j < n && identStart.test(source[j])) {
          throw syntaxError(line, "'" + source.slice(i, j + 1) + "' geçerli bir sayı değil");
        }
        tokens.push({ type: 'NUMBER', value: parseInt(source.slice(i, j), 10), raw: source.slice(i, j), line });
        i = j;
        continue;
      }
      if (ch === '&') {
        if (source[i + 1] === '&') { tokens.push({ type: '&&', value: '&&', line }); i += 2; continue; }
        throw syntaxError(line, "tek '&' kullanılamaz, 've' için '&&' yaz");
      }
      if (ch === '|') {
        if (source[i + 1] === '|') { tokens.push({ type: '||', value: '||', line }); i += 2; continue; }
        throw syntaxError(line, "tek '|' kullanılamaz, 'veya' için '||' yaz");
      }
      if ('{}();!'.indexOf(ch) !== -1) {
        tokens.push({ type: ch, value: ch, line });
        i++;
        continue;
      }
      throw syntaxError(line, "'" + ch + "' karakteri anlaşılamadı");
    }
    tokens.push({ type: 'EOF', value: '', line });
    return tokens;
  }

  // ---------------------------------------------------------------------------
  // Parser
  // ---------------------------------------------------------------------------
  // AST düğümleri (hepsinde `line` var):
  //   Program  { type, body: Stmt[], functions: { [name]: FunctionDef } }
  //   Call     { type:'Call', name, raw, line, kind?: 'action'|'user', method? }   (deyim)
  //   Repeat   { type:'Repeat', count, body, line }
  //   While    { type:'While', cond, body, line }
  //   If       { type:'If', cond, then: Stmt[], else: Stmt[]|null, line }
  //   FunctionDef { type:'FunctionDef', name, raw, body, line }
  //   Koşullar: Or/And { left, right, line }, Not { operand, line }, Sensor { name, raw, method, line }
  function describe(tok) {
    switch (tok.type) {
      case 'EOF': return 'programın sonu';
      case 'IDENT': return "'" + tok.raw + "'";
      case 'NUMBER': return "'" + tok.raw + "'";
      default: return "'" + tok.value + "'";
    }
  }

  function Parser(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.calls = [];      // çözümlenecek deyim çağrıları
    this.condCalls = [];  // çözümlenecek koşul çağrıları
    this.functions = Object.create(null);
  }

  Parser.prototype.peek = function (o) { return this.tokens[this.pos + (o || 0)]; };
  Parser.prototype.next = function () { return this.tokens[this.pos++]; };
  Parser.prototype.check = function (type) { return this.peek().type === type; };
  Parser.prototype.accept = function (type) {
    if (this.check(type)) return this.next();
    return null;
  };

  Parser.prototype.parseProgram = function () {
    const body = [];
    while (!this.check('EOF')) {
      if (this.check('}')) throw syntaxError(this.peek().line, "fazladan '}' var — eşleşen '{' yok");
      body.push(this.parseStatement());
    }
    const program = { type: 'Program', body, functions: this.functions, line: 1 };
    this.resolve();
    return program;
  };

  Parser.prototype.parseStatement = function () {
    const tok = this.peek();
    switch (tok.type) {
      case 'REPEAT': return this.parseRepeat();
      case 'WHILE': return this.parseWhile();
      case 'IF': return this.parseIf();
      case 'FUNCTION': return this.parseFunction();
      case 'ELSE':
        throw syntaxError(tok.line, "'" + tok.value + "' kullanmadan önce bir 'if'/'eger' bloğu gerekli");
      case 'IDENT': {
        const call = this.parseCall();
        this.accept(';');
        this.calls.push(call);
        return call;
      }
      case ';':
        this.next();
        return this.parseEmpty(tok);
      case '{':
        throw syntaxError(tok.line, "'{' burada beklenmiyordu — bloktan önce 'repeat', 'while', 'if' veya 'function' gerekli");
      case 'NUMBER':
        throw syntaxError(tok.line, "'" + tok.raw + "' sayısı burada ne yapıyor? Sayılar yalnızca 'repeat'/'tekrarla' sonrasında kullanılır");
      case 'EOF':
        throw syntaxError(tok.line, 'bir komut bekleniyordu');
      default:
        throw syntaxError(tok.line, describe(tok) + ' burada beklenmiyordu');
    }
  };

  // Tek başına ';' boş deyimdir.
  Parser.prototype.parseEmpty = function (tok) {
    return { type: 'Empty', line: tok.line };
  };

  Parser.prototype.parseCall = function () {
    const tok = this.next(); // IDENT
    if (!this.check('(')) {
      throw syntaxError(tok.line, "'" + tok.raw + "' yazdıktan sonra '()' eksik — '" + tok.raw + "()' şeklinde yaz");
    }
    this.next();
    if (!this.check(')')) {
      throw syntaxError(this.peek().line, "'" + tok.raw + "(' sonrasında ')' bekleniyordu — komutlar parametre almaz");
    }
    this.next();
    return { type: 'Call', name: tok.value, raw: tok.raw, line: tok.line };
  };

  Parser.prototype.parseBlock = function (ownerTok) {
    const open = this.peek();
    if (open.type !== '{') {
      throw syntaxError(open.type === 'EOF' ? ownerTok.line : open.line, "'{' bekleniyordu");
    }
    this.next();
    const body = [];
    while (!this.check('}')) {
      if (this.check('EOF')) throw syntaxError(open.line, "'}' eksik görünüyor");
      body.push(this.parseStatement());
    }
    this.next();
    return body;
  };

  Parser.prototype.parseRepeat = function () {
    const kw = this.next();
    let count;
    const paren = this.accept('(');
    const numTok = this.peek();
    if (numTok.type !== 'NUMBER') {
      throw syntaxError(numTok.type === 'EOF' ? kw.line : numTok.line,
        "'" + kw.value + "' sonrasında kaç kez tekrarlanacağını gösteren bir sayı bekleniyordu (ör. '" + kw.value + " 3 { ... }')");
    }
    this.next();
    count = numTok.value;
    if (paren && !this.accept(')')) throw syntaxError(this.peek().line, "')' bekleniyordu");
    const body = this.parseBlock(kw);
    return { type: 'Repeat', count, body, line: kw.line };
  };

  Parser.prototype.parseWhile = function () {
    const kw = this.next();
    if (this.check('{')) throw syntaxError(kw.line, "'" + kw.value + "' sonrasında bir koşul bekleniyordu (ör. '" + kw.value + " !hedefte() { ... }')");
    const cond = this.parseCond();
    const body = this.parseBlock(kw);
    return { type: 'While', cond, body, line: kw.line };
  };

  Parser.prototype.parseIf = function () {
    const kw = this.next();
    if (this.check('{')) throw syntaxError(kw.line, "'" + kw.value + "' sonrasında bir koşul bekleniyordu (ör. '" + kw.value + " onumBos() { ... }')");
    const cond = this.parseCond();
    const then = this.parseBlock(kw);
    let elseBody = null;
    if (this.check('ELSE')) {
      const elseTok = this.next();
      if (this.check('IF')) elseBody = [this.parseIf()];
      else elseBody = this.parseBlock(elseTok);
    }
    return { type: 'If', cond, then, else: elseBody, line: kw.line };
  };

  Parser.prototype.parseFunction = function () {
    const kw = this.next();
    const nameTok = this.peek();
    if (nameTok.type !== 'IDENT') {
      throw syntaxError(nameTok.type === 'EOF' ? kw.line : nameTok.line,
        "'" + kw.value + "' sonrasında bir fonksiyon adı bekleniyordu (ör. '" + kw.value + " zigzag() { ... }')");
    }
    this.next();
    if (has(ACTIONS, nameTok.value) || has(SENSORS, nameTok.value)) {
      throw syntaxError(nameTok.line, "'" + nameTok.raw + "' zaten hazır bir komut — fonksiyonuna başka bir ad ver");
    }
    if (this.functions[nameTok.value]) {
      throw syntaxError(nameTok.line, "'" + nameTok.raw + "' fonksiyonu zaten " + this.functions[nameTok.value].line + '. satırda tanımlandı');
    }
    if (!this.accept('(')) throw syntaxError(nameTok.line, "'" + nameTok.raw + "' adından sonra '()' bekleniyordu");
    if (!this.accept(')')) throw syntaxError(this.peek().line, "')' bekleniyordu — fonksiyonlar parametre almaz");
    const def = { type: 'FunctionDef', name: nameTok.value, raw: nameTok.raw, body: null, line: kw.line };
    this.functions[nameTok.value] = def; // özyinelemeye izin vermek için gövdeden önce kaydet
    def.body = this.parseBlock(kw);
    return def;
  };

  // cond := orExpr
  Parser.prototype.parseCond = function () {
    const first = this.peek();
    if (first.type === 'EOF' || first.type === ')' || first.type === '}' || first.type === '&&' || first.type === '||') {
      throw syntaxError(first.line, 'bir koşul bekleniyordu');
    }
    return this.parseOr();
  };

  Parser.prototype.parseOr = function () {
    let left = this.parseAnd();
    while (this.check('||')) {
      const op = this.next();
      left = { type: 'Or', left, right: this.parseAnd(), line: op.line };
    }
    return left;
  };

  Parser.prototype.parseAnd = function () {
    let left = this.parseUnary();
    while (this.check('&&')) {
      const op = this.next();
      left = { type: 'And', left, right: this.parseUnary(), line: op.line };
    }
    return left;
  };

  Parser.prototype.parseUnary = function () {
    const tok = this.peek();
    if (tok.type === '!') {
      this.next();
      return { type: 'Not', operand: this.parseUnary(), line: tok.line };
    }
    if (tok.type === '(') {
      this.next();
      const inner = this.parseCond();
      if (!this.accept(')')) {
        const t = this.peek();
        throw syntaxError(t.type === 'EOF' ? tok.line : t.line, "')' eksik görünüyor");
      }
      return inner;
    }
    if (tok.type === 'IDENT') {
      const call = this.parseCall();
      const node = { type: 'Sensor', name: call.name, raw: call.raw, line: call.line };
      this.condCalls.push(node);
      return node;
    }
    if (tok.type === 'EOF') throw syntaxError(tok.line, 'koşul yarım kalmış');
    throw syntaxError(tok.line, 'koşul bekleniyordu ama ' + describe(tok) + ' bulundu');
  };

  // Tüm fonksiyon tanımları toplandıktan sonra adları çözümle (statik kontrol).
  Parser.prototype.resolve = function () {
    const userNames = Object.keys(this.functions);
    const allNames = Object.keys(ACTIONS).concat(Object.keys(SENSORS), userNames);

    const unknown = (node) => {
      const s = suggest(node.name, allNames);
      let msg = "'" + node.raw + "' diye bir komut yok.";
      if (s) msg += " '" + s + "' mi demek istedin?";
      return syntaxError(node.line, msg);
    };

    // Hataları satır sırasıyla bildir.
    const all = this.calls.map((c) => ({ node: c, cond: false }))
      .concat(this.condCalls.map((c) => ({ node: c, cond: true })));
    all.sort((a, b) => a.node.line - b.node.line);

    for (const { node, cond } of all) {
      if (!cond) {
        if (has(ACTIONS, node.name)) { node.kind = 'action'; node.method = ACTIONS[node.name]; }
        else if (this.functions[node.name]) { node.kind = 'user'; }
        else if (has(SENSORS, node.name)) {
          throw syntaxError(node.line, "'" + node.raw + "()' bir soru (sensör) — tek başına kullanılmaz, 'if'/'while' koşulunda kullan");
        } else throw unknown(node);
      } else {
        if (has(SENSORS, node.name)) { node.method = SENSORS[node.name]; }
        else if (has(ACTIONS, node.name)) {
          throw syntaxError(node.line, "'" + node.raw + "()' bir eylem — koşulda yalnızca sensörler (ör. 'onumBos()') kullanılabilir");
        } else if (this.functions[node.name]) {
          throw syntaxError(node.line, "'" + node.raw + "()' senin fonksiyonun — koşulda yalnızca sensörler (ör. 'onumBos()') kullanılabilir");
        } else throw unknown(node);
      }
    }
  };

  function parse(source) {
    if (typeof source !== 'string') source = String(source == null ? '' : source);
    const parser = new Parser(tokenize(source));
    return parser.parseProgram();
  }

  // ---------------------------------------------------------------------------
  // Yorumlayıcı
  // ---------------------------------------------------------------------------
  function run(ast, world, options) {
    const opts = options || {};
    const maxSteps = opts.maxSteps == null ? DEFAULT_MAX_STEPS : opts.maxSteps;
    const functions = ast.functions || {};
    let steps = 0;
    let depth = 0;

    function step(line) {
      steps++;
      if (steps > maxSteps) {
        throw new CodeError('Çok fazla adım — sonsuz döngü olabilir mi?', line, 'runtime');
      }
    }

    function callWorld(method, line) {
      try {
        return world[method]();
      } catch (e) {
        if (e instanceof CodeError) throw e;
        throw new CodeError(e && e.message ? e.message : String(e), line, 'runtime');
      }
    }

    function evalCond(node) {
      switch (node.type) {
        case 'Sensor': return !!callWorld(node.method, node.line);
        case 'Not': return !evalCond(node.operand);
        case 'And': return evalCond(node.left) && evalCond(node.right);
        case 'Or': return evalCond(node.left) || evalCond(node.right);
        default: throw new CodeError('Bilinmeyen koşul türü: ' + node.type, node.line, 'runtime');
      }
    }

    function checkCond(node, line) {
      step(line);
      return evalCond(node);
    }

    function* execBlock(stmts) {
      for (let i = 0; i < stmts.length; i++) yield* execStmt(stmts[i]);
    }

    function* execStmt(node) {
      switch (node.type) {
        case 'FunctionDef':
        case 'Empty':
          return;
        case 'Call':
          step(node.line);
          if (node.kind === 'action') {
            callWorld(node.method, node.line);
            yield { action: node.method, line: node.line };
          } else if (node.kind === 'user') {
            const def = functions[node.name];
            if (depth >= MAX_CALL_DEPTH) {
              throw new CodeError('Fonksiyonlar birbirini çok derin çağırıyor (en fazla ' + MAX_CALL_DEPTH +
                ') — özyineleme hiç durmuyor olabilir mi?', node.line, 'runtime');
            }
            depth++;
            try {
              yield* execBlock(def.body);
            } finally {
              depth--;
            }
          } else {
            throw new CodeError("'" + node.raw + "' diye bir komut yok.", node.line, 'runtime');
          }
          return;
        case 'Repeat':
          step(node.line);
          for (let i = 0; i < node.count; i++) yield* execBlock(node.body);
          return;
        case 'While':
          step(node.line);
          while (checkCond(node.cond, node.line)) yield* execBlock(node.body);
          return;
        case 'If':
          step(node.line);
          if (checkCond(node.cond, node.line)) yield* execBlock(node.then);
          else if (node.else) yield* execBlock(node.else);
          return;
        default:
          throw new CodeError('Bilinmeyen deyim türü: ' + node.type, node.line, 'runtime');
      }
    }

    return (function* () {
      yield* execBlock(ast.body);
    })();
  }

  // ---------------------------------------------------------------------------
  // "Kod satırı" sayımı: boş satırlar, yalnızca yorum içeren satırlar ve
  // yalnızca '}' içeren satırlar sayılmaz.
  // ---------------------------------------------------------------------------
  function countLines(source) {
    if (!source) return 0;
    let count = 0;
    for (const rawLine of String(source).split('\n')) {
      const idx = rawLine.indexOf('//');
      const line = (idx === -1 ? rawLine : rawLine.slice(0, idx)).trim();
      if (line === '') continue;
      if (/^[}\s;]+$/.test(line)) continue; // yalnızca '}' (ve olası ';')
      count++;
    }
    return count;
  }

  CodeGame.CodeError = CodeError;
  CodeGame.Interpreter = {
    parse,
    run,
    countLines,
    tokenize,
    editDistance,
    MAX_CALL_DEPTH,
    DEFAULT_MAX_STEPS,
    ACTIONS,
    SENSORS,
    KEYWORDS,
  };

  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
