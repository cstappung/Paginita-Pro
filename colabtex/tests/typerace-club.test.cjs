/* Type Race en el Solo Club (juegos/typerace/ + solo/verifica/typerace.js): solo clasifican las
   palabras al azar en inglés con un largo fijo, el texto lleva la cuenta en la semilla, la carrera se
   rehace desde su registro y el verificador rechaza cada vía de trampa. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path'),fs=require('node:fs');
const carga=(entry)=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const VT=carga('src/juegos/solo/verifica/typerace.js');
const M=require(path.join(__dirname,'../../juegos/typerace/motor.js'));
const cat=n=>'club-typerace-en-'+n;

/* Una mano que teclea la carrera letra por letra: cada letra tarda `base`…`base+rango` ms, el espacio
   va en el mismo evento que la letra siguiente no (el campo dice «palabra »). `malas`: cada n-ésima
   palabra lleva cuatro letras de más (queda mal y se cierra con el espacio). */
function corre(semilla,uid,largo,{base=110,rango=70,malas=0}={}){
 const pal=M.textoClasif(semilla,uid,largo),ev=[];let a=semilla*7+3;
 const azar=()=>{a=(a*1103515245+12345)>>>0;return a/4294967296;};
 const pon=(tipo,valor)=>ev.push([tipo,valor,ev.length?Math.round(base+azar()*rango):0]);
 pal.forEach((w,i)=>{
  const mal=malas&&i%malas===malas-1;
  for(let k=1;k<=w.length;k++)pon(0,w.slice(0,k));
  if(mal)for(let k=1;k<=4;k++)pon(0,w+'z'.repeat(k));
  if(i<pal.length-1)pon(0,(mal?w+'zzzz':w)+' ');
 });
 const res=M.rehace(semilla,uid,largo,ev);
 const c=res.c;
 return {ev,c,dato:c&&{categoria:cat(largo),puntos:c.ppm,tiempo:c.ms},prueba:{v:1,u:uid,s:semilla,e:ev,a:c?c.ms+40:0,w:c?c.ms+90:0}};
}
const verifica=(r,ctx={uid:r.prueba.u})=>VT.verifica(r.dato,r.prueba,ctx);

test('solo clasifican las palabras al azar en inglés con largo fijo',()=>{
 for(const n of [10,25,50,100,200])assert.equal(M.categoria({idioma:'en',texto:'palabras',largo:n}),cat(n));
 assert.equal(M.categoria({idioma:'es',texto:'palabras',largo:50}),null);
 assert.equal(M.categoria({idioma:'en',texto:'frases',largo:50}),null);
 assert.equal(M.categoria({idioma:'en',texto:'cuentos',largo:50}),null);
 assert.equal(M.categoria({idioma:'en',texto:'palabras',largo:0}),null,'el libre no clasifica');
 assert.equal(M.categoria({idioma:'en',texto:'palabras',largo:73}),cat(50),'un largo raro se recorta al estándar de 50');
});

test('el texto lleva la cuenta: otra cuenta o otra semilla reparten otras palabras',()=>{
 const t=(s,u)=>M.textoClasif(s,u,25).join(' ');
 assert.equal(t(5,'ana'),t(5,'ana'));
 assert.notEqual(t(5,'ana'),t(5,'beto'));
 assert.notEqual(t(5,'ana'),t(6,'ana'));
 assert.equal(M.textoClasif(5,'ana',50).length,50);
 assert.deepEqual(M.textoClasif(5,'ana',50).slice(0,25),M.textoClasif(5,'ana',25),'el prefijo no cambia con el largo');
});

test('una carrera de mano se rehace y el verificador la acepta en las cinco tablas',()=>{
 for(const n of [10,25,50,100,200]){
  const r=corre(1234+n,'ana',n);
  assert.ok(r.c,'llega a la meta: '+n);
  assert.ok(r.c.ppm>=40&&r.c.ppm<=140,'ppm creíbles: '+r.c.ppm);
  assert.equal(verifica(r),null,'tabla '+n);
 }
});

test('el verificador del sitio la acepta y las pruebas viejas, sin prueba o de otra tabla, no',async()=>{
 const r=corre(77,'ana',50);
 assert.equal(await V.verificaClub('typerace',r.dato,r.prueba,{uid:'ana'}),null);
 assert.match(await V.verificaClub('typerace',r.dato,null,{uid:'ana'})||'',/sin prueba|prueba/);
 assert.match(await V.verificaClub('typerace',{...r.dato,categoria:'club-typerace-en-30'},r.prueba,{uid:'ana'})||'',/no tiene esa tabla/);
 assert.match(await V.verificaClub('typerace',{...r.dato,categoria:'club-typerace-es-50'},r.prueba,{uid:'ana'})||'',/no tiene esa tabla/);
 assert.equal(V.juegoDeCategoria(cat(50)),'typerace');
});

