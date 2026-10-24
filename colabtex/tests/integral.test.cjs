/* Integrodle (juegos/club/integral/): el banco de integrales, el motor y
   el verificador antitrampas (docs/antitrampas/integral.md). */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const fs=require('fs'),path=require('path');
const carga=entry=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica/integral.js');
const R=carga('src/juegos/solo/verifica.js');
const C=carga('src/juegos/solo/club-datos.js');
const M=require('../../juegos/club/integral/motor.js');
const D=require('../../juegos/club/integral/datos.js');
const X=M.X;

/* ---------- el banco ---------- */
test('el banco: más de cien integrales, todas con técnica, legibles y bien resueltas',()=>{
 assert.ok(D.BANCO.length>=100,'hay '+D.BANCO.length);
 assert.equal(new Set(D.BANCO.map(q=>q.id)).size,D.BANCO.length,'ids repetidos');
 for(const q of D.BANCO){
  assert.ok(D.TECNICAS[q.t],q.id+' técnica '+q.t);
  assert.ok([1,2,3].includes(q.d),q.id+' dificultad');
  assert.ok(typeof q.p==='string'&&q.p.length,q.id+' sin paso clave');
  for(const s of [q.f,q.F,...q.r,...(q.def?[q.v]:[])])assert.ok(!X.lee(s).error,q.id+' no se lee: '+s);
  const f=X.parsea(q.f),F=X.parsea(q.F);
  const a=X.evalua(X.parsea(q.r[0]),0),b=X.evalua(X.parsea(q.r[1]),0);
  assert.ok(a<b,q.id+' tramo');
  /* F' = f en el tramo (diferencia central). */
  let n=0;
  for(let k=1;k<40;k++){
   const x=a+(b-a)*k/40,h=1e-5*Math.max(1,Math.abs(x));
   const d=(X.evalua(F,x+h)-X.evalua(F,x-h))/(2*h),y=X.evalua(f,x);
   if(!Number.isFinite(d)||!Number.isFinite(y))continue;
   n++;
   assert.ok(Math.abs(d-y)<=1e-4*Math.max(1,Math.abs(y)),`${q.id}: F'(${x.toFixed(3)}) = ${d} y f = ${y}`);
  }
  assert.ok(n>=35,q.id+' casi sin puntos donde comparar');
  if(q.def){
   const v=X.evalua(X.parsea(q.v),0);
   assert.ok(Math.abs(X.evalua(F,b)-X.evalua(F,a)-v)<=1e-8*Math.max(1,Math.abs(v)),q.id+' valor');
   assert.ok(M.revisa(q.id,q.v).ok,q.id+' su valor no se acepta');
  }else assert.ok(M.revisa(q.id,q.F).ok,q.id+' su primitiva no se acepta');
 }
 /* Variedad: todas las técnicas, y no solo cambio de variable. */
 const por={};for(const q of D.BANCO)por[q.t]=(por[q.t]||0)+1;
 for(const t of Object.keys(D.TECNICAS))assert.ok(por[t]>=2,t+' tiene '+(por[t]||0));
});

/* ---------- la corrección ---------- */
test('la corrección: la constante da lo mismo, la forma pedida importa',()=>{
 const ind=D.BANCO.find(q=>!q.def),def=D.BANCO.find(q=>q.def);
 assert.ok(M.revisa(ind.id,`(${ind.F})+7`).ok,'más una constante también vale');
 assert.equal(M.revisa(ind.id,`(${ind.F})+x`).ok,false);
 assert.ok(M.revisa(ind.id,'5').error,'una constante no es primitiva');
 assert.ok(M.revisa(ind.id,'sin(').error,'ilegible');
 assert.ok(M.revisa(def.id,'x').error,'una definida no lleva x');
 assert.ok(M.revisa(def.id,'1.23456').error,'un decimal largo no es exacto');
 const r=M.revisa(def.id,`(${def.v})+1`);
 assert.equal(r.ok,false);assert.equal(r.dir,-1,'el correcto es menor');
 assert.deepEqual(M.pistas(0),{tecnica:false,paso:false});
 assert.deepEqual(M.pistas(3),{tecnica:true,paso:true});
});

/* ---------- el día ---------- */
const masDias=(f,k)=>M.fechaDeNumero(M.numeroIntegral(f)+k);
test('el día: una integral por fecha, sin repetir en toda una vuelta',()=>{
 const N=D.BANCO.length,vistos=new Set();
 for(let k=0;k<N;k++)vistos.add(M.objetivoDelDia(masDias(M.ESTRENO,k)));
 assert.equal(vistos.size,N,'una vuelta recorre todo el banco');
 let f=M.ESTRENO;
 for(let k=0;k<3*N;k++,f=masDias(f,1))assert.notEqual(M.objetivoDelDia(f),M.objetivoDelDia(masDias(f,1)),'dos días seguidos iguales: '+f);
 assert.equal(M.numeroIntegral(M.ESTRENO),1);
 assert.equal(M.diaChile(new Date('2026-10-22T02:00:00Z')),'2026-10-21','medianoche de Chile, no de Greenwich');
});

