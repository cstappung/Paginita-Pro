/* 2048 (juegos/club/dosmil/): el motor es repetible, la prueba se codifica
   y se lee igual, y el verificador rehace la partida de un bot que juega a
   ritmo de mano y rechaza cada vía de trampa. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path'),fs=require('node:fs');
const carga=(entry)=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const VD=carga('src/juegos/solo/verifica/dosmil.js');
const D=path.join(__dirname,'../../juegos/club/dosmil');
const M=require(path.join(D,'motor.js'));
const CP='club-dosmil-puntos',CF='club-dosmil-ficha';

/* Un bot de esquina: abajo, izquierda, derecha y, si nada más mueve,
   arriba. Cada jugada tarda `lento`…`lento+rango` ms. */
function juega(semilla,u,lento=150,rango=250,max=100000){
 const E=M.nueva(semilla,u),j=[],r=M.rng(semilla*13+5);
 while(M.puedeMover(E)&&j.length<max){
  for(const d of [2,3,1,0]){const C={...E,t:E.t.slice()};if(M.mueve(C,d)){M.mueve(E,d);j.push([d,j.length%4?'k':'t',Math.round(lento+r()*rango)]);break;}}
 }
 return {E,j};
}
const prueba=(s,u,lento,rango,max)=>{
 const {E,j}=juega(s,u,lento,rango,max),ms=j.reduce((a,x)=>a+x[2],0);
 return {E,j,p:{v:1,s,u,f:M.codifica(j),a:ms+20,w:ms+120,fin:!M.puedeMover(E)}};
};
const res=(p)=>M.rehace(p.s,p.u,M.decodifica(p.f));

test('el motor es determinista y la cuenta cambia el tablero',()=>{
 const a=juega(7,'ana'),b=juega(7,'ana');
 assert.deepEqual(a.E.t,b.E.t);assert.equal(a.E.puntos,b.E.puntos);
 assert.notDeepEqual(M.nueva(7,'ana').t,M.nueva(7,'beto').t);
 assert.ok(a.E.puntos>500,`el bot suma ${a.E.puntos}`);
});

test('las jugadas siguen las reglas del original',()=>{
 const E=M.nueva(1,'x');E.t=[1,1,1,1, 0,0,0,0, 2,0,2,0, 0,0,0,0];E.max=2;E.puntos=0;
 const r=M.mueve(E,3);
 assert.deepEqual(E.t.slice(0,4),[2,2,0,0]);
 assert.deepEqual(E.t.slice(8,10),[3,0]);
 assert.equal(r.suma,4+4+8);
 const F=M.nueva(1,'x');F.t=[1,2,3,4, 2,3,4,1, 3,4,1,2, 4,1,2,3];
 assert.equal(M.mueve(F,0),null);assert.equal(M.puedeMover(F),false);
 assert.equal(M.jugadasMinimas(2048),510);
});

test('codifica y decodifica las jugadas',()=>{
 const j=[[0,'r',0],[1,'t',5],[2,'k',40],[3,'m',30000],[0,'x',1001]];
 assert.deepEqual(M.decodifica(M.codifica(j)),j);
 assert.equal(M.decodifica('r0,zz!'),null);
 assert.equal(M.decodifica('k4a'),null);
 assert.deepEqual(M.decodifica(''),[]);
});

test('rehace la partida del bot',()=>{
 for(const s of [1,2,3,12345]){
  const {E,p}=prueba(s,'uid'+s);
  const r=res(p);
  assert.equal(r.error,undefined);assert.equal(r.puntos,E.puntos);assert.equal(r.max,E.max);assert.equal(r.vivo,false);
 }
});

test('el verificador acepta la partida honesta y rechaza las trampas',async()=>{
 const {E,p}=prueba(99,'ana');const r=res(p);
 const dp={categoria:CP,uid:'ana',puntos:E.puntos,tiempo:r.ms};
 const df={categoria:CF,uid:'ana',puntos:r.ficha,tiempo:r.tFicha};
 assert.equal(await V.verificaClub('dosmil',dp,p),null);
 assert.equal(await V.verificaClub('dosmil',df,p),null);
 const mal=async(d,q)=>assert.notEqual(await V.verificaClub('dosmil',d,q),null);
 await mal({...dp,puntos:E.puntos+4},p);
 await mal({...df,puntos:r.ficha*2},p);
 await mal({...dp,tiempo:r.ms-100},p);
 await mal({...df,tiempo:r.tFicha+1},p);
 await mal({...dp,uid:'beto'},p);
 await mal(dp,{...p,u:'beto'});
 await mal(dp,{...p,s:p.s+1});
 await mal(dp,{...p,v:2});
 await mal(dp,{...p,f:'x'+p.f.slice(1)});
 await mal(dp,{...p,a:1000,w:1000});
 // Una partida a medias no puede decir que terminó.
 const m=prueba(99,'ana',150,250,40),rm=res(m.p);
 assert.equal(rm.vivo,true);
 const dm={categoria:CP,uid:'ana',puntos:rm.puntos,tiempo:rm.ms};
 assert.equal(await V.verificaClub('dosmil',dm,{...m.p,fin:false}),null);
 await mal(dm,{...m.p,fin:true});
});

