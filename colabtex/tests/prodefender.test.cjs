/* PRO DEFENDER (juegos/club/prodefender/): el motor es repetible, la
   Grabadora y rehace() dan la misma partida (también con recargas y
   reintentos, y con la caché de rondas), el verificador del club la acepta
   y rechaza las trampas, y las monedas son las que pidió el dueño: 20 × el
   número del reino por cada ronda nueva del récord. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path'),fs=require('node:fs');
const carga=(entry)=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const D=path.join(__dirname,'../../juegos/club/prodefender/js/');
for(const f of ['data/enemies.js','data/towers.js','data/levels.js','engine.js'])require(D+f);
const P=require(D+'prueba.js'),PD=globalThis.PD;
const V=carga('src/juegos/solo/verifica.js');
const C=carga('src/juegos/solo/club-datos.js');
const M=carga('src/juegos/monedas.js');

/* Un bot sencillo que coloca y mejora torres al azar (con su propio azar,
   fijo), espera un poco entre rondas y a veces sale y reanuda la partida. */
function juega(li,u,rondas,{semilla=7,recargas=true}={}){
 let a=semilla;const azar=()=>{a=(a*1103515245+12345)>>>0;return a/4294967296;};
 const ids=PD.towersFor(li);
 const turno=G=>{const g=G.game;
  for(let k=0;k<30;k++){
   let mejor=null,costo=Infinity;
   for(const t of g.towers)for(const p of [0,1]){if(!g.canUpgrade(t,p))continue;const c=g.upgradeCost(t,p);if(c<costo){costo=c;mejor=[t,p];}}
   const ty=ids[(k*7+g.towers.length)%ids.length];
   if(g.towers.length<30&&g.money>=PD.TOWERS[ty].cost&&(g.towers.length<6||azar()<0.4)){for(let q=0;q<200;q++)if(G.colocar(ty,30+azar()*940,30+azar()*580))break;}
   else if(mejor&&g.money>=costo)G.mejorar(mejor[0],mejor[1]);else break;
  }
  if(g.towers.length&&azar()<0.3)G.modo(g.towers[0],P.MODOS[Math.floor(azar()*4)]);
 };
 const reanuda=G=>new P.Grabadora(li,u,JSON.parse(JSON.stringify(G.guardado())));
 let G=new P.Grabadora(li,u,null),reintentos=0;const pruebas=[];
 while(G.game.round<rondas){
  if(G.game.over){if(G.game.continues<1)break;G=reanuda(G);reintentos++;continue;}
  for(let i=Math.floor(azar()*240);i>0;i--)G.tick();
  turno(G);
  if(recargas&&azar()<0.15)G=reanuda(G);
  G.ronda();
  while(G.game.active&&!G.game.over){G.tick();if(recargas&&azar()<0.0004){G=reanuda(G);break;}}
  if(!G.game.active&&!G.game.over)pruebas.push({ronda:G.game.round,tiempo:G.tiempo(),p:JSON.parse(JSON.stringify(G.prueba()))});
 }
 return {G,pruebas,reintentos};
}

test('el motor es repetible: misma semilla y mismas acciones, misma partida',()=>{
 const corre=s=>{const g=new PD.Game(0,null,s);g.place('espinas',300,170);g.place('espinas',180,240);g.startRound();for(let i=0;i<4000&&g.active;i++)g.update(P.STEP);return JSON.stringify(g.snapshot())+g.rs;};
 assert.equal(corre(42),corre(42));
 const g=new PD.Game(0,null,1);assert.ok(Math.abs(g.rnd()-new PD.Game(0,null,1).rnd())<1e-15);
 const fuente=fs.readFileSync(D+'engine.js','utf8');
 assert.equal((fuente.match(/Math\.random\(\)/g)||[]).length,1,'el motor solo usa Math.random para una semilla por defecto (la demo del menú)');
});

test('la Grabadora y rehace() dan la misma ronda y el mismo tiempo, con y sin caché',()=>{
 const {G,pruebas}=juega(0,'uidA',12);
 assert.ok(G.game.round>=12,'el bot llega a la ronda 12');
 assert.ok(G.j.some(j=>j[1]===5),'hubo al menos una recarga');
 const ultima=pruebas[pruebas.length-1];
 const r=P.rehace(ultima.p,'uidA');
 assert.equal(r.ronda,ultima.ronda);assert.equal(r.tiempo,ultima.tiempo);
 const cache=new Map();
 for(const x of pruebas){const r=P.rehace(x.p,'uidA',cache);assert.equal(r.ronda,x.ronda);assert.equal(r.tiempo,x.tiempo);}
 assert.ok(JSON.stringify(ultima.p).length<200000,'la prueba cabe en soloPruebas');
 const run=G.guardado();assert.equal(run.pr.ve,P.VERSION,'la partida guardada lleva la versión (main.js descarta las que no)');assert.equal(run.snap.round,G.game.round);
});

test('reintentar una ronda perdida gasta un reintento y se rehace igual',()=>{
 // Sin torres el Vacío se pierde enseguida: tres reintentos y fin.
 let G=new P.Grabadora(4,'uidB',null);const vistas=[];
 while(true){
  G.ronda();while(G.game.active&&!G.game.over)G.tick();
  if(!G.game.over){vistas.push({r:G.game.round,p:JSON.parse(JSON.stringify(G.prueba())),t:G.tiempo()});continue;}
  if(G.game.continues<1)break;
  const run=JSON.parse(JSON.stringify(G.guardado()));assert.equal(run.pr.c,1);
  G=new P.Grabadora(4,'uidB',run);
  assert.equal(G.game.continues,run.snap.continues-1);
  vistas.push({r:G.game.round,p:JSON.parse(JSON.stringify(G.prueba())),t:G.tiempo()});
 }
 assert.equal(G.j.filter(j=>j[1]===5&&j[2]===1).length,3,'tres reintentos');
 const cache=new Map();
 for(const v of vistas){const r=P.rehace(v.p,'uidB',cache);assert.equal(r.ronda,v.r);assert.equal(r.tiempo,v.t);assert.deepEqual(P.rehace(v.p,'uidB'),r);}
 // Un cuarto reintento no existe.
 const p=JSON.parse(JSON.stringify(vistas[vistas.length-1].p));p.j.push([p.k,5,1]);
 assert.throws(()=>P.rehace(p,'uidB'),/reintento sin reintentos|recarga/);
});

