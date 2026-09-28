const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto,TextEncoder};vm.createContext(context);vm.runInContext(code,context);
const {reducir,blancoTetris}=context;
const TM=require('../../juegos/club/tetris/motor.js');
const sala=n=>({juego:'tetris',semilla:7,estado:'jugando',cupo:n,
 jugadores:Object.fromEntries(['a','b','c','d'].slice(0,n).map((u,i)=>[u,{nombre:u,orden:i}])),jugadas:{}});
const mover=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p)};

test('la basura se suma al blanco y se tope en 12 por ataque',()=>{
 const p=sala(3);
 let e=mover(p,{t:'ataque',uid:'a',a:'b',n:4});
 assert.equal(e.fase,'jugando');assert.equal(e.basura.b,4);
 e=mover(p,{t:'ataque',uid:'c',a:'c',n:99});
 assert.equal(e.basura.a,12,'un ataque a sí mismo va al siguiente, con tope');
});
test('el blanco salta a los caídos y el último en pie gana',()=>{
 const p=sala(3);
 let e=mover(p,{t:'cae',uid:'b',l:3,p:100});
 assert.equal(blancoTetris(e,'a'),'c');
 e=mover(p,{t:'ataque',uid:'a',a:'b',n:2});
 assert.equal(e.basura.c,2,'atacar a un caído redirige al siguiente vivo');
 e=mover(p,{t:'cae',uid:'c',l:1,p:10});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'a');assert.equal(e.motivo,'ultimo');
 e=mover(p,{t:'ataque',uid:'a',a:'b',n:2});
 assert.equal(e.hist.filter(h=>h.e==='ataque').length,1,'nada cuenta después del fin');
});
test('el motor: misma semilla, mismas piezas; la basura sube el pozo',()=>{
 const x=TM.crear({semilla:5}),y=TM.crear({semilla:5});
 assert.deepEqual(x.cola.slice(0,7),y.cola.slice(0,7));
 TM.recibe(x,3);assert.equal(TM.pendiente(x),3);
 for(let i=0;i<60&&!x.fin;i++)TM.caer(x);
 assert.ok(x.fin,'soltar sin parar acaba llenando el pozo');
});
