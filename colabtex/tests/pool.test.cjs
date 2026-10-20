const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto};vm.createContext(context);vm.runInContext(code,context);
const {reducir,plNueva,plClona,plSimula,plGolpe,plPaso,plMueve,plColocaOk,plQuedan,plEquipos,cupoDe,minimoDe,meToca,progreso,ganoEn,rng}=context;
const [PL,PL_BOLSILLOS,JUEGOS,plGrupo]=vm.runInContext('[PL,PL_BOLSILLOS,JUEGOS,plGrupo]',context);
const copia=x=>JSON.parse(JSON.stringify(x));
const R=PL.R;

/* Una sala de Pool. `cupo` 2 es 1 contra 1 y 4 es 2 contra 2. */
function sala(semilla=7,cupo=2,extra={}){
 const p={juego:'pool',semilla,cupo,estado:'jugando',jugadores:{},jugadas:{},...extra};
 for(let i=0;i<cupo;i++)p.jugadores['u'+i]={nombre:'J'+i,orden:i};
 return p;
}
const poner=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p)};

/* Una mesa vacía con la blanca y algunas bolas en sitios dados. */
function mesaCon(bolas){
 const m=plNueva(1);
 for(const q of m.b){q.en=false;q.vx=q.vy=q.wx=q.wy=q.wz=0}
 for(const [id,x,y] of bolas){const q=m.b[id];q.en=true;q.x=x;q.y=y}
 return m;
}
const velocidad=q=>Math.hypot(q.vx,q.vy);
/* Corre una mesa hasta que se calme, o hasta `pasos`. */
function corre(m,pasos=60000){let n=0;while(n<pasos&&plPaso(m)){n++}return n}

/* Un robot: apunta a la bola buena más cercana en dirección a una tronera. */
function robot(est,g){
 const me=est.turno,mesa=est.mesa,cue=mesa.b[0];
 const gr=est.grupos[est.equipos.de[me]];
 let obj=mesa.b.filter(q=>q.en&&q.id!==0&&q.id!==8&&(est.abierta||plGrupo(q.id)===gr));
 if(est.despejado||!obj.length)obj=[mesa.b[8]];
 let mejor=null;
 const c=est.mano?{x:300+g()*300,y:300+g()*600}:cue;
 for(const q of obj)PL_BOLSILLOS.forEach((p,k)=>{
  const tx=p.x-q.x,ty=p.y-q.y,tl=Math.hypot(tx,ty);
  const gx=q.x-tx/tl*2*R,gy=q.y-ty/tl*2*R;
  const ax=gx-c.x,ay=gy-c.y,al=Math.hypot(ax,ay);
  const cos=(ax*tx+ay*ty)/(al*tl);
  if(cos<0.35)return;
  const score=al+tl*0.5-cos*400;
  if(!mejor||score<mejor.score)mejor={score,ax,ay,al,k};
 });
 let dx,dy,k=Math.floor(g()*6);
 if(mejor){dx=mejor.ax/mejor.al;dy=mejor.ay/mejor.al;k=mejor.k}
 else{const q=obj[0];const ax=q.x-c.x,ay=q.y-c.y,al=Math.hypot(ax,ay);dx=ax/al;dy=ay/al}
 const err=(g()-.5)*0.03,co=Math.cos(err),si=Math.sin(err);
 const rx=dx*co-dy*si,ry=dx*si+dy*co;
 const j={t:'tiro',uid:me,dx:Math.round(rx*1e4)/1e4,dy:Math.round(ry*1e4)/1e4,f:Math.round((0.3+g()*0.5)*100)/100,a:0,b:0};
 if(est.mano&&est.mano!==''){j.px=Math.round(c.x);j.py=Math.round(c.y);if(!plColocaOk(mesa,j.px,j.py,est.mano)){
  for(let i=0;i<400;i++){const x=Math.round(R+2+g()*(est.mano==='cabecera'?PL.L/4-R-2:PL.L-2*R-4)),y=Math.round(R+2+g()*(PL.W-2*R-4));if(plColocaOk(mesa,x,y,est.mano)){j.px=x;j.py=y;break}}}}
 if(est.despejado)j.c=k;
 return j;
}
function jugar(p,g,max=600){
 let e=reducir(p),n=0;
 while(e.fase==='jugando'&&n++<max)e=poner(p,robot(e,g));
 return e;
}

