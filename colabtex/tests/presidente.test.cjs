const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto,TextEncoder,setTimeout};vm.createContext(context);
vm.runInContext(code+';Object.assign(this,{PR_CADENA,barajaPr,mejoresPr,ordenaPr,rangoPr,idSobrePr,barajaPrN});',context);
const {reducir,meToca,progreso,PR_CADENA,cadenaPr,llavePr,llavesPr,barajaPr,mezclaPr,quitaPr,manoPr,sobrePr,secretoPr,
 idSobrePr,mejoresPr,ordenaPr,rangoPr,auditaPresidente,barajaPrN}=context;
const J=x=>JSON.parse(JSON.stringify(x));
const nombres=['a','b','c','d','e','f','g','h','i','j'];

function ficha(p,sec,u,i,semilla){
 const sem=(semilla*7919+i*104729)>>>0,sal='sal'+semilla+u;
 sec[u]={sem,sal,cad:cadenaPr(sem,sal)};
 p.jugadores[u]={nombre:u.toUpperCase(),orden:i,hcad:sec[u].cad[PR_CADENA]};
}
function sala(nj,semilla){
 const p={juego:'presidente',estado:'jugando',cupo:10,jugadores:{},jugadas:{}},sec={};
 for(let i=0;i<nj;i++)ficha(p,sec,nombres[i],i,semilla);
 return {p,sec};
}
const mover=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p)};
const azar=s=>{let x=s>>>0||1;return()=>((x=(x*1103515245+12345)>>>0)/4294967296);};

/* Lo que mandaría la pantalla de `u` ahora, o null. `trampa` cambia
   una decisión para ver que la auditoría la pilla. */
function robot(est,u,s,k,trampa={}){
 if(est.etapa==='arranque')return u==='a'?{t:'inicio',uid:u,q:est.jugadores.map(j=>j.uid)}:null;
 const X=est.R;
 /* Llaves de rondas acabadas que aún no he revelado. */
 const acabadas=est.fase==='fin'&&est.R&&est.R.qui.length===est.R.n?[...est.rondas,est.R]:est.rondas;
 for(const r of acabadas){
  if(!r.orden.includes(u)||(est.llaves[r.rep]||{})[u])continue;
  return {t:'llave',uid:u,i:r.rep,c:s.cad[PR_CADENA-1-(r.rep-est.desde[u])]};
 }
 if(!X||est.fase==='fin')return null;
 const key=llavePr(est,u,X.rep,s.cad);
 if(est.etapa==='reparto'){
  const rp=est.reparto;
  if(rp.uid!==u)return null;
  if(rp.paso==='mezcla'){
   let v=mezclaPr(rp.prev||barajaPr(X.D),key,X.D);
   if(trampa.mezcla===u)v=v.slice(64,128)+v.slice(0,64)+v.slice(128);
   return {t:'mezcla',uid:u,r:X.rep,v,pk:llavesPr(key,X.D).pk};
  }
  return {t:'quita',uid:u,r:X.rep,v:quitaPr(rp.prev,key,X.D,X.n,X.orden.indexOf(u))};
 }
 const {mano,rota}=manoPr(est,u,s.cad);
 assert.ok(!rota,'mano rota de '+u);
 if(est.etapa==='cambio'){
  const c=X.cambios.find(c=>c.de===u&&!c.hecho&&!c.anulado);
  if(!c)return null;
  if(c.tipo==='devuelve'&&!X.cambios.some(x=>x.tipo==='da'&&x.de===c.a&&x.a===u&&x.hecho))return null;
  let cs=c.tipo==='da'?mejoresPr(mano,c.n):ordenaPr(mano).slice(0,c.n);
  if(c.tipo==='da'&&trampa.cambio===u)cs=ordenaPr(mano).slice(0,c.n);
  return {t:'da',uid:u,a:c.a,v:sobrePr(secretoPr(key,X.pk[c.a],X.D),idSobrePr(X.rep,u,c.a),cs)};
 }
 if(est.etapa!=='juego'||est.turno!==u)return null;
 const por={};for(const c of mano)(por[rangoPr(c)]||(por[rangoPr(c)]=[])).push(c);
 const rs=Object.keys(por).map(Number).sort((a,b)=>a-b);
 if(trampa.carta===u&&!trampa.hecha){
  const ajena=[...Array(X.D).keys()].find(c=>!mano.includes(c)&&!X.usadas[c]&&(!est.mesa||(rangoPr(c)>est.mesa.r&&est.mesa.n===1)));
  if(ajena!==undefined){trampa.hecha=true;return {t:'juega',uid:u,c:[ajena]};}
 }
 if(!est.mesa){const r=rs[0];return {t:'juega',uid:u,c:k()<0.5?por[r]:por[r].slice(0,1)};}
 const r=rs.find(r=>r>est.mesa.r&&por[r].length>=est.mesa.n);
 if(r===undefined||k()<0.1)return {t:'pasa',uid:u};
 return {t:'juega',uid:u,c:por[r].slice(0,est.mesa.n)};
}

