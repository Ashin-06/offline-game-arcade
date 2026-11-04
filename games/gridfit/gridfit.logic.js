// Grid Fit: place the three pieces from the tray anywhere they fit. Full rows and columns clear.
// The game ends when none of the pieces left in the tray has a place to go.
const GridFitLogic = (() => {
  const SIZE = 9;
  const SHAPES = [
    [[1]],
    [[1, 1]], [[1], [1]],
    [[1, 1, 1]], [[1], [1], [1]],
    [[1, 1, 1, 1]], [[1], [1], [1], [1]],
    [[1, 1, 1, 1, 1]], [[1], [1], [1], [1], [1]],
    [[1, 1], [1, 1]],
    [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
    [[1, 0], [1, 1]], [[0, 1], [1, 1]], [[1, 1], [1, 0]], [[1, 1], [0, 1]],
    [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]], [[1, 1, 1], [1, 0, 0]], [[1, 1, 1], [0, 0, 1]],
    [[0, 1, 0], [1, 1, 1]], [[1, 1, 1], [0, 1, 0]],
    [[1, 0], [1, 1], [0, 1]], [[0, 1], [1, 1], [1, 0]],
  ];
  const COLORS = 6;

  function canPlace(s, shape, r, c) {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        const nr = r + y;
        const nc = c + x;
        if (nr < 0 || nc < 0 || nr >= SIZE || nc >= SIZE || s.board[nr][nc]) return false;
      }
    }
    return true;
  }

  function fitsAnywhere(s, shape) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) if (canPlace(s, shape, r, c)) return true;
    }
    return false;
  }

  const newPiece = (s, shape = SHAPES[Math.floor(s.rng() * SHAPES.length)]) => ({ shape, color: 1 + Math.floor(s.rng() * COLORS) });

  // A fresh tray always has at least one piece that fits, as long as any piece can.
  function refill(s) {
    s.tray = [newPiece(s), newPiece(s), newPiece(s)];
    if (s.tray.some((p) => fitsAnywhere(s, p.shape))) return;
    const usable = SHAPES.filter((shape) => fitsAnywhere(s, shape));
    if (usable.length) s.tray[0] = newPiece(s, usable[Math.floor(s.rng() * usable.length)]);
  }

  function checkOver(s) {
    s.over = !s.tray.some((p) => p && fitsAnywhere(s, p.shape));
  }

  function create({ rng = Math.random } = {}) {
    const s = {
      rng,
      board: Array.from({ length: SIZE }, () => new Array(SIZE).fill(0)),
      tray: [],
      score: 0,
      streak: 0,
      over: false,
    };
    refill(s);
    return s;
  }

  // Places tray piece `index` with its top-left at (r, c). Returns null if it does not fit, or
  // { lines, gained, cleared }.
  function place(s, index, r, c) {
    const piece = s.tray[index];
    if (s.over || !piece || !canPlace(s, piece.shape, r, c)) return null;
    let cells = 0;
    piece.shape.forEach((row, y) => row.forEach((on, x) => {
      if (on) { s.board[r + y][c + x] = piece.color; cells++; }
    }));
    s.tray[index] = null;

    const fullRows = [];
    const fullCols = [];
    for (let i = 0; i < SIZE; i++) {
      if (s.board[i].every(Boolean)) fullRows.push(i);
      if (s.board.every((row) => row[i])) fullCols.push(i);
    }
    // Rows and columns are found first and cleared together, so a crossing cell counts for both.
    const cleared = [];
    for (const row of fullRows) for (let i = 0; i < SIZE; i++) cleared.push([row, i]);
    for (const col of fullCols) for (let i = 0; i < SIZE; i++) cleared.push([i, col]);
    for (const [y, x] of cleared) s.board[y][x] = 0;

    const lines = fullRows.length + fullCols.length;
    s.streak = lines ? s.streak + 1 : 0;
    const gained = cells + lines * lines * 18 * Math.max(1, s.streak);
    s.score += gained;
    if (s.tray.every((p) => !p)) refill(s);
    checkOver(s);
    return { lines, gained, cleared };
  }

  return { SIZE, SHAPES, canPlace, fitsAnywhere, create, place };
})();
if (typeof module !== 'undefined') module.exports = GridFitLogic;
