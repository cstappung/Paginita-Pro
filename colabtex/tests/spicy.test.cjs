const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto,TextEncoder,setTimeout};vm.createContext(context);
vm.runInContext(code+';Object.assign(this,{SP_MUNDO,SP_MANO,arrSp,salSp,tapaSp,ocultasSp});',context);
const {reducir,meToca,progreso,compromiso,arrSp,salSp,tapaSp,manoSp,ocultasSp,anunciablesSp,verdadSp,mazoSp,auditaSpicy,sha256hex,SP_MUNDO,SP_MANO}=context;
const J=x=>JSON.parse(JSON.stringify(x));
const nombres=['a','b','c','d','e','f'];

async function sala(nj,semilla){
 const p={juego:'spicy',estado:'jugando',cupo:6,jugadores:{},jugadas:{}},sec={};
 for(let i=0;i<nj;i++){
  const u=nombres[i],sem=(semilla*7919+i*104729)>>>0,sal='sal'+semilla+u;
  sec[u]={sem,sal};
  p.jugadores[u]={nombre:u.toUpperCase(),orden:i,hmazo:await compromiso(sem,sal),hcad:sha256hex(arrSp(sem,sal))};
 }
 return {p,sec};
}
const mover=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p)};
const azar=s=>{let x=s>>>0||1;return()=>((x=(x*1103515245+12345)>>>0)/4294967296);};

/* Lo que haría la pantalla (o un jugador con prisa) de `u`. */
function robot(est,u,s,r,trampa={}){
 if(est.fase==='fin')return est.semillas[u]?null:{t:'s',uid:u,sem:s.sem,sal:s.sal};
 const e=est.espera;
 if(!e)return null;
 if(e.k==='llaves')return e.faltan.includes(u)?{t:'k',uid:u,c:arrSp(s.sem,s.sal)}:null;
 const {mano,tapadas}=manoSp(est,u,s);
 if(e.k==='revela'){
  if(e.uid!==u)return null;
  const c=tapadas[e.n];assert.ok(c,'no encuentro mi carta tapada');
  return {t:'revela',uid:u,c:trampa.revela===u?(c==='CE'?'CN':'CE'):c,s:salSp(s.sem,s.sal,e.n)};
 }
 const top=est.tope;
 if(top&&top.uid!==u&&r()<0.25)return {t:'duda',uid:u,c:top.id,que:r()<0.5?'num':'esp'};
 if(e.k==='ultima')return e.uid!==u&&!e.ok[u]?{t:'acepta',uid:u,c:e.id}:null;
 if(e.k!=='turno'||e.uid!==u)return null;
 const opc=anunciablesSp(top);
 if(!opc.length||r()<0.08)return {t:'pasa',uid:u};
 /* Juega una carta que cumpla si la tiene; si no, miente. */
 const buena=mano.findIndex(c=>opc.some(a=>verdadSp(c,a.num,a.esp,'num')&&verdadSp(c,a.num,a.esp,'esp')));
 const i=buena>=0?buena:Math.floor(r()*mano.length);
 const c=trampa.carta===u?'a1':mano[i];
 const a=buena>=0?opc.find(a=>verdadSp(mano[i],a.num,a.esp,'num')&&verdadSp(mano[i],a.num,a.esp,'esp')):opc[Math.floor(r()*opc.length)];
 const n=ocultasSp(est,u);
 return {t:'juega',uid:u,h:tapaSp(c,salSp(s.sem,s.sal,n)),num:a.num,esp:a.esp};
}
async function partida(nj,semilla,trampa={}){
 const {p,sec}=await sala(nj,semilla),r=azar(semilla);
 let est=reducir(p),vueltas=0;
 while(vueltas++<6000){
  let hizo=false;
  for(const u of Object.keys(sec)){
   const j=robot(est,u,sec[u],r,trampa);
   if(!j)continue;
   const antes=Object.keys(p.jugadas).length;
   est=mover(p,j);hizo=true;
   if(j.t==='revela'&&trampa.revela===u)return {est,p,atascada:true};
   assert.ok(Object.keys(p.jugadas).length>antes);
  }
  if(est.fase==='fin'&&Object.keys(sec).every(u=>est.semillas[u]))break;
  assert.ok(hizo,'mesa atascada: '+JSON.stringify(est.espera));
 }
 return {est,p};
}

