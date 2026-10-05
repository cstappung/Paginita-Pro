/* Antitrampas de BBTAN: partidas de robot jugadas con el mismo motor que el
   juego pasan (lentas, rápidas pero humanas, con bolas recogidas a mano,
   reanudadas desde la partida guardada), y cada vía de trampa se rechaza. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),fs=require('fs'),path=require('path');
const carga=(entry)=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const RUTA_MOTOR=path.join(__dirname,'../../juegos/club/bbtan/motor.js');
const M=require(RUTA_MOTOR);
const B=carga(path.join(__dirname,'../src/juegos/solo/verifica/bbtan.js'));
const V=carga(path.join(__dirname,'../src/juegos/solo/verifica.js'));
const MS=1000/240; // ms de reloj por tick a ×4
const minimo=t=>t*MS+400;
const CAT='club-bbtan-rondas';

/* El robot apunta probando `cand` ángulos sobre una copia del tablero y se
   queda con el que deja menos vida abajo (o, con `morir`, el peor). El
   reloj avanza lo mínimo que tarda cada tiro más `pausa(i)` ms: así se
   arman partidas lentas y rápidas. `recoger(i, ticks)` da el tick en que
   recoge a mano, o null. `gesto(i, cambio, rnd)` arma cómo «apuntó»: por
   defecto, una persona con ratón y ruido realista. */
const b36=n=>Math.max(0,Math.round(n)).toString(36);
const g=(o,espera,n,dur)=>o+b36(espera)+'.'+b36(n)+'.'+b36(dur);
// Una persona: mira el tablero 0,4–4 s, mueve el ratón varias veces y tarda en soltar.
const humano=(i,cambio,rnd)=>g('r',400+3600*rnd()*rnd(),cambio?2+Math.floor(rnd()*25):0,cambio?90+1400*rnd():0);
function valor(E){if(E.state==='over')return -1e12;let v=0;for(const b of E.blocks)v-=b.hp*Math.pow(2,(b.y-60)/60);return v+E.count*5;}
function elige(E,cand,morir){let best=null,bv=morir?Infinity:-Infinity;
 for(let k=0;k<cand;k++){const ang=M.ANG_MIN+200+Math.round((M.ANG_MAX-M.ANG_MIN-400)*(k+.5)/cand);const C=M.importa(M.exporta(E));const t=M.juegaTiro(C,[ang,0]);const v=valor(C);
  if(morir?v<bv:v>bv){bv=v;best={ang,ticks:t};}}
 return best;}
function robot({semilla=12345,u='robot',rondas=40,cand=8,morir=false,pausa=()=>900,recoger=()=>null,gesto=humano,E=null,t=0}={}){
 E=E||M.nueva(semilla,u);const rnd=M.rng(semilla^0xBEEF);
 for(let i=E.tiros.length;E.state==='aim'&&E.round<=rondas;i++){
  const {ang,ticks}=elige(E,cand,morir);const r=recoger(i,ticks);
  const tiro=r!==null&&r<ticks?[ang,Math.round(t),r]:[ang,Math.round(t)];
  const previo=i?E.tiros[i-1][0]:M.ANG_INICIAL;
  const hechos=M.juegaTiro(E,tiro,gesto(i,ang!==previo,rnd));assert.equal(typeof hechos,'number',String(hechos));
  t+=minimo(hechos)+pausa(i);
 }
 return {E,prueba:M.prueba(E),tiempo:Math.round(t)};
}
const dato=(puntos,tiempo)=>({categoria:CAT,puntos,tiempo,partida:'x'});
const json=x=>JSON.parse(JSON.stringify(x));

test('BBTAN: el motor no usa funciones que cada navegador redondea a su modo',()=>{
 const src=fs.readFileSync(RUTA_MOTOR,'utf8');
 const codigo=src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
 for(const f of ['sin','cos','tan','atan2','hypot','exp','log','pow','random'])assert.ok(!new RegExp('Math\\.'+f+'\\b').test(codigo),'Math.'+f);
 let err=0;for(let a=-3.2;a<3.2;a+=.0007){const [c,s]=M.sincos(a);err=Math.max(err,Math.abs(c-Math.cos(a)),Math.abs(s-Math.sin(a)));}
 assert.ok(err<1e-14,'sincos '+err);
});

