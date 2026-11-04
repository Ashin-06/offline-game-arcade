const { start, legalMoves, play, nextPlayer, count, chooseMove } = ReversiLogic;
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const undoBtn = document.getElementById('undo');
const NAMES = { 1: 'Dark', '-1': 'Light' };

let board = start();
let turn = 1;
let lastMove = -1;
let turned = [];
let history = [];
let human = 1;
let twoPlayer = false;
let timer = 0;
let focusIndex = 19;

const shell = Arcade.game({
  id: 'reversi',
  title: 'Reversi',
  scoreLabel: 'Dark',
  stats: ['Light'],
  noBest: true,
  pausable: false,
  how: 'Place a disc so a line of the other colour is trapped between it and another of yours. Those discs turn. Most discs when nobody can move wins. Click, tap, or use <kbd>Arrows</kbd> and <kbd>Enter</kbd>.',
  options: [
    { id: 'mode', label: 'Opponent', default: 'medium', choices: [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['two', 'Two players']] },
    { id: 'color', label: 'You play', default: 'dark', choices: [['dark', 'Dark (first)'], ['light', 'Light']], showIf: (o) => o.mode !== 'two' },
  ],
  keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'u'],
  onStart(opts) {
    clearTimeout(timer);
    twoPlayer = opts.mode === 'two';
    human = opts.color === 'light' ? -1 : 1;
    board = start();
    turn = 1;
    lastMove = -1;
    turned = [];
    history = [];
    paint();
    maybeCpu();
  },
  onKey(key, down, repeat) {
    if (!down) return;
    const r = Math.floor(focusIndex / 8);
    const c = focusIndex % 8;
    if (key === 'ArrowLeft' && c > 0) moveFocus(focusIndex - 1);
    if (key === 'ArrowRight' && c < 7) moveFocus(focusIndex + 1);
    if (key === 'ArrowUp' && r > 0) moveFocus(focusIndex - 8);
    if (key === 'ArrowDown' && r < 7) moveFocus(focusIndex + 8);
    if (repeat) return;
    if (key === 'Enter' || key === ' ') humanMove(focusIndex);
    if (key === 'u') undo();
  },
});

const cells = Array.from({ length: 64 }, (_, i) => {
  const button = Arcade.el('button', { type: 'button', className: 'square', tabIndex: i === focusIndex ? 0 : -1 });
  button.addEventListener('focus', () => { focusIndex = i; });
  button.addEventListener('click', () => humanMove(i));
  boardEl.append(button);
  return button;
});

function moveFocus(index) {
  cells[focusIndex].tabIndex = -1;
  cells[index].tabIndex = 0;
  cells[index].focus();
}

const humanToMove = () => twoPlayer || turn === human;

function paint() {
  const moves = shell.playing && humanToMove() ? legalMoves(board, turn) : [];
  board.forEach((value, i) => {
    const cell = cells[i];
    cell.className = 'square';
    if (moves.includes(i)) cell.classList.add('legal');
    if (i === lastMove) cell.classList.add('last');
    cell.replaceChildren();
    if (value) {
      const disc = Arcade.el('span', { className: `disc ${value === 1 ? 'dark' : 'light'}` });
      if (turned.includes(i)) disc.classList.add('turned');
      cell.append(disc);
    }
    const name = `${String.fromCharCode(65 + (i % 8))}${Math.floor(i / 8) + 1}`;
    const state = value ? NAMES[value] : moves.includes(i) ? 'legal move' : 'empty';
    cell.setAttribute('aria-label', `${name}, ${state}`);
  });
  const { dark, light } = count(board);
  shell.score(dark);
  shell.stat('Light', light);
  if (twoPlayer) statusEl.textContent = `${NAMES[turn]} to move`;
  else statusEl.textContent = humanToMove() ? `Your move (${NAMES[turn].toLowerCase()})` : 'Thinking…';
  undoBtn.disabled = history.length === 0 || !humanToMove();
}

function apply(index) {
  const result = play(board, turn, index);
  if (!result) return false;
  history.push({ board, turn, lastMove, turned });
  board = result.board;
  turned = result.turned;
  lastMove = index;
  shell.sound('tap');
  const next = nextPlayer(board, turn);
  if (next === null) {
    finish();
    return true;
  }
  if (next === turn) {
    const passed = NAMES[-turn];
    shell.say(`${passed} has no move and passes`);
    statusEl.dataset.note = `${passed} passes`;
  }
  turn = next;
  paint();
  if (statusEl.dataset.note) {
    statusEl.textContent = `${statusEl.dataset.note}. ${statusEl.textContent}`;
    delete statusEl.dataset.note;
  }
  maybeCpu();
  return true;
}

function humanMove(index) {
  if (!shell.playing || !humanToMove()) return;
  apply(index);
}

function maybeCpu() {
  if (twoPlayer || turn === human) return;
  // The pause lets the player see their own move land before the reply.
  timer = setTimeout(() => {
    if (!shell.playing) return;
    apply(chooseMove(board, turn, shell.opts.mode));
  }, 420);
}

function undo() {
  if (!shell.playing || history.length === 0 || !humanToMove()) return;
  // Against the computer, step back to the last position where it was the player's turn.
  let entry = history.pop();
  while (!twoPlayer && entry.turn !== human && history.length) entry = history.pop();
  if (!twoPlayer && entry.turn !== human) return;
  ({ board, turn, lastMove, turned } = entry);
  shell.sound('move');
  paint();
}

function finish() {
  paint();
  const { dark, light } = count(board);
  const margin = `${dark} to ${light}`;
  if (twoPlayer) {
    const title = dark === light ? 'A draw' : `${dark > light ? 'Dark' : 'Light'} wins`;
    shell.over({ title, text: `${margin}.`, win: dark !== light });
    return;
  }
  const mine = human === 1 ? dark : light;
  const theirs = human === 1 ? light : dark;
  if (mine > theirs) {
    const wins = Arcade.store.get('reversi:wins', 0) + 1;
    Arcade.store.set('reversi:wins', wins);
    shell.hub(`${wins} ${wins === 1 ? 'win' : 'wins'}`);
  }
  const title = mine === theirs ? 'A draw' : mine > theirs ? 'You win' : 'You lose';
  shell.over({ title, text: `${margin}.`, win: mine > theirs });
}

undoBtn.addEventListener('click', undo);
