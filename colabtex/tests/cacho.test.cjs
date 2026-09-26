const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),{createHash}=require('node:crypto');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto,TextEncoder};vm.createContext(context);vm.runInContext(code+';Object.assign(this,{CC_CADENA,CC_DADOS,llaveCacho,textoApuesta,cuentaDado,pasoCacho,mezclaObligada});',context);
const {reducir,sha256hex,cadenaCacho,llaveCacho,dadosCacho,cuentaCacho,minimoCacho,apuestaValidaCacho,textoApuesta,progreso,meToca,pasoCacho,mezclaObligada,CC_CADENA,CC_DADOS}=context;
const nombres=['a','b','c','d','e','f','g','h'];
const copia=x=>JSON.parse(JSON.stringify(x));

function sala(nj,semilla,sicil=0){
 const p={juego:'cacho',sicil,estado:'jugando',cupo:nj,jugadores:{},jugadas:{}};
 const cad={};
 for(let i=0;i<nj;i++){const u=nombres[i];cad[u]=cadenaCacho((semilla*7919+i*104729)>>>0,'sal'+semilla+u);
  p.jugadores[u]={nombre:u.toUpperCase(),orden:i,hcad:cad[u][CC_CADENA]};}
 return {p,cad};
}
const mover=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p)};
const azar=s=>{let x=s>>>0||1;return()=>((x=(x*1103515245+12345)>>>0)/4294967296);};

/* Lo que haría un jugador razonable mirando solo sus dados: cuenta lo
   suyo, supone un tercio de lo ajeno (un sexto si son ases) y duda
   cuando la apuesta pasa de eso; si no, sube a su mejor pinta. */
function decide(e,u,mios,k){
 const ant=e.apuestas[e.apuestas.length-1]||null,ajenos=e.enMesa-mios.length;
 /* En una obligada no se ven los dados propios (salvo que se miren
    por la consola): el robot juega a ciegas, con lo que ve de los demás. */
 const ciego=!!e.obligada;
 const vistos=e.abiertos?Object.keys(e.abiertos).filter(x=>x!==u).flatMap(x=>e.abiertos[x]):null;
 const espera=p=>{
  if(e.obligada==='cerrado')return e.enMesa/6;
  if(vistos)return vistos.filter(d=>d===p).length+mios.length/6;
  return mios.filter(d=>d===p||(d===1&&p!==1)).length+ajenos*(p===1?1/6:1/3);
 };
 if(e.obligar&&k()<0.6){
  const m=['abierto','cerrado','torbellino'][Math.floor(k()*3)];
  return m==='torbellino'?{t:'obliga',uid:u,m,p:1+Math.floor(k()*6)}:{t:'obliga',uid:u,m};
 }
 if(e.dudaPaso&&k()<0.5)return {t:'dudapaso',uid:u};
 if(ant){
  const x=espera(ant.p);
  if(e.calzo&&Math.abs(x-ant.c)<0.5&&k()<0.3)return {t:'calzo',uid:u};
  if(ant.c>x+0.5||k()<0.08)return {t:'dudo',uid:u};
  if(e.pasar&&(pasoCacho(mios)||k()<0.1))return {t:'paso',uid:u};
 }
 let mejor=null;
 for(let p=0;p<=6;p++){
  const m=minimoCacho(ant,p,{obligada:e.obligada,unDado:e.enVaso[u]===1});
  if(m===null||m>e.enMesa)continue;
  const holgura=espera(p)-m;
  if(!mejor||holgura>mejor.h)mejor={c:m,p,h:holgura};
 }
 if(!mejor)return {t:'dudo',uid:u};
 const j={t:'ap',uid:u,c:mejor.c,p:mejor.p};
 if(!ant)j.s=k()<0.5?1:-1;
 return j;
}