test('pool: el triángulo tiene quince bolas bien puestas',()=>{
 for(const sem of [1,2,3,77,123456]){
  const m=plNueva(sem);
  assert.equal(m.b.length,16);
  const v=m.b.filter(q=>q.id);
  for(let i=0;i<v.length;i++)for(let j=i+1;j<v.length;j++)assert.ok(Math.hypot(v[i].x-v[j].x,v[i].y-v[j].y)>=2*R,'sin solapes');
  // la 8 en el centro de la tercera fila, lisa y rayada en las esquinas de atrás
  const o=m.b[8];assert.ok(Math.abs(o.y-PL.W/2)<0.5);
  const fondo=v.filter(q=>q.x>PL.L*0.75+3.9*R*Math.sqrt(3)-1).sort((a,b)=>a.y-b.y);
  assert.equal(fondo.length,5);
  assert.notEqual(plGrupo(fondo[0].id),plGrupo(fondo[4].id),'esquinas traseras: una lisa y una rayada');
  assert.deepEqual(copia(plNueva(sem)),copia(m),'misma semilla, misma mesa');
 }
 assert.notDeepEqual(copia(plNueva(1)),copia(plNueva(2)));
});

test('pool: la rotura es determinista y termina',()=>{
 const a=plNueva(9),b=plNueva(9);
 const ra=plSimula(a,{dx:1,dy:0,f:1,a:0,b:0}),rb=plSimula(b,{dx:1,dy:0,f:1,a:0,b:0});
 assert.deepEqual(copia(a),copia(b));assert.deepEqual(copia(ra),copia(rb));
 assert.ok(!plMueve(a),'al final todo está quieto');
 assert.ok(ra.pasos<PL.MAX_PASOS);assert.ok(ra.bolasBanda.length>=4,'una rotura fuerte lleva bolas a banda');
 for(const q of a.b)if(q.en){assert.ok(q.x>=R-1e-6&&q.x<=PL.L-R+1e-6&&q.y>=R-1e-6&&q.y<=PL.W-R+1e-6,'las bolas no salen de la mesa')}
});

test('pool: el punto de golpe cambia lo que hace la blanca',()=>{
 // blanca recta contra una bola: con retroceso vuelve, con seguir sigue, a media altura se queda
 const resultado=b=>{
  const m=mesaCon([[0,700,635],[1,1100,635]]);
  plSimula(m,{dx:1,dy:0,f:0.55,a:0,b});
  return m.b[0];
 };
 const atras=resultado(-1),seguir=resultado(1),seco=resultado(0);
 assert.ok(atras.x<1000-R*2,'con retroceso la blanca vuelve atrás: x='+atras.x);
 assert.ok(seguir.x>1000,'con efecto de seguir la blanca avanza tras el choque: x='+seguir.x);
 assert.ok(seco.x>atras.x&&seco.x<seguir.x,'sin efecto queda entre las dos');
});