test('BBTAN: una partida honesta se rehace exacta y pasa (dejada a medias, terminada, lenta, rápida)',async()=>{
 // Dejada a medias en la ronda 41 (Nueva partida): la ronda es la siguiente al último tiro.
 const a=robot({rondas:40});
 assert.equal(a.E.state,'aim');assert.equal(a.E.round,41);
 assert.equal(await B.verifica(dato(41,a.tiempo),json(a.prueba)),null);
 assert.equal(await V.verificaClub('bbtan',dato(41,a.tiempo),json(a.prueba)),null);
 // Terminada: el robot que apunta mal pierde pronto, y la ronda es la del último tiro.
 const b=robot({semilla:777,morir:true,rondas:500});
 assert.equal(b.E.state,'over');
 assert.equal(b.prueba.t.split(',').length,b.E.round);
 assert.equal(await B.verifica(dato(b.E.round,b.tiempo),json(b.prueba)),null);
 // Lenta: horas entre tiros.
 const c=robot({semilla:99,rondas:15,pausa:i=>i%3?60000:3600000});
 assert.equal(await B.verifica(dato(c.E.round,c.tiempo),json(c.prueba)),null);
 // Rápida pero posible: cada tiro justo a lo que tarda a ×4 más 1 ms (sin apuntar).
 const d=robot({semilla:4242,rondas:30,pausa:()=>1});
 assert.equal(await B.verifica(dato(d.E.round,d.tiempo),json(d.prueba)),null);
 // Con bolas recogidas a mano (a veces apenas lanzadas, tick 0).
 const e=robot({semilla:5150,rondas:30,recoger:(i,t)=>i%4===1&&t>60?40:i===7?0:null});
 assert.ok(e.prueba.t.split(',').some(x=>x.split('.').length===3));
 assert.equal(await B.verifica(dato(e.E.round,e.tiempo),json(e.prueba)),null);
});

test('BBTAN: el tiro corre igual a cualquier velocidad y en cualquier cuadro',()=>{
 /* El juego reparte los ticks entre cuadros según el dt y la velocidad
   (×1…×4) y puede recoger entre dos cuadros: el resultado es el de los
   ticks, que es lo que rehace el verificador. */
 const base=robot({semilla:31337,rondas:12}).E;
 const ang=-20000;
 const A=M.importa(M.exporta(base)),Bm=M.importa(M.exporta(base));
 M.dispara(A,ang,0);let acc=0,k=0;
 while(A.state==='shoot'){acc+=(.004+(k++%7)*.006)*(1+(k%4));while(acc>=M.TICK&&A.state==='shoot'){M.tick(A);acc-=M.TICK;}}
 const t=M.juegaTiro(Bm,[ang,0]);
 M.baja(A);
 assert.equal(A.ticks,t);assert.deepEqual(M.exporta(A),M.exporta(Bm));
 // Recoger a mano entre cuadros queda en la prueba con su tick y se repite igual.
 const C=M.importa(M.exporta(base)),D=M.importa(M.exporta(base));
 M.dispara(C,ang,0);for(let i=0;i<25;i++)M.tick(C);M.recoge(C,true);M.baja(C);
 assert.deepEqual(C.tiros.at(-1),[ang,0,25]);
 M.juegaTiro(D,[ang,0,25]);assert.deepEqual(M.exporta(C),M.exporta(D));
});

test('BBTAN: una partida reanudada (también con un tiro a medias) se prueba entera',async()=>{
 const a=robot({semilla:2024,rondas:20});
 // Lo que el juego guarda al empezar la ronda, de ida y vuelta por JSON.
 const guardada=json(M.exporta(a.E));
 const E=M.importa(guardada);assert.ok(E);
 // Recarga a media jugada: el tiro pendiente se juega entero al cargar.
 const {ang}=elige(E,8,false);const pend=[ang,a.tiempo];
 const ticks=M.juegaTiro(E,pend,g('r',1500,4,600));assert.equal(typeof ticks,'number');
 const sigue=robot({E,rondas:35,t:pend[1]+minimo(ticks)+50});
 assert.equal(await B.verifica(dato(sigue.E.round,sigue.tiempo),json(sigue.prueba)),null);
 // Una partida guardada con la ronda editada a mano ya no se carga.
 assert.equal(M.importa({...guardada,round:guardada.round+50}),null);
 assert.equal(M.importa({...guardada,t:guardada.t+',1aa.5'}),null);
 assert.equal(M.importa({...guardada,t:guardada.t+',1aa.5',h:guardada.h+',r1.1.1'}),null);
 // Una versión vieja (sin prueba) se carga solo en modo laxo, para terminarla sin reportar.
 assert.ok(M.importa({...guardada,t:''},true));assert.equal(M.importa({...guardada,t:''}),null);
});

