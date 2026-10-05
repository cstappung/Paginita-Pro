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
