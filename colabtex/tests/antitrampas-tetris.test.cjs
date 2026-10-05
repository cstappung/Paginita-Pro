/* Antitrampas de Tetris Club: partidas de robot jugadas con el mismo motor
   (TM.grabadora, que es lo que usa game.js) pasan el verificador, y cada
   vía de trampa conocida se rechaza. Ver docs/antitrampas/tetris.md. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const carga=entry=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const VT=carga('src/juegos/solo/verifica/tetris.js');
const TM=require('../../juegos/club/tetris/motor.js');

/* ---------- el robot ----------
   Para cada pieza prueba los cuatro giros y todas las columnas, se queda
   con la que deja el pozo mejor (pesos de El-Tetris) y devuelve la
   primera acción del plan. Se vuelve a planear antes de cada acción, así
   que si la gravedad o una patada cambian algo, corrige. */
function evalua(pozo){
 const W=TM.W,H=TM.H;let lineas=0;const filas=[];
 for(let y=0;y<H;y++){let llena=true;for(let x=0;x<W;x++)if(!pozo[y*W+x]){llena=false;break;}if(llena)lineas++;else filas.push(pozo.slice(y*W,y*W+W));}
 while(filas.length<H)filas.unshift(new Array(W).fill(''));
 const alt=[];let huecos=0;
 for(let x=0;x<W;x++){let h=0,visto=false;for(let y=0;y<H;y++){if(filas[y][x]){if(!visto){h=H-y;visto=true;}}else if(visto)huecos++;}alt.push(h);}
 let total=0,rugoso=0;for(let x=0;x<W;x++){total+=alt[x];if(x)rugoso+=Math.abs(alt[x]-alt[x-1]);}
 return -0.51*total+0.76*lineas-0.36*huecos-0.18*rugoso;
}
function plan(s){
 if(s.fin||!s.p)return null;
 let mejor=null;
 for(let r=0;r<4;r++){
  for(let dx=-6;dx<=6;dx++){
   const f={pozo:s.pozo,p:{...s.p},fin:false,giro:false,resets:0,suelo:0,eventos:[]};
   const pasos=[];let ok=true;
   for(let i=0;i<r;i++){if(TM.rotar(f,1))pasos.push('gira');else{ok=false;break;}}
   if(!ok)continue;
   for(let i=0;i<Math.abs(dx);i++){if(TM.mover(f,Math.sign(dx)))pasos.push(dx<0?'izq':'der');else{ok=false;break;}}
   if(!ok)continue;
   const q=TM.fantasma(f),pozo=s.pozo.slice();
   for(const [x,y] of TM.celdas(q))if(y>=0)pozo[y*TM.W+x]=q.t;
   const v=evalua(pozo);
   if(!mejor||v>mejor.v)mejor={v,pasos:pasos.concat('caer')};
  }
 }
 return mejor&&mejor.pasos;
}
/* Una partida entera. `ritmo`: pasos (de 10 ms) entre una acción y la
   siguiente; `pensar`: pasos que espera al salir cada pieza; `piezas`:
   después de tantas deja de jugar y la gravedad hace el resto; `blando`:
   baja con la flecha en vez de soltar (cada tantas piezas).
   `manos` dice cómo se tocan las teclas (lo que mira la capa anti-bot):
   'humano' varía el ritmo (de 0,6 a 1,8 veces el suyo), las teclas se
   mantienen 40–140 ms y el instante tiembla unos ms; 'metronomo' va
   siempre al mismo paso, con el temblor de `temblor` ms y las teclas
   mantenidas `mantiene` ms; 'script' manda eventos sintéticos (X). */
