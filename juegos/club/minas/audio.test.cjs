const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function audio() {
  const intervals = new Map(), nodes = []; let id = 0;
  const param = () => ({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(v){this.value=v;}});
  class AudioContext {
    currentTime=0; state='running'; destination={};
    createGain(){return {gain:param(),connect(){},disconnect(){}};}
    createOscillator(){const node={frequency:param(),connect(){},disconnect(){this.disconnected=true;},start(t){this.startAt=t;},stop(t){this.stopAt=t ?? 0;}};nodes.push(node);return node;}
    resume(){this.state='running';return Promise.resolve();}
  }
  const element = {setAttribute(){},classList:{toggle(){}}};
  const context = vm.createContext({window:{AudioContext},document:{getElementById:()=>element},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){}},setInterval:fn=>{intervals.set(++id,fn);return id;},clearInterval:id=>intervals.delete(id)});
  const source=fs.readFileSync(__dirname+'/game.js','utf8').split('  const soundtrack = new Soundtrack();')[0];
  vm.runInContext(source+'window.soundtrack = new Soundtrack();})();',context);
  return {soundtrack:context.window.soundtrack,intervals,nodes};
}

test('repetir inicio mantiene un único secuenciador; parar cancela incluso notas futuras',()=>{
  const {soundtrack:s,intervals,nodes}=audio();s.start();s.start();assert.equal(intervals.size,1);
  s.context.currentTime=.3;s.schedule();s.stop();assert.equal(intervals.size,0);
  assert.equal(s.voices.size,0);assert.ok(nodes.every(n=>n.stopAt===0&&n.disconnected));
  s.start();assert.equal(intervals.size,1);
});
test('la melodía no se duplica ni se solapa al aumentar el progreso',()=>{
  const {soundtrack:s,nodes}=audio();s.start();
  for(let i=1;i<240;i++){s.context.currentTime=i*.05;s.progress=i/240;s.schedule();}
  const melody=nodes.filter(n=>n.type==='sine');
  assert.ok(melody.length>30);
  for(let i=1;i<melody.length;i++)assert.ok(melody[i].startAt>=melody[i-1].stopAt);
});
test('clics rápidos no apilan arpegios; derrota sustituye el fondo y se cancela al reiniciar',()=>{
  const {soundtrack:s,intervals,nodes}=audio();s.start();let before=nodes.length;
  for(let i=0;i<20;i++)s.effect('open',20);
  assert.equal(nodes.length-before,1);
  const old=[...nodes];s.effect('lose');assert.equal(intervals.size,0);
  assert.ok(old.every(n=>n.disconnected));
  const finale=nodes.slice(old.length);assert.ok(finale.some(n=>n.startAt>=3.2));
  assert.ok(finale.every(n=>n.stopAt<4.6));
  s.start();assert.ok(finale.every(n=>n.stopAt===0&&n.disconnected));
});
test('silencio y volumen también controlan la derrota',()=>{
  const {soundtrack:s,nodes}=audio();s.enabled=false;s.start();s.effect('lose');assert.equal(nodes.length,0);
  s.enabled=true;s.start();s.setVolume(0);assert.equal(s.master.gain.value,0);
  s.enabled=false;s.stop();const count=nodes.length;s.effect('lose');assert.equal(nodes.length,count);
});