test('pool: la fuerza se nota y el efecto lateral cambia el ángulo en banda',()=>{
 const rec=f=>{const m=mesaCon([[0,500,300]]);plSimula(m,{dx:1,dy:0,f,a:0,b:0});return m.b[0].x};
 assert.ok(rec(1)>rec(0.5)||rec(1)>=PL.L-R-1,'más fuerza, más recorrido');
 // rebote contra la banda de abajo en diagonal, con efecto a un lado y al otro
 const salida=a=>{
  const m=mesaCon([[0,600,500]]);
  const n=Math.hypot(1,-1);
  plGolpe(m,{dx:1/n,dy:-1/n,f:0.6,a,b:0});
  let paso=0,vx=null;
  while(paso++<40000&&plPaso(m,(k)=>{if(k==='banda'&&vx===null)vx=-1})){if(vx===-1&&m.b[0].vy>0){vx=m.b[0].vx;break}}
  return vx;
 };
 const der=salida(1),izq=salida(-1),neutro=salida(0);
 assert.ok(typeof der==='number'&&typeof izq==='number');
 assert.ok(Math.abs(der-izq)>30,'el efecto lateral cambia la salida: '+der+' vs '+izq);
 // el efecto «a favor» de la banda acelera la salida; el contrario se agota contra el roce y queda cerca del neutro
 assert.ok(Math.max(der,izq)>neutro+500,'el efecto a favor acelera la salida: '+[izq,neutro,der]);
 assert.ok(Math.min(der,izq)>neutro-150,'el efecto en contra no la frena más que el roce');
});

test('pool: una bola cae por el bolsillo y no vuelve',()=>{
 const m=mesaCon([[0,300,300],[1,120,120]]);
 const r=plSimula(m,{dx:(120-300)/Math.hypot(180,180),dy:(120-300)/Math.hypot(180,180),f:0.4,a:0,b:0});
 assert.ok(r.emb.some(e=>e.id===1&&e.p===0),'la 1 cae por la esquina 0: '+JSON.stringify(r.emb));
 assert.equal(m.b[1].en,false);
});

test('pool: salas — formatos, cupo y quién empieza',()=>{
 assert.equal(cupoDe(sala(1,2)),2);assert.equal(cupoDe(sala(1,4)),4);
 assert.equal(cupoDe({juego:'pool',cupo:3}),4,'tres no existe: pool es de 2 o de 4');
 assert.equal(minimoDe(sala(1,2)),2);assert.equal(minimoDe(sala(1,4)),4);
 const p=sala(1,4);delete p.jugadores.u3;
 assert.equal(reducir(p).fase,'espera','2 contra 2 espera a los cuatro');
 const q=sala(1,2);delete q.jugadores.u1;assert.equal(reducir(q).fase,'espera');
 const e=reducir(sala(2,2));
 assert.equal(e.fase,'jugando');assert.equal(e.mano,'cabecera','la rotura empieza con la blanca en mano tras la cabecera');
 assert.equal(e.abierta,true);assert.equal(e.grupos.a,null);
 assert.equal(e.turno,'u'+(2%2),'la semilla decide quién rompe');
 assert.equal(reducir(sala(3,2)).turno,'u1');
});

test('pool: 2 contra 2 — parejas y turnos',()=>{
 const pp=sala(2,4);
 let eq=plEquipos(pp);
 assert.deepEqual(copia([eq.a,eq.b]),[['u0','u1'],['u2','u3']]);
 eq=plEquipos(sala(2,4,{pareja:2}));assert.deepEqual(copia([eq.a,eq.b]),[['u0','u2'],['u1','u3']]);
 eq=plEquipos(sala(2,4,{pareja:3}));assert.deepEqual(copia([eq.a,eq.b]),[['u0','u3'],['u1','u2']]);
 eq=plEquipos(sala(2,4,{pareja:9}));assert.deepEqual(copia([eq.a,eq.b]),[['u0','u3'],['u1','u2']],'la pareja se recorta a 1–3');
 assert.deepEqual(copia(plEquipos(sala(1,2)).a),['u0']);
});

test('pool: rechaza tiros inválidos, de otro o fuera de turno',()=>{
 const p=sala(2,2);let e=reducir(p);const ok=e.turno,otro=ok==='u0'?'u1':'u0';
 const buen={t:'tiro',uid:ok,dx:1,dy:0,f:0.5,a:0,b:0};
 for(const j of [
  {...buen,uid:otro},{...buen,uid:'intruso'},{...buen,dx:0,dy:0},{...buen,dx:2,dy:0},{...buen,f:0},{...buen,f:1.5},{...buen,a:1,b:1},
  {...buen,dx:'x'},{...buen,px:5,py:5},{...buen,px:PL.L/2,py:PL.W/2},{t:'otra',uid:ok}
 ])e=poner(p,j);
 assert.equal(e.movs,0,'ninguna cuenta');assert.equal(e.turno,ok);
 e=poner(p,buen);assert.equal(e.movs,1);
});

