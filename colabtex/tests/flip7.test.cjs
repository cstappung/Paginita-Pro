const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto,TextEncoder};vm.createContext(context);vm.runInContext(code+';Object.assign(this,{mazoF7,modoF7,F7_META,golpeF7,aplicaGolpeF7});',context);
const {reducir,mazoF7,lineaValidaF7,valorLineaF7,aporteF7,compromiso,auditaFlip7,progreso,meToca,golpeF7,aplicaGolpeF7}=context;
const nombres=['a','b','c','d','e','f','g','h','i','j'];
const MODOS=['normal','venganza','super'];

/* Lo que elige un robot cuando una carta le pide objetivo, para todos
   los tipos de elección: `k` decide cuál de las opciones (un contador o
   un azar). */
function eleccion(o,k){
 const de=(xs,m=0)=>xs[Math.abs(Math.floor(k()*1e6)+m)%xs.length];
 if(o.tipo==='a')return {a:de(o.uids)};
 if(o.tipo==='n')return {a:de(o.uids),v:Math.floor(k()*(o.max+1))};
 if(o.tipo==='p2'){const a=de(o.uids);return {a,b:de(o.uids.filter(x=>x!==a),1)};}
 if(o.tipo==='c'){const ks=Object.keys(o.cartas),u=de(ks);return {a:u,c:de(o.cartas[u])};}
 const [a,b]=Object.keys(o.cartas);return {a,b,c:o.cartas[a][0],d:o.cartas[b][0]};
}
/* El bono del Flip 7 en Super Vengeance: sumárselo o quitárselo a otro. */
const bono=(w,k)=>({t:'bono',uid:w.quien,a:k()<0.5?w.quien:w.uids[Math.floor(k()*w.uids.length)]});
const cuenta=n=>{let i=n;return()=>((i++*0.61803398875)%1);};

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
 let e=reducir(p),pasos=0,mintio=false;const k=cuenta(semilla),vistos=new Set();
 while(e.fase==='jugando'){
  assert.ok(++pasos<20000,'la partida no termina');
  const w=e.espera;assert.ok(w,'jugando sin nada que esperar');
  vistos.add(w.k==='elige'?'elige:'+(mazoF7(modo)[w.id].a||'mod'):w.k);
  if(w.k==='roba'){
   const u=w.faltan[0];let v=await aporteF7(sec[u].sem,sec[u].sal,w.n);
   if(trampa&&u===trampa&&w.n>=3&&!mintio){v=(v+1)>>>0;mintio=true;}
   e=mover(p,{t:'r',uid:u,n:w.n,v});
  }else if(w.k==='decide'){
   const u=w.uid,val=e.valor[u];
   if(!w.cero&&val>=((semilla+pasos)%3===0?15:25))e=mover(p,{t:'planta',uid:u});
   else e=mover(p,{t:'pide',uid:u,n:e.n,v:await aporteF7(sec[u].sem,sec[u].sal,e.n)});
  }else if(w.k==='elige'){
   e=mover(p,{t:'apunta',uid:w.quien,...eleccion(w.op,k)});
  }else if(w.k==='bono'){
   e=mover(p,bono(w,k));
  }else assert.fail('espera desconocida '+w.k);
 }
 return {p,sec,e,vistos};
}

