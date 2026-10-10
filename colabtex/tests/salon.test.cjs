/* El salón (vestíbulo) en datos: qué es de un jugador, qué es nuevo y qué
   puede abrir un invitado. Carga `salon-datos.js` y la tabla `JUEGOS` de
   `motor.js` sin navegador, como el resto de pruebas de Juegos. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sin=f=>fs.readFileSync(f,'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={crypto:require('node:crypto').webcrypto};vm.createContext(ctx);
vm.runInContext(sin('src/juegos/motor.js')+'\n;globalThis.__J=JUEGOS;',ctx);
vm.runInContext(sin('src/juegos/controles-datos.js'),ctx);
vm.runInContext(sin('src/juegos/salon-datos.js')+'\n;globalThis.__S={SOLOS,GENERO,practicaDe,diasDesde,nuevos,cupoTexto,entradasSalon,bloqueado,modoSalon,esClaveInvitado,MOTIVO_CUENTA,rutaLibre,COLOR_SOLO,CONTROLES,enMovil,enPc,pideEnVez,juegoDeNovedad};',ctx);
const S=ctx.__S,J=ctx.__J;
const main=fs.readFileSync('src/juegos-main.js','utf8');
const reglas=fs.readFileSync('src/juegos/reglas.js','utf8');
const DIA=86400000,dia=f=>Date.parse(f+'T12:00:00');

test('cada juego de un jugador tiene adónde ir, manual y fecha',()=>{
 const ids=new Set();
 for(const s of S.SOLOS){
  assert.ok(!ids.has(s.id),'id repetido: '+s.id);ids.add(s.id);
  assert.ok(s.nombre&&s.lema&&s.genero&&s.icono,s.id+' sin textos');
  assert.ok(Number.isFinite(S.diasDesde(s.alta,Date.now())),s.id+' sin alta legible');
  assert.match(reglas,new RegExp('^  "?'+s.reglas+'"?: \\{','m'),s.id+': el manual «'+s.reglas+'» no existe');
  if(s.tipo==='club'){
   /* La ruta tiene que ser una que `leerRuta` reconozca, o el clic
      acabaría en el vestíbulo otra vez. */
   const m=/^#solo\/(\w+)$/.exec(s.ruta);assert.ok(m,s.id+' sin ruta');
   assert.match(main,new RegExp('solo\\\\/\\([^)]*\\b'+m[1]+'\\b'),s.id+': leerRuta no conoce '+s.ruta);
   assert.ok(main.includes('"'+s.popular+'"'),s.id+': su clave de popularidad no está en CLUBES');
   assert.ok(S.COLOR_SOLO[s.id],s.id+' sin color');
  }else{
   assert.equal(s.tipo,'bots');assert.ok(J[s.juego],s.id+' practica un juego que no existe');
   assert.ok(fs.existsSync('../'+s.url.split('?')[0]),s.id+': no existe '+s.url);
  }
 }
});

/* La ficha se busca por `data-id` en las dos listas, primero en la de un
   jugador: Tetris Club con id "tetris" hacía que la tarjeta del Tetris
   multijugador abriera la ficha del club. */
test('ninguna tarjeta del salón comparte id con otra',()=>{
 const {multi,solos}=S.entradasSalon(J);
 const ids=[...solos,...multi].map(e=>e.id);
 assert.deepEqual(ids.filter((x,i)=>ids.indexOf(x)!==i),[]);
});

test('todos los multijugador entran en el salón, con género y cupo',()=>{
 const {multi,solos}=S.entradasSalon(J);
 assert.deepEqual([...multi.map(m=>m.id)].sort(),Object.keys(J).sort());
 for(const m of multi){assert.equal(m.modo,'multi');assert.ok(S.GENERO[m.id],m.id+' sin género');assert.match(m.cupo,/^\d+(–\d+)?$/);}
 assert.equal(multi.find(m=>m.id==='ajedrez').cupo,'2');
 assert.equal(multi.find(m=>m.id==='uno').cupo,'2–10');
 assert.equal(multi.find(m=>m.id==='yemas').cupo,'1–8','Yemas se puede jugar solo (zombis)');
 assert.equal(multi.find(m=>m.id==='yemas').practica,'bots-yemas');
 assert.equal(multi.find(m=>m.id==='uno').practica,'');
 assert.ok(solos.every(s=>s.modo==='solo'||s.modo==='bots'));
 /* Un orden dado manda (el de popularidad), y una clave que ya no existe se ignora. */
 assert.deepEqual([...S.entradasSalon(J,['uno','nada','ajedrez']).multi.map(m=>m.id)],['uno','ajedrez']);
});

