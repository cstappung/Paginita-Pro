/* Metro Rush: los modos de juego (M.MODOS en juegos/club/metrorush/motor.js).

   Lo que se fija aquí:
   - el clásico no cambió: la pista de una semilla es la misma objeto por
     objeto que antes de que hubiera modos (una huella sacada del motor de
     antes), con o sin {modo: 'clasico'}, y su prueba no lleva `m`;
   - cada modo genera siempre la misma pista con la misma semilla, y los
     modos sin ayudas no tienen ni un poder ni una caja (sí estrellas);
   - en «Sin monedas» las monedas nunca tapan el camino: un jugador simulado
     que trata cada moneda como un muro siempre encuentra por dónde seguir;
   - la prueba de cada modo se rehace (un robot corre cuadro a cuadro como
     juego.js), lo que el modo no permite se rechaza, y una carrera no puede
     entrar en la tabla de otro modo;
   - las cuatro tablas nuevas están en el club, las reglas, la
     clasificación, las monedas, Discord y el perfil;
   - el mundo City tiene sus distritos, su vuelta y sus ganchos (lo demás
     de City está en metrorush-city.test.cjs). */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const DIR=path.join(__dirname,'../../juegos/club/metrorush');
const M=require(path.join(DIR,'motor.js')),MP=require(path.join(DIR,'prueba.js'));
const cargaEsm=entry=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const MV=cargaEsm('src/juegos/solo/verifica/metrorush.js');
const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const carga=(archivos,exp)=>{const c={crypto:crypto.webcrypto,TextEncoder};vm.createContext(c);vm.runInContext(archivos.map(sin).join('\n')+';globalThis.__X={'+exp+'};',c);return c.__X;};
const copia=x=>JSON.parse(JSON.stringify(x));
const NUEVAS=['club-metrorush-puro','club-metrorush-sinmonedas','club-metrorush-fantasma','club-metrorush-city','club-metrorush-citypuro','club-metrorush-cityfantasma'];

/* La pista de una semilla como la recorre el juego (generando 230 m por
   delante), con un túnel, la cinta de la mochila y un boleto pedidos en el
   camino. Devuelve sus objetos. */
function pista(semilla,metros,opciones){
 const g=M.crearGenerador(semilla,opciones),objs=[];const curva=M.velocidadDe(opciones&&opciones.modo);let D=0,t=0;
 while(D<metros){const V=curva.velocidad(t);D+=V*0.05;t+=0.05;objs.push(...g.generarHasta(D+230,{V}));
  if(Math.abs(D-1300)<1&&!g._t){g._t=1;g.pedirTunel(D+40,'ocaso');}
  if(Math.abs(D-2000)<1&&!g._c){g._c=1;objs.push(...g.monedasCielo(D+12,D+100,1));g.pedirBoleto(2,D+300);}
 }
 return objs;
}
const huella=objs=>crypto.createHash('sha256').update(JSON.stringify(objs)).digest('hex').slice(0,16)+':'+objs.length;
/* Sacadas del motor de ANTES de los modos (mismo recorrido de arriba, 15 km):
   si alguna cambia, las carreras clásicas ya guardadas dejan de verificar. */
const HUELLAS_CLASICO={1:'99eab28c0344da60:4746',2026:'d1d2c227952fd138:4747',7919:'68007069748c7be3:4811',12345:'24e64c7c1eb67155:4855',424242:'8c171d3acd37d3c2:4681'};

