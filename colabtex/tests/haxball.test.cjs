const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto};vm.createContext(context);vm.runInContext(code,context);
const {reducir,minimoDe,ganoEn}=context;
const [JUEGOS,HB_METAS]=vm.runInContext('[JUEGOS,HB_METAS]',context);
const M=require('../../juegos/haxball/js/motor.js');
const copia=x=>JSON.parse(JSON.stringify(x));
const vacia=(n=4,extra={})=>({juego:'haxball',semilla:1,estado:'esperando',cupo:8,anfitrion:'a',
 jugadores:Object.fromEntries(['a','b','c','d','e','f','g','h'].slice(0,n).map((u,i)=>[u,{nombre:u,orden:i}])),jugadas:{},...extra});
const mover=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p)};
// Una sala ya empezada: cada uno se puso en su equipo (par rojo, impar azul) y el anfitrión arrancó.
const sala=(n=4,extra={})=>{
 const p=vacia(n,extra);
 Object.keys(p.jugadores).forEach((u,i)=>mover(p,{t:'equipo',uid:u,a:u,e:i%2?'azul':'rojo'}));
 mover(p,{t:'empieza',uid:'a'});p.estado='jugando';return p;
};

test('haxball: de 2 a 8, equipos elegidos en el vestíbulo',()=>{
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

test('haxball: la cancha va en mapa y por omisión es la clásica',()=>{
 assert.equal(reducir(sala(2)).cancha,'clasica');
 assert.equal(reducir(sala(2,{mapa:'futsal'})).cancha,'futsal');
 assert.equal(reducir(sala(2,{mapa:'patio'})).cancha,'clasica');
});

test('haxball motor: el disco frena al soltar la tecla',()=>{
 const m=mundo(['rojo']);M.alinea(m,null);
 for(let t=0;t<120;t++)M.paso(m,{u0:{x:1,y:0}});
 const d=m.J.get('u0').d,tope=d.vx;assert.ok(tope>2.2&&tope<2.6,'velocidad tope ~2.4');
 const x0=d.x;for(let t=0;t<60;t++)M.paso(m,{});
 assert.ok(d.x-x0<tope*15,'se detiene en menos de 15 ticks de recorrido');
});

test('haxball motor: futsal achica la pelota y los arcos, y se vuelve a la clásica',()=>{
 try{
  assert.equal(M.usaCancha('futsal'),'futsal');
  const m=M.crea();assert.equal(m.cancha,'futsal');
  assert.equal(m.b.r,6.25);assert.equal(m.b.im,1.5);
  assert.ok(M.POSTES.every(p=>Math.abs(p.y)===M.C.G)&&M.C.G<M.CANCHAS.clasica.G);
 }finally{M.usaCancha('clasica');}
 assert.equal(M.crea().b.r,M.CANCHAS.clasica.RB);
 assert.equal(M.usaCancha('nada'),'clasica');
});

test('haxball motor: el sprint acelera, se gasta, castiga al vaciarse y recarga',()=>{
 const m=mundo(['rojo']),n=mundo(['rojo']);M.alinea(m,null);M.alinea(n,null);
 for(let t=0;t<40;t++){M.paso(m,{u0:{x:0,y:1,s:true}});M.paso(n,{u0:{x:0,y:1}});}
 const a=m.J.get('u0'),b=n.J.get('u0');
 assert.ok(a.d.vy>b.d.vy*1.3,'con sprint va más rápido');
 assert.ok(a.en<1&&a.en>0);
 for(let t=0;t<30;t++)M.paso(m,{u0:{x:0,y:-1,s:true}});
 assert.equal(a.en,0);assert.ok(a.espera>0&&a.espera<M.C.SP_ESPERA);
 M.paso(m,{u0:{x:1,y:0,s:true}});assert.equal(a.sp,false,'vacío no esprinta');assert.equal(a.en,0,'no recarga durante la espera');
 while(a.espera>0)M.paso(m,{u0:{x:1,y:0,s:true}});
 for(let t=0;t<10;t++)M.paso(m,{u0:{x:1,y:0,s:true}});
 assert.equal(a.sp,false,'hay que soltar la tecla tras vaciarla');assert.ok(a.en>0,'recarga desde cero tras la espera');
 M.paso(m,{u0:{x:1,y:0}});M.paso(m,{u0:{x:1,y:0,s:true}});assert.equal(a.sp,true);
 const c=mundo(['rojo']);M.alinea(c,null);const j=c.J.get('u0');
 for(let t=0;t<20;t++)M.paso(c,{u0:{x:0,y:1,s:true}});
 const quedo=j.en;M.paso(c,{u0:{x:0,y:1}});
 assert.equal(j.en,quedo,'al soltar también hay espera');assert.ok(j.espera>0);
 while(j.espera>0)M.paso(c,{u0:{x:0,y:1}});
 M.paso(c,{u0:{x:0,y:1}});assert.ok(j.en>quedo,'después de la espera recarga');
 const e0=j.en;M.paso(c,{u0:{x:0,y:1,s:true}});M.paso(c,{u0:{x:0,y:1}});M.paso(c,{u0:{x:0,y:1,s:true}});
 assert.equal(j.sp,false,'apretar y soltar seguido no vuelve a correr durante la espera');assert.ok(j.en<e0);
 M.paso(c,{u0:{x:0,y:0,s:true}});assert.equal(j.sp,false,'quieto no gasta');
});

test('haxball vestíbulo: cada uno elige, el anfitrión mueve y arranca con uno por lado',()=>{
 const p=vacia(4);
 let e=reducir(p);assert.equal(e.fase,'equipos');assert.deepEqual(copia(e.equipos),{});assert.equal(e.anfitrion,'a');
 e=mover(p,{t:'equipo',uid:'b',a:'b',e:'azul'});assert.equal(e.equipos.b,'azul');
 e=mover(p,{t:'equipo',uid:'b',a:'c',e:'rojo'});assert.equal(e.equipos.c,undefined,'no mueve a otro');
 e=mover(p,{t:'equipo',uid:'a',a:'c',e:'rojo'});assert.equal(e.equipos.c,'rojo','el anfitrión sí');
 e=mover(p,{t:'empieza',uid:'b'});assert.equal(e.fase,'equipos','solo arranca el anfitrión');
 e=mover(p,{t:'equipo',uid:'a',a:'b',e:''});assert.equal(e.equipos.b,undefined,'vuelve a sin equipo');
 e=mover(p,{t:'empieza',uid:'a'});assert.equal(e.fase,'equipos','falta el azul');
 e=mover(p,{t:'equipo',uid:'d',a:'d',e:'azul'});
 e=mover(p,{t:'empieza',uid:'a'});assert.equal(e.fase,'jugando');
 e=mover(p,{t:'equipo',uid:'d',a:'d',e:'rojo'});assert.equal(e.equipos.d,'azul','empezado, no se cambia');
 e=mover(p,{t:'gol',uid:'b',e:'rojo',n:1,por:''});assert.equal(e.goles.rojo,0,'sin equipo no anota');
 e=mover(p,{t:'gol',uid:'c',e:'rojo',n:1,por:'c'});assert.equal(e.goles.rojo,1);
 assert.ok(ganoEn(p,'eq:rojo','c'));assert.ok(!ganoEn(p,'eq:rojo','b'));
});

test('haxball vestíbulo: nombres de equipo y anfitrión de repuesto',()=>{
 const p=vacia(3);
 let e=mover(p,{t:'nomeq',uid:'a',e:'rojo',nombre:'  Los   Pumas  '});assert.equal(e.nombresEq.rojo,'Los Pumas');
 e=mover(p,{t:'nomeq',uid:'b',e:'azul',nombre:'Hack'});assert.equal(e.nombresEq.azul,'Azul','solo el anfitrión');
 e=mover(p,{t:'nomeq',uid:'a',e:'azul',nombre:'x'.repeat(40)});assert.equal(e.nombresEq.azul.length,16);
 e=mover(p,{t:'nomeq',uid:'a',e:'rojo',nombre:''});assert.equal(e.nombresEq.rojo,'Rojo','vacío vuelve al de siempre');
 e=mover(p,{t:'abandona',uid:'a'});assert.equal(e.anfitrion,'b','si se va, manda el primer asiento');
 e=mover(p,{t:'equipo',uid:'b',a:'c',e:'azul'});assert.equal(e.equipos.c,'azul');
});

test('haxball: tiempo límite, gana el que va arriba y empatados hay gol de oro',()=>{
 assert.equal(reducir(sala(2)).tiempo,0);
 assert.equal(reducir(sala(2,{tiempo:4})).tiempo,0);
 const p=sala(2,{tiempo:3});
 let e=mover(p,{t:'tiempo',uid:'a',n:0});assert.equal(e.oro,true);assert.equal(e.fase,'jugando');
 e=mover(p,{t:'gol',uid:'b',e:'azul',n:1,por:'b'});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'eq:azul');assert.equal(e.motivo,'oro');
 const q=sala(2,{tiempo:5});
 mover(q,{t:'gol',uid:'a',e:'rojo',n:1,por:'a'});
 e=mover(q,{t:'tiempo',uid:'a',n:0});assert.equal(e.fase,'jugando','n desfasado no cuenta');
 e=mover(q,{t:'tiempo',uid:'b',n:1});assert.equal(e.ganador,'eq:rojo');assert.equal(e.motivo,'reloj');
 const r=sala(2);
 e=mover(r,{t:'tiempo',uid:'a',n:0});assert.equal(e.oro,false,'sin límite se ignora');
});

test('haxball: el sprint va por omisión y se puede apagar',()=>{
 assert.equal(reducir(sala(2)).sprint,true);
 assert.equal(reducir(sala(2,{sprint:0})).sprint,false);
 assert.equal(reducir(sala(2,{sprint:1})).sprint,true);
});

test('haxball vestíbulo: el líder ajusta la sala, pasa el mando y vuelve al vestíbulo',()=>{
 const p=vacia(3,{meta:5});
 let e=mover(p,{t:'ajuste',uid:'a',k:'meta',v:3});assert.equal(e.meta,3);
 e=mover(p,{t:'ajuste',uid:'a',k:'mapa',v:'grande'});assert.equal(e.cancha,'grande');
 e=mover(p,{t:'ajuste',uid:'a',k:'tiempo',v:5});assert.equal(e.tiempo,5);
 e=mover(p,{t:'ajuste',uid:'a',k:'sprint',v:0});assert.equal(e.sprint,false);
 e=mover(p,{t:'ajuste',uid:'b',k:'meta',v:7});assert.equal(e.meta,3,'solo el líder');
 e=mover(p,{t:'ajuste',uid:'a',k:'semilla',v:9});assert.equal(p.semilla,1);
 e=mover(p,{t:'lider',uid:'a',a:'b'});assert.equal(e.anfitrion,'b');
 e=mover(p,{t:'ajuste',uid:'a',k:'meta',v:7});assert.equal(e.meta,3,'el de antes ya no manda');
 mover(p,{t:'equipo',uid:'a',a:'a',e:'rojo'});mover(p,{t:'equipo',uid:'c',a:'c',e:'azul'});
 e=mover(p,{t:'empieza',uid:'b'});assert.equal(e.fase,'jugando');
 e=mover(p,{t:'ajuste',uid:'b',k:'meta',v:7});assert.equal(e.meta,3,'empezado no se ajusta');
 e=mover(p,{t:'gol',uid:'a',e:'rojo',n:1,por:'a'});assert.equal(e.goles.rojo,1);
 e=mover(p,{t:'vestibulo',uid:'a'});assert.equal(e.fase,'jugando','solo el líder corta');
 e=mover(p,{t:'vestibulo',uid:'b'});assert.equal(e.fase,'equipos');assert.equal(e.goles.rojo,0,'marcador a cero');
 e=mover(p,{t:'equipo',uid:'c',a:'c',e:'rojo'});assert.equal(e.equipos.c,'rojo','se vuelven a elegir equipos');
 mover(p,{t:'equipo',uid:'a',a:'a',e:'azul'});
 e=mover(p,{t:'empieza',uid:'b'});assert.equal(e.fase,'jugando');
 e=mover(p,{t:'gol',uid:'c',e:'rojo',n:1,por:'c'});assert.equal(e.goles.rojo,1,'partido nuevo: n vuelve a 1');
});

test('haxball vestíbulo: si el líder abandona manda el segundo en entrar',()=>{
 const p=vacia(3);
 mover(p,{t:'lider',uid:'a',a:'c'});
 let e=mover(p,{t:'abandona',uid:'c'});assert.equal(e.anfitrion,'a');
 e=mover(p,{t:'abandona',uid:'a'});assert.equal(e.anfitrion,'b');
});

test('haxball motor: la cancha grande es más grande con la física del futsal',()=>{
 try{
  M.usaCancha('grande');
  assert.ok(M.C.W>M.CANCHAS.clasica.W&&M.C.H>M.CANCHAS.clasica.H);
  assert.equal(M.C.RB,M.CANCHAS.futsal.RB);assert.equal(M.C.RJ,M.CANCHAS.clasica.RJ,'las fichas no se achican');
  const m=M.crea();M.agrega(m,'u0','rojo');M.alinea(m,'rojo');
  m.b.x=M.C.W-20;m.b.y=0;m.b.vx=6;m.saque=null;
  let gol=null;for(let t=0;t<60&&!gol;t++)gol=M.paso(m,{}).gol;
  assert.equal(gol&&gol.e,'rojo');
 }finally{M.usaCancha('clasica');}
});
