/* Antitrampas de Atasco (docs/antitrampas/atasco.md).

   Las partidas honestas se JUEGAN: el solucionador del juego da la salida
   de cada nivel, se le ponen instantes de una mano (lentos, normales y
   rápidos-pero-humanos) y la prueba se escribe con la misma función que la
   pantalla (motor.codificaPrueba). Esas tienen que pasar el verificador.
   Después, una trampa por cada vía: resultado inventado, estrellas
   infladas, tiempo recortado, progreso editado, niveles que no estaban
   abiertos, pruebas de otro nivel o tocadas, movidas más rápidas que una
   mano y un bot sintético (eventos sintéticos, gestos instantáneos, ritmo
   de metrónomo). Esas tienen que rechazarse. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path');
const carga=(entry)=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const VA=carga('src/juegos/solo/verifica/atasco.js');
const D=path.join(__dirname,'../../juegos/club/atasco');
const M=require(path.join(D,'motor.js')),N=require(path.join(D,'niveles.js'));
const NIVELES=N.pisos.flatMap(p=>p.niveles);
const CAT='club-atasco-estrellas';

/* Un generador con semilla (mulberry32) para los ritmos: las pruebas son
   iguales en cada corrida. */
const rng=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const leidos=NIVELES.map(([t])=>M.lee(t));
const soluciones=leidos.map(n=>M.resuelve(n));
/* Una movida de ida y vuelta que deja todo como estaba (para 2 y 1 ★). */
function idaYVuelta(nivel){
 for(let i=1;i<nivel.vehiculos.length;i++)for(const d of [1,-1])if(M.puede(nivel,nivel.pos,i,d)&&M.puede(nivel,M.aplica(nivel.pos,i,d),i,-d))return[[i,d],[i,-d]];
 throw new Error('sin ida y vuelta');
}
/* El gesto de una mano: un arrastre de 60–460 ms con 2–16 pointermove
   (lo que dio Chromium arrastrando con el ratón), de verdad. */
const azarGesto=rng(99);
const gestoHumano=()=>({d:60+Math.floor(azarGesto()*400),n:2+Math.floor(azarGesto()*15),k:'.',f:true});
/* Juega [vehículo, d] con instantes de `ritmo()` y devuelve la prueba como
   la escribe la pantalla: [vehículo, destino, instante, gesto], más la
   reacción (ms desde que se abrió el nivel hasta la primera). */
function partida(i,movidas,ritmo,inicio=0,{reaccion=600,gesto=gestoHumano}={}){
 const nivel=leidos[i];let pos=nivel.pos.slice(),t=inicio;const jug=[];
 movidas.forEach(([v,d],k)=>{if(k)t+=ritmo();pos=M.aplica(pos,v,d);jug.push([v,pos[v],t,gesto(k)]);});
 return{texto:M.codificaPrueba(nivel,jug,reaccion),ms:Math.max(1,t),movs:movidas.length};
}
/* Todos los niveles (o los primeros `hasta`), como los jugaría alguien. */
function progreso({ritmo,hasta=NIVELES.length,estrellas=()=>3}){
 const n={};let e=0,t=0;
 for(let i=0;i<hasta;i++){
  const sol=soluciones[i],iv=idaYVuelta(leidos[i]),l=M.limites(NIVELES[i][1]);
  const quiero=estrellas(i);let movs=sol;
  if(quiero===2)movs=[...iv,...sol];
  if(quiero===1){movs=[];while(movs.length+sol.length<=l.dos)movs.push(...iv);movs.push(...sol);}
  const p=partida(i,movs,ritmo);n[i]=p.texto;
  assert.equal(M.estrellas(p.movs,NIVELES[i][1]),quiero);
  e+=quiero;t+=p.ms;
 }
 return{n,e,t};
}
const dato=(puntos,tiempo)=>({categoria:CAT,puntos,tiempo,partida:'0f8fad5b-d9cb-469f-a165-70867728950e'});
const ok=async(d,p)=>assert.equal(await V.verificaClub('atasco',d,p),null);
const no=async(d,p,re)=>{const m=await V.verificaClub('atasco',d,p);assert.ok(m,'tenía que rechazarse');if(re)assert.match(m,re);return m;};

