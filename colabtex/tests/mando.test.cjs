/* Mandos (juegos/audio/mando.js): la parte pura, y la asignación de Tetris. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Mando=require('../../juegos/audio/mando.js');
const P=Mando._p;

test('la familia sale del id del mando',()=>{
 assert.equal(P.familia('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)'),'ps');
 assert.equal(P.familia('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'),'ps5');
 assert.equal(P.familia('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'),'xbox');
 assert.equal(P.familia('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)'),'nin');
 assert.equal(P.familia(''),'xbox');
});

test('cada familia nombra sus botones',()=>{
 assert.equal(P.glifo('ps','a'),'✕');assert.equal(P.glifo('ps','y'),'△');
 assert.equal(P.glifo('ps5','select'),'Create');assert.equal(P.glifo('ps','select'),'Share');
 assert.equal(P.glifo('xbox','rt'),'RT');assert.equal(P.glifo('nin','rt'),'ZR');
 assert.equal(P.glifo('nin','x'),'Y');assert.equal(P.glifo('xbox','dpad'),'✚');
});

test('normaliza: zona muerta y A/B de Nintendo por posición lógica',()=>{
 const b=new Array(17).fill(0);b[1]=1;   // botón de la derecha
 const n=P.normaliza({id:'Pro Controller 057e',botones:b,ejes:[0.1,-1,0,0]});
 assert.equal(n.fam,'nin');assert.equal(n.b.a,1);assert.equal(n.b.b,0);
 assert.equal(n.ejes.lx,0);assert.equal(n.ejes.ly,-1);
 const x=P.normaliza({id:'Xbox',botones:b,ejes:[]});
 assert.equal(x.b.b,1);assert.equal(x.b.a,0);
 assert.deepEqual(P.dirStick({lx:-0.8,ly:0.1}),{arriba:false,abajo:false,izq:true,der:false});
});

test('teclas sintéticas con key, code y keyCode',()=>{
 assert.deepEqual(P.tecla('Space'),{code:'Space',key:' ',keyCode:32});
 assert.deepEqual(P.tecla('KeyW'),{code:'KeyW',key:'w',keyCode:87});
 assert.deepEqual(P.tecla('Digit3'),{code:'Digit3',key:'3',keyCode:51});
 assert.equal(P.tecla('ArrowLeft').keyCode,37);
 assert.equal(P.asignacion(null),null);
 assert.deepEqual(P.asignacion('Enter'),{tecla:'Enter'});
 const f=()=>{};assert.equal(P.asignacion(f).baja,f);
});

test('las pistas se pintan con los glifos de la familia y escapadas',()=>{
 const h=P.pistasHtml([['a x','saltar <ya>']],'ps');
 assert.match(h,/✕/);assert.match(h,/□/);assert.match(h,/&lt;ya&gt;/);
 assert.ok(P.conSelect([['a','x']]).some(p=>p[0]==='select'));
 assert.equal(P.conSelect([['select','menú']]).length,1);
});

test('Tetris: el mando sigue a las teclas configuradas',()=>{
 const TM=require('../../juegos/club/tetris/motor.js');
 const m=TM.mandoTetris(TM.TECLAS_DEFECTO);
 for(const v of Object.values(m.botones))assert.equal(typeof v,'string');
 assert.equal(m.botones.izq,TM.TECLAS_DEFECTO.izq[0]);
 assert.equal(m.botones.a,TM.TECLAS_DEFECTO.gira[0]);
 assert.equal(m.botones.start,TM.TECLAS_DEFECTO.pausa[0]);
});
