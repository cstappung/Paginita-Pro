/* Metro Rush: el fantasma (juegos/club/metrorush/fantasma.js, y su parte en
   juego.js y prueba.js).

   Lo que se fija aquí:
   - el rastro (x, altura y qué hace, cada 0,1 s) se escribe y se lee igual,
     con los carriles justos y las repeticiones juntas, y lo que no es un
     rastro se reconoce como tal;
   - una carrera larga entra holgada en el tope de la prueba (MAX_FANTASMA),
     y un rastro recortado a ese tope se sigue leyendo;
   - entre dos muestras la posición se interpola;
   - una carrera con rastro se rehace y da los mismos puntos que sin él; un
     rastro ilegible, o más largo que la carrera, se rechaza (lo único que
     el antitrampas mira de él);
   - los puntos del fantasma metro a metro dan lo mismo que rehace;
   - correr contra un fantasma da SU pista: las funciones de juego.js
     (generaPista, pideTunel, pideBoleto, sacadas tal cual del archivo)
     repiten sus túneles y boletos en el mismo punto aunque se corra a otro
     ritmo de cuadros y con otros boletos, y la prueba de esa carrera se
     rehace;
   - el clásico no graba rastro, y la página lee la prueba solo por clave;
   - el fantasma es la carrera MÁS LARGA de su mundo (modo normal, sin
     ayudas o fantasma) y se corre con SUS reglas (conReglas, `pm` en la
     prueba); la carrera se compite en metros (metrosEn) y va a la tabla de
     distancia. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const DIR=path.join(__dirname,'../../juegos/club/metrorush');
const M=require(path.join(DIR,'motor.js')),MP=require(path.join(DIR,'prueba.js')),F=require(path.join(DIR,'fantasma.js'));
const cargaEsm=entry=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const MV=cargaEsm('src/juegos/solo/verifica/metrorush.js');
const JS=fs.readFileSync(path.join(DIR,'juego.js'),'utf8');
const copia=x=>JSON.parse(JSON.stringify(x));

/* Las funciones de la pista del fantasma, sacadas TAL CUAL de juego.js (de
   «function generaPista» hasta «el paso del fantasma») y puestas en un
   contexto con la carrera `c`, la prueba y anotaPedido, como en la página. */
function funcionesPista(){
 const i=JS.indexOf('function generaPista'),j=JS.indexOf('/* ---- el paso del fantasma');
 assert.ok(i>0&&j>i,'juego.js tiene generaPista … pideBoleto');
 const ctx={MP,M,console:{warn(){}},c:null};vm.createContext(ctx);
 vm.runInContext('function anotaPedido(tipo,...datos){MP.pedido(c.prueba,tipo,c.gen.estado().dSig,...datos);}\n'+JS.slice(i,j)+
  ';globalThis.__P={generaPista,pideTunel,pideBoleto,poneC:x=>{c=x;}};',ctx);
 return ctx.__P;
}
/* Lo que juego.js guarda de un fantasma durante la carrera (nuevoFan). */
const nuevoFan=g=>({g,pi:0,reclamados:new Set(),diverge:false});

/* Un corredor simulado como juego.js: cuadros de duración al azar, la pista
   por delante (generaPista), los túneles a la estación siguiente cuando
   faltan menos de 220 m y su boleto al salir del túnel (si no lo tiene),
   estrellas recogidas, cambios de carril y saltos con su rastro, y un choque
   a los `muere` segundos. Con `contra` (un fantasma preparado) corre su pista. */
