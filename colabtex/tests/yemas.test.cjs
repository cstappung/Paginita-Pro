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

// ---------- variantes ----------
const {ganoEn,equiposYemas}=context;
const salaEq=(n,variante,extra={})=>sala(n,{variante,...extra});
const mov=(p,t,uid,o={})=>mover(p,{t,uid,...o});

test('yemas: variante y meta por largo, con las salas viejas intactas',()=>{
 assert.equal(reducir(sala(3)).variante,'todos');
 assert.equal(reducir(salaEq(4,'equipos')).meta,30);
 assert.equal(reducir(salaEq(4,'equipos',{largo:0})).meta,20);
 assert.equal(reducir(salaEq(4,'bandera',{largo:2})).meta,5);
 assert.equal(reducir(salaEq(4,'bandera',{meta:25})).meta,3);   // la meta vieja solo vale en todos
 assert.equal(reducir(sala(3,{variante:'inventada'})).variante,'todos');
 assert.equal(reducir(sala(3)).equipos,null);
});

test('yemas: los equipos salen del asiento y ganoEn incluye a todo el equipo',()=>{
 const p=salaEq(4,'equipos');
 assert.deepEqual(copia(equiposYemas(p)),{a:'rojo',b:'azul',c:'rojo',d:'azul'});
 assert.equal(ganoEn(p,'eq:rojo','c'),true);
 assert.equal(ganoEn(p,'eq:rojo','b'),false);
 assert.equal(ganoEn(p,'a','a'),true);
 assert.equal(ganoEn(p,'',''),false);
 assert.equal(ganoEn({...p,juego:'uno'},'eq:rojo','a'),false);
});

test('yemas: por equipos suma el equipo y el fuego amigo no cuenta',()=>{
 const p=salaEq(4,'equipos',{largo:0});
 let e=muere(p,'c','a');                  // a y c son rojos
 assert.equal(e.bajas.a,0);assert.equal(e.muertes.c,1);assert.equal(e.puntosEq.rojo,0);
 for(let i=0;i<19;i++)e=muere(p,i%2?'b':'d',i%2?'a':'c');
 assert.equal(e.puntosEq.rojo,19);assert.equal(e.fase,'jugando');
 e=muere(p,'b','c');
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'eq:rojo');assert.equal(e.motivo,'equipo');
 assert.ok(progreso(reducir(salaEq(4,'equipos')), 'yemas')===0);
});

test('yemas: por equipos, si un equipo se queda vacío gana el otro',()=>{
 const p=salaEq(4,'equipos');
 mov(p,'abandona','b');assert.equal(reducir(p).fase,'jugando');
 const e=mov(p,'abandona','d');
 assert.equal(e.ganador,'eq:rojo');assert.equal(e.motivo,'abandono');
});

test('yemas: bandera, tomar, soltar al morir, devolver y capturar',()=>{
 const p=salaEq(4,'bandera',{largo:1});
 let e=mov(p,'toma','a',{b:'rojo'});        // la propia no se toma
 assert.equal(e.banderas.rojo.e,'base');
 e=mov(p,'toma','a',{b:'azul'});
 assert.equal(e.banderas.azul.e,'lleva');assert.equal(e.banderas.azul.uid,'a');
 e=mov(p,'toma','c',{b:'azul'});            // ya la lleva otro
 assert.equal(e.banderas.azul.uid,'a');
 e=muere(p,'a','b',{x:3.456,z:-12});
 assert.deepEqual(copia(e.banderas.azul),{e:'suelo',uid:'',x:3.46,z:-12});
 e=mov(p,'devuelve','a',{b:'azul'});        // un rojo no devuelve la azul
 assert.equal(e.banderas.azul.e,'suelo');
 e=mov(p,'devuelve','d',{b:'azul'});
 assert.equal(e.banderas.azul.e,'base');
 e=mov(p,'toma','c',{b:'azul'});
 e=mov(p,'toma','b',{b:'rojo'});
 e=mov(p,'captura','c',{b:'azul'});         // su bandera no está en casa
 assert.equal(e.capturas.c,0);
 e=muere(p,'b','a');                        // se cae la roja
 e=mov(p,'devuelve','x',{b:'rojo'});        // intruso: nada
 e=mov(p,'devuelve','b',{b:'rojo',auto:true});   // automática: la manda cualquiera
 assert.equal(e.banderas.rojo.e,'base');
 e=mov(p,'captura','c',{b:'azul'});
 assert.equal(e.puntosEq.rojo,1);assert.equal(e.capturas.c,1);assert.equal(e.banderas.azul.e,'base');
 assert.ok(e.hist.some(h=>h.e==='captura'&&h.uid==='c'));
});

