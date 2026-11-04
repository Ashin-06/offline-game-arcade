// Reversi rules and a search opponent. The board is an array of 64 cells: 1 dark, -1 light, 0 empty.
const ReversiLogic = (() => {
  const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const WEIGHTS = [
    120, -20, 20, 5, 5, 20, -20, 120,
    -20, -40, -5, -5, -5, -5, -40, -20,
    20, -5, 15, 3, 3, 15, -5, 20,
    5, -5, 3, 3, 3, 3, -5, 5,
    5, -5, 3, 3, 3, 3, -5, 5,
    20, -5, 15, 3, 3, 15, -5, 20,
    -20, -40, -5, -5, -5, -5, -40, -20,
    120, -20, 20, 5, 5, 20, -20, 120,
  ];

  function start() {
    const board = new Array(64).fill(0);
    board[27] = -1;
    board[36] = -1;
    board[28] = 1;
    board[35] = 1;
    return board;
  }

  function flips(board, player, index) {
    if (board[index]) return [];
    const r = Math.floor(index / 8);
    const c = index % 8;
    const out = [];
    for (const [dr, dc] of DIRS) {
      const line = [];
      let nr = r + dr;
      let nc = c + dc;
      while (nr >= 0 && nc >= 0 && nr < 8 && nc < 8 && board[nr * 8 + nc] === -player) {
        line.push(nr * 8 + nc);
        nr += dr;
        nc += dc;
      }
      if (line.length && nr >= 0 && nc >= 0 && nr < 8 && nc < 8 && board[nr * 8 + nc] === player) out.push(...line);
    }
    return out;
  }

  function legalMoves(board, player) {
    const moves = [];
    for (let i = 0; i < 64; i++) if (!board[i] && flips(board, player, i).length) moves.push(i);
    return moves;
  }

  // Returns the new board and the discs that turned, or null for an illegal move.
  function play(board, player, index) {
    const turned = flips(board, player, index);
    if (!turned.length) return null;
    const next = board.slice();
    next[index] = player;
    for (const i of turned) next[i] = player;
    return { board: next, turned };
  }

  // Who moves after `player`: the opponent, the same player if the opponent must pass, or null
  // when neither can move and the game is over.
  function nextPlayer(board, player) {
    if (legalMoves(board, -player).length) return -player;
    if (legalMoves(board, player).length) return player;
    return null;
  }

  function count(board) {
    let dark = 0;
    let light = 0;
    for (const v of board) {
      if (v === 1) dark++;
      if (v === -1) light++;
    }
    return { dark, light };
  }

  function evaluate(board, player) {
    let position = 0;
    let discs = 0;
    let empty = 0;
    for (let i = 0; i < 64; i++) {
      const v = board[i];
      if (!v) { empty++; continue; }
      position += v * WEIGHTS[i];
      discs += v;
    }
    const mobility = legalMoves(board, 1).length - legalMoves(board, -1).length;
    // Early on discs are a liability; only the final count matters at the end.
    const discWeight = empty < 14 ? 8 : -1;
    return player * (position + mobility * 6 + discs * discWeight);
  }

  const WIN = 100000;

  function negamax(board, player, depth, alpha, beta) {
    const moves = legalMoves(board, player);
    if (moves.length === 0) {
      if (legalMoves(board, -player).length === 0) {
        const { dark, light } = count(board);
        return player * (dark - light) * WIN;
      }
      return -negamax(board, -player, depth, -beta, -alpha);
    }
    if (depth === 0) return evaluate(board, player);
    let best = -Infinity;
    moves.sort((a, b) => WEIGHTS[b] - WEIGHTS[a]);
    for (const move of moves) {
      const value = -negamax(play(board, player, move).board, -player, depth - 1, -beta, -alpha);
      if (value > best) best = value;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  const LEVELS = {
    easy: { depth: 1, blunder: 0.3, endgame: 0 },
    medium: { depth: 3, blunder: 0, endgame: 6 },
    hard: { depth: 5, blunder: 0, endgame: 10 },
  };

  function chooseMove(board, player, level = 'medium', rng = Math.random) {
    const { depth, blunder, endgame } = LEVELS[level];
    const moves = legalMoves(board, player);
    if (moves.length === 0) return null;
    if (rng() < blunder) return moves[Math.floor(rng() * moves.length)];
    const empty = board.filter((v) => !v).length;
    const plies = empty <= endgame ? empty : depth;
    let bestMove = moves[0];
    let bestValue = -Infinity;
    for (const move of moves) {
      // A little noise on the first move's score keeps repeat games from playing out the same.
      const value = -negamax(play(board, player, move).board, -player, plies - 1, -Infinity, -bestValue) + rng() * 0.5;
      if (value > bestValue) {
        bestValue = value;
        bestMove = move;
      }
    }
    return bestMove;
  }

  return { start, flips, legalMoves, play, nextPlayer, count, chooseMove };
})();
if (typeof module !== 'undefined') module.exports = ReversiLogic;
