const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto,TextEncoder};vm.createContext(context);
vm.runInContext(code+';Object.assign(this,{UNO_TOPE,UNO_MANO,UNO_COLORES,mazoUno,esNoMercy,modoUno,sinTilde,esMentiraUno,esComodinUno,colorUno,valorUno,esNumeroUno,roboUno,anunciablesUno,arrUno,salUno,tapaUno,codigosDeUno});',context);
const {reducir,sha256hex,compromiso,mazoUno,jugableUno,roboUno,colorUno,valorUno,esComodinUno,esMentiraUno,
 esNumeroUno,sinTilde,esNoMercy,arrUno,salUno,tapaUno,cartaUno,dhPublica,dhCompartida,cierraSobreUno,abreSobreUno,
 manoUno,auditaUno,cuentaUno,robaHastaUno,anunciablesUno,meToca,progreso,UNO_TOPE,UNO_COLORES}=context;
const nombres=['a','b','c','d','e','f','g','h','i','j'];
const MODOS=['clasico','nomercy','nomercyx','allwild','liar'];

async function sala(nj,semilla,modo){
 const p={juego:'uno',modo,estado:'jugando',cupo:nj,jugadores:{},jugadas:{}};
 const sec={};
 for(let i=0;i<nj;i++){
  const u=nombres[i],sem=(semilla*7919+i*104729)>>>0,sal='sal'+semilla+u;
  sec[u]={sem,sal};
  p.jugadores[u]={nombre:u.toUpperCase(),orden:i,hmazo:await compromiso(sem,sal),hcad:sha256hex(arrUno(sem,sal)),pk:dhPublica(sem,sal)};
 }
 return {p,sec};
}
const mover=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p)};
const azar=s=>{let x=s>>>0||1;return()=>((x=(x*1103515245+12345)>>>0)/4294967296);};
const elige=(k,a)=>a[Math.floor(k()*a.length)];

/* Lo que mandaría la pantalla de `u` en este momento, o null. Mira solo
   su propia mano. */
function robot(est,u,s,k){
 const e=est.espera,modo=est.modo,nm=est.nm;
 const {mano}=manoUno(est,u,s);
 const activos=est.jugadores.map(j=>j.uid).filter(o=>!est.fuera[o]&&!est.elim[o]);
 const pk={};for(const j of est.jugadores)pk[j.uid]=j.pk;
 if(!e)return null;
 if(e.k==='llaves')return e.faltan.includes(u)?{t:'k',uid:u,c:arrUno(s.sem,s.sal)}:null;
 if(e.k==='monedas')return e.faltan.includes(u)?{t:'moneda',uid:u,lado:k()<0.5?'mercy':'nomercy'}:null;
 if(e.k==='sobres'){
  const x=e.faltan.find(x=>x.de===u);
  return x?{t:'sobre',uid:u,a:x.a,enc:cierraSobreUno(dhCompartida(s.sem,s.sal,pk[x.a]),e.id,mano)}:null;
 }
 if(e.k==='resp'&&e.uid===u)return {t:'resp',uid:u,ok:!mano.some(c=>colorUno(c)===e.prev)};
 if(e.k==='revela'&&e.uid===u){
  const sal=salUno(s.sem,s.sal,e.n),c=manoUno(est,u,s).tapadas[e.n];
  return {t:'revela',uid:u,c,s:sal};
 }
 if(e.k==='duda'){
  if(e.de===u)return null;
  if(k()<0.25)return {t:'duda',uid:u};
  return e.sig===u?{t:'cree',uid:u}:null;
 }
 if(e.k==='tapas'){
  if(!e.faltan.includes(u))return null;
  const c=elige(k,mano),sal=salUno(s.sem,s.sal,cuentaUno(est,u).ocultas);
  return {t:'tapa',uid:u,h:tapaUno(c,sal)};
 }
 if(e.k==='destapa'&&e.de===u){
  const q=Object.keys(e.tapas).filter(o=>!e.abiertas[o]&&activos.includes(o));
  return q.length&&k()<0.8?{t:'destapa',uid:u,a:elige(k,q)}:{t:'basta',uid:u};
 }
 if(e.k==='reto'&&e.uid===u)return {t:k()<0.4?'reta':'carga',uid:u};
 if(e.k==='ruleta'&&e.uid===u){
  const col=elige(k,UNO_COLORES);
  return {t:'ruleta',uid:u,col,n:robaHastaUno(est,s,u,mano,c=>colorUno(c)===col)};
 }
 const ctx={modo,tope:est.tope,pena:est.pena};
 const tras=(e.k==='tras'||e.k==='hasta')&&e.uid===u;
 const miTurno=(e.k==='turno'||e.k==='pena')&&e.uid===u;
 if(!tras&&!miTurno)return null;
 if(miTurno&&est.monedas[u]&&est.monedas[u].lado==='mercy'&&!est.monedas[u].usada&&mano.length>=16&&k()<0.7)
  return {t:'merced',uid:u};
 let jugables=mano.filter(c=>!esMentiraUno(c)&&jugableUno(c,ctx));
 if(tras){const ult=cartaUno(modo,s.sem,s.sal,est.mezcla,cuentaUno(est,u).robadas-1);jugables=jugables.includes(ult)?[ult]:[];}
 if(modo==='liar'&&miTurno&&!est.pena){
  const mentiras=mano.filter(esMentiraUno);
  if(mentiras.length&&(k()<0.35||!jugables.length)){
   const c=elige(k,mentiras),opc=anunciablesUno().filter(d=>jugableUno(d,ctx));
   const di=k()<0.6&&opc.includes(sinTilde(c))?sinTilde(c):elige(k,opc);
   const sal=salUno(s.sem,s.sal,cuentaUno(est,u).ocultas);
   return {t:'miente',uid:u,di,col:elige(k,UNO_COLORES),h:tapaUno(c,sal),uno:mano.length===2&&k()<0.8};
  }
 }
 if(!jugables.length){
  if(tras)return {t:'pasa',uid:u};
  if(est.pena)return {t:'carga',uid:u};
  if(nm)return {t:'roba',uid:u,n:robaHastaUno(est,s,u,mano,c=>jugableUno(c,{modo,tope:est.tope}))};
  return {t:'roba',uid:u};
 }
 const c=elige(k,jugables),resto=mano.slice();resto.splice(resto.indexOf(c),1);
 const j={t:'juega',uid:u,c};
 const otros=activos.filter(o=>o!==u);
 if(esComodinUno(c)&&modo!=='allwild')j.col=elige(k,UNO_COLORES);
 if((nm&&valorUno(c)==='7')||c==='NW'||c==='NT2')j.obj=elige(k,otros);
 if(valorUno(c)==='D'||c==='ND'){const col=c==='ND'?j.col:colorUno(c);j.n=resto.filter(x=>colorUno(x)===col).length;}
 if(c==='NF')j.mano=resto;
 if(roboUno(c)&&est.monedas[u]&&est.monedas[u].lado==='nomercy'&&!est.monedas[u].usada&&k()<0.5)j.moneda=true;
 j.uno=k()<0.85;
 return j;
}

