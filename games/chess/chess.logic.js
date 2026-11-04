// Full chess rules and a search opponent. Squares run 0 (a8) to 63 (h1); pieces are FEN letters.
const ChessLogic = (() => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const isWhite = (p) => p === p.toUpperCase();
  const fileOf = (sq) => sq % 8;
  const rankOf = (sq) => Math.floor(sq / 8);
  const onBoard = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8;
  const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  function fromFEN(fen) {
    const [rows, turn, castle, ep, half, full] = fen.split(' ');
    const board = [];
    for (const ch of rows.replaceAll('/', '')) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) board.push('');
      else board.push(ch);
    }
    const epSquare = ep === '-' ? -1 : (8 - Number(ep[1])) * 8 + (ep.charCodeAt(0) - 97);
    const s = { board, white: turn === 'w', castle: castle === '-' ? '' : castle, ep: epSquare, half: Number(half) || 0, full: Number(full) || 1, seen: [] };
    s.seen = [positionKey(s)];
    return s;
  }

  // Castling and en passant are part of what makes two positions the same for repetition.
  const positionKey = (s) => `${s.board.map((p) => p || '.').join('')}${s.white ? 'w' : 'b'}${s.castle}${s.ep}`;

  function attacked(board, sq, byWhite) {
    const r = rankOf(sq);
    const f = fileOf(sq);
    const pawn = byWhite ? 'P' : 'p';
    const pawnRank = byWhite ? r + 1 : r - 1;
    for (const df of [-1, 1]) {
      if (onBoard(pawnRank, f + df) && board[pawnRank * 8 + f + df] === pawn) return true;
    }
    const knight = byWhite ? 'N' : 'n';
    for (const [dr, df] of KNIGHT) if (onBoard(r + dr, f + df) && board[(r + dr) * 8 + f + df] === knight) return true;
    const king = byWhite ? 'K' : 'k';
    for (const [dr, df] of KING) if (onBoard(r + dr, f + df) && board[(r + dr) * 8 + f + df] === king) return true;
    const queen = byWhite ? 'Q' : 'q';
    const slide = (dirs, piece) => {
      for (const [dr, df] of dirs) {
        let nr = r + dr;
        let nf = f + df;
        while (onBoard(nr, nf)) {
          const p = board[nr * 8 + nf];
          if (p) {
            if (p === piece || p === queen) return true;
            break;
          }
          nr += dr;
          nf += df;
        }
      }
      return false;
    };
    return slide(ROOK, byWhite ? 'R' : 'r') || slide(BISHOP, byWhite ? 'B' : 'b');
  }

  const kingSquare = (board, white) => board.indexOf(white ? 'K' : 'k');
  const inCheck = (s, white = s.white) => attacked(s.board, kingSquare(s.board, white), !white);

  function pseudoMoves(s) {
    const { board, white } = s;
    const moves = [];
    const own = (p) => p && isWhite(p) === white;
    const enemy = (p) => p && isWhite(p) !== white;
    for (let sq = 0; sq < 64; sq++) {
      const p = board[sq];
      if (!p || !own(p)) continue;
      const r = rankOf(sq);
      const f = fileOf(sq);
      const type = p.toLowerCase();
      if (type === 'p') {
        const dir = white ? -1 : 1;
        const lastRank = white ? 0 : 7;
        const push = (to, extra = {}) => {
          if (rankOf(to) === lastRank) for (const promo of ['q', 'r', 'b', 'n']) moves.push({ from: sq, to, promo, ...extra });
          else moves.push({ from: sq, to, ...extra });
        };
        const one = (r + dir) * 8 + f;
        if (!board[one]) {
          push(one);
          const two = (r + 2 * dir) * 8 + f;
          if (r === (white ? 6 : 1) && !board[two]) moves.push({ from: sq, to: two, double: true });
        }
        for (const df of [-1, 1]) {
          if (!onBoard(r + dir, f + df)) continue;
          const to = (r + dir) * 8 + f + df;
          if (enemy(board[to])) push(to);
          else if (to === s.ep) moves.push({ from: sq, to, enPassant: true });
        }
      } else if (type === 'n' || type === 'k') {
        for (const [dr, df] of type === 'n' ? KNIGHT : KING) {
          if (!onBoard(r + dr, f + df)) continue;
          const to = (r + dr) * 8 + f + df;
          if (!own(board[to])) moves.push({ from: sq, to });
        }
      } else {
        const dirs = type === 'r' ? ROOK : type === 'b' ? BISHOP : KING;
        for (const [dr, df] of dirs) {
          let nr = r + dr;
          let nf = f + df;
          while (onBoard(nr, nf)) {
            const to = nr * 8 + nf;
            if (own(board[to])) break;
            moves.push({ from: sq, to });
            if (board[to]) break;
            nr += dr;
            nf += df;
          }
        }
      }
    }
    // Castling: rights kept, squares empty, and the king neither starts in, crosses nor lands in check.
    const kingAt = white ? 60 : 4;
    if (board[kingAt] === (white ? 'K' : 'k') && !attacked(board, kingAt, !white)) {
      if (s.castle.includes(white ? 'K' : 'k') && !board[kingAt + 1] && !board[kingAt + 2]
        && !attacked(board, kingAt + 1, !white) && !attacked(board, kingAt + 2, !white)) {
        moves.push({ from: kingAt, to: kingAt + 2, castle: 'k' });
      }
      if (s.castle.includes(white ? 'Q' : 'q') && !board[kingAt - 1] && !board[kingAt - 2] && !board[kingAt - 3]
        && !attacked(board, kingAt - 1, !white) && !attacked(board, kingAt - 2, !white)) {
        moves.push({ from: kingAt, to: kingAt - 2, castle: 'q' });
      }
    }
    return moves;
  }

  // Returns a new state; the one passed in is left alone so undo and search stay simple.
  function makeMove(s, m) {
    const board = s.board.slice();
    const piece = board[m.from];
    const captured = board[m.to] || m.enPassant;
    board[m.to] = m.promo ? (s.white ? m.promo.toUpperCase() : m.promo) : piece;
    board[m.from] = '';
    if (m.enPassant) board[m.to + (s.white ? 8 : -8)] = '';
    if (m.castle === 'k') { board[m.to - 1] = board[m.to + 1]; board[m.to + 1] = ''; }
    if (m.castle === 'q') { board[m.to + 1] = board[m.to - 2]; board[m.to - 2] = ''; }

    let { castle } = s;
    if (castle) {
      // A king or rook moving, or a rook being taken on its corner, loses that right.
      const lose = { 60: 'KQ', 4: 'kq', 63: 'K', 56: 'Q', 7: 'k', 0: 'q' };
      for (const sq of [m.from, m.to]) {
        if (lose[sq]) for (const c of lose[sq]) castle = castle.replace(c, '');
      }
    }
    const next = {
      board,
      white: !s.white,
      castle,
      ep: m.double ? (m.from + m.to) / 2 : -1,
      half: piece.toLowerCase() === 'p' || captured ? 0 : s.half + 1,
      full: s.full + (s.white ? 0 : 1),
      seen: s.seen,
    };
    return next;
  }

  function legalMoves(s) {
    return pseudoMoves(s).filter((m) => {
      const after = makeMove(s, m);
      return !attacked(after.board, kingSquare(after.board, s.white), !s.white);
    });
  }

  // A move in the actual game: unlike search moves, these count towards repetition.
  function play(s, m) {
    const next = makeMove(s, m);
    next.seen = [...s.seen, positionKey(next)];
    return next;
  }

  function insufficient(board) {
    const others = [];
    board.forEach((p, sq) => { if (p && p.toLowerCase() !== 'k') others.push({ p: p.toLowerCase(), sq }); });
    if (others.length === 0) return true;
    if (others.length === 1) return others[0].p === 'b' || others[0].p === 'n';
    // Any number of bishops all on one colour of square can never mate.
    return others.every((o) => o.p === 'b')
      && new Set(others.map((o) => (rankOf(o.sq) + fileOf(o.sq)) % 2)).size === 1;
  }

  // 'checkmate', 'stalemate', 'fifty', 'repetition', 'material', or 'playing'.
  function status(s) {
    if (legalMoves(s).length === 0) return inCheck(s) ? 'checkmate' : 'stalemate';
    if (s.half >= 100) return 'fifty';
    if (insufficient(s.board)) return 'material';
    const key = positionKey(s);
    if (s.seen.filter((k) => k === key).length >= 3) return 'repetition';
    return 'playing';
  }

  function perft(s, depth) {
    if (depth === 0) return 1;
    let total = 0;
    for (const m of legalMoves(s)) total += perft(makeMove(s, m), depth - 1);
    return total;
  }

  // --- Opponent ---
  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const CENTRE = Array.from({ length: 64 }, (_, sq) => {
    const r = rankOf(sq);
    const f = fileOf(sq);
    return 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(f - 3.5));
  });

  function evaluate(s) {
    let total = 0;
    s.board.forEach((p, sq) => {
      if (!p) return;
      const type = p.toLowerCase();
      const white = isWhite(p);
      let v = VALUE[type];
      if (type === 'p') v += (white ? 6 - rankOf(sq) : rankOf(sq) - 1) * 8 + CENTRE[sq] * 3;
      if (type === 'n' || type === 'b') v += CENTRE[sq] * 8;
      if (type === 'q') v += CENTRE[sq] * 2;
      if (type === 'k') v -= CENTRE[sq] * 6;
      total += white ? v : -v;
    });
    return s.white ? total : -total;
  }

  function ordered(s, moves) {
    const gain = (m) => {
      const victim = s.board[m.to];
      return (victim ? 10 * VALUE[victim.toLowerCase()] - VALUE[s.board[m.from].toLowerCase()] : 0) + (m.promo ? 800 : 0);
    };
    return moves.sort((a, b) => gain(b) - gain(a));
  }

  const MATE = 1000000;

  // Follows captures past the search horizon so it does not stop just before losing a piece.
  function quiesce(s, alpha, beta, left) {
    const standing = evaluate(s);
    if (standing >= beta || left === 0) return standing;
    let best = Math.max(alpha, standing);
    for (const m of ordered(s, legalMoves(s).filter((x) => s.board[x.to] || x.enPassant))) {
      const value = -quiesce(makeMove(s, m), -beta, -best, left - 1);
      if (value >= beta) return value;
      if (value > best) best = value;
    }
    return best;
  }

  function negamax(s, depth, alpha, beta, ply, quiet) {
    const moves = legalMoves(s);
    if (moves.length === 0) return inCheck(s) ? -MATE + ply : 0;
    if (s.half >= 100) return 0;
    if (depth === 0) return quiet ? quiesce(s, alpha, beta, 4) : evaluate(s);
    let best = -Infinity;
    for (const m of ordered(s, moves)) {
      const value = -negamax(makeMove(s, m), depth - 1, -beta, -alpha, ply + 1, quiet);
      if (value > best) best = value;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  const LEVELS = {
    easy: { depth: 1, blunder: 0.3, quiet: false, noise: 40 },
    medium: { depth: 2, blunder: 0, quiet: true, noise: 12 },
    hard: { depth: 3, blunder: 0, quiet: true, noise: 2 },
  };

  function chooseMove(s, level = 'medium', rng = Math.random) {
    const { depth, blunder, quiet, noise } = LEVELS[level];
    const moves = legalMoves(s);
    if (moves.length === 0) return null;
    if (rng() < blunder) return moves[Math.floor(rng() * moves.length)];
    let bestMove = moves[0];
    let bestValue = -Infinity;
    for (const m of ordered(s, moves)) {
      const value = -negamax(makeMove(s, m), depth - 1, -Infinity, -bestValue + noise, 1, quiet) + rng() * noise;
      if (value > bestValue) {
        bestValue = value;
        bestMove = m;
      }
    }
    return bestMove;
  }

  return { START, isWhite, fromFEN, attacked, inCheck, legalMoves, makeMove, play, status, perft, chooseMove };
})();
if (typeof module !== 'undefined') module.exports = ChessLogic;