function juega(nj,semilla,sicil=0,{falsa}={}){
 const {p,cad}=sala(nj,semilla,sicil);
 let e=reducir(p),pasos=0,mintio=false;const k=azar(semilla),vistos=new Set();
 while(e.fase==='jugando'){
  assert.ok(++pasos<5000,'la partida no termina');
  const w=e.espera;assert.ok(w,'jugando sin nada que esperar');
  if(w.k==='llaves'){
   assert.ok(w.faltan.length,'esperando llaves de nadie');
   const u=w.faltan[0];
   if(falsa===u&&w.r>=2&&!mintio){
    mintio=true;const antes=e;
    e=mover(p,{t:'k',uid:u,r:w.r,c:sha256hex('otra cosa'+w.r)});
    assert.deepEqual(copia(e.falsas.map(f=>f.uid+':'+f.r)),[u+':'+w.r],'la llave falsa queda anotada');
    assert.deepEqual(copia(e.espera.faltan),copia(antes.espera.faltan),'y la mesa sigue esperando la buena');
    continue;
   }
   e=mover(p,{t:'k',uid:u,r:w.r,c:llaveCacho(cad[u],w.r)});
  }else if(w.k==='apuesta'){
   if(e.obligada){
    assert.ok(!e.pasar&&!e.obligar,'en una obligada no se pasa ni se vuelve a obligar');
    if(!e.apuestas.length)assert.equal(w.uid,e.obliga,'parte quien obligó');
    if(e.obligada==='abierto'){assert.ok(e.abiertos,'ronda abierta con los vasos a la vista');vistos.add('vio-abiertos');}
    else assert.equal(e.abiertos,null);
   }
   if(e.calzo)assert.ok(e.total*2>=e.inicial,'calzar solo con la mitad de los dados en la mesa');
   const u=w.uid,mios=dadosCacho(llaveCacho(cad[u],e.ronda),e.mezcla,e.enVaso[u]);
   assert.equal(mios.length,e.enVaso[u]);
   const j=decide(e,u,mios,k);vistos.add(j.t+(j.m?':'+j.m:''));
   const antes=e.hist.length?e.hist[e.hist.length-1].i:-1;
   e=mover(p,j);
   assert.ok(e.hist[e.hist.length-1].i>antes,'la jugada del robot no se aceptó: '+JSON.stringify(j));
  }else assert.fail('espera desconocida '+w.k);
  if(e.ultimo&&!vistos.has('r'+e.ultimo.r)){
   vistos.add('r'+e.ultimo.r);const U=e.ultimo;
   const quita=Object.keys(U.antes).reduce((s,x)=>s+U.antes[x]-U.despues[x],0);
   if(U.tipo==='torbellino'){
    for(const x in U.vasos)assert.equal(U.antes[x]-U.despues[x],U.vasos[x].filter(d=>d===U.pinta).length,'el torbellino quita lo que sale de su pinta');
    vistos.add('torbellino-hecho');
   }else if(U.tipo==='paso'){
    assert.equal(U.pierde,U.paso?U.quien:U.contra,'el paso dudado');
    assert.equal(quita,1);vistos.add(U.paso?'paso-legal':'paso-farol');
   }else if(U.tipo!=='anula'){
    if(U.obligada==='cerrado')assert.equal(U.pinta,U.vasos[U.obliga][0],'en cerrada la pinta es el dado de quien obligó');
    assert.equal(U.cuenta,cuentaCacho(U.vasos,U.pinta,U.obligada),'la cuenta del destape');
    assert.equal(quita,U.pierde?Math.min(U.n,U.antes[U.pierde]):U.gana?-U.n:0,'se mueve exactamente lo que dice el veredicto');
    if(U.tipo==='dudo')assert.equal(U.n,U.sicil?2:1);
    if(U.obligada)vistos.add('fin-'+U.obligada);
    if(U.sicil)vistos.add('siciliana');
    if(U.gana)vistos.add('calzo+1');
   }
  }
 }
 return {p,cad,e,vistos};
}

test('sha256hex coincide con el de Node',()=>{
 for(const s of ['','abc','a'.repeat(55),'a'.repeat(56),'b'.repeat(64),'ñandú 🎲 cacho'.repeat(9)])
  assert.equal(sha256hex(s),createHash('sha256').update(s,'utf8').digest('hex'),JSON.stringify(s.slice(0,12)));
});

