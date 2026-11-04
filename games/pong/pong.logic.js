// Paddle duel rules. Units are pixels and seconds on a fixed 1000 x 600 court.
const PongLogic = (() => {
  const W = 1000;
  const H = 600;
  const PADDLE_H = 100;
  const PADDLE_W = 12;
  const INSET = 20;
  const R = 9;
  const SERVE_DELAY = 1;
  const MAX_ANGLE = Math.PI / 3;
  const AI_SPEED = 330;
  const SPEEDS = { slow: 340, normal: 450, fast: 580 };

  const clampPaddle = (y) => Math.max(0, Math.min(H - PADDLE_H, y));

  function create({ target = 7, speed = 'normal', rng = Math.random } = {}) {
    return {
      target, rng,
      baseSpeed: SPEEDS[speed],
      ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
      left: H / 2 - PADDLE_H / 2,
      right: H / 2 - PADDLE_H / 2,
      score: { left: 0, right: 0 },
      serveIn: SERVE_DELAY,
      serveDir: 1,
      aiError: 0,
      winner: null,
    };
  }

  function launch(s) {
    const angle = (s.rng() - 0.5) * (Math.PI / 3);
    s.ball.vx = Math.cos(angle) * s.baseSpeed * s.serveDir;
    s.ball.vy = Math.sin(angle) * s.baseSpeed;
    rollAiError(s);
  }

  // The AI misjudges every shot by a fresh amount. It is what makes it beatable: with perfect
  // aim and a paddle faster than the ball it could never concede.
  function rollAiError(s) {
    s.aiError = (s.rng() - 0.5) * PADDLE_H * 1.5;
  }

  function reflect(s, paddleY, dir) {
    const speed = Math.min(Math.hypot(s.ball.vx, s.ball.vy) * 1.05, s.baseSpeed * 2.2);
    const offset = (s.ball.y - (paddleY + PADDLE_H / 2)) / (PADDLE_H / 2 + R);
    const angle = Math.max(-1, Math.min(1, offset)) * MAX_ANGLE;
    s.ball.vx = Math.cos(angle) * speed * dir;
    s.ball.vy = Math.sin(angle) * speed;
  }

  // Where the ball will cross x, folding its path at the top and bottom walls.
  function predictY(ball, x) {
    if (ball.vx === 0) return H / 2;
    const span = H - 2 * R;
    const t = (x - ball.x) / ball.vx;
    const raw = ball.y - R + ball.vy * t;
    const folded = ((raw % (2 * span)) + 2 * span) % (2 * span);
    return R + (folded > span ? 2 * span - folded : folded);
  }

  // Advances by dt. `playerMove` is -1, 0 or 1 for keyboard play. Returns 'bounce', 'hit',
  // 'point' or null.
  function step(s, dt, playerMove = 0) {
    if (s.winner) return null;
    s.left = clampPaddle(s.left + playerMove * 620 * dt);

    const face = W - INSET - PADDLE_W;
    const aiTarget = s.ball.vx > 0 ? predictY(s.ball, face) + s.aiError : H / 2;
    const gap = aiTarget - (s.right + PADDLE_H / 2);
    s.right = clampPaddle(s.right + Math.sign(gap) * Math.min(Math.abs(gap), AI_SPEED * dt));

    if (s.serveIn > 0) {
      s.serveIn -= dt;
      if (s.serveIn <= 0) { s.serveIn = 0; launch(s); }
      return null;
    }

    const b = s.ball;
    const prevX = b.x;
    const prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let event = null;
    if (b.y < R) { b.y = 2 * R - b.y; b.vy = Math.abs(b.vy); event = 'bounce'; }
    if (b.y > H - R) { b.y = 2 * (H - R) - b.y; b.vy = -Math.abs(b.vy); event = 'bounce'; }

    // Test the moment the ball crosses a paddle's face, so a fast ball cannot pass through it
    // and one that has been returned cannot be flipped back by a second overlap test.
    const leftFace = INSET + PADDLE_W;
    if (b.vx < 0 && prevX - R >= leftFace && b.x - R < leftFace) {
      const t = (prevX - R - leftFace) / (prevX - b.x);
      const y = prevY + (b.y - prevY) * t;
      if (y > s.left - R && y < s.left + PADDLE_H + R) {
        b.x = leftFace + R;
        reflect(s, s.left, 1);
        rollAiError(s);
        return 'hit';
      }
    }
    if (b.vx > 0 && prevX + R <= face && b.x + R > face) {
      const t = (face - prevX - R) / (b.x - prevX);
      const y = prevY + (b.y - prevY) * t;
      if (y > s.right - R && y < s.right + PADDLE_H + R) {
        b.x = face - R;
        reflect(s, s.right, -1);
        return 'hit';
      }
    }

    if (b.x < -R || b.x > W + R) {
      const side = b.x < 0 ? 'right' : 'left';
      s.score[side]++;
      if (s.score[side] >= s.target) s.winner = side;
      s.serveDir = side === 'left' ? -1 : 1;
      s.serveIn = SERVE_DELAY;
      s.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
      return 'point';
    }
    return event;
  }

  return { W, H, PADDLE_H, PADDLE_W, INSET, R, create, step, clampPaddle };
})();
if (typeof module !== 'undefined') module.exports = PongLogic;