test('rechaza al programa que juega a ráfagas',async()=>{
 for(const s of [5,6]){
  const {p}=prueba(s,'bot',5,20),r=res(p);
  assert.match(await V.verificaClub('dosmil',{categoria:CP,uid:'bot',puntos:r.puntos,tiempo:r.ms},p),/programa/);
 }
});

test('rechaza una partida con el reloj del juego ralentizado',async()=>{
 const {E,p}=prueba(99,'ana'),r=res(p);
 assert.ok(r.ms>20000);
 const dp={categoria:CP,uid:'ana',puntos:E.puntos,tiempo:r.ms};
 assert.match(await V.verificaClub('dosmil',dp,{...p,w:2*p.a}),/velocidad del juego/);
 assert.notEqual(await V.verificaClub('dosmil',dp,{...p,w:undefined}),null);
});

test('sospecha de lo imposible',()=>{
 assert.equal(VD.sospecha(CF,{puntos:2048,tiempo:600000}),null);
 assert.notEqual(VD.sospecha(CF,{puntos:2048,tiempo:5000}),null);
 assert.notEqual(VD.sospecha(CF,{puntos:3000,tiempo:600000}),null);
 assert.notEqual(VD.sospecha(CP,{puntos:5000000,tiempo:1e9}),null);
 assert.equal(VD.sospecha(CP,{puntos:20000,tiempo:1e6}),null);
});

test('mezcla el progreso de dos dispositivos',()=>{
 assert.deepEqual(M.mezclaProgreso({mejor:900,ficha:256,fichaT:9000,partidas:3},{mejor:500,ficha:256,fichaT:7000,partidas:5}),
  {v:1,mejor:900,ficha:256,fichaT:7000,partidas:5});
 assert.deepEqual(M.mezclaProgreso(null,{ficha:512,fichaT:1}),{v:1,mejor:0,ficha:512,fichaT:1,partidas:0});
});

test('las versiones y las reglas',()=>{
 const html=fs.readFileSync(path.join(D,'index.html'),'utf8');
 assert.match(html,/motor\.js\?v=dosmil-\d+/);assert.match(html,/juego\.js\?v=dosmil-\d+/);
 const reglas=fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8');
 assert.match(reglas,/dosmil-\(puntos\|ficha\)/);
 assert.match(reglas,/\|dosmil/);
 /* El tope de `puntos` en soloRanks tiene que dejar pasar lo que el
    verificador acepta: 4 000 000 puntos y la ficha 262 144. Con el tope
    general de 100 000 las partidas buenas se rechazaban al guardarse. */
 assert.match(reglas,/'club-dosmil-puntos' \? 4000000/);
 assert.match(reglas,/'club-dosmil-ficha' \|\| [^?]*\? 1000000 /);
});

test('el juego guarda ms enteros: un tiempo con decimales no entra en la clasificación',()=>{
 /* performance.now trae decimales; si la jugada los guardaba, res.ms salía
    con decimales y resultadoClub (Number.isSafeInteger) tiraba el récord
    sin avisar, en las dos tablas. */
 const js=fs.readFileSync(path.join(D,'juego.js'),'utf8');
 assert.match(js,/Math\.round\(ahora - ultimaA\)/);
 assert.match(js,/M\.decodifica\(M\.codifica\(jugadas\)\)/);
 const {resultadoClub}=carga('src/juegos/solo/club-datos.js');
 assert.equal(resultadoClub('dosmil',{categoria:CP,puntos:1200,tiempo:61234.7,partida:'abc'}),null);
 assert.ok(resultadoClub('dosmil',{categoria:CP,puntos:1200,tiempo:61235,partida:'abc'}));
});
