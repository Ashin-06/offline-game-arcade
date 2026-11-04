const { TRACK, HOME_COLUMN, SAFE, cellOf, create, roll, move, legalTokens, chooseToken } = LudoLogic;
const G = 15;
const CELL = 40;
const canvas = document.getElementById('board');
const ctx = Arcade.hidpi(canvas, G * CELL, G * CELL);
const tokenLayer = document.getElementById('tokens');
const dieBtn = document.getElementById('die');
const statusEl = document.getElementById('status');
const PALETTE = { red: '#ff6b81', green: '#5fd38d', yellow: '#ffd24d', blue: '#6bb4ff' };
const NAMES = { red: 'Red', green: 'Green', yellow: 'Yellow', blue: 'Blue' };
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

let state = create();
let timer = 0;
let tokens = [];

const shell = Arcade.game({
  id: 'ludo',
  title: 'Ludo',
  scoreLabel: 'Home',
  stats: ['Turn'],
  noBest: true,
  pausable: false,
  how: 'Roll a six to leave base and race all four tokens home. A six rolls again, so does a capture or reaching home, and three sixes in a row lose the turn. Stars are safe, and two tokens together cannot be captured. <kbd>Space</kbd> rolls, <kbd>1</kbd> to <kbd>4</kbd> pick a token.',
  options: [
    { id: 'players', label: 'Players', default: '4', choices: [['2', '2'], ['3', '3'], ['4', '4']] },
    { id: 'humans', label: 'People at this screen', default: '1', choices: [['1', '1 (rest CPU)'], ['all', 'Everyone']] },
  ],
  keys: [' ', 'Enter', '1', '2', '3', '4'],
  onStart(opts) {
    clearTimeout(timer);
    const players = Number(opts.players);
    state = create({ players, humans: opts.humans === 'all' ? players : 1 });
    buildTokens();
    showDie(1);
    afterChange();
  },
  onKey(key, down, repeat) {
    if (!down || repeat) return;
    if (key === ' ' || key === 'Enter') humanRoll();
    if (key >= '1' && key <= '4') humanMove(Number(key) - 1);
  },
});

