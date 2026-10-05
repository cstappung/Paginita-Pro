/* Vía Libre: su registro en el Solo Club, sin abrir un navegador. El motor
   del juego (juegos/club/vialibre/motor.js) lo prueba vialibre-motor.test.cjs;
   aquí se comprueba lo que lo conecta con el resto de Juegos: que las dos
   categorías pasen por club-datos.js con sus topes, que las reglas de
   Firebase las acepten (soloRanks y clubJugadas), que Discord las diga bien,
   que el perfil, el salón y el manual las conozcan, y que la página del juego
   cargue sus piezas con versión. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const D=path.join(__dirname,'../../juegos/club/vialibre');
// Lee un módulo de src/ sin sus import/export, para correrlo en un contexto vm.
const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const carga=(archivos,exp,extra={})=>{const c=Object.assign({crypto:require('node:crypto').webcrypto,TextEncoder},extra);vm.createContext(c);vm.runInContext(archivos.map(sin).join('\n')+';globalThis.__X={'+exp+'};',c);return c.__X;};
const reglas=JSON.parse(fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8')).rules;

test('las dos categorías pasan por el club, con sus topes',()=>{
 const C=carga(['src/juegos/solo/club-datos.js'],'categoriaClub,resultadoClub');
 assert.ok(C.categoriaClub('vialibre','club-vialibre-carrera'));
 assert.ok(C.categoriaClub('vialibre','club-vialibre-distancia'));
 assert.ok(!C.categoriaClub('vialibre','club-vialibre-otra'));
 assert.ok(!C.categoriaClub('vialibre','club-fanal-travesia'));
 assert.ok(!C.categoriaClub('fanal','club-vialibre-carrera'),'otro juego no puede mandar las de Vía Libre');
 const r=(categoria,puntos)=>C.resultadoClub('vialibre',{categoria,puntos,tiempo:65000,partida:'abc-1'});
 // La carrera pasa del millón sin esfuerzo: su tope es el de la regla, mil millones.
 assert.ok(r('club-vialibre-carrera',3250000));assert.ok(r('club-vialibre-carrera',1000000000));
 assert.equal(r('club-vialibre-carrera',1000000001),null);
 // La distancia son metros, hasta 1 000 000.
 assert.ok(r('club-vialibre-distancia',4200));assert.ok(r('club-vialibre-distancia',1000000));
 assert.equal(r('club-vialibre-distancia',1000001),null);
 // Puntos enteros y mayores que cero.
 assert.equal(r('club-vialibre-carrera',0),null);assert.equal(r('club-vialibre-distancia',12.5),null);
});

test('las reglas de Firebase aceptan las tablas, sus topes y el juego del club',()=>{
 const v=reglas.soloRanks.$categoria.$uid;
 const re=new RegExp(v['.validate'].match(/matches\(\/(.+?)\/\)/)[1]);
 for(const c of ['club-vialibre-carrera','club-vialibre-distancia'])assert.ok(re.test(c),c);
 assert.ok(!re.test('club-vialibre-otra'));
 /* El tope de puntos, evaluando la regla misma: se traduce a JavaScript
    (beginsWith → startsWith, matches → match) y se prueba en el borde. */
 const regla=v.puntos['.validate'];
 const cabe=(cat,n)=>Function('return '+regla.replace(/newData\.isNumber\(\)/g,'true').replace(/newData\.val\(\)/g,String(n))
  .replace(/\$categoria/g,JSON.stringify(cat)).replace(/\.beginsWith\(/g,'.startsWith(').replace(/\.matches\(/g,'.match('))();
 assert.ok(cabe('club-vialibre-carrera',1000000000));assert.ok(!cabe('club-vialibre-carrera',1000000001));
 assert.ok(cabe('club-vialibre-distancia',1000000));assert.ok(!cabe('club-vialibre-distancia',1000001));
 assert.ok(!cabe('club-vialibre-carrera',0));assert.ok(!cabe('club-vialibre-distancia',1.5));
 // Las demás tablas siguen donde estaban.
 assert.ok(cabe('club-fanal-travesia',1000000));assert.ok(!cabe('club-fanal-travesia',1000001));
 assert.ok(!cabe('club-bbtan-rondas',100001));
 // Cada carrera es una partida del club: vialibre está en clubJugadas.
 const j=new RegExp(reglas.clubJugadas.$uid.$juego['.validate'].match(/matches\(\/(.+?)\/\)/)[1]);
 assert.ok(j.test('vialibre'));assert.ok(j.test('fanal'));assert.ok(!j.test('vialibres'));
});

