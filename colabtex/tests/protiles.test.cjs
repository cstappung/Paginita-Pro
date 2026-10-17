/* PRO TILES (juegos/club/protiles/): el motor es repetible, la partida se
   rehace igual, y el verificador acepta la partida de un bot que toca con
   mano de persona y rechaza cada vía de trampa. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path'),fs=require('node:fs');
const carga=(entry)=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const VP=carga('src/juegos/solo/verifica/protiles.js');
const D=path.join(__dirname,'../../juegos/club/protiles');
const M=require(path.join(D,'motor.js'));

/* Un bot que toca cada ficha cuando le faltan entre `lo` y `hi` filas para
   el borde (al azar), suelta las largas a veces antes de tiempo, y deja
   escaparse la ficha número `notas`. */
function juega(modo,semilla,u,{notas=300,lo=.4,hi=2.6,igual=false}={}){
 const E=M.nueva(modo,semilla,u),acciones=[];let a=semilla*7+3;
 const azar=()=>{a=(a*1103515245+12345)>>>0;return a/4294967296;};
 let falta=null,suelta=null;
 const golpe=()=>{const t=E.tiles[E.next];const dc=t.hold?Math.round(t.len*100*(.5+azar()*.5)):null;
  acciones.push(dc==null?{t:E.t,l:t.lane}:{t:E.t,l:t.lane,dc});M.golpe(E,dc);if(t.hold)suelta=E.t+Math.round(azar()*600);falta=null;};
 golpe();
 while(!E.over&&E.t<5e6){
  if(E.hits<notas){
   const t=E.tiles[E.next];
   if(falta==null)falta=igual?1:lo+azar()*(hi-lo);
   if(E.pos>=t.s-falta){golpe();continue;}
  }
  if(E.hold&&suelta!=null&&E.t>=suelta){acciones.push({t:E.t,r:true});M.suelta(E);suelta=null;}
  M.paso(E);
 }
 const ms=E.t*M.TICK_MS;
 return {E,dato:{categoria:'club-protiles-'+modo,puntos:E.score,tiempo:Math.max(1,ms)},
  p:{v:1,m:modo,s:semilla,u,g:M.codifica(acciones),n:E.t,a:ms+500,w:ms+700}};
}

test('el motor es repetible y cada canción tiene sus fichas',()=>{
 for(const m of M.MODOS){
  const a=M.nueva(m,99,'ana'),b=M.nueva(m,99,'ana'),c=M.nueva(m,99,'beto');
  assert.deepEqual(a.tiles.map(t=>[t.s,t.len,t.lane]),b.tiles.map(t=>[t.s,t.len,t.lane]));
  assert.notDeepEqual(a.tiles.map(t=>t.lane),c.tiles.map(t=>t.lane),'la cuenta cambia los carriles');
  assert.deepEqual(a.tiles.map(t=>[t.s,t.len]),c.tiles.map(t=>[t.s,t.len]),'la melodía es la misma para todos');
  for(let i=1;i<a.tiles.length;i++)assert.notEqual(a.tiles[i].lane,a.tiles[i-1].lane);
 }
 for(const x of [0,.1,.25,1,3,10,50,200])assert.ok(Math.abs(M.expNeg(x)-Math.exp(-x))<=1e-12*Math.max(1,Math.exp(-x))+1e-300,x);
});

test('la partida se rehace igual y el verificador la acepta',async()=>{
 for(const m of ['cristal','despegue','mezcla']){
  const {E,dato,p}=juega(m,1234,'ana',{notas:m==='mezcla'?900:250});
  assert.ok(E.over&&E.por==='escape');
  assert.ok(E.score>E.hits,'las largas dan bono');
  const r=M.rehace(m,p.s,p.u,M.decodifica(p.g),p.n);
  assert.equal(r.error,undefined);assert.equal(r.puntos,E.score);
  assert.equal(await V.verificaClub('protiles',dato,p,{uid:'ana'}),null);
 }
 // En la mezcla se pasa a la segunda canción.
 const {E}=juega('mezcla',5,'ana',{notas:900});
 assert.ok(new Set(E.tiles.slice(0,E.next).map(t=>t.S.id)).size>=2);
});