function juega({modo,cuenta='uidRobot',sal=7,ritmo=8,pensar=20,piezas=Infinity,blando=0,tope=400000,nervios=false,
 manos='humano',temblor=3,mantiene=null,primera=null}){
 const g=TM.grabadora({cuenta,sal,modo});const s=g.s;
 const azar=TM.rng(sal*7919+1),humano=manos==='humano';
 const reg=TM.registroTeclas(0),origen=manos==='script'?'X':'';
 let n=0;
 const pulsa=(id,k)=>{
  const t=k*TM.PASO+(azar()*2-1)*temblor+(n++===0&&primera!==null?primera-k*TM.PASO:0);
  reg.baja(id+n,t,origen);
  reg.sube(id+n,t+(mantiene!==null?mantiene:40+azar()*100));
 };
 const varía=x=>humano?Math.max(1,Math.round(x*(0.6+azar()*1.2))):x;
 let espera=varía(pensar),vista=s.piezas,bl=false;
 for(let k=0;k<tope;k++){
  if(s.piezas!==vista){vista=s.piezas;espera=varía(pensar);bl=false;}
  if(s.piezas<piezas&&--espera<=0){
   const p=plan(s);
   if(p){
    const usaBlando=blando&&s.piezas%blando===0;
    if(p[0]==='caer'&&usaBlando){if(!bl)pulsa('b',k);bl=true;}else{g.pide(p[0]);pulsa(p[0],k);}
   }
   espera=varía(ritmo);
  }else if(nervios&&s.p&&TM.fantasma(s).y-s.p.y>3){g.pide(k%2?'izq':'der');pulsa('n',k);}
  const fin=g.paso(bl);
  if(fin){
   if(modo==='ultra'&&fin.gano)s.tiempo=TM.ULTRA_MS;
   const tiempo=Math.max(1,Math.round(s.tiempo));
   const dato={categoria:'club-tetris-'+modo,puntos:modo==='sprint'?40:s.puntos,tiempo,partida:'p-'+k};
   return {dato,prueba:g.prueba({w:(k+1)*TM.PASO,k:reg.texto()}),fin,s};
  }
 }
 throw new Error('la partida del robot no terminó '+JSON.stringify({p:g.s.piezas,l:g.s.lineas,y:g.s.p&&g.s.p.y,res:g.s.resets,suelo:g.s.suelo}));
}
const ok=async(r,ctx)=>{assert.equal(await VT.verifica(r.dato,r.prueba,ctx),null);assert.equal(await V.verificaClub('tetris',r.dato,r.prueba),null);};
const no=async(dato,prueba,re,ctx)=>{const m=await VT.verifica(dato,prueba,ctx);assert.ok(m,'debía rechazarse');if(re)assert.match(m,re);if(!ctx)assert.ok(await V.verificaClub('tetris',dato,prueba));};
const copia=o=>JSON.parse(JSON.stringify(o));

/* Las partidas se juegan una vez y se reutilizan. */
let sprint,sprintRapido,ultra,maraton,lento;
const partidas=()=>{
 if(sprint)return;
 sprint=juega({modo:'sprint',sal:11});
 sprintRapido=juega({modo:'sprint',sal:12,ritmo:3,pensar:4});
 ultra=juega({modo:'ultra',sal:13,ritmo:6,pensar:10,blando:3});
 maraton=juega({modo:'maraton',sal:14,ritmo:5,pensar:8,piezas:120});
 lento=juega({modo:'maraton',sal:15,ritmo:40,pensar:120,piezas:30,blando:2});
};

test('Tetris: las partidas honestas del robot pasan, lentas y rápidas',async()=>{
 partidas();
 assert.equal(VT.PRUEBA,1);
 assert.ok(sprint.fin.gano&&sprint.s.lineas>=40,'el robot hace las 40 líneas');
 assert.ok(sprintRapido.fin.gano);
 const pps=r=>r.s.piezas/(r.s.tiempo/1000);
 /* Unas 6 PPS, con una acción cada 20–55 ms: lo de los mejores del mundo. */
 assert.ok(pps(sprintRapido)>4,'el rápido va a más de 4 PPS ('+pps(sprintRapido).toFixed(2)+')');
 assert.ok(ultra.fin.gano&&ultra.dato.tiempo===120000&&ultra.dato.puntos>0);
 assert.ok(maraton.s.lineas>20&&!maraton.fin.gano);
 for(const r of [sprint,sprintRapido,ultra,maraton,lento])await ok(r);
 await ok(sprint,{uid:'uidRobot'});
 /* La prueba es compacta: unos pocos caracteres por pieza. */
 const porPieza=maraton.prueba.e.length/maraton.s.piezas;
 assert.ok(porPieza<20,porPieza.toFixed(1)+' caracteres por pieza');
 assert.ok(JSON.stringify(sprint.prueba).length<5000);
});