/* Juega hasta que `hasta(est)` o hasta que nadie tenga nada que hacer. */
function juega(p,sec,est,k,hasta,trampa){
 for(let paso=0;paso<5000;paso++){
  if(hasta(est))return est;
  let j=null;
  for(const x of est.jugadores){if(est.fuera[x.uid]||!sec[x.uid])continue;j=robot(est,x.uid,sec[x.uid],k,trampa);if(j)break;}
  if(!j)return est;
  est=mover(p,j);
  if(est.R&&est.etapa==='juego'&&!(trampa&&trampa.hecha)){
   for(const u of est.R.orden){
    if(est.R.idos[u])continue;
    assert.equal(manoPr(est,u,sec[u].cad).mano.length,est.mano[u],'la cuenta de '+u+' cuadra con su mano');
   }
  }
 }
 throw new Error('no acaba');
}
const rondas=n=>est=>est.rondas.length>=n&&!est.rondas.some(r=>r.orden.some(u=>!(est.llaves[r.rep]||{})[u]));

test('cinco jugadores: el reparto es de verdad, los papeles pasan y el Culo da sus mejores',async()=>{
 const {p,sec}=sala(5,3),k=azar(11);
 let est=reducir(p);
 assert.equal(est.etapa,'arranque');
 est=juega(p,sec,est,k,rondas(4));
 assert.equal(est.rondas.length,4);
 assert.equal(est.fase,'jugando');
 for(const r of est.rondas){
  assert.equal(r.salidos.length,5);
  assert.deepEqual(J(Object.values(r.roles).sort()),['culo','pres','pueblo','vculo','vice']);
 }
 /* Desde la segunda ronda hay cambio de cartas. */
 assert.equal(est.rondas[0].dar.length,0);
 for(const r of est.rondas.slice(1))assert.equal(r.dar.length,4);
 /* Los asientos: Presidente primero, Culo último. */
 const r1=est.rondas[0],r2=est.rondas[1];
 assert.equal(r2.orden[0],r1.salidos[0]);
 assert.equal(r2.orden[4],r1.salidos[4]);
 /* Puntos: 4+3+2+1+0 por ronda. */
 assert.equal(Object.values(est.puntos).reduce((a,b)=>a+b,0),40);
 assert.deepEqual(J(await auditaPresidente(est)),[]);
 assert.ok(progreso(est,'presidente')>=0);
});

test('un nuevo se sienta entre rondas y quien sale se va al acabar la suya',async()=>{
 const {p,sec}=sala(3,5),k=azar(7);
 let est=juega(p,sec,reducir(p),k,e=>e.etapa==='juego');
 assert.equal(est.R.n,3);
 /* Llega uno a media ronda: espera. */
 ficha(p,sec,'d',3,5);
 est=mover(p,{t:'entra',uid:'d'});
 assert.equal(est.R.n,3);
 assert.deepEqual(J(est.esperan),['d']);
 /* 'b' pide salir a media ronda: la acaba. */
 est=mover(p,{t:'sale',uid:'b'});
 assert.ok(est.saliendo.b);
 assert.ok(est.R.orden.includes('b'));
 est=juega(p,sec,est,k,e=>e.rondas.length>=1);
 assert.ok(est.retirado.b);
 assert.ok(!est.R.orden.includes('b'));
 assert.ok(est.R.orden.includes('d'));
 assert.equal(est.R.n,3);
 est=juega(p,sec,est,k,rondas(2));
 /* 'b' vuelve: se sienta en la ronda siguiente, como recién llegado. */
 est=mover(p,{t:'entra',uid:'b'});
 est=juega(p,sec,est,k,e=>!!e.R&&e.R.orden.includes('b'));
 assert.equal(est.R.n,4);
 const r=est.rondas[est.rondas.length-1];
 assert.equal(r.n,3);
 assert.equal(est.R.orden[0],r.salidos[0]);
 assert.equal(est.R.orden[3],r.salidos[2]);
 assert.equal(est.R.orden[2],'b');
 est=juega(p,sec,est,k,rondas(4));
 assert.deepEqual(J(await auditaPresidente(est)),[]);
 assert.ok(est.puntos.b>=0);
});

