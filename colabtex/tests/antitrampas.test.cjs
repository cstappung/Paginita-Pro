const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const carga=(entry,extra='')=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text+extra)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
test('Antitrampas: cada juego del club tiene su verificador con la forma acordada',()=>{
 for(const j of ['minas','snake','tetris','sortem','bbtan','sopa','sudoku','electro','fanal','atasco','frontera']){
  const v=V.VERIFICADORES[j];assert.ok(v,j);assert.equal(typeof v.verifica,'function',j);assert.equal(typeof v.sospecha,'function',j);assert.ok(Number.isSafeInteger(v.PRUEBA)&&v.PRUEBA>=0,j);
 }
 assert.equal(V.juegoDeCategoria('club-tetris-sprint'),'tetris');assert.equal(V.juegoDeCategoria('club-frontera-torre-50'),'frontera');
 assert.equal(V.juegoDeCategoria('yemas-zombis-kino'),null);assert.equal(V.juegoDeCategoria('club-inventado-x'),null);
});
test('Antitrampas: el registro rechaza lo que no se puede leer y nunca lanza',async()=>{
 const dato={categoria:'club-minas-easy',puntos:1,tiempo:5000,partida:'x'};
 const ciclo={};ciclo.a=ciclo;
 assert.match(await V.verificaClub('minas',dato,ciclo),/no se puede leer/);
 assert.match(await V.verificaClub('minas',dato,{d:'x'.repeat(V.PRUEBA_MAX+1)}),/demasiado grande/);
 assert.equal(await V.verificaClub('inventado',dato,null),null);
 /* Con PRUEBA > 0 la prueba es obligatoria, y un verificador que lanza
    rechaza en vez de dejar pasar. */
 for(const [j,v] of Object.entries(V.VERIFICADORES)){
  if(v.PRUEBA>0)assert.match(await V.verificaClub(j,{...dato,categoria:'club-'+j+'-x'},null),/sin prueba/,j);
 }
});
const C=carga('src/juegos/solo/club-datos.js');
test('Antitrampas: la racha contada sube de a uno por día y arranca de la tabla',()=>{
 assert.ok(C.esRachaClub('club-sopa-racha'));assert.ok(C.esRachaClub('club-electro-racha'));assert.equal(C.esRachaClub('club-sopa-facil-8'),false);
 assert.deepEqual(C.rachaClub(null,100,0),{dia:100,n:1});
 assert.deepEqual(C.rachaClub(null,100,40),{dia:100,n:41},'quien ya traía 40 sigue');
 assert.equal(C.rachaClub({dia:100,n:5},100,0),null,'dos veces el mismo día no suma');
 assert.equal(C.rachaClub({dia:100,n:5},99,0),null,'ni hacia atrás');
 assert.deepEqual(C.rachaClub({dia:100,n:5},101,0),{dia:101,n:6});
 assert.deepEqual(C.rachaClub({dia:100,n:5},103,0),{dia:103,n:1},'un día saltado la corta');
});
