/* Antitrampas de Sudoku Arcade (docs/antitrampas/sudoku.md): partidas de
   robot jugadas con el motor que pasan, y una trampa de cada vía que no. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const carga=entry=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const S=carga('src/juegos/solo/verifica/sudoku.js');
const M=require('../../juegos/club/sudoku/motor.js');
const HOY=M.diaChile(),AHORA={ahora:Date.now()};

/* Un robot de diario o clásico, como lo apunta la pantalla: cada cambio
   de celda [i, valor, Δt]. Con `errores` pone a veces un número malo y lo
   corrige (o lo borra y lo vuelve a escribir, como un «deshacer»); con
   `pistas` pide algunas, cada una con sus 30 s. `paso(k)` son los ms que
   piensa antes de la celda k. */
/* `forma(k)` es [g, f] de cada jugada: por omisión, la de una persona
   (entre el clic en la celda y la tecla, 90–700 ms, con eventos de verdad);
   los intervalos llevan ±30 % de ruido salvo `exacto`. */
const mano=rng=>()=>[90+Math.round(rng()*610),0];
function resuelve(s,paso,{errores=false,pistas=0,semilla=1,exacto=false,forma=null}={}){
 const rng=M.mulberry32(semilla),vacias=s.pistas.map((v,i)=>v?-1:i).filter(i=>i>=0);
 for(let k=vacias.length-1;k>0;k--){const q=Math.floor(rng()*(k+1));[vacias[k],vacias[q]]=[vacias[q],vacias[k]];}
 const j=[];let t=0,n=0;forma=forma||mano(rng);
 const pon=(i,v,dt)=>{dt=Math.round(exacto?dt:dt*(0.7+rng()*0.6));t+=dt;j.push(i,v,dt,...forma(n++));};
 vacias.forEach((i,k)=>{
  if(k<pistas){pon(i,10+s.solucion[i],30000+paso(k));return;}
  if(errores&&k%5===0){pon(i,s.solucion[i]%9+1,paso(k));pon(i,0,700);}
  if(errores&&k%7===0){pon(i,s.solucion[i],paso(k));pon(i,0,400);pon(i,s.solucion[i],600);return;}
  pon(i,s.solucion[i],paso(k));
 });
 return {j,t};
}
/* Un robot del arcade que se equivoca `errores` veces. Los puntos los
   cuenta como la pantalla (game.js): combo, unidades cerradas y, al
   ganar, el bono de tiempo y el de las vidas. */
function arcade(semilla,paso,errores=0,{exacto=false,forma=null,enOrden=false}={}){
 const s=M.generar({dificultad:'medio',rng:M.mulberry32(semilla)}),tab=s.pistas.slice(),rng=M.mulberry32(semilla+1);
 const j=[];let t=0,combo=0,vidas=3,puntos=0,k=0,e=0;forma=forma||mano(rng);
 const d=k=>Math.round(exacto?paso(k):paso(k)*(0.7+rng()*0.6));
 const celdas=[...Array(81).keys()];
 if(!enOrden)for(let q=80;q>0;q--){const w=Math.floor(rng()*(q+1));[celdas[q],celdas[w]]=[celdas[w],celdas[q]];}
 for(const i of celdas){
  if(tab[i])continue;
  if(e<errores){e++;const dt=d(k);t+=dt;j.push(i,s.solucion[i]%9+1,dt,...forma(k));vidas--;combo=0;k++;if(vidas<=0)return {j,t:t+450,puntos,gana:false,s};}
  const dt=d(k);t+=dt;j.push(i,s.solucion[i],dt,...forma(k));k++;tab[i]=s.solucion[i];combo++;
  const u=M.unidadesCompletas(tab,i);puntos+=M.puntosArcade({combo,unidades:(u.fila?1:0)+(u.columna?1:0)+(u.caja?1:0)});
 }
 return {j,t,puntos:puntos+M.bonoTiempo(t,'medio')+vidas*M.PUNTOS.vida,gana:true,s};
}

test('Sudoku clásico: partidas honestas pasan (lentas, con errores, con pistas y rápidas pero humanas)',async()=>{
 const casos=[['facil',11,k=>9000+k*37,{}],['medio',22,k=>2500+(k%4)*900,{errores:true}],['dificil',33,k=>6000,{pistas:3}],['experto',44,k=>20000+k*100,{errores:true,pistas:1}],
  ['facil',55,()=>600,{}],['medio',66,()=>800,{}],['experto',77,()=>1600,{}]];
 for(const [d,semilla,paso,op] of casos){
  const o={v:1,m:'c',s:semilla,d},s=M.sudokuDePrueba(o),{j,t}=resuelve(s,paso,{...op,semilla});
  assert.equal(await V.verificaClub('sudoku',{categoria:'club-sudoku-'+d,puntos:1,tiempo:t,partida:'x'},{...o,j}),null,`${d} ${semilla}`);
 }
});

