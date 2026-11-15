/*
 * KodRobot — blok programı motoru.
 * Bkz. CONTRACT.md ("Bloklar", "CodeGame.Blocks").
 */
(function (root) {
  const CodeGame = root.CodeGame = root.CodeGame || {};

  class BlockError extends Error {
    constructor(message, path) {
      super(message);
      this.name = 'BlockError';
      this.path = path;
    }
  }

  // Ok blokları ekrana göredir: ok hangi yönü gösteriyorsa robot oraya gider.
  const DIRECTIONS = { up: 'N', right: 'E', down: 'S', left: 'W' };
  const DEFAULT_MAX_STEPS = 500;

  function run(program, world, options) {
    const maxSteps = (options && options.maxSteps) || DEFAULT_MAX_STEPS;
    let steps = 0;

    function* execList(blocks, prefix) {
      for (let i = 0; i < blocks.length; i++) yield* exec(blocks[i], prefix.concat(i));
    }

    function* exec(block, path) {
      if (block.type === 'loop') {
        for (let n = 0; n < block.count; n++) yield* execList(block.body || [], path);
        return;
      }
      const dir = DIRECTIONS[block.type];
      if (!dir && block.type !== 'pick') throw new BlockError('Bilinmeyen blok: ' + block.type, path);
      if (++steps > maxSteps) throw new BlockError('Çok fazla adım!', path);
      try {
        if (dir) world.go(dir);
        else world.pick();
      } catch (e) {
        throw new BlockError(e.message, path);
      }
      yield { action: dir ? 'move' : 'pick', path };
    }

    return execList(program, []);
  }

  function count(program) {
    let n = 0;
    for (const block of program) {
      n++;
      if (block.type === 'loop') n += count(block.body || []);
    }
    return n;
  }

  CodeGame.BlockError = BlockError;
  CodeGame.Blocks = { run, count, DIRECTIONS, DEFAULT_MAX_STEPS };

  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