test('«Nuevo» marca los cuatro últimos de las dos últimas semanas, sin empates que bailen',()=>{
 const e=[{id:'a',alta:'2026-10-01'},{id:'b',alta:'2026-10-04'},{id:'c',alta:'2026-09-01'},{id:'d',alta:'2026-10-03'},{id:'e',alta:'2026-10-03'},{id:'f',alta:'2026-10-02'},{id:'g',alta:'2026-10-05'}];
 const hoy=dia('2026-10-04');
 assert.deepEqual([...S.nuevos(e,hoy)],['b','d','e','f'],'g es del futuro y c tiene un mes');
 assert.deepEqual([...S.nuevos(e,hoy,{max:2})],['b','d']);
 assert.deepEqual([...S.nuevos(e,hoy+30*DIA)],[],'un mes después no queda nada nuevo');
 assert.deepEqual([...S.nuevos([{id:'x',alta:'mal'}],hoy)],[]);
});

test('el invitado solo juega Snake, Buscaminas, Tetris y sortEm',()=>{
 const {multi,solos}=S.entradasSalon(J);
 for(const m of multi){assert.equal(S.bloqueado(m,true),true);assert.equal(S.bloqueado(m,false),false);}
 const libres=solos.filter(s=>!S.bloqueado(s,true)).map(s=>s.id).sort();
 assert.deepEqual([...libres],['minas','snake','sortem','tetrisclub']);
 for(const s of solos)assert.equal(S.bloqueado(s,false),false,'con cuenta se juega todo: '+s.id);
 assert.ok(solos.some(s=>s.modo==='bots'&&S.bloqueado(s,true)),'las prácticas contra bots piden cuenta');
 // Las rutas #solo/<x>: el Tetris del club va por «tetris».
 for(const r of ['snake','minas','tetris','sortem'])assert.ok(S.rutaLibre(r),r);
 for(const r of ['bbtan','sopa','electro','sudoku','fanal','atasco','aleteo','dosmil','trigon','frontera','tetrisclub-no'])assert.ok(!S.rutaLibre(r),r);
 for(const k of ['solo','partida','ranks','logros','monedas','cartas','mascotas','perfil'])assert.ok(S.MOTIVO_CUENTA[k].t&&S.MOTIVO_CUENTA[k].d,k);
});

test('al empezar otra visita se borra solo lo del invitado',()=>{
 for(const k of ['snake-club-v1.cuenta.invitado','bbtan-partida-v1.cuenta.invitado','frontera.invitado','pk.equipos.invitado','jg.club.pendientes.invitado.minas'])assert.ok(S.esClaveInvitado(k),k);
 for(const k of ['snake-club-v1.cuenta.abc123','frontera.abc','pk.equipos.abc','jg.tema','jg.popular','sitio.idioma','jg.club.pendientes.abc.minas','invitado',null])assert.ok(!S.esClaveInvitado(k),String(k));
});

test('el modo guardado vuelve a «todos» si no es uno de los tres',()=>{
 assert.equal(S.modoSalon('solo'),'solo');assert.equal(S.modoSalon('multi'),'multi');
 assert.equal(S.modoSalon('x'),'todos');assert.equal(S.modoSalon(null),'todos');
});

test('cada juego dice dónde se juega, y los que no van en el celular dicen qué piden',()=>{
 const {multi,solos}=S.entradasSalon(J);
 /* La tabla la escribe el build leyendo el código (tests/controles.test.cjs
    comprueba que está al día); aquí, que el salón la usa entera. */
 for(const e of [...multi,...solos]){
  const c=S.CONTROLES[e.id];
  assert.ok(c,e.id+': no está en controles-datos.js (corre npm run build)');
  assert.equal(e.movil,c.movil,e.id);assert.equal(e.pc,c.pc,e.id);
  assert.equal(e.pide,c.movil?'':c.pide,e.id);
  if(!e.movil)assert.match(e.pide,/^teclado( y ratón)?$/,e.id+': no va en el celular y no dice qué pide');
 }
 assert.equal(S.enMovil('no-existe'),false);assert.equal(S.enPc('no-existe'),false);assert.equal(S.pideEnVez('no-existe'),'');
 assert.equal(S.pideEnVez('uno'),'','lo que va en el celular no pide nada');
});

test('una novedad lleva las etiquetas del juego al que lleva',()=>{
 assert.equal(S.juegoDeNovedad({juego:'fanal'}),'fanal');
 assert.equal(S.juegoDeNovedad({sala:{k:'boxhead'}}),'boxhead');
 assert.equal(S.juegoDeNovedad({ruta:'#solo/atasco'}),'atasco');
 assert.equal(S.juegoDeNovedad({ruta:'#solo/tetris'}),'tetrisclub','la ruta del club lleva a su entrada, no al Tetris de sala');
 assert.equal(S.juegoDeNovedad({ruta:'#cartas'}),'','PRODROP no es un juego del salón');
 /* Y las de verdad: cada novedad que abre una sala o un juego del club lo encuentra. */
 const nov=main.slice(main.indexOf('const NOVEDADES'),main.indexOf('];',main.indexOf('const NOVEDADES')));
 for(const m of nov.matchAll(/ruta: "(#solo\/\w+)"|sala: \{ k: "(\w+)"/g)){const n=m[1]?{ruta:m[1]}:{sala:{k:m[2]}};assert.ok(S.CONTROLES[S.juegoDeNovedad(n)],JSON.stringify(n));}
});
