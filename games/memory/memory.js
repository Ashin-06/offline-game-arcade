const boardEl = document.getElementById('board');
const FACE_NAMES = { '🐶': 'dog', '🐱': 'cat', '🐭': 'mouse', '🐹': 'hamster', '🐰': 'rabbit', '🦊': 'fox', '🐻': 'bear', '🐼': 'panda', '🐨': 'koala', '🐯': 'tiger', '🦁': 'lion', '🐮': 'cow' };
let state = MemoryLogic.create();
let settleTimer = 0;

const shell = Arcade.game({
  id: 'memory',
  title: 'Memory Match',
  scoreLabel: 'Moves',
  lowerIsBetter: true,
  pausable: false,
  how: 'Find every matching set in as few moves as you can. Click or tap, or <kbd>Tab</kbd> to a card and press <kbd>Enter</kbd>.',
  options: [
    { id: 'items', label: 'Different animals', default: '8', choices: [['6', '6'], ['8', '8'], ['12', '12']] },
    { id: 'group', label: 'Match size', default: '2', choices: [['2', 'Pairs'], ['3', 'Threes'], ['4', 'Fours']] },
  ],
  bestKey: (o) => `${o.items}x${o.group}`,
  bestLabel: (o) => `${o.items} × ${o.group}`,
  onStart(opts) {
    // The timer belongs to the previous board: left running, it would touch the new one.
    clearTimeout(settleTimer);
    state = MemoryLogic.create({ items: Number(opts.items), group: Number(opts.group) });
    build();
  },
});

function faceLabel(card) {
  if (card.done) return `${FACE_NAMES[card.face]}, matched`;
  return card.up ? FACE_NAMES[card.face] : 'Hidden card';
}

function build() {
  const count = state.cards.length;
  const columns = Math.ceil(Math.sqrt(count));
  boardEl.style.setProperty('--cols', columns);
  boardEl.style.setProperty('--rows', Math.ceil(count / columns));
  boardEl.replaceChildren(...state.cards.map((card, i) => {
    const button = Arcade.el('button', { type: 'button', className: 'card' }, [
      Arcade.el('span', { className: 'face back' }),
      Arcade.el('span', { className: 'face front', textContent: card.face }),
    ]);
    button.setAttribute('aria-label', 'Hidden card');
    button.addEventListener('click', () => choose(i));
    return button;
  }));
}

function paint() {
  state.cards.forEach((card, i) => {
    const button = boardEl.children[i];
    button.classList.toggle('up', card.up || card.done);
    button.classList.toggle('done', card.done);
    button.setAttribute('aria-label', faceLabel(card));
  });
}

function choose(index) {
  if (!shell.playing) return;
  const result = MemoryLogic.flip(state, index);
  if (result === 'ignored') return;
  paint();
  shell.score(state.moves);
  shell.sound(result === 'flipped' ? 'tap' : result === 'miss' ? 'lock' : 'coin');
  if (result === 'miss') {
    settleTimer = setTimeout(() => {
      MemoryLogic.settle(state);
      paint();
    }, 900);
  }
  if (result === 'win') {
    const best = shell.record(state.moves);
    shell.over({ title: 'All matched', text: `${state.moves} moves${best ? ', your best yet' : ''}.`, win: true });
  }
}
