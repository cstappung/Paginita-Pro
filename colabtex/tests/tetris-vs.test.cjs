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
function juega({dif='facil',cuenta='uidRobot',sal=7,ritmo=6,pensar=14,tope=200000,apunta=false}){
 const g=TV.grabadora({cuenta,sal,dif});const s=g.s;
 const cabeza=TV.crearBot('dificil',sal^0x55,1),azar=TM.rng(sal*7919+1);
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
  /* Cambia de objetivo de vez en cuando (tecla o clic en un rival). */
  if(apunta&&!s.fin&&k%700===350){const a=k%1400===350?'objetivo':'apunta'+(1+(k/700|0)%3);g.pide(a);pulsa(a,k);}
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
 await no({...dato,categoria:'club-tetris-sprint',puntos:40},prueba,/otro modo|termina|líneas|versión/);
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

test('VS Bots: las pruebas v:1 y v:2 (récords de antes) se rehacen con los bots de entonces',async()=>{
 for(const v of [1,2])for(const dif of ['facil','medio']){
  const {dato,prueba}=require('./fixtures/tetris-vs-v'+v+'.json')[dif];
  assert.equal(prueba.v,v);
  const r=TV.rehace(prueba);
  assert.equal(r.error,undefined,dif);
  assert.equal(r.derrotados,3);
  assert.equal(Math.max(1,Math.round(r.tiempo)),dato.tiempo);
  assert.equal(await VT.verifica(dato,prueba,{uid:'uidRobot'}),null,dif);
  /* La misma prueba leída como v:3 es otra partida (otros bots): no cuadra. */
  assert.ok(await VT.verifica(dato,{...copia(prueba),v:3}));
 }
 /* Los modos de un solo pozo siguen en v:1. */
 assert.match(await VT.verifica({categoria:'club-tetris-sprint',puntos:40,tiempo:9000,partida:'x'},{v:2,m:'sprint',u:'yo',a:1,n:10,e:'C'}),/versión/);
});

test('VS Bots: el objetivo que eliges viaja en la prueba y se rehace igual',async()=>{
 let r=null;
 for(let sal=61;sal<90&&!r;sal++){const x=juega({dif:'facil',sal,apunta:true});if(x.fin.gano)r=x;}
 assert.ok(r,'el robot debía ganar alguna');
 assert.equal(r.prueba.v,TV.PRUEBA_V);
 assert.match(r.prueba.e,/[OPQR]/,'la prueba anota los cambios de objetivo');
 assert.equal(await VT.verifica(r.dato,r.prueba,{uid:'uidRobot'}),null);
 /* Un cambio de objetivo que no cambia nada (apuntar al que ya era) delata la prueba. */
 const e=r.prueba.e, i=e.search(/[PQR]/);
 const repetido=e.slice(0,i+1)+e[i]+e.slice(i+1);
 assert.match(TV.rehace({...copia(r.prueba),e:repetido}).error,/no se puede hacer/);
 /* Y apuntar a otro cambia la partida: deja de cuadrar. */
 const otro=e.slice(0,i)+({P:'Q',Q:'R',R:'P'})[e[i]]+e.slice(i+1);
 const x=TV.rehace({...copia(r.prueba),e:otro});
 assert.ok(x.error||x.tiempo!==TV.rehace(r.prueba).tiempo);
});

test('VS Bots: los bots arman Tetris y atacan, no solo hacen simples',()=>{
 for(const dif of ['medio','dificil'])for(const yo of [1,3]){
  const tipos=[0,0,0,0,0];let atq=0,t=0;
  for(let sal=1;sal<=2;sal++){
   const s=TM.crear({semilla:sal*999,nivel:1,subeCada:30000,soloTiempo:true}),b=TV.crearBot(dif,sal,yo);
   for(let k=0;k<12000&&!s.fin;k++){TV.pasoBot(b,s);TM.avanza(s,10);for(const e of s.eventos)if(e.e==='fija'){tipos[e.n]++;atq+=e.atq;}s.eventos.length=0;s.salida=0;t+=10;}
  }
  assert.ok(tipos[4]>=3,dif+' hace Tetris: '+tipos.join('/'));
  assert.ok(tipos[1]<tipos[2]+tipos[3]+tipos[4]*2,dif+' no vive de simples: '+tipos.join('/'));
  assert.ok(atq/(t/60000)>=8,dif+' manda basura: '+(atq/(t/60000)).toFixed(1)+'/min');
 }
});

test('VS Bots: cada pozo tiene un objetivo vivo, los bots lo cambian y los KO se anotan',()=>{
 const m=TV.mundo('x',11,'medio'),yo=TV.crearBot('medio',99,1);
 assert.equal(m.objetivo[0],1,'empiezas apuntando al primero');
 const vistos=new Set();let cambios=0,golpes=0;
 for(let k=0;k<40000&&m.vivos().length>1;k++){
  if(m.fuera[0]<0)TV.pasoBot(yo,m.pozos[0]);
  m.paso();m.pozos[0].eventos.length=0;
  for(let i=0;i<=3;i++)if(m.fuera[i]<0&&m.vivos().length>1){const o=m.objetivo[i];assert.ok(o!==i&&m.fuera[o]<0,'objetivo vivo');}
  cambios+=m.cambios.length;for(const c of m.cambios)vistos.add(c.de+'>'+c.a);m.cambios.length=0;
  for(const a of m.ataques){assert.notEqual(a.de,a.a);golpes++;}m.ataques.length=0;
 }
 assert.ok(cambios>=6,'los bots cambian de objetivo: '+cambios);
 assert.ok(golpes>=10,'hubo pelea: '+golpes);
 assert.equal(m.ko.reduce((a,b)=>a+b,0),m.verdugo.filter(v=>v>=0).length);
 /* El objetivo de la persona: apuntar a uno vivo cambia, al mismo o a uno caído no. */
 const n=TV.mundo('y',5,'facil');
 assert.equal(TV.actua(n,'apunta1'),false);
 assert.equal(TV.actua(n,'apunta2'),true);
 assert.equal(n.objetivo[0],2);
 assert.equal(TV.actua(n,'objetivo'),true);
 assert.equal(n.objetivo[0],3);
});

/* Una batalla de bots (el pozo 0 lo juega un bot v2 que cambia de objetivo
   cada tanto, como una persona), contando a quién apunta cada uno y por qué. */
function batalla(dif,sal){
 const m=TV.mundo('pers',sal,dif),yo=TV.crearBotV2(dif,sal*31);
 const motivos=[{},{},{},{}];let pasos=0,todos=0;
 for(let k=0;k<60000&&m.vivos().length>1;k++){
  if(m.fuera[0]<0)TV.pasoBotV2(yo,m.pozos[0]);
  if(k%1700===900)TV.actua(m,'apunta'+(1+(k+sal)%3));
  m.paso();m.pozos[0].eventos.length=0;
  for(const c of m.cambios)if(c.motivo)motivos[c.de][c.motivo]=(motivos[c.de][c.motivo]||0)+1;
  m.cambios.length=0;m.ataques.length=0;m.caidas.length=0;m.kos.length=0;
  if(m.fuera.every(f=>f<0)){pasos++;const o=[1,2,3].map(i=>m.objetivo[i]);if(o[0]===o[1]&&o[1]===o[2])todos++;}
 }
 return {m,motivos,pasos,todos};
}
test('VS Bots: cada bot razona distinto (Cazador, Carroñero, Rencoroso) y no se amontonan',()=>{
 assert.deepEqual(TV.PERSONAS.slice(1).map(p=>p.rol),['Cazador','Carroñero','Rencoroso']);
 const suma=[{},{},{},{}];let pasos=0,todos=0;
 for(let sal=1;sal<=6;sal++){
  const r=batalla('medio',sal*101);
  pasos+=r.pasos;todos+=r.todos;
  for(let i=1;i<=3;i++)for(const k in r.motivos[i])suma[i][k]=(suma[i][k]||0)+r.motivos[i][k];
 }
 const top=o=>Object.entries(o).filter(([k])=>k!=='corazonada').sort((a,b)=>b[1]-a[1])[0]?.[0];
 assert.ok(['amenaza','lider'].includes(top(suma[1])),'Píxel caza al fuerte: '+JSON.stringify(suma[1]));
 assert.equal(top(suma[2]),'debil','Turbo remata al débil: '+JSON.stringify(suma[2]));
 assert.ok(['devuelve','rencor'].includes(top(suma[3])),'Glitch se venga: '+JSON.stringify(suma[3]));
 assert.ok(todos/pasos<0.05,'los tres sobre el mismo pozo: '+(100*todos/pasos).toFixed(1)+'%');
});
test('VS Bots: el ánimo se mueve con la partida (estrés, enojo, confianza)',()=>{
 const {m}=batalla('dificil',7);
 const a=[1,2,3].map(i=>m.animo(i));
 for(const x of a)for(const k of ['estres','enojo','confianza'])assert.ok(x[k]>=0&&x[k]<=1000,k);
 /* Glitch se enoja más con los golpes que Píxel (más «sangre»). */
 assert.ok(TV.PERSONAS[3].sangre>TV.PERSONAS[1].sangre);
 const n=TV.mundo('z',3,'medio');
 for(let k=0;k<400;k++)n.paso();
 const antes=n.animo(3).enojo;
 n.objetivo[0]=3;n.pozos[0].salida=4;n.paso();
 assert.ok(n.animo(3).enojo>antes,'un golpe lo enoja');
 assert.ok(n.rencor[3][0]>0,'y lo recuerda');
});