/* ---------- el robot ---------- */
const ahoraDe=f=>new Date(f+'T18:00:00Z');
/* Los intentos de un día: `fallos` errados (legibles y distintos) y, si no
   pierde, la respuesta. */
function intentos(fecha,fallos,pierde){
 const q=M.ficha(M.objetivoDelDia(fecha)),bien=q.def?q.v:q.F;
 const mal=q.def?['+1','+2','+3','+5','+7','+11'].map(s=>`(${bien})${s}`):['+x','+x^2','+x^3','+sin(x)','+2x','+x^4'].map(s=>`(${bien})${s}`);
 const k=pierde?M.MAX_INTENTOS:Math.min(fallos,M.MAX_INTENTOS-1);
 const i=mal.slice(0,k);
 if(!pierde)i.push(bien);
 return i;
}
const humano=(n,r)=>({t:Array.from({length:n},()=>[Math.round(5000*Math.pow(30,r())),3+Math.floor(r()*25)]),u:0,mc:0});
function historial(desde,dias,semilla,{faltan=0,pierde=0.1,forma=humano}={}){
 let e=M.vacio(),r=M.mulberry32(semilla),f=desde;
 for(let k=0;k<dias;k++,f=masDias(f,1)){
  if(r()<faltan)continue;
  const i=intentos(f,Math.floor(r()*4),r()<pierde),fm=forma&&forma(i.length,r);
  const ms=fm?fm.t.reduce((t,x)=>t+x[0],0):i.length*20000;
  e=M.registra(e,f,i,ms,fm);
 }
 return e;
}
const ultimo=e=>Object.keys(e.hist).sort().pop();
const datoPuntos=e=>{const t=M.total(e);return {categoria:'club-integral-puntos',puntos:t.puntos,tiempo:Math.min(604800000,Math.max(1,t.ms)),partida:'x'};};
const datoRacha=(e,f)=>({categoria:'club-integral-racha',puntos:M.racha(e,f),tiempo:Math.min(604800000,Math.max(1,M.tiempoDia(e,f))),partida:'x'});
const copia=x=>JSON.parse(JSON.stringify(x));