test('acabar la partida es una votación de la mitad de la mesa',async()=>{
 const {p,sec}=sala(4,9),k=azar(3);
 let est=juega(p,sec,reducir(p),k,rondas(2));
 est=mover(p,{t:'cierra',uid:'a'});
 assert.equal(est.fase,'jugando');
 assert.equal(est.cierreFalta,2);
 est=mover(p,{t:'cierra',uid:'a',no:true});
 est=mover(p,{t:'cierra',uid:'b'});
 assert.deepEqual(J(est.cierre),['b']);
 est=mover(p,{t:'cierra',uid:'c'});
 assert.equal(est.fase,'fin');
 assert.equal(est.motivo,'cierre');
 const max=Math.max(...Object.values(est.puntos));
 const top=Object.keys(est.puntos).filter(u=>est.puntos[u]===max);
 assert.equal(est.ganador,top.length===1?top[0]:'');
 /* Tras el fin, las llaves de la ronda a medias se pueden revelar igual. */
 const antes=Object.keys(p.jugadas).length;
 est=mover(p,{t:'juega',uid:est.turno||'a',c:[0]});
 assert.equal(est.fase,'fin');
 assert.ok(Object.keys(p.jugadas).length===antes+1);
 assert.deepEqual(J(await auditaPresidente(est)),[]);
});

test('la auditoría pilla una mezcla trucada, un cambio tacaño y una carta que no estaba',async()=>{
 for(const [trampa,que] of [[{mezcla:'b'},'mezcla'],[{cambio:'X'},'cambio'],[{carta:'c'},'carta']]){
  const {p,sec}=sala(4,21),k=azar(5);
  let est;
  if(trampa.cambio){
   est=juega(p,sec,reducir(p),k,rondas(1));
   trampa.cambio=est.roles&&Object.keys(est.roles).find(u=>est.roles[u]==='culo');
  }
  if(trampa.carta){
   /* Quien pierde la carta ya no puede acabar la ronda: se vota el fin
      y la ronda a medias se audita igual. */
   est=juega(p,sec,reducir(p),k,e=>!!trampa.hecha,trampa);
   for(const u of ['a','b','c'])est=mover(p,{t:'cierra',uid:u});
   assert.equal(est.fase,'fin');
   est=juega(p,sec,est,k,()=>false,trampa);
  }
  else est=juega(p,sec,est||reducir(p),k,rondas(trampa.cambio?2:1),trampa);
  const f=await auditaPresidente(est);
  const quien=trampa.mezcla||trampa.cambio||trampa.carta;
  assert.ok(f.some(x=>x.uid===quien&&x.que===que),que+': '+JSON.stringify(f));
  assert.ok(f.every(x=>x.uid===quien),'solo el tramposo: '+JSON.stringify(f));
 }
});

test('una llave que no encaja es mentira y no cuenta',()=>{
 const {p,sec}=sala(3,4),k=azar(2);
 let est=juega(p,sec,reducir(p),k,e=>e.rondas.length>=1);
 const r=est.rondas[0].rep;
 est=mover(p,{t:'llave',uid:'a',i:r,c:'0'.repeat(64)});
 assert.ok(est.falsas.some(f=>f.uid==='a'));
 assert.ok(!(est.llaves[r]||{}).a);
 est=mover(p,{t:'llave',uid:'a',i:r,c:sec.a.cad[PR_CADENA-1-(r-est.desde.a)]});
 assert.ok(est.llaves[r].a);
});

test('saltar a un dormido: en el reparto se le retira, en su turno pasa',()=>{
 const {p,sec}=sala(4,8),k=azar(9);
 let est=juega(p,sec,reducir(p),k,e=>e.etapa==='reparto'&&e.reparto.i===1&&e.reparto.paso==='mezcla');
 const dormido=est.reparto.uid,rep=est.rep;
 est=mover(p,{t:'salta',uid:dormido==='a'?'b':'a',a:dormido});
 assert.ok(est.retirado[dormido]);
 assert.equal(est.R.n,3);
 assert.equal(est.rep,rep+1,'la llave gastada no se reutiliza');
 est=juega(p,sec,est,k,e=>e.etapa==='juego'&&!!e.mesa);
 const t=est.turno,otro=est.R.orden.find(u=>u!==t);
 est=mover(p,{t:'salta',uid:otro,a:t});
 assert.notEqual(est.turno,t);
 assert.ok(meToca(est,est.turno));
});

test('si todos se van menos uno, la partida acaba',()=>{
 const {p,sec}=sala(3,6),k=azar(4);
 let est=juega(p,sec,reducir(p),k,e=>e.etapa==='juego');
 est=mover(p,{t:'abandona',uid:'b'});
 assert.equal(est.fase,'jugando');
 est=mover(p,{t:'abandona',uid:'c'});
 assert.equal(est.fase,'fin');
 assert.equal(est.motivo,'abandono');
});

test('con nueve se juega con dos barajas',async()=>{
 const {p,sec}=sala(9,2),k=azar(8);
 let est=juega(p,sec,reducir(p),k,e=>e.etapa==='juego');
 assert.equal(est.R.D,104);
 assert.equal(barajaPrN(9),104);
 assert.equal(Object.values(est.mano).reduce((a,b)=>a+b,0),104);
 const todas=new Set();
 for(const u of est.R.orden)for(const c of manoPr(est,u,sec[u].cad).mano)todas.add(c);
 assert.equal(todas.size,104);
});
