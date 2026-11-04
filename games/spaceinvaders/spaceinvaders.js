const { W, H, ALIEN_W, ALIEN_H, PLAYER_W, PLAYER_H, PLAYER_Y } = InvadersLogic;
const canvas = document.getElementById('field');
const ctx = Arcade.hidpi(canvas, W, H);
const ROW_COLORS = ['#ff6b81', '#ff9f6b', '#ffe27a', '#7ce38b', '#7cc4ff'];
const stars = Array.from({ length: 70 }, () => [Math.random() * W, Math.random() * H, Math.random() * 1.4 + 0.3]);
let state = InvadersLogic.create();
let aim = null;

const shell = Arcade.game({
  id: 'invaders',
  title: 'Space Invaders',
  stats: ['Lives'],
  how: 'Clear the formation before it lands. Move with <kbd>Left</kbd>/<kbd>Right</kbd> and hold <kbd>Space</kbd> to fire, or drag on the field. The march speeds up as it thins out.',
  options: [
    { id: 'speed', label: 'Formation speed', default: 'normal', choices: [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']] },
  ],
  keys: ['ArrowLeft', 'ArrowRight', 'a', 'd', ' ', 'ArrowUp'],
  pad: [
    { key: 'ArrowLeft', label: '◀', name: 'Move left' },
    { key: ' ', label: 'Fire', name: 'Fire' },
    { key: 'ArrowRight', label: '▶', name: 'Move right' },
  ],
  onStart(opts) {
    state = InvadersLogic.create({ speed: opts.speed });
    aim = null;
    shell.stat('Lives', state.lives);
  },
});

// Dragging on the field steers and fires, so the game also works without the pad.
canvas.addEventListener('pointerdown', (e) => { if (shell.playing) aim = Arcade.pointerPos(canvas, e, W, H).x; });
canvas.addEventListener('pointermove', (e) => { if (aim !== null) aim = Arcade.pointerPos(canvas, e, W, H).x; });
for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, () => { aim = null; });

function step(dt) {
  const k = shell.keys;
  const input = {
    left: k.has('ArrowLeft') || k.has('a') || (aim !== null && aim < state.player - 4),
    right: k.has('ArrowRight') || k.has('d') || (aim !== null && aim > state.player + 4),
    fire: k.has(' ') || k.has('ArrowUp') || aim !== null,
  };
  for (const event of InvadersLogic.step(state, dt, input)) {
    if (event === 'shoot') shell.sound('shoot');
    if (event === 'kill') { shell.sound('hit'); shell.score(state.score); }
    if (event === 'hurt') {
      shell.sound('hurt');
      shell.stat('Lives', state.lives);
      shell.say(`${state.lives} lives left`);
    }
    if (event === 'win') shell.over({ title: 'Formation cleared', text: `Score ${state.score}.`, win: true });
    if (event === 'lose') {
      shell.stat('Lives', state.lives);
      shell.over({ title: 'Game over', text: `${state.aliens.length} left in the formation.` });
    }
  }
}

function drawAlien(a) {
  ctx.fillStyle = ROW_COLORS[a.row];
  ctx.beginPath();
  ctx.roundRect(a.x, a.y, ALIEN_W, ALIEN_H, 7);
  ctx.fill();
  ctx.fillStyle = '#080b18';
  ctx.fillRect(a.x + 6, a.y + 7, 4, 4);
  ctx.fillRect(a.x + ALIEN_W - 10, a.y + 7, 4, 4);
}

function render() {
  ctx.fillStyle = '#080b18';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#39436f';
  for (const [x, y, size] of stars) ctx.fillRect(x, y, size, size);

  state.aliens.forEach(drawAlien);

  ctx.fillStyle = '#ffe27a';
  for (const shot of state.shots) ctx.fillRect(shot.x - 2, shot.y, 4, 12);
  ctx.fillStyle = '#ff9f6b';
  for (const bomb of state.bombs) ctx.fillRect(bomb.x - 2, bomb.y, 4, 12);

  // Flicker while invulnerable, so the grace period after a hit is visible.
  if (state.invulnerable === 0 || Math.floor(performance.now() / 90) % 2) {
    const x = state.player - PLAYER_W / 2;
    ctx.fillStyle = '#6be3c3';
    ctx.beginPath();
    ctx.moveTo(x, PLAYER_Y + PLAYER_H);
    ctx.lineTo(state.player, PLAYER_Y - 8);
    ctx.lineTo(x + PLAYER_W, PLAYER_Y + PLAYER_H);
    ctx.closePath();
    ctx.fill();
  }
}

Arcade.loop({ running: () => shell.playing, step, render });
