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
