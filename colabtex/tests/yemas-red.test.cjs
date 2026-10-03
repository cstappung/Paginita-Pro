// El directo de Yemas (`yemas-red.js`): qué sale por la malla y por la base,
// a quién se escucha y qué ve el marco.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sin=f=>fs.readFileSync(f,'utf8').replace(/^import .*$/mg,'').replace(/\bexport\s+/g,'');
const context={};vm.createContext(context);
vm.runInContext(sin('src/juegos/yemas-red.js')+'\n;globalThis.__R={crearDirecto,LENTO_MS,GRACIA_MS,SOLAPE_MS,PUENTE_MS,VIDA_GOLPE,VIDA_SUCESO};',context);
const R=context.__R;
const reloj=()=>{const r={t:1e12};r.ahora=()=>r.t;return r;};
const plano=x=>JSON.parse(JSON.stringify(x));

test('los golpes y los sucesos viejos dejan de viajar',()=>{
 const r=reloj(),d=R.crearDirecto({ahora:r.ahora});
 const e={x:1,s:{i:7,e:[[1,2,3]]},n:{i:3,o:[0,0,0],v:[1,1,1]},g:[[r.t-5000,'b',10,0,0],[r.t-10,'b',20,1,0]],ep:{i:1,u:'b',p:[0,0,0]}};
 let o=d.sale(e,false).paquete;
 assert.equal(o.g.length,1);assert.equal(o.g[0][2],20);
 assert.ok(o.s&&o.n&&o.ep);
 r.t+=R.VIDA_SUCESO+1;
 o=d.sale(e,false).paquete;
 assert.equal(o.s,undefined);assert.equal(o.n,undefined);assert.ok(o.ep,'la espátula no es un suceso: si falta, el marco la quita');
 // Un disparo nuevo vuelve a viajar.
 o=d.sale({...e,s:{i:8,e:[]}},false).paquete;
 assert.equal(o.s.i,8);
 r.t+=R.VIDA_GOLPE+1;
 assert.equal(d.sale(e,false).paquete.g,undefined);
});

test('q siempre crece y la base se escribe poco, distinta y rápida solo si hace falta',()=>{
 const r=reloj(),d=R.crearDirecto({ahora:r.ahora});
 let a=d.sale({x:1},false);
 assert.ok(a.escribir);
 let b=d.sale({x:2},false);
 assert.ok(b.paquete.q>a.paquete.q);
 assert.equal(b.escribir,null,'antes de LENTO_MS no se escribe');
 assert.ok(d.sale({x:3},true).escribir,'rápido escribe cada estado distinto');
 assert.equal(d.sale({x:3},true).escribir,null,'igual al último escrito no se escribe');
 r.t+=R.LENTO_MS;
 assert.equal(d.sale({x:3},false).escribir,null,'quieto no gasta escrituras');
 assert.equal(d.sale({x:4},false).escribir.x,4);
});

test('a quién se escucha por la base y cuándo la mía va rápida',()=>{
 const r=reloj(),d=R.crearDirecto({ahora:r.ahora});
 const sanos=new Set();const sano=u=>sanos.has(u);
 let x=d.decide({otros:['b','c'],sano,soyJugador:true});
 assert.deepEqual([...x.subs].sort(),['b','c']);assert.equal(x.rapido,false);
 sanos.add('b');sanos.add('c');
 r.t+=500;
 x=d.decide({otros:['b','c'],sano,soyJugador:true});
 assert.deepEqual([...x.subs].sort(),['b','c'],'se solapa un rato tras abrir el canal');
 r.t+=R.SOLAPE_MS;
 x=d.decide({otros:['b','c'],sano,soyJugador:true});
 assert.equal(x.subs.size,0,'con todos conectados no se escucha nada');assert.equal(x.rapido,false);
 sanos.delete('c');
 x=d.decide({otros:['b','c'],sano,soyJugador:true});
 assert.deepEqual([...x.subs],['c']);assert.equal(x.rapido,false,'hay gracia');
 r.t+=R.GRACIA_MS;
 x=d.decide({otros:['b','c'],sano,soyJugador:true});
 assert.equal(x.rapido,true);
 assert.equal(d.decide({otros:['b','c'],sano,soyJugador:false}).rapido,false,'un mirón no escribe');
 // Un mirón presente sin canal también acelera la base.
 sanos.add('c');r.t+=R.SOLAPE_MS;
 d.decide({otros:['b','c'],mirones:['m'],sano,soyJugador:true});
 r.t+=R.GRACIA_MS;
 assert.equal(d.decide({otros:['b','c'],mirones:['m'],sano,soyJugador:true}).rapido,true);
});

test('el marco ve el estado más nuevo de los dos caminos y pierde a quien se fue',()=>{
 const r=reloj(),d=R.crearDirecto({ahora:r.ahora});
 const sanos=new Set(['b']);const sano=u=>sanos.has(u);
 const otros=['b'];
 d.decide({otros,sano,soyJugador:true});
 assert.ok(d.recibeMalla('b',{q:10,x:1}));
 assert.ok(!d.recibeMalla('b',{q:9,x:0}),'un paquete atrasado se tira');
 assert.ok(!d.recibeMalla('b',{x:5}),'sin q no vale');
 d.recibeBase('b',{q:8,x:-1});
 assert.equal(d.mapa({otros,sano}).b.x,1);
 d.recibeBase('b',{q:12,x:2});
 assert.equal(d.mapa({otros,sano}).b.x,2,'la base gana si trae algo más nuevo');
 r.t+=R.SOLAPE_MS;d.decide({otros,sano,soyJugador:true});
 assert.ok(!d.recibeBase('b',{q:99,x:9}),'sin escucharla, la base no cuenta');
 assert.equal(d.mapa({otros,sano}).b.x,1);
 // Se cae el canal: vale lo último de la malla hasta que la base conteste.
 sanos.clear();
 d.decide({otros,sano,soyJugador:true});
 assert.equal(d.mapa({otros,sano}).b.x,1);
 d.recibeBase('b',null);   // cerró la pestaña: su onDisconnect lo borró
 assert.equal(d.mapa({otros,sano}).b,undefined);
 // Sin respuesta de la base, el puente dura PUENTE_MS.
 const d2=R.crearDirecto({ahora:r.ahora});
 sanos.add('b');d2.decide({otros,sano,soyJugador:true});d2.recibeMalla('b',{q:1,x:1});
 sanos.clear();d2.decide({otros,sano,soyJugador:true});
 assert.equal(d2.mapa({otros,sano}).b.x,1);
 r.t+=R.PUENTE_MS;
 assert.equal(d2.mapa({otros,sano}).b,undefined);
});

test('una versión vieja sin q se ve por la base',()=>{
 const r=reloj(),d=R.crearDirecto({ahora:r.ahora});
 const sano=()=>false,otros=['viejo'];
 d.decide({otros,sano,soyJugador:true});
 d.recibeBase('viejo',{x:3,y:0,z:1});
 assert.deepEqual(plano(d.mapa({otros,sano})),{viejo:{x:3,y:0,z:1}});
 assert.deepEqual(plano(d.mapa({otros:[],sano})),{},'solo jugadores de la sala');
});