test('el verificador del club acepta la partida y rechaza cada trampa',async()=>{
 const {pruebas}=juega(1,'uidC',8,{semilla:11});
 const x=pruebas[pruebas.length-1];
 const dato={categoria:'club-prodefender-dunas',puntos:x.ronda,tiempo:x.tiempo,partida:'p1'};
 assert.equal(await V.verificaClub('prodefender',dato,x.p,{uid:'uidC'}),null);
 assert.match(await V.verificaClub('prodefender',{...dato,puntos:x.ronda+1},x.p,{uid:'uidC'}),/llega a la ronda/);
 assert.match(await V.verificaClub('prodefender',{...dato,tiempo:x.tiempo+1},x.p,{uid:'uidC'}),/tiempo/);
 assert.match(await V.verificaClub('prodefender',dato,x.p,{uid:'otra'}),/otra cuenta/);
 assert.match(await V.verificaClub('prodefender',{...dato,categoria:'club-prodefender-prado'},x.p,{uid:'uidC'}),/otro reino/);
 assert.match(await V.verificaClub('prodefender',dato,{...x.p,ve:999},{uid:'uidC'}),/otra versión/);
 // Más oro del que había: una torre cara en la primera jugada no se puede colocar.
 const rica=JSON.parse(JSON.stringify(x.p));rica.j.unshift([0,0,PD.TOWER_ORDER.indexOf('prisma'),500,40]);
 assert.match(await V.verificaClub('prodefender',dato,rica,{uid:'uidC'}),/no se puede rehacer|llega a la ronda/);
 // Esperar entre rondas más de lo que el juego deja.
 const lenta={...x.p,k:x.p.k+P.QUIETO_MAX+5};
 assert.match(await V.verificaClub('prodefender',dato,lenta,{uid:'uidC'}),/espera más/);
 assert.equal(V.sospechaFila('club-prodefender-prado',{puntos:50,tiempo:60000}),'Rondas más cortas de lo que el juego permite.');
 assert.equal(V.sospechaFila('club-prodefender-prado',{puntos:50,tiempo:3000000}),null);
});

test('las monedas: 20 × reino por ronda del récord, hasta 2000…10000, y solo la diferencia',()=>{
 assert.deepEqual(['prado','dunas','glaciar','caldera','vacio','pantano','cumbres','fosa','engranajes','eclipse','necropolis','esporas','espejos','archipielago','noche'].map(r=>M.monedasProdefender('club-prodefender-'+r,100)),[2000,4000,6000,8000,10000,10000,10000,10000,10000,10000,10000,10000,10000,10000,10000]);
 assert.equal(M.monedasProdefender('club-prodefender-noche',42),4200,'la tercera era también paga 100 por ronda');
 assert.equal(M.monedasProdefender('club-prodefender-fosa',37),3700,'la segunda era paga 100 por ronda, como el Vacío');
 assert.equal(M.monedasProdefender('club-prodefender-prado',60),1200);
 assert.equal(M.monedasProdefender('club-prodefender-prado',70)-M.monedasProdefender('club-prodefender-prado',60),200);
 assert.equal(M.monedasProdefender('club-prodefender-prado',150),2000,'pasada la 100 no paga más');
 // En la economía: una fila por reino paga sus rondas (más los logros que da), y no hay pago por partida.
 const uid='u1',fila=n=>({[uid]:{puntos:n,tiempo:1,nombre:'x',partida:'p'}});
 const g=M.ganadoDe(uid,{solo:{'club-prodefender-prado':fila(60),'club-prodefender-vacio':fila(10)}});
 assert.equal(g.partes.records,60*20+10*100);
 assert.ok(!M.JUEGOS_CLUB.includes('prodefender')&&!('prodefender' in M.PAGO_CLUB),'no paga por partida');
 assert.equal(M.NIVEL.prodefender.length,10);
});

test('categorías, topes y reglas de Firebase',()=>{
 for(const r of ['prado','dunas','glaciar','caldera','vacio','pantano','cumbres','fosa','engranajes','eclipse','necropolis','esporas','espejos','archipielago','noche'])assert.ok(C.categoriaClub('prodefender','club-prodefender-'+r),r);
 assert.equal(C.categoriaClub('prodefender','club-prodefender-otro'),false);
 const ok={categoria:'club-prodefender-prado',puntos:100,tiempo:5,partida:'a-b'};
 assert.ok(C.resultadoClub('prodefender',ok));
 assert.equal(C.resultadoClub('prodefender',{...ok,puntos:101}),null);
 assert.equal(V.juegoDeCategoria('club-prodefender-vacio'),'prodefender');
 const reglas=fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8');
 assert.equal((reglas.match(/club-prodefender-\(prado\|dunas\|glaciar\|caldera\|vacio\|pantano\|cumbres\|fosa\|engranajes\|eclipse\|necropolis\|esporas\|espejos\|archipielago\|noche\)/g)||[]).length,2,'soloRanks y soloPruebas');
 assert.deepEqual(P.REINOS,['prado','dunas','glaciar','caldera','vacio','pantano','cumbres','fosa','engranajes','eclipse','necropolis','esporas','espejos','archipielago','noche'],'prueba.js conoce los quince reinos');
 assert.match(reglas,/beginsWith\('club-prodefender-'\) \|\| newData\.val\(\) <= 100/);
 // El juego carga el mismo motor que el verificador, con el mismo ?v=.
 const html=fs.readFileSync(path.join(D,'../index.html'),'utf8'),trab=fs.readFileSync(D+'verificador.js','utf8'),verif=fs.readFileSync('src/juegos/solo/verifica/prodefender.js','utf8');
 const v=html.match(/js\/engine\.js\?v=(pd-\d+)/)[1];
 for(const f of ['data/enemies.js','data/towers.js','data/levels.js','engine.js','prueba.js']){assert.ok(html.includes('js/'+f+'?v='+v),f);assert.ok(trab.includes("'"+f+'?v='+v+"'"),'trabajador '+f);}
 assert.ok(verif.includes('verificador.js?v='+v),'la página abre el trabajador de la misma versión');
});