async function partida(modo,nj,semilla,trampa){
 const {p,sec}=await sala(nj,semilla,modo);
 const k=azar(semilla*31+7);
 let est=reducir(p),pasos=0;
 const vistos=new Set();
 while(est.fase!=='fin'&&pasos<6000){
  pasos++;
  const orden=nombres.slice(0,nj).sort(()=>k()-0.5);
  let hecho=false;
  /* Alguien pilla al que no dijo UNO, a veces. */
  if(est.olvido&&k()<0.5&&!(est.espera&&est.espera.k==='sobres')){
   const quien=orden.find(o=>o!==est.olvido&&!est.fuera[o]&&!est.elim[o]);
   if(quien){est=mover(p,{t:'pilla',uid:quien,a:est.olvido});continue;}
  }
  for(const u of orden){
   if(est.fuera[u]||est.elim[u])continue;
   let j=robot(est,u,sec[u],k);
   if(!j)continue;
   if(trampa)j=trampa(est,u,j,sec)||j;
   est=mover(p,j);hecho=true;break;
  }
  if(!hecho)throw new Error('atasco '+modo+' '+JSON.stringify(est.espera));
  for(const h of est.hist)vistos.add(h.e);
 }
 assert.equal(est.fase,'fin',modo+' no acaba');
 for(const u of nombres.slice(0,nj))est=mover(p,{t:'s',uid:u,sem:sec[u].sem,sal:sec[u].sal});
 return {p,est,sec,vistos,pasos};
}

test('mazos del tamaño de la caja',()=>{
 assert.equal(mazoUno('clasico').length,108);
 assert.equal(mazoUno('nomercy').length,168);
 assert.equal(mazoUno('nomercyx').length,192);
 assert.equal(mazoUno('allwild').length,112);
 assert.equal(mazoUno('liar').length,112);
});

test('un sobre solo lo abre quien lo recibe',()=>{
 const A={sem:11,sal:'x'},B={sem:22,sal:'y'},C={sem:33,sal:'z'};
 const kab=dhCompartida(A.sem,A.sal,dhPublica(B.sem,B.sal)),kba=dhCompartida(B.sem,B.sal,dhPublica(A.sem,A.sal));
 assert.equal(kab,kba);
 const mano=['R5','N+4','Z+2'];
 const enc=cierraSobreUno(kab,3,mano);
 assert.deepEqual([...abreSobreUno(kba,3,enc,'clasico')],mano);
 const kc=dhCompartida(C.sem,C.sal,dhPublica(A.sem,A.sal));
 assert.equal(abreSobreUno(kc,3,enc,'clasico'),null);
 assert.deepEqual([...abreSobreUno(kab,3,cierraSobreUno(kab,3,[]),'clasico')],[]);
});

