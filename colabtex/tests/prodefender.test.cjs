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
 assert.deepEqual(['prado','dunas','glaciar','caldera','vacio','pantano','cumbres','fosa','engranajes','eclipse'].map(r=>M.monedasProdefender('club-prodefender-'+r,100)),[2000,4000,6000,8000,10000,10000,10000,10000,10000,10000]);
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
 for(const r of ['prado','dunas','glaciar','caldera','vacio','pantano','cumbres','fosa','engranajes','eclipse'])assert.ok(C.categoriaClub('prodefender','club-prodefender-'+r),r);
 assert.equal(C.categoriaClub('prodefender','club-prodefender-otro'),false);
 const ok={categoria:'club-prodefender-prado',puntos:100,tiempo:5,partida:'a-b'};
 assert.ok(C.resultadoClub('prodefender',ok));
 assert.equal(C.resultadoClub('prodefender',{...ok,puntos:101}),null);
 assert.equal(V.juegoDeCategoria('club-prodefender-vacio'),'prodefender');
 const reglas=fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8');
 assert.equal((reglas.match(/club-prodefender-\(prado\|dunas\|glaciar\|caldera\|vacio\|pantano\|cumbres\|fosa\|engranajes\|eclipse\)/g)||[]).length,2,'soloRanks y soloPruebas');
 assert.deepEqual(P.REINOS,['prado','dunas','glaciar','caldera','vacio','pantano','cumbres','fosa','engranajes','eclipse'],'prueba.js conoce los diez reinos');
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
 assert.equal(PD.LEVELS.length,10);
 assert.deepEqual(PD.LEVELS.slice(5).map(L=>L.abre),['2026-10-22','2026-10-23','2026-10-24','2026-10-25','2026-10-26']);
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
