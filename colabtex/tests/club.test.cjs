const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const mod={exports:{}};new Function('module','exports',esbuild.buildSync({entryPoints:['src/juegos/solo/club-datos.js'],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports);
const {categoriaClub,resultadoClub,mejorClub}=mod.exports;
test('Club: categorías nuevas separadas del archivo y Zen recreativo',()=>{
 for(const level of ['easy','medium','hard'])assert.ok(categoriaClub('minas','club-minas-'+level));
 for(const mode of ['classic','arcade','portals'])for(const speed of ['chill','normal','fast'])assert.ok(categoriaClub('snake',`club-snake-${mode}-${speed}`));
 for(const key of ['snake-clasico-media','club-snake-zen-normal','club-minas-easy','club-snake-arcade-hacked'])assert.equal(categoriaClub('snake',key),false);
});
test('Club: validación de resultados y desempate por tiempo',()=>{
 const a={categoria:'club-minas-easy',puntos:1,tiempo:34000,partida:'a'};assert.ok(resultadoClub('minas',a));
 for(const mod of [{puntos:2},{tiempo:NaN},{tiempo:0},{partida:'bad/key'},{categoria:'club-snake-classic-normal'}])assert.equal(resultadoClub('minas',{...a,...mod}),null);
 assert.ok(mejorClub(a,{...a,tiempo:50000}));assert.equal(mejorClub(a,{...a,tiempo:20000}),false);assert.equal(mejorClub(a,a),false);
 assert.ok(resultadoClub('snake',{...a,categoria:'club-snake-arcade-normal',puntos:150000}));
});
