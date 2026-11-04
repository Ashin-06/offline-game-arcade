const { W, H, PADDLE_H, PADDLE_W, INSET, R } = PongLogic;
const canvas = document.getElementById('court');
const ctx = Arcade.hidpi(canvas, W, H);
let state = PongLogic.create();

const shell = Arcade.game({
  id: 'pong',
  title: 'Pong',
  scoreLabel: 'You',
  stats: ['CPU'],
  how: 'First to the target wins. Move your paddle with the <kbd>mouse</kbd>, a finger, <kbd>W</kbd>/<kbd>S</kbd> or <kbd>Up</kbd>/<kbd>Down</kbd>. Where the ball hits the paddle sets its angle.',
  options: [
    { id: 'target', label: 'Play to', default: '7', choices: [['3', '3'], ['7', '7'], ['11', '11']] },
    { id: 'speed', label: 'Ball speed', default: 'normal', choices: [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']] },
  ],
  keys: ['ArrowUp', 'ArrowDown', 'w', 's'],
  noBest: true,
  onStart(opts) {
    state = PongLogic.create({ target: Number(opts.target), speed: opts.speed });
    shell.stat('CPU', 0);
  },
});

canvas.addEventListener('pointermove', (e) => {
  if (!shell.playing) return;
  state.left = PongLogic.clampPaddle(Arcade.pointerPos(canvas, e, W, H).y - PADDLE_H / 2);
});

function step(dt) {
  const up = shell.keys.has('ArrowUp') || shell.keys.has('w');
  const down = shell.keys.has('ArrowDown') || shell.keys.has('s');
  const event = PongLogic.step(state, dt, (down ? 1 : 0) - (up ? 1 : 0));
  if (event === 'bounce') shell.sound('bounce');
  if (event === 'hit') shell.sound('hit');
  if (event !== 'point') return;
  shell.score(state.score.left);
  shell.stat('CPU', state.score.right);
  shell.say(`${state.score.left} to ${state.score.right}`);
  if (state.winner === 'left') {
    const wins = Arcade.store.get('pong:wins', 0) + 1;
    Arcade.store.set('pong:wins', wins);
    shell.hub(`${wins} ${wins === 1 ? 'win' : 'wins'}`);
    shell.over({ title: 'You win', text: `${state.score.left} to ${state.score.right}.`, win: true });
  } else if (state.winner === 'right') {
    shell.over({ title: 'CPU wins', text: `${state.score.left} to ${state.score.right}.` });
  } else {
    shell.sound('coin');
  }
}

function render() {
  ctx.fillStyle = '#080b18';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2f3963';
  for (let y = 12; y < H; y += 34) ctx.fillRect(W / 2 - 2, y, 4, 18);

  ctx.font = '700 64px ui-monospace, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2f3963';
  ctx.fillText(state.score.left, W / 4, 84);
  ctx.fillText(state.score.right, (3 * W) / 4, 84);

  ctx.fillStyle = '#6be3c3';
  ctx.beginPath();
  ctx.roundRect(INSET, state.left, PADDLE_W, PADDLE_H, 5);
  ctx.fill();
  ctx.fillStyle = '#ffb86b';
  ctx.beginPath();
  ctx.roundRect(W - INSET - PADDLE_W, state.right, PADDLE_W, PADDLE_H, 5);
  ctx.fill();

  ctx.fillStyle = '#eef1fb';
  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, R, 0, Math.PI * 2);
  ctx.fill();

  if (state.serveIn > 0 && shell.playing) {
    ctx.font = '600 26px system-ui, sans-serif';
    ctx.fillStyle = '#a3acd0';
    ctx.fillText('Get ready', W / 2, H / 2 - 40);
  }
}

Arcade.loop({ running: () => shell.playing, step, render });
