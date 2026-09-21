const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS } = require('./engine.js');
function random(seed) { return () => { seed = (Math.imul(1664525,seed)+1013904223)>>>0; return seed/4294967296; }; }
function fixed(mines) {
  const g = new Game(); g.cols=4;g.rows=4;g.mines=mines.length;
  g.cells=Array.from({length:16},(_,i)=>({mine:mines.includes(i),open:false,flag:false,count:0}));
  g.cells.forEach((c,i)=>{c.count=g.neighbors(i).filter(n=>g.cells[n].mine).length;});g.state='playing';return g;
}
test('all difficulties have exact mine counts, valid clues and a safe first neighborhood across 120 fields',()=>{
  for(const level of Object.keys(LEVELS))for(let seed=1;seed<=40;seed++){
    const g=new Game(level,random(seed));const first=(seed*17)%g.cells.length;g.open(first);
    assert.equal(g.cells.filter(c=>c.mine).length,g.mines);assert.equal(g.cells[first].count,0);assert.notEqual(g.state,'lost');
    for(const i of [first,...g.neighbors(first)])assert.equal(g.cells[i].mine,false);
    g.cells.forEach((c,i)=>assert.equal(c.count,g.neighbors(i).filter(n=>g.cells[n].mine).length));
    assert.equal(g.revealed,g.cells.filter(c=>c.open&&!c.mine).length);
  }
});
test('neighbors do not wrap across borders',()=>{
  const g=new Game();assert.deepEqual(g.neighbors(0),[1,10,11]);assert.deepEqual(g.neighbors(9),[8,18,19]);assert.equal(g.neighbors(44).length,8);
});
test('flood fill opens empty regions but never mines or flagged cells',()=>{
  const g=fixed([0]);g.flag(15);g.open(14);assert.equal(g.state,'playing');assert.equal(g.revealed,14);assert.equal(g.cells[0].open,false);assert.equal(g.cells[15].open,false);
  g.flag(15);g.open(15);assert.equal(g.state,'won');assert.equal(g.progress,1);
});
test('flag limit, toggling, safe pre-start flags and flagged click',()=>{
  const g=new Game('easy',random(1));g.flag(0);assert.deepEqual(g.open(0),[]);assert.equal(g.state,'ready');
  for(let i=1;i<10;i++)assert.equal(g.flag(i),true);assert.equal(g.flag(10),false);assert.equal(g.flags,10);
  g.flag(0);assert.equal(g.flags,9);g.open(0);assert.equal(g.cells[0].mine,false);assert.equal(g.cells[1].flag,true);assert.equal(g.flag(0),false);
});
test('correct chording opens adjacent safe cells; incomplete flags do nothing',()=>{
  const g=fixed([0,3]);g.open(1);assert.equal(g.cells[1].count,1);assert.deepEqual(g.open(1),[]);
  g.flag(0);const changed=g.open(1);assert.ok(changed.length>0);assert.notEqual(g.state,'lost');assert.equal(g.cells[0].open,false);
});
test('incorrect chording loses and terminal states reject further moves',()=>{
  const g=fixed([0,3]);g.open(1);g.flag(2);g.open(1);assert.equal(g.state,'lost');assert.equal(g.exploded,0);
  const snapshot=JSON.stringify(g.cells);assert.deepEqual(g.open(10),[]);assert.equal(g.flag(10),false);assert.equal(JSON.stringify(g.cells),snapshot);
});
test('a mine ends the game and does not count toward revealed safe cells',()=>{
  const g=fixed([0]);g.open(0);assert.equal(g.state,'lost');assert.equal(g.revealed,0);assert.equal(g.exploded,0);
});
test('all safe cells can be cleared to win every difficulty; marking all mines alone does not win',()=>{
  for(const level of Object.keys(LEVELS)){
    const g=new Game(level,random(42));g.open(0);
    g.cells.forEach((c,i)=>{if(c.mine)g.flag(i);});assert.equal(g.state,'playing');
    g.cells.forEach((c,i)=>{if(!c.mine)g.open(i);});assert.equal(g.state,'won');assert.equal(g.progress,1);assert.equal(g.flag(0),false);assert.deepEqual(g.open(0),[]);
  }
});