test('rechaza los números inventados',()=>{
 const r=corre(9,'ana',25);
 assert.match(VT.verifica({...r.dato,puntos:r.dato.puntos+1},r.prueba,{uid:'ana'})||'',/ppm/);
 assert.match(VT.verifica({...r.dato,tiempo:r.dato.tiempo-1},r.prueba,{uid:'ana'})||'',/tiempo/);
 assert.match(VT.verifica({...r.dato,puntos:900},r.prueba,{uid:'ana'})||'',/ppm no son válidas/);
});

test('rechaza una prueba copiada de otra cuenta o con otra semilla',()=>{
 const r=corre(9,'ana',25);
 assert.match(VT.verifica(r.dato,r.prueba,{uid:'beto'})||'',/otra cuenta/);
 // la misma prueba con el nombre cambiado: el texto de Beto es otro, la carrera no se rehace
 const falsa={...r.prueba,u:'beto'};
 assert.ok(VT.verifica(r.dato,falsa,{uid:'beto'}),'copiar la prueba de otra persona no sirve');
 assert.ok(VT.verifica(r.dato,{...r.prueba,s:10},{uid:'ana'}));
});

test('rechaza lo que no se rehace: sin meta, pulsaciones de más, un borrar que no corresponde',()=>{
 const r=corre(3,'ana',25);
 const corta={...r.prueba,e:r.ev.slice(0,r.ev.length-3)};
 assert.match(VT.verifica(r.dato,corta,{uid:'ana'})||'',/meta/);
 const larga={...r.prueba,e:[...r.ev,[0,'x',100]]};
 assert.match(VT.verifica(r.dato,larga,{uid:'ana'})||'',/Sobran/);
 const borra={...r.prueba,e:[r.ev[0],[1,'',100],...r.ev.slice(1)]};
 assert.match(VT.verifica(r.dato,borra,{uid:'ana'})||'',/borrar/);
 assert.match(VT.verifica(r.dato,{...r.prueba,e:[]},{uid:'ana'})||'',/entradas/);
 assert.match(VT.verifica(r.dato,{...r.prueba,v:2},{uid:'ana'})||'',/otra versión/);
 assert.match(VT.verifica(r.dato,{...r.prueba,e:r.ev.map((e,i)=>i?e:[e[0],e[1],5])},{uid:'ana'})||'',/primera entrada/);
});

test('rechaza las pulsaciones sintéticas y los relojes alterados',()=>{
 const r=corre(21,'ana',25);
 const falsa={...r.prueba,e:r.ev.map((e,i)=>i===4?[...e,'x']:e)};
 assert.match(VT.verifica(r.dato,falsa,{uid:'ana'})||'',/sintéticos/);
 const lenta={...r.prueba,a:60000,w:30000};
 assert.match(VT.verifica(r.dato,lenta,{uid:'ana'})||'',/velocidad del juego/);
 // el reloj del juego marca menos tiempo del que dicen las pulsaciones
 assert.match(VT.verifica(r.dato,{...r.prueba,a:Math.round(r.c.ms/2),w:Math.round(r.c.ms/2)},{uid:'ana'})||'',/más tiempo/);
});

test('rechaza a la máquina: demasiado rápido para una mano',()=>{
 // 4 ms por pulsación: más de 600 ppm
 const r=corre(31,'ana',50,{base:4,rango:1});
 assert.ok(verifica(r),'una carrera de 4 ms por letra no es de una mano');
 // ráfaga larga a ritmo imposible dentro de una carrera que, en el resto, va a ritmo de persona
 const h=corre(32,'ana',100);
 const e=h.ev.map((x,i)=>i>0&&i<=40?[x[0],x[1],6]:x);
 const res=M.rehace(32,'ana',100,e);
 const p={v:1,u:'ana',s:32,e,a:res.c.ms+40,w:res.c.ms+90};
 assert.match(VT.verifica({categoria:cat(100),puntos:res.c.ppm,tiempo:res.c.ms},p,{uid:'ana'})||'',/seguidas|ppm/);
});

