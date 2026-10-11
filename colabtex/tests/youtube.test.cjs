/* El reproductor de YouTube del ♪: leer enlaces pegados y limpiar lo que
   devuelve la Data API (src/juegos/youtube-datos.js). */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const carga=f=>{const code=esbuild.buildSync({entryPoints:[f],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text;const mod={exports:{}};new Function('module','exports','require',code)(mod,mod.exports,require);return mod.exports;};
const Y=carga('src/juegos/youtube-datos.js');
const V='dQw4w9WgXcQ',L='PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG';

test('enlaces de video, lista y YouTube Music',()=>{
  assert.deepEqual(Y.analizaEnlace('https://www.youtube.com/watch?v='+V),{video:V,lista:''});
  assert.deepEqual(Y.analizaEnlace('youtu.be/'+V+'?si=abc'),{video:V,lista:''});
  assert.deepEqual(Y.analizaEnlace('https://youtube.com/shorts/'+V),{video:V,lista:''});
  assert.deepEqual(Y.analizaEnlace('https://m.youtube.com/watch?v='+V+'&list='+L+'&index=3'),{video:V,lista:L});
  assert.deepEqual(Y.analizaEnlace('https://music.youtube.com/playlist?list='+L),{video:'',lista:L});
  assert.deepEqual(Y.analizaEnlace('https://music.youtube.com/watch?v='+V+'&list=RDAMVM'+V),{video:V,lista:'RDAMVM'+V});
  assert.deepEqual(Y.analizaEnlace('https://www.youtube.com/browse/x?list=VL'+L),{video:'',lista:L});
  assert.deepEqual(Y.analizaEnlace('  '+V+' '),{video:V,lista:''});
  assert.deepEqual(Y.analizaEnlace(L),{video:'',lista:L});
});

test('lo que no es YouTube no se toca',()=>{
  for(const t of['','hola','https://vimeo.com/123','https://evil.com/watch?v='+V,'https://youtube.com.evil.com/watch?v='+V,'https://www.youtube.com/watch?v=corto','javascript:alert(1)'])
    assert.equal(Y.analizaEnlace(t),null,t);
});

test('items: fuera los privados y borrados',()=>{
  const it=(id,title,priv)=>({snippet:{title,resourceId:{videoId:id}},contentDetails:{videoId:id},status:{privacyStatus:priv||'public'}});
  assert.deepEqual(Y.idsDeItems([it(V,'Bien'),it('aaaaaaaaaaa','Private video','private'),it('bbbbbbbbbbb','Deleted video'),it('mal','x'),null]),[V]);
});

test('resumen de una playlist',()=>{
  assert.deepEqual(Y.resumeLista({id:L,snippet:{title:'Para jugar',thumbnails:{default:{url:'https://i.ytimg.com/x.jpg'}}},contentDetails:{itemCount:12}}),{id:L,titulo:'Para jugar',n:12,mini:'https://i.ytimg.com/x.jpg'});
  assert.equal(Y.resumeLista({id:L,snippet:{thumbnails:{default:{url:'http://x'}}}}).mini,'');
});