test('la cadena: cada llave es el hash de la siguiente y la punta va en la ficha',()=>{
 const c=cadenaCacho(42,'x');
 assert.equal(c.length,CC_CADENA+1);
 assert.equal(sha256hex(llaveCacho(c,0)),c[CC_CADENA]);
 assert.equal(sha256hex(llaveCacho(c,5)),llaveCacho(c,4));
 const d=dadosCacho(llaveCacho(c,1),'m',CC_DADOS);
 assert.equal(d.length,5);assert.ok(d.every(x=>x>=1&&x<=6));
 assert.deepEqual([...d],[...dadosCacho(llaveCacho(c,1),'m',5)],'los mismos dados en las dos pantallas');
});

test('apuestas: subir, pasar a ases y volver de ases',()=>{
 assert.equal(minimoCacho(null,1,{}),null,'no se abre con ases');
 assert.equal(minimoCacho(null,1,{unDado:true}),1,'salvo con un dado');
 assert.equal(minimoCacho({c:3,p:4},5),3,'pinta mayor, misma cantidad');
 assert.equal(minimoCacho({c:3,p:4},2),4,'pinta menor, uno más');
 assert.equal(minimoCacho({c:3,p:4},4),4);
 assert.equal(minimoCacho({c:7,p:4},1),4,'a ases: la mitad redondeada hacia arriba');
 assert.equal(minimoCacho({c:6,p:4},1),3);
 assert.equal(minimoCacho({c:1,p:4},1),1);
 assert.equal(minimoCacho({c:3,p:1},5),7,'de ases: el doble más uno');
 assert.equal(minimoCacho({c:3,p:1},1),4);
 assert.equal(minimoCacho({c:3,p:4},5,{obligada:true}),null,'obligada: no se cambia de pinta');
 assert.equal(minimoCacho({c:3,p:4},4,{obligada:true}),4);
 assert.equal(minimoCacho(null,0,{obligada:'cerrado'}),1,'cerrada: se abre «de esta»');
 assert.equal(minimoCacho({c:2,p:0},0,{obligada:'cerrado'}),3);
 assert.equal(minimoCacho({c:2,p:0},4,{obligada:'cerrado'}),null);
 assert.equal(minimoCacho(null,0,{}),null,'«de esta» solo en cerrada');
 assert.equal(textoApuesta(3,0),'3 de esta');
 assert.ok(apuestaValidaCacho({c:3,p:4},{c:3,p:6}));
 assert.ok(!apuestaValidaCacho({c:3,p:4},{c:3,p:3}));
 assert.ok(!apuestaValidaCacho(null,{c:11,p:3},{total:10}),'no más dados de los que hay');
 assert.ok(!apuestaValidaCacho(null,{c:2,p:7}));
 assert.equal(textoApuesta(3,3),'3 trenes');assert.equal(textoApuesta(1,1),'1 as');
 assert.equal(cuentaCacho({a:[1,3,3],b:[1,5]},3,false),4,'los ases son comodines');
 assert.equal(cuentaCacho({a:[1,3,3],b:[1,5]},3,true),2,'salvo en ronda obligada');
 assert.equal(cuentaCacho({a:[1,3,3],b:[1,5]},1,false),2);
});

test('partidas enteras de 2 a 8, normales y sicilianas, terminan',()=>{
 const todo=new Set();
 for(const sicil of [0,1])for(let nj=2;nj<=8;nj++)for(let s=1;s<=3;s++){
  const {p,e,vistos}=juega(nj,s*31+nj,sicil);
  for(const v of vistos)todo.add(v);
  assert.equal(e.fase,'fin');assert.equal(e.motivo,'cacho');
  assert.ok(e.ganador,'hay ganador');assert.ok(e.dados[e.ganador]>0);
  assert.equal(nombres.slice(0,nj).filter(u=>e.dados[u]>0).length,1,'queda uno solo con dados');
  assert.equal(progreso(e,'cacho'),0,'fuera de juego no hay progreso');
  assert.deepEqual(copia(e),copia(reducir(copia(p))),'el reductor es puro');
 }
 for(const v of ['ap','dudo','calzo','siciliana','calzo+1','paso','paso-legal','paso-farol','dudapaso','obliga:abierto','obliga:cerrado','obliga:torbellino','torbellino-hecho','fin-abierto','fin-cerrado','vio-abiertos'])assert.ok(todo.has(v),'se vio '+v);
});

