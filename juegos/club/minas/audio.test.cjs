const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* La banda sonora de Mina Club con el chip de la sala: se cargan chip.js y
   temas.js en el mismo contexto, como en la página, con un AudioContext de
   mentira que apunta cuándo empieza y cuándo se para cada fuente. */
function audio() {
  const intervals = new Map(), nodes = []; let id = 0;
  const param = () => ({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(v){this.value=v;}});
  const fuente = extra => { const node = Object.assign({frequency:param(),playbackRate:param(),connect(){},disconnect(){this.disconnected=true;},start(t){this.startAt=t;},stop(t){this.stopAt=t ?? 0;}}, extra); nodes.push(node); return node; };
  class AudioContext {
    currentTime=0; state='running'; sampleRate=8000; destination={};
    createGain(){return {gain:param(),connect(){},disconnect(){}};}
    createOscillator(){return fuente();}
    createBufferSource(){return fuente({loop:false});}
    createBuffer(n,largo){const d=Array.from({length:n},()=>new Float32Array(largo));return {getChannelData:i=>d[i]};}
    resume(){this.state='running';return Promise.resolve();}
  }
  const element = {setAttribute(){},classList:{toggle(){}},textContent:''};
  const sb = {AudioContext,document:{getElementById:()=>element},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){}},setInterval:fn=>{intervals.set(++id,fn);return id;},clearInterval:id=>intervals.delete(id),Math,Float32Array,WeakMap,Set,Object,Array};
  sb.window = sb; sb.globalThis = sb;
  const context = vm.createContext(sb);
  for (const f of ['audio/chip.js','audio/temas.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../..',f),'utf8'),context,{filename:f});
  const source=fs.readFileSync(__dirname+'/game.js','utf8').split('  const soundtrack = new Soundtrack();')[0];
  vm.runInContext(source+'window.soundtrack = new Soundtrack();})();',context);
  return {soundtrack:sb.soundtrack,intervals,nodes,sb};
}

test('repetir inicio mantiene un único secuenciador; parar cancela incluso notas futuras',()=>{
  const {soundtrack:s,intervals,nodes}=audio();s.start();s.start();assert.equal(intervals.size,1);
  s.context.currentTime=.3;s.schedule();
  assert.ok(nodes.length>0,'el tema suena');
  s.effect('flag');s.stop();assert.equal(intervals.size,0);
  assert.equal(s.voices.size,0);assert.equal(s.player.voces.size,0);
  assert.ok(nodes.every(n=>n.stopAt===0&&n.disconnected));
  s.start();assert.equal(intervals.size,1);
});
test('el tema crece con el tablero: arpegio, batería y tempo',()=>{
  const {soundtrack:s,sb}=audio();s.start();
  s.progress=.1;s.schedule();
  assert.equal(s.player.cancion,sb.Temas.temas.minas);
  assert.equal(s.player.capas.arp,0);assert.equal(s.player.capas.bat,0);assert.equal(s.player.tempo,1+.1*.08);
  s.progress=.5;s.schedule();assert.equal(s.player.capas.arp,1);assert.equal(s.player.capas.bat,0);
  s.progress=.8;s.schedule();assert.equal(s.player.capas.arp,1);assert.equal(s.player.capas.bat,1);assert.ok(s.player.tempo>1);
  s.progress=3;s.schedule();assert.ok(s.player.tempo<=1.08+1e-9);
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
