/* Shared, deterministic collision routines; also runnable in Node for checks. */
(function (root) {
  'use strict';
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  function hitRect(ball, rect, radius) {
    const closestX = clamp(ball.x, rect.x, rect.x + rect.w);
    const closestY = clamp(ball.y, rect.y, rect.y + rect.h);
    let nx = ball.x - closestX, ny = ball.y - closestY;
    const distance = Math.hypot(nx, ny);
    if (distance >= radius) return false;
    let depth;
    if (distance > 0.00001) { nx /= distance; ny /= distance; depth = radius - distance; }
    else {
      const faces = [
        { d: ball.x - rect.x, x: -1, y: 0 },
        { d: rect.x + rect.w - ball.x, x: 1, y: 0 },
        { d: ball.y - rect.y, x: 0, y: -1 },
        { d: rect.y + rect.h - ball.y, x: 0, y: 1 }
      ].sort((a, b) => a.d - b.d);
      nx = faces[0].x; ny = faces[0].y; depth = radius + faces[0].d;
    }
    ball.x += nx * (depth + 0.01); ball.y += ny * (depth + 0.01);
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot >= 0) return false;
    ball.vx -= 2 * dot * nx; ball.vy -= 2 * dot * ny;
    return true;
  }
  function contain(ball, bounds) {
    if (ball.x < bounds.radius) { ball.x = bounds.radius; ball.vx = Math.abs(ball.vx); }
    if (ball.x > bounds.width - bounds.radius) { ball.x = bounds.width - bounds.radius; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < bounds.radius) { ball.y = bounds.radius; ball.vy = Math.abs(ball.vy); }
  }
  function stepBall(ball, dt, blocks, bounds, onHit = () => {}, onMove = () => {}) {
    const steps = Math.max(1, Math.ceil(Math.hypot(ball.vx, ball.vy) * dt / (bounds.radius * 0.7)));
    const delta = dt / steps;
    for (let i = 0; i < steps; i++) {
      ball.x += ball.vx * delta; ball.y += ball.vy * delta;
      contain(ball, bounds);
      for (const block of blocks) {
        if (block.hp > 0 && hitRect(ball, block, bounds.radius)) onHit(block);
      }
      // A corner correction must never push the ball through a side wall.
      contain(ball, bounds);
      onMove(ball);
      if (ball.y >= bounds.floor && ball.vy > 0) {
        ball.y = bounds.floor;
        return true;
      }
      // Keep corner reflections from creating indefinitely horizontal shots.
      if (Math.abs(ball.vy) < 55) {
        const speed = Math.hypot(ball.vx, ball.vy);
        ball.vy = (ball.vy < 0 ? -1 : 1) * 55;
        ball.vx = (ball.vx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, speed * speed - 55 * 55));
      }
    }
    return false;
  }
  const api = { clamp, hitRect, stepBall };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BBTANPhysics = api;
})(globalThis);