test('siciliana: dudar la primera apuesta cuesta dos dados',()=>{
 for(const sicil of [0,1]){
  const {p,cad}=sala(3,5,sicil);let e=reducir(p);
  for(const u of e.espera.faltan)e=mover(p,{t:'k',uid:u,r:0,c:llaveCacho(cad[u],0)});
  assert.equal(e.etapa,'apuesta');
  const a=e.turno;
  e=mover(p,{t:'ap',uid:a,c:12,p:6});
  const d=e.turno;e=mover(p,{t:'dudo',uid:d});
  assert.equal(e.etapa,'destape');assert.equal(e.destape.primera,true);
  for(const u of e.espera.faltan)e=mover(p,{t:'k',uid:u,r:1,c:llaveCacho(cad[u],1)});
  assert.equal(e.ultimo.pierde,a,'doce sextos entre quince dados no están');
  assert.equal(e.dados[a],CC_DADOS-(sicil?2:1));
  assert.equal(e.ultimo.sicil,!!sicil);
  assert.equal(e.turno,a,'parte quien perdió');
  /* En la segunda apuesta de la ronda ya no es siciliana. */
  const x=e.turno;e=mover(p,{t:'ap',uid:x,c:1,p:2});
  const y=e.turno;e=mover(p,{t:'ap',uid:y,c:10,p:2});
  e=mover(p,{t:'dudo',uid:e.turno});
  for(const u of e.espera.faltan)e=mover(p,{t:'k',uid:u,r:2,c:llaveCacho(cad[u],2)});
  assert.equal(e.ultimo.n,1);assert.equal(e.ultimo.pierde,y);
 }
});

test('calzo: justo devuelve un dado, errado lo quita',()=>{
 /* Se busca una semilla en la que la primera apuesta sea exacta. */
 let hecho=0;
 for(let s=1;s<60&&hecho<2;s++){
  const {p,cad}=sala(2,s);let e=reducir(p);
  for(const u of e.espera.faltan)e=mover(p,{t:'k',uid:u,r:0,c:llaveCacho(cad[u],0)});
  const a=e.turno,b=a==='a'?'b':'a';
  /* Primero b pierde un dado dudando a lo seguro, para que calzar
     tenga algo que devolver. */
  e=mover(p,{t:'ap',uid:a,c:1,p:2});e=mover(p,{t:'dudo',uid:b});
  for(const u of e.espera.faltan)e=mover(p,{t:'k',uid:u,r:1,c:llaveCacho(cad[u],1)});
  if(e.ultimo.pierde!==b)continue;
  assert.equal(e.dados[b],4);assert.equal(e.turno,b);
  const v2={[a]:dadosCacho(llaveCacho(cad[a],2),e.mezcla,5),[b]:dadosCacho(llaveCacho(cad[b],2),e.mezcla,4)};
  const n4=cuentaCacho(v2,4,false);
  if(n4<1)continue;
  e=mover(p,{t:'ap',uid:b,c:n4,p:4});
  assert.equal(e.turno,a);assert.ok(e.calzo,'a puede calzar');
  const acierta=hecho===0;
  if(!acierta){e=mover(p,{t:'ap',uid:a,c:n4,p:5});}
  if(acierta){e=mover(p,{t:'calzo',uid:a});
   for(const u of e.espera.faltan)e=mover(p,{t:'k',uid:u,r:2,c:llaveCacho(cad[u],2)});
   assert.equal(e.ultimo.acierta,true);assert.equal(e.ultimo.gana,'',"con cinco no hay dado que devolver");
   assert.equal(e.dados[a],5);
  }else{
   e=mover(p,{t:'calzo',uid:b});
   for(const u of e.espera.faltan)e=mover(p,{t:'k',uid:u,r:2,c:llaveCacho(cad[u],2)});
   const real5=cuentaCacho(v2,5,false);
   if(real5===n4){assert.equal(e.ultimo.gana,b);assert.equal(e.dados[b],5);}
   else{assert.equal(e.ultimo.pierde,b);assert.equal(e.dados[b],3);}
  }
  hecho++;
 }
 assert.equal(hecho,2);
});