test('héroes: uno por reino y por partida, sube sus dos caminos y la partida se rehace igual',()=>{
 for(let li=0;li<5;li++){
  const h=PD.heroOf(li);assert.ok(h&&PD.TOWERS[h].hero,'el reino '+li+' tiene héroe');
  const otros=PD.towersFor(li).filter(id=>PD.TOWERS[id].hero);assert.deepEqual(otros,[h],'solo el héroe de su reino');
  assert.ok(PD.ABILITIES[PD.TOWERS[h].base.ability],'su habilidad existe');
 }
 // Una partida con el héroe: se coloca uno, el segundo no, sube 4-4 y lanza su habilidad.
 const G=new P.Grabadora(0,'uidH',null),g=G.game;g.money=1e7;
 // (el oro de más no es una trampa aquí: rehace() no lo sabe, así que la prueba solo compara el motor consigo mismo)
 const h=G.colocar('heroeprado',300,170);assert.ok(h,'se coloca');
 assert.equal(G.colocar('heroeprado',600,330),null,'un segundo héroe no');
 for(let q=0;q<4;q++){assert.ok(G.mejorar(h,0));assert.ok(G.mejorar(h,1));}
 assert.deepEqual(h.tiers,[4,4]);
 const t=G.colocar('espinas',180,240);
 for(const p of [0,0,0,1,1])assert.ok(G.mejorar(t,p));
 assert.equal(g.canUpgrade(t,1),false,'las torres siguen con la regla 4/2');
 let hab=0;
 for(let r=0;r<12;r++){G.ronda();while(g.active&&!g.over){G.tick();for(const e of g.events)if(e.type==='ability'&&e.id==='selva')hab++;g.events.length=0;}}
 assert.ok(hab>0,'Selva Ancestral se lanzó');
 const snap=JSON.stringify(g.snapshot());
 const corre=()=>{const G2=new P.Grabadora(0,'uidH',null);G2.st.s=G.st.s;G2.st.game=new PD.Game(0,null,P.semillaTramo(G.st.s,'uidH',0));G2.game.money=1e7;
  for(const j of G.j){while(G2.paso<j[0])G2.tick();const c=j[1];if(c===0)G2.colocar(PD.TOWER_ORDER[j[2]],j[3],j[4]);else if(c===1)G2.mejorar(G2.game.towers.find(x=>x.id===j[2]),j[3]);else if(c===4)G2.ronda();}
  while(G2.paso<G.paso)G2.tick();return JSON.stringify(G2.game.snapshot());};
 assert.equal(corre(),snap,'misma semilla y mismas jugadas, misma partida (con héroe)');
});

test('huertos rebajados y enemigos con más vida a partir de las primeras rondas',()=>{
 const g=new PD.Game(0,null,3);g.money=1e7;
 const f=g.place('huerto',60,60);assert.ok(f);
 assert.equal(f.s.income,48);
 for(let q=0;q<4;q++)g.upgrade(f,0);
 assert.equal(f.s.income,48+30+72+180+600,'40 % menos que antes (1550 → 930)');
 assert.equal(PD.hpBoost(1),1);assert.equal(PD.hpBoost(25),2);assert.equal(PD.hpBoost(80),2);assert.equal(PD.hpBoost(80,true),1.5);
 g.round=30;g.startRound();for(let i=0;i<120&&!g.enemies.length;i++)g.update(P.STEP);
 const e=g.enemies[0];assert.ok(e);assert.ok(Math.abs(e.maxHp-e.d.hp*PD.hpMult(g.L,31)*2)<1e-6,'vida x2 en la ronda 31');
});

test('rondas altas: grupos de enemigos duros en decenas, no cientos de débiles',()=>{
 for(let li=0;li<5;li++){
  const R=PD.buildRounds(li);let llenos=0,grupos=0;
  for(let r=60;r<=100;r++){const x=R[r-1];if(x.special||x.boss)continue;for(const g of x.groups){grupos++;if(g.n>=160)llenos++;}}
  assert.ok(llenos/grupos<0.1,PD.LEVELS[li].short+': '+llenos+' de '+grupos+' grupos son de 160 o más');
 }
});

test('héroes: mejoras más caras y un nivel 5 de 60000 en un solo camino',()=>{
 for(let li=0;li<5;li++){
  const d=PD.TOWERS[PD.heroOf(li)];
  for(const P5 of d.paths){assert.equal(P5.ups.length,5);assert.equal(P5.ups[4].cost,60000);}
  assert.ok(d.paths.every(P5=>P5.ups[3].cost>=33000),'el nivel 4 cuesta al menos 33000');
 }
 const g=new PD.Game(1,null,5);g.money=1e7;
 const h=g.place('heroedunas',120,330);assert.ok(h);
 for(let q=0;q<4;q++){g.upgrade(h,0);g.upgrade(h,1);}
 assert.deepEqual(h.tiers,[4,4]);
 assert.ok(g.canUpgrade(h,0)&&g.canUpgrade(h,1),'con 4-4 cualquiera de los dos puede ir al 5');
 assert.ok(g.upgrade(h,1));assert.deepEqual(h.tiers,[4,5]);
 assert.equal(g.canUpgrade(h,0),false,'pero solo uno');
 assert.equal(h.s.ampAura,0.45,'el nivel 5 se aplica');
 const t=g.place('espinas',300,170);for(const p of [0,0,0,0])g.upgrade(t,p);
 assert.equal(g.canUpgrade(t,0),false,'las torres siguen llegando solo al 4');
});

test('retroceso con tope por torre: nadie vuelve para siempre, pero nadie se vuelve inmune',()=>{
 const g=new PD.Game(1,null,9);g.money=1e7;g.active=true;g.queue=[{t:1e9}];
 const h=g.place('heroedunas',120,330);for(let q=0;q<4;q++)g.upgrade(h,1);   // Tormenta Eterna: todo el mapa, 360
 const e=g.spawn('robusto',0,900,1);e.hp=e.maxHp=1e9;
 let atras=0;for(let k=0;k<5;k++){const d0=e.dist;h.abilityCd=0;e.stunImm=0;g.useAbility(h);atras+=d0-e.dist;}
 const tope=PD.KB.torre(e)*1.5;
 assert.ok(atras<=tope+1e-9,'cinco Tormentas devuelven como mucho el tope de esa torre ('+atras+')');
 // la torre que ya gastó su tope no empuja más, pero otra torre sí (antes quedaba inmune)
 const a={id:-10},b={id:-11};
 const f=g.spawn('robusto',0,1500,1);
 let d0=f.dist;for(let k=0;k<20;k++)g.retrocede(f,50,a);
 assert.ok(d0-f.dist<=PD.KB.torre(f)+1e-9,'una torre tiene tope');
 d0=f.dist;g.retrocede(f,50,a);assert.equal(f.dist,d0,'gastado su tope ya no empuja');
 assert.ok(g.retrocede(f,50,b)>0,'otra torre más adelante sigue empujando');
 // y cada empuje rinde menos cuanto más lleva retrocedido
 const x1=g.spawn('robusto',0,1500,1),x2=g.spawn('robusto',0,1500,1);x2.pulled=300;x2.kb={[b.id]:300};
 assert.ok(g.retrocede(x2,40,a)<g.retrocede(x1,40,a),'rinde menos si otras torres ya lo empujaron');
 // los hijos heredan el retroceso ya gastado
 const p=g.spawn('portador',0,800,1);g.retrocede(p,500,a);
 const n0=g.enemies.length;g.kill(p,null);
 const hijos=g.enemies.slice(n0);assert.ok(hijos.length>0);
 assert.ok(hijos.every(c=>c.pulled===p.pulled&&c.kb[a.id]===p.kb[a.id]),'los hijos no empiezan de cero');
 // la Grieta devuelve a cada enemigo una sola vez
 const v=new PD.Game(4,null,9);v.money=1e7;v.active=true;v.queue=[{t:1e9}];
 const n=v.place('heroevacio',250,380);const x=v.spawn('robusto',0,1500,1);x.hp=x.maxHp=1e9;
 n.abilityCd=0;v.useAbility(n);const d1=x.dist;assert.ok(d1<1500);
 n.abilityCd=0;v.useAbility(n);assert.equal(x.dist,d1,'la segunda Grieta ya no lo devuelve');
});

