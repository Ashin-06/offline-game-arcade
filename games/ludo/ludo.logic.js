// Ludo rules. A token's progress is -1 in base, 0 to 50 on the shared track, 51 to 55 in its home
// column and 56 home. The shared track has 52 squares; each colour starts a quarter further round.
const LudoLogic = (() => {
  const COLORS = ['red', 'green', 'yellow', 'blue'];
  const STARTS = { red: 0, green: 13, yellow: 26, blue: 39 };
  const SAFE = new Set([0, 13, 26, 39, 8, 21, 34, 47]);
  const BASE = -1;
  const LAST_TRACK = 50;
  const HOME = 56;
  const TOKENS = 4;

  // Board layout on a 15 x 15 grid, clockwise from Red's start.
  const TRACK = [
    [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
    [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
    [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
    [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
    [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
    [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
    [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
    [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  ];
  const HOME_COLUMN = {
    red: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
    green: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
    yellow: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
    blue: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  };
  const BASE_SPOTS = {
    red: [[10.5, 1.5], [10.5, 3.5], [12.5, 1.5], [12.5, 3.5]],
    green: [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]],
    yellow: [[1.5, 10.5], [1.5, 12.5], [3.5, 10.5], [3.5, 12.5]],
    blue: [[10.5, 10.5], [10.5, 12.5], [12.5, 10.5], [12.5, 12.5]],
  };
  const HOME_SPOT = { red: [8.3, 7], green: [7, 5.7], yellow: [5.7, 7], blue: [7, 8.3] };

  function create({ players = 4, humans = 1, rng = Math.random } = {}) {
    // Two players sit opposite each other, which keeps the race fair.
    const seats = players === 2 ? ['red', 'yellow'] : COLORS.slice(0, players);
    return {
      rng,
      seats: seats.map((color, i) => ({ color, human: i < humans, tokens: new Array(TOKENS).fill(BASE), place: 0 })),
      turn: 0,
      phase: 'roll',
      die: 0,
      sixes: 0,
      finished: 0,
      winner: null,
    };
  }

  const absolute = (color, progress) => (STARTS[color] + progress) % 52;
  const onTrack = (progress) => progress >= 0 && progress <= LAST_TRACK;

  // Which board cell a token stands on, in grid coordinates.
  function cellOf(color, progress, index) {
    if (progress === BASE) return BASE_SPOTS[color][index];
    if (progress === HOME) return HOME_SPOT[color];
    if (progress > LAST_TRACK) return HOME_COLUMN[color][progress - LAST_TRACK - 1];
    return TRACK[absolute(color, progress)];
  }

  const canMove = (progress, die) => (progress === BASE ? die === 6 : progress !== HOME && progress + die <= HOME);

  function legalTokens(s) {
    const seat = s.seats[s.turn];
    const out = [];
    seat.tokens.forEach((progress, i) => { if (canMove(progress, s.die)) out.push(i); });
    return out;
  }

  // Skips seats that have already finished.
  function nextSeat(s) {
    do s.turn = (s.turn + 1) % s.seats.length;
    while (s.seats[s.turn].place);
    s.sixes = 0;
    s.phase = 'roll';
  }

  // Returns { die, moves, lost }. With no legal token, or a third six in a row, the turn passes.
  function roll(s) {
    if (s.phase !== 'roll') return null;
    s.die = 1 + Math.floor(s.rng() * 6);
    if (s.die === 6) s.sixes++;
    if (s.sixes === 3) {
      const die = s.die;
      nextSeat(s);
      return { die, moves: [], lost: 'three sixes' };
    }
    const moves = legalTokens(s);
    if (moves.length === 0) {
      const die = s.die;
      if (die === 6) return { die, moves, lost: null, again: true };
      nextSeat(s);
      return { die, moves, lost: 'no move' };
    }
    s.phase = 'move';
    return { die: s.die, moves, lost: null };
  }

  // Opposing tokens on a square that are alone get captured. Two of one colour hold it safely.
  function occupants(s, square) {
    const groups = [];
    s.seats.forEach((seat, seatIndex) => {
      const tokens = [];
      seat.tokens.forEach((progress, i) => {
        if (onTrack(progress) && absolute(seat.color, progress) === square) tokens.push(i);
      });
      if (tokens.length) groups.push({ seatIndex, tokens });
    });
    return groups;
  }

  // Moves a token. Returns events: 'out', 'step', 'capture', 'home', 'finish', 'win'.
  function move(s, tokenIndex) {
    if (s.phase !== 'move') return null;
    const seat = s.seats[s.turn];
    const progress = seat.tokens[tokenIndex];
    if (!canMove(progress, s.die)) return null;
    const events = [];
    const next = progress === BASE ? 0 : progress + s.die;
    seat.tokens[tokenIndex] = next;
    events.push(progress === BASE ? 'out' : 'step');
    let bonus = false;

    if (onTrack(next)) {
      const square = absolute(seat.color, next);
      if (!SAFE.has(square)) {
        for (const group of occupants(s, square)) {
          if (group.seatIndex !== s.turn && group.tokens.length === 1) {
            s.seats[group.seatIndex].tokens[group.tokens[0]] = BASE;
            events.push('capture');
            bonus = true;
          }
        }
      }
    }
    if (next === HOME) {
      events.push('home');
      bonus = true;
      if (seat.tokens.every((p) => p === HOME)) {
        s.finished++;
        seat.place = s.finished;
        events.push('finish');
        if (s.finished === 1) s.winner = s.turn;
        // The game ends with the first winner: the rest of the table is only racing for second.
        s.phase = 'over';
        events.push('win');
        return events;
      }
    }
    if (s.die === 6 || bonus) {
      s.phase = 'roll';
      if (s.die !== 6) s.sixes = 0;
    } else {
      nextSeat(s);
    }
    return events;
  }

  // Finishing beats capturing beats leaving base; among the rest, prefer safety and progress.
  function chooseToken(s) {
    const seat = s.seats[s.turn];
    let best = null;
    let bestScore = -Infinity;
    for (const i of legalTokens(s)) {
      const progress = seat.tokens[i];
      const next = progress === BASE ? 0 : progress + s.die;
      let score = next / 10;
      if (next === HOME) score += 100;
      if (progress === BASE) score += 30;
      if (next > LAST_TRACK && progress <= LAST_TRACK) score += 20;
      if (onTrack(next)) {
        const square = absolute(seat.color, next);
        if (SAFE.has(square)) score += 12;
        else if (occupants(s, square).some((g) => g.seatIndex !== s.turn && g.tokens.length === 1)) score += 60;
      }
      if (onTrack(progress) && !SAFE.has(absolute(seat.color, progress))) score += 3;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  return { COLORS, SAFE, TRACK, HOME_COLUMN, BASE, HOME, LAST_TRACK, create, roll, move, legalTokens, chooseToken, cellOf, absolute };
})();
if (typeof module !== 'undefined') module.exports = LudoLogic;
