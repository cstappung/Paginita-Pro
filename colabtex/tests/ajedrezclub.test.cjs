/* Ajedrez Club (juegos/club/ajedrez/): las reglas (perft), el bot es
   repetible y sus niveles quedan en orden, los puzles se rehacen, y el
   verificador acepta una partida y unos puzles de verdad y rechaza cada vía
   de trampa. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path'),fs=require('node:fs');
const carga=(entry)=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const VA=carga('src/juegos/solo/verifica/ajedrez.js');
const C=carga('src/juegos/solo/club-datos.js');
const D=path.join(__dirname,'../../juegos/club/ajedrez');
const M=require(path.join(D,'motor.js'));
const PZ=require(path.join(D,'puzles.js'));
const CAT=n=>'club-ajedrez-bot'+n,CP='club-ajedrez-puzles';

function perft(p,d){if(!d)return 1;let n=0;for(const m of M.legales(p)){if(d===1){n++;continue;}M.hacer(p,m);n+=perft(p,d-1);M.deshacer(p);}return n;}

test('perft: el generador coincide con las cifras de referencia (las mismas del ajedrez de las salas)',()=>{
 const casos=[
  ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',[20,400,8902,197281]],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',[48,2039,97862]],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',[14,191,2812,43238]],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',[6,264,9467]],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',[44,1486,62379]]
 ];
 for(const [f,ns] of casos){const p=M.desdeFEN(f);ns.forEach((n,i)=>assert.equal(perft(p,i+1),n,f+' d'+(i+1)));assert.equal(M.aFEN(p),f.replace(/ (\d+) (\d+)$/,' $1 $2'),'hacer/deshacer deja la posición igual');}
});

test('notación española, FEN y finales automáticos',()=>{
 const p=M.inicial(),san=[];
 for(const s of ['e2e4','e7e5','f1c4','b8c6','d1h5','g8f6','h5f7']){const m=M.deUci(p,s);san.push(M.san(p,m));M.hacer(p,m);}
 assert.deepEqual(san,['e4','e5','Ac4','Cc6','Dh5','Cf6','Dxf7#']);
 assert.equal(M.fin(p),'mate');
 assert.equal(M.fin(M.desdeFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')),'ahogado');
 assert.equal(M.fin(M.desdeFEN('8/8/4k3/8/8/3NK3/8/8 w - - 0 1')),'material');
 assert.equal(M.fin(M.desdeFEN('8/8/4k3/8/2b5/3BK3/8/8 w - - 0 1')),'material','alfiles del mismo color: nadie puede dar mate');
 assert.equal(M.fin(M.desdeFEN('8/8/4k3/8/2b5/4B3/8/4K3 w - - 0 1')),null,'alfiles de distinto color: se puede dar mate');
 assert.equal(M.fin(M.desdeFEN('8/8/4k3/8/8/4K3/8/7R w - - 100 80')),'cincuenta');
 const r=M.inicial();for(const s of ['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8'])M.hacer(r,M.deUci(r,s));
 assert.equal(M.fin(r),'repeticion');
 assert.equal(M.deUci(M.inicial(),'e2e5'),0,'una jugada ilegal no existe');
 // Coronación: hay que decir la pieza, y se anota en español.
 const c=M.desdeFEN('8/4P3/8/8/8/k7/8/K7 w - - 0 1');
 assert.equal(M.deUci(c,'e7e8'),0);assert.equal(M.san(c,M.deUci(c,'e7e8n')),'e8=C');
});

test('el bot es repetible, y cada nivel le gana al anterior',()=>{
 const p=M.inicial();
 const a=M.eligeBot(p,3,M.azarDe(42,0)).m,b=M.eligeBot(p,3,M.azarDe(42,0)).m;
 assert.equal(a,b,'misma semilla, misma jugada');
 assert.equal(M.aFEN(p),M.INICIAL,'pensar no cambia la posición');
 assert.notEqual(M.semillaCuenta(7,'ana'),M.semillaCuenta(7,'beto'),'la cuenta entra en la semilla');
 for(const [fuerte,debil] of [[2,1],[3,2]]){
  let gana=0;
  for(let s=1;s<=4;s++){const q=M.inicial(),blanco=s%2?fuerte:debil;let ply=0,f;
   while(!(f=M.fin(q))&&ply<300){M.hacer(q,M.eligeBot(q,q.lado>0?blanco:(blanco===fuerte?debil:fuerte),M.azarDe(s,ply)).m);ply++;}
   if(f==='mate'&&((q.lado<0)===(blanco===fuerte)))gana++;}
  assert.ok(gana>=3,`el nivel ${fuerte} le gana al ${debil} (${gana}/4)`);
 }
});

test('los puzles: todos se rehacen con su solución y valen tres estrellas',()=>{
 assert.equal(PZ.TODOS.length,60);
 assert.equal(new Set(PZ.TODOS.map(p=>p.id)).size,60,'ids únicos');
 for(const pz of PZ.TODOS){
  const j=pz.l.filter((_,i)=>i%2);
  const r=M.rehacePuzle(pz,{j,e:[],p:0,t:j.map(()=>1500)});
  assert.deepEqual(r,{estrellas:3,ms:1500*j.length},pz.id);
  if(pz.grupo!=='tactica'){const p=M.posPuzle(pz,j.length-1);M.hacer(p,M.deUci(p,j.at(-1)));assert.equal(M.fin(p),'mate',pz.id+' termina en mate');}
 }
 assert.equal(M.estrellas(0,0),3);assert.equal(M.estrellas(1,0),2);assert.equal(M.estrellas(0,1),2);assert.equal(M.estrellas(5,1),1);
});

/* Una partida «humana»: el jugador es el bot Experto y piensa entre 0,9 y
   3 s cada jugada. Devuelve la prueba y el dato tal como los manda juego.js. */
