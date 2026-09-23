const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),vm=require('node:vm');
/* sonido.js importa el chip y el cancionero; en la prueba se cargan antes como
   guiones (dejan `Chip` y `Temas` en el global) y se quitan los `import`. */
function carga(extra={}){
 const pistas=[],events={},intervalos=[];
 class Audio{constructor(src){this.src=src;this.paused=true;pistas.push(this)}play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}}
 const document={hidden:false,addEventListener:(k,v)=>events[k]=v};
 const c={Audio,document,window:Object.assign({addEventListener:(k,v)=>events[k]=v},extra.window||{}),localStorage:{getItem:()=>null,setItem:()=>{}},
  setInterval:f=>{intervalos.push(f);return intervalos.length},clearInterval(i){if(i)intervalos[i-1]=null},Math,Object,Array,Number,Set,WeakMap,Float32Array,String,JSON};
 vm.createContext(c);
 for(const f of ['../juegos/audio/chip.js','../juegos/audio/temas.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
 vm.runInContext(fs.readFileSync('src/juegos/sonido.js','utf8').replace(/^import .*$/gm,'').replace(/\bexport\s+/g,''),c);
 return {c,pistas,events,document,intervalos};
}
test('Midnight Pulse: bucle exclusivo, volumen, silencio y pausa al salir',()=>{
 const {c,pistas,events,document}=carga();
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

/* Un AudioContext de mentira que cuenta osciladores y los que siguen vivos. */
function falsoAudio(){
 const st={osc:0,vivos:new Set(),t:0};
 const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
 const nodo=()=>({connect(x){return x},disconnect(){}});
 class AC{constructor(){this.state='running';this.sampleRate=8000;this.destination=nodo()}
  get currentTime(){return st.t}resume(){return Promise.resolve()}
  createGain(){return Object.assign(nodo(),{gain:param()})}
  createOscillator(){st.osc++;const o=Object.assign(nodo(),{frequency:param(),type:'',start(){st.vivos.add(o)},stop(x){o.fin=x},disconnect(){st.vivos.delete(o)}});return o}}
 return {AC,st};
}
test('los temas del chip: uno por juego, se agendan por delante y callan al cambiar',()=>{
 const {AC,st}=falsoAudio();
 const {c,intervalos,events,document}=carga({window:{AudioContext:AC}});
 for(const j of ['orbita','cartas','cuadritos','reversi','minas','snake'])assert.ok(c.Temas.temas[j],j);
 c.activarAudio();c.ambientar('cuadritos');
 const antes=st.osc;assert.ok(antes>0,'suena algo al entrar');
 const vivo=intervalos.filter(Boolean);assert.equal(vivo.length,1,'un solo temporizador');
 for(let i=0;i<40;i++){st.t+=.05;vivo[0]()}
 assert.ok(st.osc>antes+10,'sigue tocando');
 const viejos=[...st.vivos].filter(o=>o.fin>st.t);assert.ok(viejos.length>0);
 c.ambientar('reversi');assert.ok(viejos.every(o=>!st.vivos.has(o)),'cambiar de juego calla lo agendado');
 assert.equal(intervalos.filter(Boolean).length,1);
 document.hidden=true;events.visibilitychange();assert.equal(intervalos.filter(Boolean).length,0,'oculta: sin temporizador');
 /* Volver tras un minuto no toca de golpe todo lo que se perdió. */
 st.t+=60;document.hidden=false;const n0=st.osc;events.visibilitychange();
 assert.ok(st.osc-n0<30,'no se pone al día: '+(st.osc-n0));
 c.ajustarMusica({tempo:1.1,capas:{bat:0}});
 c.configurarMusica(false);assert.equal(intervalos.filter(Boolean).length,0);
});
test('los efectos no lanzan nunca y respetan el silencio',()=>{
 const {AC,st}=falsoAudio();
 const {c}=carga({window:{AudioContext:AC}});
 for(const n of ['clic','carta','ficha','entra','gana','pierde','empate','golpe','victoria','derrota','noexiste'])c.suena(n);
 assert.ok(st.osc>20);
 c.silenciar(true);const n=st.osc;c.suena('victoria');assert.equal(st.osc,n);
});
