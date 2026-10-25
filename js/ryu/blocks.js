/*
 * Ryu'nun Kod Macerası — blok programı motoru.
 * Bkz. CONTRACT.md ("CodeGame.Ryu.Blocks").
 */
(function (root) {
  const CodeGame = root.CodeGame = root.CodeGame || {};
  const Ryu = CodeGame.Ryu = CodeGame.Ryu || {};

  class BlockError extends Error {
    constructor(message, path) {
      super(message);
      this.name = 'BlockError';
      this.path = path;
    }
  }

  const MOVES = ['forward', 'back', 'jump', 'punch', 'hadoken', 'shoryuken', 'tatsumaki'];
  const COMBO_PREFIX = 'k';   // kombo tanımındaki blokların yolu 'k' ile başlar: ['k', 0]
  const DEFAULT_MAX_STEPS = 400;

  /**
   * Programı adım adım çalıştırır. Her hareketten sonra
   * { action, path, calls, event } verir. Ryu bayrağa varınca, düşünce ya da
   * takılınca durur.
   */
  function run(program, world, options) {
    const opts = options || {};
    const maxSteps = opts.maxSteps || DEFAULT_MAX_STEPS;
    const combo = Array.isArray(opts.combo) ? opts.combo : null;
    let steps = 0;
    const calls = [];

    function* execList(blocks, prefix) {
      for (let i = 0; i < blocks.length; i++) {
        if (world.state !== 'play') return;
        yield* exec(blocks[i], prefix.concat(i));
      }
    }

    function* exec(block, path) {
      if (block.type === 'loop') {
        for (let n = 0; n < block.count; n++) {
          if (world.state !== 'play') return;
          yield* execList(block.body || [], path);
        }
        return;
      }
      if (block.type === 'combo') {
        if (!combo) throw new BlockError('Kombo tanımlanmamış!', path);
        if (calls.length) throw new BlockError('Kombo kendini çağıramaz!', path);
        calls.push(path);
        try {
          yield* execList(combo, [COMBO_PREFIX]);
        } finally {
          calls.pop();
        }
        return;
      }
      if (MOVES.indexOf(block.type) === -1) throw new BlockError('Bilinmeyen blok: ' + block.type, path);
      if (++steps > maxSteps) throw new BlockError('Çok fazla adım!', path);
      const event = world.act(block.type);
      yield { action: block.type, path, calls: calls.slice(), event };
    }

    return execList(program, []);
  }

  function count(program) {
    let n = 0;
    for (const block of program || []) {
      n++;
      if (block.type === 'loop') n += count(block.body || []);
    }
    return n;
  }

  /** Programda kombo çağrısı var mı? */
  function usesCombo(program) {
    for (const block of program || []) {
      if (block.type === 'combo') return true;
      if (block.type === 'loop' && usesCombo(block.body)) return true;
    }
    return false;
  }

  Ryu.BlockError = BlockError;
  Ryu.Blocks = { run, count, usesCombo, MOVES, COMBO_PREFIX, DEFAULT_MAX_STEPS };

  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
