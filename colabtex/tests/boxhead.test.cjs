const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto};vm.createContext(context);vm.runInContext(code,context);
const {reducir,minimoDe}=context;
const [JUEGOS,BX_MAPAS,BX_ARMAS]=vm.runInContext('[JUEGOS,BX_MAPAS,BX_ARMAS]',context);
const D=require('../../juegos/boxhead/js/datos.js');
const copia=x=>JSON.parse(JSON.stringify(x));
const sala=(n=3,extra={})=>({juego:'boxhead',semilla:1,estado:'jugando',cupo:n,
 jugadores:Object.fromEntries(['a','b','c','d','e','f','g','h'].slice(0,n).map((u,i)=>[u,{nombre:u,orden:i}])),jugadas:{},...extra});
const mover=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p)};

test('boxhead: de 1 a 8 jugadores, versus pide 2',()=>{
 assert.equal(JUEGOS.boxhead.cupo,8);
 assert.equal(minimoDe({juego:'boxhead',variante:'coop'}),1);
 assert.equal(minimoDe({juego:'boxhead',variante:'versus'}),2);
 for(const n of [1,2,5,8]){const e=reducir(sala(n));assert.equal(e.fase,'jugando');assert.equal(e.jugadores.length,n);}
});

test('boxhead coop: los niveles van de uno en uno y reviven a los caídos',()=>{
 const p=sala(3);
 let e=mover(p,{t:'muere',uid:'a',por:'',a:8,pts:500,k:20,n:1});
 assert.deepEqual(copia(e.caidos),['a']);assert.equal(e.fase,'jugando');
 e=mover(p,{t:'nivel',uid:'b',n:3});assert.equal(e.nivel,1);           // se salta uno: no vale
 e=mover(p,{t:'nivel',uid:'b',n:2});assert.equal(e.nivel,2);assert.deepEqual(copia(e.caidos),[]);
 e=mover(p,{t:'nivel',uid:'c',n:2});assert.equal(e.nivel,2);           // repetido: no cuenta
});

test('boxhead coop: termina cuando caen todos y gana el de más puntos',()=>{
 const p=sala(3);
 mover(p,{t:'muere',uid:'a',por:'',a:8,pts:900,k:40});
 mover(p,{t:'muere',uid:'a',por:'',a:8,pts:99999});                    // ya caído: no cuenta
 mover(p,{t:'muere',uid:'b',por:'',a:9,pts:1200,k:30});
 let e=reducir(p);assert.equal(e.fase,'jugando');
 e=mover(p,{t:'muere',uid:'c',por:'',a:8,pts:300});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'b');assert.equal(e.motivo,'caidos');
 assert.equal(e.puntos.a,900);
});

test('boxhead coop: quien se va no bloquea el final',()=>{
 const p=sala(2);
 mover(p,{t:'muere',uid:'a',por:'',a:8,pts:100});
 const e=mover(p,{t:'abandona',uid:'b'});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'a');
});

test('boxhead versus: la meta, el suicidio y el abandono',()=>{
 const p=sala(3,{variante:'versus',meta:5});
 let e=reducir(p);assert.equal(e.meta,5);
 e=mover(p,{t:'muere',uid:'a',por:'a',a:3});assert.equal(e.bajas.a,0);assert.equal(e.muertes.a,1);
 e=mover(p,{t:'muere',uid:'a',por:'zz',a:0});assert.equal(e.bajas.a,0);
 for(let i=0;i<4;i++)e=mover(p,{t:'muere',uid:i%2?'b':'c',por:'a',a:6});
 assert.equal(e.fase,'jugando');assert.equal(e.bajas.a,4);
 e=mover(p,{t:'muere',uid:'b',por:'a',a:6});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'a');assert.equal(e.motivo,'meta');
 const q=sala(2,{variante:'versus'});
 e=mover(q,{t:'abandona',uid:'a'});assert.equal(e.ganador,'b');assert.equal(e.motivo,'abandono');
 for(const m of [0,7,'x'])assert.equal(reducir(sala(2,{variante:'versus',meta:m})).meta,10);
});