test('la tabla de modos: siete, con su tabla, sus reglas y su mundo',()=>{
 assert.deepEqual(M.ORDEN_MODOS,['clasico','puro','sinmonedas','fantasma','city','citypuro','cityfantasma']);
 assert.deepEqual(M.ORDEN_MODOS.map(k=>M.MODOS[k].categoria),['club-metrorush-carrera',...NUEVAS]);
 for(const k of M.ORDEN_MODOS){const m=M.MODOS[k];
  assert.equal(m.id,k);for(const c of ['nombre','corto','desc','categoria','mundo'])assert.ok(typeof m[c]==='string'&&m[c],k+'.'+c);
  for(const c of ['items','potenciadores','patineta','revivir','monedasMatan'])assert.equal(typeof m[c],'boolean',k+'.'+c);
  assert.ok(M.MUNDOS[m.mundo],k+': su mundo existe');assert.equal(M.modoDeCategoria(m.categoria),m);}
 // los sin ayudas no tienen nada; «sin monedas» además mata con las monedas
 for(const k of ['puro','sinmonedas','fantasma','citypuro','cityfantasma'])for(const c of ['items','potenciadores','patineta','revivir'])assert.equal(M.MODOS[k][c],false,k+'.'+c);
 assert.equal(M.MODOS.sinmonedas.monedasMatan,true);assert.ok(['clasico','puro','fantasma','city','citypuro','cityfantasma'].every(k=>!M.MODOS[k].monedasMatan));
 // los fantasma: se corre contra el n.º 1 de su propia tabla, en su mundo
 assert.equal(M.MODOS.fantasma.fantasma,true);assert.equal(M.MODOS.cityfantasma.fantasma,true);assert.equal(M.MODOS.fantasma.mundo,'metro');assert.equal(M.MODOS.cityfantasma.mundo,'city');
 for(const k of ['clasico','city'])for(const c of ['items','potenciadores','patineta','revivir'])assert.equal(M.MODOS[k][c],true,k+'.'+c);
 assert.equal(M.MODOS.city.mundo,'city');assert.equal(M.MODOS.citypuro.mundo,'city');assert.equal(M.MODOS.puro.mundo,'metro');
 // sin clave es el clásico (las pruebas viejas); una clave que no existe, nada
 assert.equal(M.modoDe(undefined),M.MODOS.clasico);assert.equal(M.modoDe(''),M.MODOS.clasico);assert.equal(M.modoDe('nope'),null);assert.equal(M.modoDe('toString'),null);
 assert.equal(M.modoDeCategoria('club-metrorush-distancia'),M.MODOS.clasico);assert.equal(M.modoDeCategoria('club-fanal-sinfin'),null);
});

test('el clásico no cambió: misma pista objeto por objeto, misma curva',()=>{
 for(const [s,h] of Object.entries(HUELLAS_CLASICO)){
  assert.equal(huella(pista(+s,15000)),h,'semilla '+s+' sin modo');
  assert.equal(huella(pista(+s,15000,{modo:'clasico'})),h,'semilla '+s+' con modo clásico');
 }
 assert.equal(M.velocidadDe('clasico'),M.CURVA);assert.equal(M.velocidadDe(),M.CURVA);
 assert.equal(M.velocidad,M.CURVA.velocidad);assert.equal(M.metrosEntre(0,60),1080);assert.equal(M.velocidadEn(1080),21);
 // la prueba del clásico no lleva el modo: queda igual que antes
 const p=MP.nueva({s:5,b:2,md:1,u:'x',m:'clasico'});assert.deepEqual(Object.keys(p),['v','s','b','md','u','i','e']);
 assert.equal(MP.nueva({s:5,b:2,md:1,u:'x'}).m,undefined);assert.equal(MP.nueva({s:5,b:2,md:1,u:'x',m:'puro'}).m,'puro');
});

test('cada modo da siempre la misma pista; los sin ayudas no tienen poderes ni cajas',()=>{
 for(const modo of M.ORDEN_MODOS){
  const a=pista(31337,9000,{modo}),b=pista(31337,9000,{modo});
  assert.equal(huella(a),huella(b),modo+': misma semilla, misma pista');
  const poderes=a.filter(o=>o.tipo==='poder');
  if(M.MODOS[modo].items)assert.ok(poderes.length>5,modo+' tiene poderes');
  else assert.equal(poderes.length,0,modo+' no tiene poderes ni cajas');
  assert.ok(a.filter(o=>o.tipo==='estrella').length>=10,modo+' tiene estrellas');
  assert.ok(a.filter(o=>o.tipo==='moneda').length>100,modo+' tiene monedas');
 }
 // otro modo, otra pista (el de sin monedas no pone monedas en el camino)
 assert.notEqual(huella(pista(31337,3000,{modo:'sinmonedas'})),huella(pista(31337,3000,{modo:'clasico'})));
});

