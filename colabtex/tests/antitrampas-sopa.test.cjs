/* Antitrampas de la Sopa de letras (docs/antitrampas/sopa.md): partidas de
   robot jugadas con el motor que pasan, y una trampa de cada vía que no. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const carga=entry=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const S=carga('src/juegos/solo/verifica/sopa.js');
const M=require('../../juegos/club/sopa/motor.js');

/* Un robot que juega como la pantalla: arrastra de un extremo al otro de
   cada palabra (a veces al revés) y apunta [inicio, fin, Δt, dur, mov, f].
   `paso(k)` da los ms que tarda en la palabra k (con ruido, como una
   persona, salvo `exacto`), y `gesto(k)` la forma del arrastre: por
   omisión, el de una mano (150–600 ms, un pointermove por cuadro). */
const ruido=M.mulberry32(42);
const mano=()=>{const dur=150+Math.round(ruido()*450);return [dur,Math.max(3,Math.round(dur/16)),0];};
function juega(sopa,paso,{revés=false,exacto=false,gesto=mano}={}){
 const j=[];let t=0;
 sopa.palabras.forEach((p,k)=>{const dt=Math.round(paso(k)*(exacto?1:0.7+ruido()*0.6));t+=dt;const a=p.celdas[0],b=p.celdas[p.celdas.length-1];j.push(...(revés&&k%2?[b,a]:[a,b]),dt,...gesto(k));});
 return {j,t};
}
const libre=(s,t,d,n)=>({v:1,m:'l',s,t,d,n});
const HOY=M.diaChile(),AHORA={ahora:Date.now()};

test('Sopa: partidas libres honestas pasan (lentas, normales y rápidas pero humanas)',async()=>{
 for(const [d,n] of [['facil',8],['medio',12],['dificil',15]]){
  for(const [s,paso] of [[7,k=>60000+k*1000],[123456,k=>4000+(k%3)*1500],[0xFFFFFFFF,()=>900],[31337,k=>k?520:400]]){
   const o=libre(s,'animales',d,n),sopa=M.sopaDePrueba(o),{j,t}=juega(sopa,paso,{revés:true});
   const dato={categoria:`club-sopa-${d}-${n}`,puntos:M.TAMANOS[n],tiempo:t,partida:'x'};
   assert.equal(await V.verificaClub('sopa',dato,{...o,j}),null,`${d}-${n} semilla ${s}`);
   // El tiempo declarado puede ser algo mayor (el reloj sigue un instante).
   assert.equal(await V.verificaClub('sopa',{...dato,tiempo:t+300},{...o,j}),null);
  }
 }
});

test('Sopa: la diaria de hoy (y la de ayer, por la medianoche) pasan',async()=>{
 for(const f of [HOY,M.diaAnterior(HOY)]){
  const o={v:1,m:'d',f},sopa=M.sopaDiaria(f),{j,t}=juega(sopa,k=>3000+k*200);
  assert.equal(S.verifica({categoria:'club-sopa-racha',puntos:1,tiempo:t,partida:'x'},{...o,j},AHORA),null,f);
 }
 const o={v:1,m:'d',f:HOY},{j,t}=juega(M.sopaDiaria(HOY),()=>2500);
 assert.equal(await V.verificaClub('sopa',{categoria:'club-sopa-racha',puntos:1,tiempo:t,partida:'x'},{...o,j}),null);
});

