const { W, H, R, MAX_POWER, POCKETS, groupOf, create, cue, remaining, shoot, step: stepTable, validSpot, placeCue, firstContact, chooseShot, chooseSpot } = PoolLogic;
const MARGIN = 28;
const canvas = document.getElementById('table');
const statusEl = document.getElementById('status');
const COLORS = { 1: '#f7c531', 2: '#2f6fe0', 3: '#e0453a', 4: '#7a3fb5', 5: '#f08a24', 6: '#1f9d55', 7: '#8c2f2f', 8: '#14161f' };
const colorOf = (n) => (n > 8 ? COLORS[n - 8] : COLORS[n]);

let state = create();
let ctx = null;
let portrait = false;
let aim = 0;
let power = 0.55;
let dragging = false;
let cpuTimer = 0;
let handSpot = null;

const shell = Arcade.game({
  id: 'pool',
  title: 'Pool',
  scoreLabel: 'You',
  stats: ['Other'],
  noBest: true,
  pausable: false,
  how: 'Eight-ball: sink your group, solids or stripes, then the 8. The break leaves the table open and your first pot picks your group. A foul gives the other player the cue ball in hand. Drag back from the cue ball and let go, or use <kbd>Arrows</kbd> to aim and set power and <kbd>Space</kbd> to shoot.',
  options: [
    { id: 'mode', label: 'Opponent', default: 'medium', choices: [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['two', 'Two players']] },
  ],
  keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'],
  onStart(opts) {
    clearTimeout(cpuTimer);
    state = create({ twoPlayer: opts.mode === 'two', level: opts.mode === 'two' ? 'medium' : opts.mode });
    aim = 0;
    power = 0.9;
    dragging = false;
    handSpot = null;
    updateStatus();
  },
  onKey(key, down) {
    if (!down || !humanToMove() || state.moving) return;
    if (state.inHand) {
      handSpot = handSpot || { x: W * 0.25, y: H / 2 };
      const step = 14;
      if (key === 'ArrowLeft') handSpot.x -= step;
      if (key === 'ArrowRight') handSpot.x += step;
      if (key === 'ArrowUp') handSpot.y -= step;
      if (key === 'ArrowDown') handSpot.y += step;
      handSpot.x = Math.max(R, Math.min(W - R, handSpot.x));
      handSpot.y = Math.max(R, Math.min(H - R, handSpot.y));
      if ((key === ' ' || key === 'Enter') && placeCue(state, handSpot.x, handSpot.y)) {
        shell.sound('tap');
        updateStatus();
      }
      return;
    }
    if (key === 'ArrowLeft') aim -= 0.012;
    if (key === 'ArrowRight') aim += 0.012;
    if (key === 'ArrowUp') power = Math.min(1, power + 0.04);
    if (key === 'ArrowDown') power = Math.max(0.05, power - 0.04);
    if (key === ' ' || key === 'Enter') fire();
  },
});

const humanToMove = () => shell.playing && state.winner === null && (state.twoPlayer || state.turn === 0);

// A phone held upright gets the table on its long side, drawn turned a quarter.
function fit() {
  portrait = window.innerHeight > window.innerWidth;
  const tableW = W + MARGIN * 2;
  const tableH = H + MARGIN * 2;
  canvas.dataset.portrait = String(portrait);
  ctx = Arcade.hidpi(canvas, portrait ? tableH : tableW, portrait ? tableW : tableH);
}

function toTable(e) {
  const box = canvas.getBoundingClientRect();
  const u = (e.clientX - box.left) / box.width;
  const v = (e.clientY - box.top) / box.height;
  if (!portrait) return { x: u * (W + MARGIN * 2) - MARGIN, y: v * (H + MARGIN * 2) - MARGIN };
  return { x: v * (W + MARGIN * 2) - MARGIN, y: (1 - u) * (H + MARGIN * 2) - MARGIN };
}

canvas.addEventListener('pointerdown', (e) => {
  if (!humanToMove() || state.moving) return;
  canvas.setPointerCapture(e.pointerId);
  const p = toTable(e);
  if (state.inHand) {
    handSpot = p;
    dragging = true;
    return;
  }
  dragging = true;
  pull(p);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const p = toTable(e);
  if (state.inHand) handSpot = p;
  else pull(p);
});
canvas.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  const p = toTable(e);
  if (state.inHand) {
    handSpot = p;
    if (placeCue(state, p.x, p.y)) {
      shell.sound('tap');
      updateStatus();
    }
    return;
  }
  pull(p);
  // Letting go on the cue ball cancels the shot.
  if (Math.hypot(p.x - cue(state).x, p.y - cue(state).y) > R * 2) fire();
});
canvas.addEventListener('pointercancel', () => { dragging = false; });

function pull(p) {
  const c = cue(state);
  const dx = c.x - p.x;
  const dy = c.y - p.y;
  const distance = Math.hypot(dx, dy);
  if (distance > 1) aim = Math.atan2(dy, dx);
  power = Math.max(0.05, Math.min(1, distance / 280));
}

function fire() {
  if (shoot(state, aim, power * MAX_POWER)) {
    shell.sound('hit');
    updateStatus();
  }
}

function playerName(i) {
  if (state.twoPlayer) return `Player ${i + 1}`;
  return i === 0 ? 'You' : 'CPU';
}