/* ¿El carril c está cerrado en el metro d? Como en metrorush-motor.test.cjs
   (un tren detenido sin rampa, un tren en marcha donde se cruza), y además
   cada moneda es un muro de ±1,3 m (en «Sin monedas» no se puede tocar). */
function cerrados(objs,conMonedas){
 const porCarril=[[],[],[]],rampas=objs.filter(o=>o.tipo==='rampa'),trenes=objs.filter(o=>o.tipo==='tren');
 const subible=new Set();
 for(const r of rampas){let fin=r.d0+r.largo;for(;;){const t=trenes.find(x=>x.vel===0&&x.carril===r.carril&&Math.abs(x.d0-fin)<0.6);if(!t)break;subible.add(t);fin=t.d0+t.largo;}}
 for(const t of trenes){if(t.vel>0)porCarril[t.carril].push([t.dArribo-1,t.dArribo+t.largo+1]);else if(!subible.has(t))porCarril[t.carril].push([t.d0,t.d0+t.largo]);}
 if(conMonedas)for(const o of objs)if(o.tipo==='moneda'&&o.y<3)porCarril[o.carril].push([o.d-1.3,o.d+1.3]);
 return porCarril;
}
test('«Sin monedas»: las monedas nunca tapan el camino (jugador simulado, 8 semillas × 10 km)',()=>{
 for(let k=1;k<=8;k++){
  const semilla=k*104729,objs=pista(semilla,10000,{modo:'sinmonedas'}),cer=cerrados(objs,true);
  // ni arcos sobre las barreras bajas ni monedas en los techos: arriba de 3 m no hay ninguna
  assert.equal(objs.filter(o=>o.tipo==='moneda'&&o.y>2.5&&o.y<8).length,0,'monedas en el aire o en los techos');
  const libre=(c,d)=>!cer[c].some(([a,b])=>d>=a&&d<=b);
  let alcanza=[false,true,false];
  for(let d=0;d<9800;d+=1){
   const sig=[false,false,false];
   for(let c=0;c<3;c++){if(!alcanza[c])continue;if(libre(c,d+1))sig[c]=true;
    for(const o of [c-1,c+1]){if(o<0||o>2)continue;let ok=true;for(let x=0;x<=6&&ok;x++)ok=libre(c,d+x)&&libre(o,d+x);if(ok)sig[o]=true;}}
   assert.ok(sig.some(Boolean),'semilla '+semilla+': no hay por dónde seguir en el metro '+d);
   alcanza=sig;
  }
 }
});

test('el mundo City: sus distritos, su vuelta, su historia y sus ganchos',()=>{
 const e=M.estacionDe(0,'city');assert.equal(e.id,M.ESTACIONES_CITY[0].id);assert.equal(e.clave,e.id);
 // city.js lo llena: cinco distritos, y después de los 13 km dan la vuelta (como la Línea 3)
 assert.equal(M.ESTACIONES_CITY.length,5);assert.equal(M.siguienteUmbral(100,'city'),M.ESTACIONES_CITY[1].desde);
 assert.match(M.estacionDe(50000,'citypuro').nombre,/vuelta/);
 assert.ok(M.estacionDe(0,'city').paleta,'tiene paleta');
 assert.equal(M.historiaDe('city').intro,M.INTRO_CITY);assert.equal(M.historiaDe('clasico').intro,M.INTRO);
 // el clásico y los demás modos del metro siguen con las estaciones de siempre
 assert.equal(M.estacionDe(1600,'puro').id,'ocaso');assert.equal(M.estacionDe(1600).id,'ocaso');assert.equal(M.siguienteUmbral(0,'sinmonedas'),1200);
 // los ganchos del generador: un bloque propio y un tipo de objeto nuevo
 const viejo=M.MUNDOS.city.generador;let llamado=0;
 M.MUNDOS.city.generador={bloque(api){if(api.dSig<400)return false;llamado++;api.emite({tipo:'prueba-x',carril:api.camino,d:api.dSig});api.dSig+=40;return true;}};
 try{const objs=M.crearGenerador(9,{modo:'city'}).generarHasta(800,{V:20});assert.ok(llamado>0&&objs.some(o=>o.tipo==='prueba-x'));
  assert.equal(huella(pista(1,3000)),huella(pista(1,3000,{modo:'clasico'})),'el gancho de City no toca el clásico');}
 finally{M.MUNDOS.city.generador=viejo;}
 M.registraTipo('prueba-x',{caja:o=>({z0:o.d-.2,z1:o.d+.2,y0:0,y1:1,w:.9})});
 assert.deepEqual(M.caja({tipo:'prueba-x',d:10},0),{z0:9.8,z1:10.2,y0:0,y1:1,w:.9});assert.equal(M.caja({tipo:'otro-x'},0),null);
 delete M.TIPOS['prueba-x'];
});