test('Atasco: el verificador ya exige la prueba',async()=>{
 assert.equal(VA.PRUEBA,1);
 await no(dato(3,1000),null,/sin prueba/);
});

test('Atasco: los 240 niveles jugados a ritmo normal pasan, y la prueba cabe de sobra',async()=>{
 const r=rng(7),{n,e,t}=progreso({ritmo:()=>400+Math.floor(r()*2600)});
 assert.equal(e,720);
 const p={v:1,n},largo=JSON.stringify(p).length;
 assert.ok(largo<V.PRUEBA_MAX,'cabe en la prueba: '+largo);
 assert.ok(largo<70000,'y con mucho margen: '+largo);
 await ok(dato(720,t),p);
 // El progreso entero (lo que va a la cuenta, que acepta menos de 200 000) también cabe.
 let prog=null;for(const k of Object.keys(n))prog=M.anotaPrueba(M.anota(prog,+k,M.cuentaMovidas(n[k]),1,NIVELES[k][1]).prog,+k,n[k]);
 assert.equal(Object.keys(prog.p).length,240);
 assert.ok(JSON.stringify(prog).length<200000);
});

test('Atasco: lento (hasta un minuto por movida), con 2 y 1 estrellas, también pasa',async()=>{
 const r=rng(11),{n,e,t}=progreso({ritmo:()=>2000+Math.floor(r()*58000),estrellas:i=>1+i%3});
 assert.equal(e,720/3*2);
 const p={v:1,n};
 assert.ok(JSON.stringify(p).length<V.PRUEBA_MAX,'cabe aun con movidas de más y pausas largas');
 await ok(dato(e,Math.min(604800000,t)),p);
});

test('Atasco: rápido pero humano (unas 6 movidas por segundo, algún tirón de 45 ms) pasa',async()=>{
 const r=rng(3);let k=0;
 const {n,e,t}=progreso({ritmo:()=>(++k%7===0?45:150+Math.floor(r()*40))});
 await ok(dato(e,t),{v:1,n});
});

test('Atasco: un piso a medias, y lo deshecho (la primera movida no está en 0)',async()=>{
 const r=rng(5),{n,e,t}=progreso({ritmo:()=>800+Math.floor(r()*900),hasta:23});
 // El nivel 23 se juega deshaciendo: la partida que queda empieza a los 9 s.
 const p=partida(23,soluciones[23],()=>700,9000);n[23]=p.texto;
 await ok(dato(e+3,t+p.ms),{v:1,n});
 assert.equal(M.resumenPruebas({23:p.texto},N.pisos).estrellas,0,'solo, el nivel 24 no estaba abierto');
});

test('Atasco: quien tenía estrellas sin prueba no es castigado, solo no cuentan hasta volver a ganarlas',async()=>{
 // Progreso viejo: los dos primeros pisos ganados, sin una sola prueba.
 let prog={v:1,n:{}};for(let i=0;i<80;i++)prog.n[i]=[3,NIVELES[i][1],5000];
 // Con esta versión gana tres niveles del tercer piso (abierto por lo viejo) y vuelve a ganar el 1.
 const r=rng(9);for(const i of [0,80,81,82]){const p=partida(i,soluciones[i],()=>600+Math.floor(r()*500));prog=M.anotaPrueba(M.anota(prog,i,p.movs,p.ms,NIVELES[i][1]).prog,i,p.texto);}
 assert.equal(M.totales(prog).estrellas,80*3+9,'en el edificio se ve todo');
 const res=M.resumenPruebas(prog.p,N.pisos);
 assert.equal(res.estrellas,3,'a la tabla va solo lo respaldado: el nivel 1 (el 81–83 no estaban abiertos según las pruebas)');
 const n={};for(const k of Object.keys(res.contados))n[k]=prog.p[k];
 await ok(dato(res.estrellas,res.tiempo),{v:1,n});
});

