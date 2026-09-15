const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const mod={exports:{}};new Function('module','exports',esbuild.buildSync({entryPoints:['src/juegos/solo/motores.js'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text)(mod,mod.exports);
const {minasNueva,abrirMina,cuenta,bandera,acorde,vecinos,serpienteNueva,girar,avanzar}=mod.exports;
const rng=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
test('Buscaminas: 120 tableros, primer clic seguro y victorias completas',()=>{
 for(const tam of ['explorador','veterano','leyenda'])for(const variante of ['clasico','cruz'])for(let seed=1;seed<=20;seed++){
  const s=minasNueva(tam,variante),i=seed%(s.w*s.h);abrirMina(s,i,rng(seed));assert.equal(s.minas.size,s.n);assert.equal(cuenta(s,i),0);
  for(let k=0;k<s.w*s.h;k++)if(!s.minas.has(k))abrirMina(s,k);assert.equal(s.estado,'gana');assert.equal(s.abiertas.size,s.w*s.h-s.n);
 }
});
test('Buscaminas: banderas, acordes, derrota y vecinos en cruz',()=>{
 const s=minasNueva();bandera(s,10);abrirMina(s,10);assert.equal(s.minas,null);bandera(s,10);abrirMina(s,0,rng(3));
 assert.equal(vecinos(10,9,9,true).length,4);assert.equal(vecinos(10,9,9).length,8);
 const m=[...s.minas][0];abrirMina(s,m);assert.equal(s.estado,'pierde');const n=s.abiertas.size;abrirMina(s,60);assert.equal(s.abiertas.size,n);
 const c=minasNueva();c.minas=new Set([0]);c.n=1;c.estado='jugando';c.abiertas.add(1);bandera(c,0);acorde(c,1);assert.ok(c.abiertas.has(2));assert.notEqual(c.estado,'pierde');
});
test('Snake: giro inverso bloqueado, cola de dos giros y colisión de pared',()=>{
 const s=serpienteNueva();girar(s,{x:-1,y:0});assert.equal(s.cola.length,0);girar(s,{x:0,y:-1});girar(s,{x:-1,y:0});girar(s,{x:0,y:1});assert.equal(s.cola.length,2);
 avanzar(s);assert.deepEqual(s.cuerpo[0],{x:12,y:11});avanzar(s);assert.deepEqual(s.cuerpo[0],{x:11,y:11});for(let i=0;i<25;i++)avanzar(s);assert.equal(s.estado,'pierde');
});
test('Snake: portales, crecimiento, comida libre y ruinas',()=>{
 const s=serpienteNueva('portal',rng(1));s.cuerpo=[{x:23,y:12},{x:22,y:12},{x:21,y:12}];s.comida={x:0,y:12};avanzar(s,rng(2));assert.equal(s.cuerpo[0].x,0);assert.equal(s.puntos,100);assert.equal(s.cuerpo.length,4);assert.ok(!s.cuerpo.some(p=>p.x===s.comida.x&&p.y===s.comida.y));
 const r=serpienteNueva('ruinas',rng(3));assert.ok(r.obstaculos.length>0);r.cuerpo=[{x:6,y:5},{x:6,y:4},{x:6,y:3}];r.dir={x:0,y:1};avanzar(r);assert.equal(r.estado,'pierde');
});