test('Sudoku diario: el de hoy (y el de ayer) pasa',async()=>{
 for(const f of [HOY,M.diaAnterior(HOY)]){
  const o={v:1,m:'d',f},{j,t}=resuelve(M.sudokuDiario(f),()=>4000,{errores:true});
  assert.equal(S.verifica({categoria:'club-sudoku-racha',puntos:1,tiempo:t,partida:'x'},{...o,j},AHORA),null,f);
 }
 const o={v:1,m:'d',f:HOY},{j,t}=resuelve(M.sudokuDiario(HOY),()=>3000);
 assert.equal(await V.verificaClub('sudoku',{categoria:'club-sudoku-racha',puntos:1,tiempo:t,partida:'x'},{...o,j}),null);
});

test('Sudoku arcade: ganadas y perdidas honestas pasan con sus puntos exactos',async()=>{
 for(const [semilla,paso,errores] of [[1,()=>5000,0],[2,k=>1500+k*50,2],[3,()=>900,1],[4,()=>3000,3],[5,k=>k<20?2000:700,0]]){
  const r=arcade(semilla,paso,errores);
  const dato={categoria:'club-sudoku-arcade',puntos:r.puntos,tiempo:r.t,partida:'x'};
  assert.equal(await V.verificaClub('sudoku',dato,{v:1,m:'a',s:semilla,j:r.j}),null,`arcade ${semilla}`);
  assert.equal(r.gana,errores<3);
 }
});

test('Sudoku: cada vía de trampa se rechaza',async()=>{
 const no=async(d,p,re)=>assert.match(String(await V.verificaClub('sudoku',d,p)),re);
 const o={v:1,m:'c',s:808,d:'medio'},s=M.sudokuDePrueba(o),{j,t}=resuelve(s,()=>3000);
 const dato={categoria:'club-sudoku-medio',puntos:1,tiempo:t,partida:'x'};
 // Club.result a mano, sin prueba.
 await no(dato,null,/sin prueba/);
 // Tiempo recortado.
 await no({...dato,tiempo:t-5000},{...o,j},/menor que el de las jugadas/);
 // La prueba de otra partida: otra semilla, otra dificultad, otro modo.
 await no(dato,{...o,s:809,j},/(resuelto|celda fija|no se pudo)/);
 await no({...dato,categoria:'club-sudoku-experto'},{...o,j},/otra dificultad/);
 await no(dato,{v:1,m:'a',s:808,j},/otro modo/);
 // Prueba manipulada: falta una celda, escribe sobre una pista, valor imposible, basura.
 await no(dato,{...o,j:j.slice(0,-5)},/no deja el sudoku resuelto/);
 const fija=s.pistas.findIndex(v=>v);await no(dato,{...o,j:[fija,1,100,300,0,...j]},/celda fija/);
 await no(dato,{...o,j:[...j,j[0],42,1,300,0]},/no se pudo/);
 await no(dato,{...o,j:'123'},/no se pueden leer/);
 await no(dato,{...o,v:7,j},/versión/);
 // Una pista sin sus 30 s, y una pista en el diario.
 const conPista=resuelve(s,()=>3000,{pistas:1});
 const sinCastigo=conPista.j.slice();sinCastigo[2]=1000;
 await no({...dato,tiempo:conPista.t},{...o,j:sinCastigo},/30 segundos/);
 const d=M.sudokuDiario(HOY),pd=resuelve(d,()=>3000,{pistas:1});
 await no({categoria:'club-sudoku-racha',puntos:1,tiempo:pd.t,partida:'x'},{v:1,m:'d',f:HOY,j:pd.j},/pista/);
 // Un solucionador: todo de una vez, o una ráfaga en medio de una partida lenta.
 const bot=resuelve(s,k=>k?30:2000);
 await no({...dato,tiempo:bot.t},{...o,j:bot.j},/no es humano/);
 const rafaga=resuelve(s,k=>k>=20&&k<32?80:4000);
 await no({...dato,tiempo:rafaga.t},{...o,j:rafaga.j},/demasiado rápido/);
 // Escribir y borrar con la tecla apretada no es ráfaga (se miran los valores finales).
 const rep=[];for(let k=0;k<40;k++)rep.push(j[0],k%2?0:7,k?33:2000,k?33:400,0);
 const tecla=[...rep,...j];
 assert.equal(await V.verificaClub('sudoku',{...dato,tiempo:t+2000+39*33},{...o,j:tecla}),null);
});