test('una llave falsa no cuenta, se anota y la partida sigue con la buena',()=>{
 const {e}=juega(4,77,0,{falsa:'c'});
 assert.equal(e.fase,'fin');
 assert.ok(e.falsas.some(f=>f.uid==='c'));
 assert.ok(e.hist.length>0);
});

test('quien abandona con dados en la mesa anula la ronda, y la mesa sigue',()=>{
 const {p,cad}=sala(3,9);let e=reducir(p);
 for(const u of e.espera.faltan)e=mover(p,{t:'k',uid:u,r:0,c:llaveCacho(cad[u],0)});
 const a=e.turno;e=mover(p,{t:'ap',uid:a,c:2,p:3});
 const fuera=nombres.slice(0,3).find(u=>u!==a);
 e=mover(p,{t:'abandona',uid:fuera});
 assert.equal(e.etapa,'destape');assert.equal(e.destape.tipo,'anula');
 assert.ok(!e.espera.faltan.includes(fuera),'no se espera la llave de quien se fue');
 for(const u of e.espera.faltan)e=mover(p,{t:'k',uid:u,r:1,c:llaveCacho(cad[u],1)});
 assert.equal(e.ultimo.tipo,'anula');assert.equal(e.ultimo.pierde,'');
 assert.equal(e.etapa,'apuesta');assert.equal(e.ronda,2);assert.equal(e.turno,a,'reabre quien abrió');
 assert.equal(e.puntos[fuera],0);
 const otro=nombres.slice(0,3).find(u=>u!==a&&u!==fuera);
 e=mover(p,{t:'abandona',uid:otro});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,a);assert.equal(e.motivo,'abandono');
});

test('meToca y progreso',()=>{
 const {p,cad}=sala(2,3);let e=reducir(p);
 assert.ok(!meToca(e,'a')&&!meToca(e,'b'),'las llaves las manda la pantalla sola: no es turno de nadie');
 for(const u of e.espera.faltan)e=mover(p,{t:'k',uid:u,r:0,c:llaveCacho(cad[u],0)});
 const a=e.turno,b=a==='a'?'b':'a';
 assert.ok(meToca(e,a)&&!meToca(e,b));
 assert.equal(progreso(e,'cacho'),0);
 e=mover(p,{t:'ap',uid:a,c:10,p:6});e=mover(p,{t:'dudo',uid:b});
 for(const u of e.espera.faltan)e=mover(p,{t:'k',uid:u,r:1,c:llaveCacho(cad[u],1)});
 assert.ok(Math.abs(progreso(e,'cacho')-0.1)<1e-9);
});

test('pasoCacho: iguales, distintos o full',()=>{
 assert.equal(pasoCacho([4,4,4,4,4]),'iguales');
 assert.equal(pasoCacho([1,2,3,4,6]),'distintos');
 assert.equal(pasoCacho([2,2,5,5,5]),'full');
 assert.equal(pasoCacho([2,2,5,5,1]),'','dos pares no es paso');
 assert.equal(pasoCacho([3,3,3,3,1]),'','póker no es paso, el as no es comodín aquí');
 assert.equal(pasoCacho([6]),'iguales');
 assert.equal(pasoCacho([2,5]),'distintos');
 assert.equal(pasoCacho([2,2,5,5]),'');
});