test('yemas: bandera, gana el equipo que llega a la meta y quien abandona la suelta en casa',()=>{
 const p=salaEq(4,'bandera',{largo:0});
 mov(p,'toma','b',{b:'rojo'});
 let e=mov(p,'abandona','b');
 assert.equal(e.banderas.rojo.e,'base');
 mov(p,'toma','a',{b:'azul'});
 e=mov(p,'captura','a',{b:'azul'});
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'eq:rojo');assert.equal(e.motivo,'bandera');
 assert.equal(ganoEn(p,e.ganador,'c'),true);
});

// ---------- elegir equipo y granada ----------
test('yemas: cada uno elige su equipo antes de empezar',()=>{
 const p=salaEq(4,'equipos');
 mov(p,'equipo','a',{e:'azul'});mov(p,'equipo','b',{e:'rojo'});
 assert.deepEqual(copia(equiposYemas(p)),{a:'azul',b:'rojo',c:'rojo',d:'azul'});
 mov(p,'equipo','a',{e:'rojo'});                       // vale la última
 assert.equal(equiposYemas(p).a,'rojo');
 mov(p,'equipo','c',{e:'morado'});mov(p,'equipo','x',{e:'azul'});   // inválidas
 assert.equal(equiposYemas(p).c,'rojo');assert.equal(equiposYemas(p).x,undefined);
});

test('yemas: el equipo no se cambia a media partida y la victoria sigue la elección',()=>{
 const p=salaEq(4,'equipos',{largo:0});
 mov(p,'equipo','b',{e:'rojo'});mov(p,'equipo','c',{e:'azul'});   // rojos a,b; azules c,d
 muere(p,'c','a');
 mov(p,'equipo','a',{e:'azul'});                       // tarde: ya hubo una baja
 assert.equal(equiposYemas(p).a,'rojo');
 let e;for(let i=0;i<19;i++)e=muere(p,i%2?'c':'d',i%2?'a':'b');
 assert.equal(e.ganador,'eq:rojo');
 assert.equal(ganoEn(p,e.ganador,'b'),true);assert.equal(ganoEn(p,e.ganador,'c'),false);
});

test('yemas: si todos eligen el mismo equipo, se vuelve al asiento',()=>{
 const p=salaEq(4,'bandera');
 for(const u of ['a','b','c','d'])mov(p,'equipo',u,{e:'azul'});
 assert.deepEqual(copia(equiposYemas(p)),{a:'rojo',b:'azul',c:'rojo',d:'azul'});
 assert.equal(reducir(p).fase,'jugando');
});

test('yemas: una baja con granada (arma 3) cuenta y queda en el historial',()=>{
 const p=sala(3);
 const e=muere(p,'b','a',{a:3});
 assert.equal(e.bajas.a,1);assert.equal(e.hist.at(-1).a,3);
 assert.equal(muere(p,'c','a',{a:14}).hist.at(-1).a,0);
});

test('yemas: la autodestrucción (arma 4) le suma al que revienta y su propia muerte a nadie',()=>{
 const p=sala(3);
 muere(p,'b','a',{a:4});
 const e=muere(p,'a','a',{a:4});
 assert.equal(e.bajas.a,1);assert.equal(e.muertes.a,1);assert.equal(e.muertes.b,1);
 assert.equal(e.hist.at(-2).a,4);assert.equal(e.hist.at(-1).uid,'');
});

// ---------- armas tiradas en el mapa ----------
test('yemas: las armas del piso se las lleva la primera jugada, una aparición a la vez',()=>{
 const p=sala(3);
 let e=mov(p,'recoge','a',{s:2,g:0});
 assert.deepEqual(copia(e.armas),{2:{g:0,uid:'a'}});
 e=mov(p,'recoge','b',{s:2,g:0});                    // tarde: ya la tomó a
 assert.equal(e.armas[2].uid,'a');
 e=mov(p,'recoge','b',{s:2,g:2});                    // se salta una aparición
 assert.equal(e.armas[2].g,0);
 e=mov(p,'recoge','b',{s:2,g:1});
 assert.deepEqual(copia(e.armas[2]),{g:1,uid:'b'});
 for(const m of [{s:8,g:0},{s:-1,g:0},{s:'1',g:0},{s:1,g:0.5}])mov(p,'recoge','c',m);
 mov(p,'recoge','intruso',{s:1,g:0});
 assert.equal(reducir(p).armas[1],undefined);
});

test('yemas: bajas con sartén, bazuca y pistola (armas 5, 6 y 7)',()=>{
 const p=sala(3);
 for(const a of [5,6,7])muere(p,'b','a',{a});
 const e=reducir(p);
 assert.equal(e.bajas.a,3);
 assert.deepEqual(copia(e.hist.slice(-3).map(h=>h.a)),[5,6,7]);
 assert.equal(muere(p,'c','a',{a:14}).hist.at(-1).a,0);
});

const zsala=(n=3)=>sala(n,{variante:'zombis'});
const cae=(p,v,pts,o={})=>mover(p,{t:'muere',uid:v,por:'',a:9,cab:false,pts,zk:Math.floor(pts/60),r:1,...o});

