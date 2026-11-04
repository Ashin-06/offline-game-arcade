// Sliding merge rules, free of any page code so they can be checked from Node.
const Merge2048Logic = (() => {
  const SIZE = 4;

  const emptyGrid = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

  // Coordinates of one line, ordered from the side the tiles slide towards.
  function lineCells(index, dir) {
    const cells = [];
    for (let i = 0; i < SIZE; i++) {
      if (dir === 'left') cells.push([index, i]);
      if (dir === 'right') cells.push([index, SIZE - 1 - i]);
      if (dir === 'up') cells.push([i, index]);
      if (dir === 'down') cells.push([SIZE - 1 - i, index]);
    }
    return cells;
  }

  // Returns the new grid, whether anything moved, the points gained and the cells that merged.
  // A tile that has just merged cannot merge again in the same move.
  function slide(grid, dir) {
    const next = emptyGrid();
    let moved = false;
    let gained = 0;
    const merged = [];
    for (let i = 0; i < SIZE; i++) {
      const cells = lineCells(i, dir);
      const values = cells.map(([r, c]) => grid[r][c]).filter(Boolean);
      const out = [];
      for (let j = 0; j < values.length; j++) {
        if (values[j] === values[j + 1]) {
          const doubled = values[j] * 2;
          gained += doubled;
          merged.push(cells[out.length]);
          out.push(doubled);
          j++;
        } else {
          out.push(values[j]);
        }
      }
      cells.forEach(([r, c], k) => {
        next[r][c] = out[k] || 0;
        if (next[r][c] !== grid[r][c]) moved = true;
      });
    }
    return { grid: next, moved, gained, merged };
  }

  // Adds a 2 (or sometimes a 4) to a random free cell and returns where, or null when full.
  function spawn(grid, rng = Math.random) {
    const free = [];
    grid.forEach((row, r) => row.forEach((value, c) => { if (!value) free.push([r, c]); }));
    if (free.length === 0) return null;
    const [r, c] = free[Math.floor(rng() * free.length)];
    grid[r][c] = rng() < 0.9 ? 2 : 4;
    return [r, c];
  }

  function canMove(grid) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!grid[r][c]) return true;
        if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
        if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
      }
    }
    return false;
  }

  const hasWon = (grid) => grid.some((row) => row.includes(2048));

  return { SIZE, emptyGrid, slide, spawn, canMove, hasWon };
})();
if (typeof module !== 'undefined') module.exports = Merge2048Logic;
