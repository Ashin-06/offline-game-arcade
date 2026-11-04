// Proves a Beacon Climb stage can be finished by searching from one standing spot to the next:
// from each spot it tries walks and a spread of jumps, using the game's own physics.
// Patrollers are left out, because they can always be stomped or waited for.
const Platformer = require('../games/platformer/platformer.logic.js');

const key = (p) => `${Math.round(p.x / 8)},${Math.round(p.y)},${Math.sign(Math.round(p.vx))}`;

// Each plan is [direction, frames] steps, then the last direction holds until the player lands.
function plans() {
  const out = [];
  for (const dir of [-1, 0, 1]) {
    for (const jump of [0, 8, 30]) {
      const lead = jump ? 14 : 8;
      out.push({ jump, moves: [[dir, 200]], settle: lead });
      if (dir) {
        out.push({ jump, moves: [[dir, lead], [0, 200]], settle: lead });
        out.push({ jump, moves: [[dir, lead + 10], [-dir, 200]], settle: lead });
      }
    }
  }
  return out;
}

function explore(index) {
  const level = Platformer.parse(Platformer.LEVELS[index]);
  const seen = new Set();
  const sparks = new Set();
  let door = false;
  const start = Platformer.newPlayer(level);
  for (let i = 0; i < 60 && !start.grounded; i++) Platformer.advance(level, start, {});
  const queue = [start];
  while (queue.length && !(door && sparks.size === level.coins.length)) {
    const from = queue.pop();
    for (const plan of plans()) {
      const p = { ...from };
      let frame = 0;
      let dead = false;
      for (const [dir, frames] of plan.moves) {
        for (let i = 0; i < frames && !dead; i++, frame++) {
          const result = Platformer.advance(level, p, { left: dir < 0, right: dir > 0, jump: frame < plan.jump });
          level.coins.forEach((coin, n) => { if (Platformer.touchesCoin(p, coin)) sparks.add(n); });
          if (result === 'door') door = true;
          if (result === 'dead') dead = true;
          if (!dead && p.grounded && frame >= plan.settle) break;
        }
        if (dead || (p.grounded && frame >= plan.settle)) break;
      }
      if (dead || !p.grounded) continue;
      const k = key(p);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(p);
      }
    }
  }
  return {
    door,
    missed: level.coins.filter((_, n) => !sparks.has(n)).map(({ c, r }) => `${c},${r}`),
    standingSpots: seen.size,
  };
}

module.exports = { explore };
