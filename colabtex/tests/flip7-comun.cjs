/* Flip 7, lo que comparten sus tests: el motor cargado en un contexto, la sala de prueba, los robots y el
   fuzz de robos. El fuzz va partido en flip7-robos-1/2.test.cjs para que `node --test` lo corra en paralelo:
   cada jugada vuelve a reducir todo el registro, y las 60 semillas seguidas tardaban minuto y medio. */
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

const aporte=async(sec,u,n)=>({t:'r',uid:u,n,v:await aporteF7(sec[u].sem,sec[u].sal,n)});
function azar(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
/* Robots con uno de la mesa dormido para los aportes (sólo mueve en su
   turno) y aportes de suplentes al azar: la partida tiene que acabar,
   el reductor no puede esperar nunca a nadie que no pueda contestar, y
   la auditoría tiene que pasar igual. */
async function fuzzRobos(desde,hasta){
 for(let s=desde;s<=hasta;s++){
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
}

module.exports={context,reducir,mazoF7,lineaValidaF7,valorLineaF7,aporteF7,compromiso,auditaFlip7,progreso,meToca,golpeF7,aplicaGolpeF7,nombres,MODOS,eleccion,bono,cuenta,sala,mover,juega,aporte,azar,fuzzRobos};
