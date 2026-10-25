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

  // blok türü -> world metodu
  const ACTIONS = { move: 'move', left: 'turnLeft', right: 'turnRight', pick: 'pick' };
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
      const method = ACTIONS[block.type];
      if (!method) throw new BlockError('Bilinmeyen blok: ' + block.type, path);
      if (++steps > maxSteps) throw new BlockError('Çok fazla adım!', path);
      try {
        world[method]();
      } catch (e) {
        throw new BlockError(e.message, path);
      }
      yield { action: method, path };
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
  CodeGame.Blocks = { run, count, ACTIONS, DEFAULT_MAX_STEPS };

  if (typeof module !== 'undefined') module.exports = CodeGame;
})(typeof window !== 'undefined' ? window : globalThis);
