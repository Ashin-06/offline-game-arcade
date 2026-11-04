const { COLS, ROWS, WAVES, MAX_LEVEL, TOWERS, MAPS, ENEMIES, create, canBuild, build, upgrade, upgradeCost, sell, statsOf, startWave, step: stepWorld, positionAt } = SentryLogic;
const CELL = 60;
const W = COLS * CELL;
const H = ROWS * CELL;
const canvas = document.getElementById('field');
const ctx = Arcade.hidpi(canvas, W, H);
const TOWER_COLORS = { bolt: '#ffe27a', frost: '#7cc4ff', mortar: '#ff9f6b' };
const ENEMY_COLORS = { runner: '#6be3c3', grunt: '#ff6b81', brute: '#c084ff', boss: '#ffffff' };
const towerBar = document.getElementById('towers');
const upgradeBtn = document.getElementById('upgrade');
const sellBtn = document.getElementById('sell');
const waveBtn = document.getElementById('wave');
const fastBtn = document.getElementById('fast');

let state = create();
let picked = 'bolt';
let selected = null;
let cursor = { x: 0, y: 3 };
let fast = false;
let showCursor = false;
let barTimer = 0;

const shell = Arcade.game({
  id: 'sentrypath',
  title: 'Sentry Path',
  scoreLabel: 'Wave',
  stats: ['Gold', 'Lives'],
  how: `Hold the path for ${WAVES} waves. Pick a tower, then tap an open square. Tap a tower to upgrade or sell it. Bolt is fast, Frost slows, Mortar hits a group. Calling a wave early pays gold. <kbd>1</kbd> to <kbd>3</kbd> pick, <kbd>Arrows</kbd> move, <kbd>Enter</kbd> builds, <kbd>U</kbd> upgrades, <kbd>X</kbd> sells, <kbd>N</kbd> next wave, <kbd>F</kbd> speed.`,
  options: [
    { id: 'map', label: 'Map', default: 'switchback', choices: Object.entries(MAPS).map(([id, m]) => [id, m.name]) },
  ],
  bestKey: (o) => o.map,
  bestLabel: (o) => MAPS[o.map].name,
  keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', '1', '2', '3', 'u', 'x', 'n', 'f'],
  onStart(opts) {
    state = create({ map: opts.map });
    picked = 'bolt';
    selected = null;
    fast = false;
    showCursor = false;
    updateBar();
  },
  onKey(key, down) {
    if (!down) return;
    const kinds = Object.keys(TOWERS);
    if (key >= '1' && key <= '3') choose(kinds[Number(key) - 1]);
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[key]) {
      showCursor = true;
      cursor.x = Math.max(0, Math.min(COLS - 1, cursor.x + moves[key][0]));
      cursor.y = Math.max(0, Math.min(ROWS - 1, cursor.y + moves[key][1]));
    }
    if (key === 'Enter' || key === ' ') {
      showCursor = true;
      useCell(cursor.x, cursor.y);
    }
    if (key === 'u') doUpgrade();
    if (key === 'x') doSell();
    if (key === 'n') callWave();
    if (key === 'f') toggleFast();
  },
});

Object.entries(TOWERS).forEach(([kind, type], i) => {
  const button = Arcade.el('button', { type: 'button', className: 'tower-pick' }, [
    Arcade.el('i', { className: 'swatch' }),
    Arcade.el('span', { textContent: `${type.name} ${type.cost}` }),
  ]);
  button.querySelector('i').style.background = TOWER_COLORS[kind];
  button.dataset.kind = kind;
  button.setAttribute('aria-label', `${type.name} tower, costs ${type.cost}. Key ${i + 1}`);
  button.addEventListener('click', () => choose(kind));
  towerBar.append(button);
});

function choose(kind) {
  picked = kind;
  selected = null;
  updateBar();
}

function useCell(x, y) {
  if (!shell.playing) return;
  const tower = state.towers.find((t) => t.x === x && t.y === y);
  if (tower) {
    selected = tower === selected ? null : tower;
    shell.sound('tap');
    updateBar();
    return;
  }
  selected = null;
  if (build(state, picked, x, y)) {
    shell.sound('lock');
    shell.say(`${TOWERS[picked].name} built`);
  } else {
    shell.sound('hurt');
    shell.say(canBuild(state, x, y) ? 'Not enough gold' : 'Cannot build there');
  }
  updateBar();
}

function doUpgrade() {
  if (shell.playing && selected && upgrade(state, selected)) {
    shell.sound('coin');
    updateBar();
  }
}

function doSell() {
  if (shell.playing && selected && sell(state, selected)) {
    selected = null;
    shell.sound('move');
    updateBar();
  }
}

function callWave() {
  if (shell.playing && startWave(state)) {
    shell.sound('turn');
    shell.say(`Wave ${state.wave}`);
    updateBar();
  }
}

function toggleFast() {
  fast = !fast;
  fastBtn.setAttribute('aria-pressed', String(fast));
}

canvas.addEventListener('pointerdown', (e) => {
  if (!shell.playing) return;
  const p = Arcade.pointerPos(canvas, e, W, H);
  showCursor = false;
  useCell(Math.floor(p.x / CELL), Math.floor(p.y / CELL));
});

upgradeBtn.addEventListener('click', doUpgrade);
sellBtn.addEventListener('click', doSell);
waveBtn.addEventListener('click', callWave);
fastBtn.addEventListener('click', toggleFast);