test('Discord dice el club, la modalidad y la marca en puntos o en metros',()=>{
 const X=carga(['src/juegos/discord.js'],'marcaSolo,categoriaLegible,mensajePodio');
 const l=X.categoriaLegible('club-vialibre-carrera');
 assert.equal(l.club.nombre,'Vía Libre');assert.equal(l.club.icono,'🚇');assert.equal(l.club.ruta,'vialibre');
 assert.equal(l.modalidad,'mejor carrera');assert.equal(X.categoriaLegible('club-vialibre-distancia').modalidad,'distancia');
 assert.equal(X.marcaSolo('club-vialibre-carrera',{puntos:12500000,tiempo:1}),'🚇 12.500.000 pts');
 assert.equal(X.marcaSolo('club-vialibre-distancia',{puntos:21097,tiempo:1}),'🚇 21.097 m');
 const msg=X.mensajePodio({categoria:'club-vialibre-distancia',uid:'a',nombre:'Ana',puesto:1,filas:[{uid:'a',nombre:'Ana',puntos:5200,tiempo:90000}],enlace:'https://x/juegos.html#solo/vialibre'});
 assert.ok(msg&&msg.content.includes('Vía Libre · distancia'));
 assert.ok(msg.embeds[0].fields.some(f=>f.value.includes('5.200 m')));
});

test('el perfil nombra las tablas, dice los metros y tiene el marco de Maquinista',()=>{
 const P=carga(['src/juegos/motor.js','src/juegos/logros.js','src/juegos/tienda.js','src/juegos/perfil-tarjeta.js'],'MARCOS,nombreCategoria,valorMarca,topDeCategoria');
 assert.equal(P.nombreCategoria('club-vialibre-carrera'),'Vía Libre · Mejor carrera');
 assert.equal(P.nombreCategoria('club-vialibre-distancia'),'Vía Libre · Distancia');
 assert.equal(P.valorMarca('club-vialibre-distancia',{puntos:42195,tiempo:1}),'42.195 m');
 assert.equal(P.valorMarca('club-vialibre-carrera',{puntos:880000,tiempo:1}),'880000 pts');
 const m=P.MARCOS.find(x=>x.id==='tvialibre');
 assert.ok(m&&m.anim);assert.equal(m.n,'Maquinista');assert.equal(m.req.top,'vialibre');
 assert.equal(P.topDeCategoria('club-vialibre-carrera'),'vialibre');
 const A=carga(['src/juegos/marcos-animados.js'],'adorno,tieneAdorno');
 assert.ok(A.tieneAdorno('tvialibre'));
 const s=A.adorno('tvialibre');
 // Un anillo de vía con su trencito y su moneda, sin ids (el marco sale muchas veces en una tabla).
 assert.match(s,/^<b class="jg-av-ad" aria-hidden="true"><svg viewBox="0 0 140 140"/);
 assert.ok(!/undefined|NaN|\bid=|url\(#/.test(s));
 assert.match(s,/class="g"/,'el tren y la moneda dan la vuelta');
});

test('el salón, la ruta, las novedades, el iframe y el manual conocen Vía Libre',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../src/juegos-main.js'),'utf8');
 assert.match(main,/solo\\\/\([^)]*\bvialibre\b/,'leerRuta conoce #solo/vialibre');
 assert.ok(main.includes('"club-vialibre"'),'su clave de popularidad está en CLUBES');
 assert.match(main,/const NOVEDADES = \[\s*\{ id: "vialibre"/,'es la primera novedad');
 assert.match(main,/n\.id === "vialibre"\) return `<div class="jg-nov-arte-vl">/);
 const html=fs.readFileSync(path.join(__dirname,'../../juegos.html'),'utf8');
 assert.match(html,/\.sp-e-vialibre\b/);assert.match(html,/\.jg-nov-arte-vl\{/);
 const S=carga(['src/juegos/salon-datos.js'],'SOLOS,COLOR_SOLO');
 const e=S.SOLOS.find(x=>x.id==='vialibre');
 assert.ok(e);assert.equal(e.tipo,'club');assert.equal(e.ruta,'#solo/vialibre');assert.equal(e.popular,'club-vialibre');
 assert.equal(e.genero,'Runner');assert.equal(e.icono,'🚇');assert.equal(e.alta,'2026-10-05');assert.equal(S.COLOR_SOLO.vialibre,'#ff6a3d');
 const club=fs.readFileSync(path.join(__dirname,'../src/juegos/solo/club.js'),'utf8');
 assert.match(club,/juego==='vialibre'\?'Vía Libre'/);assert.match(club,/juego==='vialibre'\?'900px'/);
 const manual=fs.readFileSync(path.join(__dirname,'../src/juegos/reglas.js'),'utf8');
 assert.match(manual,/^  vialibre: \{/m);
 for(const t of ['Estación Fantasma','Don Ramón','Tornillo','Mochila cohete','Libreta'])assert.ok(manual.includes(t),'el manual habla de '+t);
});

// Este falla hasta que la página del juego (juegos/club/vialibre/index.html) esté terminada.
test('la página del juego carga sus piezas con versión, i18n y la conexión del club',()=>{
 const html=fs.readFileSync(path.join(D,'index.html'),'utf8');
 for(const f of ['motor','mundo','juego'])assert.match(html,new RegExp(f+'\\.js\\?v=vialibre-\\d+'),f+'.js sin ?v=vialibre-N');
 assert.match(html,/i18n\.js\?v=/);assert.match(html,/conexion\.js\?v=club-\d+/);
});
