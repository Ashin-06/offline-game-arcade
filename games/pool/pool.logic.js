// Eight-ball physics and rules on a 900 x 450 table. Units are pixels and seconds.
const PoolLogic = (() => {
  const W = 900;
  const H = 450;
  const R = 11;
  const FRICTION = 230;
  const STOP = 5;
  const CUSHION = 0.82;
  const RESTITUTION = 0.96;
  const MAX_POWER = 1500;
  const POCKETS = [
    { x: 0, y: 0, r: 25 }, { x: W / 2, y: -3, r: 23 }, { x: W, y: 0, r: 25 },
    { x: 0, y: H, r: 25 }, { x: W / 2, y: H + 3, r: 23 }, { x: W, y: H, r: 25 },
  ];
  const groupOf = (n) => (n === 0 || n === 8 ? null : n < 8 ? 'solid' : 'stripe');

  function rack() {
    // The 8 sits in the middle of the third row and each back corner holds one of each group.
    const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
    const balls = [{ n: 0, x: W * 0.25, y: H / 2, vx: 0, vy: 0, down: false }];
    let i = 0;
    for (let row = 0; row < 5; row++) {
      for (let k = 0; k <= row; k++) {
        balls.push({
          n: order[i++],
          x: W * 0.7 + row * R * 1.76,
          y: H / 2 + (k - row / 2) * (R * 2 + 0.5),
          vx: 0,
          vy: 0,
          down: false,
        });
      }
    }
    return balls;
  }

  function create({ twoPlayer = false, level = 'medium', rng = Math.random } = {}) {
    return {
      rng, twoPlayer, level,
      balls: rack(),
      turn: 0,
      groups: [null, null],
      moving: false,
      inHand: false,
      isBreak: true,
      shot: null,
      winner: null,
      reason: '',
      foul: '',
    };
  }

  const cue = (s) => s.balls[0];
  const remaining = (s, group) => s.balls.filter((b) => !b.down && groupOf(b.n) === group).length;

  // Which balls the player at `turn` must hit first.
  function targets(s, turn = s.turn) {
    const group = s.groups[turn];
    const live = s.balls.filter((b) => !b.down && b.n !== 0);
    if (!group) return live.filter((b) => b.n !== 8);
    const mine = live.filter((b) => groupOf(b.n) === group);
    return mine.length ? mine : live.filter((b) => b.n === 8);
  }

  function shoot(s, angle, power) {
    if (s.moving || s.winner !== null || s.inHand) return false;
    const speed = Math.max(40, Math.min(MAX_POWER, power));
    const c = cue(s);
    c.vx = Math.cos(angle) * speed;
    c.vy = Math.sin(angle) * speed;
    s.moving = true;
    s.foul = '';
    s.shot = { firstHit: null, potted: [] };
    return true;
  }

  function validSpot(s, x, y) {
    if (x < R || y < R || x > W - R || y > H - R) return false;
    if (POCKETS.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + R)) return false;
    return s.balls.every((b) => b.n === 0 || b.down || Math.hypot(b.x - x, b.y - y) >= 2 * R + 0.5);
  }

  function placeCue(s, x, y) {
    if (!s.inHand || !validSpot(s, x, y)) return false;
    const c = cue(s);
    c.x = x;
    c.y = y;
    c.down = false;
    c.vx = 0;
    c.vy = 0;
    s.inHand = false;
    return true;
  }

  // The first ball a straight shot would meet, for the aiming guide.
  function firstContact(s, angle) {
    const c = cue(s);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let best = null;
    for (const b of s.balls) {
      if (b.n === 0 || b.down) continue;
      const along = (b.x - c.x) * dx + (b.y - c.y) * dy;
      if (along <= 0) continue;
      const off = Math.abs((b.x - c.x) * dy - (b.y - c.y) * dx);
      if (off > 2 * R) continue;
      const dist = along - Math.sqrt(4 * R * R - off * off);
      if (!best || dist < best.dist) best = { ball: b, dist, x: c.x + dx * dist, y: c.y + dy * dist };
    }
    return best;
  }

  function collide(s, a, b, events) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= 2 * R || dist === 0) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = 2 * R - dist;
    a.x -= (nx * overlap) / 2;
    a.y -= (ny * overlap) / 2;
    b.x += (nx * overlap) / 2;
    b.y += (ny * overlap) / 2;
    const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (closing <= 0) return;
    const impulse = (closing * (1 + RESTITUTION)) / 2;
    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;
    if (s.shot && s.shot.firstHit === null && (a.n === 0 || b.n === 0)) s.shot.firstHit = a.n === 0 ? b.n : a.n;
    events.add('click');
  }

  // Advances the balls by dt. Returns a set of sound events, plus 'stopped' when the shot is over.
  function step(s, dt) {
    const events = new Set();
    if (!s.moving) return events;
    const live = s.balls.filter((b) => !b.down);
    const fastest = Math.max(...live.map((b) => Math.hypot(b.vx, b.vy)));
    const steps = Math.max(1, Math.ceil((fastest * dt) / (R * 0.5)));
    const h = dt / steps;
    for (let n = 0; n < steps; n++) {
      for (const b of live) {
        if (b.down) continue;
        b.x += b.vx * h;
        b.y += b.vy * h;
        if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * CUSHION; events.add('rail'); }
        if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx) * CUSHION; events.add('rail'); }
        if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * CUSHION; events.add('rail'); }
        if (b.y > H - R) { b.y = H - R; b.vy = -Math.abs(b.vy) * CUSHION; events.add('rail'); }
      }
      for (let i = 0; i < live.length; i++) {
        if (live[i].down) continue;
        for (let j = i + 1; j < live.length; j++) {
          if (!live[j].down) collide(s, live[i], live[j], events);
        }
      }
      for (const b of live) {
        if (b.down) continue;
        if (POCKETS.some((p) => Math.hypot(p.x - b.x, p.y - b.y) < p.r)) {
          b.down = true;
          b.vx = 0;
          b.vy = 0;
          if (s.shot) s.shot.potted.push(b.n);
          events.add('pot');
        }
      }
    }
    let still = true;
    for (const b of live) {
      if (b.down) continue;
      const speed = Math.hypot(b.vx, b.vy);
      const slowed = Math.max(0, speed - FRICTION * dt);
      if (slowed < STOP) {
        b.vx = 0;
        b.vy = 0;
      } else {
        b.vx *= slowed / speed;
        b.vy *= slowed / speed;
        still = false;
      }
    }
    if (still) {
      s.moving = false;
      settle(s);
      events.add('stopped');
    }
    return events;
  }

  // Applies the rules once everything has stopped.
  function settle(s) {
    const shot = s.shot;
    const me = s.turn;
    const other = 1 - me;
    const scratch = shot.potted.includes(0);
    let foul = '';
    if (scratch) foul = 'The cue ball went down.';
    else if (shot.firstHit === null) foul = 'Nothing was hit.';
    else if (!legalFirstHit(s, me, shot)) foul = `Hit the ${shot.firstHit === 8 ? '8' : shot.firstHit <= 7 ? 'solid' : 'striped'} ball first.`;

    if (shot.potted.includes(8)) {
      const group = s.groups[me];
      const clearedBefore = group !== null
        && s.balls.filter((b) => groupOf(b.n) === group && !b.down).length === 0
        && !shot.potted.some((n) => groupOf(n) === group);
      if (clearedBefore && !foul) {
        s.winner = me;
        s.reason = 'Sank the 8 ball.';
      } else {
        s.winner = other;
        s.reason = foul ? 'The 8 ball went down on a foul.' : 'The 8 ball went down too early.';
      }
      finishShot(s);
      return;
    }

    const ownPotted = shot.potted.filter((n) => n !== 0 && n !== 8);
    if (!s.groups[me] && !s.isBreak && !foul && ownPotted.length) {
      s.groups[me] = groupOf(ownPotted[0]);
      s.groups[other] = s.groups[me] === 'solid' ? 'stripe' : 'solid';
    }
    const continues = !foul && ownPotted.some((n) => s.groups[me] === null || groupOf(n) === s.groups[me]);
    s.foul = foul;
    if (foul) {
      s.turn = other;
      s.inHand = true;
      if (scratch) cue(s).down = true;
    } else if (!continues) {
      s.turn = other;
    }
    finishShot(s);
  }

  function legalFirstHit(s, me, shot) {
    const group = s.groups[me];
    const n = shot.firstHit;
    if (group === null) return n !== 8;
    // Balls potted by this very shot still count as being on the table when it began.
    const stillOwn = s.balls.some((b) => groupOf(b.n) === group && (!b.down || shot.potted.includes(b.n)));
    return stillOwn ? groupOf(n) === group : n === 8;
  }

  function finishShot(s) {
    s.isBreak = false;
    s.shot = null;
  }

  // --- Computer player ---
  const AIM_ERROR = { easy: 0.05, medium: 0.018, hard: 0.005 };

  function pathClear(s, x1, y1, x2, y2, skip) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len === 0) return true;
    const dx = (x2 - x1) / len;
    const dy = (y2 - y1) / len;
    return s.balls.every((b) => {
      if (b.down || skip.includes(b.n)) return true;
      const along = (b.x - x1) * dx + (b.y - y1) * dy;
      if (along < -R || along > len + R) return true;
      return Math.abs((b.x - x1) * dy - (b.y - y1) * dx) > 2 * R + 1;
    });
  }

  // The best straight pot from where the cue ball is, or null.
  function bestPot(s, cx, cy) {
    let best = null;
    for (const t of targets(s)) {
      for (const p of POCKETS) {
        const toPocket = Math.hypot(p.x - t.x, p.y - t.y);
        const ux = (p.x - t.x) / toPocket;
        const uy = (p.y - t.y) / toPocket;
        const gx = t.x - ux * 2 * R;
        const gy = t.y - uy * 2 * R;
        const toGhost = Math.hypot(gx - cx, gy - cy);
        if (toGhost === 0) continue;
        const cut = ((gx - cx) * ux + (gy - cy) * uy) / toGhost;
        if (cut < 0.25) continue;
        if (!pathClear(s, cx, cy, gx, gy, [0, t.n]) || !pathClear(s, t.x, t.y, p.x, p.y, [0, t.n])) continue;
        const score = cut * 900 - toGhost * 0.3 - toPocket * 0.4;
        if (!best || score > best.score) best = { score, angle: Math.atan2(gy - cy, gx - cx), distance: toGhost + toPocket / Math.max(cut, 0.3) };
      }
    }
    return best;
  }

  function chooseSpot(s) {
    let best = { x: W * 0.25, y: H / 2, score: -Infinity };
    for (let x = 60; x < W; x += 70) {
      for (let y = 45; y < H; y += 60) {
        if (!validSpot(s, x, y)) continue;
        const pot = bestPot(s, x, y);
        const score = pot ? pot.score : -1000;
        if (score > best.score) best = { x, y, score };
      }
    }
    return best;
  }

  // Returns { angle, power } for whoever is to move.
  function chooseShot(s, rng = s.rng) {
    const c = cue(s);
    const error = AIM_ERROR[s.level] || AIM_ERROR.medium;
    const noise = () => (rng() - 0.5) * 2 * error;
    if (s.isBreak) return { angle: (rng() - 0.5) * 0.06, power: MAX_POWER };
    const pot = bestPot(s, c.x, c.y);
    if (pot) return { angle: pot.angle + noise(), power: Math.min(MAX_POWER, 300 + pot.distance * 1.1) };
    // No clean pot: play the nearest legal ball that can be reached, softly enough to stay safe.
    let target = null;
    for (const t of targets(s)) {
      const d = Math.hypot(t.x - c.x, t.y - c.y);
      const clear = pathClear(s, c.x, c.y, t.x, t.y, [0, t.n]);
      const score = (clear ? 2000 : 0) - d;
      if (!target || score > target.score) target = { score, t, d };
    }
    return { angle: Math.atan2(target.t.y - c.y, target.t.x - c.x) + noise(), power: Math.min(MAX_POWER, 450 + target.d * 1.2) };
  }

  return { W, H, R, MAX_POWER, POCKETS, groupOf, create, cue, remaining, targets, shoot, step, validSpot, placeCue, firstContact, chooseShot, chooseSpot };
})();
if (typeof module !== 'undefined') module.exports = PoolLogic;