test('BBTAN: trampas que se rechazan',async()=>{
 const a=robot({semilla:8080,rondas:35});const P=json(a.prueba),R=a.E.round,T=a.tiempo;
 assert.equal(await B.verifica(dato(R,T),P),null);
 // Club.result desde la consola, sin prueba (o con cualquier cosa).
 assert.match(await V.verificaClub('bbtan',dato(500,600000),undefined),/sin prueba/);
 assert.ok(await B.verifica(dato(500,600000),{}));
 assert.ok(await B.verifica(dato(500,600000),{v:1,s:1,u:'x',t:''}));
 // Ronda inflada con la prueba honesta.
 assert.match(await B.verifica(dato(R+1,T),P),/ronda/);
 assert.match(await B.verifica(dato(R+200,T),P),/tiros/);
 // Tiempo recortado (desempate): menos de lo que tarda la última jugada.
 assert.match(await B.verifica(dato(R,P.t?Math.round(T/3):1),P),/menos tiempo/);
 // Prueba de otra partida (otra semilla, otra cuenta) con el mismo resultado.
 assert.ok(await B.verifica(dato(R,T),{...P,s:(P.s+1)>>>0}));
 assert.ok(await B.verifica(dato(R,T),{...P,u:'otra-cuenta'}));
 assert.match(await B.verifica(dato(R,T),P,{uid:'otra-cuenta'}),/otra cuenta/);
 assert.equal(await B.verifica(dato(R,T),P,{uid:'robot'}),null);
 // Tiros de más pegados tras el final de una partida perdida.
 const b=robot({semilla:777,morir:true,rondas:500});const Pb=json(b.prueba);
 const extra=Pb.t+',ehg.5dc,ehg.5dc,ehg.5dc',hx=Pb.h+',r1z4.5.2s,r1z4.0.0,r1z4.0.0';
 assert.match(await B.verifica(dato(b.E.round+3,b.tiempo+90000),{...Pb,t:extra,h:hx}),/después del final/);
 assert.match(await B.verifica(dato(b.E.round+3,b.tiempo+90000),{...Pb,t:extra}),/apuntaron/);
 // Tiros imposiblemente rápidos: los mismos ángulos, 100 ms entre uno y otro.
 const tiros=M.decodifica(P.t).map((x,i)=>[x[0],i*100,...x.slice(2)]);
 assert.match(await B.verifica(dato(R,tiros.length*100+500),{...P,t:M.codifica(tiros)}),/menos tiempo/);
 // Instantes hacia atrás, ángulo fuera de rango, recoger después de que volvieron.
 const atras=M.decodifica(P.t);atras[5][1]=atras[4][1]-1000;
 assert.match(await B.verifica(dato(R,T),{...P,t:M.codifica(atras)}),/hacia atrás/);
 const fuera=M.decodifica(P.t);fuera[0][0]=-100;
 assert.match(await B.verifica(dato(R,T),{...P,t:M.codifica(fuera)}),/ángulo/);
 const tarde=M.decodifica(P.t);tarde[0][2]=M.TOPE-1;
 assert.match(await B.verifica(dato(R,T),{...P,t:M.codifica(tarde)}),/recogi/);
 assert.ok(await B.verifica(dato(R,T),{...P,t:P.t.replace(/,/,';')}));
 /* La partida guardada editada para seguir con ventaja: más bolas y el
   tablero vacío desde la ronda 10. El robot sigue sobre ese tablero
   falso, pero el verificador rehace la partida verdadera desde la semilla
   y los mismos tiros no llevan a la misma ronda. */
 const c=robot({semilla:6060,rondas:10});
 c.E.count=200;c.E.blocks.forEach(x=>x.hp=1);c.E._celdas=null;
 const tramposo=robot({E:c.E,rondas:40,t:c.tiempo});
 assert.ok(tramposo.E.round>=40);
 assert.match(await B.verifica(dato(tramposo.E.round,tramposo.tiempo),json(tramposo.prueba)),/ronda|después del final/);
});