/* Arranca una sala de tres y deja la primera ronda en apuestas. */
function primeraRonda(semilla){
 const {p,cad}=sala(3,semilla);let e=reducir(p);
 for(const u of e.espera.faltan)e=mover(p,{t:'k',uid:u,r:0,c:llaveCacho(cad[u],0)});
 return {p,cad,e};
}
const destapar=(p,cad,e)=>{for(const u of e.espera.faltan)e=mover(p,{t:'k',uid:u,r:e.espera.r,c:llaveCacho(cad[u],e.espera.r)});return e;};

test('el paso: solo con apuesta, uno por ronda, y lo duda el siguiente',()=>{
 let legal=0,farol=0;
 for(let s=1;s<200&&!(legal&&farol);s++){
  let {p,cad,e}=primeraRonda(s);
  const a=e.turno;
  assert.ok(!e.pasar,'no se pasa al abrir');
  e=mover(p,{t:'paso',uid:a});assert.equal(e.turno,a,'el paso al abrir no entra');
  e=mover(p,{t:'ap',uid:a,c:2,p:3});
  const b=e.turno;assert.ok(e.pasar);assert.ok(!e.dudaPaso);
  e=mover(p,{t:'paso',uid:b});
  const c=e.turno;assert.notEqual(c,b);
  assert.ok(e.dudaPaso,'el siguiente puede dudar el paso');assert.ok(!e.pasar,'y no puede pasar otra vez');
  assert.equal(e.apuestas.length,1,'la apuesta sigue como estaba');
  const vb=dadosCacho(llaveCacho(cad[b],1),e.mezcla,5);
  e=mover(p,{t:'dudapaso',uid:c});
  assert.equal(e.etapa,'destape');
  e=destapar(p,cad,e);
  const U=e.ultimo;
  assert.equal(U.tipo,'paso');assert.deepEqual([...U.orden],[b],'solo se levanta el vaso de quien pasó');
  assert.equal(U.paso,pasoCacho(vb));
  if(U.paso){legal++;assert.equal(U.pierde,c);}else{farol++;assert.equal(U.pierde,b);}
  assert.equal(e.dados[U.pierde],4);assert.equal(e.turno,U.pierde,'parte quien perdió');
 }
 assert.ok(legal&&farol,'se vieron un paso legal y un farol');
 /* Si el siguiente sube, el paso ya no se puede dudar. */
 let {p,e}=primeraRonda(3);
 e=mover(p,{t:'ap',uid:e.turno,c:2,p:3});
 const b=e.turno;e=mover(p,{t:'paso',uid:b});
 e=mover(p,{t:'ap',uid:e.turno,c:3,p:3});
 assert.ok(!e.dudaPaso);assert.ok(!e.pasar,'ni se puede volver a pasar en la ronda');
 const antes=e.hist.length;e=mover(p,{t:'dudapaso',uid:e.turno});
 assert.equal(e.hist.length,antes,'dudar un paso ya pasado no entra');
});

test('calzo: solo con al menos la mitad de los dados iniciales en la mesa',()=>{
 let visto=false;
 for(let s=1;s<40&&!visto;s++){
  const {p,cad}=sala(3,s);let e=reducir(p);
  for(const u of e.espera.faltan)e=mover(p,{t:'k',uid:u,r:0,c:llaveCacho(cad[u],0)});
  /* Se pierden dados a propósito con apuestas imposibles hasta bajar de la mitad. */
  while(e.fase==='jugando'&&e.total*2>=e.inicial){
   e=mover(p,{t:'ap',uid:e.turno,c:e.enMesa,p:6});
   e=mover(p,{t:'dudo',uid:e.turno});e=destapar(p,cad,e);
  }
  if(e.fase!=='jugando')continue;
  e=mover(p,{t:'ap',uid:e.turno,c:1,p:2});
  assert.ok(!e.calzo,'con menos de la mitad no se calza, tampoco con un dado');
  const antes=e.hist.length;e=mover(p,{t:'calzo',uid:e.turno});
  assert.equal(e.hist.length,antes,'el calzo no entra');
  visto=true;
 }
 assert.ok(visto);
});