test('Tetris: rehacer da lo mismo que jugar, al milisegundo',()=>{
 partidas();
 for(const r of [sprint,ultra,maraton,lento]){
  const x=TM.rehace(r.prueba);
  assert.equal(x.error,undefined);
  assert.equal(x.puntos,r.s.puntos);assert.equal(x.lineas,r.s.lineas);assert.equal(x.piezas,r.s.piezas);
  assert.equal(Math.max(1,Math.round(x.tiempo)),r.dato.tiempo);
 }
});

test('Tetris: el remapeo de teclas y el mando no cambian la prueba',()=>{
 /* El mismo plan tecleado con las teclas de siempre y con otras: las
    acciones (y la prueba) son las mismas. */
 const otras={...TM.TECLAS_DEFECTO,izq:['KeyJ'],der:['KeyL'],gira:['KeyI'],caer:['KeyK'],blando:['KeyU']};
 const con=teclas=>{
  const g=TM.grabadora({cuenta:'u',sal:3,modo:'maraton'});
  const m=TM.crearMando(a=>g.pide(a),{teclas});
  const k=a=>teclas[a][0],ev=code=>({code,repeat:false,preventDefault(){}});
  let fin=null;
  for(let n=0;n<4000&&!fin;n++){
   if(n%25===0){const p=plan(g.s);if(p){if(p[0]==='caer'&&g.s.piezas%3===0)m.baja(ev(k('blando')));else{m.baja(ev(k(p[0])));m.sube(ev(k(p[0])));}}}
   if(n%25===12)m.sube(ev(k('blando')));
   /* y de vez en cuando se mantiene la flecha (DAS) */
   if(n%400===100)m.baja(ev(k('der')));if(n%400===160)m.sube(ev(k('der')));
   m.paso(TM.PASO);fin=g.paso(m.blando);
  }
  return g.prueba();
 };
 const a=con(TM.TECLAS_DEFECTO),b=con(otras);
 assert.ok(a.e.length>50);
 assert.deepEqual(a,b);
 /* El mando de consola manda la primera tecla de cada acción. */
 assert.equal(TM.mandoTetris(otras).botones.a,'KeyI');
 assert.equal(TM.mandoTetris(otras).botones.izq,'KeyJ');
});

test('Tetris: un resultado sin prueba, o con una prueba que no es una partida, se rechaza',async()=>{
 const dato={categoria:'club-tetris-sprint',puntos:40,tiempo:9000,partida:'x'};
 assert.match(await V.verificaClub('tetris',dato,null),/sin prueba/);
 await no(dato,{v:1,m:'sprint',u:'yo',a:1,n:900,e:''},/no termina|líneas/);
 await no(dato,{v:1,m:'sprint',u:'yo',a:1,n:900,e:'zzzz'},/no se pueden leer/);
 await no(dato,{v:2},/versión/);
 await no({...dato,categoria:'club-tetris-maraton',puntos:5000},{v:1,m:'maraton',u:'yo',a:1,n:10,e:'C'},/termina/);
});

test('Tetris: puntos inflados, tiempo recortado, modo cambiado',async()=>{
 partidas();
 await no({...maraton.dato,puntos:maraton.dato.puntos+100},maraton.prueba,/puntos/);
 await no({...ultra.dato,puntos:ultra.dato.puntos*2},ultra.prueba,/puntos/);
 await no({...sprint.dato,tiempo:sprint.dato.tiempo-3000},sprint.prueba,/tiempo/);
 await no({...maraton.dato,tiempo:maraton.dato.tiempo-1},maraton.prueba,/tiempo/);
 await no({...maraton.dato,categoria:'club-tetris-ultra'},maraton.prueba,/otro modo/);
 /* Una Maratón que se hace pasar por Sprint: no hizo 40 líneas ganando. */
 const p=copia(lento.prueba);p.m='sprint';
 await no({categoria:'club-tetris-sprint',puntos:40,tiempo:lento.dato.tiempo,partida:'x'},p);
});