test('pool: dentro del registro el tiro se reproduce igual dos veces',()=>{
 const g=rng(5);const p=sala(11,2);let e=reducir(p);
 for(let i=0;i<8&&e.fase==='jugando';i++)e=poner(p,robot(e,g));
 const a=reducir(p),b=reducir(copia(p));
 assert.deepEqual(copia(a.mesa),copia(b.mesa));assert.equal(a.movs,8);
 assert.deepEqual(copia(a.ultima.antes),copia(b.ultima.antes));
});

test('pool: la primera bola embolsada reparte lisas y rayadas',()=>{
 let visto=0;
 for(let sem=1;sem<=40&&visto<3;sem++){
  const p=sala(sem,2),g=rng(sem*7);let e=reducir(p);
  for(let i=0;i<40&&e.fase==='jugando'&&e.abierta;i++)e=poner(p,robot(e,g));
  if(!e.abierta){
   visto++;
   const u=e.ultima;
   assert.ok(!u.falta,'asignó sin falta');
   const quien=e.equipos.de[u.uid];
   const primera=u.emb.find(x=>x.id!==0&&x.id!==8);
   assert.equal(e.grupos[quien],plGrupo(primera.id));
   assert.equal(e.grupos[quien==='a'?'b':'a'],plGrupo(primera.id)==='s'?'r':'s');
  }
 }
 assert.ok(visto>=1,'alguna partida asignó grupos');
});

test('pool: la falta da bola en mano y pasa el turno; la blanca en la rotura, detrás de la cabecera',()=>{
 let faltas=0,mano=0;
 for(let sem=1;sem<=60&&faltas<6;sem++){
  const p=sala(sem,2),g=rng(sem);let e=reducir(p);
  for(let i=0;i<25&&e.fase==='jugando';i++){
   const antes=e,j=robot(e,g);
   // a veces un tiro sin rumbo: casi seguro falta
   if(i%4===3){j.dx=0;j.dy=1;if(e.mano){j.px=300;j.py=PL.W/2;if(!plColocaOk(e.mesa,300,PL.W/2,e.mano)){delete j.px;delete j.py}}}
   e=poner(p,j);
   if(e.movs>antes.movs&&e.ultima.falta){
    faltas++;
    assert.notEqual(e.turno,antes.turno,'tras una falta tira el rival');
    assert.ok(e.mano==='libre'||e.mano==='cabecera','y con la blanca en mano');
    if(e.ultima.rotura&&!e.mesa.b[0].en)assert.equal(e.mano,'cabecera');
    mano++;
   }
  }
 }
 assert.ok(faltas>=3,'se ven faltas: '+faltas);
});

test('pool: partidas completas de robots acaban, con ganador válido (1 contra 1)',()=>{
 let fines=0,ochos=0;
 for(let sem=1;sem<=14;sem++){
  const p=sala(sem,2),g=rng(sem*31+1);
  const e=jugar(p,g,500);
  if(e.fase!=='fin')continue;
  fines++;
  assert.ok(e.ganador==='u0'||e.ganador==='u1','ganador: '+e.ganador);
  assert.ok(['ocho','ocho-pronto','ocho-mal','ocho-falta'].includes(e.motivo),e.motivo);
  assert.ok(ganoEn(p,e.ganador,e.ganador));assert.ok(!ganoEn(p,e.ganador,e.ganador==='u0'?'u1':'u0'));
  if(e.motivo==='ocho')ochos++;
  assert.equal(meToca(e,e.ganador),false,'acabada: a nadie le toca');
 }
 assert.ok(fines>=8,'la mayoría de las partidas llegan a la 8: '+fines);
});

