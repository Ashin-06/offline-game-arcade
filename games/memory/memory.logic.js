// Memory match rules. Cards are flipped in groups of two, three or four.
const MemoryLogic = (() => {
  const FACES = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮'];

  function shuffle(list, rng) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function create({ items = 8, group = 2, rng = Math.random } = {}) {
    const faces = [];
    for (const face of FACES.slice(0, items)) for (let i = 0; i < group; i++) faces.push(face);
    return {
      group,
      cards: shuffle(faces, rng).map((face) => ({ face, up: false, done: false })),
      up: [],
      moves: 0,
      matched: 0,
      total: items,
      waiting: false,
      won: false,
    };
  }

  // Returns 'ignored', 'flipped', 'miss', 'match' or 'win'. After 'miss' the board stays locked
  // until settle(), which gives the player time to see the cards.
  function flip(s, index) {
    const card = s.cards[index];
    if (s.waiting || s.won || !card || card.up || card.done) return 'ignored';
    card.up = true;
    s.up.push(index);
    if (s.up.length < s.group) return 'flipped';
    s.moves++;
    const same = s.up.every((i) => s.cards[i].face === card.face);
    if (!same) {
      s.waiting = true;
      return 'miss';
    }
    for (const i of s.up) s.cards[i].done = true;
    s.up = [];
    s.matched++;
    if (s.matched < s.total) return 'match';
    s.won = true;
    return 'win';
  }

  function settle(s) {
    for (const i of s.up) s.cards[i].up = false;
    s.up = [];
    s.waiting = false;
  }

  return { FACES, shuffle, create, flip, settle };
})();
if (typeof module !== 'undefined') module.exports = MemoryLogic;