function corre(modo,o={}){
 // las reglas: en un modo fantasma, las del fantasma que se persigue (o las pedidas); la versión, la suya
 const reglas=o.contra?o.contra.reglas:o.reglas,version=o.contra?o.contra.version:MP.VERSION;
 const MO=M.MODOS[modo].fantasma&&reglas?M.conReglas(modo,reglas):M.modoDe(modo);
 const P=funcionesPista(),curva=M.velocidadDe(MO,version),mundo=M.mundoDe(modo);
 const op=Object.assign({semilla:777,base:3,u:'uid-robot',muere:200,boletos:[],dtMin:0.008,dtMax:0.05,az:1},o);
 let az=op.az>>>0||1;const azar=()=>((az=(az*1664525+1013904223)>>>0)/4294967296);
 const semilla=o.contra?o.contra.semilla:op.semilla;
 const c={prueba:MP.nueva({s:semilla,b:op.base,md:0,u:op.u,m:modo,pm:MO.reglas,v:version}),gen:M.crearGenerador(semilla,{modo:MO,version}),version,fan:o.contra?nuevoFan(o.contra):null,D:0};
 P.poneC(c);
 const st={t:0,r:0,puntos:0,estrellas:0},objs=[],tomados=new Set(),boletos=new Set(op.boletos),grab=M.distanciaDe(MO)?F.crearGrabador():null;
 let estacion=M.estacionDe(0,modo),cambio=null,tunel=null,rk=0,sig=MP.PASO_MUESTRA;
 const r={carril:1,x:0,y:0,vy:0,rodar:0};
 const anota=(cod,x)=>MP.evento(c.prueba,cod,st.t,c.D,st.r,x);
 const agrega=l=>{for(const ob of l)objs.push(ob);};
 agrega(P.generaPista(230,{V:curva.velocidad(0)}));
 if(estacion.boleto&&mundo.boletos&&mundo.boletos[estacion.boleto]&&!boletos.has(estacion.boleto))P.pideBoleto(estacion.boleto,420);
 for(let paso=0;paso<400000;paso++){
  const dt=op.dtMin+azar()*(op.dtMax-op.dtMin);st.t+=dt;st.r+=dt*1000+azar()*2;
  const V=curva.velocidad(st.t),dD=V*dt;c.D+=dD;
  st.puntos+=M.puntosPorTramo(dD,M.multiplicador({base:op.base,estrellas:st.estrellas,doble:false,extra:0,fijo:MO.multFijo}));   // (con las reglas de Sin ayudas, ×10 fijo)
  agrega(P.generaPista(c.D+230,{V:Math.max(13,V)}));
  // el choque
  if(st.t>=op.muere){anota('m');c.D=Math.max(0,c.D-0.35);for(let k=0;k<60;k++){st.t+=0.016;st.r+=16;}anota('f');break;}
  // las estaciones, como estaciones() en juego.js
  const umbral=M.siguienteUmbral(c.D,modo),e=M.estacionDe(umbral-c.D<220?umbral:c.D,modo);
  if(!cambio&&e.clave!==estacion.clave){cambio=e;tunel=null;P.pideTunel(c.D+40,e.id);}
  if(cambio&&!tunel)tunel=objs.find(ob=>ob.tipo==='tunel'&&ob.d0+ob.largo>c.D&&ob.estacion===cambio.id)||null;
  if(cambio&&tunel&&c.D>=tunel.d0+40){estacion=cambio;cambio=null;
   if(estacion.boleto&&mundo.boletos&&mundo.boletos[estacion.boleto]&&!boletos.has(estacion.boleto))P.pideBoleto(estacion.boleto,tunel.d0+tunel.largo+260);}
  // estrellas
  for(const ob of objs)if(ob.tipo==='estrella'&&!tomados.has(ob.id)&&Math.abs(ob.d-c.D)<=1.0){tomados.add(ob.id);anota('e',ob.id);st.estrellas=Math.min(M.MAX_ESTRELLAS,st.estrellas+1);}
  // de lado y arriba (solo para el rastro: el robot no esquiva, no choca)
  if(azar()<0.01)r.carril=Math.max(0,Math.min(2,r.carril+(azar()<0.5?-1:1)));
  const xo=M.CARRILES[r.carril],vl=2.2/M.FISICA.cambioCarril;r.x+=Math.max(-vl*dt,Math.min(vl*dt,xo-r.x));
  if(r.y<=0&&azar()<0.006){r.vy=M.impulso(M.FISICA.alturaSalto);}
  if(r.y>0||r.vy>0){r.vy-=M.FISICA.gravedad*dt;r.y=Math.max(0,r.y+r.vy*dt);if(r.y===0)r.vy=0;}
  if(r.rodar>0)r.rodar-=dt;else if(r.y===0&&azar()<0.004)r.rodar=M.FISICA.tiempoRodar;
  if(grab){const s=r.rodar>0?3:r.y>0?(r.vy>0?1:2):0;while(st.t>=rk*F.PASO){grab.muestra(r.x,r.y,s);rk++;}}
  if(st.t>=sig){anota('w');sig=st.t+MP.PASO_MUESTRA;}
 }
 const prueba=MP.cierra(c.prueba,{sn:0});
 if(grab)MP.ponFantasma(prueba,grab.texto());
 return {prueba,objs,c,MO,puntos:Math.floor(st.puntos),metros:Math.floor(c.D),tiempo:Math.max(1,Math.round(st.t*1000)),boletosPedidos:prueba.i.filter(q=>q[0]==='B').map(q=>q[2])};
}