test('el récord local es por modo (el del clásico sigue en records.puntos)',()=>{
 const p=M.progresoNuevo();
 assert.equal(M.anotaRecord(p,'puro',500),0);assert.equal(M.recordDe(p,'puro'),500);assert.equal(p.records.puntos,0);
 M.anotaRecord(p,'clasico',900);assert.equal(p.records.puntos,900);assert.equal(M.recordDe(p,'clasico'),900);
 const q=M.mezclaProgreso(Object.assign(M.progresoNuevo(),{at:1,recordsModo:{puro:700,sinmonedas:3,city:0,citypuro:0}}),Object.assign(M.limpiaProgreso(p),{at:2}));
 assert.equal(q.recordsModo.puro,700);assert.equal(q.recordsModo.sinmonedas,3);
 assert.equal(M.limpiaProgreso({recordsModo:{puro:-5,raro:9}}).recordsModo.raro,undefined);
});

/* ---------- Un robot por modo ----------
   El mismo de antitrampas-metrorush.test.cjs, en corto: cuadros de 8 a
   50 ms, la curva y la pista del modo, recoge estrellas (y 2× si el modo
   tiene poderes) a menos de un metro, choca a los `muertes` s (sigue
   corriendo entre medio solo si el modo lo permite). */
function robot(modo,o={}){
 const MO=M.modoDe(modo),curva=M.velocidadDe(modo);
 const op=Object.assign({semilla:4242,base:2,md:1,u:'uid-robot',muertes:MO.revivir?[50,90]:[60],pot:MO.potenciadores?2:0,mochilaEn:MO.items?20:0},o);
 let az=op.semilla>>>0;const azar=()=>((az=(az*1664525+1013904223)>>>0)/4294967296);
 const gen=M.crearGenerador(op.semilla,{modo}),prueba=MP.nueva({s:op.semilla,b:op.base,md:op.md,u:op.u,m:modo});
 const st={t:0,D:0,V:curva.velocidad(0),puntos:0,estrellas:0,doble:0,extra:0,vivo:true,r:0},objetos=new Map(),tomados=new Set();
 const anota=(cod,x)=>MP.evento(prueba,cod,st.t,st.D,st.r,x),pedido=(tipo,...d)=>MP.pedido(prueba,tipo,gen.estado().dSig,...d);
 const agrega=l=>{for(const ob of l)objetos.set(ob.id,ob);},durDoble=M.duracionPoder('doble',op.md);
 const mult=()=>M.multiplicador({base:op.base,estrellas:st.estrellas,doble:st.doble>0,extra:st.extra,fijo:MO.multFijo});
 agrega(gen.generarHasta(230,{V:st.V}));
 const est=M.estacionDe(0,modo);if(est.boleto){pedido('B',est.boleto,420);gen.pedirBoleto(est.boleto,420);}
 let sig=MP.PASO_MUESTRA,muerte=0,mochila=false,usoPot=false;
 for(let paso=0;paso<200000;paso++){
  const dt=0.008+azar()*0.042;st.r+=dt*1000+azar()*3;st.t+=dt;st.V=st.vivo?curva.velocidad(st.t):0;
  const dD=st.V*dt;st.D+=dD;if(st.vivo)st.puntos+=M.puntosPorTramo(dD,mult());
  agrega(gen.generarHasta(st.D+230,{V:Math.max(13,st.V)}));
  if(muerte<op.muertes.length&&st.t>=op.muertes[muerte]){
   anota('m');st.vivo=false;st.D=Math.max(0,st.D-0.35);muerte++;
   for(let k=0;k<60;k++){st.t+=0.016;st.r+=16;}
   if(muerte<op.muertes.length){st.r+=3000;anota('s');st.vivo=true;continue;}
   anota('f');break;
  }
  for(const ob of objetos.values()){
   if(tomados.has(ob.id)||Math.abs(ob.d-st.D)>1.0)continue;
   if(ob.tipo==='estrella'){tomados.add(ob.id);anota('e',ob.id);st.estrellas=Math.min(M.MAX_ESTRELLAS,st.estrellas+1);}
   else if(ob.tipo==='poder'&&ob.clase==='doble'){tomados.add(ob.id);anota('d',ob.id);st.doble=durDoble;}
  }
  if(!mochila&&op.mochilaEn&&st.t>=op.mochilaEn){mochila=true;const h=st.D+12+st.V*6;pedido('C',st.D+12,h,1);agrega(gen.monedasCielo(st.D+12,h,1));}
  if(op.pot&&!usoPot&&st.t>=op.pot){usoPot=true;anota('p');st.extra=M.POTENCIADORES.puntos.extra;}
  if(st.doble>0){st.doble=Math.max(0,st.doble-dt);if(st.doble===0)anota('x');}
  if(st.t>=sig){anota('w');sig=st.t+MP.PASO_MUESTRA;}
 }
 return {prueba:MP.cierra(prueba,{sn:0}),puntos:Math.floor(st.puntos),metros:Math.floor(st.D),tiempo:Math.max(1,Math.round(st.t*1000)),estrellas:st.estrellas};
}
const dato=(r,cat)=>({categoria:cat,puntos:cat==='club-metrorush-distancia'?r.metros:r.puntos,tiempo:r.tiempo,partida:'x'});
const ctx={uid:'uid-robot'};