test('pinchos: se tiran en el camino, golpean a los de tierra, se gastan y quedan en la foto',()=>{
 const g=new PD.Game(0,null,3);g.money=1e5;
 assert.equal(g.placeSpikes(5,5),null,'fuera del camino no');
 const p0=g.paths[0].pts[1];
 const sp=g.placeSpikes(p0[0]+3,p0[1]+3);assert.ok(sp,'sobre el camino sí');
 assert.equal(g.placeSpikes(sp.x,sp.y),null,'no dos montones en el mismo lugar');
 assert.ok(g.money===1e5-PD.PINCHOS.costo(1));
 const snap=JSON.parse(JSON.stringify(g.snapshot()));assert.equal(snap.spikes.length,1);
 const g2=new PD.Game(0,snap,3);assert.equal(g2.spikes.length,1);
 g.startRound();let k=0;while(g.active&&k<60*120){g.update(P.STEP);k++;}
 assert.ok(g.spikes.length===0||g.spikes[0].n<PD.PINCHOS.puas,'los enemigos que pasan gastan púas');
});

test('congelar deja al enemigo un segundo sin poder volver a congelarse',()=>{
 const g=new PD.Game(0,null,2);const e=g.spawn('robusto',0,300,1);
 g.applyFreeze(e,1.5);assert.equal(e.frozenT,1.5);
 g.applyFreeze(e,3);assert.equal(e.frozenT,1.5,'no se alarga mientras está congelado');
 for(let i=0;i<120;i++)g.update(P.STEP);   // 2 s: 1.5 congelado + 0.5 de inmunidad
 assert.ok(e.frozenT<=0);g.applyFreeze(e,1);assert.ok(!(e.frozenT>0),'aún inmune: solo se frena');
 for(let i=0;i<40;i++)g.update(P.STEP);
 g.applyFreeze(e,1);assert.ok(e.frozenT>0,'pasado el segundo, se congela otra vez');
});

test('rondas altas: llegan los grandes (supertanques y superglobos) que se abren en otros',()=>{
 for(const id of ['fortaleza','ciudadela','leviatan','zepelin','dirigible','celeste','arca'])assert.ok(PD.ENEMIES[id].big&&PD.ENEMIES[id].children,id);
 assert.ok(['zepelin','dirigible','celeste','arca'].every(id=>PD.ENEMIES[id].flying),'los globos vuelan');
 for(let li=0;li<5;li++){
  const R=PD.buildRounds(li);let grandes=0,total=0,maxN=0;
  for(let r=90;r<=99;r++)for(const g of R[r-1].groups){const t=PD.enemyThreat(g.type)*g.n;total+=t;if(PD.ENEMIES[g.type].big)grandes+=t;maxN=Math.max(maxN,R[r-1].groups.reduce((a,x)=>a+x.n,0));}
  assert.ok(grandes/total>0.6,PD.LEVELS[li].short+': de la 90 a la 99 los grandes son el '+Math.round(100*grandes/total)+' % de la amenaza');
  assert.ok(maxN<450,PD.LEVELS[li].short+': ninguna ronda de la 90 a la 99 manda '+maxN+' enemigos');
  const pool=PD.LEVELS[li].pool.map(p=>p[0]);
  for(const id of ['fortaleza','ciudadela','leviatan','zepelin','dirigible','celeste','arca'])assert.ok(pool.includes(id),PD.LEVELS[li].short+' tiene '+id);
 }
});

/* Segunda era: cinco reinos que se abren a todos uno por día (levels.js `abre`), con
   su tabla y 100 monedas por ronda. Sus mecánicas solo se activan con sus campos: los
   cinco primeros reinos se simulan igual que antes (por eso la prueba sigue en la
   misma VERSION). */
test('segunda era: un reino por día desde el 22 de octubre de 2026, con su tabla, su defensa, su héroe y menos defensas',async()=>{
 assert.equal(PD.PUBLIC_LEVELS,5);
 assert.equal(PD.LEVELS.length,15);
 assert.deepEqual(PD.LEVELS.slice(5,10).map(L=>L.abre),['2026-10-22','2026-10-23','2026-10-24','2026-10-25','2026-10-26']);
 assert.match(PD.diaChile(),/^\d{4}-\d{2}-\d{2}$/);
 for(let li=0;li<5;li++)assert.ok(PD.abierto(li,'2000-01-01'),'los cinco de siempre están siempre abiertos');
 assert.deepEqual([5,6,7,8,9].map(li=>PD.abierto(li,'2026-10-21')),[false,false,false,false,false]);
 assert.deepEqual([5,6,7,8,9].map(li=>PD.abierto(li,'2026-10-22')),[true,false,false,false,false]);
 assert.deepEqual([5,6,7,8,9].map(li=>PD.abierto(li,'2026-10-24')),[true,true,true,false,false]);
 assert.deepEqual([5,6,7,8,9].map(li=>PD.abierto(li,'2026-10-26')),[true,true,true,true,true]);
 let antes=99;
 for(let li=5;li<10;li++){
  const L=PD.LEVELS[li],ids=PD.towersFor(li);
  assert.ok(L.abre&&L.torres,L.short+' tiene su día y vende su lista');
  assert.ok(ids.length<antes,L.short+' vende menos que el anterior ('+ids.length+')');antes=ids.length;
  assert.deepEqual(ids.filter(id=>PD.TOWERS[id].hero),[PD.heroOf(li)],'su héroe');
  assert.ok(ids.some(id=>PD.TOWERS[id].realm===li&&!PD.TOWERS[id].hero),'su defensa nueva');
  assert.ok(PD.ABILITIES[PD.TOWERS[PD.heroOf(li)].base.ability],'la habilidad del héroe existe');
  assert.ok(PD.ENEMIES[L.boss].boss,'su jefe');
  assert.equal(PD.buildRounds(li).length,100);
  // tiene tabla: el verificador la conoce (y rechaza una prueba vacía por su forma, no por la tabla)
  const cat='club-prodefender-'+L.short.toLowerCase();
  assert.equal(P.categoria(li),cat);assert.equal(P.reinoDe(cat),li);
  assert.ok(C.categoriaClub('prodefender',cat),cat);
  assert.equal(V.juegoDeCategoria(cat),'prodefender');
 }
 // los reinos de siempre venden lo mismo que antes (12 clásicas + las de reino + su héroe)
 for(let li=0;li<5;li++)assert.equal(PD.towersFor(li).length,12+2*(li+1)+1);
 // las torres nuevas van al final de TOWER_ORDER (las pruebas guardan el índice)
 assert.equal(PD.TOWER_ORDER.indexOf('heroevacio'),26);
});