test('el rastro se escribe y se lee igual (carriles justos, repeticiones juntas)',()=>{
 // los tres carriles caen justo en una letra: no se corren al leerlos
 for(const x of M.CARRILES){const r=F.decodifica(F.codifica([[x,0,0]]));assert.ok(Math.abs(r.x[0]-x)<1e-6,'carril '+x);}
 assert.equal(F.codifica([[0,0,0]]),'1W00');
 assert.equal(F.codifica(Array(7).fill([0,0,0])),'1W00~4','siete iguales: una muestra y ~ con 6');
 assert.equal(F.cuenta('1W00.~3'),7);
 // más de 65 repeticiones se parten en varias fichas, sin perder ninguna
 for(const n of [1,2,3,66,67,68,200,1000]){const t=F.codifica(Array(n).fill([2.2,1.5,1]));assert.equal(F.cuenta(t),n,n+' muestras');}
 // ida y vuelta, con la cuantización (0,1 m de lado, 0,15 m de alto)
 const ms=[];for(let i=0;i<500;i++)ms.push([Math.sin(i/9)*2.5,Math.abs(Math.sin(i/13))*4,i%5]);
 const r=F.decodifica(F.codifica(ms));assert.equal(r.n,500);
 for(let i=0;i<500;i++){assert.ok(Math.abs(r.x[i]-ms[i][0])<=0.051,'x '+i);assert.ok(Math.abs(r.y[i]-ms[i][1])<=0.076,'y '+i);assert.equal(r.s[i],ms[i][2]);}
 // fuera de rango se recorta, no se rompe
 const fuera=F.decodifica(F.codifica([[-9,-3,9],[9,99,-1]]));assert.ok(Math.abs(fuera.x[0]-F.X0)<1e-6&&fuera.y[0]===0&&fuera.s[0]===4&&fuera.s[1]===0&&Math.abs(fuera.y[1]-63*F.QY)<1e-5);
 // lo que no es un rastro
 for(const malo of ['','2W00','W00','1.W00','1~3','1W0$','1W05','1W00~$',null,42,[1]])assert.equal(F.cuenta(malo),-1,JSON.stringify(malo));
 // una ficha cortada al final (el tope de la prueba) se ignora
 assert.equal(F.cuenta('1W00W1'),1);assert.equal(F.cuenta('1W00~'),1);assert.equal(F.duracion('1W00.~3'),0.7000000000000001);
});

