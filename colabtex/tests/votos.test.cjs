const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto,TextEncoder};vm.createContext(context);vm.runInContext(code,context);
const {reducir,votacion,mayoriaExpulsion}=context;
const copia=x=>JSON.parse(JSON.stringify(x));
const mover=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p)};
const sala=(juego,n=2)=>({juego,semilla:1,estado:'jugando',cupo:n,
 jugadores:Object.fromEntries(['a','b','c','d','e','f'].slice(0,n).map((u,i)=>[u,{nombre:u,orden:i}])),jugadas:{}});
const voto=(de,contra,no)=>({t:'voto',uid:de,contra,...(no?{no:true}:{})});

test('la mayoría es la de los demás',()=>{
 assert.deepEqual([2,3,4,5,6].map(mayoriaExpulsion),[1,2,2,3,3]);
});
test('en un duelo basta el voto del otro, y es un abandono',()=>{
 for(const juego of ['reversi','orbita','cadena','cuadritos']){
  const p=sala(juego);const e=mover(p,voto('a','b'));
  assert.equal(e.fase,'fin',juego);assert.equal(e.ganador,'a',juego);assert.equal(e.motivo,'abandono',juego);
  assert.equal(e.expulsados.length,1);assert.equal(e.expulsados[0].uid,'b');assert.deepEqual(copia(e.expulsados[0].por),['a']);
 }
});
test('con cuatro hacen falta dos, y retirar el voto cuenta',()=>{
 const p=sala('cadena',4);
 let e=mover(p,voto('a','d'));assert.deepEqual(copia(e.votos),{d:['a']});assert.equal(e.expulsados.length,0);
 e=mover(p,voto('a','d'));assert.deepEqual(copia(e.votos),{d:['a']},'votar dos veces no suma');
 e=mover(p,voto('a','d',true));assert.deepEqual(copia(e.votos),{},'retirado');
 e=mover(p,voto('b','d'));e=mover(p,voto('c','d'));
 assert.equal(e.expulsados.length,1);assert.equal(e.expulsados[0].uid,'d');assert.ok(e.fuera.d);assert.equal(e.fase,'jugando');
 assert.deepEqual(copia(e.votos),{});
});
test('la mayoría se recalcula con quien sigue: tres, y luego dos',()=>{
 const p=sala('cuadritos',3);
 let e=mover(p,voto('a','c'));assert.equal(e.expulsados.length,0);
 e=mover(p,{t:'abandona',uid:'b'});assert.equal(e.fase,'jugando');
 /* Quedan a y c: el voto de a ya pendiente no expulsa solo por quedar dos;
    hace falta que alguien vote después de que cambie la cuenta. */
 assert.deepEqual(copia(e.votos),{c:['a']});assert.equal(e.expulsados.length,0);
 e=mover(p,voto('a','c'));
 assert.equal(e.expulsados.length,1);assert.equal(e.fase,'fin');assert.equal(e.ganador,'a');
});
test('ni el expulsado vota ni se vota a quien ya no está',()=>{
 const p=sala('cadena',3);
 mover(p,voto('a','c'));let e=mover(p,voto('b','c'));assert.equal(e.expulsados[0].uid,'c');
 e=mover(p,voto('c','a'));assert.deepEqual(copia(e.votos),{},'voto del expulsado');
 e=mover(p,voto('a','c'));assert.equal(e.expulsados.length,1,'no se expulsa dos veces');
 e=mover(p,voto('a','a'));assert.deepEqual(copia(e.votos),{},'a sí mismo no');
 e=mover(p,voto('x','a'));assert.deepEqual(copia(e.votos),{},'quien no juega no vota');
});
test('quien se va por su pie se lleva sus votos',()=>{
 const p=sala('cadena',4);
 mover(p,voto('d','a'));mover(p,voto('b','d'));let e=mover(p,{t:'abandona',uid:'d'});
 assert.deepEqual(copia(e.votos),{});
});
test('los votos del expulsado caen con él',()=>{
 const p=sala('cadena',5);
 mover(p,voto('e','a'));mover(p,voto('a','e'));mover(p,voto('b','e'));let e=mover(p,voto('c','e'));
 assert.equal(e.expulsados[0].uid,'e');assert.deepEqual(copia(e.votos),{});
});
test('los votos no llegan al reductor del juego',()=>{
 const p=sala('cadena',3);
 mover(p,{t:'p',uid:'a',f:0,c:0});const antes=copia(reducir(p));
 const e=mover(p,voto('b','c'));assert.equal(e.turno,antes.turno);assert.equal(e.movs,antes.movs);
 const V=votacion(p);assert.equal(Object.values(V.p.jugadas).some(j=>j.t==='voto'),false);
 assert.equal(Object.keys(V.p.jugadas).length,1);
 const sin=sala('cadena',3);assert.equal(votacion(sin).p,sin,'sin votos, la misma partida');
});
