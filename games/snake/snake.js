const W = 600;
const SIZE = 24;
const CELL = W / SIZE;
const canvas = document.getElementById('board');
const ctx = Arcade.hidpi(canvas, W, W);
const SPEEDS = { slow: { ms: 170, points: 1 }, normal: { ms: 115, points: 2 }, fast: { ms: 75, points: 3 } };
let state = SnakeLogic.create({ cols: SIZE, rows: SIZE });
let previous = state.snake.map((c) => ({ ...c }));
let sinceTick = 0;
let tickMs = SPEEDS.normal.ms;

const KEY_DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};

const shell = Arcade.game({
  id: 'snake',
  title: 'Snake',
  how: 'Eat, grow, and do not hit yourself. Steer with <kbd>Arrows</kbd> or <kbd>WASD</kbd>, or swipe. Faster speeds score more per bite.',
  options: [
    { id: 'speed', label: 'Speed', default: 'normal', choices: [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']] },
    { id: 'walls', label: 'Walls', default: 'solid', choices: [['solid', 'Solid'], ['wrap', 'Wrap around']] },
  ],
  keys: Object.keys(KEY_DIRS),
  stats: ['Length'],
  pad: [
    { key: 'ArrowUp', label: '▲', name: 'Up', area: 'up' },
    { key: 'ArrowLeft', label: '◀', name: 'Left', area: 'left' },
    { key: 'ArrowRight', label: '▶', name: 'Right', area: 'right' },
    { key: 'ArrowDown', label: '▼', name: 'Down', area: 'down' },
  ],
  padLayout: 'cross',
  onStart(opts) {
    state = SnakeLogic.create({ cols: SIZE, rows: SIZE, wrap: opts.walls === 'wrap' });
    previous = state.snake.map((c) => ({ ...c }));
    tickMs = SPEEDS[opts.speed].ms;
    sinceTick = 0;
    shell.stat('Length', state.snake.length);
  },
  onKey(key, down, repeat) {
    if (down && !repeat && SnakeLogic.turn(state, KEY_DIRS[key])) shell.sound('turn');
  },
});

Arcade.swipe(canvas, (dir) => { if (shell.playing && SnakeLogic.turn(state, dir)) shell.sound('turn'); }, 18);

function tick() {
  previous = state.snake.map((c) => ({ ...c }));
  const event = SnakeLogic.step(state);
  if (event === 'eat' || event === 'win') {
    shell.score(state.eaten * SPEEDS[shell.opts.speed].points);
    shell.stat('Length', state.snake.length);
    shell.sound('coin');
  }
  if (event === 'die') shell.over({ title: 'Game over', text: `Length ${state.snake.length}.` });
  if (event === 'win') shell.over({ title: 'You filled the board', text: 'There is nowhere left to go.', win: true });
}

function render() {
  ctx.fillStyle = '#080b18';
  ctx.fillRect(0, 0, W, W);
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < SIZE; y++) {
    for (let x = (y % 2); x < SIZE; x += 2) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  }

  if (state.food) {
    const pulse = 1 + Math.sin(performance.now() / 180) * 0.08;
    ctx.fillStyle = '#ff6b81';
    ctx.beginPath();
    ctx.arc((state.food.x + 0.5) * CELL, (state.food.y + 0.5) * CELL, CELL * 0.36 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  // Slide each segment from where it was to where it is. Wrapped segments jump instead.
  const t = shell.playing ? Math.min(1, sinceTick / tickMs) : 1;
  const count = state.snake.length;
  state.snake.forEach((c, i) => {
    const from = previous[i] || previous[previous.length - 1] || c;
    const jump = Math.abs(from.x - c.x) > 1 || Math.abs(from.y - c.y) > 1;
    const x = jump ? c.x : from.x + (c.x - from.x) * t;
    const y = jump ? c.y : from.y + (c.y - from.y) * t;
    ctx.fillStyle = `hsl(${162 - (i / count) * 40} 70% ${64 - (i / count) * 22}%)`;
    ctx.beginPath();
    ctx.roundRect(x * CELL + 1.5, y * CELL + 1.5, CELL - 3, CELL - 3, i === 0 ? 8 : 5);
    ctx.fill();
  });
}

Arcade.loop({
  running: () => shell.playing,
  step(dt) {
    sinceTick += dt * 1000;
    if (sinceTick >= tickMs) {
      sinceTick -= tickMs;
      tick();
    }
  },
  render,
});