test('con poca precisión no clasifica',()=>{
 const r=corre(41,'ana',25,{malas:2});
 assert.ok(r.c.prec<75,'precisión '+r.c.prec);
 assert.match(verifica(r)||'',/precisión/);
 const buena=corre(41,'ana',25,{malas:12});
 assert.ok(buena.c.prec>=75);
 assert.equal(verifica(buena),null);
});

test('volver a una palabra mal escrita con borrar se rehace igual que en vivo',()=>{
 const s=M.crear(['aa','bb','cc'],false);
 M.entrada(s,'ax ',1000);M.entrada(s,'bb ',1100);
 assert.equal(s.i,2);
 // en el registro: «ax » (mal), «bb »; el borrar solo vale con el campo vacío
 const pal=M.textoClasif(5,'ana',10);
 const ev=[];let t=0;
 const pon=(tipo,v,dt)=>{ev.push([tipo,v,t?dt:0]);t+=dt||1;};
 pon(0,pal[0]+'z ',100);pon(1,'',120);          // se pasó, vuelve a la palabra
 for(let k=0;k<=pal[0].length;k++)pon(0,(pal[0]+'z').slice(0,pal[0].length+1-k),120); // la borra de a una
 const res=M.rehace(5,'ana',10,ev);
 assert.ok(!res.error,res.error);
 assert.equal(res.s.i,0,'volvió a escribir la primera palabra');
});

test('sospecha: una fila con más ppm de las posibles',()=>{
 assert.equal(VT.sospecha(cat(50),{puntos:120}),null);
 assert.match(VT.sospecha(cat(50),{puntos:400})||'',/ppm/);
 assert.equal(VT.sospecha('club-trigon-puntos',{puntos:400}),null);
 assert.equal(V.sospechaFila(cat(50),{puntos:120}),null);
 assert.match(V.sospechaFila(cat(50),{puntos:400})||'',/ppm/);
});

test('resultadoClub: tablas, tope de ppm y ms enteros',()=>{
 const {resultadoClub,categoriaClub}=carga('src/juegos/solo/club-datos.js');
 for(const n of [10,25,50,100,200])assert.ok(categoriaClub('typerace',cat(n)));
 assert.ok(!categoriaClub('typerace','club-typerace-en-30'));
 assert.ok(!categoriaClub('typerace','club-typerace-es-50'));
 assert.ok(!categoriaClub('trigon',cat(50)));
 assert.equal(resultadoClub('typerace',{categoria:cat(50),puntos:331,tiempo:5000,partida:'abc'}),null);
 assert.ok(resultadoClub('typerace',{categoria:cat(50),puntos:120,tiempo:5000,partida:'abc'}));
});

test('el juego, las reglas de Firebase y las listas del sitio hablan de lo mismo',()=>{
 const D=path.join(__dirname,'../../juegos');
 const js=fs.readFileSync(path.join(D,'typerace/juego.js'),'utf8');
 assert.match(js,/Club\.result\(/);
 assert.match(js,/M\.rehace\(/);
 assert.match(js,/Math\.round\(performance\.now\(\)\)/,'los ms enteros, que son los que se rehacen');
 const html=fs.readFileSync(path.join(D,'club/typerace/index.html'),'utf8');
 assert.match(html,/conexion\.js\?v=club-\d+/);
 assert.match(html,/class="tr-hoja shell"/);
 assert.match(html,/\.\.\/\.\.\/typerace\/juego\.js\?v=typerace-\d+/);
 const reglas=fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8');
 assert.equal((reglas.match(/club-typerace-en-\(10\|25\|50\|100\|200\)/g)||[]).length,2,'soloRanks y soloPruebas');
 assert.match(reglas,/\|protiles\|typeraceclub\|/,'clubJugadas');
 const salon=fs.readFileSync(path.join(__dirname,'../src/juegos/salon-datos.js'),'utf8');
 assert.match(salon,/id: "typeraceclub", tipo: "club"/);
 assert.doesNotMatch(salon,/bots-typerace/);
 const {LOGROS,SOLO_PREFIJO}=carga('src/juegos/logros.js');
 assert.equal(LOGROS.typeraceclub.length,10);
 assert.equal(SOLO_PREFIJO.typeraceclub,'club-typerace-');
 const logro=LOGROS.typeraceclub.filter(l=>l.s({categoria:cat(25),puntos:100,tiempo:1}));
 assert.deepEqual(logro.map(l=>l.id),['p30','p45','p60','p80','p100']);
 assert.equal(LOGROS.typeraceclub.filter(l=>l.s({categoria:'club-trigon-puntos',puntos:999,tiempo:1})).length,0);
});
