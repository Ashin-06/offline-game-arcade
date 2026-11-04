const { START, isWhite, fromFEN, inCheck, legalMoves, play, status, chooseMove } = ChessLogic;
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const undoBtn = document.getElementById('undo');
const promoEl = document.getElementById('promotion');
// The variation selector keeps phones from swapping the pawn for a colour emoji.
const GLYPHS = { k: '♚\uFE0E', q: '♛\uFE0E', r: '♜\uFE0E', b: '♝\uFE0E', n: '♞\uFE0E', p: '♟\uFE0E' };
const NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const VERDICTS = { stalemate: 'Stalemate', fifty: 'Draw by the fifty-move rule', repetition: 'Draw by repetition', material: 'Draw: not enough pieces to mate' };

let state = fromFEN(START);
let history = [];
let selected = -1;
let lastMove = null;
let humanWhite = true;
let twoPlayer = false;
let timer = 0;
let cursor = 52;
let pendingPromotion = null;

const shell = Arcade.game({
  id: 'chess',
  title: 'Chess',
  scoreLabel: 'Move',
  noBest: true,
  pausable: false,
  how: 'Full rules: castling, en passant, promotion, and draws by stalemate, repetition, the fifty-move rule and lack of material. Pick a piece, then its square. <kbd>Arrows</kbd> and <kbd>Enter</kbd> work too, <kbd>U</kbd> undoes.',
  options: [
    { id: 'mode', label: 'Opponent', default: 'medium', choices: [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['two', 'Two players']] },
    { id: 'side', label: 'You play', default: 'white', choices: [['white', 'White'], ['black', 'Black']], showIf: (o) => o.mode !== 'two' },
  ],
  keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'u'],
  onStart(opts) {
    clearTimeout(timer);
    twoPlayer = opts.mode === 'two';
    humanWhite = opts.side !== 'black';
    state = fromFEN(START);
    history = [];
    selected = -1;
    lastMove = null;
    pendingPromotion = null;
    promoEl.hidden = true;
    build();
    paint();
    maybeCpu();
  },
  onKey(key, down, repeat) {
    if (!down || pendingPromotion) return;
    // Arrows follow the board as it is shown, which is upside down for Black.
    const flip = !twoPlayer && !humanWhite ? -1 : 1;
    const r = Math.floor(cursor / 8);
    const f = cursor % 8;
    if (key === 'ArrowLeft' && f - flip >= 0 && f - flip < 8) focusSquare(cursor - flip);
    if (key === 'ArrowRight' && f + flip >= 0 && f + flip < 8) focusSquare(cursor + flip);
    if (key === 'ArrowUp' && r - flip >= 0 && r - flip < 8) focusSquare(cursor - 8 * flip);
    if (key === 'ArrowDown' && r + flip >= 0 && r + flip < 8) focusSquare(cursor + 8 * flip);
    if (repeat) return;
    if (key === 'Enter' || key === ' ') choose(cursor);
    if (key === 'u') undo();
  },
});

const squares = [];
function build() {
  const order = Array.from({ length: 64 }, (_, i) => (!twoPlayer && !humanWhite ? 63 - i : i));
  boardEl.replaceChildren(...order.map((sq) => {
    const button = Arcade.el('button', { type: 'button', className: 'square', tabIndex: sq === cursor ? 0 : -1 });
    button.addEventListener('focus', () => { cursor = sq; });
    button.addEventListener('click', () => choose(sq));
    squares[sq] = button;
    return button;
  }));
}

function focusSquare(sq) {
  squares[cursor].tabIndex = -1;
  squares[sq].tabIndex = 0;
  squares[sq].focus();
}

const humanToMove = () => twoPlayer || state.white === humanWhite;
const squareName = (sq) => `${String.fromCharCode(97 + (sq % 8))}${8 - Math.floor(sq / 8)}`;

