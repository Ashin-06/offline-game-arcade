const W = 480;
const H = 640;
const canvas = document.getElementById('road');
const ctx = Arcade.hidpi(canvas, W, H);
const HORIZON = 170;
const GROUND = 590;
const LANE_WIDTH = 150;
const FOCUS = 9;
const FAR = 110;
let state = LaneRushLogic.create();
let pending = {};

const KEYS = {
  ArrowLeft: 'left', a: 'left',
  ArrowRight: 'right', d: 'right',
  ArrowUp: 'jump', w: 'jump', ' ': 'jump',
  ArrowDown: 'slide', s: 'slide',
};

const shell = Arcade.game({
  id: 'lanerush',
  title: 'Lane Rush',
  stats: ['Coins'],
  how: 'Change lanes around walls, jump the low barriers and slide under the high gates. It keeps getting faster. <kbd>Arrows</kbd> or <kbd>WASD</kbd>, or swipe on the road.',
  keys: Object.keys(KEYS),
  pad: [
    { key: 'ArrowLeft', label: '◀', name: 'Move left' },
    { key: 'ArrowUp', label: '▲', name: 'Jump' },
    { key: 'ArrowDown', label: '▼', name: 'Slide' },
    { key: 'ArrowRight', label: '▶', name: 'Move right' },
  ],
  onStart() {
    state = LaneRushLogic.create();
    pending = {};
    shell.stat('Coins', 0);
  },
  onKey(key, down, repeat) {
    if (down && !repeat) pending[KEYS[key]] = true;
  },
});

Arcade.swipe(canvas, (dir) => {
  if (!shell.playing) return;
  pending[{ left: 'left', right: 'right', up: 'jump', down: 'slide' }[dir]] = true;
}, 22);

function step(dt) {
  const input = pending;
  pending = {};
  const event = LaneRushLogic.step(state, dt, input);
  if (event === 'turn') shell.sound('turn');
  if (event === 'jump') shell.sound('jump');
  if (event === 'slide') shell.sound('move');
  if (event === 'coin') {
    shell.sound('coin');
    shell.stat('Coins', state.coins);
  }
  shell.score(LaneRushLogic.score(state));
  if (event === 'die') shell.over({ title: 'Crashed', text: `${Math.floor(state.distance)} m and ${state.coins} coins.` });
}

// Perspective: scale falls away with distance, and everything converges on the horizon.
const scaleAt = (z) => FOCUS / (FOCUS + Math.max(z, -FOCUS * 0.4));
const screenY = (z) => HORIZON + (GROUND - HORIZON) * scaleAt(z);
const screenX = (lane, z) => W / 2 + (lane - 1) * LANE_WIDTH * scaleAt(z);