test('Sopa: cada vía de trampa se rechaza',async()=>{
 const o=libre(99,'paises','medio',12),sopa=M.sopaDePrueba(o),{j,t}=juega(sopa,()=>3000);
 const dato={categoria:'club-sopa-medio-12',puntos:10,tiempo:t,partida:'x'};
 const no=async(d,p,re)=>assert.match(String(await V.verificaClub('sopa',d,p)),re);
 // Club.result a mano, sin prueba.
 await no(dato,null,/sin prueba/);
 // Tiempo recortado.
 await no({...dato,tiempo:t-1000},{...o,j},/menor que el de las jugadas/);
 // La prueba de otra partida (otra semilla, otro tamaño, otra dificultad, la diaria).
 await no(dato,{...o,s:100,j},/ninguna palabra/);
 await no(dato,{...o,d:'facil',j},/otra dificultad/);
 await no({...dato,categoria:'club-sopa-medio-15',puntos:13},{...o,j},/otra dificultad/);
 await no(dato,{v:1,m:'d',f:HOY,j},/otro modo/);
 // Prueba manipulada: falta una palabra, una repetida, una celda inventada, basura.
 await no(dato,{...o,j:j.slice(6)},/todas las palabras/);
 await no(dato,{...o,j:[...j.slice(0,6),...j.slice(0,54)]},/ninguna palabra/);
 const mala=j.slice();mala[0]=(mala[0]+1)%144;await no(dato,{...o,j:mala},/ninguna palabra/);
 await no(dato,{...o,j:'hola'},/no se pueden leer/);
 await no(dato,{...o,j:[...j.slice(0,59),-5]},/no se pueden leer/);
 await no(dato,{...o,v:2,j},/versión/);
 await no(dato,{...o,t:'inventado',j},/qué sopa/);
 // Un script: todas las palabras de una vez, o una ráfaga en medio de una partida lenta.
 const bot=juega(sopa,()=>50);
 await no({...dato,tiempo:bot.t},{...o,j:bot.j},/no es humano/);
 const rafaga=juega(sopa,k=>k>=3&&k<=6?150:8000);
 await no({...dato,tiempo:rafaga.t},{...o,j:rafaga.j},/demasiado rápido/);
 // Un total imposible aunque cada intervalo pase el de la ráfaga.
 const parejo=juega(sopa,()=>400,{exacto:true});
 await no({...dato,tiempo:parejo.t},{...o,j:parejo.j},/no es humano/);
});

test('Sopa: capa anti-bot — eventos sintéticos, pestaña oculta, saltos y metrónomo',async()=>{
 const o=libre(2024,'espacio','dificil',15),sopa=M.sopaDePrueba(o),n=sopa.palabras.length;
 const ok=async(p,msg)=>{const r=juega(sopa,...p);assert.equal(await V.verificaClub('sopa',{categoria:'club-sopa-dificil-15',puntos:n,tiempo:r.t,partida:'x'},{...o,j:r.j}),null,msg);};
 const no=async(p,re)=>{const r=juega(sopa,...p);assert.match(String(await V.verificaClub('sopa',{categoria:'club-sopa-dificil-15',puntos:n,tiempo:r.t,partida:'x'},{...o,j:r.j})),re);};
 // El bot de las tablas: 13 palabras en 4,5 s, de un salto y con dispatchEvent.
 await no([()=>350,{exacto:true,gesto:()=>[0,1,1]}],/sintéticos/);
 // El de 1 ms: con la pestaña oculta el reloj no corre.
 await no([()=>0,{exacto:true,gesto:()=>[2,1,4]}],/oculta/);
 // Eventos de verdad (CDP, xdotool) pero saltando del inicio al fin, a paso humano.
 await no([()=>3000,{gesto:()=>[3,1,0]}],/sin arrastrar/);
 // Metrónomo con la mitad de los arrastres de un salto.
 await no([()=>2000,{exacto:true,gesto:k=>k%2?mano():[5,1,0]}],/metrónomo/);
 // Cada señal débil sola no basta: metrónomo con arrastres de mano, o
 // la mitad de los arrastres bruscos con un ritmo irregular.
 await ok([()=>2000,{exacto:true}],'metrónomo solo');
 await ok([()=>2500,{gesto:k=>k%2?[30,1,0]:mano()}],'la mitad bruscos');
 // Con mando (eventos sintéticos de mando.js con un mando conectado) vale.
 await ok([()=>3500,{gesto:()=>[900,40,2]}],'mando');
 // La primera palabra antes de reaccionar.
 await no([k=>k?3000:60,{exacto:true}],/reaccionar/);
});