test('la carrera de cada modo se rehace y el verificador da sus mismos puntos',()=>{
 for(const k of M.ORDEN_MODOS){
  const r=robot(k),re=MP.rehace(r.prueba);
  assert.equal(re.motivo,undefined,k+': '+re.motivo);assert.equal(re.modo,k);
  assert.ok(Math.abs(re.puntos-r.puntos)<=1,k+': puntos '+re.puntos+' / '+r.puntos);assert.equal(re.metros,r.metros);
  assert.ok(r.estrellas>=1,k+': el robot recogió estrellas');
  assert.equal(MV.verifica(dato(r,M.MODOS[k].categoria),r.prueba,ctx),null,k);
  assert.equal(MV.sospecha(M.MODOS[k].categoria,{puntos:r.puntos,tiempo:r.tiempo}),null,k+': no es sospechosa');
 }
 // la del clásico sigue sin `m` y vale para la distancia
 const r=robot('clasico');assert.equal(r.prueba.m,undefined);assert.equal(MV.verifica(dato(r,'club-metrorush-distancia'),r.prueba,ctx),null);
});

test('lo que el modo no permite se rechaza',()=>{
 const r=robot('puro'),con=f=>{const p=copia(r.prueba);f(p);return MP.rehace(p).motivo||'';};
 const antesDe=(p,cod)=>p.e.findIndex(e=>e[0]===cod);
 // un 2× (aunque exista en la pista del clásico), el +5, seguir corriendo y la cinta de la mochila
 assert.match(con(p=>{const i=antesDe(p,'w');p.e.splice(i+1,0,['d',p.e[i][1],p.e[i][2],p.e[i][3],1]);}),/2×/);
 assert.match(con(p=>{const i=antesDe(p,'w');p.e.splice(i+1,0,['p',p.e[i][1],p.e[i][2],p.e[i][3]]);}),/potenciador/);
 assert.match(con(p=>{const i=antesDe(p,'m');p.e.splice(i+1,0,['s',p.e[i][1]+0.5,p.e[i][2],p.e[i][3]+900]);}),/seguir corriendo/);
 assert.match(con(p=>{p.i.push(['C',p.i.length?p.i[p.i.length-1][1]:60,100,200,1]);}),/mochila|pista/);
 // un modo que no existe, o mal escrito
 assert.match(con(p=>{p.m='turbo';}),/modo de juego no existe/);assert.match(con(p=>{p.m=3;}),/modo de juego no es válido/);
 // un boleto que el mundo no tiene (City tiene cinco postales: no hay una n.º 9)
 const c=robot('city');const pc=copia(c.prueba);pc.i.unshift(['B',60,9,420]);assert.match(MP.rehace(pc).motivo||'',/boleto/);
 // el clásico sí permite todo eso: su robot usa 2×, +5, seguir y la mochila y pasa
 const cl=robot('clasico');assert.ok(cl.prueba.e.some(e=>e[0]==='p')&&cl.prueba.e.some(e=>e[0]==='s')&&cl.prueba.i.some(q=>q[0]==='C'));
 assert.equal(MP.rehace(cl.prueba).motivo,undefined);
 // y una prueba del clásico con m:'puro' pegado a mano ya no cuadra (el +5, seguir y la mochila delatan)
 const falsa=copia(cl.prueba);falsa.m='puro';assert.ok(MP.rehace(falsa).motivo);
});