test('rechaza cada trampa',async()=>{
 const {dato,p}=juega('verano',777,'ana');
 const mal=async(d,q,re)=>{const m=await V.verificaClub('protiles',d,q,{uid:'ana'});assert.notEqual(m,null);if(re)assert.match(m,re);};
 await mal({...dato,puntos:dato.puntos+1},p,/suma/);
 await mal({...dato,categoria:'club-protiles-calle'},p);
 await mal({...dato,categoria:'club-protiles-nada'},p);
 await mal(dato,{...p,u:'beto'});
 await mal(dato,{...p,s:p.s+1},/carril/);
 await mal(dato,{...p,u:'ana',s:p.s^7},/carril/);
 await mal({...dato,tiempo:dato.tiempo+4},p);
 await mal(dato,{...p,x:1},/sintéticos/);
 await mal(dato,{...p,w:p.a*2},/velocidad del juego/);
 await mal(dato,{...p,a:1000,w:1000},/reloj/);
 await mal(dato,{...p,g:'zz!'});
 // Una nota tocada antes de que su ficha asome.
 const ac=M.decodifica(p.g);ac[5]={...ac[5],t:ac[4].t};
 await mal(dato,{...p,g:M.codifica(ac)});
 // Declarar que la partida siguió viva más allá de cuando se escapó la ficha.
 await mal({...dato,tiempo:(p.n+50)*M.TICK_MS},{...p,n:p.n+50},/termina/);
 await mal(dato,undefined);
 // Una prueba copiada de otra cuenta no vale.
 const b=juega('verano',777,'beto');
 await mal({...b.dato},b.p);
});

test('la mano: un programa toca siempre a la misma altura',async()=>{
 const {dato,p}=juega('neon',4242,'ana',{igual:true});
 assert.match(await V.verificaClub('protiles',dato,p,{uid:'ana'}),/programa/);
});

test('sospecha de lo imposible',()=>{
 assert.equal(VP.sospecha('club-protiles-cristal',{puntos:5000,tiempo:600000}),null);
 assert.notEqual(VP.sospecha('club-protiles-mezcla',{puntos:2000000,tiempo:1e9}),null);
 assert.equal(VP.sospecha('club-otro-puntos',{puntos:5}),null);
});

test('resultadoClub: las nueve tablas, el tope y ms enteros',()=>{
 const {resultadoClub,categoriaClub}=carga('src/juegos/solo/club-datos.js');
 for(const m of M.MODOS)assert.ok(categoriaClub('protiles','club-protiles-'+m),m);
 assert.equal(M.MODOS.length,9);
 assert.ok(!categoriaClub('protiles','club-protiles-puntos'));
 assert.ok(resultadoClub('protiles',{categoria:'club-protiles-calle',puntos:1200,tiempo:61236,partida:'abc'}));
 assert.equal(resultadoClub('protiles',{categoria:'club-protiles-calle',puntos:1200,tiempo:61234.7,partida:'abc'}),null);
 assert.equal(resultadoClub('protiles',{categoria:'club-protiles-calle',puntos:1000001,tiempo:5000,partida:'abc'}),null);
});

test('las versiones, el juego y las reglas',()=>{
 const html=fs.readFileSync(path.join(D,'index.html'),'utf8');
 assert.match(html,/motor\.js\?v=protiles-\d+/);assert.match(html,/juego\.js\?v=protiles-\d+/);assert.match(html,/estilo\.css\?v=protiles-\d+/);
 assert.match(html,/Salamander Grand Piano/,'el crédito del piano (CC BY 3.0) es obligatorio');
 assert.doesNotMatch(html,/<footer/,'conexion.css oculta los footer dentro de Juegos: el crédito no se vería');
 const js=fs.readFileSync(path.join(D,'juego.js'),'utf8');
 assert.match(js,/Club\.result\(/);
 assert.doesNotMatch(fs.readFileSync(path.join(D,'motor.js'),'utf8'),/Math\.(random|exp|pow|sin|cos)\(/);
 const reglas=fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8');
 assert.equal((reglas.match(/club-protiles-\(cristal\|medianoche\|calle\|verano\|neon\|latido\|estrellas\|despegue\|mezcla\)/g)||[]).length,3,'soloRanks, su tope y soloPruebas');
 assert.match(reglas,/\|trigon\|protiles\|/,'clubJugadas');
});