function partidaGanada(nivel,color,semilla,u){
 const q=M.inicial(),lado=color==='n'?-1:1,sb=M.semillaCuenta(semilla,u),j=[],t=[];let ply=0,f,a=semilla;
 const azar=()=>{a=(a*1103515245+12345)>>>0;return a/4294967296;};
 while(!(f=M.fin(q))&&ply<400){
  const m=q.lado===lado?M.eligeBot(q,3,M.azarDe(semilla+999,ply)).m:M.eligeBot(q,nivel,M.azarDe(sb,ply)).m;
  if(q.lado===lado){j.push(M.uci(m));t.push(900+Math.round(azar()*2100));}
  M.hacer(q,m);ply++;
 }
 const ms=t.reduce((s,x)=>s+x,0);
 return {gano:f==='mate'&&q.lado!==lado,dato:{categoria:CAT(nivel),puntos:1,tiempo:ms,partida:'p1'},p:{v:1,u,s:semilla,n:nivel,c:color,j,t,a:ms,w:ms+40}};
}

test('verificador: una victoria contra el bot se acepta, y cada trampa se rechaza',async()=>{
 let g=null;
 for(let s=1;s<20&&!(g&&g.gano);s++)g=partidaGanada(1,s%2?'b':'n',s,'ana');
 assert.ok(g.gano,'el Experto le gana al Novato');
 const {dato,p}=g;
 assert.equal(await V.verificaClub('ajedrez',dato,p,{uid:'ana'}),null);
 const mal=async(d,q,re)=>{const m=await V.verificaClub('ajedrez',d,q,{uid:'ana'});assert.ok(m,'tenía que rechazar');if(re)assert.match(m,re);};
 await mal(dato,{...p,u:'beto'},/otra cuenta/);
 assert.match(await V.verificaClub('ajedrez',dato,{...p,u:'beto'},{uid:'beto'}),/./,'la prueba de otra cuenta con la cuenta cambiada no se rehace');
 await mal({...dato,categoria:CAT(2)},p,/otro nivel/);
 await mal({...dato,categoria:'club-ajedrez-otra'},p,/no tiene esa tabla/);
 await mal({...dato,tiempo:dato.tiempo-1},p,/no cuadra/);
 await mal({...dato,puntos:2},p,/valen 1/);
 await mal(dato,{...p,s:p.s+1},null);                                   // otra semilla: el bot juega distinto
 await mal(dato,{...p,j:p.j.slice(0,-1),t:p.t.slice(0,-1)},null);       // sin la jugada del mate
 await mal(dato,{...p,j:[...p.j,'a2a3'],t:[...p.t,900]},null);          // jugadas de más
 const otra=[...p.j];otra[2]='h1h8';await mal(dato,{...p,j:otra},/no es legal/);
 await mal(dato,{...p,w:Math.round(p.a*1.3)+5000},/reloj/);
 // A ritmo de programa: todo en 50 ms.
 const t=p.t.map(()=>50),ms=t.length*50;
 await mal({...dato,tiempo:ms},{...p,t,a:ms,w:ms},/programa/);
 // Una partida perdida o sin terminar no entra.
 const corta={...p,j:p.j.slice(0,3),t:p.t.slice(0,3)},ms3=corta.t.reduce((s,x)=>s+x,0);
 await mal({...dato,tiempo:ms3},{...corta,a:ms3,w:ms3},/no termina/);
});

