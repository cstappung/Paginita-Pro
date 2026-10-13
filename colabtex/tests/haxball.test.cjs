const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto};vm.createContext(context);vm.runInContext(code,context);
const {reducir,minimoDe,ganoEn}=context;
const [JUEGOS,HB_METAS]=vm.runInContext('[JUEGOS,HB_METAS]',context);
const M=require('../../juegos/haxball/js/motor.js');
const copia=x=>JSON.parse(JSON.stringify(x));
const sala=(n=4,extra={})=>({juego:'haxball',semilla:1,estado:'jugando',cupo:n,
 jugadores:Object.fromEntries(['a','b','c','d','e','f','g','h'].slice(0,n).map((u,i)=>[u,{nombre:u,orden:i}])),jugadas:{},...extra});
const mover=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p)};

test('haxball: de 2 a 8, equipos por asiento',()=>{
 assert.equal(JUEGOS.haxball.cupo,8);
 assert.equal(minimoDe({juego:'haxball'}),2);
 const e=reducir(sala(4));
 assert.equal(e.fase,'jugando');
 assert.deepEqual(copia(e.equipos),{a:'rojo',b:'azul',c:'rojo',d:'azul'});
 assert.deepEqual([...HB_METAS],[3,5,7]);
 for(const m of [0,4,'x'])assert.equal(reducir(sala(2,{meta:m})).meta,5);
});

test('haxball: cada gol cuenta una vez y en orden',()=>{
 const p=sala(4,{meta:3});
 let e=mover(p,{t:'gol',uid:'a',e:'rojo',n:1,por:'c'});
 assert.equal(e.goles.rojo,1);assert.equal(e.puntos.c,1);
 e=mover(p,{t:'gol',uid:'b',e:'rojo',n:1,por:'c'});           // repetido por otro director
 assert.equal(e.goles.rojo,1);
 e=mover(p,{t:'gol',uid:'a',e:'azul',n:3,por:'b'});            // se salta uno
 assert.equal(e.goles.azul,0);
 e=mover(p,{t:'gol',uid:'a',e:'azul',n:2,por:'a'});            // en contra: sin autor
 assert.equal(e.goles.azul,1);assert.equal(e.puntos.a,0);
 e=mover(p,{t:'gol',uid:'zz',e:'rojo',n:3,por:'a'});           // un extraño no escribe
 assert.equal(e.goles.rojo,1);
 mover(p,{t:'gol',uid:'a',e:'rojo',n:3,por:'a'});
 e=mover(p,{t:'gol',uid:'a',e:'rojo',n:4,por:'a'});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'eq:rojo');assert.equal(e.motivo,'meta');
 assert.ok(ganoEn(p,e.ganador,'c'));assert.ok(!ganoEn(p,e.ganador,'b'));
 e=mover(p,{t:'gol',uid:'b',e:'azul',n:5,por:'b'});            // después del final, nada
 assert.equal(e.goles.azul,1);
});

test('haxball: un equipo sin nadie pierde',()=>{
 const p=sala(3);
 let e=mover(p,{t:'abandona',uid:'b'});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'eq:rojo');assert.equal(e.motivo,'abandono');
 const q=sala(4);
 e=mover(q,{t:'abandona',uid:'a'});assert.equal(e.fase,'jugando');
 e=mover(q,{t:'gol',uid:'a',e:'rojo',n:1,por:'a'});assert.equal(e.goles.rojo,0);  // ya se fue
});

const mundo=(eqs)=>{const m=M.crea();eqs.forEach((e,i)=>M.agrega(m,'u'+i,e));return m};

test('haxball motor: el saque deja a cada uno en su mitad',()=>{
 const m=mundo(['rojo','azul','rojo','azul']);M.alinea(m,'rojo');
 for(const [,j] of m.J)assert.ok(M.lado(j.e)*j.d.x>0,'cada uno en su mitad');
 for(let t=0;t<120;t++)M.paso(m,{u1:{x:-1,y:0}});
 const az=m.J.get('u1').d;assert.ok(az.x>=az.r-1e-9);
 assert.ok(Math.hypot(az.x,az.y)>=M.C.CIRCULO+az.r-1e-6,'el que no saca no pisa el círculo');
});

test('haxball motor: patada y gol en el arco derecho para el rojo',()=>{
 const m=mundo(['rojo']);M.alinea(m,'rojo');
 const j=m.J.get('u0').d;j.x=M.C.W-60;j.y=0;m.b.x=M.C.W-60+M.C.RJ+M.C.RB+2;m.b.y=0;m.saque=null;
 const ev=M.paso(m,{u0:{x:1,y:0,k:true}});
 assert.deepEqual(ev.patadas,['u0']);assert.ok(m.b.vx>4);
 let gol=null;for(let t=0;t<200&&!gol;t++)gol=M.paso(m,{}).gol;
 assert.ok(gol);assert.equal(gol.e,'rojo');assert.equal(gol.por,'u0');
});

test('haxball motor: gol en contra no tiene autor y la pelota rebota en las líneas',()=>{
 const m=mundo(['rojo']);M.alinea(m,null);
 m.b.x=-M.C.W+20;m.b.y=0;m.b.vx=-6;m.ult='u0';
 let gol=null;for(let t=0;t<100&&!gol;t++)gol=M.paso(m,{}).gol;
 assert.equal(gol.e,'azul');assert.equal(gol.por,'');
 const n=mundo([]);n.b.x=0;n.b.y=M.C.H-12;n.b.vy=5;
 const ev=M.paso(n,{});assert.ok(ev.rebote);assert.ok(n.b.vy<0);
 const f=mundo([]);f.b.x=M.C.W-12;f.b.y=M.C.G+40;f.b.vx=6;
 M.paso(f,{});assert.ok(f.b.vx<0,'fuera del arco la línea de fondo es pared');
});

test('haxball motor: los bots no se quedan quietos',()=>{
 const m=mundo(['rojo','azul']);M.alinea(m,'rojo');
 const en=M.bot(m,'u0','del',2);assert.ok(Math.hypot(en.x,en.y)>0.1);
 let toque=false;for(let t=0;t<600&&!toque;t++){toque=M.paso(m,{u0:M.bot(m,'u0','del',2),u1:M.bot(m,'u1','def',2)}).toque;}
 assert.ok(toque,'alguien toca la pelota');
});