test('Atasco: el progreso guarda el mejor intento de cada nivel y no se pierde al juntar copias',()=>{
 const i=4,o=NIVELES[i][1],sol=soluciones[i],iv=idaYVuelta(leidos[i]);
 const lento3=partida(i,sol,()=>4000).texto,rapido2=partida(i,[...iv,...sol],()=>300).texto,rapido3=partida(i,sol,()=>500).texto;
 const cal=(k,t)=>{const r=M.juegaPrueba(leidos[k],NIVELES[k][1],t);return r.error?null:[r.estrellas,r.ms];};
 let p=M.anotaPrueba(null,i,lento3,cal);assert.equal(p.p[i],lento3);
 p=M.anotaPrueba(p,i,rapido2,cal);assert.equal(p.p[i],lento3,'más estrellas gana aunque tarde más');
 p=M.anotaPrueba(p,i,rapido3,cal);assert.equal(p.p[i],rapido3,'a igual estrellas, menos tiempo');
 p=M.anotaPrueba(p,i,'A9',cal);assert.equal(p.p[i],rapido3,'una prueba rota no reemplaza a una buena');
 const otra={v:1,n:{[i]:[3,o,1000]},p:{[i]:lento3}};
 assert.equal(M.mezclaProgreso(p,otra,240,cal).p[i],rapido3);
 assert.equal(M.mezclaProgreso(otra,p,240,cal).p[i],rapido3);
 assert.equal(M.mezclaProgreso(otra,{p:{[i]:'B5'}},240,cal).p[i],lento3,'la de la cuenta rota no pisa la buena');
 assert.deepEqual(M.limpiaProgreso({p:{x:'A4',[i]:'no vale',999:'A4',3:5}},240).p,{},'descarta lo que no tiene forma');
});

test('Atasco: vía 1, un resultado inventado o inflado se rechaza',async()=>{
 const r=rng(1),{n,e,t}=progreso({ritmo:()=>600+Math.floor(r()*1000),hasta:40});
 await ok(dato(e,t),{v:1,n});
 await no(dato(720,t),{v:1,n},/no cuadran/);
 await no(dato(e+1,t),{v:1,n},/no cuadran/);
 await no(dato(720,1000),{v:1,n:{}},/ningún nivel/);
 await no(dato(720,1000),{v:1},/ningún nivel/);
 await no(dato(720,1000),{n},/otra versión/);
 await no(dato(720,1000),'720',/forma/);
 await no({...dato(3,1000),categoria:'club-atasco-otra'},{v:1,n},/tabla/);
});

test('Atasco: vía 2, progreso editado (estrellas o tiempos que la partida no da)',async()=>{
 const r=rng(2),{n,e,t}=progreso({ritmo:()=>600+Math.floor(r()*1000),hasta:40,estrellas:()=>1});
 await ok(dato(e,t),{v:1,n});
 await no(dato(e*3,t),{v:1,n},/no cuadran/);                    // «3 estrellas» con partidas de 1
 await no(dato(e,t-1000),{v:1,n},/tiempo no cuadra/);           // tiempo recortado
 await no(dato(e,Math.round(t/2)),{v:1,n},/tiempo no cuadra/);
 // Un piso abierto a mano: pruebas del último piso sin las de los anteriores.
 const r6=rng(6),m={};let e6=0,t6=0;for(let i=200;i<205;i++){const p=partida(i,soluciones[i],()=>600+Math.floor(r6()*900));m[i]=p.texto;e6+=3;t6+=p.ms;}
 await no(dato(e6,t6),{v:1,n:m},/no cuadran/);
 await no(dato(e+e6,t+t6),{v:1,n:{...n,...m}},/no cuadran/);
});

test('Atasco: vía 3, pruebas tocadas, de otro nivel o que no sacan al auto',async()=>{
 const r=rng(4),{n,e,t}=progreso({ritmo:()=>700+Math.floor(r()*700),hasta:10});
 const con=(k,v)=>({v:1,n:{...n,[k]:v}});
 await no(dato(e,t),con(3,n[0]),/nivel 4 no se puede rehacer/);           // la partida de otro nivel
 await no(dato(e,t),con(5,n[5].replace(/[A-Z][^A-Z]*$/,'')),/no se puede rehacer/);       // cortada: el rojo no sale
 await no(dato(e,t),con(5,n[5]+'B0.2s.5'),/no se puede rehacer/);              // sigue después de salir
 await no(dato(e,t),con(5,n[5].replace(/~([A-Z])(\d)/,(_,l,d)=>'~'+l+((+d+3)%6))),/no se puede rehacer/); // un destino cambiado
 await no(dato(e,t),con(5,n[5].replace('~','~Z0.2s.5')),/no se puede rehacer/);              // un vehículo que no existe
 await no(dato(e,t),con(5,n[5]+'??'),/no se entiende/);
 await no(dato(e,t),con('abc','g~A4.2s.5'),/no existe/);
 await no(dato(e,t),con(400,'g~A4.2s.5'),/no existe/);
 await no(dato(e,t),con(5,12345),/no se puede rehacer/);
 // Saltarse el tablero: solo el auto rojo a la salida, en un nivel donde no tiene paso.
 await no(dato(e,t),con(5,'g~A4.2s.5'),/imposible/);
});