test('mazos: 94 cartas en normal, 108 en Vengeance y 132 en Super Vengeance',()=>{
 const N=mazoF7('normal'),V=mazoF7('venganza'),S=mazoF7('super');
 assert.equal(N.length,94);assert.equal(V.length,108);assert.equal(S.length,132);
 // Super es Vengeance con 24 cartas detrás: los índices de Vengeance no se mueven
 assert.ok(V.every((c,i)=>JSON.stringify(c)===JSON.stringify(S[i])));
 const catorces=S.filter(c=>c.catorce);
 assert.equal(catorces.length,14);
 assert.deepEqual([...catorces.map(c=>c.v)].sort((a,b)=>a-b),[-14,0,14,14,14,14,14,14,14,14,14,14,14,14]);
 const acc=a=>S.filter(c=>c.a===a).length;
 assert.equal(acc('segunda'),3);assert.equal(acc('trueca'),2);assert.equal(acc('mata'),2);assert.equal(acc('comodin'),3);
 assert.ok(S.every((c,i)=>c.i===i));
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

for(const modo of MODOS)test(`partidas completas (${modo}) terminan y pasan la auditoría`,async()=>{
 let ganadas=0;
 for(let s=1;s<=30;s++){
  const nj=2+s%9;
  const {p,sec,e}=await juega(modo,nj,s);
  assert.equal(e.fase,'fin');assert.equal(e.motivo,'flip7');
  assert.ok(e.puntos[e.ganador]>=200);
  assert.ok(Object.entries(e.puntos).every(([u,v])=>u===e.ganador||v<e.puntos[e.ganador]));
  assert.ok(Object.values(e.puntos).every(v=>v>=0),'un total bajo cero');
  // el total es lo que dieron las rondas más lo que le quitaron por fuera (sólo en Super)
  for(const u of Object.keys(sec)){
   const aj=e.rondas.reduce((a,r)=>a+((r.aj||{})[u]||0),0);
   if(modo!=='super')assert.equal(aj,0);
   if(!e.fuera[u])assert.ok(aj<=0);
  }
  for(const u of Object.keys(sec))
   assert.equal(e.rondas.reduce((a,r)=>a+r.pts[u]+((r.aj||{})[u]||0),0),e.puntos[u]);
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
  else if(w.k==='bono')e=mover(p,bono(w,cuenta(pasos)));
  else e=mover(p,{t:'apunta',uid:w.quien,...eleccion(w.op,cuenta(pasos))});
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
  const R=azar(s),modo=MODOS[s%3],nj=2+s%9;
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
   }else if(w.k==='bono'){e=mover(p,bono(w,R));
    assert.ok(!(e.espera&&e.espera.k==='bono'&&e.espera.quien===w.quien),`semilla ${s}: bono válido rechazado`);
   }else{const o=w.op;let j;
    if(o.tipo==='2'){const [a,b]=Object.keys(o.cartas).sort(()=>R()-.5);j={a,b,c:o.cartas[a][0],d:o.cartas[b][0]};}
    else j=eleccion(o,R);
    const nn=e.n;e=mover(p,{t:'apunta',uid:w.quien,...j});
    assert.ok(!(JSON.stringify(e.espera)===JSON.stringify(w)&&e.n===nn),`semilla ${s}: apunta válido rechazado`);}
  }
  for(const u of Object.keys(sec))mover(p,{t:'s',uid:u,...sec[u]});
  p.fin={ganador:e.ganador};
  assert.deepEqual([...await auditaFlip7(p,reducir(p))].filter(m=>m.que!=='oculta'),[],`semilla ${s}: auditoría`);
 }
});

/* Nada puede dejar la mesa sin nadie a quien esperar: en cualquier punto de
   la partida —a mitad de un reparto incluido— alguien se va o lo expulsan por
   votación, y la partida tiene que seguir teniendo una espera que alguien
   sentado pueda cumplir, hasta acabar. */
test('flip7: nadie que se va, por su pie o expulsado, deja la mesa colgada',async()=>{
 for(let s=1;s<=120;s++){
  const modo=MODOS[s%3],nj=2+(s%9);
  const {p,sec}=await sala(modo,nj,s*31);
  let e=reducir(p),pasos=0,cortes=0;
  const corteEn=new Set([5+(s%17),40+(s%23),90+(s%11)]);
  while(e.fase==='jugando'){
   assert.ok(++pasos<20000,'semilla '+s+': la partida no termina');
   const w=e.espera;assert.ok(w,'semilla '+s+': jugando sin nada que esperar');
   const sentados=Object.keys(p.jugadores).filter(u=>!e.fuera[u]);
   /* La espera siempre nombra a alguien que sigue en la mesa. */
   const deQuien=w.k==='roba'?w.faltan:[w.k==='decide'?w.uid:w.quien];
   assert.ok(deQuien.length&&deQuien.every(u=>sentados.includes(u)),'semilla '+s+': espera a quien no está ('+w.k+')');
   if(corteEn.has(pasos)&&sentados.length>1){
    cortes++;
    const vic=deQuien[0];
    if(cortes%2){e=mover(p,{t:'abandona',uid:vic});}
    else{for(const u of sentados)if(u!==vic&&!e.fuera[vic])e=mover(p,{t:'voto',uid:u,contra:vic});
     assert.ok(e.fuera[vic],'semilla '+s+': la votación no expulsa');}
    continue;
   }
   if(w.k==='roba'){const u=w.faltan[0];e=mover(p,{t:'r',uid:u,n:w.n,v:await aporteF7(sec[u].sem,sec[u].sal,w.n)});}
   else if(w.k==='decide'){
    const u=w.uid;
    if(!w.cero&&e.valor[u]>=20)e=mover(p,{t:'planta',uid:u});
    else e=mover(p,{t:'pide',uid:u,n:e.n,v:await aporteF7(sec[u].sem,sec[u].sal,e.n)});
   }else if(w.k==='bono')e=mover(p,bono(w,cuenta(pasos)));
   else e=mover(p,{t:'apunta',uid:w.quien,...eleccion(w.op,cuenta(pasos))});
  }
  assert.equal(e.fase,'fin','semilla '+s);
 }
});

