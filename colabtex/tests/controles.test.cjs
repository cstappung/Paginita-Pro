/* Las etiquetas «Celular» y «PC» del salón salen de leer el código de cada
   juego (scripts/build-controles.js). Aquí: que la regla hace lo que dice,
   que acierta con los juegos que se probaron a mano en un teléfono, y que
   la tabla generada está al día con el código. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const C=require('../scripts/build-controles.js');

test('la regla: toque, puntero o clic va en el celular; flechas solas o ratón de mira, no',()=>{
 const c=t=>C.clasifica(t);
 assert.equal(c('el.addEventListener("touchstart",f)').movil,true);
 assert.equal(c('lienzo.addEventListener("pointerdown",f)').movil,true);
 assert.equal(c('casilla.onclick=()=>juega(i)').movil,true,'un juego de tocar casillas');
 assert.equal(c('addEventListener("keydown",e=>{if(e.key==="ArrowLeft")izq()}); b.onclick=empezar').movil,false,'flechas y solo clics de menú');
 assert.equal(c('addEventListener("keydown",e=>{if(e.key==="ArrowLeft")izq()}); b.addEventListener("pointerdown",arrastra)').movil,true,'flechas, pero también se arrastra');
 assert.equal(c('addEventListener("keydown",e=>{if(e.key==="ArrowLeft")izq()}); boton.addEventListener("touchstart",izq)').movil,true,'flechas con botones táctiles (Tetris, Snake)');
 const fps=c('canvas.requestPointerLock(); addEventListener("keydown",f); addEventListener("mousedown",dispara)');
 assert.equal(fps.movil,false);assert.equal(fps.pide,'teclado y ratón');assert.equal(fps.pc,true);
 const tec=c('addEventListener("keydown",e=>{if(e.code==="KeyW")sube()})');
 assert.equal(tec.movil,false);assert.equal(tec.pide,'teclado');assert.equal(tec.pc,true);
 assert.equal(c('addEventListener("keydown",e=>{if(e.key==="Escape")cierra()}); b.onclick=f').movil,true,'Escape no es moverse');
});

test('@controles en el código del juego manda sobre la lectura',()=>{
 const t='// @controles: teclado\nt.on("pointerdown",eligeModo); addEventListener("keydown",f)';
 assert.deepEqual(C.clasifica(t),{movil:false,pc:true,pide:'teclado',por:'@controles: teclado'});
 assert.equal(C.clasifica('/* @controles: tactil teclado */ addEventListener("keydown",f)').movil,true);
 assert.equal(C.clasifica('/* @controles: teclado raton */').pide,'teclado y ratón');
});

/* Lo que se comprobó jugando en un teléfono emulado (táctil, 390 × 844) el
   5-10-2026: la lectura del código tiene que dar lo mismo. Un juego nuevo no
   necesita estar aquí; si se prueba y la lectura falla, se corrige con
   `@controles:` en su código y se añade a esta lista. */
const PROBADOS={
 movil:['orbita','escondite','cartas','cuadritos','worms','reversi','cadena','flip7','cacho','uno','catan','presidente','spicy','tetris','clue','ajedrez','pokemon',
  'minas','snake','tetrisclub','bbtan','sopa','electro','sudoku','fanal','atasco','frontera','bots-worms','bots-clue'],
 teclado:['boxhead','bots-boxhead','sortem'],
 tecladoYRaton:['yemas','bots-yemas']
};

test('acierta con los juegos que se probaron en un teléfono',()=>{
 const d=C.detecta();
 for(const id of PROBADOS.movil)assert.equal(d[id]&&d[id].movil,true,id+' se juega en el celular, pero la lectura dice que no ('+(d[id]&&d[id].por)+')');
 for(const id of PROBADOS.teclado)assert.deepEqual([d[id].movil,d[id].pide],[false,'teclado'],id+' ('+d[id].por+')');
 for(const id of PROBADOS.tecladoYRaton)assert.deepEqual([d[id].movil,d[id].pide],[false,'teclado y ratón'],id+' ('+d[id].por+')');
 for(const id in d)assert.equal(d[id].pc,true,id+' también se juega en el PC');
});

test('cada entrada del salón tiene código que leer, y nunca lo compartido',()=>{
 const d=C.detecta();
 for(const id in d){
  assert.ok(d[id].fuentes.length,id+': no se encontró su código');
  for(const f of d[id].fuentes)assert.ok(!/juegos\/audio\/|conexion\.js|i18n/.test(f),id+' lee '+f);
 }
 assert.deepEqual(d.worms.fuentes,['colabtex/src/juegos/worms.js','juegos/worms/'],'un juego de sala lee su módulo y el iframe que abre');
 assert.deepEqual(d.tetrisclub.fuentes,['juegos/club/tetris/']);
 assert.deepEqual(d.frontera.fuentes,['colabtex/src/juegos/frontera.js'],'un juego del club sin carpeta propia es un módulo');
});

test('controles-datos.js está al día con el código (si no: npm run build)',()=>{
 assert.equal(fs.readFileSync(C.SALIDA,'utf8'),C.texto(C.detecta()));
});