function updateBar() {
  shell.score(state.wave);
  shell.stat('Gold', state.gold);
  shell.stat('Lives', state.lives);
  for (const button of towerBar.children) {
    const kind = button.dataset.kind;
    button.classList.toggle('active', kind === picked && !selected);
    button.classList.toggle('poor', state.gold < TOWERS[kind].cost);
  }
  const atMax = selected && selected.level >= MAX_LEVEL;
  upgradeBtn.disabled = !selected || atMax || state.gold < upgradeCost(selected);
  upgradeBtn.textContent = !selected ? 'Upgrade' : atMax ? 'Max level' : `Upgrade ${upgradeCost(selected)}`;
  sellBtn.disabled = !selected;
  sellBtn.textContent = selected ? `Sell ${Math.floor(selected.spent * SentryLogic.SELL_RATE)}` : 'Sell';
  const finished = state.wave >= WAVES;
  waveBtn.disabled = finished;
  const wait = Math.ceil(state.nextWave);
  const idle = state.spawning.length === 0 && state.enemies.length === 0;
  waveBtn.textContent = finished ? 'Last wave' : idle ? `Next wave ${wait}` : 'Next wave';
}

function step(dt) {
  const steps = fast ? 2 : 1;
  for (let i = 0; i < steps; i++) {
    const events = stepWorld(state, dt);
    if (events.includes('kill')) shell.sound('tap');
    if (events.includes('leak')) shell.sound('hurt');
    if (events.includes('wave')) shell.say(`Wave ${state.wave}`);
    if (events.includes('win')) {
      updateBar();
      shell.over({ title: 'Path held', text: `All ${WAVES} waves stopped with ${state.lives} lives left.`, win: true });
      return;
    }
    if (events.includes('lose')) {
      updateBar();
      shell.over({ title: 'The path fell', text: `You reached wave ${state.wave}.` });
      return;
    }
  }
  // The bar shows whole numbers, so a few updates a second keep it current.
  barTimer += dt;
  if (barTimer >= 0.2) {
    barTimer = 0;
    updateBar();
  }
}

const px = (cell) => (cell + 0.5) * CELL;

function render() {
  ctx.fillStyle = '#10152b';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  for (let x = 1; x < COLS; x++) { ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); }
  for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); }
  ctx.stroke();

  ctx.strokeStyle = '#2d3a6e';
  ctx.lineWidth = CELL * 0.74;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  state.path.forEach(([x, y], i) => (i ? ctx.lineTo(px(x), px(y)) : ctx.moveTo(px(x), px(y))));
  ctx.stroke();
  ctx.lineWidth = 1;
  // The end of the path is what is being defended.
  const [ex, ey] = state.path[state.path.length - 1];
  ctx.fillStyle = '#6be3c3';
  ctx.beginPath();
  ctx.arc(px(ex), px(ey), CELL * 0.26, 0, Math.PI * 2);
  ctx.fill();

  for (const t of state.towers) {
    const x = px(t.x);
    const y = px(t.y);
    if (t === selected) {
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(x, y, statsOf(t).range * CELL, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#2a3158';
    ctx.beginPath();
    ctx.roundRect(x - 23, y - 23, 46, 46, 9);
    ctx.fill();
    ctx.fillStyle = TOWER_COLORS[t.kind];
    if (t.kind === 'mortar') {
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t.aim);
      ctx.fillRect(-8, -7, 28, 14);
      ctx.restore();
    }
    ctx.fillStyle = '#eef1fb';
    for (let i = 0; i < t.level; i++) ctx.fillRect(x - 17 + i * 8, y + 16, 6, 4);
  }

  for (const shot of state.shots) {
    ctx.strokeStyle = TOWER_COLORS[shot.kind];
    ctx.lineWidth = 3;
    if (shot.splash) {
      ctx.globalAlpha = Math.min(1, shot.life / 0.14);
      ctx.beginPath();
      ctx.arc(px(shot.x2), px(shot.y2), shot.splash * CELL, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.beginPath();
      ctx.moveTo(px(shot.x1), px(shot.y1));
      ctx.lineTo(px(shot.x2), px(shot.y2));
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  for (const e of state.enemies) {
    const p = positionAt(state, e.along);
    const x = px(p.x);
    const y = px(p.y);
    const radius = e.kind === 'boss' ? 20 : e.kind === 'brute' ? 15 : e.kind === 'runner' ? 8 : 11;
    ctx.fillStyle = e.slowFor > 0 ? '#9ad8ff' : ENEMY_COLORS[e.kind];
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#05070f';
    ctx.fillRect(x - 13, y - radius - 8, 26, 4);
    ctx.fillStyle = '#7ce38b';
    ctx.fillRect(x - 13, y - radius - 8, 26 * Math.max(0, e.hp / e.maxHp), 4);
  }

  if (showCursor && shell.playing) {
    ctx.strokeStyle = canBuild(state, cursor.x, cursor.y) ? '#6be3c3' : '#ffb86b';
    ctx.lineWidth = 3;
    ctx.strokeRect(cursor.x * CELL + 2, cursor.y * CELL + 2, CELL - 4, CELL - 4);
    ctx.lineWidth = 1;
  }
}

Arcade.loop({ running: () => shell.playing, step, render });
