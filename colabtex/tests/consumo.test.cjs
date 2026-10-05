/* El medidor de descarga (src/consumo.js): la suma por día entre
   pestañas y aparatos, las marcas para el antitrampas (una vez por día y
   tipo), el tope, el cambio de día, el WebSocket envuelto, y que las
   reglas ya no dejen bajar colecciones enteras. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),fs=require('fs'),path=require('path');
const codigo=esbuild.buildSync({entryPoints:['src/consumo.js'],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text;
const carga=()=>{const mod={exports:{}};new Function('module','exports','require',codigo)(mod,mod.exports,require);return mod.exports;};
const C=carga(),MB=C.MB;

function almacen(){
  const m=new Map();
  return {m,claves:()=>[...m.keys()],lee:k=>m.has(k)?m.get(k):null,pon:(k,v)=>m.set(k,String(v)),quita:k=>m.delete(k)};
}
/* Mediodía en Chile del 5 de octubre de 2026 (UTC−3). */
const T0=Date.UTC(2026,9,5,15,0,0);

test('Consumo: el día es el de Chile',()=>{
  assert.equal(C.diaChile(T0),'2026-10-05');
  assert.equal(C.diaChile(Date.UTC(2026,9,6,2,0,0)),'2026-10-05','las 23:00 en Chile siguen siendo el 5');
  assert.equal(C.diaChile(Date.UTC(2026,9,6,4,0,0)),'2026-10-06');
});

test('Consumo: cada pestaña cuenta una vez, con su número más alto',()=>{
  assert.equal(C.totalDe({a:10,b:5},{a:7,c:3}),18);
  assert.equal(C.totalDe({a:'x',b:-4},null),0);
  assert.equal(C.bytesDe('hola'),4);
  assert.equal(C.bytesDe(new ArrayBuffer(9)),9);
  assert.equal(C.bytesDe(null),0);
});

test('Consumo: marca una vez por día y tipo, y corta en el tope',()=>{
  let t=T0;const a=almacen(),marcas=[],topes=[];
  const m=C.crearMedidor({almacen:a,ahora:()=>t,pestaña:'p1',alMarca:(x,e)=>marcas.push([x,C.enMB(e.total)]),alTope:e=>topes.push(e.total)});
  m.cuenta(10*MB);t+=1000;m.tick();
  assert.deepEqual(marcas,[]);
  assert.equal(a.lee('fb.consumo.d.2026-10-05.p1'),String(10*MB),'queda en localStorage');
  /* Otra pestaña del mismo navegador ya bajó 35 MB: entre las dos pasan el aviso. */
  a.pon('fb.consumo.d.2026-10-05.p2',String(35*MB));
  t+=10*60000;m.tick();
  assert.deepEqual(marcas,[['dia',45]]);
  t+=10*60000;m.tick();
  assert.equal(marcas.length,1,'el aviso no se repite');
  /* Otro aparato de la cuenta: con eso se llega al tope. */
  m.ponCuenta({dia:'2026-10-05',t:{p1:3*MB,movil:40*MB}});
  t+=1000;const e=m.tick();
  assert.equal(e.total,85*MB);
  assert.deepEqual(marcas.map(x=>x[0]),['dia','tope']);
  assert.deepEqual(topes,[85*MB]);
  assert.equal(e.cortado,true);
  t+=1000;m.tick();
  assert.equal(topes.length,1,'se corta una sola vez');
  /* Una pestaña nueva el mismo día ya no marca de nuevo, pero también corta. */
  const topes2=[],marcas2=[];
  const m2=C.crearMedidor({almacen:a,ahora:()=>t,pestaña:'p3',alMarca:x=>marcas2.push(x),alTope:()=>topes2.push(1)});
  m2.ponCuenta({dia:'2026-10-05',t:{movil:40*MB}});
  m2.tick();
  assert.deepEqual(marcas2,[]);
  assert.equal(topes2.length,1);
});

test('Consumo: la ráfaga es de una pestaña dentro de la ventana',()=>{
  let t=T0;const marcas=[];
  const m=C.crearMedidor({almacen:almacen(),ahora:()=>t,pestaña:'p',alMarca:x=>marcas.push(x)});
  for(let i=0;i<4;i++){m.cuenta(3*MB);t+=2*60000;m.tick();}   // 12 MB repartidos en 8 min: no
  assert.deepEqual(marcas,[]);
  for(let i=0;i<6;i++){m.cuenta(3*MB);t+=20000;m.tick();}     // 18 MB en 2 min: sí
  assert.deepEqual(marcas,['rafaga']);
});

test('Consumo: a medianoche se empieza de cero y se borra lo de ayer',()=>{
  let t=T0;const a=almacen(),topes=[];
  const m=C.crearMedidor({almacen:a,ahora:()=>t,pestaña:'p',alTope:()=>topes.push(1)});
  m.cuenta(90*MB);m.tick();
  assert.equal(m.estado().cortado,true);
  m.ponCuenta({dia:'2026-10-05',t:{otro:5*MB}});
  t+=24*3600000;const e=m.tick();
  assert.equal(e.dia,'2026-10-06');
  assert.equal(e.total,0,'ni lo de ayer ni el mapa de la cuenta de ayer');
  assert.equal(e.cortado,false);
  assert.ok(!a.claves().some(k=>k.includes('2026-10-05')),'lo de ayer se borra');
  m.ponCuenta({dia:'2026-10-05',t:{otro:50*MB}});
  assert.equal(m.estado().total,0,'un mapa de otro día no cuenta');
});

test('Consumo: el WebSocket de la base se mide; los demás no',()=>{
  const C2=carga();
  class WS{constructor(url){this.url=url;this._h=null;}}
  Object.defineProperty(WS.prototype,'onmessage',{configurable:true,enumerable:true,get(){return this._h;},set(f){this._h=f;}});
  assert.equal(C2.instala(WS),true);
  assert.equal(C2.instala(WS),false,'una sola vez');
  let n=0;C2.alDescargar(b=>{n+=b;});
  const recibidos=[];
  const base=new WS('wss://s-usc1b-nss-2100.firebaseio.com/.ws?v=5&ns=mi-pagina-pro-default-rtdb');
  base.onmessage=ev=>recibidos.push(ev.data);
  base.onmessage({data:'{"t":"d","d":{}}'});
  const otro=new WS('wss://example.com/socket');
  otro.onmessage=()=>{};otro.onmessage({data:'x'.repeat(1000)});
  const nueva=new WS('wss://mi-pagina-pro-default-rtdb.firebasedatabase.app/.ws');
  nueva.onmessage=()=>{};nueva.onmessage({data:'abc'});
  assert.equal(n,'{"t":"d","d":{}}'.length+3);
  assert.deepEqual(recibidos,['{"t":"d","d":{}}'],'el mensaje sigue llegando al SDK');
  assert.equal(C2.esDeLaBase('wss://firebaseio.com.evil.net/x'),false);
});

test('Reglas: no se bajan colecciones enteras',()=>{
  const r=JSON.parse(fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8')).rules;
  assert.match(r.partidas['.read'],/query\.orderByChild === 'estado' && query\.equalTo === 'esperando'/,'partidas: solo la consulta del vestíbulo');
  assert.equal(r.partidas.$pid['.read'],'auth != null');
  for(const n of ['vivo','chat']){
    assert.equal(r[n]['.read'],undefined,n+' entero no se lee');
    assert.equal(r[n].$pid['.read'],'auth != null');
  }
  assert.equal(r.soloPruebas['.read'],undefined);
  assert.equal(r.soloPruebas.$categoria.$uid.$partida['.read'],'auth != null');
});