test('yemas zombis: arranca en la ronda 1, sin equipos ni meta',()=>{
 const e=reducir(zsala(3));
 assert.equal(e.fase,'jugando');assert.equal(e.variante,'zombis');assert.equal(e.ronda,1);
 assert.equal(e.equipos,null);assert.equal(e.meta,0);assert.deepEqual(copia(e.caidos),[]);
});

test('yemas zombis: una ronda vale solo si es la siguiente, y levanta a los caídos',()=>{
 const p=zsala(3);
 let e=cae(p,'a',120);
 assert.deepEqual(copia(e.caidos),['a']);assert.equal(e.fase,'jugando');
 e=mover(p,{t:'ronda',uid:'b',r:3});assert.equal(e.ronda,1);          // se salta una: no vale
 e=mover(p,{t:'ronda',uid:'b',r:2});assert.equal(e.ronda,2);assert.deepEqual(copia(e.caidos),[]);
 e=mover(p,{t:'ronda',uid:'c',r:2});assert.equal(e.ronda,2);          // repetida: no hace nada
 assert.equal(e.hist.at(-1).e,'ronda');
 assert.ok(progreso(e,'yemas')===0);
 e=cae(p,'b',50);assert.ok(Math.abs(progreso(e,'yemas')-1/3)<1e-9);
});

test('yemas zombis: se acaba cuando caen todos a la vez y gana quien hizo más puntos',()=>{
 const p=zsala(3);
 cae(p,'a',300);cae(p,'b',900);
 let e=mover(p,{t:'ronda',uid:'c',r:2});   // a y b vuelven
 cae(p,'a',700,{r:2});cae(p,'c',200,{r:2});
 e=reducir(p);assert.equal(e.fase,'jugando');   // b sigue en pie
 e=cae(p,'b',1500,{r:2});
 assert.equal(e.fase,'fin');assert.equal(e.motivo,'zombis');assert.equal(e.ganador,'b');
 assert.equal(e.puntos.a,700);assert.equal(e.puntos.b,1500);assert.equal(e.ronda,2);
 assert.equal(e.muertes.a,2);assert.deepEqual(copia(e.bajas),{a:0,b:0,c:0});
 const antes=copia(e);cae(p,'a',99999);assert.deepEqual(copia(reducir(p)),antes);   // congelado
});

test('yemas zombis: los puntos solo suben, y sin puntos es empate',()=>{
 const p=zsala(2);
 cae(p,'a',400);mover(p,{t:'ronda',uid:'b',r:2});
 cae(p,'a',100);cae(p,'b',0);
 let e=reducir(p);assert.equal(e.puntos.a,400);assert.equal(e.ganador,'a');
 const q=zsala(2);cae(q,'a',0);e=cae(q,'b',0);
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'');
 for(const pts of [-5,1.5,'mil',1e12]){const r=zsala(2);assert.equal(cae(r,'a',pts).puntos.a,0);}
});

test('yemas zombis: quedarse solo no gana por abandono; caer solo sí termina',()=>{
 const p=zsala(3);
 mover(p,{t:'abandona',uid:'c'});let e=mover(p,{t:'abandona',uid:'b'});
 assert.equal(e.fase,'jugando');
 e=cae(p,'a',250);assert.equal(e.fase,'fin');assert.equal(e.ganador,'a');
 const q=zsala(2);cae(q,'a',800);e=mover(q,{t:'abandona',uid:'b'});   // el que quedaba en pie se va
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'a');
});

test('yemas zombis: nadie se anota bajas, aunque la muerte nombre a otro',()=>{
 const p=zsala(2);
 const e=mover(p,{t:'muere',uid:'a',por:'b',a:0,cab:true,pts:10,zk:0,r:1});
 assert.equal(e.bajas.b,0);assert.equal(e.cabezas.b,0);assert.equal(e.hist.at(-1).uid,'');
});

test('yemas: muertes con la espátula dorada (8) cuentan; el mordisco (9) y el Rayo batido (10) también se leen',()=>{
 const p=sala(3);
 let e=muere(p,'b','a',{a:8});assert.equal(e.bajas.a,1);assert.equal(e.hist.at(-1).a,8);
 e=muere(p,'c','b',{a:9});assert.equal(e.hist.at(-1).a,9);
 e=muere(p,'c','b',{a:10});assert.equal(e.hist.at(-1).a,10);
 e=muere(p,'c','b',{a:14});assert.equal(e.hist.at(-1).a,0);
});

test('yemas: los zombis se juegan de a uno; los demás modos piden dos',()=>{
 const z=sala(1,{variante:'zombis',cupo:4});
 assert.equal(reducir(z).fase,'espera');
 z.estado='jugando';const e=reducir(z);
 assert.equal(e.fase,'jugando');assert.equal(e.ganador,null);
 assert.equal(context.minimoDe(z),1);
 const t=sala(1,{cupo:4,estado:'jugando'});
 assert.equal(context.minimoDe(t),2);
 assert.equal(reducir(t).fase,'espera');
});