test('Fantasma: cualquier semilla vale, y el rastro `g` no cuenta pero tiene tope',()=>{
 for(const k of ['fantasma','cityfantasma']){const r=robot(k,{semilla:987654321});assert.equal(MP.rehace(r.prueba).motivo,undefined,k);
  assert.equal(MV.verifica(dato(r,M.MODOS[k].categoria),r.prueba,ctx),null,k);}
 const r=robot('fantasma'),base=MP.rehace(r.prueba);
 const conG=copia(r.prueba);MP.ponFantasma(conG,require(path.join(DIR,'fantasma.js')).codifica(Array.from({length:600},(_,i)=>[M.CARRILES[(i>>5)%3],(i%7)*0.3,i%5])));/* un rastro de verdad (fantasma.js): 60 s, lo que duró la carrera */const re=MP.rehace(conG);
 assert.equal(re.motivo,undefined);assert.equal(re.puntos,base.puntos,'el rastro no cambia los puntos');
 const largo=copia(r.prueba);largo.g='x'.repeat(MP.MAX_FANTASMA+1);assert.match(MP.rehace(largo).motivo,/fantasma/);
 const raro=copia(r.prueba);raro.g=[1,2];assert.match(MP.rehace(raro).motivo,/fantasma/);
 const corto=copia(r.prueba);MP.ponFantasma(corto,'y'.repeat(MP.MAX_FANTASMA+500));assert.equal(corto.g.length,MP.MAX_FANTASMA,'ponFantasma recorta');
 const js=fs.readFileSync(path.join(DIR,'juego.js'),'utf8');assert.match(js,/semillaSiguiente/);assert.match(js,/MP\.ponFantasma\(prueba, c\.rastro\)/);
});