test('segunda era: el verificador del club acepta una partida del Pantano y la guarda en su tabla',async()=>{
 const {pruebas}=juega(5,'uidP',6,{semilla:5});
 const x=pruebas[pruebas.length-1];
 const dato={categoria:'club-prodefender-pantano',puntos:x.ronda,tiempo:x.tiempo,partida:'p1'};
 assert.equal(await V.verificaClub('prodefender',dato,x.p,{uid:'uidP'}),null);
 assert.match(await V.verificaClub('prodefender',{...dato,categoria:'club-prodefender-cumbres'},x.p,{uid:'uidP'}),/otro reino/);
});

// coloca `type` en el sitio libre más cercano a (x0, y0)
const ponCerca=(g,type,x0,y0)=>{for(let r=0;r<400;r+=6)for(let a=0;a<6.283;a+=0.35){const t=g.place(type,Math.round(x0+Math.cos(a)*r),Math.round(y0+Math.sin(a)*r));if(t)return t;}return null;};

test('segunda era: la partida de un reino nuevo se repite igual (sus mecánicas usan el azar de la partida)',()=>{
 for(const li of [5,6,7,8,9]){
  const G=new P.Grabadora(li,'uidN',null),g=G.game;g.money=1e7;
  const ids=PD.towersFor(li);
  ids.forEach((id,i)=>{for(let q=0;q<300;q++){const t=G.colocar(id,40+((q*137+i*71)%920),40+((q*251+i*13)%560));if(t){for(const p of [0,0,1,1,0])G.mejorar(t,p);break;}}});
  for(let r=0;r<26&&!g.over;r++){G.ronda();while(g.active&&!g.over)G.tick();}
  assert.ok(g.round>=25,PD.LEVELS[li].short+' llega al jefe de la ronda 25');
  const snap=JSON.stringify(g.snapshot());
  const G2=new P.Grabadora(li,'uidN',null);G2.st.s=G.st.s;G2.st.game=new PD.Game(li,null,P.semillaTramo(G.st.s,'uidN',0));G2.game.money=1e7;
  for(const j of G.j){while(G2.paso<j[0])G2.tick();const c=j[1];if(c===0)G2.colocar(PD.TOWER_ORDER[j[2]],j[3],j[4]);else if(c===1)G2.mejorar(G2.game.towers.find(x=>x.id===j[2]),j[3]);else if(c===4)G2.ronda();}
  while(G2.paso<G.paso)G2.tick();
  assert.equal(JSON.stringify(G2.game.snapshot()),snap,PD.LEVELS[li].short+': misma semilla y mismas jugadas, misma partida');
 }
});

test('segunda era: las mecánicas nuevas de los enemigos',()=>{
 const nuevo=(li)=>{const g=new PD.Game(li,null,3);g.money=1e7;g.active=true;g.queue=[{t:1e9}];return g;};
 // Elemental de Tormenta: la electricidad lo cura
 let g=nuevo(6);let e=g.spawn('tormentoso',0,300,1);e.hp=10;
 assert.equal(g.damage(e,8,'elec',null,{}),0);assert.ok(e.hp>10,'se cura');
 assert.ok(g.damage(e,5,'phys',null,{})>0);
 // Cangrejo: blindaje 14 hasta el sexto golpe
 g=nuevo(7);e=g.spawn('cangrejo',0,300,1);e.hp=e.maxHp=1e6;
 const d1=g.damage(e,20,'phys',null,{});for(let k=0;k<6;k++)g.damage(e,20,'phys',null,{});
 assert.ok(g.damage(e,20,'phys',null,{})>d1*2,'con el caparazón roto entra mucho más');
 // Sapo: salta y en el aire nadie lo toca
 g=nuevo(5);e=g.spawn('sapo',0,100,1);e.hp=e.maxHp=1e6;
 let salto=false;for(let k=0;k<60*8&&!salto;k++){g.update(1/60);if(e.hopping){salto=true;assert.equal(g.damage(e,50,'phys',null,{}),0);}}
 assert.ok(salto,'saltó');
 // Bruma: los que la rodean quedan camuflados para quien no detecta
 g=nuevo(5);const b=g.spawn('bruma',0,400,1);const o=g.spawn('brote',0,410,1);b.hp=b.maxHp=o.hp=o.maxHp=1e6;
 g.update(1/60);
 assert.ok(o.niebla&&!g.canSee({s:{camo:false}},o)&&g.canSee({s:{camo:true}},o),'la niebla camufla');
 // Gárgola: se petrifica (inmune) bajo el 40% una vez
 g=nuevo(6);e=g.spawn('gargola',0,300,1);g.damage(e,e.maxHp*0.7,'arcane',null,{});g.update(1/60);
 assert.ok(e.piedraT>0&&g.damage(e,10,'arcane',null,{})===0,'piedra');
 // Autómata: se adapta al daño que más recibe
 g=nuevo(8);e=g.spawn('automata',0,300,1);e.hp=e.maxHp=1000;
 const a1=g.damage(e,100,'arcane',null,{});g.damage(e,300,'arcane',null,{});
 assert.ok(e.res.arcane&&g.damage(e,100,'arcane',null,{})<a1,'adaptado al arcano');
 // Pararrayos: nada apaga a las torres que cubre
 g=nuevo(6);const rod=ponCerca(g,'pararrayos',520,180),t1=ponCerca(g,'espinas',rod.x+40,rod.y);
 assert.ok(t1&&rod);g.disableTower(t1,3);assert.equal(t1.disabledT,0,'protegida');
 // Rey del Trueno: apaga las torres más caras sin proteger
 g=nuevo(6);const cara=ponCerca(g,'espinas',230,330),media=ponCerca(g,'espinas',780,470),barata=ponCerca(g,'vigia',560,180);cara.spent=9999;media.spent=5000;
 const rey=g.spawn('reyTrueno',0,200,1,2);rey.thT=0;g.update(1/60);
 assert.ok(cara.disabledT>0&&!(barata.disabledT>0),'fulmina la más cara');
 // Kraken: atrapa torres hasta perder un 6% de vida
 g=nuevo(7);const k1=ponCerca(g,'espinas',230,200);const kr=g.spawn('kraken',0,250,1,2);kr.grabT=0;g.update(1/60);
 assert.ok(k1.disabledT>0,'la atrapó');g.damage(kr,kr.maxHp*0.1,'arcane',null,{});g.update(1/60);
 assert.equal(k1.disabledT,0,'la suelta al perder vida');
 // Hidra: le crecen cabezas al perder vida
 g=nuevo(5);const h=g.spawn('hidra',0,300,1,2);const n0=g.enemies.length;
 g.damage(h,h.maxHp*0.3,'arcane',null,{});g.update(1/60);
 assert.equal(g.enemies.filter(x=>x.type==='cabezaHidra').length,3,'tres cabezas');assert.ok(g.enemies.length>n0);
 // Eclipse: a la mitad se parte en el Sol y la Luna
 g=nuevo(9);const ec=g.spawn('eclipse',0,300,1,2);
 g.damage(ec,ec.maxHp*0.6,'arcane',null,{});g.update(1/60);
 assert.ok(ec.dead&&g.enemies.some(x=>x.type==='solGemelo')&&g.enemies.some(x=>x.type==='lunaGemela'),'se partió');
 // Mártir: al morir deja invulnerables a los cercanos
 g=nuevo(9);const m=g.spawn('martir',0,300,1),v=g.spawn('brote',0,310,1);g.kill(m,null);
 assert.ok(v.invulnT>0&&g.damage(v,5,'phys',null,{})===0);
 // Duende: al escaparse se lleva oro
 g=nuevo(5);g.money=1000;g.leak(g.spawn('duende',0,10,1));assert.equal(g.money,940);
});

