// Snake rules, free of any page code so they can be checked from Node.
const SnakeLogic = (() => {
  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  function placeFood(s) {
    const taken = new Set(s.snake.map((c) => c.y * s.cols + c.x));
    const free = [];
    for (let i = 0; i < s.cols * s.rows; i++) if (!taken.has(i)) free.push(i);
    if (free.length === 0) { s.food = null; return false; }
    const pick = free[Math.floor(s.rng() * free.length)];
    s.food = { x: pick % s.cols, y: Math.floor(pick / s.cols) };
    return true;
  }

  function create({ cols = 24, rows = 24, wrap = false, rng = Math.random } = {}) {
    const y = Math.floor(rows / 2);
    const s = {
      cols, rows, wrap, rng,
      snake: [{ x: 5, y }, { x: 4, y }, { x: 3, y }],
      dir: 'right',
      queue: [],
      food: null,
      eaten: 0,
      over: false,
      won: false,
    };
    placeFood(s);
    return s;
  }

  // Turns are queued and judged against the last queued direction. Judging them against the
  // current direction would let two fast presses in one tick reverse the snake into its neck.
  function turn(s, dir) {
    const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    if (s.queue.length >= 2 || dir === last) return false;
    const a = DIRS[last];
    const b = DIRS[dir];
    if (a.x + b.x === 0 && a.y + b.y === 0) return false;
    s.queue.push(dir);
    return true;
  }

  // Advances one tick. Returns 'eat', 'die', 'win' or null.
  function step(s) {
    if (s.over) return null;
    if (s.queue.length) s.dir = s.queue.shift();
    const d = DIRS[s.dir];
    let x = s.snake[0].x + d.x;
    let y = s.snake[0].y + d.y;
    if (s.wrap) {
      x = (x + s.cols) % s.cols;
      y = (y + s.rows) % s.rows;
    } else if (x < 0 || y < 0 || x >= s.cols || y >= s.rows) {
      s.over = true;
      return 'die';
    }
    const eats = s.food && s.food.x === x && s.food.y === y;
    // The tail moves away this tick unless the snake is growing, so that cell is safe to enter.
    const body = eats ? s.snake : s.snake.slice(0, -1);
    if (body.some((c) => c.x === x && c.y === y)) {
      s.over = true;
      return 'die';
    }
    s.snake.unshift({ x, y });
    if (!eats) { s.snake.pop(); return null; }
    s.eaten++;
    if (placeFood(s)) return 'eat';
    s.over = true;
    s.won = true;
    return 'win';
  }

  return { create, turn, step };
})();
if (typeof module !== 'undefined') module.exports = SnakeLogic;
