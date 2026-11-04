const { T, VIEW_W, VIEW_H, P_W, P_H, E_W, E_H, LEVELS } = PlatformerLogic;
const canvas = document.getElementById('world');
const ctx = Arcade.hidpi(canvas, VIEW_W, VIEW_H);
let state = PlatformerLogic.create();
let banner = 0;

const shell = Arcade.game({
  id: 'platformer',
  title: 'Beacon Climb',
  stats: ['Stage', 'Lives'],
  how: `Reach the beacon at the end of all ${LEVELS.length} stages. Collect sparks, land on patrollers from above, and keep clear of spikes. <kbd>Left</kbd>/<kbd>Right</kbd> run, <kbd>Up</kbd> or <kbd>Space</kbd> jumps. Hold jump to go higher.`,
  keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'a', 'd', 'w'],
  pad: [
    { key: 'ArrowLeft', label: '◀', name: 'Run left' },
    { key: 'ArrowRight', label: '▶', name: 'Run right' },
    { key: ' ', label: 'Jump', name: 'Jump' },
  ],
  onStart() {
    state = PlatformerLogic.create();
    banner = 150;
    updateStats();
  },
});

function updateStats() {
  shell.stat('Stage', `${state.index + 1}/${LEVELS.length}`);
  shell.stat('Lives', state.lives);
}

function step() {
  const k = shell.keys;
  const events = PlatformerLogic.step(state, {
    left: k.has('ArrowLeft') || k.has('a'),
    right: k.has('ArrowRight') || k.has('d'),
    jump: k.has('ArrowUp') || k.has(' ') || k.has('w'),
  });
  banner = Math.max(0, banner - 1);
  for (const event of events) {
    if (event === 'jump') shell.sound('jump');
    if (event === 'spring') shell.sound('coin');
    if (event === 'coin') { shell.sound('coin'); shell.score(state.score); }
    if (event === 'stomp') { shell.sound('hit'); shell.score(state.score); }
    if (event === 'hurt') {
      shell.sound('hurt');
      updateStats();
      shell.say(`${state.lives} lives left`);
    }
    if (event === 'level') {
      shell.sound('clear');
      shell.score(state.score);
      updateStats();
      banner = 150;
      shell.say(`Stage ${state.index + 1}, ${state.level.name}`);
    }
    if (event === 'lose') shell.over({ title: 'Out of lives', text: `You reached stage ${state.index + 1}.` });
    if (event === 'win') {
      shell.score(state.score);
      shell.over({ title: 'Every beacon lit', text: `Final score ${state.score}.`, win: true });
    }
  }
}

function drawBackdrop(cameraX) {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, '#111733');
  sky.addColorStop(1, '#27305a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Two layers of distant towers, scrolling slower than the level.
  for (const [speed, color, base, size] of [[0.15, '#1a2146', 150, 90], [0.35, '#20295a', 90, 70]]) {
    ctx.fillStyle = color;
    const offset = cameraX * speed;
    for (let i = Math.floor(offset / size) - 1; i * size - offset < VIEW_W; i++) {
      const tall = base + ((i * 7919) % 11 + 11) % 11 * 14;
      ctx.fillRect(i * size - offset, VIEW_H - tall, size - 12, tall);
    }
  }
}

function drawTile(ch, x, y) {
  if (ch === '#') {
    ctx.fillStyle = '#2d3a6e';
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#3f4f8f';
    ctx.fillRect(x, y, T, 4);
  } else if (ch === '=') {
    ctx.fillStyle = '#6be3c3';
    ctx.fillRect(x + 1, y, T - 2, 6);
  } else if (ch === '^') {
    ctx.fillStyle = '#ff6b81';
    ctx.beginPath();
    for (const dx of [0, T / 2]) {
      ctx.moveTo(x + dx, y + T);
      ctx.lineTo(x + dx + T / 4, y + 10);
      ctx.lineTo(x + dx + T / 2, y + T);
    }
    ctx.fill();
  } else if (ch === 's') {
    ctx.fillStyle = '#ffb86b';
    ctx.fillRect(x + 4, y + T - 10, T - 8, 10);
    ctx.fillStyle = '#ffe27a';
    ctx.fillRect(x + 2, y + T - 14, T - 4, 5);
  } else if (ch === 'D') {
    const glow = 0.6 + Math.sin(performance.now() / 260) * 0.4;
    ctx.fillStyle = '#a3acd0';
    ctx.fillRect(x + 12, y + 8, 8, T - 8);
    ctx.fillStyle = `rgba(255, 226, 122, ${glow})`;
    ctx.beginPath();
    ctx.arc(x + 16, y + 8, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(p, x) {
  const hidden = state.grace > 0 && Math.floor(state.grace / 5) % 2;
  if (hidden) return;
  const stride = p.grounded && Math.abs(p.vx) > 0.5 ? Math.sin(state.frames / 3) * 3 : 0;
  ctx.fillStyle = '#c7cdf0';
  ctx.fillRect(x + 4, p.y + P_H - 6, 5, 6 + stride);
  ctx.fillRect(x + P_W - 9, p.y + P_H - 6, 5, 6 - stride);
  ctx.fillStyle = '#eef1fb';
  ctx.beginPath();
  ctx.roundRect(x, p.y, P_W, P_H - 5, 6);
  ctx.fill();
  ctx.fillStyle = '#0d1020';
  ctx.fillRect(p.facing > 0 ? x + 9 : x + 2, p.y + 6, 11, 7);
  ctx.fillStyle = '#6be3c3';
  ctx.fillRect(p.facing > 0 ? x + 15 : x + 4, p.y + 8, 3, 3);
}

function render() {
  const { level, p } = state;
  const maxCamera = Math.max(0, level.w * T - VIEW_W);
  const cameraX = Math.round(Math.max(0, Math.min(maxCamera, p.x + P_W / 2 - VIEW_W / 2)));
  drawBackdrop(cameraX);

  const firstC = Math.floor(cameraX / T);
  for (let r = 0; r < level.h; r++) {
    for (let c = firstC; c <= firstC + VIEW_W / T + 1 && c < level.w; c++) {
      drawTile(level.grid[r][c], c * T - cameraX, r * T);
    }
  }

  ctx.fillStyle = '#ffe27a';
  for (const coin of level.coins) {
    if (coin.taken) continue;
    const cx = (coin.c + 0.5) * T - cameraX;
    const cy = (coin.r + 0.5) * T + Math.sin((performance.now() + coin.c * 90) / 300) * 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 6, cy);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx - 6, cy);
    ctx.fill();
  }

  for (const e of level.enemies) {
    if (!e.alive) continue;
    const x = e.x - cameraX;
    ctx.fillStyle = '#ff9f6b';
    ctx.beginPath();
    ctx.roundRect(x, e.y + 4, E_W, E_H - 4, 7);
    ctx.fill();
    ctx.fillStyle = '#1a1006';
    ctx.fillRect(x + (e.dir > 0 ? 15 : 5), e.y + 9, 6, 5);
  }

  drawPlayer(p, p.x - cameraX);

  if (banner > 0 && shell.playing) {
    ctx.fillStyle = `rgba(238, 241, 251, ${Math.min(1, banner / 40)})`;
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(level.name, VIEW_W / 2, 90);
  }
}

Arcade.loop({ running: () => shell.playing, step, render });