test('segunda era: las defensas nuevas',()=>{
 const nuevo=(li)=>{const g=new PD.Game(li,null,3);g.money=1e7;g.active=true;g.queue=[{t:1e9}];return g;};
 // Bruja: convierte en sapo (sin blindaje) a los que no son grandes
 let g=nuevo(5);const e=g.spawn('blindado',0,300,1);e.hp=e.maxHp=1e6;
 g.sapifica(e,2,0.25);assert.ok(e.sapoT>0);
 const big=g.spawn('portador',0,300,1);g.sapifica(big,0,0);assert.ok(!(big.sapoT>0),'a los grandes solo con la mejora');
 // Desintegrador: un porcentaje de la vida máxima
 g=nuevo(8);const d=ponCerca(g,'desintegrador',140,260);assert.ok(d);
 const x=g.spawn('robusto',0,1,1);x.hp=x.maxHp=1e5;let n=0;
 while(!d.beams.length&&n++<2000)g.update(1/60);
 const hp0=x.hp;for(let k=0;k<60;k++)g.update(1/60);
 if(d.beams.length)assert.ok(hp0-x.hp>1e5*0.02,'quita más del 2% por segundo');
 // Campanario: repite el daño reciente
 g=nuevo(9);const c=ponCerca(g,'campanario',400,200);const y=g.spawn('robusto',0,1,1);y.hp=y.maxHp=1e6;
 assert.ok(c);y.eco=1000;y.x=c.x+20;y.y=c.y;g.grid.clear();g.grid.add(y);c.cdT=0;g.tBell(c,c.s,1/60);
 assert.ok(1e6-y.hp>=1000*c.s.eco,'eco');
 // Ada: descuenta las mejoras de las torres de su alrededor
 g=nuevo(8);const t=ponCerca(g,'espinas',600,250);const c0=g.upgradeCost(t,0);
 const ada=ponCerca(g,'heroeengranaje',t.x+45,t.y);assert.ok(ada&&Math.hypot(ada.x-t.x,ada.y-t.y)<=ada.s.aura);
 assert.ok(g.upgradeCost(t,0)<c0,'más barata cerca de Ada');
});

/* Tercera era (reinos 11–15): un reino por día desde el 27 de octubre, más difícil, con
   pactos, eventos, el Poder del Reino, héroe a elección y mecánicas nuevas. Todo depende
   de era: 3 o de campos nuevos, así que los diez reinos anteriores se juegan igual. */
const nuevo3=(li,seed)=>{const g=new PD.Game(li,null,seed||3);g.money=1e7;g.active=true;g.queue=[{t:1e9}];g.qi=0;g.hurryT=1e9;g.rt=0;return g;};

test('tercera era: cinco reinos, uno por día del 27 al 31 de octubre, con su tabla y el héroe que se elija',()=>{
 const T=[10,11,12,13,14];
 assert.deepEqual(T.map(li=>PD.LEVELS[li].abre),['2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31']);
 assert.deepEqual(T.map(li=>PD.abierto(li,'2026-10-26')),[false,false,false,false,false]);
 assert.deepEqual(T.map(li=>PD.abierto(li,'2026-10-29')),[true,true,true,false,false]);
 assert.deepEqual(T.map(li=>P.categoria(li)),['club-prodefender-necropolis','club-prodefender-esporas','club-prodefender-espejos','club-prodefender-archipielago','club-prodefender-noche']);
 for(const li of T){
  const L=PD.LEVELS[li];
  assert.equal(L.era,3);assert.ok(L.diff>PD.LEVELS[9].diff,L.short+' es más difícil que el Eclipse');
  assert.equal(PD.heroesOf(li).length,10,'los diez héroes para elegir');
  assert.ok(PD.ENEMIES[L.boss].boss&&PD.PODERES[L.poder],'jefe y poder');
  const R=PD.buildRounds(li);assert.equal(R.length,100);
  const ev=R.map((x,i)=>x.evento?i+1:0).filter(Boolean);
  assert.deepEqual(ev,[8,13,18,23,28,33,38,43,48,53,58,63,68,73,78,83,88,93,98],'un evento cada cinco rondas');
  for(let i=1;i<R.length;i++)if(R[i].evento&&R[i-5]&&R[i-5].evento)assert.notEqual(R[i].evento,R[i-5].evento,'no dos iguales seguidos');
  for(const [id] of L.pool)assert.ok(PD.ENEMIES[id],id);
  for(const id of L.torres)assert.ok(PD.TOWERS[id],id);
  assert.equal(P.reinoDe(P.categoria(li)),li);
  assert.ok(C.categoriaClub('prodefender',P.categoria(li)));
 }
 // un solo héroe por partida, cualquiera de los diez
 const g=nuevo3(12);let h=null;for(let x=60;x<960&&!h;x+=12)h=g.place('heroeprado',x,320);
 assert.ok(h);for(let x=60;x<960;x+=12)assert.equal(g.place('heroeeclipse',x,560),null);
});