test('una carrera no entra en la tabla de otro modo',()=>{
 const puro=robot('puro'),cl=robot('clasico'),sm=robot('sinmonedas');
 assert.match(MV.verifica(dato(puro,'club-metrorush-carrera'),puro.prueba,ctx),/modo Sin ayudas/);
 assert.match(MV.verifica(dato(cl,'club-metrorush-puro'),cl.prueba,ctx),/modo Clásico, no de la tabla Sin ayudas/);
 assert.match(MV.verifica(dato(puro,'club-metrorush-distancia'),puro.prueba,ctx),/distancia solo cuenta en el modo clásico/);
 assert.match(MV.verifica(dato(sm,'club-metrorush-citypuro'),sm.prueba,ctx),/no de la tabla/);
 assert.match(MV.verifica(dato(puro,'club-metrorush-nada'),puro.prueba,ctx),/Categoría desconocida/);
 assert.match(MV.verifica({...dato(puro,'club-metrorush-puro'),puntos:puro.puntos*2},puro.prueba,ctx),/puntos declarados/);
 // sin poderes el multiplicador llega menos alto: (30 + 29) × 10 por metro
 assert.match(MV.sospecha('club-metrorush-puro',{puntos:1e6,tiempo:60000}),/multiplicador máximo/);
 assert.equal(MV.sospecha('club-metrorush-city',{puntos:1e6,tiempo:60000}),null);
});