test('una carrera larga cabe en el tope de la prueba, y recortada se sigue leyendo',()=>{
 // el peor caso: una muestra distinta cada décima, 10 minutos
 const peor=[];for(let i=0;i<6000;i++)peor.push([(i%64)*F.QX+F.X0,(i*7%64)*F.QY,i%5]);
 const tPeor=F.codifica(peor);assert.equal(tPeor.length,1+6000*3);assert.ok(tPeor.length<MP.MAX_FANTASMA,'10 min en el peor caso: '+tPeor.length);
 // una carrera de verdad (el robot de 200 s, con cambios de carril, saltos y rodadas) ocupa poco
 const r=corre('fantasma');assert.ok(r.prueba.g.length<6000,'200 s de robot: '+r.prueba.g.length+' letras');
 assert.ok(JSON.stringify(r.prueba).length<200000,'la prueba entera bajo PRUEBA_MAX');
 // 40 minutos del peor caso se recortan al tope y el rastro se sigue leyendo (más corto)
 const enorme=[];for(let i=0;i<24000;i++)enorme.push([(i%64)*F.QX+F.X0,(i*11%64)*F.QY,i%5]);
 const p={};MP.ponFantasma(p,F.codifica(enorme));assert.equal(p.g.length,MP.MAX_FANTASMA);
 const n=F.cuenta(p.g);assert.ok(n>0&&n<24000,'recortado: '+n+' muestras');
 assert.ok(F.MAX_MUESTRAS>=36000);
});

test('entre dos muestras la posición se interpola',()=>{
 const r=F.decodifica(F.codifica([[0,0,0],[0,0,0],[2.2,1.5,1],[2.2,3,2],[2.2,0,3],[2.2,0,3],[2.2,0,3]]));
 const a=F.estadoEn(r,0.15);assert.ok(Math.abs(a.x-1.1)<1e-6,'a medio camino de carril');assert.ok(Math.abs(a.y-0.75)<1e-6);assert.equal(a.s,0);assert.equal(a.fin,false);
 const b=F.estadoEn(r,0.25);assert.ok(Math.abs(b.y-2.25)<1e-6);assert.equal(b.s,1);
 const fin=F.estadoEn(r,5);assert.equal(fin.fin,true);assert.ok(Math.abs(fin.x-2.2)<1e-6);assert.equal(fin.s,3);
 assert.ok(Math.abs(F.desdeEn(r,0.65)-0.4)<1e-9,'rueda desde la muestra 4');
 assert.equal(F.estadoEn(null,1),null);assert.equal(F.estadoEn(F.decodifica('1'),1),null);
});

test('con rastro la carrera se rehace igual; un rastro incoherente se rechaza',()=>{
 for(const modo of ['fantasma','cityfantasma']){
  const r=corre(modo,{muere:90}),re=MP.rehace(r.prueba);
  assert.equal(re.motivo,undefined,modo+': '+re.motivo);assert.ok(Math.abs(re.puntos-r.puntos)<=1);assert.equal(re.metros,r.metros);
  const sin=copia(r.prueba);delete sin.g;assert.equal(MP.rehace(sin).puntos,re.puntos,'el rastro no suma ni quita');
  assert.equal(MV.verifica({categoria:M.MODOS[modo].categoria,puntos:r.metros,tiempo:r.tiempo,partida:'x'},r.prueba,{uid:'uid-robot'}),null,modo);
  assert.ok(Math.abs(F.duracion(r.prueba.g)-90)<0.3,'el rastro termina en el choque: '+F.duracion(r.prueba.g));
 }
 const r=corre('fantasma',{muere:60});
 const ilegible=copia(r.prueba);ilegible.g='1W0$';assert.match(MP.rehace(ilegible).motivo,/rastro del fantasma no se puede leer/);
 const otra=copia(r.prueba);otra.g='2W00';assert.match(MP.rehace(otra).motivo,/no se puede leer/);
 const largo=copia(r.prueba);largo.g=F.codifica(Array(700).fill([0,0,0]));assert.match(MP.rehace(largo).motivo,/dura más que la carrera/);
 const justo=copia(r.prueba);justo.g=F.codifica(Array(615).fill([0,0,0]));assert.equal(MP.rehace(justo).motivo,undefined,'2 s de holgura');
 // el rastro no decide nada más: uno con otros movimientos da los mismos puntos
 const otro=copia(r.prueba);otro.g=F.codifica(Array(300).fill([2.2,6,4]));assert.equal(MP.rehace(otro).puntos,MP.rehace(r.prueba).puntos);
});

