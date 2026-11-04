const { W, H, RAIL, SIZE, PLAYER_X } = FliplineLogic;
const canvas = document.getElementById('field');
const ctx = Arcade.hidpi(canvas, W, H);
const specks = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: RAIL + Math.random() * (H - RAIL * 2), depth: 0.2 + Math.random() * 0.5 }));
let state = FliplineLogic.create();
let flipQueued = false;
let trail = [];

const shell = Arcade.game({
  id: 'flipline',
  title: 'Flipline',
  stats: ['Shards'],
  how: 'One button: flip gravity and cross to the other rail. Dodge the blocks, slip through gates in mid-flip, and grab shards. <kbd>Space</kbd>, any arrow, or tap anywhere. It keeps getting faster.',
  keys: [' ', 'ArrowUp', 'ArrowDown', 'Enter'],
  onStart() {
    state = FliplineLogic.create();
    flipQueued = false;
    trail = [];
    shell.stat('Shards', 0);
  },
  onKey(key, down, repeat) {
    if (down && !repeat) flipQueued = true;
  },
});

document.querySelector('.stage').addEventListener('pointerdown', (e) => {
  if (shell.playing && !e.target.closest('.overlay')) {
    e.preventDefault();
    flipQueued = true;
  }
});

function step() {
  const event = FliplineLogic.step(state, flipQueued);
  flipQueued = false;
  if (event === 'flip') shell.sound('turn');
  if (event === 'shard') {
    shell.sound('coin');
    shell.stat('Shards', state.shards);
  }
  shell.score(FliplineLogic.score(state));
  if (event === 'die') shell.over({ title: 'Crashed', text: `You ran ${Math.floor(state.distance / 10)} m and took ${state.shards} shards.` });
  trail.push(state.y);
  if (trail.length > 14) trail.shift();
}

function render() {
  ctx.fillStyle = '#080b18';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#2f3963';
  for (const s of specks) {
    const x = ((s.x - state.distance * s.depth) % W + W) % W;
    ctx.fillRect(x, s.y, 16 * s.depth + 2, 2);
  }

  ctx.fillStyle = '#7cc4ff';
  ctx.fillRect(0, RAIL - 4, W, 4);
  ctx.fillRect(0, H - RAIL, W, 4);
  ctx.fillStyle = '#151a30';
  ctx.fillRect(0, 0, W, RAIL - 4);
  ctx.fillRect(0, H - RAIL + 4, W, RAIL - 4);

  ctx.fillStyle = '#ff6b81';
  for (const o of state.obstacles) {
    const x = o.x - state.distance;
    if (x > W || x + o.w < 0) continue;
    ctx.fillRect(x, o.side === 1 ? H - RAIL - o.h : RAIL, o.w, o.h);
  }

  ctx.fillStyle = '#ffe27a';
  for (const p of state.pickups) {
    if (p.taken) continue;
    const x = p.x - state.distance;
    ctx.beginPath();
    ctx.moveTo(x, p.y - 9);
    ctx.lineTo(x + 7, p.y);
    ctx.lineTo(x, p.y + 9);
    ctx.lineTo(x - 7, p.y);
    ctx.fill();
  }

  trail.forEach((y, i) => {
    ctx.fillStyle = `rgba(107, 227, 195, ${(i / trail.length) * 0.35})`;
    ctx.fillRect(PLAYER_X - (trail.length - i) * state.speed * 0.9, y + 4, SIZE - 8, SIZE - 8);
  });
  ctx.fillStyle = '#6be3c3';
  ctx.beginPath();
  ctx.roundRect(PLAYER_X, state.y, SIZE, SIZE, 6);
  ctx.fill();
}

Arcade.loop({ running: () => shell.playing, step, render });