test('boxhead: mapa, variante y armas se recortan a lo que existe',()=>{
 assert.equal(reducir(sala(2,{mapa:'luna'})).mapa,'patio');
 assert.equal(reducir(sala(2,{mapa:'sotano'})).mapa,'sotano');
 assert.equal(reducir(sala(2,{variante:'otra'})).variante,'coop');
 assert.deepEqual(Object.keys(BX_MAPAS),copia(D.ORDEN_MAPAS));
 assert.equal(D.ARMAS.length,BX_ARMAS);
});

test('boxhead: datos del juego — armas, mejoras, skins',()=>{
 const mul=D.ARMAS.map(a=>a.mul);
 assert.deepEqual(mul,[...mul].sort((x,y)=>x-y));
 assert.equal(D.SKINS.length,8);
 assert.equal(new Set(D.SKINS.map(s=>s.id)).size,8);
 for(const a of D.ARMAS)assert.ok(a.nombre&&a.id!==undefined||a.nombre);
});

test('boxhead: en cada mapa se llega de los jugadores a todas las entradas',()=>{
 for(const id of D.ORDEN_MAPAS){
  const m=D.cargaMapa(id);
  assert.ok(m.spawnsP.length>=4,id+': puntos de aparición (se reparten en rueda)');
  assert.ok(m.spawnsE.length>=2,id+': entradas de enemigos');
  const libre=(x,y)=>x>=0&&y>=0&&x<m.ancho&&y<m.alto&&m.celdas[y*m.ancho+x]===0;
  const ts=D.TS,ini=m.spawnsP[0],sx=Math.floor(ini.x/ts),sy=Math.floor(ini.y/ts);
  const visto=new Set([sx+','+sy]),cola=[[sx,sy]];
  while(cola.length){const [x,y]=cola.shift();for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=nx+','+ny;if(!visto.has(k)&&libre(nx,ny)){visto.add(k);cola.push([nx,ny]);}}}
  for(const p of m.spawnsP)assert.ok(visto.has(Math.floor(p.x/ts)+','+Math.floor(p.y/ts)),id+': jugador aislado');
  for(const s of m.spawnsE){
   const vecino=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>visto.has((s.tx+dx)+','+(s.ty+dy)));
   assert.ok(visto.has(s.tx+','+s.ty)||vecino,id+': entrada aislada en '+s.tx+','+s.ty);
  }
 }
});

test('boxhead: una mejora en cada multiplicador sin arma, rotando y con tope',()=>{
 const armas=new Set(D.ARMAS.map(a=>a.desbloquea));
 const ms=new Set(D.MEJORAS.map(m=>m.m));
 for(let m=2;m<=60;m++)if(!armas.has(m))assert.ok(ms.has(m),'falta mejora en ×'+m);
 const usadas=new Set(D.MEJORAS.filter(m=>m.m<=60).map(m=>m.arma));
 assert.ok(usadas.size>=6,'las mejoras rotan entre armas');
 const todas=new Set(D.MEJORAS.map(m=>m.id));
 for(const a of D.ARMAS){
  const f=D.arma(a.id,todas);
  if(a.d)assert.ok(f.d>=a.d&&f.d<=a.d*4,a.nombre+' daño con tope');
  if(a.cad)assert.ok(f.cad<=a.cad&&f.cad>0,a.nombre+' cadencia');
  if(a.id===2)assert.ok(f.perdigones>a.perdigones&&f.abre!==a.abre,'la escopeta mejora perdigones y apertura');
 }
});

test('boxhead: el combo baja de a uno con barras más cortas',()=>{
 for(let m=2;m<60;m++){
  assert.ok(D.bajadaCombo(m)>0);
  assert.ok(D.bajadaCombo(m)<=D.duracionCombo(m));
 }
});

test('boxhead: la mezcla de enemigos suma 1 y cada tipo entra en su nivel',()=>{
 for(let n=1;n<=60;n++){
  const p=D.mezclaNivel(n);
  assert.ok(Math.abs(p.reduce((a,b)=>a+b,0)-1)<1e-9,'suma 1 en '+n);
  assert.ok(p[0]>=0.2-1e-9,'zombis comunes ≥ 20 % en '+n);
  for(const e of D.ENEMIGOS)if(e.id&&n<e.desde)assert.equal(p[e.id],0,e.nombre+' antes de tiempo');
  for(const e of D.ENEMIGOS)if(e.id&&n>=e.desde)assert.ok(p[e.id]>0,e.nombre+' falta en '+n);
  assert.equal(D.tipoEnemigo(n,0),p[0]>0?0:D.tipoEnemigo(n,0));
  assert.ok(D.tipoEnemigo(n,0.999999)>=0&&D.tipoEnemigo(n,0.999999)<D.ENEMIGOS.length);
 }
});

