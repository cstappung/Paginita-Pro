const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto,TextEncoder};vm.createContext(context);vm.runInContext(code+';Object.assign(this,{mazoF7,modoF7,F7_META});',context);
const {reducir,mazoF7,lineaValidaF7,valorLineaF7,aporteF7,compromiso,auditaFlip7,progreso,meToca}=context;
const nombres=['a','b','c','d','e','f'];

async function sala(modo,nj,semilla){
 const p={juego:'flip7',modo,semilla,estado:'jugando',cupo:nj,jugadores:{},jugadas:{}};
 const sec={};
 for(let i=0;i<nj;i++){const u=nombres[i];sec[u]={sem:(semilla*7919+i*104729)>>>0,sal:'sal'+semilla+u};
  p.jugadores[u]={nombre:u.toUpperCase(),orden:i,hmazo:await compromiso(sec[u].sem,sec[u].sal)};}
 return {p,sec};
}
const mover=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p)};

/* Una partida entera jugada por robots: piden por debajo de un umbral,
   eligen al primero que se les ofrece y mandan sus aportes en cuanto
   se los piden — lo mismo que hará la pantalla. */
async function juega(modo,nj,semilla,{trampa}={}){
 const {p,sec}=await sala(modo,nj,semilla);
 let e=reducir(p),pasos=0,mintio=false;
 while(e.fase==='jugando'){
  assert.ok(++pasos<20000,'la partida no termina');
  const w=e.espera;assert.ok(w,'jugando sin nada que esperar');
  if(w.k==='roba'){
   const u=w.faltan[0];let v=await aporteF7(sec[u].sem,sec[u].sal,w.n);
   if(trampa&&u===trampa&&w.n>=3&&!mintio){v=(v+1)>>>0;mintio=true;}
   e=mover(p,{t:'r',uid:u,n:w.n,v});
  }else if(w.k==='decide'){
   const u=w.uid,val=e.valor[u];
   if(!w.cero&&val>=((semilla+pasos)%3===0?15:25))e=mover(p,{t:'planta',uid:u});
   else e=mover(p,{t:'pide',uid:u,n:e.n,v:await aporteF7(sec[u].sem,sec[u].sal,e.n)});
  }else if(w.k==='elige'){
   const o=w.op;
   if(o.tipo==='a')e=mover(p,{t:'apunta',uid:w.quien,a:o.uids[pasos%o.uids.length]});
   else if(o.tipo==='c'){const u=Object.keys(o.cartas)[0];e=mover(p,{t:'apunta',uid:w.quien,a:u,c:o.cartas[u][0]});}
   else{const [a,b]=Object.keys(o.cartas);e=mover(p,{t:'apunta',uid:w.quien,a,b,c:o.cartas[a][0],d:o.cartas[b][0]});}
  }else assert.fail('espera desconocida '+w.k);
 }
 return {p,sec,e};
}

test('mazos: 94 cartas en normal y 108 con venganza',()=>{
 const N=mazoF7('normal'),V=mazoF7('venganza');
 assert.equal(N.length,94);assert.equal(V.length,108);
 assert.equal(N.filter(c=>c.k==='n'&&c.v===12).length,12);
 assert.equal(V.filter(c=>c.k==='n'&&c.v===13).length,13);
 assert.equal(V.filter(c=>c.gafe).length,1);assert.equal(V.filter(c=>c.suerte).length,1);assert.equal(V.filter(c=>c.cero).length,1);
 assert.equal(N.filter(c=>c.k==='a').length,9);assert.equal(V.filter(c=>c.k==='a').length,10);
 assert.ok(N.every((c,i)=>c.i===i));
});

test('filas: repetidos, el 13 de la suerte y los valores',()=>{
 const N=mazoF7('normal'),V=mazoF7('venganza');
 const id=(M,f)=>M.findIndex(f),ids=(M,f)=>M.map((c,i)=>f(c)?i:-1).filter(i=>i>=0);
 const cincos=ids(N,c=>c.k==='n'&&c.v===5);
 assert.equal(lineaValidaF7([cincos[0]],'normal'),true);
 assert.equal(lineaValidaF7(cincos.slice(0,2),'normal'),false);
 const trece=ids(V,c=>c.k==='n'&&c.v===13),suerte=id(V,c=>c.suerte);
 assert.equal(lineaValidaF7([suerte,trece.find(i=>i!==suerte)],'venganza'),true);
 assert.equal(lineaValidaF7(trece.filter(i=>i!==suerte).slice(0,2),'venganza'),false);
 const doble=id(N,c=>c.doble),mas4=id(N,c=>c.k==='m'&&c.v===4);
 assert.equal(valorLineaF7({nums:[cincos[0]],mods:[doble,mas4],estado:'planta'},'normal'),14);
 const mitad=id(V,c=>c.mitad),menos2=id(V,c=>c.k==='m'&&c.v===-2),nueve=id(V,c=>c.k==='n'&&c.v===9),cero=id(V,c=>c.cero);
 assert.equal(valorLineaF7({nums:[nueve],mods:[mitad,menos2],estado:'planta'},'venganza'),2);
 assert.equal(valorLineaF7({nums:[nueve],mods:[menos2,id(V,c=>c.k==='m'&&c.v===-10)],estado:'planta'},'venganza'),0);
 assert.equal(valorLineaF7({nums:[nueve,cero],mods:[],estado:'planta'},'venganza'),0);
 assert.equal(valorLineaF7({nums:[nueve],mods:[],estado:'pasa'},'venganza'),0);
});