function updateStatus() {
  const counts = [0, 1].map((i) => (state.groups[i] ? 7 - remaining(state, state.groups[i]) : 0));
  shell.score(counts[0]);
  shell.stat('Other', counts[1]);
  if (state.winner !== null || !shell.playing) return;
  const name = playerName(state.turn);
  const group = state.groups[state.turn];
  const need = group ? (remaining(state, group) ? `${group}s` : 'the 8') : 'table open';
  const foul = state.foul ? `${state.foul} ` : '';
  const move = state.inHand ? 'place the cue ball' : state.moving ? '' : 'shoot';
  statusEl.textContent = `${foul}${name}: ${need}${move ? `, ${move}` : ''}.`;
}

function afterShot() {
  updateStatus();
  if (state.winner !== null) {
    const won = state.twoPlayer || state.winner === 0;
    if (!state.twoPlayer && won) {
      const wins = Arcade.store.get('pool:wins', 0) + 1;
      Arcade.store.set('pool:wins', wins);
      shell.hub(`${wins} ${wins === 1 ? 'win' : 'wins'}`);
    }
    const title = state.twoPlayer ? `${playerName(state.winner)} wins` : won ? 'You win' : 'CPU wins';
    shell.over({ title, text: state.reason, win: won });
    return;
  }
  // Start the next aim pointing at something sensible.
  const c = cue(state);
  const t = PoolLogic.targets(state)[0];
  if (t && !state.inHand) aim = Math.atan2(t.y - c.y, t.x - c.x);
  handSpot = state.inHand ? { x: W * 0.25, y: H / 2 } : null;
  if (!state.twoPlayer && state.turn === 1) cpuTurn();
}

function cpuTurn() {
  clearTimeout(cpuTimer);
  cpuTimer = setTimeout(() => {
    if (!shell.playing || state.turn !== 1 || state.moving) return;
    if (state.inHand) {
      const spot = chooseSpot(state);
      placeCue(state, spot.x, spot.y);
      updateStatus();
      cpuTurn();
      return;
    }
    const shot = chooseShot(state);
    aim = shot.angle;
    shoot(state, shot.angle, shot.power);
    shell.sound('hit');
    updateStatus();
  }, 650);
}

function drawBall(b) {
  const x = b.x;
  const y = b.y;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = b.n === 0 ? '#f6f7ff' : groupOf(b.n) === 'stripe' ? '#f6f7ff' : colorOf(b.n);
  ctx.fillRect(x - R, y - R, R * 2, R * 2);
  if (groupOf(b.n) === 'stripe') {
    ctx.fillStyle = colorOf(b.n);
    ctx.fillRect(x - R, y - R * 0.55, R * 2, R * 1.1);
  }
  if (b.n) {
    ctx.fillStyle = '#f6f7ff';
    ctx.beginPath();
    ctx.arc(x, y, R * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14161f';
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // The number stays upright when the table is drawn turned.
    ctx.translate(x, y);
    if (portrait) ctx.rotate(-Math.PI / 2);
    ctx.fillText(b.n, 0, 0.5);
  }
  ctx.restore();
}

function render() {
  ctx.save();
  if (portrait) {
    ctx.translate(H + MARGIN * 2, 0);
    ctx.rotate(Math.PI / 2);
  }
  ctx.fillStyle = '#3a2416';
  ctx.fillRect(0, 0, W + MARGIN * 2, H + MARGIN * 2);
  ctx.translate(MARGIN, MARGIN);
  ctx.fillStyle = '#17684f';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.moveTo(W * 0.25, 0);
  ctx.lineTo(W * 0.25, H);
  ctx.stroke();
  ctx.fillStyle = '#05070f';
  for (const p of POCKETS) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  const c = cue(state);
  const canAim = humanToMove() && !state.moving && !state.inHand;
  if (canAim) {
    const dx = Math.cos(aim);
    const dy = Math.sin(aim);
    const hit = firstContact(state, aim);
    const length = hit ? hit.dist : 900;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + dx * length, c.y + dy * length);
    ctx.stroke();
    ctx.setLineDash([]);
    if (hit) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(hit.x, hit.y, R, 0, Math.PI * 2);
      ctx.stroke();
      // Where the struck ball will head: along the line of centres.
      const ax = hit.ball.x - hit.x;
      const ay = hit.ball.y - hit.y;
      ctx.strokeStyle = 'rgba(255,226,122,0.85)';
      ctx.beginPath();
      ctx.moveTo(hit.ball.x, hit.ball.y);
      ctx.lineTo(hit.ball.x + ax * 3.2, hit.ball.y + ay * 3.2);
      ctx.stroke();
    }
    // The stick pulls back further as the shot gets stronger.
    const back = R + 8 + power * 90;
    ctx.strokeStyle = '#d9b382';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c.x - dx * back, c.y - dy * back);
    ctx.lineTo(c.x - dx * (back + 210), c.y - dy * (back + 210));
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = power > 0.75 ? '#ff6b81' : '#ffe27a';
    ctx.fillRect(0, H + 10, W * power, 8);
  }

  for (const b of state.balls) if (!b.down) drawBall(b);

  if (state.inHand && humanToMove() && handSpot) {
    ctx.globalAlpha = 0.8;
    drawBall({ n: 0, x: handSpot.x, y: handSpot.y });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = validSpot(state, handSpot.x, handSpot.y) ? '#6be3c3' : '#ff6b81';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(handSpot.x, handSpot.y, R + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.restore();
}

function step(dt) {
  const events = stepTable(state, dt);
  if (events.has('pot')) shell.sound('coin');
  else if (events.has('click')) shell.sound('tap');
  else if (events.has('rail')) shell.sound('bounce');
  if (events.has('stopped')) afterShot();
}

fit();
window.addEventListener('resize', fit);
Arcade.loop({ running: () => shell.playing, step, render });