test('Sopa: las marcas de bot vistas en las tablas no pasan aunque el gesto parezca de mano',async()=>{
 // 6 palabras en 0,18 s y en 0,93 s, 10 en 2,5 s, 13 en 4,5 s, y la fila de 1 ms.
 for(const [d,n,total] of [['facil',8,180],['facil',8,930],['medio',12,2500],['dificil',15,4500],['medio',12,1]]){
  const o=libre(77,'deportes',d,n),sopa=M.sopaDePrueba(o),k=sopa.palabras.length,r=juega(sopa,()=>total/k,{exacto:true});
  assert.match(String(await V.verificaClub('sopa',{categoria:`club-sopa-${d}-${n}`,puntos:k,tiempo:Math.max(1,r.t),partida:'x'},{...o,j:r.j})),/no es humano|reaccionar|demasiado rápido/,`${k} en ${total} ms`);
  assert.ok(S.sospecha(`club-sopa-${d}-${n}`,{puntos:k,tiempo:Math.max(1,total)}),`sospecha ${k} en ${total}`);
 }
 // Y el más rápido que parece humano (6 palabras en 4 s) pasa.
 const o=libre(78,'deportes','facil',8),sopa=M.sopaDePrueba(o),r=juega(sopa,k=>k?640:800);
 assert.equal(await V.verificaClub('sopa',{categoria:'club-sopa-facil-8',puntos:6,tiempo:r.t,partida:'x'},{...o,j:r.j}),null);
 assert.equal(S.sospecha('club-sopa-facil-8',{puntos:6,tiempo:4000}),null);
});

test('Sopa: la diaria tiene que ser la de hoy y la racha caber desde el lanzamiento',()=>{
 const viejo='2026-10-02',sopa=M.sopaDiaria(viejo),{j,t}=juega(sopa,()=>3000);
 const dato={categoria:'club-sopa-racha',puntos:1,tiempo:t,partida:'x'};
 assert.match(S.verifica(dato,{v:1,m:'d',f:viejo,j},{ahora:Date.parse('2026-10-09T15:00:00Z')}),/diaria de hoy/);
 assert.match(S.verifica(dato,{v:1,m:'d',f:'2026-10-10',j},{ahora:Date.parse('2026-10-09T15:00:00Z')}),/diaria de hoy/);
 // El 2 de octubre (al mediodía en Chile) la racha cabe hasta 2 días.
 const ahora={ahora:Date.parse('2026-10-02T15:00:00Z')};
 assert.equal(S.verifica({...dato,puntos:2},{v:1,m:'d',f:viejo,j},ahora),null);
 assert.match(S.verifica({...dato,puntos:3},{v:1,m:'d',f:viejo,j},ahora),/no cabe/);
 assert.match(S.verifica({...dato,puntos:400},{v:1,m:'d',f:viejo,j},ahora),/no cabe/);
 // Una libre no vale para la racha.
 const o=libre(5,'comidas','medio',12),l=juega(M.sopaDePrueba(o),()=>3000);
 assert.match(S.verifica({...dato,tiempo:l.t},{...o,j:l.j},AHORA),/otro modo/);
});

test('Sopa: sospecha() de filas guardadas sin prueba',()=>{
 assert.equal(S.sospecha('club-sopa-facil-8',{puntos:6,tiempo:9000}),null);
 assert.match(S.sospecha('club-sopa-facil-8',{puntos:6,tiempo:2000}),/6 palabras/);
 assert.equal(S.sospecha('club-sopa-dificil-15',{puntos:13,tiempo:60000}),null);
 assert.match(S.sospecha('club-sopa-dificil-15',{puntos:13,tiempo:5000}),/13 palabras/);
 assert.equal(S.sospecha('club-sopa-racha',{puntos:1,tiempo:40000}),null);
 assert.match(S.sospecha('club-sopa-racha',{puntos:500,tiempo:40000}),/racha de 500/);
 assert.match(S.sospecha('club-sopa-racha',{puntos:1,tiempo:1500}),/diaria/);
 assert.equal(S.PRUEBA,1);
});