test('los puntos del fantasma metro a metro dan lo mismo que rehace',()=>{
 const r=corre('fantasma',{muere:150}),re=MP.rehace(r.prueba);
 assert.ok(r.prueba.e.some(e=>e[0]==='e'),'el robot tomó estrellas');
 const tr=F.tramosPuntos(r.prueba,M),m=r.prueba.e.find(e=>e[0]==='m');
 assert.ok(Math.abs(F.puntosEn(tr,m[2])-re.puntos)<=1,F.puntosEn(tr,m[2])+' / '+re.puntos);
 assert.equal(F.puntosEn(tr,m[2]+500),F.puntosEn(tr,m[2]),'caído no suma');
 assert.equal(F.puntosEn(tr,0),0);
 // va subiendo, y a 10 × base por metro al principio
 assert.equal(F.puntosEn(tr,10),10*3*10);
 let ant=-1;for(let D=0;D<m[2];D+=50){const p=F.puntosEn(tr,D);assert.ok(p>=ant);ant=p;}
});

test('prepara: el fantasma que manda la página, comprobado con rehace',()=>{
 const r=corre('fantasma',{muere:120,semilla:4242});
 const g=F.prepara({nombre:'Ana',puntos:r.puntos,yo:false,d:JSON.stringify(r.prueba)},MP,M,'fantasma');
 assert.equal(g.motivo,undefined,g.motivo);
 assert.equal(g.semilla,4242);assert.equal(g.nombre,'Ana');assert.equal(g.yo,false);
 assert.ok(g.pedidos.length>=2&&g.pedidos.every(q=>q[0]==='T'||q[0]==='B'),'sus túneles y boletos');
 assert.ok(g.rastro&&g.rastro.n>1000);assert.ok(Math.abs(g.tm-120)<0.06);assert.ok(g.Df<=g.Dm);
 assert.equal(g.puntos,MP.rehace(r.prueba).puntos);
 // lo que no sirve se dice, no se rompe
 assert.match(F.prepara({nombre:'x',d:''},MP,M,'fantasma').motivo,/no trae la prueba/);
 assert.match(F.prepara(null,MP,M,'fantasma').motivo,/no trae/);
 assert.match(F.prepara({d:'{malo'},MP,M,'fantasma').motivo,/no se puede leer/);
 assert.match(F.prepara({d:JSON.stringify(r.prueba)},MP,M,'cityfantasma').motivo,/no es de este mundo/);
 const vieja=copia(r.prueba);vieja.v=1;assert.match(F.prepara({d:JSON.stringify(vieja)},MP,M,'fantasma').motivo,/otra versión/);
 const trucha=copia(r.prueba);trucha.e.splice(3,0,['e',2,40,2000,99999]);assert.match(F.prepara({d:JSON.stringify(trucha)},MP,M,'fantasma').motivo,/no cuadra/);
 // sin rastro corre igual (solo en puntos)
 const sinG=copia(r.prueba);delete sinG.g;assert.equal(F.prepara({d:JSON.stringify(sinG)},MP,M,'fantasma').rastro,null);
 assert.equal(F.prepara({nombre:'z'.repeat(300),d:JSON.stringify(r.prueba)},MP,M,'fantasma').nombre.length,80);
});

