/* El buscador del salón: que ordene por parecido y no por el texto
   literal, que tolere tipeos y que la popularidad solo desempate. Carga
   `buscador.js` con las mismas entradas que pinta el salón. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sin=f=>fs.readFileSync(f,'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={crypto:require('node:crypto').webcrypto};vm.createContext(ctx);
vm.runInContext(sin('src/juegos/motor.js')+'\n;globalThis.__J=JUEGOS;',ctx);
vm.runInContext(sin('src/juegos/controles-datos.js'),ctx);
vm.runInContext(sin('src/juegos/salon-datos.js')+'\n;globalThis.__S={entradasSalon,SOLOS};',ctx);
vm.runInContext(sin('src/juegos/buscador.js')+'\n;globalThis.__B={normaliza,distancia,parecido,indiceBusqueda,buscaJuegos,APODOS};',ctx);
const S=ctx.__S,B=ctx.__B,J=ctx.__J;
const {solos,multi}=S.entradasSalon(J);
const todas=[...solos,...multi];
const idx=B.indiceBusqueda(todas);
const ids=(q,o)=>B.buscaJuegos(idx,q,o).map(r=>r.e.id);

test('normaliza tildes, mayúsculas y signos',()=>{
 assert.equal(B.normaliza('¡ÓRBITA!'),'orbita');
 assert.equal(B.normaliza('Pokémon · práctica'),'pokemon practica');
 assert.equal(B.normaliza('Niño'),'niño');
});

test('la distancia cuenta una transposición como un error',()=>{
 assert.equal(B.distancia('tetirs','tetris'),1);
 assert.equal(B.distancia('ajedres','ajedrez'),1);
 assert.ok(B.distancia('abcdef','uvwxyz',2)>2);
});

test('el nombre exacto va primero',()=>{
 for(const [q,id] of [['tetris','tetris'],['uno','uno'],['gato','gato'],['2048','dosmil'],['pro tiles','protiles'],['protiles','protiles'],['flip 7','flip7'],['Órbita','orbita']])
  assert.equal(ids(q)[0],id,q);
});

test('busca por apodo, género y de qué va, no solo por el nombre',()=>{
 assert.equal(ids('piano')[0],'protiles');
 assert.equal(ids('buscaminas')[0],'minas');
 assert.equal(ids('flappy bird')[0],'aleteo');
 assert.equal(ids('tres en raya')[0],'gato');
 assert.equal(ids('dragon ball')[0].replace('bots-',''),'bt3');
 assert.deepEqual(new Set(ids('zombis').map(x=>x.replace('bots-',''))),new Set(['yemas','boxhead']));
 const cartas=ids('cartas');
 for(const k of ['cartas','flip7','uno','presidente']) assert.ok(cartas.includes(k),'cartas sin '+k);
});

test('tolera tipeos y lo que se está escribiendo',()=>{
 assert.ok(ids('tetirs').includes('tetris'));
 assert.equal(ids('ajedres')[0],'ajedrez');
 assert.equal(ids('snkae')[0],'snake');
 assert.equal(ids('pokemno')[0],'pokemon');
 assert.equal(ids('metr')[0],'metrorush');
});

test('lo difuso no trae ruido de palabras cortas',()=>{
 /* «solo» no se parece a «colores» ni «tren» a «tres» */
 assert.ok(!ids('solo').includes('uno'));
 assert.ok(!ids('tren').includes('cartas'));
 assert.equal(ids('xqzw').length,0);
 assert.equal(ids('   ').length,0);
 assert.equal(ids('el de los').length,0,'solo palabras vacías: nada');
 assert.equal(ids('u')[0],'uno','una letra es el principio de un nombre');
});

test('las etiquetas salen de la entrada: modo, celular, duelo',()=>{
 const solo=ids('un jugador',{max:99});
 assert.ok(solo.length>5);
 for(const id of solo.slice(0,5)) assert.notEqual(todas.find(e=>e.id===id).modo,'multi',id);
 for(const id of ids('duelo',{max:99}).slice(0,4)) assert.equal(todas.find(e=>e.id===id).grupo,false,id);
 /* «celular» solo trae lo que de verdad se juega con el dedo */
 for(const r of B.buscaJuegos(idx,'celular',{max:99})) assert.ok(r.e.movil,r.e.id+' no va en el celular');
});

test('con dos palabras, el que tiene las dos va antes',()=>{
 const r=ids('cartas celular',{max:99});
 const movil=todas.filter(e=>e.movil&&['cartas','flip7','uno','presidente','spicy'].includes(e.id)).map(e=>e.id);
 if(movil.length) assert.ok(movil.includes(r[0]),'primero: '+r[0]);
});

test('la popularidad desempata pero no le gana al texto',()=>{
 const cartas=['flip7','uno','presidente'];
 const pop={presidente:500};
 const r=ids('cartas',{popular:e=>pop[e.id]||0});
 /* «Cartas de los tres elementos» lleva la palabra en el nombre: sigue primero */
 assert.equal(r[0],'cartas');
 assert.equal(r[1],'presidente');
 const r2=ids('cartas',{popular:e=>({uno:900})[e.id]||0});
 assert.equal(r2[1],'uno');
 assert.ok(cartas.every(k=>r.includes(k)));
 /* un juego popularísimo no se cuela en una búsqueda que no tiene que ver */
 assert.ok(!ids('piano',{popular:e=>e.id==='tetris'?1e6:0}).includes('tetris'));
});

test('cada juego se encuentra por su nombre y los apodos apuntan a juegos que existen',()=>{
 for(const e of todas) assert.ok(ids(e.nombre,{max:3}).includes(e.id),e.id+' no sale buscando «'+e.nombre+'»');
 const conocidos=new Set([...todas.map(e=>e.id),'mascotas','prodrop']);
 for(const k of Object.keys(B.APODOS)) assert.ok(conocidos.has(k),'apodo de un juego que no existe: '+k);
 for(const e of todas) if(e.modo!=='bots') assert.ok(B.APODOS[e.id],e.id+' sin apodos en APODOS');
});