test('boxhead: la dificultad sube de forma pausada y sin saltos',()=>{
 let prev=null;
 for(let n=1;n<=40;n++){
  const c={total:D.totalNivel(n),ritmo:D.ritmoNivel(n),vida:D.vidaEnemigo(0,n),vel:D.velEnemigo(0,n),golpe:D.golpeNivel(0,n),max:D.maxVivos(n,1)};
  if(prev){
   assert.ok(c.total>=prev.total&&c.total-prev.total<=4,'total recto en '+n);
   assert.ok(c.ritmo<=prev.ritmo&&prev.ritmo-c.ritmo<=0.031,'ritmo recto en '+n);
   assert.ok(c.vida>=prev.vida&&c.vida/prev.vida<=1.1,'vida suave en '+n);
   assert.ok(c.vel>=prev.vel&&c.vel-prev.vel<=1,'velocidad suave en '+n);
   assert.ok(c.golpe>=prev.golpe&&c.golpe-prev.golpe<=1,'golpe suave en '+n);
   assert.ok(c.max>=prev.max&&c.max-prev.max<=1,'vivos a la vez suave en '+n);
  }
  prev=c;
 }
});

test('boxhead: tienda, potencia y armadura',()=>{
 for(const t of D.TIENDA){assert.ok(t.precio>0&&/^[A-Z]$/.test(t.tecla),t.id);}
 assert.equal(new Set(D.TIENDA.map(t=>t.tecla)).size,D.TIENDA.length,'teclas distintas');
 assert.equal(D.precioTienda('balas',0),250);
 assert.equal(D.precioTienda('potencia',0),800);
 assert.equal(D.precioTienda('potencia',2),2400);
 assert.equal(D.precioTienda('potencia',5),Infinity);
 assert.equal(D.precioTienda('nada',0),Infinity);
 assert.equal(D.factorPotencia(0),1);
 assert.ok(Math.abs(D.factorPotencia(5)-1.5)<1e-9);
 assert.ok(Math.abs(D.factorPotencia(9)-1.5)<1e-9,'potencia con tope');
 assert.ok(D.ARMADURA.absorbe>0&&D.ARMADURA.absorbe<1&&D.ARMADURA.max>0);
});

test('boxhead: la penetración se gana con mejoras y tiene tope',()=>{
 const todas=new Set(D.MEJORAS.map(m=>m.id));
 const conPen=D.ARMAS.filter(a=>(D.PASOS[a.id]||[]).some(p=>p[0]==='pen'));
 assert.ok(conPen.length>=2,'al menos dos armas atraviesan');
 for(const a of conPen){
  const f=D.arma(a.id,todas);
  assert.ok((f.pen||0)>(a.pen||0),a.nombre+' gana penetración');
  assert.ok((f.pen||0)<=6,a.nombre+' penetración con tope');
 }
});

test('boxhead: cada mapa tiene tienda y barriles a los que se llega',()=>{
 for(const id of D.ORDEN_MAPAS){
  const m=D.cargaMapa(id),ts=D.TS;
  assert.ok(m.tiendas.length>=1,id+': sin tienda');
  assert.ok(m.barriles.length>=1,id+': sin barriles');
  const libre=(x,y)=>x>=0&&y>=0&&x<m.ancho&&y<m.alto&&m.celdas[y*m.ancho+x]===0;
  const ini=m.spawnsP[0],sx=Math.floor(ini.x/ts),sy=Math.floor(ini.y/ts);
  const visto=new Set([sx+','+sy]),cola=[[sx,sy]];
  while(cola.length){const [x,y]=cola.shift();for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=nx+','+ny;if(!visto.has(k)&&libre(nx,ny)){visto.add(k);cola.push([nx,ny]);}}}
  const llega=(px,py)=>{const tx=Math.floor(px/ts),ty=Math.floor(py/ts);return visto.has(tx+','+ty)||[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>visto.has((tx+dx)+','+(ty+dy)));};
  for(const t of m.tiendas)assert.ok(llega(t.x,t.y),id+': tienda aislada');
  for(const b of m.barriles)assert.ok(llega(b.x,b.y),id+': barril aislado');
 }
});
