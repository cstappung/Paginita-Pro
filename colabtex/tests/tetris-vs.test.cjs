/* Tetris Club, VS Bots (juegos/club/tetris/vs.js): tú contra tres bots.
   Una partida jugada por un robot con la misma grabadora que usa game.js
   pasa el verificador, se rehace igual (bots incluidos) y cada forma de
   tocarla se rechaza. Ver docs/antitrampas/tetris.md. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const carga=entry=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const VT=carga('src/juegos/solo/verifica/tetris.js');
const D=carga('src/juegos/solo/club-datos.js');
const TM=require('../../juegos/club/tetris/motor.js');
const TV=require('../../juegos/club/tetris/vs.js');

/* El robot que hace de persona: piensa cada pieza con la cabeza de los
   bots difíciles (TV.decide) y la juega con g.pide, como el teclado, a su
   propio ritmo, anotando pulsaciones con temblor y teclas mantenidas. */
function juega({dif='facil',cuenta='uidRobot',sal=7,ritmo=6,pensar=14,tope=200000}){
 const g=TV.grabadora({cuenta,sal,dif});const s=g.s;
 const cabeza=TV.crearBot('dificil',sal^0x55),azar=TM.rng(sal*7919+1);
 const reg=TM.registroTeclas(0);let n=0;
 const pulsa=(a,k)=>{const t=k*TM.PASO+(azar()*2-1)*3;reg.baja(a+(++n),t,'');reg.sube(a+n,t+40+azar()*100);};
 const varía=x=>Math.max(1,Math.round(x*(0.6+azar()*1.2)));
 let vista=-1,plan=null,espera=0,guardo=false,ultimo='';
 for(let k=0;k<tope;k++){
  if(!s.fin&&s.p&&s.piezas!==vista){vista=s.piezas;plan=TV.decide(cabeza,s);guardo=false;espera=varía(pensar);ultimo='';}
  if(!s.fin&&s.p&&plan&&--espera<=0){
   let a='caer';
   if(plan.g&&!guardo){a='guarda';guardo=true;}
   else if(s.p.r!==plan.r)a=((plan.r-s.p.r+4)%4)===3?'contragira':'gira';
   else if(s.p.x!==plan.x)a=plan.x<s.p.x?'izq':'der';
   /* Lo que no se pudo hacer (una patada, la gravedad) se deja: a soltar. */
   const firma=a+s.p.r+':'+s.p.x+':'+s.p.y;
   if(firma===ultimo)a='caer';
   ultimo=firma;
   g.pide(a);pulsa(a,k);espera=varía(ritmo);
  }
  const fin=g.paso(false);
  if(fin){
   const tiempo=Math.max(1,Math.round(s.tiempo));
   const dato={categoria:'club-tetris-bots-'+dif,puntos:3,tiempo,partida:'p-'+k};
   return {dato,prueba:g.prueba({w:(k+1)*TM.PASO,k:reg.texto()}),fin,g};
  }
 }
 throw new Error('la partida no terminó');
}
const copia=o=>JSON.parse(JSON.stringify(o));
const no=async(dato,prueba,re,ctx)=>{const m=await VT.verifica(dato,prueba,ctx);assert.ok(m,'debía rechazarse');if(re)assert.match(m,re);};

let gana,pierde;
const partidas=()=>{
 if(gana)return;
 for(let sal=21;sal<40&&!gana;sal++){const r=juega({dif:'facil',sal});if(r.fin.gano)gana=r;}
 for(let sal=41;sal<60&&!pierde;sal++){const r=juega({dif:'dificil',sal,ritmo:14,pensar:40});if(!r.fin.gano)pierde=r;}
};

test('VS Bots: una partida ganada en Fácil pasa el verificador y se rehace igual',async()=>{
 partidas();
 assert.ok(gana,'el robot debía ganarle a los bots fáciles alguna vez');
 assert.equal(TV.derrotados(gana.g.m),3);
 assert.equal(await VT.verifica(gana.dato,gana.prueba,{uid:'uidRobot'}),null);
 assert.equal(await V.verificaClub('tetris',gana.dato,gana.prueba),null);
 const a=TV.rehace(gana.prueba),b=TV.rehace(copia(gana.prueba));
 assert.equal(a.error,undefined);
 assert.deepEqual({t:a.tiempo,p:a.pasos,l:a.lineas,d:a.derrotados},{t:b.tiempo,p:b.pasos,l:b.lineas,d:b.derrotados});
 assert.equal(Math.max(1,Math.round(a.tiempo)),gana.dato.tiempo);
 assert.ok(D.resultadoClub('tetris',gana.dato),'la página acepta el resultado');
});

