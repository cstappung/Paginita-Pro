(function (root) {
  'use strict';
  // Collision cells touch each other and both walls. The inset is paint only.
  const grid = { width: 420, columns: 7, size: 60, top: 60 };
  const ballRadius = 6;
  function createRow(round, y = grid.top, random = Math.random) {
    const columns = Array.from({ length: grid.columns }, (_, i) => i);
    for (let i = columns.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [columns[i], columns[j]] = [columns[j], columns[i]];
    }
    const total = 3 + Math.floor(random() * 3);
    const blocks = columns.slice(0, total).map(col => {
      const reinforced = round > 1 && random() < .2;
      const hp = reinforced ? Math.ceil(round * 1.5) : round;
      return { x: col * grid.size, y, w: grid.size, h: grid.size,
        hp, max: hp, reinforced, flash: 0 };
    });
    const pickup = (col, kind) => ({
      x: col * grid.size + grid.size / 2, y: y + grid.size / 2, kind, alive: true
    });
    const pickups = [pickup(columns[total], 'ball')];
    if (round % 2 === 0) {
      const kind = ['laser-h', 'laser-v', 'scatter'][(round / 2 - 1) % 3];
      pickups.push(pickup(columns[total + 1], kind));
    }
    return { blocks, pickups };
  }
  function enterPickup(ball, pickup, radius = ballRadius) {
    // Track contact separately for each ball; re-arm only after it exits.
    ball.pickupContacts ||= new Set();
    const distance = Math.hypot(ball.x - pickup.x, ball.y - pickup.y);
    const reach = radius + 11;
    if (distance > reach + 2) ball.pickupContacts.delete(pickup);
    if (!pickup.alive || distance > reach || ball.pickupContacts.has(pickup)) return false;
    ball.pickupContacts.add(pickup);
    if (pickup.kind === 'ball') pickup.alive = false;
    return true;
  }
  function activatePowerup(ball, pickup, blocks, damage, random = Math.random) {
    if (pickup.kind === 'scatter') {
      pickup.used = true;
      const speed = Math.hypot(ball.vx, ball.vy);
      const angle = -Math.PI + .3 + random() * (Math.PI - .6);
      ball.vx = Math.cos(angle) * speed; ball.vy = Math.sin(angle) * speed;
    } else if (pickup.kind === 'laser-h' || pickup.kind === 'laser-v') {
      pickup.used = true;
      const horizontal = pickup.kind === 'laser-h';
      blocks.filter(b => b.hp > 0 && (horizontal
        ? pickup.y >= b.y && pickup.y < b.y + b.h
        : pickup.x >= b.x && pickup.x < b.x + b.w)).forEach(b => damage(b, 4));
    }
  }
  function keepPickupNextRound(pickup) {
    return pickup.alive && !(pickup.kind !== 'ball' && pickup.used);
  }
  function shotPace(seconds, manualFast = false) {
    const automatic = Math.min(4, 1 + Math.max(0, seconds - 5) * .32);
    return Math.max(manualFast ? 3 : 1, automatic);
  }
  function aimVisibility(round) {
    return Math.max(.08, 1 - .92 * Math.max(0, round - 100) / 150);
  }
  function hasClearedBoard(blocks, alreadyCelebrated = false) {
    return !alreadyCelebrated && blocks.length > 0 && blocks.every(block => block.hp <= 0);
  }
  const api = { grid, ballRadius, initialBalls: 1, createRow, enterPickup, activatePowerup, keepPickupNextRound, shotPace, aimVisibility, hasClearedBoard };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BBTANRules = api;
})(globalThis);
