const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto};vm.createContext(context);vm.runInContext(code,context);
const {reducir,progreso,meToca}=context;
const copia=x=>JSON.parse(JSON.stringify(x));
const sala=(n=3,extra={})=>({juego:'yemas',semilla:1,estado:n>2?'jugando':'esperando',cupo:n,
 jugadores:Object.fromEntries(['a','b','c','d','e'].slice(0,n).map((u,i)=>[u,{nombre:u,orden:i}])),jugadas:{},...extra});
const mover=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p)};
const muere=(p,v,por,o={})=>mover(p,{t:'muere',uid:v,por,a:0,cab:false,...o});

test('yemas: espera, arranca y no le toca a nadie en particular',()=>{
 const p=sala(3);p.estado='esperando';assert.equal(reducir(p).fase,'espera');
 p.estado='jugando';const e=reducir(p);assert.equal(e.fase,'jugando');assert.equal(e.meta,15);
 assert.equal(meToca(e,'a'),false);
 assert.equal(reducir(sala(2)).fase,'jugando');   // un duelo arranca solo al llenarse
});

test('yemas: la meta se recorta a las que ofrece la sala',()=>{
 assert.equal(reducir(sala(3,{meta:10})).meta,10);
 assert.equal(reducir(sala(3,{meta:25})).meta,25);
 for(const m of [0,7,'x',1000,-3])assert.equal(reducir(sala(3,{meta:m})).meta,15);
});

test('yemas: cuenta bajas, muertes, cabezas y rachas',()=>{
 const p=sala(3);
 muere(p,'b','a',{cab:true});muere(p,'c','a');muere(p,'b','a',{a:2,cab:true});
 let e=muere(p,'a','c');
 assert.deepEqual(copia(e.bajas),{a:3,b:0,c:1});
 assert.deepEqual(copia(e.muertes),{a:1,b:2,c:1});
 assert.equal(e.cabezas.a,2);assert.equal(e.mejorRacha.a,3);assert.equal(e.racha.a,0);
 assert.equal(e.primera,'a');
 assert.equal(e.hist.at(-1).e,'baja');assert.equal(e.hist.at(-1).uid,'c');
 assert.ok(progreso(e,'yemas')>0);
});

test('yemas: suicidios, intrusos y asesinos que ya se fueron no suman',()=>{
 const p=sala(3);
 muere(p,'a','a');                       // se cayó solo
 muere(p,'b','intruso');                 // alguien que no está en la sala
 muere(p,'intruso','a');                 // una muerte de alguien que no juega
 mover(p,{t:'abandona',uid:'c'});
 let e=muere(p,'a','c');                 // c ya no está
 assert.deepEqual(copia(e.bajas),{a:0,b:0,c:0});
 assert.equal(e.muertes.a,2);assert.equal(e.muertes.b,1);
 e=muere(p,'c','a');                     // c ya no juega: su muerte no cuenta
 assert.equal(e.bajas.a,0);assert.equal(e.muertes.c,0);
});

test('yemas: gana el primero en llegar a la meta y el resultado se congela',()=>{
 const p=sala(3,{meta:10});
 let e;
 for(let i=0;i<9;i++)e=muere(p,i%2?'b':'c','a');
 assert.equal(e.fase,'jugando');
 for(let i=0;i<9;i++)e=muere(p,'a','b');
 e=muere(p,'c','a');
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'a');assert.equal(e.motivo,'meta');
 assert.equal(progreso(e,'yemas'),0);
 const antes=copia(e);
 muere(p,'a','b');muere(p,'a','b');mover(p,{t:'abandona',uid:'a'});
 assert.deepEqual(copia(reducir(p)),antes);
});

test('yemas: si quedan menos de dos, gana el que queda por abandono',()=>{
 const p=sala(3);muere(p,'b','a');
 mover(p,{t:'abandona',uid:'b'});assert.equal(reducir(p).fase,'jugando');
 const e=mover(p,{t:'abandona',uid:'a'});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'c');assert.equal(e.motivo,'abandono');
});

test('yemas: una expulsión por votos es un abandono',()=>{
 const p=sala(3);
 mover(p,{t:'voto',uid:'a',contra:'c'});
 const e=mover(p,{t:'voto',uid:'b',contra:'c'});
 assert.equal(e.fuera.c,true);assert.equal(e.fase,'jugando');
 assert.equal(muere(p,'a','c').bajas.c,0);
});

test('yemas: reproducir el registro da el mismo estado',()=>{
 const p=sala(4);
 for(let i=0;i<40;i++){const u=['a','b','c','d'];muere(p,u[i%4],u[(i*3+1)%4],{a:i%3,cab:i%5===0});}
 assert.deepEqual(copia(reducir(p)),copia(reducir(copia(p))));
 assert.ok(reducir(p).hist.length<=40);
});