function paint() {
  const moves = selected >= 0 ? legalMoves(state).filter((m) => m.from === selected) : [];
  const targets = new Set(moves.map((m) => m.to));
  const checked = inCheck(state) ? state.board.indexOf(state.white ? 'K' : 'k') : -1;
  state.board.forEach((p, sq) => {
    const dark = (Math.floor(sq / 8) + sq % 8) % 2 === 1;
    const cell = squares[sq];
    cell.className = `square ${dark ? 'dark' : 'light'}`;
    if (sq === selected) cell.classList.add('picked');
    if (lastMove && (sq === lastMove.from || sq === lastMove.to)) cell.classList.add('last');
    if (targets.has(sq)) cell.classList.add(p ? 'take' : 'target');
    if (sq === checked) cell.classList.add('check');
    cell.replaceChildren();
    if (p) {
      cell.append(Arcade.el('span', { className: `piece ${isWhite(p) ? 'white' : 'black'}`, textContent: GLYPHS[p.toLowerCase()] }));
    }
    const piece = p ? `${isWhite(p) ? 'white' : 'black'} ${NAMES[p.toLowerCase()]}` : 'empty';
    cell.setAttribute('aria-label', `${squareName(sq)}, ${piece}${targets.has(sq) ? ', can move here' : ''}`);
  });
  shell.score(state.full);
  const side = state.white ? 'White' : 'Black';
  const check = checked >= 0 ? ' Check.' : '';
  statusEl.textContent = twoPlayer || humanToMove() ? `${side} to move.${check}` : `Thinking…${check}`;
  undoBtn.disabled = history.length === 0 || !humanToMove();
}

function choose(sq) {
  if (!shell.playing || !humanToMove() || pendingPromotion) return;
  const moves = legalMoves(state);
  const options = selected >= 0 ? moves.filter((m) => m.from === selected && m.to === sq) : [];
  if (options.length > 1) {
    pendingPromotion = options;
    showPromotion();
    return;
  }
  if (options.length === 1) {
    apply(options[0]);
    return;
  }
  const mine = state.board[sq] && isWhite(state.board[sq]) === state.white;
  selected = mine && moves.some((m) => m.from === sq) && sq !== selected ? sq : -1;
  shell.sound('tap');
  paint();
}

function showPromotion() {
  promoEl.replaceChildren(...['q', 'r', 'b', 'n'].map((type) => {
    const button = Arcade.el('button', { type: 'button', textContent: GLYPHS[type] });
    button.setAttribute('aria-label', `Promote to ${NAMES[type]}`);
    button.addEventListener('click', () => {
      const move = pendingPromotion.find((m) => m.promo === type);
      pendingPromotion = null;
      promoEl.hidden = true;
      apply(move);
    });
    return button;
  }));
  promoEl.hidden = false;
  promoEl.firstChild.focus();
}

function apply(move) {
  const capture = state.board[move.to] || move.enPassant;
  history.push({ state, lastMove });
  state = play(state, move);
  lastMove = move;
  selected = -1;
  shell.sound(capture ? 'hit' : 'tap');
  paint();
  const result = status(state);
  if (result === 'playing') {
    if (inCheck(state)) shell.sound('turn');
    maybeCpu();
    return;
  }
  finish(result);
}

function finish(result) {
  if (result !== 'checkmate') {
    shell.over({ title: VERDICTS[result], text: 'Half a point each.' });
    return;
  }
  const whiteWon = !state.white;
  if (twoPlayer) {
    shell.over({ title: 'Checkmate', text: `${whiteWon ? 'White' : 'Black'} wins.`, win: true });
    return;
  }
  const won = whiteWon === humanWhite;
  if (won) {
    const wins = Arcade.store.get('chess:wins', 0) + 1;
    Arcade.store.set('chess:wins', wins);
    shell.hub(`${wins} ${wins === 1 ? 'win' : 'wins'}`);
  }
  shell.over({ title: won ? 'Checkmate. You win' : 'Checkmate. You lose', text: `After ${state.full} moves.`, win: won });
}

function maybeCpu() {
  if (twoPlayer || state.white === humanWhite) return;
  // Waits a moment so the reply never appears before the player's own move has been drawn.
  timer = setTimeout(() => {
    if (shell.playing) apply(chooseMove(state, shell.opts.mode));
  }, 260);
}

function undo() {
  if (!shell.playing || !humanToMove() || history.length === 0) return;
  // Against the computer, step back past its reply to the player's own last turn.
  let entry = history.pop();
  while (!twoPlayer && entry.state.white !== humanWhite && history.length) entry = history.pop();
  if (!twoPlayer && entry.state.white !== humanWhite) return;
  ({ state, lastMove } = entry);
  selected = -1;
  shell.sound('move');
  paint();
}

undoBtn.addEventListener('click', undo);