/* Super Vengeance, regla a regla, sobre las funciones puras. */
test('super: los catorce chocan entre sí valgan lo que valgan, y el comodín vale lo que se eligió',()=>{
 const S=mazoF7('super'),ids=f=>S.map((c,i)=>f(c)?i:-1).filter(i=>i>=0);
 const [menos,cero,c14]=[ids(c=>c.catorce&&c.v===-14)[0],ids(c=>c.catorce&&c.v===0)[0],ids(c=>c.catorce&&c.v===14)[0]];
 const nueve=ids(c=>c.k==='n'&&c.v===9)[0],cinco=ids(c=>c.k==='n'&&c.v===5)[0],com=ids(c=>c.a==='comodin')[0];
 assert.equal(lineaValidaF7([menos,nueve],'super'),true);
 assert.equal(lineaValidaF7([menos,cero],'super'),false);
 assert.equal(lineaValidaF7([cero,c14],'super'),false);
 // el comodín: 5 choca con un 5, 14 choca con cualquier catorce, 6 no choca con nada
 assert.equal(lineaValidaF7([cinco,com],'super',{[com]:5}),false);
 assert.equal(lineaValidaF7([menos,com],'super',{[com]:14}),false);
 assert.equal(lineaValidaF7([cinco,com],'super',{[com]:6}),true);
 assert.equal(valorLineaF7({nums:[cinco,com],mods:[],estado:'planta'},'super',{[com]:6}),11);
 // el −14 resta, pero la ronda no baja de cero
 assert.equal(valorLineaF7({nums:[nueve,menos],mods:[],estado:'planta'},'super'),0);
 assert.equal(valorLineaF7({nums:[nueve,c14,menos],mods:[],estado:'planta'},'super'),9);
});

test('super: los negativos pegan a la ronda y, si la ronda no suma, al total',()=>{
 const S=mazoF7('super'),id=f=>S.findIndex(f);
 const nueve=id(c=>c.k==='n'&&c.v===9),mitad=id(c=>c.mitad),m10=id(c=>c.k==='m'&&c.v===-10),m2=id(c=>c.k==='m'&&c.v===-2),cero=id(c=>c.cero);
 // con números: como en Vengeance, y nada al total
 assert.equal(valorLineaF7({nums:[nueve],mods:[mitad,m2],estado:'planta'},'super'),2);
 assert.equal(golpeF7({nums:[nueve],mods:[mitad,m2],estado:'planta'},'super'),null);
 // pasado, con el Cero o sin números: al total
 for(const l of [{nums:[nueve],mods:[m10],estado:'pasa'},{nums:[nueve,cero],mods:[m10],estado:'planta'},{nums:[],mods:[m10],estado:'activo'}]){
  assert.equal(valorLineaF7(l,'super'),0);
  assert.deepEqual({...golpeF7(l,'super')},{mitad:false,resta:-10});
  assert.equal(golpeF7(l,'venganza'),null);
 }
 assert.equal(aplicaGolpeF7(30,{mitad:false,resta:-10}),20);
 assert.equal(aplicaGolpeF7(31,{mitad:true,resta:-2}),13);
 assert.equal(aplicaGolpeF7(4,{mitad:false,resta:-10}),0);
 // sin modificadores no hay golpe, y quien se fue tampoco lo recibe
 assert.equal(golpeF7({nums:[],mods:[],estado:'pasa'},'super'),null);
 assert.equal(golpeF7({nums:[],mods:[m10],estado:'fuera'},'super'),null);
});

test('super: el Flip 7 da +15 o se lo quita a otro',()=>{
 const S=mazoF7('super');
 const siete=[1,2,3,4,5,6,8].map(v=>S.findIndex(c=>c.k==='n'&&c.v===v&&!c.gafe));
 assert.equal(valorLineaF7({nums:siete,mods:[],estado:'planta',f7:true,bono:null},'super'),29+15);
 assert.equal(valorLineaF7({nums:siete,mods:[],estado:'planta',f7:true,bono:''},'super'),29+15);
 assert.equal(valorLineaF7({nums:siete,mods:[],estado:'planta',f7:true,bono:'b'},'super'),29);
});

test('super: los robots llegan a usar todas las cartas nuevas y el bono',async()=>{
 const todo=new Set();
 for(let s=1;s<=30;s++){const {vistos}=await juega('super',2+s%9,s);for(const v of vistos)todo.add(v);}
 for(const x of ['elige:mata','elige:trueca','elige:comodin','elige:segunda','bono'])assert.ok(todo.has(x),'nunca salió '+x);
});

test('diez en la mesa: la partida acaba en los tres modos',async()=>{
 for(const modo of MODOS)for(const s of [3,17]){
  const {e}=await juega(modo,10,s);
  assert.equal(e.fase,'fin');assert.equal(Object.keys(e.puntos).length,10);
 }
});