test('las cuatro tablas nuevas están en el club, las reglas, la clasificación, las monedas, Discord y el perfil',()=>{
 const C=carga(['src/juegos/solo/club-datos.js'],'categoriaClub,resultadoClub');
 for(const c of NUEVAS){
  assert.ok(C.categoriaClub('metrorush',c),c);assert.ok(!C.categoriaClub('fanal',c));
  const r=n=>C.resultadoClub('metrorush',{categoria:c,puntos:n,tiempo:65000,partida:'abc-1'});
  assert.ok(r(1000000000));assert.equal(r(1000000001),null);
 }
 assert.ok(!C.categoriaClub('metrorush','club-metrorush-citypuros'));
 const reglas=JSON.parse(fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8')).rules;
 for(const nodo of [reglas.soloRanks.$categoria.$uid,reglas.soloPruebas.$categoria.$uid.$partida]){
  const re=new RegExp(nodo['.validate'].match(/matches\(\/(.+?)\/\)/)[1]);
  for(const c of NUEVAS)assert.ok(re.test(c),c);assert.ok(!re.test('club-metrorush-turbo'));
 }
 const regla=reglas.soloRanks.$categoria.$uid.puntos['.validate'];
 const cabe=(cat,n)=>Function('return '+regla.replace(/newData\.isNumber\(\)/g,'true').replace(/newData\.val\(\)/g,String(n)).replace(/\$categoria/g,JSON.stringify(cat)).replace(/\.beginsWith\(/g,'.startsWith(').replace(/\.matches\(/g,'.match('))();
 for(const c of NUEVAS){assert.ok(cabe(c,1000000000),c);assert.ok(!cabe(c,1000000001),c);}
 const ranks=fs.readFileSync(path.join(__dirname,'../src/juegos/ranks.js'),'utf8');
 for(const op of ['carrera','distancia','puro','sinmonedas','fantasma','city','citypuro','cityfantasma'])assert.match(ranks,new RegExp('metrorush: \\{ filas: \\[\\{ k: "m", t: "Modo", ops: \\[[^\\n]*\\["'+op+'", '),op);
 const Mo=carga(['src/juegos/motor.js','src/juegos/logros.js','src/juegos/tienda.js','src/juegos/cortes.js','src/juegos/monedas.js'],'monedasDe,RECORD');
 const solo={};for(const c of NUEVAS)solo[c]={a:{puntos:1000000,tiempo:1}};
 assert.equal(Mo.monedasDe('a',{solo}).partes.records,NUEVAS.length*(Mo.RECORD.metrorush+40),'cada tabla paga su récord y 1 por cada 25 000 puntos');
 const X=carga(['src/juegos/discord.js'],'marcaSolo,categoriaLegible');
 assert.equal(X.categoriaLegible('club-metrorush-sinmonedas').modalidad,'sin monedas');assert.equal(X.categoriaLegible('club-metrorush-citypuro').modalidad,'City sin ayudas');
 assert.equal(X.marcaSolo('club-metrorush-puro',{puntos:12500,tiempo:1}),'🚇 12.500 pts');
 const P=carga(['src/juegos/motor.js','src/juegos/logros.js','src/juegos/tienda.js','src/juegos/perfil-tarjeta.js'],'nombreCategoria');
 assert.equal(P.nombreCategoria('club-metrorush-puro'),'Metro Rush · Sin ayudas');assert.equal(P.nombreCategoria('club-metrorush-city'),'Metro Rush · City');
});

test('el juego: elige el modo, lo manda a su tabla, pantalla completa, y las versiones cuadran',()=>{
 const js=fs.readFileSync(path.join(DIR,'juego.js'),'utf8'),html=fs.readFileSync(path.join(DIR,'index.html'),'utf8');
 const club=fs.readFileSync(path.join(__dirname,'../src/juegos/solo/club.js'),'utf8');
 // una versión para todo el juego: la página, sus scripts y los módulos que importa juego.js
 const vs=new Set([...html.matchAll(/(?:motor|prueba|mundo|audio|juego|estilo)\.(?:js|css)\?v=(metrorush-\d+)/g),...js.matchAll(/\.js\?v=(metrorush-\d+)/g)].map(m=>m[1]));
 assert.equal(vs.size,1,'versiones distintas: '+[...vs]);assert.ok(+[...vs][0].split('-')[1]>=7);
 assert.ok(+club.match(/index\.html\?v=club-(\d+)/)[1]>=47,'club-N subió (la prueba cambió)');
 assert.match(js,/MP\.nueva\(\{[^}]*m: modo\.id/);assert.match(js,/M\.crearGenerador\(semilla, \{ modo: modo\.id \}\)/);
 assert.match(js,/Club\.category\(c\.modo\.categoria\)/);assert.match(js,/c\.modo\.monedasMatan/);
 assert.match(js,/requestFullscreen/);assert.match(js,/webkitRequestFullscreen/);assert.match(js,/fullscreenchange/);assert.match(js,/KeyF/);
 assert.match(js,/Club\.inmersivo\(true\)/);assert.match(js,/Club\.inmersivo\(false\)/);
 assert.match(html,/id="modosLista"/);assert.match(html,/id="hudModo"/);assert.match(html,/id="finTabla"/);
 assert.equal((html.match(/data-accion="pantallaCompleta"/g)||[]).length,2,'⛶ en la portada y en la pausa');
});

test('Sin ayudas y City sin ayudas: ×10 fijo para todos, sin importar nivel ni estrellas',()=>{
 // solo esos dos modos lo fijan; el fantasma y los demás siguen con el de las misiones
 assert.equal(M.MODOS.puro.multFijo,10);assert.equal(M.MODOS.citypuro.multFijo,10);
 for(const k of ['clasico','sinmonedas','fantasma','city','cityfantasma'])assert.ok(!M.MODOS[k].multFijo,k);
 assert.equal(M.multiplicador({base:25,estrellas:7,fijo:10}),10);
 assert.equal(M.multiplicador({base:25,estrellas:7}),32);
 for(const k of ['puro','citypuro']){
  // la misma carrera con nivel 1 y con nivel 25 da los mismos puntos, y son 100 por metro
  const a=robot(k,{base:1}),b=robot(k,{base:25});
  assert.ok(a.estrellas>=1,k+': recogió estrellas');
  assert.equal(a.puntos,b.puntos,k);
  const ra=MP.rehace(a.prueba),rb=MP.rehace(b.prueba);
  assert.equal(ra.motivo,undefined);assert.equal(rb.motivo,undefined);
  assert.equal(ra.puntos,rb.puntos,k);
  assert.ok(Math.abs(ra.puntos-ra.metros*100)<=100,k+': '+ra.puntos+' para '+ra.metros+' m');
  // el tope del verificador para filas sin prueba es 100 por metro
  assert.match(MV.sospecha(M.MODOS[k].categoria,{puntos:2e5,tiempo:60000}),/multiplicador máximo/);
 }
 // en el fantasma el nivel sí cuenta
 const f1=robot('fantasma',{base:1}),f9=robot('fantasma',{base:9});assert.ok(f9.puntos>f1.puntos*2);
});
