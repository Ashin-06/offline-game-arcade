// Prism Match: swap neighbours to line up three or more. A run of four makes a line tile and a
// run of five a star, which clears a whole colour when swapped.
const PrismLogic = (() => {
  const SIZE = 8;
  const COLORS = 6;
  const START_MOVES = 20;

  const targetFor = (level) => 700 + (level - 1) * 450;

  function newTile(s, c = Math.floor(s.rng() * COLORS), special = null) {
    return { id: s.nextId++, c, special };
  }

  function fillBoard(s) {
    s.board = Array.from({ length: SIZE }, () => new Array(SIZE).fill(null));
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        // Colours that would finish a run on the spot are left out, so a board starts settled.
        const banned = new Set();
        if (c >= 2 && s.board[r][c - 1].c === s.board[r][c - 2].c) banned.add(s.board[r][c - 1].c);
        if (r >= 2 && s.board[r - 1][c].c === s.board[r - 2][c].c) banned.add(s.board[r - 1][c].c);
        const choices = [];
        for (let k = 0; k < COLORS; k++) if (!banned.has(k)) choices.push(k);
        s.board[r][c] = newTile(s, choices[Math.floor(s.rng() * choices.length)]);
      }
    }
  }

  function create({ rng = Math.random } = {}) {
    const s = { rng, nextId: 1, board: [], score: 0, levelScore: 0, level: 1, moves: START_MOVES, over: false, won: false };
    do fillBoard(s);
    while (!hasMove(s));
    return s;
  }

  // Runs of three or more, each a list of [r, c]. Stars have no colour and match nothing.
  function findRuns(board) {
    const runs = [];
    const scan = (get) => {
      for (let a = 0; a < SIZE; a++) {
        let start = 0;
        for (let b = 1; b <= SIZE; b++) {
          const here = b < SIZE ? get(a, b) : null;
          const prev = get(a, start);
          if (here && prev && here.special !== 'star' && prev.special !== 'star' && here.c === prev.c) continue;
          if (b - start >= 3 && prev.special !== 'star') {
            const cells = [];
            for (let i = start; i < b; i++) cells.push(get.at(a, i));
            runs.push(cells);
          }
          start = b;
        }
      }
    };
    const rowGet = (a, b) => board[a][b];
    rowGet.at = (a, b) => [a, b];
    const colGet = (a, b) => board[b][a];
    colGet.at = (a, b) => [b, a];
    scan(rowGet);
    scan(colGet);
    return runs;
  }

  const neighbours = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

  function swapTiles(board, a, b) {
    const t = board[a[0]][a[1]];
    board[a[0]][a[1]] = board[b[0]][b[1]];
    board[b[0]][b[1]] = t;
  }

  function hasMove(s) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (s.board[r][c].special === 'star') return true;
        for (const [nr, nc] of [[r + 1, c], [r, c + 1]]) {
          if (nr >= SIZE || nc >= SIZE) continue;
          swapTiles(s.board, [r, c], [nr, nc]);
          const works = findRuns(s.board).length > 0;
          swapTiles(s.board, [r, c], [nr, nc]);
          if (works) return true;
        }
      }
    }
    return false;
  }

  // Everything a cleared cell takes with it: a line tile clears its row or column, a star its colour.
  function expand(s, cells) {
    const clear = new Set(cells.map(([r, c]) => r * SIZE + c));
    const queue = [...clear];
    while (queue.length) {
      const key = queue.pop();
      const r = Math.floor(key / SIZE);
      const c = key % SIZE;
      const tile = s.board[r][c];
      if (!tile) continue;
      const add = (nr, nc) => {
        const k = nr * SIZE + nc;
        if (!clear.has(k)) { clear.add(k); queue.push(k); }
      };
      if (tile.special === 'row') for (let i = 0; i < SIZE; i++) add(r, i);
      if (tile.special === 'col') for (let i = 0; i < SIZE; i++) add(i, c);
    }
    return clear;
  }

  function dropAndRefill(s) {
    for (let c = 0; c < SIZE; c++) {
      let write = SIZE - 1;
      for (let r = SIZE - 1; r >= 0; r--) {
        if (s.board[r][c]) {
          const tile = s.board[r][c];
          s.board[r][c] = null;
          s.board[write][c] = tile;
          write--;
        }
      }
      for (let r = write; r >= 0; r--) s.board[r][c] = newTile(s);
    }
  }

  // Clears runs until the board settles. `steps` lists each stage so the page can animate it.
  function cascade(s, swapped, firstClear = null) {
    const steps = [];
    let chain = 1;
    let pendingClear = firstClear;
    for (;;) {
      const runs = findRuns(s.board);
      if (runs.length === 0 && !pendingClear) break;
      const cells = runs.flat();
      if (pendingClear) cells.push(...pendingClear);
      pendingClear = null;
      const clear = expand(s, cells);

      // Long runs leave a special tile behind, on the swapped cell if the run passes through it.
      const makes = [];
      for (const run of runs) {
        if (run.length < 4) continue;
        const pivot = run.find(([r, c]) => swapped && swapped.some(([a, b]) => a === r && b === c)) || run[Math.floor(run.length / 2)];
        const tile = s.board[pivot[0]][pivot[1]];
        const horizontal = run[0][0] === run[1][0];
        makes.push({ pivot, c: tile.c, special: run.length >= 5 ? 'star' : horizontal ? 'row' : 'col' });
      }

      const gained = clear.size * 10 * chain;
      s.score += gained;
      s.levelScore += gained;
      const cleared = [...clear].map((k) => [Math.floor(k / SIZE), k % SIZE]);
      for (const [r, c] of cleared) s.board[r][c] = null;
      for (const m of makes) {
        if (!s.board[m.pivot[0]][m.pivot[1]]) s.board[m.pivot[0]][m.pivot[1]] = newTile(s, m.c, m.special);
      }
      dropAndRefill(s);
      steps.push({ cleared, gained, chain });
      chain++;
    }
    return steps;
  }

  function reshuffle(s) {
    const tiles = s.board.flat();
    for (let attempt = 0; attempt < 200; attempt++) {
      for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(s.rng() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }
      s.board = Array.from({ length: SIZE }, (_, r) => tiles.slice(r * SIZE, (r + 1) * SIZE));
      if (findRuns(s.board).length === 0 && hasMove(s)) return;
    }
    do fillBoard(s);
    while (!hasMove(s));
  }

  // Tries a swap. Returns null if it makes nothing happen, leaving the board as it was. Otherwise
  // returns { steps, levelUp, reshuffled } and uses a move.
  function trySwap(s, a, b) {
    if (s.over || !neighbours(a, b)) return null;
    const ta = s.board[a[0]][a[1]];
    const tb = s.board[b[0]][b[1]];
    let firstClear = null;
    if (ta.special === 'star' || tb.special === 'star') {
      const colour = ta.special === 'star' ? tb.c : ta.c;
      firstClear = [a, b];
      if (ta.special !== 'star' || tb.special !== 'star') {
        s.board.forEach((row, r) => row.forEach((tile, c) => { if (tile.c === colour) firstClear.push([r, c]); }));
      } else {
        // Two stars together clear the board.
        s.board.forEach((row, r) => row.forEach((_, c) => firstClear.push([r, c])));
      }
    } else {
      swapTiles(s.board, a, b);
      if (findRuns(s.board).length === 0) {
        swapTiles(s.board, a, b);
        return null;
      }
    }
    s.moves--;
    const steps = cascade(s, [a, b], firstClear);
    const out = { steps, levelUp: false, reshuffled: false };
    if (s.levelScore >= targetFor(s.level)) {
      s.level++;
      s.levelScore = 0;
      s.moves = START_MOVES;
      out.levelUp = true;
    } else if (s.moves === 0) {
      s.over = true;
    }
    if (!s.over && !hasMove(s)) {
      reshuffle(s);
      out.reshuffled = true;
    }
    return out;
  }

  return { SIZE, COLORS, START_MOVES, targetFor, create, findRuns, hasMove, neighbours, trySwap, reshuffle };
})();
if (typeof module !== 'undefined') module.exports = PrismLogic;
