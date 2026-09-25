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

/* Suplentes: quien tiene que aportar a un robo puede no estar (una
   pestaña dormida, un móvil bloqueado). Sin esto la mesa entera se
   quedaba esperando para siempre. */
const aporte=async(sec,u,n)=>({t:'r',uid:u,n,v:await aporteF7(sec[u].sem,sec[u].sal,n)});

test('suplentes: con el ayudante ausente, la carta sale del receptor y un suplente (tres en la mesa)',async()=>{
 const {p,sec}=await sala('normal',3,5);
 let e=reducir(p);
 assert.equal(e.espera.para,'b');
 assert.deepEqual([...e.espera.faltan],['b','c']);assert.deepEqual([...e.espera.suplentes],['a']);
 e=mover(p,await aporte(sec,'b',0));
 assert.equal(e.n,0);
 e=mover(p,await aporte(sec,'a',0));          // c duerme: a hace de suplente
 assert.ok(e.n>=1);assert.equal(e.ultima.n,0);assert.equal(e.ultima.para,'b');
 // el aporte tardío de c no cambia nada: ese robo ya salió
 const antes=JSON.stringify(e.lineas);
 mover(p,await aporte(sec,'c',0));
 assert.equal(JSON.stringify(reducir(p).lineas),antes);
});

test('suplentes: con cuatro o más hace falta un tercero, y los designados ganan si llegan',async()=>{
 const {p,sec}=await sala('normal',4,7);
 let e=reducir(p);
 assert.equal(e.espera.para,'b');assert.deepEqual([...e.espera.suplentes],['d','a']);
 e=mover(p,await aporte(sec,'b',0));
 e=mover(p,await aporte(sec,'d',0));
 assert.equal(e.n,0,'un solo suplente no basta con cuatro');
 e=mover(p,await aporte(sec,'c',0));          // llega el ayudante: salen los designados
 assert.ok(e.n>=1);
 // la misma carta que habría salido sin el suplente
 const {p:q,sec:s2}=await sala('normal',4,7);
 mover(q,await aporte(s2,'b',0));const f=mover(q,await aporte(s2,'c',0));
 assert.equal(f.ultima.id,e.ultima.id);
 // y con el receptor ausente (reparto), salen el ayudante y dos suplentes
 const {p:r,sec:s3}=await sala('venganza',4,9);
 mover(r,await aporte(s3,'c',0));mover(r,await aporte(s3,'d',0));
 assert.equal(reducir(r).n,0);
 const g=mover(r,await aporte(s3,'a',0));
 assert.ok(g.n>=1);assert.equal(g.ultima.para,'b');
});

test('suplentes: dos en la mesa no tienen suplente; quien se fue no cuenta',async()=>{
 const {p,sec}=await sala('normal',2,11);
 let e=reducir(p);
 assert.deepEqual([...e.espera.suplentes],[]);
 const {p:q,sec:s2}=await sala('normal',3,11);
 mover(q,{t:'abandona',uid:'a'});
 e=reducir(q);
 assert.ok(!e.espera.suplentes.includes('a'));
 const n=e.espera.n,para=e.espera.para,otro=para==='b'?'c':'b';
 mover(q,await aporte(s2,para,n));
 e=mover(q,await aporte(s2,'a',n));           // un aporte de quien abandonó no suple
 assert.equal(e.n,n);
 e=mover(q,await aporte(s2,otro,n));
 assert.ok(e.n>n);
});

/* Robots con uno de la mesa dormido para los aportes (sólo mueve en su
   turno) y aportes de suplentes al azar: la partida tiene que acabar,
   el reductor no puede esperar nunca a nadie que no pueda contestar, y
   la auditoría tiene que pasar igual. */
function azar(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
test('fuzz: robos con suplentes, ruido, abandonos y un jugador dormido',async()=>{
 for(let s=1;s<=60;s++){
  const R=azar(s),modo=s%2?'normal':'venganza',nj=2+s%5;
  const {p,sec}=await sala(modo,nj,s);
  const dormido=nj>=3&&s%3===0?nombres[s%nj]:null,abandonos=!dormido&&s%2===0;
  let e=reducir(p),pasos=0;
  while(e.fase==='jugando'){
   assert.ok(++pasos<30000,`semilla ${s}: la partida no termina`);
   const w=e.espera;assert.ok(w,`semilla ${s}: jugando sin espera`);
   const sentado=u=>!e.fuera[u];
   if(w.k==='roba'){
    assert.ok(w.faltan.length&&w.faltan.every(sentado),`semilla ${s}: faltan ${w.faltan}`);
    assert.ok(w.suplentes.every(sentado)&&!w.suplentes.some(u=>w.faltan.includes(u)));
   }
   if(w.k==='decide')assert.equal(e.lineas[w.uid].estado,'activo');
   if(R()<0.05){const u=nombres[Math.floor(R()*nj)],k=Math.floor(R()*4);
    // ruido honrado: fuera de turno o adelantado, pero con el valor de verdad (la auditoría pasa)
    mover(p,k===0?{t:'planta',uid:u}:k===1?{t:'apunta',uid:u,a:'zz',c:1}:k===2?await aporte(sec,u,e.n+1):{t:'pide',uid:u,n:e.n,v:await aporteF7(sec[u].sem,sec[u].sal,e.n)});e=reducir(p);continue;}
   if(abandonos&&R()<0.004){const vivos=nombres.slice(0,nj).filter(sentado);e=mover(p,{t:'abandona',uid:vivos[Math.floor(R()*vivos.length)]});continue;}
   if(w.k==='roba'){
    const cand=w.faltan.concat(R()<0.3?w.suplentes:[]).filter(u=>u!==dormido);
    assert.ok(cand.length||w.suplentes.some(u=>u!==dormido),`semilla ${s}: nadie puede aportar`);
    const u=cand.length?cand[Math.floor(R()*cand.length)]:w.suplentes.find(u=>u!==dormido);
    e=mover(p,await aporte(sec,u,w.n));
   }else if(w.k==='decide'){const u=w.uid;
    e=mover(p,!w.cero&&R()<0.25?{t:'planta',uid:u}:{t:'pide',uid:u,n:e.n,v:await aporteF7(sec[u].sem,sec[u].sal,e.n)});
   }else{const o=w.op;let j;
    if(o.tipo==='a')j={a:o.uids[Math.floor(R()*o.uids.length)]};
    else if(o.tipo==='c'){const ks=Object.keys(o.cartas),u=ks[Math.floor(R()*ks.length)];j={a:u,c:o.cartas[u][Math.floor(R()*o.cartas[u].length)]};}
    else{const [a,b]=Object.keys(o.cartas).sort(()=>R()-.5);j={a,b,c:o.cartas[a][0],d:o.cartas[b][0]};}
    const nn=e.n;e=mover(p,{t:'apunta',uid:w.quien,...j});
    assert.ok(!(JSON.stringify(e.espera)===JSON.stringify(w)&&e.n===nn),`semilla ${s}: apunta válido rechazado`);}
  }
  for(const u of Object.keys(sec))mover(p,{t:'s',uid:u,...sec[u]});
  p.fin={ganador:e.ganador};
  assert.deepEqual([...await auditaFlip7(p,reducir(p))].filter(m=>m.que!=='oculta'),[],`semilla ${s}: auditoría`);
 }
});
