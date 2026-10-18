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
 assert.deepEqual(['prado','dunas','glaciar','caldera','vacio'].map(r=>M.monedasProdefender('club-prodefender-'+r,100)),[2000,4000,6000,8000,10000]);
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
 for(const r of ['prado','dunas','glaciar','caldera','vacio'])assert.ok(C.categoriaClub('prodefender','club-prodefender-'+r),r);
 assert.equal(C.categoriaClub('prodefender','club-prodefender-otro'),false);
 const ok={categoria:'club-prodefender-prado',puntos:100,tiempo:5,partida:'a-b'};
 assert.ok(C.resultadoClub('prodefender',ok));
 assert.equal(C.resultadoClub('prodefender',{...ok,puntos:101}),null);
 assert.equal(V.juegoDeCategoria('club-prodefender-vacio'),'prodefender');
 const reglas=fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8');
 assert.equal((reglas.match(/club-prodefender-\(prado\|dunas\|glaciar\|caldera\|vacio\)/g)||[]).length,2,'soloRanks y soloPruebas');
 assert.match(reglas,/beginsWith\('club-prodefender-'\) \|\| newData\.val\(\) <= 100/);
 // El juego carga el mismo motor que el verificador, con el mismo ?v=.
 const html=fs.readFileSync(path.join(D,'../index.html'),'utf8'),trab=fs.readFileSync(D+'verificador.js','utf8'),verif=fs.readFileSync('src/juegos/solo/verifica/prodefender.js','utf8');
 const v=html.match(/js\/engine\.js\?v=(pd-\d+)/)[1];
 for(const f of ['data/enemies.js','data/towers.js','data/levels.js','engine.js','prueba.js']){assert.ok(html.includes('js/'+f+'?v='+v),f);assert.ok(trab.includes("'"+f+'?v='+v+"'"),'trabajador '+f);}
 assert.ok(verif.includes('verificador.js?v='+v),'la página abre el trabajador de la misma versión');
});