test('super: el comodín sólo se lo puede jugar quien lo saca',async()=>{
 let vistos=0;
 for(let s=1;s<=40&&vistos<3;s++){
  const {p,sec}=await sala('super',4,s);const M=mazoF7('super'),k=cuenta(s);
  let e=reducir(p),pasos=0;
  while(e.fase==='jugando'&&pasos++<3000){
   const w=e.espera;
   if(w.k==='elige'&&M[w.id].a==='comodin'){
    vistos++;
    assert.deepEqual([...w.op.uids],[w.quien]);
    const otro=Object.keys(sec).find(u=>u!==w.quien&&e.lineas[u].estado!=='fuera');
    const antes=JSON.stringify(e.espera);
    e=mover(p,{t:'apunta',uid:w.quien,a:otro,v:5});
    assert.equal(JSON.stringify(e.espera),antes,'aceptó el comodín para otro');
    e=mover(p,{t:'apunta',uid:w.quien,a:w.quien,v:5});
    assert.notEqual(JSON.stringify(e.espera),antes);
    break;
   }
   if(w.k==='roba'){const u=w.faltan[0];e=mover(p,{t:'r',uid:u,n:w.n,v:await aporteF7(sec[u].sem,sec[u].sal,w.n)});}
   else if(w.k==='decide')e=mover(p,{t:'pide',uid:w.uid,n:e.n,v:await aporteF7(sec[w.uid].sem,sec[w.uid].sal,e.n)});
   else if(w.k==='bono')e=mover(p,bono(w,k));
   else e=mover(p,{t:'apunta',uid:w.quien,...eleccion(w.op,k)});
  }
 }
 assert.ok(vistos>=1,'no salió ningún comodín');
});

test('super: los negativos se pueden tirar a quien ya se pasó, y le restan del total',async()=>{
 const casos={super:0,venganza:0};
 for(const modo of ['super','venganza'])for(let s=1;s<=80&&casos[modo]<2;s++){
  const {p,sec}=await sala(modo,5,s);const M=mazoF7(modo),k=cuenta(s);
  let e=reducir(p),pasos=0;
  while(e.fase==='jugando'&&pasos++<4000){
   const w=e.espera;
   if(w.k==='elige'&&M[w.id].k==='m'&&(M[w.id].v<0||M[w.id].mitad)){
    const muerto=Object.keys(sec).find(u=>e.lineas[u].estado==='pasa');
    if(muerto){
     casos[modo]++;
     if(modo==='venganza'){assert.ok(!w.op.uids.includes(muerto));break;}
     assert.ok(w.op.uids.includes(muerto),'no ofrece al que se pasó');
     const r=e.ronda,antes=e.puntos[muerto];
     e=mover(p,{t:'apunta',uid:w.quien,a:muerto});
     if(e.ronda===r){assert.ok(e.golpe[muerto],'no marca el golpe al total');}
     // al cerrar la ronda, el total del muerto no sube y lo perdido queda en aj
     while(e.fase==='jugando'&&e.ronda===r&&pasos++<4000){
      const x=e.espera;
      if(x.k==='roba'){const u=x.faltan[0];e=mover(p,{t:'r',uid:u,n:x.n,v:await aporteF7(sec[u].sem,sec[u].sal,x.n)});}
      else if(x.k==='decide')e=mover(p,{t:'planta',uid:x.uid});
      else if(x.k==='bono')e=mover(p,{t:'bono',uid:x.quien,a:x.quien});
      else e=mover(p,{t:'apunta',uid:x.quien,...eleccion(x.op,k)});
      if(x.k==='decide'&&x.cero)e=mover(p,{t:'pide',uid:x.uid,n:e.n,v:await aporteF7(sec[x.uid].sem,sec[x.uid].sal,e.n)});
     }
     const f=e.finRonda;
     assert.equal(f.pts[muerto],0);
     if(antes>0)assert.ok((f.aj[muerto]||0)<0,'no le restó del total');
     assert.ok(f.total[muerto]<=antes);
     break;
    }
   }
   if(w.k==='roba'){const u=w.faltan[0];e=mover(p,{t:'r',uid:u,n:w.n,v:await aporteF7(sec[u].sem,sec[u].sal,w.n)});}
   else if(w.k==='decide')e=mover(p,{t:'pide',uid:w.uid,n:e.n,v:await aporteF7(sec[w.uid].sem,sec[w.uid].sal,e.n)});
   else if(w.k==='bono')e=mover(p,bono(w,k));
   else e=mover(p,{t:'apunta',uid:w.quien,...eleccion(w.op,k)});
  }
 }
 assert.ok(casos.super>=1&&casos.venganza>=1,'no se dio el caso: '+JSON.stringify(casos));
});