function drawBoard() {
  ctx.fillStyle = '#e9ecfa';
  ctx.fillRect(0, 0, G * CELL, G * CELL);
  const corner = { green: [0, 0], yellow: [0, 9], red: [9, 0], blue: [9, 9] };
  for (const [color, [r, c]] of Object.entries(corner)) {
    ctx.fillStyle = PALETTE[color];
    ctx.fillRect(c * CELL, r * CELL, 6 * CELL, 6 * CELL);
    ctx.fillStyle = '#f8f9ff';
    ctx.beginPath();
    ctx.roundRect((c + 0.8) * CELL, (r + 0.8) * CELL, 4.4 * CELL, 4.4 * CELL, 14);
    ctx.fill();
  }
  const square = (r, c, fill) => {
    ctx.fillStyle = fill;
    ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    ctx.strokeStyle = '#8891bd';
    ctx.lineWidth = 1;
    ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
  };
  TRACK.forEach(([r, c]) => square(r, c, '#ffffff'));
  for (const [color, list] of Object.entries(HOME_COLUMN)) list.forEach(([r, c]) => square(r, c, PALETTE[color]));
  square(13, 6, PALETTE.red);
  square(6, 1, PALETTE.green);
  square(1, 8, PALETTE.yellow);
  square(8, 13, PALETTE.blue);
  // Safe squares carry a star.
  ctx.fillStyle = '#6e77a8';
  ctx.font = `${CELL * 0.62}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const index of SAFE) {
    const [r, c] = TRACK[index];
    ctx.fillText('★', (c + 0.5) * CELL, (r + 0.54) * CELL);
  }
  const centre = [[6, 6], [6, 9], [9, 9], [9, 6]];
  const triangle = (a, b, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(a[1] * CELL, a[0] * CELL);
    ctx.lineTo(b[1] * CELL, b[0] * CELL);
    ctx.lineTo(7.5 * CELL, 7.5 * CELL);
    ctx.fill();
  };
  triangle(centre[0], centre[1], PALETTE.yellow);
  triangle(centre[1], centre[2], PALETTE.blue);
  triangle(centre[2], centre[3], PALETTE.red);
  triangle(centre[3], centre[0], PALETTE.green);
}

function buildTokens() {
  tokens = [];
  tokenLayer.replaceChildren();
  state.seats.forEach((seat, seatIndex) => {
    seat.tokens.forEach((_, i) => {
      const button = Arcade.el('button', { type: 'button', className: 'token', textContent: i + 1 });
      button.style.setProperty('--token', PALETTE[seat.color]);
      button.addEventListener('click', () => { if (seatIndex === state.turn) humanMove(i); });
      tokenLayer.append(button);
      tokens.push({ seatIndex, i, button });
    });
  });
}

function placeTokens() {
  const movable = state.phase === 'move' ? new Set(legalTokens(state)) : new Set();
  const stacks = new Map();
  for (const t of tokens) {
    const seat = state.seats[t.seatIndex];
    const [r, c] = cellOf(seat.color, seat.tokens[t.i], t.i);
    const key = `${r},${c}`;
    const n = stacks.get(key) || 0;
    stacks.set(key, n + 1);
    // Tokens sharing a square fan out a little so each can still be tapped.
    const dx = [0, 0.2, -0.2, 0.2][n % 4];
    const dy = [0, 0.2, 0.2, -0.2][n % 4];
    t.button.style.left = `${((c + 0.5 + dx) / G) * 100}%`;
    t.button.style.top = `${((r + 0.5 + dy) / G) * 100}%`;
    const active = t.seatIndex === state.turn && movable.has(t.i) && seat.human;
    t.button.classList.toggle('movable', active);
    t.button.tabIndex = active ? 0 : -1;
    t.button.setAttribute('aria-label', `${NAMES[seat.color]} token ${t.i + 1}${active ? ', can move' : ''}`);
  }
}

function showDie(value) {
  dieBtn.replaceChildren(...Array.from({ length: 9 }, (_, i) => Arcade.el('i', { className: PIPS[value].includes(i) ? 'pip' : '' })));
  dieBtn.setAttribute('aria-label', `Die showing ${value}. Roll`);
}

function afterChange(note = '') {
  placeTokens();
  const seat = state.seats[state.turn];
  dieBtn.style.setProperty('--die', PALETTE[seat.color]);
  const canRoll = shell.playing && state.phase === 'roll' && seat.human;
  dieBtn.disabled = !canRoll;
  shell.score(state.seats[0].tokens.filter((p) => p === LudoLogic.HOME).length);
  shell.stat('Turn', NAMES[seat.color]);
  const action = state.phase === 'roll' ? 'roll' : 'pick a token';
  statusEl.textContent = `${note}${note ? ' ' : ''}${seat.human ? `${NAMES[seat.color]}: ${action}.` : `${NAMES[seat.color]} is playing…`}`;
  if (state.phase !== 'over' && !seat.human) cpuTurn();
}

function doRoll() {
  const seat = state.seats[state.turn];
  const result = roll(state);
  if (!result) return;
  showDie(result.die);
  shell.sound('tap');
  shell.say(`${NAMES[seat.color]} rolled ${result.die}`);
  if (result.lost === 'three sixes') {
    afterChange(`${NAMES[seat.color]} rolled three sixes and lost the turn.`);
    return;
  }
  if (result.lost === 'no move') {
    afterChange(`${NAMES[seat.color]} rolled ${result.die}, no move.`);
    return;
  }
  if (result.again) {
    // Only reachable when a six has no legal token, which can happen with tokens one step from home.
    afterChange(`${NAMES[seat.color]} rolled a six with no move, and rolls again.`);
    return;
  }
  if (result.moves.length === 1 && seat.human) {
    // One choice is not a choice: play it after a beat so the roll can be read.
    timer = setTimeout(() => doMove(result.moves[0]), 320);
    placeTokens();
    return;
  }
  afterChange();
}

function doMove(tokenIndex) {
  if (!shell.playing) return;
  const seat = state.seats[state.turn];
  const events = move(state, tokenIndex);
  if (!events) return;
  let note = '';
  if (events.includes('capture')) { shell.sound('hurt'); note = `${NAMES[seat.color]} captured a token.`; }
  else if (events.includes('home')) { shell.sound('coin'); note = `${NAMES[seat.color]} reached home.`; }
  else shell.sound('move');
  if (events.includes('win')) {
    placeTokens();
    finish(seat);
    return;
  }
  afterChange(note);
}

function finish(seat) {
  const everyone = state.seats.every((s) => s.human);
  const won = everyone || state.seats[state.winner].human;
  if (!everyone && won) {
    const wins = Arcade.store.get('ludo:wins', 0) + 1;
    Arcade.store.set('ludo:wins', wins);
    shell.hub(`${wins} ${wins === 1 ? 'win' : 'wins'}`);
  }
  shell.over({ title: everyone ? `${NAMES[seat.color]} wins` : won ? 'You win' : `${NAMES[seat.color]} wins`, text: 'All four tokens are home.', win: won });
}

function humanRoll() {
  const seat = state.seats[state.turn];
  if (shell.playing && seat.human && state.phase === 'roll') doRoll();
}

function humanMove(tokenIndex) {
  const seat = state.seats[state.turn];
  if (shell.playing && seat.human && state.phase === 'move' && legalTokens(state).includes(tokenIndex)) {
    clearTimeout(timer);
    doMove(tokenIndex);
  }
}

function cpuTurn() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (!shell.playing) return;
    if (state.phase === 'roll') { doRoll(); return; }
    if (state.phase === 'move') doMove(chooseToken(state));
  }, 480);
}

dieBtn.addEventListener('click', humanRoll);
drawBoard();
showDie(1);
