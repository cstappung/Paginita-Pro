const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto};vm.createContext(context);vm.runInContext(code,context);
const {reducir}=context;
const copia=x=>JSON.parse(JSON.stringify(x));
const sala=(semilla=123)=>({juego:'orbita',semilla,estado:'jugando',jugadores:{a:{nombre:'Ana',orden:0},b:{nombre:'Beto',orden:1}},jugadas:{}});
const mover=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p)};
test('espera, semilla reproducible y valores de estrellas',()=>{
 const p=sala();delete p.jugadores.b;assert.equal(reducir(p).fase,'espera');assert.equal(reducir(p).legales.length,0);
 assert.deepEqual(copia(reducir(sala()).estrellas),copia(reducir(sala()).estrellas));
 assert.notDeepEqual(copia(reducir(sala(1)).estrellas),copia(reducir(sala(2)).estrellas));
 assert.ok(reducir(sala()).estrellas.every(n=>n>=1&&n<=5));
});
test('captura y dirige al rival por fila o columna',()=>{
 const p=sala(),valor=reducir(p).estrellas[7];
 let e=mover(p,{t:'orbita',uid:'a',casilla:7,eje:'fila'});
 assert.equal(e.puntos.a,valor);assert.equal(e.turno,'b');assert.deepEqual(copia(e.legales),[6,8,9,10,11]);
 e=mover(p,{t:'orbita',uid:'b',casilla:8,eje:'columna'});assert.deepEqual(copia(e.legales),[2,14,20,26,32]);
});
test('rechaza índices, autores, ejes y turnos inválidos',()=>{
 const p=sala();
 for(const j of [{uid:'b',casilla:0,eje:'fila'},{uid:'a',casilla:-1,eje:'fila'},{uid:'a',casilla:36,eje:'fila'},
 {uid:'a',casilla:1.5,eje:'fila'},{uid:'a',casilla:'1',eje:'fila'},{uid:'a',casilla:0,eje:'diagonal'},{uid:'intruso',casilla:0,eje:'fila'}])mover(p,{t:'orbita',...j});
 mover(p,{t:'abandona',uid:'intruso'});assert.equal(Object.keys(reducir(p).tomadas).length,0);assert.equal(reducir(p).fase,'jugando');
 mover(p,{t:'orbita',uid:'a',casilla:0,eje:'fila'});mover(p,{t:'orbita',uid:'b',casilla:0,eje:'fila'});mover(p,{t:'orbita',uid:'b',casilla:10,eje:'fila'});
 assert.equal(Object.keys(reducir(p).tomadas).length,1);
});
test('un eje vacío abre la órbita; abandono congela el resultado',()=>{
 const p=sala();for(let i=0;i<6;i++)mover(p,{t:'orbita',uid:i%2?'b':'a',casilla:i,eje:'fila'});
 let e=reducir(p);assert.equal(e.libre,true);assert.equal(e.legales.length,30);
 e=mover(p,{t:'abandona',uid:'a'});assert.equal(e.ganador,'b');
 mover(p,{t:'orbita',uid:'b',casilla:6,eje:'columna'});assert.equal(Object.keys(reducir(p).tomadas).length,6);
});
test('100 partidas completas terminan, conservan puntos y convergen',()=>{
 let empates=0;
 for(let seed=1;seed<=100;seed++){
  const p=sala(seed);let e=reducir(p);
  for(let n=0;n<36;n++){assert.equal(e.fase,'jugando');e=mover(p,{t:'orbita',uid:e.turno,casilla:e.legales[(seed+n)%e.legales.length],eje:n%2?'fila':'columna'});}
  assert.equal(e.fase,'fin');assert.equal(e.legales.length,0);assert.equal(e.puntos.a+e.puntos.b,e.estrellas.reduce((a,b)=>a+b,0));
  assert.equal(e.ganador,e.puntos.a===e.puntos.b?'':e.puntos.a>e.puntos.b?'a':'b');if(e.ganador==='')empates++;
  assert.deepEqual(copia(e),copia(reducir(copia(p))));const antes=copia(e);mover(p,{t:'abandona',uid:e.ganador||'a'});assert.deepEqual(copia(reducir(p)),antes);
 }assert.ok(empates>0);
});
test('los cuatro juegos anteriores siguen arrancando',()=>{
 for(const juego of ['reversi','cuadritos','cartas','escondite']){const e=reducir({...sala(),juego});assert.equal(e.listos,true);assert.notEqual(e.fase,'fin');}
});
test('Escondite: escenarios densos reproducibles y coordenadas válidas',()=>{
 const a=context.escena(42),b=context.escena(42);
 assert.deepEqual(copia(a),copia(b));assert.equal(a.piezas.length,480);
 assert.equal(a.piezas.filter(x=>x.k==='persona').length,150);
 assert.equal(context.sitioValido({x:'0.5',y:.5}),false);
 assert.equal(context.sitioValido({x:.5,y:.5}),true);
});
test('Escondite: ropa persistida, turnos de búsqueda y resultado estable',()=>{
 const p={...sala(),juego:'escondite'};
 mover(p,{t:'r',uid:'a',x:.5,y:.5});assert.equal(reducir(p).sitios.a,undefined);
 mover(p,{t:'c',uid:'a',h:'a'});mover(p,{t:'c',uid:'b',h:'b'});
 mover(p,{t:'r',uid:'a',x:.5,y:.5,traje:3,at:10});
 mover(p,{t:'b',uid:'b',x:.5,y:.5,at:11});assert.notEqual(reducir(p).fase,'fin');
 mover(p,{t:'r',uid:'b',x:.7,y:.7,traje:5,at:12});assert.equal(reducir(p).sitios.b.traje,5);
 mover(p,{t:'b',uid:'intruso',x:.5,y:.5});assert.equal(reducir(p).fase,'buscar');
 mover(p,{t:'b',uid:'b',x:.5,y:.5,at:13});assert.equal(reducir(p).ganador,'b');
 mover(p,{t:'abandona',uid:'b'});assert.equal(reducir(p).ganador,'b');
});
test('meToca: por turnos, a la vez, esperando y terminada',()=>{
 const {meToca}=context;
 const p=sala();let e=reducir(p);
 assert.equal(meToca(e,'a'),true);assert.equal(meToca(e,'b'),false);assert.equal(meToca(e,'mirón'),false);assert.equal(meToca(e,''),false);
 e=mover(p,{t:'orbita',uid:'a',casilla:7,eje:'fila'});assert.equal(meToca(e,'a'),false);assert.equal(meToca(e,'b'),true);
 e=mover(p,{t:'abandona',uid:'a'});assert.equal(meToca(e,'b'),false,'terminada no llama a nadie');
 const q=sala();delete q.jugadores.b;assert.equal(meToca(reducir(q),'a'),false,'sola en la sala no hay turno');
 /* cartas: eligen a la vez, avisa a quien falta */
 const c={juego:'cartas',semilla:5,estado:'jugando',jugadores:{a:{nombre:'A',orden:0},b:{nombre:'B',orden:1}},jugadas:{}};
 e=reducir(c);assert.equal(meToca(e,'a'),true);assert.equal(meToca(e,'b'),true);
 c.jugadas['0000']={t:'c',uid:'a',h:'x'};e=reducir(c);assert.equal(meToca(e,'a'),false);assert.equal(meToca(e,'b'),true);
 /* escondite: al esconder avisa, al buscar no */
 const s={juego:'escondite',semilla:9,estado:'jugando',jugadores:{a:{nombre:'A',orden:0},b:{nombre:'B',orden:1}},jugadas:{}};
 e=reducir(s);assert.equal(e.fase,'esconder');assert.equal(meToca(e,'a'),true);
 s.jugadas['0000']={t:'c',uid:'a',h:'x'};assert.equal(meToca(reducir(s),'a'),false);assert.equal(meToca(reducir(s),'b'),true);
});
test('Circuit Breakers: turno rotando, primera foto vale, vivos y final',()=>{
 const {meToca}=context;
 const w=(n=3)=>({juego:'worms',semilla:1,estado:'jugando',cupo:n,jugadores:Object.fromEntries(['a','b','c'].slice(0,n).map((u,i)=>[u,{nombre:u,orden:i}])),jugadas:{}});
 const p=w();let e=reducir(p);
 assert.equal(e.fase,'jugando');assert.equal(e.turno,'a');assert.equal(meToca(e,'a'),true);
 e=mover(p,{t:'turno',uid:'a',k:1,s:'…',v:['a','b','c'],d:[30,0,0],ti:0});assert.equal(e.turno,'b');assert.equal(e.puntos.a,30);
 e=mover(p,{t:'turno',uid:'c',k:1,s:'…',v:['a'],d:[999,0,0],ti:2});assert.equal(e.turno,'b','una segunda foto del mismo turno no cuenta');assert.equal(e.turnos,1);
 e=mover(p,{t:'turno',uid:'b',k:2,s:'…',v:['a','c'],d:[30,10,0],ti:1});assert.equal(e.turno,'c');assert.deepEqual(copia(e.vivos),['a','c']);
 e=mover(p,{t:'turno',uid:'c',k:3,s:'…',v:['a','c'],d:[30,10,5],ti:2});assert.equal(e.turno,'a','salta a la cuadrilla caída');
 e=mover(p,{t:'turno',uid:'a',k:4,s:'…',v:['a'],d:[80,10,5],ti:0});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'a');assert.equal(e.motivo,'victoria');assert.equal(meToca(e,'a'),false);
 const q=w(2);mover(q,{t:'abandona',uid:'b'});e=reducir(q);assert.equal(e.ganador,'a');assert.equal(e.motivo,'abandono');
 const r=w(2);e=mover(r,{t:'turno',uid:'a',k:1,s:'…',v:[],d:[1,1],ti:0});assert.equal(e.ganador,'');assert.equal(e.motivo,'apagon');
 const z=w(3);z.estado='esperando';delete z.jugadores.c;assert.equal(reducir(z).fase,'espera','con cupo 3 y dos dentro espera al anfitrión');
});
test('progreso: de 0 a 1 según lo jugado, 0 fuera de juego',()=>{
 const {progreso}=context;
 const p=sala();let e=reducir(p);assert.equal(progreso(e,'orbita'),0);
 e=mover(p,{t:'orbita',uid:'a',casilla:7,eje:'fila'});assert.equal(progreso(e,'orbita'),1/36);
 const r={juego:'reversi',semilla:1,estado:'jugando',jugadores:{a:{nombre:'A',orden:0},b:{nombre:'B',orden:1}},jugadas:{}};
 e=reducir(r);assert.equal(progreso(e,'reversi'),0);
 const [f0,c0]=Object.keys(e.legales)[0].split(/\D+/).filter(Boolean).map(Number);e=mover(r,{t:'p',uid:e.turno,f:f0,c:c0});
 assert.ok(progreso(e,'reversi')>0&&progreso(e,'reversi')<.1,'una ficha puesta: '+progreso(e,'reversi'));
 const q={juego:'cuadritos',semilla:1,estado:'jugando',jugadores:{a:{nombre:'A',orden:0},b:{nombre:'B',orden:1}},jugadas:{}};
 e=reducir(q);assert.equal(progreso(e,'cuadritos'),0);
 assert.equal(progreso(reducir(sala()),'escondite'),0);assert.equal(progreso(null,'orbita'),0);
 const f=sala();mover(f,{t:'abandona',uid:'a'});assert.equal(progreso(reducir(f),'orbita'),0,'terminada ya no acelera');
});
