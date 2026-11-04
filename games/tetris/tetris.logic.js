// Falling block rules, free of any page code so they can be checked from Node.
const TetrisLogic = (() => {
  const ROWS = 20;
  const COLS = 12;
  const SHAPES = [
    [[1, 1, 1, 1]],
    [[0, 2, 0], [2, 2, 2]],
    [[3, 3, 0], [0, 3, 3]],
    [[0, 4, 4], [4, 4, 0]],
    [[5, 5], [5, 5]],
    [[6, 0, 0], [6, 6, 6]],
    [[0, 0, 7], [7, 7, 7]],
  ];
  const CLEAR_SCORES = [0, 10, 30, 70, 150];

  // Reads columns from a rectangular matrix, so a 1 x 4 piece becomes 4 x 1 with all its cells.
  const rotate = (matrix) => matrix[0].map((_, x) => matrix.map((row) => row[x]).reverse());

  function collides(board, matrix, px, py) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (!matrix[y][x]) continue;
        const bx = px + x;
        const by = py + y;
        if (bx < 0 || bx >= COLS || by >= ROWS || (by >= 0 && board[by][bx])) return true;
      }
    }
    return false;
  }

  function spawn(s) {
    const matrix = SHAPES[Math.floor(s.rng() * SHAPES.length)];
    s.piece = { matrix, x: Math.floor((COLS - matrix[0].length) / 2), y: 0 };
    if (collides(s.board, matrix, s.piece.x, 0)) s.over = true;
  }

  function create({ rng = Math.random } = {}) {
    const s = {
      rng,
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
      piece: null,
      score: 0,
      lines: 0,
      over: false,
    };
    spawn(s);
    return s;
  }

  const level = (s) => Math.floor(s.lines / 10) + 1;
  const interval = (s) => Math.max(120, 1000 - (level(s) - 1) * 80);

  function move(s, dx) {
    if (s.over || collides(s.board, s.piece.matrix, s.piece.x + dx, s.piece.y)) return false;
    s.piece.x += dx;
    return true;
  }

  function turn(s) {
    if (s.over) return false;
    const rotated = rotate(s.piece.matrix);
    for (const offset of [0, 1, -1, 2, -2]) {
      if (!collides(s.board, rotated, s.piece.x + offset, s.piece.y)) {
        s.piece.matrix = rotated;
        s.piece.x += offset;
        return true;
      }
    }
    return false;
  }

  function lock(s) {
    s.piece.matrix.forEach((row, y) => row.forEach((value, x) => {
      if (value) s.board[s.piece.y + y][s.piece.x + x] = value;
    }));
    const kept = s.board.filter((row) => row.some((cell) => !cell));
    const cleared = ROWS - kept.length;
    while (kept.length < ROWS) kept.unshift(Array(COLS).fill(0));
    s.board = kept;
    s.lines += cleared;
    s.score += CLEAR_SCORES[cleared];
    spawn(s);
    return cleared;
  }

  // Moves down one row. Returns null if the piece fell, or the lines cleared if it locked.
  function drop(s) {
    if (s.over) return null;
    if (!collides(s.board, s.piece.matrix, s.piece.x, s.piece.y + 1)) {
      s.piece.y++;
      return null;
    }
    return lock(s);
  }

  function hardDrop(s) {
    if (s.over) return null;
    while (!collides(s.board, s.piece.matrix, s.piece.x, s.piece.y + 1)) s.piece.y++;
    return lock(s);
  }

  return { ROWS, COLS, SHAPES, rotate, collides, create, level, interval, move, turn, drop, hardDrop };
})();
if (typeof module !== 'undefined') module.exports = TetrisLogic;
