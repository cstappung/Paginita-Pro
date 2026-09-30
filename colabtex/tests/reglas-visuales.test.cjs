const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),esbuild=require('esbuild');
const path=require('node:path'),root=path.resolve(__dirname,'..');
function modulo(nombre,extra={}){
 const code=esbuild.buildSync({entryPoints:[path.join(root,'src/juegos',nombre)],bundle:true,format:'cjs',write:false}).outputFiles[0].text;
 const m={exports:{}};vm.runInNewContext(code,{module:m,exports:m.exports,...extra});return m.exports;
}
const {EJEMPLOS,VARIANTES,ejemplosPara}=modulo('reglas-ejemplos.js');
const fuente=fs.readFileSync(path.join(root,'src/juegos/reglas.js'),'utf8');
const reglas=vm.runInNewContext(fuente.slice(fuente.indexOf('const esc ='),fuente.indexOf('const NOMBRES_SOLO'))+';REGLAS');
test('Cada manual y variante tiene ejemplos ilustrados y textos equivalentes',()=>{
 assert.deepEqual(Object.keys(EJEMPLOS).sort(),Object.keys(reglas).sort());
 for(const [juego,r] of Object.entries(reglas)){
  for(const modo of Object.keys(r.modos||{base:{}})){
   const ejemplos=ejemplosPara(juego,modo);assert.ok(ejemplos.length,juego+modo);
   assert.equal(new Set(ejemplos.map(e=>e.id)).size,ejemplos.length,'IDs sin duplicados');
   for(const e of ejemplos){assert.ok(e.titulo.length>8);assert.ok(e.pasos.length>=2);
    for(const p of e.pasos){assert.ok(p.texto.length>40);assert.ok(p.titulo);assert.match(p.imagen,/<svg[^>]+role="img"[^>]+aria-label=/);assert.match(p.imagen,/<title>.+<\/title>/);assert.doesNotMatch(p.imagen,/<script|<image|foreignObject|undefined|NaN|href=/i);}
   }
  }
 }
});
test('All Wild omite coincidencias; Super hereda Vengeance; Órbita usa gravedad',()=>{
 assert.ok(!ejemplosPara('uno','allwild').some(e=>e.id==='coincidir'));
 assert.ok(ejemplosPara('flip7','super').some(e=>e.id==='cero'));
 assert.ok(ejemplosPara('flip7','super').some(e=>e.id==='catorce'));
 assert.ok(ejemplosPara('cacho','0').length>0);
 assert.ok(ejemplosPara('cacho','1').some(e=>e.id==='siciliana'));
 assert.match(EJEMPLOS.orbita[0].pasos[0].texto,/gravedad/);
 assert.equal(ejemplosPara('no-existe').length,0);
});
function entorno(reducido=false){
 const nodos=new Map(),eventos=new Map(),timers=new Map();let serial=0;
 const host={innerHTML:'',querySelector(s){if(!nodos.has(s))nodos.set(s,{disabled:false,textContent:'',innerHTML:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;}});return nodos.get(s);}};
 const doc={hidden:false,addEventListener(k,f){eventos.set(k,f);},removeEventListener(k){eventos.delete(k);}};
 const media={matches:reducido,addEventListener(k,f){this.listener=f;},removeEventListener(){this.listener=null;}};
 const {montarGuia}=modulo('reglas-guia.js',{document:doc,matchMedia:()=>media,setTimeout(fn){timers.set(++serial,fn);return serial;},clearTimeout(id){timers.delete(id);}});
 const guia=montarGuia(host,'cacho','1');
 return {host,doc,media,guia,eventos,timers,q:s=>host.querySelector(s),tick(){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();},click(n){host.querySelector(`[data-guia="${n}"]`).onclick();}};
}
test('Pasos, pausa, cambio de ejemplo y cerrar cancelan la reproducción',()=>{
 const x=entorno();assert.equal(x.timers.size,0);assert.match(x.q('.jg-guia-paso').textContent,/PASO 1/);
 x.click('siguiente');assert.match(x.q('.jg-guia-paso').textContent,/PASO 2/);
 x.click('anterior');x.click('play');assert.equal(x.timers.size,1);
 x.click('play');assert.equal(x.timers.size,0);
 x.click('play');x.q('select').onchange({target:{value:'2'}});assert.equal(x.timers.size,0);assert.match(x.q('.jg-guia-paso').textContent,/PASO 1/);
 x.click('play');x.doc.hidden=true;x.eventos.get('visibilitychange')();assert.equal(x.timers.size,0);
 x.doc.hidden=false;x.click('play');x.guia.destruir();assert.equal(x.timers.size,0);assert.equal(x.eventos.size,0);assert.equal(x.host.innerHTML,'');assert.equal(x.media.listener,null);
});
test('La secuencia termina; se puede repetir; movimiento reducido no inicia relojes',()=>{
 const x=entorno();x.click('play');x.tick();assert.equal(x.timers.size,0);assert.equal(x.q('[data-guia="siguiente"]').disabled,true);
 x.click('play');assert.match(x.q('.jg-guia-paso').textContent,/PASO 1/);assert.equal(x.timers.size,1);
 x.media.matches=true;x.media.listener();assert.equal(x.timers.size,0);
 x.click('play');assert.match(x.q('.jg-guia-paso').textContent,/PASO 2/);assert.equal(x.timers.size,0);
 x.click('play');assert.match(x.q('.jg-guia-paso').textContent,/PASO 1/);assert.equal(x.timers.size,0);x.guia.destruir();
});