test('contra el fantasma se corre SU pista, con otro ritmo de cuadros y otros boletos',()=>{
 // el fantasma: sin boletos, corre 200 s (pasa Ocaso y llega a Neón)
 const fg=corre('fantasma',{muere:200,semilla:91,boletos:[],dtMin:0.016,dtMax:0.017,az:5});
 assert.ok(fg.prueba.i.filter(q=>q[0]==='T').length>=2,'el fantasma pidió dos túneles');
 assert.deepEqual(fg.boletosPedidos,[1,2,8,3],'y los boletos que no tenía (el 8 es el Mercado, entre Ocaso y Neón)');
 const g=F.prepara({nombre:'F',d:JSON.stringify(fg.prueba)},MP,M,'fantasma');assert.equal(g.motivo,undefined);
 // quien lo persigue: cuadros irregulares, ya tiene el boleto 2 (no lo pediría) y corre más
 const yo=corre('fantasma',{contra:g,muere:260,boletos:[2],dtMin:0.006,dtMax:0.05,az:77,base:9});
 assert.equal(yo.c.fan.diverge,false,'nunca se separó');
 assert.equal(yo.c.fan.pi,g.pedidos.length,'aplicó todos sus pedidos');
 assert.equal(yo.prueba.s,g.semilla);
 // lo generado antes de que el fantasma chocara es idéntico, objeto por objeto
 const hasta=g.Dm+200,clave=o=>JSON.stringify([o.id,o.tipo,o.carril,o.d!=null?o.d:o.d0,o.largo,o.clase]);
 const a=fg.objs.filter(o=>(o.d!=null?o.d:o.d0)<hasta).map(clave),b=yo.objs.filter(o=>(o.d!=null?o.d:o.d0)<hasta).map(clave);
 assert.ok(a.length>500);assert.deepEqual(b,a);
 // sus pedidos están en la prueba del perseguidor tal cual (en orden y en el mismo punto), y después los propios
 assert.deepEqual(yo.prueba.i.slice(0,g.pedidos.length),g.pedidos);
 assert.ok(yo.prueba.i.length>g.pedidos.length,'pasado su choque pidió los suyos (el túnel siguiente)');
 assert.ok(yo.boletosPedidos.includes(2),'el boleto 2 vino en la pista del fantasma aunque ya lo tenía');
 // y la prueba del perseguidor se rehace: para el antitrampas es una carrera más con esa semilla
 const re=MP.rehace(yo.prueba);assert.equal(re.motivo,undefined,re.motivo);assert.ok(Math.abs(re.puntos-yo.puntos)<=1);
 // un perseguidor CON todos los boletos no pide ninguno propio mientras el fantasma corría, y la pista sigue siendo la suya
 const otro=corre('fantasma',{contra:g,muere:150,boletos:[1,2,3,4,5,6,7],az:9});
 assert.equal(otro.c.fan.diverge,false);assert.deepEqual(otro.prueba.i,g.pedidos.filter(q=>q[1]<=otro.c.gen.estado().dSig));
 // sin fantasma, la misma semilla da otra cosa en cuanto los boletos difieren (por eso hace falta seguir sus pedidos)
 const solo=corre('fantasma',{semilla:91,muere:200,boletos:[2],az:77});
 assert.notDeepEqual(solo.prueba.i.map(q=>q.slice(0,1).concat(q.slice(2))),g.pedidos.map(q=>q.slice(0,1).concat(q.slice(2))));
});

test('City fantasma también: su pista y su prueba',()=>{
 const fg=corre('cityfantasma',{muere:120,semilla:5,az:3});
 const g=F.prepara({nombre:'C',d:JSON.stringify(fg.prueba)},MP,M,'cityfantasma');assert.equal(g.motivo,undefined,g.motivo);
 const yo=corre('cityfantasma',{contra:g,muere:140,az:44});
 assert.equal(yo.c.fan.diverge,false);assert.equal(MP.rehace(yo.prueba).motivo,undefined);
 const k=o=>JSON.stringify([o.id,o.tipo,o.carril,o.d!=null?o.d:o.d0]);
 const lim=g.Dm+200;assert.deepEqual(yo.objs.filter(o=>(o.d!=null?o.d:o.d0)<lim).map(k),fg.objs.filter(o=>(o.d!=null?o.d:o.d0)<lim).map(k));
});

