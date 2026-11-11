/* Estrenos (src/juegos/estrenos.js): cuándo sale sola la ventana y que lo
   que anuncia existe (rutas, portadas, ficha). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sin=f=>fs.readFileSync(f,'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={};vm.createContext(ctx);
vm.runInContext(sin('src/juegos/estrenos.js')+'\n;globalThis.__E={ESTRENOS,VECES,debeAbrirEstrenos,trasVer,estrenosHtml};',ctx);
const E=ctx.__E,C=E.ESTRENOS,DIA=86400000;
const main=fs.readFileSync('src/juegos-main.js','utf8');

test('sale sola: una vez al día, pocas veces, hasta la fecha, y nunca tras «No mostrar más»',()=>{
 const t=C.hasta-10*DIA;
 assert.equal(E.debeAbrirEstrenos(t,null),true,'la primera vez');
 let v=E.trasVer(t,null);
 assert.equal(v.id,C.id);assert.equal(v.n,1);
 assert.equal(E.debeAbrirEstrenos(t+1000,v),false,'el mismo día no');
 assert.equal(E.debeAbrirEstrenos(t+DIA,v),true,'al día siguiente sí');
 for(let i=1;i<E.VECES;i++)v=E.trasVer(t+i*DIA,v);
 assert.equal(v.n,E.VECES);
 assert.equal(E.debeAbrirEstrenos(t+(E.VECES+1)*DIA,v),false,'ya salió todas sus veces');
 assert.equal(E.debeAbrirEstrenos(t+DIA,Object.assign(E.trasVer(t,null),{no:true})),false,'«No mostrar más»');
 assert.equal(E.debeAbrirEstrenos(C.hasta+1,null),false,'se acabó la campaña');
 assert.equal(E.debeAbrirEstrenos(t,{id:'otra',dia:'x',n:99,no:true}),true,'lo de otra campaña no cuenta');
 assert.ok(C.hasta>Date.UTC(2026,10,12),'la campaña no nació vencida');
});

test('dos mitades, cada una con su captura del juego y un botón de jugar que lleva a una ruta que existe',()=>{
 assert.equal(C.mitades.length,2);
 const h=E.estrenosHtml();
 const datos=fs.readFileSync('src/juegos/salon-datos.js','utf8');
 for(const m of C.mitades){
  const archivo='../'+m.foto.split('?')[0];
  assert.ok(fs.existsSync(archivo)&&fs.statSync(archivo).size<400e3,'captura de '+m.id+' (y liviana)');
  assert.ok(h.includes('src="'+m.foto+'"')&&h.includes('object-position:'+m.pos)&&h.includes('data-es-ruta="'+m.ruta+'"'));
  assert.ok(datos.includes('ruta: "'+m.ruta+'"'),'ruta del salón: '+m.ruta);
  assert.ok(m.boton&&m.titulo&&m.puntos.length===3);
 }
 assert.equal((h.match(/class="jg-es-jugar"/g)||[]).length,2);
 assert.match(h,/data-es-no/);assert.match(h,/aria-modal="true"/);
 const css=fs.readFileSync('../juegos.html','utf8');
 for(const m of C.mitades)assert.ok(css.includes('.jg-es-'+m.id+'{'),'colores de '+m.id);
});

test('enganche: se ofrece al entrar al salón, con cuenta y de invitado, y cede ante otras ventanas',()=>{
 assert.equal((main.match(/quizaAbreEstrenos\(\);/g)||[]).length,2);
 assert.match(main,/tiendaHalloweenAbierta\(Date\.now\(\)\) && !yaVistaHoy\(\)/,'primero la tienda, si está en temporada');
 assert.match(main,/abreEstrenos\(\{ ir, ficha: id => salon\.abre\(id\), suena \}\)/);
});
