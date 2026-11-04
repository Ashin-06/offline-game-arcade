// Sudoku generator and rules. A grid is an array of 81 numbers, 0 meaning empty.
const SudokuLogic = (() => {
  const ALL = 0x3fe;
  const box = (i) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);
  const LEVELS = {
    easy: { clues: 40, singles: true },
    medium: { clues: 32, singles: true },
    hard: { clues: 26, singles: false },
  };

  const PEERS = Array.from({ length: 81 }, (_, i) => {
    const out = [];
    for (let j = 0; j < 81; j++) {
      if (j !== i && (j % 9 === i % 9 || Math.floor(j / 9) === Math.floor(i / 9) || box(j) === box(i))) out.push(j);
    }
    return out;
  });
  const UNITS = [];
  for (let n = 0; n < 9; n++) {
    UNITS.push(Array.from({ length: 81 }, (_, i) => i).filter((i) => Math.floor(i / 9) === n));
    UNITS.push(Array.from({ length: 81 }, (_, i) => i).filter((i) => i % 9 === n));
    UNITS.push(Array.from({ length: 81 }, (_, i) => i).filter((i) => box(i) === n));
  }

  function shuffle(list, rng) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  const bitCount = (n) => {
    let c = 0;
    for (let b = n; b; b &= b - 1) c++;
    return c;
  };

  // Backtracking that always tries the most constrained cell first. Counts up to `limit`
  // solutions and keeps the first one in `out`. Passing rng randomises the digit order.
  function search(grid, limit, rng, out) {
    const rows = new Array(9).fill(0);
    const cols = new Array(9).fill(0);
    const boxes = new Array(9).fill(0);
    const cells = grid.slice();
    for (let i = 0; i < 81; i++) {
      if (cells[i]) {
        const bit = 1 << cells[i];
        const r = Math.floor(i / 9);
        const c = i % 9;
        const b = box(i);
        if ((rows[r] | cols[c] | boxes[b]) & bit) return 0;
        rows[r] |= bit;
        cols[c] |= bit;
        boxes[b] |= bit;
      }
    }
    let found = 0;
    function go() {
      let bestI = -1;
      let bestCount = 10;
      let bestMask = 0;
      for (let i = 0; i < 81; i++) {
        if (cells[i]) continue;
        const mask = ALL & ~(rows[Math.floor(i / 9)] | cols[i % 9] | boxes[box(i)]);
        const count = bitCount(mask);
        if (count < bestCount) {
          bestI = i;
          bestCount = count;
          bestMask = mask;
          if (count <= 1) break;
        }
      }
      if (bestI < 0) {
        if (found === 0 && out) out.push(...cells);
        found++;
        return;
      }
      const digits = [];
      for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
      if (rng) shuffle(digits, rng);
      const r = Math.floor(bestI / 9);
      const c = bestI % 9;
      const b = box(bestI);
      for (const d of digits) {
        const bit = 1 << d;
        cells[bestI] = d;
        rows[r] |= bit;
        cols[c] |= bit;
        boxes[b] |= bit;
        go();
        rows[r] &= ~bit;
        cols[c] &= ~bit;
        boxes[b] &= ~bit;
        cells[bestI] = 0;
        if (found >= limit) return;
      }
    }
    go();
    return found;
  }

  const countSolutions = (grid, limit = 2) => search(grid, limit);

  function solve(grid) {
    const out = [];
    return search(grid, 1, null, out) ? out : null;
  }

  // True when the puzzle falls to naked and hidden singles alone, so it never needs a guess.
  function solvableBySingles(puzzle) {
    const cells = puzzle.slice();
    const candidates = (i) => {
      let mask = ALL;
      for (const p of PEERS[i]) if (cells[p]) mask &= ~(1 << cells[p]);
      return mask;
    };
    let progress = true;
    while (progress) {
      progress = false;
      for (let i = 0; i < 81; i++) {
        if (cells[i]) continue;
        const mask = candidates(i);
        if (bitCount(mask) === 1) {
          cells[i] = Math.log2(mask);
          progress = true;
        }
      }
      for (const unit of UNITS) {
        for (let d = 1; d <= 9; d++) {
          if (unit.some((i) => cells[i] === d)) continue;
          const spots = unit.filter((i) => !cells[i] && candidates(i) & (1 << d));
          if (spots.length === 1) {
            cells[spots[0]] = d;
            progress = true;
          }
        }
      }
    }
    return cells.every(Boolean);
  }

  function dig(solution, targetClues, rng) {
    const puzzle = solution.slice();
    let clues = 81;
    // Pairs mirrored through the centre give the usual symmetric look.
    const order = shuffle(Array.from({ length: 41 }, (_, i) => i), rng);
    for (const i of order) {
      if (clues <= targetClues) break;
      const j = 80 - i;
      const saved = [puzzle[i], puzzle[j]];
      puzzle[i] = 0;
      puzzle[j] = 0;
      if (countSolutions(puzzle, 2) === 1) clues -= i === j ? 1 : 2;
      else [puzzle[i], puzzle[j]] = saved;
    }
    return puzzle;
  }

  function generate(level = 'medium', rng = Math.random) {
    const { clues, singles } = LEVELS[level];
    let fallback = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      const solution = [];
      search(new Array(81).fill(0), 1, rng, solution);
      const puzzle = dig(solution, clues, rng);
      const easy = solvableBySingles(puzzle);
      const result = { puzzle, solution };
      if (easy === singles) return result;
      if (!fallback) fallback = result;
    }
    return fallback;
  }

  // Indices of every filled cell that repeats a digit in its row, column or box.
  function conflicts(cells) {
    const out = new Set();
    for (let i = 0; i < 81; i++) {
      if (!cells[i]) continue;
      for (const p of PEERS[i]) if (cells[p] === cells[i]) { out.add(i); break; }
    }
    return out;
  }

  const isComplete = (cells) => cells.every(Boolean) && conflicts(cells).size === 0;

  return { LEVELS, PEERS, box, countSolutions, solve, solvableBySingles, generate, conflicts, isComplete };
})();
if (typeof module !== 'undefined') module.exports = SudokuLogic;