test('tercera era: los pactos se eligen antes de la ronda, se aplican y quedan en la foto',()=>{
 const g=new PD.Game(10,null,5);
 assert.ok(g.pactoPendiente());assert.equal(g.startRound(),false,'sin pacto no arranca');
 const ofs=g.ofertasPacto();assert.equal(ofs.length,3);assert.equal(new Set(ofs.map(p=>p.id)).size,3);
 // cristal: +30% de daño y vender devuelve el 40%
 const i=ofs.findIndex(p=>p.id==='cristal');
 const cual=i>=0?i:0,id=ofs[cual].id;
 const t=g.place('espinas',120,180)||g.place('espinas',200,40);const d0=t.s.dmg;
 assert.ok(g.elegirPacto(cual));assert.ok(!g.pactoPendiente());assert.equal(g.pactos[0].id,id);
 if(id==='cristal'){assert.ok(Math.abs(t.s.dmg-d0*1.3)<1e-9);assert.equal(g.sellValue(t),Math.floor(t.spent*0.4));}
 assert.ok(g.startRound(),'ya arranca');
 // vuelve igual de la foto (y con sus modificadores)
 const g2=new PD.Game(10,JSON.parse(JSON.stringify({...g.snapshot()})),9);
 assert.deepEqual(g2.pactos,g.pactos);assert.deepEqual(g2.mods,g.mods);
 // los pactos ya tomados no se ofrecen otra vez, y rechazarlos también cuenta como decidido
 const h=new PD.Game(10,null,5);h.elegirPacto(3);assert.ok(!h.pactoPendiente());assert.equal(h.pactos[0].id,null);
 h.round=10;assert.ok(h.pactoPendiente());
 const ofs2=h.ofertasPacto();h.pactos.push({r:20,id:ofs2[0].id});h.round=20;assert.ok(!h.ofertasPacto().some(p=>p.id===ofs2[0].id));
 // Ofrenda y Corazón de Sangre: las vidas cambian en el momento
 const k=new PD.Game(14,null,5);k.pactos=[];const vid=k.lives;
 const P1=PD.PACTOS.find(p=>p.id==='ofrenda');k.ofertasPacto=()=>[P1,P1,P1];k.elegirPacto(0);assert.equal(k.lives,Math.round(vid*0.75));
 // Contrato Mercenario: oro ahora y menos bono de ronda
 const m=new PD.Game(11,null,5),P2=PD.PACTOS.find(p=>p.id==='mercenario');m.ofertasPacto=()=>[P2,P2,P2];const o0=m.money;m.elegirPacto(1);
 assert.equal(m.money,o0+P2.oro(0));assert.equal(m.mods.bono,0.7);
 // los reinos de antes no tienen pactos
 assert.ok(!new PD.Game(9,null,1).pactoPendiente());
});

test('tercera era: el Poder del Reino se carga matando y se lanza solo en ronda',()=>{
 for(const li of [10,11,12,13,14]){
  const g=nuevo3(li);g.pactos=[{r:0,id:null}];
  assert.equal(g.lanzarPoder(500,300),false,'vacío no se lanza');
  for(let i=0;i<120&&g.energia<PD.ENERGIA_MAX;i++){const e=g.spawn('brote',0,200,1);g.damage(e,1e9,'arcane',null,{});}
  assert.equal(g.energia,PD.ENERGIA_MAX);
  const e=g.spawn('robusto',0,300,1);e.hp=e.maxHp=1e9;g.update(1/60);
  const hp0=e.hp;assert.ok(g.lanzarPoder(Math.round(e.x),Math.round(e.y)),PD.LEVELS[li].short);
  assert.equal(g.energia,0);
  for(let k=0;k<60;k++)g.update(1/60);
  assert.ok(e.hp<hp0||e.holdT>0||e.slowT>0,PD.LEVELS[li].short+': el poder hace algo');
 }
 const q=new PD.Game(10,null,1);q.energia=100;assert.equal(q.lanzarPoder(500,300),false,'entre rondas no');
});

test('tercera era: la partida se rehace igual con pactos, poderes, eventos y recargas',()=>{
 for(const li of [10,12,14]){
  let a=11+li;const azar=()=>{a=(a*1103515245+12345)>>>0;return a/4294967296;};
  let G=new P.Grabadora(li,'uidT',null);const ids=PD.towersFor(li).filter(id=>!PD.TOWERS[id].hero);
  const vistas=[];
  for(let r=0;r<16&&!G.game.over;r++){
   const g=G.game;
   if(g.pactoPendiente())assert.ok(G.pacto(Math.floor(azar()*4)));
   for(let k=0;k<8;k++){const ty=ids[Math.floor(azar()*ids.length)];if(g.money>=g.towerCost(ty))for(let q=0;q<80;q++)if(G.colocar(ty,30+azar()*940,30+azar()*580))break;const t=g.towers[Math.floor(azar()*g.towers.length)];if(t&&azar()<0.5)G.mejorar(t,azar()<0.5?0:1);}
   if(r===6)G=new P.Grabadora(li,'uidT',JSON.parse(JSON.stringify(G.guardado())));
   G.ronda();
   while(G.game.active&&!G.game.over){G.tick();if(G.game.poderListo()&&G.game.enemies.length){const e=G.game.enemies[0];G.poder(e.x,e.y);}}
   if(!G.game.over)vistas.push({r:G.game.round,t:G.tiempo(),p:JSON.parse(JSON.stringify(G.prueba()))});
  }
  assert.ok(G.j.some(j=>j[1]===7),'hubo pactos');
  const cache=new Map();
  for(const v of vistas){const x=P.rehace(v.p,'uidT',cache);assert.equal(x.ronda,v.r);assert.equal(x.tiempo,v.t);}
  const u=vistas[vistas.length-1];assert.deepEqual(P.rehace(u.p,'uidT'),P.rehace(u.p,'uidT',new Map()));
  // un poder que no estaba listo no se puede inventar
  const malo=JSON.parse(JSON.stringify(u.p));malo.j.splice(1,0,[malo.j[0][0],8,500,300]);
  assert.throws(()=>P.rehace(malo,'uidT'),/no se puede rehacer/);
 }
});