test('obligar: ronda abierta, cerrada y torbellino',()=>{
 /* Una mesa de tres donde al que abre le queda un dado. */
 function conUnDado(desde){
  for(let s=desde;s<desde+400;s++){
   const {p,cad}=sala(3,s);let e=reducir(p);
   for(const u of e.espera.faltan)e=mover(p,{t:'k',uid:u,r:0,c:llaveCacho(cad[u],0)});
   const v=e.turno;
   for(let i=0;i<6&&e.fase==='jugando'&&e.turno===v&&e.dados[v]>1;i++){
    e=mover(p,{t:'ap',uid:v,c:e.enMesa,p:6});e=mover(p,{t:'dudo',uid:e.turno});e=destapar(p,cad,e);
   }
   if(e.fase==='jugando'&&e.turno===v&&e.dados[v]===1&&e.obligar)return {p,cad,e,v};
  }
  assert.fail('no se encontró mesa');
 }
 for(const m of ['abierto','cerrado','torbellino']){
  const {p,cad,e:e0,v}=conUnDado(1);let e=e0;
  const normales=dadosCacho(llaveCacho(cad[v],e.ronda),e.mezcla,1);
  let antes=e.hist.length;
  e=mover(p,{t:'obliga',uid:v,m:'toString'});assert.equal(e.hist.length,antes,'modo desconocido no entra');
  e=mover(p,m==='torbellino'?{t:'obliga',uid:v,m,p:normales[0]}:{t:'obliga',uid:v,m});
  assert.equal(e.obligada,m);assert.ok(e.obligo[v]);assert.ok(!e.obligar,'una vez');
  if(m==='abierto'){
   assert.equal(e.etapa,'muestra');assert.equal(e.turno,'','mientras se muestran las llaves no le toca a nadie');
   e=destapar(p,cad,e);
   assert.equal(e.etapa,'apuesta');assert.equal(e.turno,v,'parte quien obligó');
   assert.equal(Object.keys(e.abiertos).length,3);
   const L=Object.fromEntries(Object.keys(e.enVaso).map(u=>[u,llaveCacho(cad[u],e.ronda)]));
   const mz=mezclaObligada(e.mezcla,'abierto',L,e.enVaso);
   assert.deepEqual([...e.abiertos[v]],[...dadosCacho(L[v],mz,1)],'los dados se tiran después de obligar');
   e=mover(p,{t:'ap',uid:v,c:1,p:4});
   antes=e.hist.length;e=mover(p,{t:'ap',uid:e.turno,c:2,p:5});
   assert.equal(e.hist.length,antes,'no se cambia la pinta');
   e=mover(p,{t:'ap',uid:e.turno,c:2,p:4});assert.equal(e.apuestas.length,2);
   assert.ok(!e.pasar,'en obligada no se pasa');
  }else if(m==='cerrado'){
   assert.equal(e.etapa,'apuesta');assert.equal(e.turno,v);assert.equal(e.abiertos,null);
   antes=e.hist.length;e=mover(p,{t:'ap',uid:v,c:1,p:3});
   assert.equal(e.hist.length,antes,'en cerrada solo «de esta»');
   e=mover(p,{t:'ap',uid:v,c:2,p:0});
   e=mover(p,{t:'dudo',uid:e.turno});e=destapar(p,cad,e);
   const U=e.ultimo;assert.equal(U.obligada,'cerrado');assert.equal(U.pinta,U.vasos[v][0]);
   assert.equal(U.cuenta,cuentaCacho(U.vasos,U.pinta,'cerrado'),'sin comodines');
  }else{
   assert.equal(e.etapa,'destape');
   e=destapar(p,cad,e);
   const U=e.ultimo;assert.equal(U.tipo,'torbellino');assert.equal(U.pinta,normales[0]);
   for(const x in U.vasos)assert.equal(U.antes[x]-U.despues[x],U.vasos[x].filter(d=>d===U.pinta).length);
   if(e.fase==='jugando'&&e.dados[v]>0)assert.equal(e.turno,v,'tras el torbellino parte quien lo tiró');
  }
 }
});
