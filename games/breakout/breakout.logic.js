// Brick wall rules on a fixed 800 x 600 field. Units are pixels and seconds.
const BreakoutLogic = (() => {
  const W = 800;
  const H = 600;
  const COLS = 9;
  const ROWS = 5;
  const BRICK_W = 76;
  const BRICK_H = 22;
  const GAP = 8;
  const LEFT = (W - (COLS * BRICK_W + (COLS - 1) * GAP)) / 2;
  const TOP = 60;
  const PADDLE_W = 110;
  const PADDLE_H = 14;
  const PADDLE_Y = H - 40;
  const R = 9;
  const START_LIVES = 3;
  const SPEEDS = { slow: 300, normal: 400, fast: 520 };
  const MAX_SPEED = 780;
  const MAX_BOUNCE = (62 * Math.PI) / 180;

  function create({ speed = 'normal', rng = Math.random } = {}) {
    const bricks = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        bricks.push({ x: LEFT + col * (BRICK_W + GAP), y: TOP + row * (BRICK_H + GAP), row, alive: true });
      }
    }
    return {
      rng, bricks,
      baseSpeed: SPEEDS[speed],
      speed: SPEEDS[speed],
      ball: { x: W / 2, y: PADDLE_Y - R, vx: 0, vy: 0 },
      paddle: W / 2,
      held: true,
      score: 0,
      lives: START_LIVES,
      remaining: bricks.length,
      over: false,
      won: false,
    };
  }

  const setPaddle = (s, x) => {
    s.paddle = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, x));
  };

  function launch(s) {
    if (!s.held || s.over) return;
    const angle = (s.rng() < 0.5 ? -1 : 1) * (0.25 + s.rng() * 0.35);
    s.ball.vx = Math.sin(angle) * s.speed;
    s.ball.vy = -Math.cos(angle) * s.speed;
    s.held = false;
  }

  // Keeps the ball from settling into a nearly flat path that would take minutes to come back.
  function keepSteep(s) {
    const b = s.ball;
    const speed = Math.hypot(b.vx, b.vy);
    const minVy = speed * 0.28;
    if (Math.abs(b.vy) < minVy) {
      b.vy = (b.vy < 0 ? -1 : 1) * minVy;
      b.vx = Math.sign(b.vx || 1) * Math.sqrt(speed * speed - minVy * minVy);
    }
  }

  function hitBrick(s) {
    const b = s.ball;
    for (const brick of s.bricks) {
      if (!brick.alive) continue;
      const nearX = Math.max(brick.x, Math.min(b.x, brick.x + BRICK_W));
      const nearY = Math.max(brick.y, Math.min(b.y, brick.y + BRICK_H));
      if ((b.x - nearX) ** 2 + (b.y - nearY) ** 2 > R * R) continue;

      // Push out along whichever axis overlaps least, so side hits bounce sideways.
      const dx = b.x - (brick.x + BRICK_W / 2);
      const dy = b.y - (brick.y + BRICK_H / 2);
      const overlapX = BRICK_W / 2 + R - Math.abs(dx);
      const overlapY = BRICK_H / 2 + R - Math.abs(dy);
      if (overlapX < overlapY) {
        b.x += Math.sign(dx) * overlapX;
        b.vx = Math.sign(dx) * Math.abs(b.vx);
      } else {
        b.y += Math.sign(dy) * overlapY;
        b.vy = Math.sign(dy) * Math.abs(b.vy);
      }
      brick.alive = false;
      s.remaining--;
      s.score += 10 * (ROWS - brick.row);
      s.speed = Math.min(MAX_SPEED, s.speed + 5);
      const scale = s.speed / Math.hypot(b.vx, b.vy);
      b.vx *= scale;
      b.vy *= scale;
      keepSteep(s);
      return true;
    }
    return false;
  }

  // Advances by dt. Returns 'bounce', 'paddle', 'brick', 'miss', 'lost', 'cleared' or null.
  function step(s, dt, paddleMove = 0) {
    if (s.over) return null;
    if (paddleMove) setPaddle(s, s.paddle + paddleMove * 620 * dt);
    const b = s.ball;
    if (s.held) {
      b.x = s.paddle;
      b.y = PADDLE_Y - R;
      return null;
    }

    let event = null;
    // Small sub-steps: at top speed one frame is still under a ball radius of travel.
    const steps = Math.max(1, Math.ceil((s.speed * dt) / (R * 0.8)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      b.x += b.vx * h;
      b.y += b.vy * h;
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); event = 'bounce'; }
      if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); event = 'bounce'; }
      if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); event = 'bounce'; }

      if (b.vy > 0 && b.y + R >= PADDLE_Y && b.y < PADDLE_Y + PADDLE_H
        && Math.abs(b.x - s.paddle) <= PADDLE_W / 2 + R) {
        const offset = Math.max(-1, Math.min(1, (b.x - s.paddle) / (PADDLE_W / 2)));
        b.y = PADDLE_Y - R;
        b.vx = Math.sin(offset * MAX_BOUNCE) * s.speed;
        b.vy = -Math.cos(offset * MAX_BOUNCE) * s.speed;
        event = 'paddle';
      }

      if (hitBrick(s)) {
        event = 'brick';
        if (s.remaining === 0) {
          s.over = true;
          s.won = true;
          return 'cleared';
        }
      }

      if (b.y - R > H) {
        s.lives--;
        s.held = true;
        s.speed = s.baseSpeed;
        b.vx = 0;
        b.vy = 0;
        if (s.lives <= 0) {
          s.over = true;
          return 'lost';
        }
        return 'miss';
      }
    }
    return event;
  }

  return {
    W, H, BRICK_W, BRICK_H, PADDLE_W, PADDLE_H, PADDLE_Y, R, ROWS,
    create, setPaddle, launch, step,
  };
})();
if (typeof module !== 'undefined') module.exports = BreakoutLogic;
