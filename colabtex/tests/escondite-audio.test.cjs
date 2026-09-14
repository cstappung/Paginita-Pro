const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),vm=require('node:vm');
test('Midnight Pulse: bucle exclusivo, volumen, silencio y pausa al salir',()=>{
 const pistas=[],events={};
 class Audio{constructor(src){this.src=src;this.paused=true;pistas.push(this)}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}}
 const document={hidden:false,addEventListener:(k,v)=>events[k]=v};
 const c={Audio,document,window:{addEventListener:(k,v)=>events[k]=v},localStorage:{getItem:()=>null,setItem:()=>{}},setInterval:()=>1,clearInterval(){}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('src/juegos/sonido.js','utf8').replace(/\bexport\s+/g,''),c);
 c.ambientar('escondite');assert.equal(pistas.length,0);
 c.activarAudio();assert.equal(pistas.length,1);const p=pistas[0];assert.match(p.src,/midnight-pulse/);assert.equal(p.loop,true);assert.equal(p.paused,false);
 c.configurarMusica(true,.7);assert.equal(p.volume,.7);
 document.hidden=true;events.visibilitychange();assert.equal(p.paused,true);
 document.hidden=false;events.visibilitychange();assert.equal(p.paused,false);
 c.configurarMusica(false);assert.equal(p.paused,true);
 c.configurarMusica(true);c.ambientar('orbita');assert.equal(p.paused,true);
 c.ambientar('escondite');assert.equal(pistas.length,1);assert.equal(p.paused,false);
 c.ambientar('');assert.equal(p.paused,true);
});