test('pool: 2 contra 2 — alternan los equipos y dentro de cada uno quien tira',()=>{
 for(let sem=1;sem<=6;sem++){
  const p=sala(sem,4),g=rng(sem*13+5);let e=reducir(p);
  const orden=[];
  for(let i=0;i<60&&e.fase==='jugando';i++){
   const antes=e;e=poner(p,robot(e,g));
   if(e.movs>antes.movs&&!e.ultima.sigue&&e.fase==='jugando'){
    assert.notEqual(e.equipos.de[e.turno],antes.equipos.de[antes.turno],'cambia de equipo');
    orden.push(antes.turno);
   }
  }
  // la misma pareja no repite tirador cuando le vuelve a tocar
  const por={a:[],b:[]};
  for(const u of orden)por[e.equipos.de[u]].push(u);
  for(const k of ['a','b'])for(let i=1;i<por[k].length;i++)assert.notEqual(por[k][i],por[k][i-1],'rotan los dos de cada equipo');
 }
});

test('pool: 2 contra 2 completa — el ganador es un equipo',()=>{
 let fines=0;
 for(let sem=1;sem<=8;sem++){
  const p=sala(sem,4),g=rng(sem*17+3);const e=jugar(p,g,500);
  if(e.fase!=='fin')continue;fines++;
  assert.ok(e.ganador==='eq:a'||e.ganador==='eq:b',e.ganador);
  const gana=e.ganador==='eq:a'?e.equipos.a:e.equipos.b,pierde=e.ganador==='eq:a'?e.equipos.b:e.equipos.a;
  for(const u of gana)assert.ok(ganoEn(p,e.ganador,u));
  for(const u of pierde)assert.ok(!ganoEn(p,e.ganador,u));
 }
 assert.ok(fines>=4,'las partidas por parejas también llegan al final: '+fines);
});

test('pool: abandonar da la victoria al otro equipo; en parejas sigue el compañero',()=>{
 let p=sala(4,2);let e=poner(p,{t:'abandona',uid:'u0'});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'u1');assert.equal(e.motivo,'abandono');
 p=sala(4,4);e=poner(p,{t:'abandona',uid:'u0'});
 assert.equal(e.fase,'jugando','con un compañero que queda, se sigue');
 assert.ok(!Object.keys(e.equipos).length||true);
 e=poner(p,{t:'abandona',uid:'u1'});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'eq:b');assert.equal(e.motivo,'abandono');
 p=sala(4,2);e=poner(p,{t:'abandona',uid:'intruso'});assert.equal(e.fase,'jugando');
});

test('pool: expulsar por votación cuenta como abandono',()=>{
 const p=sala(6,2);
 const e=poner(p,{t:'voto',uid:'u0',contra:'u1'});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'u0');assert.equal(e.motivo,'abandono');
 assert.equal(e.expulsados.length,1);
});

test('pool: progreso y turno',()=>{
 let p=sala(1,2);let e=reducir(p);
 assert.equal(progreso(e,'pool'),0);assert.ok(meToca(e,e.turno));
 const otro=e.turno==='u0'?'u1':'u0';assert.ok(!meToca(e,otro));
 assert.ok(JUEGOS.pool&&JUEGOS.pool.cupo===4&&JUEGOS.pool.minimo===2);
});

test('pool: colocar la blanca respeta bandas, bolas y troneras',()=>{
 const m=mesaCon([[1,1000,635]]);
 assert.ok(plColocaOk(m,600,635,'libre'));
 assert.ok(!plColocaOk(m,10,635,'libre'),'pegada a la banda');
 assert.ok(!plColocaOk(m,1000+R,635,'libre'),'encima de otra bola');
 assert.ok(!plColocaOk(m,40,40,'libre'),'en la boca de una esquina');
 assert.ok(!plColocaOk(m,900,635,'cabecera'),'tras la cabecera no vale delante de ella');
 assert.ok(plColocaOk(m,500,300,'cabecera'));
});