test('tercera era: las mecánicas de los atacantes nuevos',()=>{
 let g=nuevo3(10);
 // Esqueleto: se levanta salvo que lo rematen fuego, explosivo o arcano
 let e=g.spawn('esqueleto',0,300,1);g.damage(e,1e6,'phys',null,{});
 assert.ok(!e.dead&&e.huesosT>0,'huesos');assert.equal(g.damage(e,10,'phys',null,{}),0,'lo físico no le hace nada');
 for(let k=0;k<200;k++)g.update(1/60);assert.ok(!e.dead&&!(e.huesosT>0),'se levantó');
 const f=g.spawn('esqueleto',0,300,1);g.damage(f,1e6,'fire',null,{});assert.ok(f.dead,'el fuego lo remata');
 // Nigromante: levanta a los caídos de su alrededor
 g=nuevo3(10);const n=g.spawn('nigromante',0,400,1);n.hp=n.maxHp=1e9;n.raiseT=0.05;
 const b=g.spawn('robusto',0,410,1);g.damage(b,1e9,'arcane',null,{});
 const antes=g.enemies.length;for(let k=0;k<10;k++)g.update(1/60);
 assert.ok(g.enemies.some(x=>x.zombi&&x.type==='robusto'),'zombi');
 // Alma: los proyectiles la atraviesan
 g=nuevo3(10);const al=g.spawn('alma',0,300,1);al.hp=al.maxHp=1e6;g.update(1/60);
 g.projs.push({x:al.x,y:al.y,vx:0,vy:0,life:1,r:6,dmg:100,dtype:'phys',pierce:5,hit:[],src:null,kind:'thorn',opt:{}});g.updateProjectiles(1/60);
 assert.equal(al.hp,1e6);
 // Rey Liche: invulnerable mientras vivan sus filacterias
 g=nuevo3(10);const li=g.spawn('liche',0,500,1,2);li.hp=li.maxHp*0.6;g.update(1/60);
 assert.equal(li.filas.length,3);assert.equal(g.damage(li,1000,'arcane',null,{}),0,'protegido');
 for(const x of li.filas)g.damage(x,1e9,'arcane',null,{});g.update(1/60);
 assert.ok(g.damage(li,1000,'arcane',null,{})>0,'sin filacterias, vulnerable');
 // Seta: sus esporas frenan a las torres de alrededor
 g=nuevo3(11);const t=ponCerca(g,'espinas',300,300);const s=g.spawn('seta',0,10,1);s.x=t.x+20;s.y=t.y;g.kill(s,null);assert.ok(t.esporaT>0);
 // Enredadera: con raíces no anda y tiene más blindaje
 g=nuevo3(11);const en=g.spawn('enredadera',0,300,1);en.hp=en.maxHp=1e6;en.raizCd=0.01;g.update(1/60);g.update(1/60);
 assert.ok(en.raizT>0);const d0=en.dist;g.update(1/60);assert.equal(en.dist,d0);
 // Polinizador: cura a los de alrededor
 g=nuevo3(11);const po=g.spawn('polinizador',0,300,1),he=g.spawn('robusto',0,305,1);he.hp=he.maxHp*0.5;for(let k=0;k<60;k++)g.update(1/60);assert.ok(he.hp>he.maxHp*0.5);
 // Reflejo: se desdobla al bajar de la mitad
 g=nuevo3(12);const rf=g.spawn('reflejo',0,300,1);g.damage(rf,rf.maxHp*0.6,'arcane',null,{});
 assert.ok(g.enemies.filter(x=>x.type==='reflejo').length===2);
 // Prisma Viviente: ningún golpe le quita más del 7%
 const pr=g.spawn('prismaVivo',0,300,1);const hp=pr.hp;g.damage(pr,1e9,'arcane',null,{});assert.ok(Math.abs(hp-pr.hp-pr.maxHp*0.07)<1e-6);
 // Templario: de frente recibe el 25%
 g=nuevo3(13);const te=g.spawn('templario',0,200,1);te.hp=te.maxHp=1e6;g.update(1/60);
 const delante={x:te.x+Math.cos(te.a)*100,y:te.y+Math.sin(te.a)*100,dealt:0},detras={x:te.x-Math.cos(te.a)*100,y:te.y-Math.sin(te.a)*100,dealt:0};
 const a1=g.damage(te,1000,'arcane',delante,{}),a2=g.damage(te,1000,'arcane',detras,{});assert.ok(Math.abs(a1*4-a2)<1e-6,'25% de frente');
 // Murciélago: chupa oro mientras vive
 g=nuevo3(14);g.money=1e5;g.spawn('murcielago',0,300,1);for(let k=0;k<60;k++)g.update(1/60);assert.ok(g.money<1e5);
 // Espantapájaros: las torres cercanas le tienen que disparar
 g=nuevo3(14);const tt=ponCerca(g,'espinas',250,190);const ep=g.spawn('espantapajaros',0,1,1);ep.hp=ep.maxHp=1e9;
 const otro=g.spawn('brote',0,1,1);otro.hp=otro.maxHp=1e9;
 for(let k=0;k<400;k++){g.update(1/60);if(Math.hypot(ep.x-tt.x,ep.y-tt.y)<Math.min(tt.s.range,ep.d.taunt)&&Math.hypot(otro.x-tt.x,otro.y-tt.y)<tt.s.range)break;}
 if(Math.hypot(ep.x-tt.x,ep.y-tt.y)<Math.min(tt.s.range,ep.d.taunt))assert.equal(g.pick(tt,tt.x,tt.y,tt.s.range,'first'),ep);
 // Jinete sin Cabeza: sus calabazas apagan torres
 g=nuevo3(14);ponCerca(g,'espinas',300,200);const j=g.spawn('jineteSinCabeza',0,300,1,2);j.calT=0.01;
 for(let k=0;k<90;k++)g.update(1/60);assert.ok(g.towers.some(x=>x.disabledT>0),'calabaza');
});

test('tercera era: los eventos de ronda',()=>{
 const con=(li,id)=>{const g=nuevo3(li);g.evento={id,a:0.01,b:0.01,n:0};return g;};
 // Fiebre del Oro: uno de cada seis llega dorado (triple de vida, ocho veces su oro)
 let g=con(12,'oro');const lista=[];for(let i=0;i<6;i++){const e=g.spawn('brote',0,10,1);g.alAparecer(e);lista.push(e);}
 assert.ok(lista[5].dorado&&!lista[4].dorado);assert.equal(g.oroDe(lista[5]),8);
 // Espejismo: copias falsas que no dan oro y quitan una vida
 g=con(12,'espejismo');for(let i=0;i<3;i++)g.alAparecer(g.spawn('robusto',0,10,1));
 const fa=g.enemies.find(e=>e.falso);assert.ok(fa);assert.equal(g.oroDe(fa),0);const v=g.lives;g.leak(fa);assert.equal(v-g.lives,1);
 // Luna de Sangre: más oro
 g=con(10,'lunaSangre');assert.ok(Math.abs(g.oroDe(g.spawn('brote',0,10,1))-1.6)<1e-9);
 // Apagón: todo camuflado un rato
 g=con(10,'apagon');const t=ponCerca(g,'espinas',300,300);const e=g.spawn('brote',0,10,1);g.update(1/60);
 assert.ok(g.apagonT>0);assert.ok(!g.canSee(t,e)||t.s.camo);
 // Tormenta: rayos sobre enemigos y torres
 g=con(13,'tormenta');ponCerca(g,'espinas',300,300);g.spawn('robusto',0,300,1).hp=1e9;for(let k=0;k<5;k++)g.update(1/60);
 assert.ok(g.towers.some(x=>x.disabledT>0));
 // Niebla: menos alcance (y el Pararrayos protege)
 g=con(11,'niebla');const tn=ponCerca(g,'espinas',300,300);const r0=tn.s.range;let visto=0;
 const orig=g.tProjectile.bind(g);g.tProjectile=(t2,s,dt)=>{visto=s.range;};g.update(1/60);assert.ok(Math.abs(visto-r0*0.8)<1e-9);g.tProjectile=orig;
 // Noche de los Muertos: algunos caídos se levantan
 g=con(10,'muertos');for(let i=0;i<40;i++){const x=g.spawn('brote',0,200+i,1);g.damage(x,1e9,'arcane',null,{});}
 for(let k=0;k<120;k++)g.update(1/60);assert.ok(g.enemies.some(x=>x.zombi));
});