test('VS Bots: lo que no cuadra se rechaza',async()=>{
 partidas();
 const {dato,prueba}=gana;
 await no({...dato,tiempo:dato.tiempo-1000},prueba,/tiempo/);
 await no({...dato,puntos:4},prueba,/puntos/);
 await no({...dato,categoria:'club-tetris-bots-dificil'},prueba,/otra dificultad/);
 await no({...dato,categoria:'club-tetris-sprint',puntos:40},prueba,/otro modo|termina|líneas/);
 await no(dato,{...copia(prueba),d:'dificil'},/dificultad/);
 await no(dato,prueba,/otra cuenta/,{uid:'otraCuenta'});
 /* Otra sal: otras piezas y otros bots, la partida ya no es la misma. */
 await no(dato,{...copia(prueba),a:prueba.a+1});
 /* Cortarla antes del final: no termina. */
 await no(dato,{...copia(prueba),n:prueba.n-50},/termina|jugada/);
 /* Un script que despacha teclas. */
 await no(dato,{...copia(prueba),k:prueba.k.split(',').map(x=>x+'X').join(',')},/script/);
 assert.equal(D.resultadoClub('tetris',{...dato,puntos:2}),null);
});

test('VS Bots: perder no da récord',async()=>{
 partidas();
 assert.ok(pierde,'el robot lento debía perder contra los difíciles');
 assert.ok(TV.derrotados(pierde.g.m)<3||pierde.g.s.fin);
 await no({...pierde.dato,categoria:'club-tetris-bots-dificil'},pierde.prueba,/tres bots/);
});

test('VS Bots: filas guardadas sin prueba',()=>{
 assert.equal(VT.sospecha('club-tetris-bots-medio',{puntos:3,tiempo:240000}),null);
 assert.match(VT.sospecha('club-tetris-bots-dificil',{puntos:3,tiempo:5000}),/no se puede/);
 assert.match(VT.sospecha('club-tetris-bots-facil',{puntos:9,tiempo:90000}),/3 puntos/);
 assert.equal(V.juegoDeCategoria('club-tetris-bots-facil'),'tetris');
});

test('VS Bots: el nivel sube solo con el reloj, y los demás modos no cambian',()=>{
 const a=TM.crear({semilla:5,soloTiempo:true,subeCada:30000}),b=TM.crear({semilla:5});
 a.lineas=b.lineas=35;
 TM.avanza(a,10);TM.avanza(b,10);
 // avanza solo recalcula por tiempo; subir por líneas pasa al fijar: se fuerza con una pieza
 while(!a.fin&&a.piezas<1)TM.caer(a);
 while(!b.fin&&b.piezas<1)TM.caer(b);
 assert.equal(a.nivel,1);
 assert.equal(b.nivel,4);
 a.tiempo=61000;TM.avanza(a,10);
 assert.equal(a.nivel,3);
});

test('VS Bots: los bots son deterministas y cada dificultad juega a su ritmo',()=>{
 const pps={};
 for(const dif of TV.DIFS){
  const m1=TV.mundo('x',3,dif),m2=TV.mundo('x',3,dif);
  for(let k=0;k<6000;k++){m1.paso();m2.paso();}
  assert.deepEqual(m1.pozos.map(TM.resumen),m2.pozos.map(TM.resumen),dif);
  const vivos=m1.pozos.slice(1);
  pps[dif]=vivos.reduce((a,p)=>a+p.piezas,0)/vivos.length/60;
  /* Cada bot juega su propia partida (otra bolsa). */
  assert.notEqual(TM.resumen(m1.pozos[1]),TM.resumen(m1.pozos[2]));
 }
 assert.ok(pps.facil<pps.medio&&pps.medio<pps.dificil,JSON.stringify(pps));
});