test('Sudoku arcade: puntos inflados, partida sin terminar o jugadas después del final se rechazan',async()=>{
 const no=async(d,p,re)=>assert.match(String(await V.verificaClub('sudoku',d,p)),re);
 const r=arcade(9,()=>3000,1),p={v:1,m:'a',s:9,j:r.j};
 const dato={categoria:'club-sudoku-arcade',puntos:r.puntos,tiempo:r.t,partida:'x'};
 await no({...dato,puntos:r.puntos+1},p,/no cuadran/);
 // Recortar el tiempo para cobrar más bono.
 await no({...dato,tiempo:r.t-10000,puntos:r.puntos+50},p,/menor que el de las jugadas/);
 // A medias (sin ganar ni perder), y con jugadas después de perder.
 await no(dato,{...p,j:r.j.slice(0,50)},/no terminó/);
 const perdida=arcade(9,()=>3000,3);
 await no({...dato,puntos:perdida.puntos||1,tiempo:perdida.t+5000},{...p,j:[...perdida.j,...r.j.slice(-5)]},/después del final/);
 // Un script: el tablero completo en segundos.
 const bot=arcade(9,k=>k?40:2000,0);
 await no({...dato,puntos:bot.puntos,tiempo:bot.t},{v:1,m:'a',s:9,j:bot.j},/no es humano/);
});

test('Sudoku: capa anti-bot — eventos sintéticos, pestaña oculta, celda y número a la vez, metrónomo',async()=>{
 const o={v:1,m:'c',s:4242,d:'experto'},s=M.sudokuDePrueba(o);
 const ver=async(paso,op)=>{const r=resuelve(s,paso,{semilla:9,...op});return V.verificaClub('sudoku',{categoria:'club-sudoku-experto',puntos:1,tiempo:r.t,partida:'x'},{...o,j:r.j});};
 // El experto de las tablas en 90 s, con dispatchEvent.
 assert.match(String(await ver(()=>1650,{forma:()=>[300,1]})),/sintéticos/);
 // Jugando con la pestaña oculta.
 assert.match(String(await ver(()=>4000,{forma:k=>[300,k%3?0:4]})),/oculta/);
 // Eventos de verdad (CDP) que eligen la celda y escriben en el mismo instante.
 assert.match(String(await ver(()=>4000,{forma:()=>[2,0]})),/a la vez/);
 // Metrónomo exacto, aunque con forma humana.
 assert.match(String(await ver(()=>1650,{exacto:true})),/metrónomo/);
 // Casi metrónomo (±12 %) y dos tercios pegadas: dos señales débiles.
 const r9=M.mulberry32(5);
 assert.match(String(await ver(()=>2000*(0.88+r9()*0.24),{exacto:true,forma:k=>[k%3?5:300,0]})),/parece un script/);
 // Cada señal débil sola no basta.
 assert.equal(await ver(()=>2000*(0.88+r9()*0.24),{exacto:true}),null,'casi metrónomo solo');
 assert.equal(await ver(()=>3000,{forma:k=>[k%3?5:300,0]}),null,'dos tercios pegadas solas');
 // Con mando conectado (los eventos de mando.js son sintéticos) vale.
 assert.equal(await ver(()=>3000,{forma:()=>[400,2]}),null,'mando');
 // Muy rápido pero humano: un experto en ~95 s con forma de persona pasa
 // (el reloj solo no acusa a nadie).
 assert.equal(await ver(()=>1700),null,'experto rápido humano');
 // La primera jugada antes de reaccionar.
 const r=resuelve(s,k=>k?3000:50,{exacto:true,semilla:9});
 assert.match(String(await V.verificaClub('sudoku',{categoria:'club-sudoku-experto',puntos:1,tiempo:r.t,partida:'x'},{...o,j:r.j})),/reaccionar/);
 // El arcade de las tablas: 30 000 puntos en 105 s con un script.
 const a=arcade(77,()=>2000,0,{exacto:true,forma:()=>[1,0]});
 assert.match(String(await V.verificaClub('sudoku',{categoria:'club-sudoku-arcade',puntos:a.puntos,tiempo:a.t,partida:'x'},{v:1,m:'a',s:77,j:a.j})),/metrónomo|a la vez/);
});

test('Sudoku: el diario tiene que ser el de hoy y la racha caber desde el lanzamiento',()=>{
 const f='2026-10-05',d=M.sudokuDiario(f),{j,t}=resuelve(d,()=>3000);
 const dato={categoria:'club-sudoku-racha',puntos:1,tiempo:t,partida:'x'};
 assert.match(S.verifica(dato,{v:1,m:'d',f,j},{ahora:Date.parse('2026-10-12T15:00:00Z')}),/diario de hoy/);
 const ahora={ahora:Date.parse('2026-10-05T15:00:00Z')};
 assert.equal(S.verifica({...dato,puntos:2},{v:1,m:'d',f,j},ahora),null);
 assert.match(S.verifica({...dato,puntos:3},{v:1,m:'d',f,j},ahora),/no cabe/);
 assert.match(S.verifica({...dato,puntos:999},{v:1,m:'d',f,j},ahora),/no cabe/);
});