test('mazo y anuncios',()=>{
 assert.equal(mazoSp().length,100);
 assert.equal(anunciablesSp(null).length,9);
 assert.deepEqual(J(anunciablesSp({num:10,esp:'w'}).map(a=>a.num)),[1,2,3]);
 assert.equal(anunciablesSp({num:7,esp:'a'}).length,3);
 assert.ok(verdadSp('CN',4,'a','num')&&!verdadSp('CN',4,'a','esp'));
 assert.ok(verdadSp('CE',4,'a','esp')&&!verdadSp('CE',4,'a','num'));
});

test('partidas de robots acaban y pasan la auditoría',async()=>{
 const motivos={};
 for(let nj=2;nj<=6;nj++)for(let s=1;s<=6;s++){
  const {est,p}=await partida(nj,nj*100+s);
  assert.equal(est.fase,'fin');
  motivos[est.motivo]=(motivos[est.motivo]||0)+1;
  assert.ok(est.robos<=SP_MUNDO[nj]);
  const fallos=await auditaSpicy(p,est);
  assert.deepEqual(J(fallos),[],'auditoría con '+nj+' semilla '+s);
  if(est.ganador){const pt=est.puntos;assert.ok(Object.values(pt).every(v=>v<=pt[est.ganador])||est.motivo==='trofeos');}
 }
 assert.ok(motivos.trofeos>0,'nadie ganó por trofeos: '+JSON.stringify(motivos));
});

test('meToca y progreso',async()=>{
 const {p,sec}=await sala(3,7);
 let est=reducir(p);
 assert.ok(meToca(est,'a'));
 for(const u of 'abc')est=mover(p,{t:'k',uid:u,c:arrSp(sec[u].sem,sec[u].sal)});
 assert.equal(est.etapa,'juego');
 assert.deepEqual(J(Object.values(est.cartas)),[SP_MANO,SP_MANO,SP_MANO]);
 assert.ok(meToca(est,est.turno));
 assert.equal(progreso(est,'spicy'),0);
});

test('una llave falsa no arranca',async()=>{
 const {p,sec}=await sala(2,3);
 let est=mover(p,{t:'k',uid:'a',c:'0'.repeat(64)});
 est=mover(p,{t:'k',uid:'b',c:arrSp(sec.b.sem,sec.b.sal)});
 assert.equal(est.etapa,'arranque');
 assert.equal(est.falsas[0].uid,'a');
});

test('una carta que no estaba en la mano la pilla la auditoría',async()=>{
 let pillada=false;
 for(let s=1;s<=5&&!pillada;s++){
  const {est,p}=await partida(3,900+s,{carta:'b'});
  const f=await auditaSpicy(p,est);
  pillada=f.some(x=>x.uid==='b'&&x.que==='carta');
 }
 assert.ok(pillada);
});

test('destapar otra carta no cuenta',async()=>{
 for(let s=1;s<=20;s++){
  const {est,atascada}=await partida(2,500+s,{revela:'a'});
  if(!atascada)continue;
  assert.equal(est.espera.k,'revela');
  assert.equal(est.falsas.at(-1).uid,'a');
  return;
 }
 assert.fail('no hubo duda contra a');
});

test('abandonar deja la mesa en pie',async()=>{
 const {p,sec}=await sala(3,11);
 let est;for(const u of 'abc')est=mover(p,{t:'k',uid:u,c:arrSp(sec[u].sem,sec[u].sal)});
 const t=est.turno;
 est=mover(p,{t:'abandona',uid:t});
 assert.equal(est.fase,'jugando');
 assert.notEqual(est.turno,t);
 est=mover(p,{t:'abandona',uid:est.turno});
 assert.equal(est.fase,'fin');
 assert.equal(est.motivo,'abandono');
});