test('Atasco: vía 4, movidas más rápidas que una mano (reloj acelerado o un bot sin freno)',async()=>{
 // El primer nivel de 11 movidas o más, jugado a ese ritmo; los anteriores, honestos.
 const k=NIVELES.findIndex(x=>x[1]>=11);assert.ok(k>=0);
 const base=progreso({ritmo:()=>1000,hasta:k+1});
 await ok(dato(base.e,base.t),{v:1,n:base.n});
 for(const [ritmo,re] of [[()=>0,/más rápido/],[()=>10,/más rápido/],[()=>39,/más rápido/],[()=>60,/movidas en \d+ ms/],[()=>100,/movidas en \d+ ms/]]){
  const p=partida(k,soluciones[k],ritmo);
  const n={...base.n,[k]:p.texto},tt=base.t-M.juegaPrueba(leidos[k],NIVELES[k][1],base.n[k]).ms+p.ms;
  await no(dato(base.e,tt),{v:1,n},re);
 }
 // Lo mismo en un nivel corto (2 movidas): solo cuenta el mínimo entre dos.
 const p0=partida(0,soluciones[0],()=>5);
 await no(dato(3,p0.ms),{v:1,n:{0:p0.texto}},/más rápido/);
 const p1=partida(0,soluciones[0],()=>40);
 await ok(dato(3,p1.ms),{v:1,n:{0:p1.texto}});
});

test('Atasco: un verificador que no puede leer la prueba rechaza en vez de aceptar',async()=>{
 await no(dato(3,1000),{v:1,n:{0:'A'.repeat(5000)}},/no se puede rehacer/);
 const enorme={v:1,n:{}};for(let i=0;i<240;i++)enorme.n[i]='B0'.repeat(500);
 await no(dato(3,1000),enorme,/grande|no se puede rehacer/);
});

test('Atasco: sospecha() con las filas viejas, sin prueba',()=>{
 assert.equal(VA.sospecha(CAT,{puntos:720,tiempo:3*3600e3}),null,'720 ★ en tres horas: verosímil');
 assert.equal(VA.sospecha(CAT,{puntos:30,tiempo:60e3}),null);
 assert.equal(VA.sospecha(CAT,{puntos:3,tiempo:200}),null);
 assert.match(VA.sospecha(CAT,{puntos:721,tiempo:3*3600e3}),/720/);
 assert.match(VA.sospecha(CAT,{puntos:3000,tiempo:3*3600e3}),/720/);
 assert.match(VA.sospecha(CAT,{puntos:720,tiempo:240}),/estrellas en/,'el progreso editado a mano: 720 ★ con 1 ms por nivel');
 assert.match(VA.sospecha(CAT,{puntos:720,tiempo:200e3}),/estrellas en/);
 assert.match(VA.sospecha(CAT,{puntos:300,tiempo:3000}),/estrellas en/);
 assert.equal(VA.sospecha('club-minas-easy',{puntos:1,tiempo:1}),null,'otra tabla no es suya');
 // La cota es menor que lo que hizo cualquier partida honesta de este archivo.
 const r=rng(8),{e,t}=progreso({ritmo:()=>125+Math.floor(r()*20)});
 assert.equal(VA.sospecha(CAT,{puntos:e,tiempo:t}),null);
});

/* ---------- La capa anti-bot ----------
   Un bot produce partidas válidas (el solucionador está en la página):
   lo que lo delata es cómo mueve. Se prueba en el primer nivel de 15
   movidas o más (para que cuente la regularidad): se arma el progreso
   hasta él con partidas honestas y se cambia solo ese. */