test('el motor: puntos, racha, mezcla y lo que se comparte',()=>{
 const f=M.ESTRENO,q=M.ficha(M.objetivoDelDia(f));
 let e=M.registra(M.vacio(),f,intentos(f,2,false),60000);
 assert.equal(M.total(e).puntos,M.PUNTOS[2]+10*(q.d-1));
 assert.equal(M.racha(e,f),1);assert.equal(M.racha(e,masDias(f,1)),1,'hoy sin jugar no corta la de ayer');
 assert.equal(M.racha(e,masDias(f,2)),0);
 const g=masDias(f,1);e=M.registra(e,g,intentos(g,0,true),60000);
 assert.equal(M.racha(e,g),0,'perder corta la racha');assert.equal(M.total(e).puntos,M.PUNTOS[2]+10*(q.d-1),'perder no suma');
 /* Lo guardado a mano no cuenta: los puntos se rehacen. */
 const t=copia(e);t.hist[f][0]=99999;
 assert.equal(M.total(M.limpia(t)).puntos,M.total(e).puntos);
 assert.deepEqual(M.mezcla(e,e),M.limpia(e));
 assert.match(M.resumen(e,f),/^∫ Integrodle #1 /);
 assert.ok(!M.resumen(e,f).includes(q.F),'el resumen no dice la respuesta');
});

/* ---------- honestos ---------- */
test('Integrodle: un año de juego honesto pasa y su prueba cabe holgada',()=>{
 const e=historial(M.ESTRENO,365,7,{faltan:0.1}),f=ultimo(e),p=M.prueba(e,f);
 const largo=JSON.stringify(p).length;
 assert.ok(largo<200000,'la prueba de un año ocupa '+largo);
 assert.equal(V.verifica(datoPuntos(e),p,ahoraDe(f)),null);
 assert.ok(datoPuntos(e).puntos<=V.maximoPuntos(f));
 assert.equal(V.sospecha('club-integral-puntos',datoPuntos(e),ahoraDe(f)),null);
});

test('la racha: la prueba es solo el día, resuelto',()=>{
 const e=historial(M.ESTRENO,40,3,{pierde:0}),f=ultimo(e);
 assert.equal(M.racha(e,f),40);
 assert.equal(V.verifica(datoRacha(e,f),M.prueba(e,f,true),ahoraDe(f)),null);
 assert.match(V.verifica({...datoRacha(e,f),puntos:41},M.prueba(e,f,true),ahoraDe(f)),/más larga/);
 assert.match(V.verifica(datoRacha(e,f),M.prueba(e,f),ahoraDe(f)),/solo la de ese día/);
});

test('verificaClub: el resultado de hoy pasa por el registro',async()=>{
 const hoy=M.diaChile(new Date());
 const e=historial(hoy,1,11,{pierde:0});
 assert.equal(await R.verificaClub('integral',datoPuntos(e),M.prueba(e,hoy)),null);
 assert.equal(await R.verificaClub('integral',datoRacha(e,hoy),M.prueba(e,hoy,true)),null);
 assert.match(await R.verificaClub('integral',{...datoPuntos(e),puntos:999999},null),/sin prueba/);
});

/* ---------- trampas ---------- */
test('trampas: puntos, días, intentos y tiempos inventados se rechazan',()=>{
 const e=historial(M.ESTRENO,30,5),f=ultimo(e),p=M.prueba(e,f),a=ahoraDe(f),d=datoPuntos(e);
 assert.match(V.verifica({...d,puntos:d.puntos+10},p,a),/puntos declarados/);
 assert.match(V.verifica({...d,tiempo:d.tiempo+1},p,a),/tiempo/);
 /* Un día que no termina, o que sigue después de acertar. */
 let x=copia(p);x.d[0][2]=x.d[0][2].split('\n').slice(0,-1).join('\n')||'x';
 assert.ok(V.verifica(d,x,a));
 x=copia(p);const k=x.d.findIndex(c=>c[2].split('\n').length<6&&!M.revisa(M.objetivoDelDia(M.fechaDeNumero(c[0])),c[2].split('\n').pop()).error);
 x.d[k][2]+='\nx';
 assert.ok(V.verifica(d,x,a));
 /* Un intento repetido. */
 x=copia(p);const j=x.d.findIndex(c=>c[2].split('\n').length>=2);const l=x.d[j][2].split('\n');l[1]=l[0];x.d[j][2]=l.join('\n');
 assert.ok(V.verifica(d,x,a));
 /* Un día del futuro y uno de antes del estreno. */
 assert.match(V.verifica(d,{...p,f:masDias(f,1)},a),/todavía no llega/);
 assert.match(V.verifica(d,{...p,f:'2026-01-01'},a),/antes del estreno/);
 /* Sin forma en lo reciente. */
 x=copia(p);x.d[x.d.length-1]=x.d[x.d.length-1].slice(0,3);
 assert.match(V.verifica(d,x,a),/sin la forma/);
 /* Un script que despacha eventos. */
 x=copia(p);const c=x.d[x.d.length-1];c[4]=3;c[5]=0;
 assert.match(V.verifica(d,x,a),/sintéticas/);
 /* Un bot que escribe al instante. */
 const bot=historial(M.ESTRENO,30,5,{forma:n=>({t:Array.from({length:n},()=>[100,1]),u:0,mc:0})});
 assert.match(V.verifica(datoPuntos(bot),M.prueba(bot,ultimo(bot)),a),/ningún humano/);
 /* Un metrónomo: siempre el mismo tiempo entre intentos. */
 const met=historial(M.ESTRENO,30,5,{pierde:1,forma:n=>({t:Array.from({length:n},()=>[4000,2]),u:0,mc:0})});
 assert.match(V.verifica(datoPuntos(met),M.prueba(met,ultimo(met)),a),/metrónomo/);
});

test('sospecha sin prueba: lo que no cabe en el calendario',()=>{
 const f=masDias(M.ESTRENO,9),a=ahoraDe(f);
 assert.equal(V.maximoPuntos(f),10*M.puntosDe(1,true,3));
 assert.equal(V.sospecha('club-integral-puntos',{puntos:900,tiempo:900000},a),null);
 assert.match(V.sospecha('club-integral-puntos',{puntos:1300,tiempo:900000},a),/más que resolver/);
 assert.equal(V.sospecha('club-integral-racha',{puntos:10,tiempo:9},a),null);
 assert.match(V.sospecha('club-integral-racha',{puntos:11,tiempo:9},a),/racha/);
});

test('las categorías del club y la regla',()=>{
 assert.ok(C.categoriaClub('integral','club-integral-puntos'));
 assert.ok(C.categoriaClub('integral','club-integral-racha'));
 assert.ok(!C.categoriaClub('integral','club-integral-otra'));
 assert.ok(C.esRachaClub('club-integral-racha'));
 const r=(categoria,puntos)=>C.resultadoClub('integral',{categoria,puntos,tiempo:5000,partida:'abc-1'});
 assert.ok(r('club-integral-puntos',350));assert.ok(r('club-integral-racha',12));
 assert.equal(r('club-integral-racha',5000),null);assert.equal(r('club-integral-puntos',2000000),null);
 const reglas=JSON.parse(fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8'));
 const v=reglas.rules.soloRanks.$categoria.$uid;
 const re=new RegExp(v['.validate'].match(/matches\(\/(.+?)\/\)/)[1]);
 for(const c of ['club-integral-racha','club-integral-puntos'])assert.ok(re.test(c),c);
 assert.ok(!re.test('club-integral-otra'));
 assert.match(v.puntos['.validate'],/club-integral-puntos' \? 1000000/);
 assert.match(JSON.stringify(reglas.rules.rachasClub),/electro\|integral/);
});