test('Tetris: la prueba de otra partida o de otra cuenta no sirve',async()=>{
 partidas();
 await no(sprint.dato,sprintRapido.prueba);
 await no(maraton.dato,lento.prueba);
 /* La prueba de otro, mandada tal cual desde mi cuenta. */
 await no(sprint.dato,sprint.prueba,/otra cuenta/,{uid:'otroUid'});
 /* …y cambiándole la cuenta: cambia la semilla, cambian las piezas. */
 const p=copia(sprint.prueba);p.u='otroUid';
 await no(sprint.dato,p,null,{uid:'otroUid'});
 const q=copia(sprint.prueba);q.a^=1;
 await no(sprint.dato,q);
});

test('Tetris: una prueba tocada a mano se delata',async()=>{
 partidas();
 const e=maraton.prueba.e;
 /* Quitar una jugada, meter una de más, cambiar una letra. */
 const sinUna=copia(maraton.prueba);sinUna.e=e.replace(/C/,'');
 await no(maraton.dato,sinUna);
 const otra=copia(maraton.prueba);otra.e=e.replace(/I/,'II');
 await no(maraton.dato,otra);
 const cambiada=copia(maraton.prueba);const i=e.lastIndexOf('C');cambiada.e=e.slice(0,i)+'H'+e.slice(i+1);
 await no(maraton.dato,cambiada);
 /* Alargar o acortar la partida. */
 const larga=copia(maraton.prueba);larga.n+=500;
 await no(maraton.dato,larga,/después de terminar/);
 const corta=copia(maraton.prueba);corta.n-=1;
 await no(maraton.dato,corta);
 /* Un blando apretado dos veces. */
 const bl=copia(lento.prueba);bl.e=bl.e.replace('B','BB');
 await no(lento.dato,bl,/blando/);
});

test('Tetris: el robot inhumano (o el reloj acelerado) se rechaza',async()=>{
 /* Una acción por paso de 10 ms: un programa. */
 const bot=juega({modo:'sprint',sal:21,ritmo:1,pensar:1,manos:'metronomo'});
 assert.ok(bot.fin.gano);
 await no(bot.dato,bot.prueba);
 /* La misma partida honesta comprimida en el tiempo (como si el juego
    corriera al triple): ya no es la misma partida. */
 const rapida=copia(sprint.prueba);
 rapida.e=rapida.e.replace(/([0-9a-z]+)([IDGACHBS])/g,(m,d,l)=>Math.max(0,Math.floor(parseInt(d,36)/3)).toString(36).replace(/^0$/,'')+l);
 await no({...sprint.dato,tiempo:Math.round(sprint.dato.tiempo/3)},rapida);
 /* Un Sprint declarado por debajo del récord mundial, aunque la partida lo
    diga, no lo hace un humano; y un ritmo de 9 PPS sostenido tampoco. */
 const casi=juega({modo:'sprint',sal:22,ritmo:2,pensar:2,manos:'metronomo'});
 assert.ok(casi.dato.tiempo<12000);
 await no(casi.dato,casi.prueba,/Sprint/);
 /* En Maratón no hay tiempo mínimo: lo frenan las piezas por segundo. */
 const mar=juega({modo:'maraton',sal:23,ritmo:2,pensar:2,piezas:150,manos:'metronomo'});
 await no(mar.dato,mar.prueba,/piezas/);
 /* Moverse de un lado a otro en cada paso, sin ir más rápido con las
    piezas: más jugadas por segundo de las que da una mano. */
 const nervioso=juega({modo:'maraton',sal:24,ritmo:12,pensar:20,piezas:40,nervios:true});
 await no(nervioso.dato,nervioso.prueba,/jugadas en un segundo/);
});

test('Tetris: un reloj del juego frenado a mano se nota contra el del sistema',async()=>{
 partidas();
 const T=sprint.prueba.n*TM.PASO;
 /* Jugado a un cuarto de velocidad: la pared marca cuatro veces más. */
 await no(sprint.dato,{...sprint.prueba,w:T*4},/reloj/);
 /* Un aparato lento (o un cuadro perdido) no basta para rechazar. */
 await ok({...sprint,prueba:{...sprint.prueba,w:Math.round(T*1.8)}});
 await ok({...sprint,prueba:{...sprint.prueba,w:T+14000}});
});