const LARGO=NIVELES.findIndex(x=>x[1]>=15);
const conNivel=(ritmo,opts)=>{
 const base=progreso({ritmo:(r=>()=>700+Math.floor(r()*1500))(rng(12)),hasta:LARGO+1});
 const p=partida(LARGO,soluciones[LARGO],ritmo,0,opts);
 const viejo=M.juegaPrueba(leidos[LARGO],NIVELES[LARGO][1],base.n[LARGO]).ms;
 return{d:dato(base.e,base.t-viejo+p.ms),p:{v:1,n:{...base.n,[LARGO]:p.texto}}};
};
test('Anti-bot: un bot sintético (dispatchEvent, gestos instantáneos, metrónomo) se rechaza',async()=>{
 assert.ok(LARGO>0);
 // Lo que hace un guion con dispatchEvent: isTrusted falso en todo.
 let x=conNivel((r=>()=>700+Math.floor(r()*900))(rng(17)),{gesto:()=>({d:0,n:1,k:'.',f:false})});
 await no(x.d,x.p,/eventos sintéticos/);
 // Una sola movida sintética ya basta (y con teclado, igual).
 x=conNivel((r=>()=>700+Math.floor(r()*900))(rng(13)),{gesto:k=>k===4?{d:90,n:1,k:':',f:false}:gestoHumano()});
 await no(x.d,x.p,/eventos sintéticos/);
 // Eventos de verdad (CDP, xdotool) pero apretar y soltar en el mismo instante.
 x=conNivel((r=>()=>700+Math.floor(r()*900))(rng(14)),{gesto:()=>({d:0,n:1,k:'.',f:true})});
 await no(x.d,x.p,/gestos de menos de 20 ms/);
 // Gestos de mano pero a ritmo de metrónomo: un intervalo fijo de 800 ms.
 x=conNivel(()=>800);
 await no(x.d,x.p,/metrónomo/);
 // Casi parejo (±10 %) con arrastres de un solo pointermove: las dos señales juntas.
 x=conNivel((r=>()=>800+Math.floor(r()*160)-80)(rng(15)),{gesto:()=>({d:90,n:1,k:'.',f:true})});
 await no(x.d,x.p,/parejo/);
 // La primera movida antes de poder ver el nivel.
 x=conNivel((r=>()=>700+Math.floor(r()*900))(rng(16)),{reaccion:40});
 await no(x.d,x.p,/primera movida/);
});
test('Anti-bot: personas de verdad pasan (teclado, mando, muy rápidas, muy parejas sin otra señal)',async()=>{
 const azar=rng(21),log=()=>Math.round(Math.exp(Math.log(450)+0.5*(azar()*2-1)*1.7));   // intervalos ~log-normales
 let x=conNivel(log);await ok(x.d,x.p);
 // Teclado: tomar, flechas, soltar (90–400 ms, 1–4 flechas).
 x=conNivel(log,{gesto:()=>({d:90+Math.floor(azar()*300),n:1+Math.floor(azar()*4),k:':',f:true})});await ok(x.d,x.p);
 // Mando: teclas sintéticas de mando.js con un mando conectado (la pantalla las marca «!» y de verdad).
 x=conNivel(log,{gesto:()=>({d:120+Math.floor(azar()*300),n:1+Math.floor(azar()*4),k:'!',f:true})});await ok(x.d,x.p);
 // Muy rápida pero humana: 150–260 ms entre movidas, flicks de 30–80 ms con 2–4 pointermove, reacción de 300 ms.
 x=conNivel(()=>150+Math.floor(azar()*110),{reaccion:300,gesto:()=>({d:30+Math.floor(azar()*50),n:2+Math.floor(azar()*3),k:'.',f:true})});await ok(x.d,x.p);
 // Un flick suelto de 1 pointermove o de 15 ms no delata a nadie.
 x=conNivel(log,{gesto:k=>k%7===0?{d:15,n:1,k:'.',f:true}:gestoHumano()});await ok(x.d,x.p);
 // Muy parejo (±10 %: una solución sabida, jugada con calma) pero con gestos normales: una sola señal, pasa.
 x=conNivel(()=>900+Math.floor(azar()*180)-90);await ok(x.d,x.p);
 // En un nivel corto la regularidad no se mira: dos movidas pueden ir a cualquier ritmo humano.
 const p0=partida(0,soluciones[0],()=>500);
 await ok(dato(3,p0.ms),{v:1,n:{0:p0.texto}});
});