test('el clásico no cambia (salvo el rastro); la página lee la prueba solo por clave',()=>{
 // juego.js: el grabador solo en los modos fantasma; el fantasma solo si el modo lo es
 assert.match(JS,/grab: M\.distanciaDe\(modo\) && MF \? MF\.crearGrabador\(\) : null/);
 assert.match(JS,/const f = modo && modo\.fantasma \? fantasmas\[modo\.categoria\] : null;/);
 // el clásico sigue siendo el de siempre (sin `m` ni `pm`), pero graba su rastro: entra en la distancia y puede ser el próximo fantasma
 const cl=corre('clasico',{muere:80});assert.equal(typeof cl.prueba.g,'string');assert.equal(cl.prueba.m,undefined);assert.equal(cl.prueba.pm,undefined);assert.equal(MP.rehace(cl.prueba).motivo,undefined);
 const sm=corre('sinmonedas',{muere:40});assert.equal(sm.prueba.g,undefined,'Sin monedas no entra en la distancia: no graba');
 // fantasma.js se carga antes que prueba.js (que lo usa para mirar el rastro)
 const html=fs.readFileSync(path.join(DIR,'index.html'),'utf8');
 assert.ok(html.indexOf('src="fantasma.js')>0&&html.indexOf('src="fantasma.js')<html.indexOf('src="prueba.js'));
 // la página: la tabla de la escucha y la prueba de la fila 1.ª, por clave; al invitado nada
 const club=fs.readFileSync(path.join(__dirname,'../src/juegos/solo/club.js'),'utf8');
 assert.match(club,/d\.tipo==='fantasma-pedir'/);assert.match(club,/fantasma\.leerPrueba\(cat,top\.uid,top\.partida\)/);assert.match(club,/motivo:'invitado'/);
 assert.match(club,/pruebasFantasma\.has\(clave\)/,'la prueba se baja una vez por visita');
 const con=fs.readFileSync(path.join(__dirname,'../../juegos/club/conexion.js'),'utf8');assert.match(con,/pedirFantasma\(cat,cb\)/);
 // y las reglas dejan leer una prueba por clave (no la colección)
 const reglas=JSON.parse(fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8')).rules;
 assert.equal(reglas.soloPruebas.$categoria.$uid.$partida['.read'],'auth != null');
 assert.equal(reglas.soloPruebas['.read'],undefined);assert.equal(reglas.soloPruebas.$categoria['.read'],undefined);
});

test('el fantasma es la carrera más larga de su mundo, de cualquier modo, y se corre con sus reglas',()=>{
 // la tabla del fantasma ES la de distancia de su mundo, y entran el modo normal, el sin ayudas y el fantasma
 assert.equal(M.MODOS.fantasma.categoria,'club-metrorush-distancia');assert.equal(M.MODOS.cityfantasma.categoria,'club-metrorush-citydistancia');
 assert.deepEqual([...M.DISTANCIA.metro.modos],['clasico','puro','fantasma']);assert.deepEqual([...M.DISTANCIA.city.modos],['city','citypuro','cityfantasma']);
 assert.equal(M.distanciaDe('sinmonedas'),null,'Sin monedas no entra en la distancia');
 // conReglas: lo de las reglas (poderes, ×10…) con el nombre y la tabla del fantasma
 const cr=M.conReglas('fantasma','clasico');assert.equal(cr.id,'fantasma');assert.equal(cr.items,true);assert.equal(cr.revivir,true);assert.equal(cr.categoria,'club-metrorush-distancia');assert.equal(cr.reglas,'clasico');
 assert.equal(M.conReglas('fantasma','puro').multFijo,10);assert.equal(M.conReglas('fantasma','city'),null,'reglas de otro mundo: no');
 assert.equal(M.modoDe(cr),cr,'modoDe acepta el modo compuesto');
 // una carrera del CLÁSICO (con poderes) sirve de fantasma: se corre con reglas «clasico»
 const cl=corre('clasico',{muere:100,semilla:31});
 const g=F.prepara({nombre:'Leo',d:JSON.stringify(cl.prueba)},MP,M,'fantasma');assert.equal(g.motivo,undefined,g.motivo);
 assert.equal(g.reglas,'clasico');assert.equal(g.semilla,31);assert.equal(g.metros,cl.metros);
 // y quien lo persigue corre con esas reglas: su prueba dice `pm`, se rehace y va a la distancia en metros
 const yo=corre('fantasma',{contra:g,muere:130,az:12});
 assert.equal(yo.prueba.m,'fantasma');assert.equal(yo.prueba.pm,'clasico');assert.equal(yo.MO.items,true);
 assert.equal(yo.c.fan.diverge,false);
 const re=MP.rehace(yo.prueba);assert.equal(re.motivo,undefined,re.motivo);assert.equal(re.reglas,'clasico');
 assert.equal(MV.verifica({categoria:'club-metrorush-distancia',puntos:yo.metros,tiempo:yo.tiempo,partida:'x'},yo.prueba,{uid:'uid-robot'}),null);
 // una carrera fantasma no entra en una tabla de puntos, ni en la distancia del otro mundo
 assert.match(MV.verifica({categoria:'club-metrorush-carrera',puntos:yo.puntos,tiempo:yo.tiempo,partida:'x'},yo.prueba,{uid:'uid-robot'}),/fantasma solo va/);
 assert.match(MV.verifica({categoria:'club-metrorush-citydistancia',puntos:yo.metros,tiempo:yo.tiempo,partida:'x'},yo.prueba,{uid:'uid-robot'}),/no entra en esta tabla/);
 // reglas que no son de este fantasma: la prueba no vale
 const mala=copia(yo.prueba);mala.pm='city';assert.match(MP.rehace(mala).motivo,/reglas del fantasma/);
 const sinFan=copia(cl.prueba);sinFan.pm='clasico';assert.match(MP.rehace(sinFan).motivo,/reglas del fantasma/);
 // una de Sin ayudas también es fantasma, con sus reglas (sin ítems, ×10)
 const pu=corre('puro',{muere:80,semilla:8});const gp=F.prepara({d:JSON.stringify(pu.prueba)},MP,M,'fantasma');assert.equal(gp.reglas,'puro');
 // una prueba fantasma vieja (sin pm) se corrió sin nada: su pista es la de Sin ayudas
 const vieja=corre('fantasma',{muere:70,semilla:9});assert.equal(vieja.prueba.pm,undefined);assert.equal(F.prepara({d:JSON.stringify(vieja.prueba)},MP,M,'fantasma').reglas,'puro');
});

test('la carrera contra el fantasma va en metros: dónde está el fantasma en cada instante',()=>{
 const cl=corre('clasico',{muere:90,semilla:44});
 const g=F.prepara({d:JSON.stringify(cl.prueba)},MP,M,'fantasma');
 // mientras corre, lleva los metros de la curva (los mismos que tú: la velocidad es igual para todos)
 for(const t of [5,30,60,85])assert.ok(Math.abs(F.metrosEn(g.pasos,g.curva,t)-g.curva.metrosEntre(0,t))<2.5,'t='+t);
 assert.equal(F.vivoEn(g.pasos,30),true);
 // después de su último choque ya no avanza: queda en sus metros finales
 const fin=F.metrosEn(g.pasos,g.curva,g.tf+50);assert.ok(Math.abs(fin-g.Df)<0.5,fin+' / '+g.Df);
 assert.equal(F.vivoEn(g.pasos,g.tf+50),false);
 // nunca retrocede (salvo el empujón del choque)
 let ant=-1;for(let t=0;t<g.tf+5;t+=0.37){const d=F.metrosEn(g.pasos,g.curva,t);assert.ok(d>=ant-0.5,t+": "+d+" < "+ant);ant=Math.max(ant,d);}   // (al chocar resbala un poco hacia atrás: el juego lo empuja 0,35 m)
});

test('juego.js: la carrera fantasma va a la distancia de su mundo y ganarle da «Cazafantasmas»',()=>{
 assert.match(JS,/const tablaDist = M\.distanciaDe\(c\.modo\)/);
 assert.match(JS,/if \(fanM\) \{ Club\.result\(\{ categoria: tablaDist\.categoria, puntos: Math\.min\(1e6, metros\)/);
 assert.match(JS,/Club\.logro\('fan'\)/);
 assert.match(JS,/addEventListener\('club-fantasma'/,'el fantasma nuevo llega sin pedirlo');
 const con=fs.readFileSync(path.join(__dirname,'../../juegos/club/conexion.js'),'utf8');
 assert.match(con,/logro\(id\)/);assert.match(con,/club-fantasma/);
 const club=fs.readFileSync(path.join(__dirname,'../src/juegos/solo/club.js'),'utf8');
 assert.match(club,/d\.tipo==='logro'/);
});
