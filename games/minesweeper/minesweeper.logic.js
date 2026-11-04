// Minesweeper rules. Mines are laid on the first reveal, so the first click is always safe.
const MinesLogic = (() => {
  const PRESETS = {
    easy: { rows: 9, cols: 9, mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard: { rows: 16, cols: 30, mines: 99 },
  };

  // A hostile or half-typed custom setup must never reach the board code.
  function clampConfig({ rows, cols, mines }) {
    const clamp = (n, lo, hi, fallback) => {
      const v = Math.round(Number(n));
      return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
    };
    const r = clamp(rows, 5, 30, 9);
    const c = clamp(cols, 5, 40, 9);
    // The first click clears up to nine cells, which must stay free of mines.
    const m = clamp(mines, 1, r * c - 9, 10);
    return { rows: r, cols: c, mines: m };
  }

  function create(config, rng = Math.random) {
    const { rows, cols, mines } = clampConfig(config);
    return {
      rows, cols, mines, rng,
      cells: Array.from({ length: rows * cols }, () => ({ mine: false, open: false, flag: false, count: 0 })),
      status: 'ready',
      opened: 0,
      flags: 0,
    };
  }

  function neighbours(s, index) {
    const r = Math.floor(index / s.cols);
    const c = index % s.cols;
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if ((dr || dc) && nr >= 0 && nc >= 0 && nr < s.rows && nc < s.cols) out.push(nr * s.cols + nc);
      }
    }
    return out;
  }

  function layMines(s, safeIndex) {
    const safe = new Set([safeIndex, ...neighbours(s, safeIndex)]);
    const spots = [];
    for (let i = 0; i < s.cells.length; i++) if (!safe.has(i)) spots.push(i);
    for (let i = 0; i < s.mines; i++) {
      const j = i + Math.floor(s.rng() * (spots.length - i));
      [spots[i], spots[j]] = [spots[j], spots[i]];
      s.cells[spots[i]].mine = true;
    }
    s.cells.forEach((cell, i) => {
      cell.count = neighbours(s, i).filter((n) => s.cells[n].mine).length;
    });
    s.status = 'playing';
  }

  function finish(s, status) {
    s.status = status;
    if (status === 'won') {
      for (const cell of s.cells) if (cell.mine && !cell.flag) { cell.flag = true; s.flags++; }
    }
  }

  function reveal(s, index) {
    if (s.status === 'ready') layMines(s, index);
    if (s.status !== 'playing') return s.status;
    const first = s.cells[index];
    if (first.open || first.flag) return s.status;
    if (first.mine) {
      first.open = true;
      finish(s, 'lost');
      return s.status;
    }
    // An explicit stack: a large empty board would overflow the call stack if this recursed.
    const stack = [index];
    while (stack.length) {
      const i = stack.pop();
      const cell = s.cells[i];
      if (cell.open || cell.flag) continue;
      cell.open = true;
      s.opened++;
      if (cell.count === 0) stack.push(...neighbours(s, i));
    }
    if (s.opened === s.cells.length - s.mines) finish(s, 'won');
    return s.status;
  }

  function toggleFlag(s, index) {
    const cell = s.cells[index];
    if ((s.status !== 'playing' && s.status !== 'ready') || cell.open) return false;
    cell.flag = !cell.flag;
    s.flags += cell.flag ? 1 : -1;
    return true;
  }

  // Clicking an opened number whose flags are all placed opens the rest of its neighbours.
  function chord(s, index) {
    const cell = s.cells[index];
    if (s.status !== 'playing' || !cell.open || cell.count === 0) return false;
    const around = neighbours(s, index);
    if (around.filter((n) => s.cells[n].flag).length !== cell.count) return false;
    let opened = false;
    for (const n of around) {
      const other = s.cells[n];
      if (!other.open && !other.flag) {
        reveal(s, n);
        opened = true;
        if (s.status !== 'playing') break;
      }
    }
    return opened;
  }

  return { PRESETS, clampConfig, create, neighbours, reveal, toggleFlag, chord };
})();
if (typeof module !== 'undefined') module.exports = MinesLogic;