test('Sudoku: sospecha() de filas guardadas sin prueba',()=>{
 assert.equal(S.sospecha('club-sudoku-facil',{puntos:1,tiempo:95000}),null);
 assert.match(S.sospecha('club-sudoku-facil',{puntos:1,tiempo:4000}),/facil/);
 assert.match(S.sospecha('club-sudoku-experto',{puntos:1,tiempo:45000}),/experto/);
 assert.equal(S.sospecha('club-sudoku-arcade',{puntos:12000,tiempo:300000}),null);
 assert.match(S.sospecha('club-sudoku-arcade',{puntos:900000,tiempo:300000}),/no da más/);
 assert.match(S.sospecha('club-sudoku-racha',{puntos:300,tiempo:300000}),/racha de 300/);
 assert.match(S.sospecha('club-sudoku-racha',{puntos:1,tiempo:5000}),/diario/);
 // Las marcas de las tablas: el experto en 90 s y el arcade de 30 266 en 105 s.
 assert.match(S.sospecha('club-sudoku-experto',{puntos:1,tiempo:90000}),/revisar/);
 assert.match(S.sospecha('club-sudoku-arcade',{puntos:30266,tiempo:105000}),/revisar/);
 assert.equal(S.sospecha('club-sudoku-arcade',{puntos:30266,tiempo:584000}),null);
 assert.equal(S.sospecha('club-sudoku-experto',{puntos:1,tiempo:400000}),null);
 assert.equal(S.PRUEBA,1);
});

test('Sudoku: escribir la solución en orden de lectura delata a un programa',async()=>{
 // Un bot con forma y ritmo de persona que escribe la solución celda por
 // celda, de izquierda a derecha (el de las tablas que hizo un fácil así).
 for(const [d,semilla] of [['facil',101],['experto',102]]){
  const o={v:1,m:'c',s:semilla,d},s=M.sudokuDePrueba(o),rng=M.mulberry32(semilla),j=[];let t=0;
  s.pistas.forEach((v,i)=>{if(v)return;const dt=Math.round(4000*(0.5+rng()));t+=dt;j.push(i,s.solucion[i],dt,90+Math.round(rng()*600),0);});
  assert.match(String(await V.verificaClub('sudoku',{categoria:'club-sudoku-'+d,puntos:1,tiempo:t,partida:'x'},{...o,j})),/orden de lectura/,d);
 }
 // El arcade igual, con ritmo humano.
 const a=arcade(88,()=>4000,0,{enOrden:true});
 assert.match(String(await V.verificaClub('sudoku',{categoria:'club-sudoku-arcade',puntos:a.puntos,tiempo:a.t,partida:'x'},{v:1,m:'a',s:88,j:a.j})),/orden de lectura/);
 // Casi en orden, con dos celdas invertidas cada ocho: ninguna racha llega a 20,
 // pero la fracción delata con 30 celdas o más.
 const o={v:1,m:'c',s:103,d:'medio'},s=M.sudokuDePrueba(o),vac=s.pistas.map((v,i)=>v?-1:i).filter(i=>i>=0);
 for(let q=0;q+1<vac.length;q+=8)[vac[q],vac[q+1]]=[vac[q+1],vac[q]];
 const rng=M.mulberry32(7),j=[];let t=0;
 for(const i of vac){const dt=Math.round(4000*(0.5+rng()));t+=dt;j.push(i,s.solucion[i],dt,90+Math.round(rng()*600),0);}
 const r=S.ordenLectura(s,j);
 assert.ok(r.racha<20&&r.fraccion>=0.75,JSON.stringify(r));
 assert.match(String(await V.verificaClub('sudoku',{categoria:'club-sudoku-medio',puntos:1,tiempo:t,partida:'x'},{...o,j})),/orden de lectura/);
 // Un orden barajado (el de las partidas honestas de arriba) ronda el 50 %.
 const h=resuelve(s,()=>4000,{semilla:3}),rh=S.ordenLectura(s,h.j);
 assert.ok(rh.racha<8&&rh.fraccion<0.65,JSON.stringify(rh));
});

test('Sudoku: el reloj del juego ralentizado se nota contra el del sistema',async()=>{
 const r=arcade(1,()=>5000,0);
 const dato={categoria:'club-sudoku-arcade',puntos:r.puntos,tiempo:r.t,partida:'x'};
 const p={v:1,m:'a',s:1,j:r.j};
 assert.equal(await V.verificaClub('sudoku',dato,{...p,a:r.t,w:r.t+300}),null);
 assert.match(String(await V.verificaClub('sudoku',dato,{...p,a:r.t,w:r.t*3})),/velocidad del juego/);
 assert.match(String(await V.verificaClub('sudoku',dato,{...p,w:r.t})),/relojes/);
});