test('verificador: los puzles se aceptan con sus estrellas, y cada trampa se rechaza',async()=>{
 const n={};let est=0,ms=0;
 PZ.TODOS.slice(0,6).forEach((pz,k)=>{
  const j=pz.l.filter((_,i)=>i%2),t=j.map((_,i)=>1200+k*100+i*37);
  let e=[];
  if(k===1){const p=M.posPuzle(pz,0);e=[[0,M.legales(p).map(M.uci).find(s=>M.paso(pz,0,s)==='mal')]];}
  n[pz.id]={j,e,p:k===2?1:0,t};
  est+=M.estrellas(e.length,k===2);ms+=t.reduce((s,x)=>s+x,0);
 });
 assert.equal(est,16,'cuatro con tres, uno con un error y otro con pista');
 const dato={categoria:CP,puntos:est,tiempo:ms,partida:'q1'},p={v:1,u:'ana',n};
 assert.equal(await V.verificaClub('ajedrez',dato,p,{uid:'ana'}),null);
 const mal=async(d,q,re)=>{const m=await V.verificaClub('ajedrez',d,q,{uid:'ana'});assert.ok(m,'tenía que rechazar');if(re)assert.match(m,re);};
 await mal({...dato,puntos:est+1},p,/estrellas no cuadran/);
 await mal({...dato,tiempo:ms+5},p,/no cuadra/);
 await mal(dato,{...p,u:'beto'},/otra cuenta/);
 await mal(dato,{...p,n:{...n,inventado:n[PZ.TODOS[0].id]}},/no tiene/);
 const id=PZ.TODOS[3].id,pz=PZ.TODOS[3];
 await mal(dato,{...p,n:{...n,[id]:{...n[id],j:['a1a2']}}},/no se puede rehacer/);
 await mal(dato,{...p,n:{...n,[id]:{...n[id],e:[[0,pz.l[1]]]}}},/no se puede rehacer/);   // la jugada buena no es un error
 // Seis puzles resueltos al instante: un programa.
 const rapido={};let s2=0,m2=0;
 PZ.TODOS.slice(0,6).forEach(pz=>{const j=pz.l.filter((_,i)=>i%2);rapido[pz.id]={j,e:[],p:0,t:j.map(()=>90)};s2+=3;m2+=90*j.length;});
 await mal({...dato,puntos:s2,tiempo:m2},{v:1,u:'ana',n:rapido},/programa/);
});

test('sospecha de filas guardadas, categorías del club y reglas de Firebase',()=>{
 assert.equal(VA.sospecha(CAT(1),{puntos:1,tiempo:40000}),null);
 assert.match(VA.sospecha(CAT(4),{puntos:1,tiempo:900}),/nadie/);
 assert.match(VA.sospecha(CP,{puntos:VA.MAX_ESTRELLAS+3,tiempo:900000}),/más de/);
 assert.match(VA.sospecha(CP,{puntos:90,tiempo:3000}),/cuarto de segundo/);
 assert.equal(V.juegoDeCategoria(CAT(3)),'ajedrez');assert.equal(V.juegoDeCategoria(CP),'ajedrez');
 for(const n of [1,2,3,4])assert.ok(C.categoriaClub('ajedrez',CAT(n)));
 assert.ok(C.categoriaClub('ajedrez',CP));assert.ok(!C.categoriaClub('ajedrez','club-ajedrez-bot5'));
 assert.ok(C.resultadoClub('ajedrez',{categoria:CAT(2),puntos:1,tiempo:61235,partida:'abc'}));
 assert.equal(C.resultadoClub('ajedrez',{categoria:CAT(2),puntos:3,tiempo:61235,partida:'abc'}),null);
 assert.equal(C.resultadoClub('ajedrez',{categoria:CP,puntos:601,tiempo:61235,partida:'abc'}),null);
 const reglas=fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8');
 assert.equal((reglas.match(/\|club-ajedrez-\(bot\[1-4\]\|puzles\)\|/g)||[]).length,2,'soloRanks y soloPruebas');
 assert.match(reglas,/\|pokelike\|ajedrezclub\|boxhead\|/,'clubJugadas');
 const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8'));
 assert.match(pkg.scripts['test:juegos'],/tests\/ajedrezclub\.test\.cjs/);
 // La página carga lo de todos los juegos del club, en orden.
 const html=fs.readFileSync(path.join(D,'index.html'),'utf8');
 const orden=['i18n.js','mando.js','conexion.css','volumen.js','conexion.js','motor.js','puzles.js','juego.js'].map(f=>html.indexOf(f));
 assert.ok(orden.every((x,i)=>x>0&&(!i||x>orden[i-1])),'orden de los scripts');
 assert.match(html,/id="sound-button"/);
 assert.match(fs.readFileSync(path.join(D,'bot.js'),'utf8'),/importScripts\('motor\.js/);
});
