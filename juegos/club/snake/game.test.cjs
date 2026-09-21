// Behavioral checks for the game engine; no browser or dependencies required.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');

function game() {
  const elements = new Map();
  const sent = [];
  const noop = () => {};
  const context = new Proxy({}, { get: (_, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop: noop }) : noop, set: () => true });
  const element = () => ({ textContent: '', innerHTML: '', style: { setProperty: noop }, classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, addEventListener: noop, focus: noop, getBoundingClientRect: () => ({ width: 784, height: 616 }), getContext: () => context });
  const storage = new Map();
  const sandbox = {
    document: { getElementById: id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, querySelectorAll: () => [], documentElement: element(), addEventListener: noop },
    window: { addEventListener: noop, Club: {storageKey:k=>k,category:noop,result:d=>sent.push(d)} }, matchMedia: () => ({ matches: true }),
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    ResizeObserver: class { observe() {} }, requestAnimationFrame: noop, devicePixelRatio: 1, setTimeout: noop, clearTimeout: noop,
  };
  vm.createContext(sandbox);
  const source = fs.readFileSync(__dirname + '/game.js', 'utf8').replace(/\}\)\(\);\s*$/, `
    globalThis.engine = {
      start, step, pause, enqueue, frame, freeCell, interval, syncSettings,
      setMode(value) { mode = value; start(); },
      patch(value) {
        if (value.snake) { snake = value.snake; previous = snake.map(copy); }
        if (value.direction) direction = DIRS[value.direction];
        if ('fruit' in value) fruit = value.fruit;
        if ('bonus' in value) bonus = value.bonus;
        if ('activePower' in value) activePower = value.activePower;
        if ('obstacles' in value) obstacles = value.obstacles;
        if ('pickup' in value) pickup = value.pickup;
      },
      get() { return { state, score, eaten, snake, direction, queue, fruit, bonus, pickup, obstacles, portals, activePower, records, gameTime }; }
    };
  })();`);
  vm.runInContext(source, sandbox);
  return Object.assign(sandbox.engine,{sent});
}