for(const modo of MODOS){
 test(`partidas de robots en ${modo}: acaban y pasan la auditoría`,async()=>{
  const vistos=new Set();
  for(let s=1;s<=8;s++){
   const nj=2+(s%5);
   const r=await partida(modo,nj,s*101+modo.length);
   for(const v of r.vistos)vistos.add(v);
   assert.ok(r.est.ganador!==null);
   const f=await auditaUno(r.p,r.est);
   assert.equal(f.length,0,modo+' semilla '+s+': '+JSON.stringify(f));
   /* Cada mano, repasada con su secreto, tiene tantas cartas como dice el reductor. */
   for(const u of Object.keys(r.sec)){
    if(r.est.fuera[u]||r.est.elim[u])continue;
    assert.equal(manoUno(r.est,u,r.sec[u]).mano.length,r.est.cartas[u],modo+' mano de '+u);
   }
  }
  assert.ok(vistos.has('juega')&&vistos.has('gana'));
  if(esNoMercy(modo))assert.ok(vistos.has('cambio'),'sin cambios de mano en '+modo);
  if(modo==='liar')assert.ok(vistos.has('mentira')&&vistos.has('verdad'));
 });
}

test('la auditoría pilla una carta que no estaba en la mano',async()=>{
 let hecha=false;
 const r=await partida('clasico',3,77,(est,u,j,sec)=>{
  if(hecha||j.t!=='juega'||u!=='b'||esComodinUno(j.c))return null;
  const {mano}=manoUno(est,u,sec[u]);
  const falsa=['R','A','V','Z'].map(c=>c+valorUno(j.c)).find(c=>!mano.includes(c)&&jugableUno(c,{modo:'clasico',tope:est.tope}));
  if(!falsa)return null;
  hecha=true;return {...j,c:falsa};
 });
 assert.ok(hecha);
 const f=await auditaUno(r.p,r.est);
 assert.ok(f.some(x=>x.uid==='b'&&x.que==='carta'),JSON.stringify(f));
 assert.ok(!f.some(x=>x.uid!=='b'));
});

test('la auditoría pilla un sobre falso y un robar-hasta corto',async()=>{
 let sobre=false,corto=false;
 const r=await partida('nomercy',4,5,(est,u,j,sec)=>{
  if(j.t==='sobre'&&u==='a'&&!sobre){sobre=true;const pk=est.jugadores.find(x=>x.uid===j.a).pk;
   return {...j,enc:cierraSobreUno(dhCompartida(sec.a.sem,sec.a.sal,pk),est.espera.id,['R1'])};}
  if(j.t==='roba'&&u==='c'&&j.n>1&&!corto){corto=true;return {...j,n:j.n-1};}
  return null;
 });
 const f=await auditaUno(r.p,r.est);
 if(sobre)assert.ok(f.some(x=>x.uid==='a'&&x.que==='sobre'),JSON.stringify(f));
 if(corto)assert.ok(f.some(x=>x.uid==='c'&&x.que==='roba'),JSON.stringify(f));
 assert.ok(sobre||corto);
});

test('una llave falsa no arranca la partida',async()=>{
 const {p,sec}=await sala(2,9,'clasico');
 let est=mover(p,{t:'k',uid:'a',c:'0'.repeat(64)});
 assert.equal(est.etapa,'arranque');
 assert.ok(est.falsas.some(f=>f.uid==='a'));
 est=mover(p,{t:'k',uid:'a',c:arrUno(sec.a.sem,sec.a.sal)});
 est=mover(p,{t:'k',uid:'b',c:arrUno(sec.b.sem,sec.b.sal)});
 assert.equal(est.etapa,'juego');
 assert.equal(est.cartas.a,7);
 assert.ok(meToca(est,est.turno));
 assert.ok(est.debe.length===1);
});

test('en No Mercy quien llega a 25 cartas queda fuera',async()=>{
 const {p,sec}=await sala(3,4,'nomercy');
 let est=reducir(p);
 for(const u of ['a','b','c'])est=mover(p,{t:'k',uid:u,c:arrUno(sec[u].sem,sec[u].sal)});
 const u=est.turno;
 est=mover(p,{t:'roba',uid:u,n:UNO_TOPE-7});
 assert.ok(est.elim[u]);
 assert.equal(est.cartas[u],0);
 assert.notEqual(est.turno,u);
});