function drawRoad() {
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#0d1020');
  sky.addColorStop(1, '#2b2f6b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HORIZON);
  ctx.fillStyle = '#12182f';
  ctx.fillRect(0, HORIZON, W, H - HORIZON);

  const edge = (lane, z) => screenX(lane, z);
  ctx.fillStyle = '#1c2344';
  ctx.beginPath();
  ctx.moveTo(edge(-0.5, FAR), HORIZON);
  ctx.lineTo(edge(2.5, FAR), HORIZON);
  ctx.lineTo(edge(2.5, -3), H);
  ctx.lineTo(edge(-0.5, -3), H);
  ctx.fill();

  // Moving dashes between the lanes are what make the speed readable.
  ctx.fillStyle = '#6be3c3';
  for (const divider of [0.5, 1.5]) {
    for (let z = 2 - (state.distance % 6); z < FAR; z += 6) {
      const a = scaleAt(z);
      const b = scaleAt(z + 2.5);
      ctx.beginPath();
      ctx.moveTo(W / 2 + (divider - 1) * LANE_WIDTH * a - 3 * a, HORIZON + (GROUND - HORIZON) * a);
      ctx.lineTo(W / 2 + (divider - 1) * LANE_WIDTH * a + 3 * a, HORIZON + (GROUND - HORIZON) * a);
      ctx.lineTo(W / 2 + (divider - 1) * LANE_WIDTH * b + 3 * b, HORIZON + (GROUND - HORIZON) * b);
      ctx.lineTo(W / 2 + (divider - 1) * LANE_WIDTH * b - 3 * b, HORIZON + (GROUND - HORIZON) * b);
      ctx.fill();
    }
  }
  ctx.strokeStyle = '#7cc4ff';
  ctx.lineWidth = 3;
  for (const side of [-0.5, 2.5]) {
    ctx.beginPath();
    ctx.moveTo(edge(side, FAR), HORIZON);
    ctx.lineTo(edge(side, -3), H);
    ctx.stroke();
  }
}

function drawObstacle(o, z) {
  const s = scaleAt(z);
  const x = screenX(o.lane, z);
  const y = screenY(z);
  const w = LANE_WIDTH * 0.84 * s;
  if (o.kind === 'wall') {
    const h = 130 * s;
    ctx.fillStyle = '#ff6b81';
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 1; i < 4; i++) ctx.fillRect(x - w / 2, y - (h * i) / 4, w, 3 * s);
  } else if (o.kind === 'low') {
    const h = 40 * s;
    ctx.fillStyle = '#ffb86b';
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = '#1a1006';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const left = x - w / 2 + (i * w) / 4;
      ctx.moveTo(left, y - h);
      ctx.lineTo(left + w / 8, y - h);
      ctx.lineTo(left + w / 8 + h * 0.5, y);
      ctx.lineTo(left + h * 0.5, y);
      ctx.fill();
    }
  } else {
    // An overhead gate: posts at the sides, a bar across at standing height.
    const top = 118 * s;
    const bar = 62 * s;
    ctx.fillStyle = '#c6a3ff';
    ctx.fillRect(x - w / 2, y - top, 8 * s, top);
    ctx.fillRect(x + w / 2 - 8 * s, y - top, 8 * s, top);
    ctx.fillRect(x - w / 2, y - top, w, top - bar);
  }
}

function drawCoin(p, z) {
  const s = scaleAt(z);
  const x = screenX(p.lane, z);
  const y = screenY(z) - 34 * s;
  const squash = Math.abs(Math.cos(performance.now() / 150 + p.z));
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  ctx.ellipse(x, y, 13 * s * (0.35 + squash * 0.65), 13 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer() {
  const x = W / 2 + (state.x - 1) * LANE_WIDTH;
  const lift = state.y * 58;
  const sliding = state.slide > 0;
  const bodyH = sliding ? 40 : 86;
  const y = GROUND - lift;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, GROUND, 36, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  const stride = !sliding && state.y === 0 ? Math.sin(performance.now() / 60) * 7 : 0;
  ctx.fillStyle = '#c7cdf0';
  if (!sliding) {
    ctx.fillRect(x - 16, y - 16, 11, 16 + stride);
    ctx.fillRect(x + 5, y - 16, 11, 16 - stride);
  }
  ctx.fillStyle = '#eef1fb';
  ctx.beginPath();
  ctx.roundRect(x - 25, y - bodyH - (sliding ? 0 : 8), 50, bodyH, 14);
  ctx.fill();
  ctx.fillStyle = '#6be3c3';
  ctx.fillRect(x - 15, y - bodyH + (sliding ? 8 : 4), 30, 9);
}

function render() {
  drawRoad();
  // Far things first, so nearer ones cover them.
  const things = [
    ...state.obstacles.map((o) => ({ z: o.z - state.distance, o })),
    ...state.pickups.filter((p) => !p.taken).map((p) => ({ z: p.z - state.distance, p })),
  ].filter((t) => t.z < FAR && t.z > -3).sort((a, b) => b.z - a.z);
  let playerDrawn = false;
  for (const t of things) {
    if (!playerDrawn && t.z < 0) {
      drawPlayer();
      playerDrawn = true;
    }
    if (t.o) drawObstacle(t.o, t.z);
    else drawCoin(t.p, t.z);
  }
  if (!playerDrawn) drawPlayer();
}

Arcade.loop({ running: () => shell.playing, step, render });
