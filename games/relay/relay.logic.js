// Relay: turn the tiles until the whole grid is wired back to the core.
// A tile's links are a bitmask: 1 north, 2 east, 4 south, 8 west.
const RelayLogic = (() => {
  const N = 1;
  const E = 2;
  const S = 4;
  const W = 8;
  const DIRS = [
    { bit: N, back: S, dr: -1, dc: 0 },
    { bit: E, back: W, dr: 0, dc: 1 },
    { bit: S, back: N, dr: 1, dc: 0 },
    { bit: W, back: E, dr: 0, dc: -1 },
  ];
  const turnMask = (mask, times = 1) => {
    let m = mask;
    for (let i = 0; i < ((times % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
    return m;
  };

  // A random spanning tree grown out from the centre, which is what guarantees a solution.
  function buildTree(size, rng) {
    const links = new Array(size * size).fill(0);
    const core = Math.floor(size / 2) * size + Math.floor(size / 2);
    const inTree = new Set([core]);
    const open = [core];
    while (open.length) {
      // Usually extend the newest branch and sometimes an old one, for a mix of runs and forks.
      const pos = rng() < 0.7 ? open.length - 1 : Math.floor(rng() * open.length);
      const here = open[pos];
      const r = Math.floor(here / size);
      const c = here % size;
      const choices = DIRS.filter((d) => {
        const nr = r + d.dr;
        const nc = c + d.dc;
        return nr >= 0 && nc >= 0 && nr < size && nc < size && !inTree.has(nr * size + nc);
      });
      if (choices.length === 0) {
        open.splice(pos, 1);
        continue;
      }
      const d = choices[Math.floor(rng() * choices.length)];
      const next = (r + d.dr) * size + (c + d.dc);
      links[here] |= d.bit;
      links[next] |= d.back;
      inTree.add(next);
      open.push(next);
    }
    return { links, core };
  }

  // Cells reachable from the core through links that meet on both sides.
  function litCells(s) {
    const lit = new Set([s.core]);
    const stack = [s.core];
    while (stack.length) {
      const here = stack.pop();
      const r = Math.floor(here / s.size);
      const c = here % s.size;
      const mask = currentMask(s, here);
      for (const d of DIRS) {
        if (!(mask & d.bit)) continue;
        const nr = r + d.dr;
        const nc = c + d.dc;
        if (nr < 0 || nc < 0 || nr >= s.size || nc >= s.size) continue;
        const next = nr * s.size + nc;
        if (!lit.has(next) && currentMask(s, next) & d.back) {
          lit.add(next);
          stack.push(next);
        }
      }
    }
    return lit;
  }

  const currentMask = (s, i) => turnMask(s.base[i], s.turns[i]);

  // The tree has one link fewer than it has cells, so lighting every cell uses every link
  // and leaves no loose ends: all lit means solved, whichever arrangement got there.
  const isSolved = (s) => litCells(s).size === s.size * s.size;

  function create({ size = 5, rng = Math.random } = {}) {
    const { links, core } = buildTree(size, rng);
    const s = { size, core, base: links, turns: new Array(size * size).fill(0), moves: 0 };
    do {
      for (let i = 0; i < s.turns.length; i++) s.turns[i] = Math.floor(rng() * 4);
    } while (isSolved(s));
    return s;
  }

  function rotate(s, index, dir = 1) {
    s.turns[index] += dir;
    s.moves++;
  }

  return { N, E, S, W, turnMask, buildTree, create, rotate, litCells, isSolved, currentMask };
})();
if (typeof module !== 'undefined') module.exports = RelayLogic;