test('reparto: el primero después de quien reparte y aportes de dos',async()=>{
 const {p,sec}=await sala('normal',3,5);
 let e=reducir(p);
 assert.equal(e.reparte,'a');assert.equal(e.espera.k,'roba');assert.equal(e.espera.para,'b');
 assert.deepEqual([...e.espera.faltan],['b','c']);
 e=mover(p,{t:'r',uid:'b',n:0,v:await aporteF7(sec.b.sem,sec.b.sal,0)});
 assert.deepEqual([...e.espera.faltan],['c']);
 assert.equal(e.n,0);
 e=mover(p,{t:'r',uid:'c',n:0,v:await aporteF7(sec.c.sem,sec.c.sal,0)});
 assert.ok(e.n>=1);
 assert.ok(e.ultima&&e.ultima.n===0);
 assert.equal(e.monton+e.descarte+Object.values(e.lineas).reduce((s,l)=>s+l.nums.length+l.mods.length+(l.seg!=null?1:0),0)<=94,true);
});

test('fuera de turno no cuenta; el Cero no deja plantarse',async()=>{
 const {p,sec}=await sala('normal',2,9);
 let e=reducir(p);
 while(e.espera.k==='roba'){const u=e.espera.faltan[0];e=mover(p,{t:'r',uid:u,n:e.espera.n,v:await aporteF7(sec[u].sem,sec[u].sal,e.espera.n)});}
 if(e.espera.k==='decide'){
  const otro=e.espera.uid==='a'?'b':'a',antes=JSON.stringify(e.hist);
  e=mover(p,{t:'planta',uid:otro});
  assert.equal(JSON.stringify(e.hist),antes);
  assert.equal(meToca(e,e.espera.uid),true);assert.equal(meToca(e,otro),false);
 }
});

for(const modo of ['normal','venganza'])test(`partidas completas (${modo}) terminan y pasan la auditoría`,async()=>{
 let ganadas=0;
 for(let s=1;s<=30;s++){
  const nj=2+s%5;
  const {p,sec,e}=await juega(modo,nj,s);
  assert.equal(e.fase,'fin');assert.equal(e.motivo,'flip7');
  assert.ok(e.puntos[e.ganador]>=200);
  assert.ok(Object.entries(e.puntos).every(([u,v])=>u===e.ganador||v<e.puntos[e.ganador]));
  assert.equal(e.rondas.reduce((a,r)=>a+r.pts[e.ganador],0),e.puntos[e.ganador]);
  // sin revelar: aún no hay faltas mientras la partida no esté cerrada
  assert.equal((await auditaFlip7(p,e)).length,0);
  p.fin={ganador:e.ganador};
  assert.ok((await auditaFlip7(p,e)).every(m=>m.que==='oculta'));
  delete p.fin;
  for(const u of Object.keys(sec))mover(p,{t:'s',uid:u,...sec[u]});
  const e2=reducir(p);assert.equal(e2.ganador,e.ganador);assert.equal(Object.keys(e2.semillas).length,nj);
  p.fin={ganador:e.ganador};
  assert.deepEqual([...await auditaFlip7(p,e2)],[]);
  assert.equal(progreso(e,'flip7'),0);
  ganadas++;
 }
 assert.equal(ganadas,30);
});

test('un aporte falso sale en la auditoría; una semilla falsa también',async()=>{
 const {p,sec,e}=await juega('normal',3,4,{trampa:'b'});
 for(const u of Object.keys(sec))mover(p,{t:'s',uid:u,...sec[u]});
 p.fin={ganador:e.ganador};
 const m=await auditaFlip7(p,reducir(p));
 assert.deepEqual([...m.map(x=>x.uid+':'+x.que)],['b:carta']);
 const {p:q,sec:s2,e:f}=await juega('venganza',2,8);
 mover(q,{t:'s',uid:'a',sem:s2.a.sem+1,sal:s2.a.sal});mover(q,{t:'s',uid:'b',...s2.b});
 q.fin={ganador:f.ganador};
 assert.deepEqual([...(await auditaFlip7(q,reducir(q))).map(x=>x.uid+':'+x.que)],['a:semilla']);
});

test('abandono: con dos, gana el que queda; con tres, sigue sin el que se fue',async()=>{
 const {p}=await sala('venganza',2,3);
 let e=mover(p,{t:'abandona',uid:'a'});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'b');assert.equal(e.motivo,'abandono');
 const {p:q}=await sala('normal',3,3);
 e=mover(q,{t:'abandona',uid:'b'});
 assert.equal(e.fase,'jugando');assert.equal(e.lineas.b.estado,'fuera');
 assert.ok(!e.espera.faltan.includes('b'));
});

test('progreso sube con los puntos',async()=>{
 const {p,sec}=await sala('normal',2,21);
 let e=reducir(p);assert.equal(progreso(e,'flip7'),0);
 let pasos=0;
 while(e.fase==='jugando'&&e.ronda<3&&pasos++<5000){
  const w=e.espera;
  if(w.k==='roba'){const u=w.faltan[0];e=mover(p,{t:'r',uid:u,n:w.n,v:await aporteF7(sec[u].sem,sec[u].sal,w.n)});}
  else if(w.k==='decide')e=mover(p,e.valor[w.uid]>=20&&!w.cero?{t:'planta',uid:w.uid}:{t:'pide',uid:w.uid,n:e.n,v:await aporteF7(sec[w.uid].sem,sec[w.uid].sal,e.n)});
  else{const o=w.op;e=mover(p,o.tipo==='a'?{t:'apunta',uid:w.quien,a:o.uids[0]}:{t:'apunta',uid:w.quien,a:Object.keys(o.cartas)[0],c:Object.values(o.cartas)[0][0]});}
 }
 if(e.fase==='jugando'&&Math.max(...Object.values(e.puntos))>0)assert.ok(progreso(e,'flip7')>0);
});