test('Tetris: sospecha() marca lo imposible y deja lo humano',()=>{
 assert.equal(VT.sospecha('club-tetris-sprint',{puntos:40,tiempo:25000}),null);
 assert.equal(VT.sospecha('club-tetris-sprint',{puntos:40,tiempo:13500}),null);
 assert.match(VT.sospecha('club-tetris-sprint',{puntos:40,tiempo:9000}),/récord mundial/);
 assert.match(VT.sospecha('club-tetris-sprint',{puntos:41,tiempo:30000}),/40/);
 assert.equal(VT.sospecha('club-tetris-ultra',{puntos:150000,tiempo:120000}),null);
 assert.equal(VT.sospecha('club-tetris-ultra',{puntos:600000,tiempo:120000}),null);
 assert.match(VT.sospecha('club-tetris-ultra',{puntos:5000000,tiempo:120000}),/cabe/);
 assert.match(VT.sospecha('club-tetris-ultra',{puntos:100,tiempo:300000}),/dos minutos/);
 assert.equal(VT.sospecha('club-tetris-maraton',{puntos:250000,tiempo:900000}),null);
 assert.match(VT.sospecha('club-tetris-maraton',{puntos:99999999,tiempo:60000}),/cabe/);
 /* Lo que el robot hace de verdad tampoco es sospechoso. */
 partidas();
 for(const r of [sprint,ultra,maraton,lento])assert.equal(VT.sospecha(r.dato.categoria,r.dato),null);
});

test('Tetris: la gravedad es la de siempre y el motor de la sala no cambia',()=>{
 for(let n=1;n<=20;n++)assert.equal(TM.gravedad(n),1000*Math.pow(0.8-(n-1)*0.007,n-1));
 assert.equal(TM.gravedad(25),TM.gravedad(20));
 /* La sala sigue con avanza(s, dt) a cuadros sueltos. */
 const s=TM.crear({semilla:5});
 for(let i=0;i<200000&&!s.fin;i+=17)TM.avanza(s,17);
 assert.ok(s.fin&&s.piezas>10);
});

test('Tetris anti-bot: eventos de script, metrónomo y teclas sin mantener',async()=>{
 /* Un script que despacha KeyboardEvent: isTrusted falso y sin mando. */
 const script=juega({modo:'maraton',sal:31,ritmo:10,pensar:25,piezas:30,manos:'script'});
 await no(script.dato,script.prueba,/script/);
 /* Las mismas teclas, marcadas como del mando (con uno conectado): valen. */
 const conMando=copia(script);conMando.prueba.k=conMando.prueba.k.replace(/X/g,'M');
 await ok(conMando);
 /* Un metrónomo perfecto, aunque vaya a ritmo humano (una tecla cada 150 ms). */
 const metro=juega({modo:'maraton',sal:32,ritmo:15,pensar:15,piezas:40,manos:'metronomo',temblor:0});
 await no(metro.dato,metro.prueba,/metrónomo/);
 /* Un metrónomo con algo de temblor es solo una señal: pasa… */
 const suave=juega({modo:'maraton',sal:33,ritmo:15,pensar:15,piezas:40,manos:'metronomo',temblor:15});
 await ok(suave);
 /* …pero con teclas que no se mantienen, son dos: no pasa. */
 const suaveSeco=juega({modo:'maraton',sal:33,ritmo:15,pensar:15,piezas:40,manos:'metronomo',temblor:15,mantiene:2});
 await no(suaveSeco.dato,suaveSeco.prueba,/programa/);
 /* Teclas secas solas (un teclado raro) tampoco rechazan; con una primera
    tecla a los 30 ms de empezar, sí. */
 const seco=juega({modo:'maraton',sal:34,ritmo:10,pensar:25,piezas:40,mantiene:2});
 await ok(seco);
 const secoYa=juega({modo:'maraton',sal:34,ritmo:10,pensar:25,piezas:40,mantiene:2,primera:30});
 await no(secoYa.dato,secoYa.prueba,/reaccionar/);
});

test('Tetris anti-bot: las pulsaciones tienen que estar y poder leerse',async()=>{
 partidas();
 await no(maraton.dato,{...maraton.prueba,k:undefined},/pulsaciones/);
 await no(maraton.dato,{...maraton.prueba,k:'1.2.3'},/pulsaciones/);
 await no(maraton.dato,{...maraton.prueba,k:''},/ninguna pulsación/);
 /* Un humano muy rápido, con su irregularidad, pasa; y el lento que
    piensa cada pieza también. */
 await ok(sprintRapido);await ok(lento);
});