test('fruit adds points, grows the snake, persists record and respawns on a free cell', () => {
  const g = game(); g.start(); for (let i = 0; i < 10; i++) g.step();
  const s = g.get(); assert.equal(s.score, 10); assert.equal(s.snake.length, 6); assert.equal(s.records['classic-normal'], 10);
  assert.ok(!s.snake.some(p => p.x === s.fruit.x && p.y === s.fruit.y));
});
test('classic wall collision ends the game', () => {
  const g = game(); g.start(); for (let i = 0; i < 20; i++) g.step(); assert.equal(g.get().state, 'over');
});
test('input rejects reversals and buffers two legal turns', () => {
  const g = game(); g.start(); g.enqueue('left'); assert.equal(g.get().queue.length, 0);
  g.enqueue('up'); g.enqueue('left'); g.enqueue('down'); assert.equal(g.get().queue.length, 2);
  g.step(); assert.equal(g.get().snake[0].y, 10); g.step(); assert.equal(g.get().snake[0].x, 7);
});
test('moving into the departing tail cell is legal', () => {
  const g = game(); g.start(); g.patch({ snake: [{x:5,y:5},{x:5,y:6},{x:4,y:6},{x:4,y:5}], direction:'left' });
  g.step(); assert.equal(g.get().state, 'playing'); assert.equal(g.get().snake.length, 4);
});
test('body collision ends classic mode', () => {
  const g = game(); g.start(); g.patch({ snake: [{x:5,y:5},{x:5,y:6},{x:4,y:6},{x:4,y:5},{x:3,y:5}], direction:'left' });
  g.step(); assert.equal(g.get().state, 'over');
});
test('Zen wraps walls, survives self-collision and maintains its pace', () => {
  const g = game(); g.setMode('zen'); const initial = g.interval();
  g.patch({ snake: [{x:27,y:5},{x:26,y:5}], direction:'right' }); g.step(); assert.equal(g.get().snake[0].x, 0);
  g.patch({ snake: [{x:5,y:5},{x:5,y:6},{x:4,y:6},{x:4,y:5},{x:3,y:5}], direction:'left', fruit:{x:4,y:5} });
  g.step(); assert.equal(g.get().state, 'playing'); assert.equal(g.interval(), initial);
});
test('portals transport the head and wrapping remains legal', () => {
  const g = game(); g.setMode('portals'); g.patch({ snake: [{x:5,y:5},{x:4,y:5}], direction:'right' });
  g.step(); assert.equal(g.get().snake[0].x, 21); assert.equal(g.get().snake[0].y, 16);
  g.patch({ snake: [{x:27,y:5},{x:26,y:5}], direction:'right' }); g.step(); assert.equal(g.get().snake[0].x, 0);
});
test('a portal exit occupied by the body still causes a collision', () => {
  const g = game(); g.setMode('portals'); g.patch({ snake: [{x:5,y:5},{x:21,y:16},{x:22,y:16}], direction:'right' });
  g.step(); assert.equal(g.get().state, 'over');
});
test('shield absorbs one wall collision', () => {
  const g = game(); g.setMode('arcade'); g.patch({ snake: [{x:27,y:5},{x:26,y:5}], direction:'right', activePower:{type:'shield',expires:10} });
  g.step(); assert.equal(g.get().state, 'playing'); assert.equal(g.get().snake[0].x, 0); assert.equal(g.get().activePower, null);
});
test('shield removes an obstacle and is consumed', () => {
  const g = game(); g.setMode('arcade'); g.patch({ obstacles:[{x:9,y:11}], activePower:{type:'shield',expires:10} });
  g.step(); assert.equal(g.get().state, 'playing'); assert.equal(g.get().obstacles.length, 0); assert.equal(g.get().activePower, null);
});
test('double points applies to golden fruit', () => {
  const g = game(); g.setMode('arcade'); g.patch({ bonus:{x:9,y:11,expires:10}, activePower:{type:'double',expires:10} });
  g.step(); assert.equal(g.get().score, 100); assert.equal(g.get().bonus, null);
});
test('Arcade generates powers, golden fruit and obstacles at their milestones', () => {
  const g = game(); g.setMode('arcade');
  for (let i = 0; i < 6; i++) { const h = g.get().snake[0]; g.patch({ fruit:{x:h.x+1,y:h.y} }); g.step(); }
  const s = g.get(); assert.ok(s.pickup); assert.ok(s.bonus); assert.equal(s.obstacles.length, 1);
  assert.ok(!s.snake.some(p => p.x === s.obstacles[0].x && p.y === s.obstacles[0].y));
});
test('pause freezes simulated time and powers; resume continues', () => {
  const g = game(); g.start(); g.patch({ activePower:{type:'slow',expires:10} }); g.pause();
  g.frame(1000); g.frame(1050); assert.equal(g.get().gameTime, 0); assert.equal(g.get().activePower.type, 'slow');
  g.pause(); g.frame(1100); assert.ok(g.get().gameTime > 0);
});
test('filling the board completes the game instead of looping on fruit spawning', () => {
  const g = game(); g.start(); const body = [{x:0,y:0}];
  for (let y = 0; y < 22; y++) for (let x = 0; x < 28; x++) if (!(y === 0 && (x === 0 || x === 1))) body.push({x,y});
  g.patch({snake:body,direction:'right',fruit:{x:1,y:0}}); g.step(); assert.equal(g.get().state, 'over'); assert.equal(g.get().snake.length, 616);
});

test('completed Snake game sends its exact mode, score and time once',()=>{
 const g=game();g.start();for(let i=0;i<25;i++)g.step();
 assert.equal(g.sent.length,1);assert.equal(g.sent[0].categoria,'club-snake-classic-normal');assert.equal(g.sent[0].puntos,g.get().score);assert.ok(g.sent[0].tiempo>=1);
 const z=game();z.setMode('zen');for(let i=0;i<50;i++)z.step();assert.equal(z.sent.length,0);
});