test('BBTAN: los bots se notan y las personas rápidas pasan',async()=>{
 const juega=(gesto,semilla=1357)=>robot({semilla,rondas:30,gesto,pausa:()=>300});
 const pasa=async a=>assert.equal(await B.verifica(dato(a.E.round,a.tiempo),json(a.prueba)),null);
 // Muy rápida pero humana: reacción de 180–500 ms, gesto de 45–250 ms, a veces teclado.
 await pasa(juega((i,c,r)=>g(r()<.3?'k':'r',180+320*r(),c?1+Math.floor(r()*6):0,c?45+205*r():0)));
 // Con el dedo y con mando (que apunta a saltos y dispara con un evento propio).
 await pasa(juega((i,c,r)=>g('t',300+2000*r(),c?1+Math.floor(r()*9):0,c?60+600*r():0)));
 await pasa(juega((i,c,r)=>g('m',100,c?3:0,c?10:0)));
 // Una sola señal no basta: quien dispara muy rápido pero apunta como persona.
 await pasa(juega((i,c,r)=>g('r',90+80*r(),c?2+Math.floor(r()*10):0,c?120+500*r():0)));
 // Un bot con eventos de verdad (CDP/xdotool): reacción fija de 50 ms, apunta de un salto.
 const bot=juega((i,c)=>g('r',50,c?1:0,0));
 assert.match(await B.verifica(dato(bot.E.round,bot.tiempo),json(bot.prueba)),/no parecen de una persona/);
 // Uno que espera algo al azar pero apunta y dispara en el mismo instante, y con poca variación.
 const bot2=juega((i,c,r)=>g('r',120+10*r(),c?1:0,c?5:0));
 assert.match(await B.verifica(dato(bot2.E.round,bot2.tiempo),json(bot2.prueba)),/no parecen de una persona/);
 // Un script que despacha eventos (isTrusted = false, sin mando).
 const sint=juega((i,c,r)=>g(i===12?'x':'r',800+900*r(),c?5:0,c?300:0));
 assert.match(await B.verifica(dato(sint.E.round,sint.tiempo),json(sint.prueba)),/script/);
 // El ángulo cambió sin que nadie apuntara (estado tocado desde la consola).
 const quieto=juega((i,c,r)=>g('k',800+900*r(),0,0));
 assert.match(await B.verifica(dato(quieto.E.round,quieto.tiempo),json(quieto.prueba)),/sin que nadie apuntara/);
});

test('BBTAN: la prueba es chica y cabe de sobra',()=>{
 // Mil rondas con los campos más largos posibles: ángulo de 4 cifras, minutos entre tiros, recogida.
 const tiros=Array.from({length:1000},(_,i)=>[M.ANG_MIN,i*600000,M.TOPE-1]);
 const p={v:1,s:4294967295,u:'x'.repeat(28),t:M.codifica(tiros),h:Array(1000).fill('r'+(36**5-1).toString(36)+'.zz.'+(36**5-1).toString(36)).join(',')};
 assert.ok(JSON.stringify(p).length<40000,JSON.stringify(p).length);
 assert.deepEqual(M.decodifica(p.t),tiros);
});

test('BBTAN: sospecha de filas guardadas sin prueba',()=>{
 assert.equal(B.sospecha(CAT,{puntos:120,tiempo:120*3000}),null);
 assert.equal(B.sospecha(CAT,{puntos:12,tiempo:9000}),null);
 assert.equal(B.sospecha(CAT,{puntos:400,tiempo:400*1500}),null);
 assert.match(B.sospecha(CAT,{puntos:500,tiempo:60000}),/0,4 s/);
 assert.match(B.sospecha(CAT,{puntos:100,tiempo:60000}),/por ronda/);
 assert.ok(B.sospecha(CAT,{puntos:1.5,tiempo:1}));
 assert.equal(B.sospecha('club-minas-easy',{puntos:1,tiempo:1}),null);
 // Un robot de verdad queda bien lejos del umbral de 0,9 s por ronda.
 const a=robot({semilla:2525,rondas:60,pausa:()=>1});
 assert.equal(B.sospecha(CAT,{puntos:a.E.round,tiempo:a.tiempo}),null);
 assert.ok(a.tiempo/(a.E.round-1)>1500,String(a.tiempo/(a.E.round-1)));
});
