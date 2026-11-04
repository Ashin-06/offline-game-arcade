const { W, H, BRICK_W, BRICK_H, PADDLE_W, PADDLE_H, PADDLE_Y, R } = BrickBusterLogic;
const canvas = document.getElementById('field');
const ctx = Arcade.hidpi(canvas, W, H);
const ROW_COLORS = ['#ff6b81', '#ffb86b', '#ffe27a', '#6be3c3', '#7cc4ff'];
let state = BrickBusterLogic.create();

const shell = Arcade.game({
  id: 'brickbuster',
  title: 'Brick Buster',
  stats: ['Lives'],
  how: 'Clear every brick. Move with the <kbd>mouse</kbd>, a finger or <kbd>Left</kbd>/<kbd>Right</kbd>. Launch with <kbd>Space</kbd> or a tap. Hit the ball with the edge of the paddle to send it wide.',
  options: [
    { id: 'speed', label: 'Ball speed', default: 'normal', choices: [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']] },
  ],
  keys: ['ArrowLeft', 'ArrowRight', 'a', 'd', ' ', 'ArrowUp'],
  pad: [
    { key: 'ArrowLeft', label: '◀', name: 'Move left' },
    { key: ' ', label: 'Launch', name: 'Launch ball' },
    { key: 'ArrowRight', label: '▶', name: 'Move right' },
  ],
  onStart(opts) {
    state = BrickBusterLogic.create({ speed: opts.speed });
    shell.stat('Lives', state.lives);
  },
  onKey(key, down) {
    if (down && (key === ' ' || key === 'ArrowUp')) BrickBusterLogic.launch(state);
  },
});

function pointerToPaddle(e) {
  BrickBusterLogic.setPaddle(state, Arcade.pointerPos(canvas, e, W, H).x);
}
canvas.addEventListener('pointermove', (e) => { if (shell.playing) pointerToPaddle(e); });
canvas.addEventListener('pointerdown', (e) => {
  if (!shell.playing) return;
  pointerToPaddle(e);
  BrickBusterLogic.launch(state);
});

function step(dt) {
  const left = shell.keys.has('ArrowLeft') || shell.keys.has('a');
  const right = shell.keys.has('ArrowRight') || shell.keys.has('d');
  const event = BrickBusterLogic.step(state, dt, (right ? 1 : 0) - (left ? 1 : 0));
  if (!event) return;
  if (event === 'bounce') shell.sound('bounce');
  if (event === 'paddle') shell.sound('hit');
  if (event === 'brick' || event === 'cleared') {
    shell.sound('tap');
    shell.score(state.score);
  }
  if (event === 'miss') {
    shell.sound('hurt');
    shell.stat('Lives', state.lives);
    shell.say(`${state.lives} lives left`);
  }
  if (event === 'lost') {
    shell.stat('Lives', 0);
    shell.over({ title: 'Game over', text: `${state.remaining} bricks were left.` });
  }
  if (event === 'cleared') shell.over({ title: 'Wall cleared', text: `With ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left.`, win: true });
}

function render() {
  ctx.fillStyle = '#080b18';
  ctx.fillRect(0, 0, W, H);
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    ctx.fillStyle = ROW_COLORS[brick.row];
    ctx.beginPath();
    ctx.roundRect(brick.x, brick.y, BRICK_W, BRICK_H, 4);
    ctx.fill();
  }
  ctx.fillStyle = '#eef1fb';
  ctx.beginPath();
  ctx.roundRect(state.paddle - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, 7);
  ctx.fill();
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, R, 0, Math.PI * 2);
  ctx.fill();
  if (state.held && shell.playing) {
    ctx.fillStyle = '#a3acd0';
    ctx.font = '500 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Space or tap to launch', W / 2, H / 2 + 40);
  }
}

Arcade.loop({ running: () => shell.playing, step, render });
