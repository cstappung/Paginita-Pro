// El directo de Yemas (`yemas-red.js`): qué sale por la malla, quién le
// reenvía a quién el estado de un par sin canal y qué ve el marco. No hay
// respaldo por la base.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sin=f=>fs.readFileSync(f,'utf8').replace(/^import .*$/mg,'').replace(/\bexport\s+/g,'');
const context={};vm.createContext(context);
vm.runInContext(sin('src/juegos/yemas-red.js')+'\n;globalThis.__R={crearDirecto,PUENTE_MS,AVISO_MS,VIDA_GOLPE,VIDA_SUCESO};',context);
const R=context.__R;
const reloj=()=>{const r={t:1e12};r.ahora=()=>r.t;return r;};
const plano=x=>JSON.parse(JSON.stringify(x));

// Una red de mentira: `canal` es el conjunto de pares con canal sano.
function red(uids,rotos=[]){
 const r=reloj(),roto=new Set(rotos.map(([a,b])=>[a,b].sort().join('|')));
 const sano=(a,b)=>a!==b&&!roto.has([a,b].sort().join('|'));
 const n={};
 for(const u of uids)n[u]=R.crearDirecto({uid:u,ahora:r.ahora,sano:v=>sano(u,v),conectados:()=>uids.filter(v=>sano(u,v))});
 // Todos anuncian a todos los que tienen canal.
 const anuncia=()=>{for(const u of uids)for(const v of uids)if(sano(u,v))n[v].recibe(u,n[u].anuncio());};
 // Manda un estado de `u` y entrega los reenvíos; devuelve cuántas veces llegó a cada uno.
 const manda=(u,e)=>{
  const p=n[u].sale(e),llega={};
  const entrega=(de,a,d)=>{const x=n[a].recibe(de,plano(d));if(x.cambio)llega[a]=(llega[a]||0)+1;
   if(x.reenvia)for(const t of x.reenvia.a){assert.ok(sano(a,t),'solo se reenvía por un canal sano');entrega(a,t,x.reenvia.d);}};
  for(const v of uids)if(sano(u,v))entrega(u,v,p);
  return llega;
 };
 return {r,n,anuncia,manda};
}

test('los golpes y los sucesos viejos dejan de viajar',()=>{
 const r=reloj(),d=R.crearDirecto({uid:'a',ahora:r.ahora});
 const e={x:1,s:{i:7,e:[[1,2,3]]},n:{i:3,o:[0,0,0],v:[1,1,1]},g:[[r.t-5000,'b',10,0,0],[r.t-10,'b',20,1,0]],ep:{i:1,u:'b',p:[0,0,0]}};
 let o=d.sale(e).e;
 assert.equal(o.g.length,1);assert.equal(o.g[0][2],20);
 assert.ok(o.s&&o.n&&o.ep);
 r.t+=R.VIDA_SUCESO+1;
 o=d.sale(e).e;
 assert.equal(o.s,undefined);assert.equal(o.n,undefined);assert.ok(o.ep,'la espátula no es un suceso: si falta, el marco la quita');
 o=d.sale({...e,s:{i:8,e:[]}}).e;
 assert.equal(o.s.i,8);
 r.t+=R.VIDA_GOLPE+1;
 assert.equal(d.sale(e).e.g,undefined);
});

test('q siempre crece y lo que llega tarde no pisa lo nuevo',()=>{
 const {n,r}=red(['a','b']);
 const p1=n.a.sale({x:1}),p2=n.a.sale({x:2});
 assert.ok(p2.e.q>p1.e.q);assert.equal(p1.o,'a');
 assert.equal(n.b.recibe('a',plano(p2)).cambio,true);
 assert.equal(n.b.recibe('a',plano(p1)).cambio,false);
 assert.equal(n.b.mapa(['a']).a.x,2);
 // Un paquete de la versión anterior (el estado pelado) vale como de quien lo manda.
 assert.equal(n.b.recibe('a',{x:3,q:p2.e.q+1}).cambio,true);
 assert.equal(n.b.mapa(['a']).a.x,3);
 r.t+=1;
});

test('con todos conectados nadie reenvía nada',()=>{
 const {anuncia,manda}=red(['a','b','c','d']);
 anuncia();
 assert.deepEqual(plano(manda('a',{x:1})),{b:1,c:1,d:1});
});

test('el par sin canal se sirve por un tercero, uno solo',()=>{
 const {n,anuncia,manda}=red(['a','b','c','d'],[['a','d']]);
 anuncia();
 // b es el menor entre los que tienen canal con a y con d: reenvía solo él.
 assert.deepEqual(plano(manda('a',{x:1})),{b:1,c:1,d:1});
 assert.deepEqual(plano(n.b.destinos('a')),['d']);
 assert.deepEqual(plano(n.c.destinos('a')),[]);
 assert.equal(n.d.mapa(['a','b','c']).a.x,1);
 // Y al revés: lo de d le llega a a.
 assert.deepEqual(plano(manda('d',{y:5})),{a:1,b:1,c:1});
 assert.equal(n.a.mapa(['b','c','d']).d.y,5);
 assert.deepEqual(plano(n.a.inalcanzables(['b','c','d'])),[]);
});

test('un golpe dirigido viaja reenviado igual que el resto del estado',()=>{
 const {r,n,anuncia,manda}=red(['a','b','c'],[['a','c']]);
 anuncia();
 manda('a',{x:1,g:[[r.t,'c',30,0,1]]});
 assert.equal(n.c.mapa(['a','b']).a.g[0][1],'c');
});

test('sin nadie en común no hay camino: se deja de ver y se avisa',()=>{
 const {r,n,anuncia,manda}=red(['a','b'],[['a','b']]);
 anuncia();
 assert.deepEqual(plano(manda('a',{x:1})),{});
 assert.deepEqual(plano(n.b.mapa(['a'])),{});
 assert.deepEqual(plano(n.b.inalcanzables(['a'])),[],'recién cortado todavía no se avisa');
 r.t+=R.AVISO_MS;
 assert.deepEqual(plano(n.b.inalcanzables(['a'])),['a']);
});

test('lo último que llegó vale un rato tras perder el camino y luego se va',()=>{
 const r=reloj();let ok=true;
 const b=R.crearDirecto({uid:'b',ahora:r.ahora,sano:()=>ok,conectados:()=>ok?['a']:[]});
 const a=R.crearDirecto({uid:'a',ahora:r.ahora});
 b.recibe('a',plano(a.sale({x:1})));
 ok=false;
 r.t+=R.PUENTE_MS-1;
 assert.equal(b.mapa(['a']).a.x,1);
 r.t+=2;
 assert.deepEqual(plano(b.mapa(['a'])),{},'quien cerró la pestaña desaparece: así cambia el director en zombis');
});

test('un camino por un tercero mantiene a la vista a quien no manda (pestaña oculta)',()=>{
 const {r,n,anuncia,manda}=red(['a','b','c'],[['a','c']]);
 anuncia();
 manda('a',{x:1});
 r.t+=60000;
 anuncia();
 assert.equal(n.c.mapa(['a','b']).a.x,1,'b sigue diciendo que tiene canal con a');
});
