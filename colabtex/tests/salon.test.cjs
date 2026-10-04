/* El salón (vestíbulo) en datos: qué es de un jugador, qué es nuevo y qué
   puede abrir un invitado. Carga `salon-datos.js` y la tabla `JUEGOS` de
   `motor.js` sin navegador, como el resto de pruebas de Juegos. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sin=f=>fs.readFileSync(f,'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={crypto:require('node:crypto').webcrypto};vm.createContext(ctx);
vm.runInContext(sin('src/juegos/motor.js')+'\n;globalThis.__J=JUEGOS;',ctx);
vm.runInContext(sin('src/juegos/salon-datos.js')+'\n;globalThis.__S={SOLOS,GENERO,practicaDe,diasDesde,nuevos,cupoTexto,entradasSalon,bloqueado,modoSalon,esClaveInvitado,MOTIVO_CUENTA,COLOR_SOLO};',ctx);
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

test('el invitado ve los multijugador bloqueados y juega lo demás',()=>{
 const {multi,solos}=S.entradasSalon(J);
 for(const m of multi){assert.equal(S.bloqueado(m,true),true);assert.equal(S.bloqueado(m,false),false);}
 for(const s of solos)assert.equal(S.bloqueado(s,true),false,s.id);
 for(const k of ['partida','ranks','logros','monedas','cartas','perfil'])assert.ok(S.MOTIVO_CUENTA[k].t&&S.MOTIVO_CUENTA[k].d,k);
});

test('al empezar otra visita se borra solo lo del invitado',()=>{
 for(const k of ['snake-club-v1.cuenta.invitado','bbtan-partida-v1.cuenta.invitado','frontera.invitado','pk.equipos.invitado','jg.club.pendientes.invitado.minas'])assert.ok(S.esClaveInvitado(k),k);
 for(const k of ['snake-club-v1.cuenta.abc123','frontera.abc','pk.equipos.abc','jg.tema','jg.popular','sitio.idioma','jg.club.pendientes.abc.minas','invitado',null])assert.ok(!S.esClaveInvitado(k),String(k));
});

test('el modo guardado vuelve a «todos» si no es uno de los tres',()=>{
 assert.equal(S.modoSalon('solo'),'solo');assert.equal(S.modoSalon('multi'),'multi');
 assert.equal(S.modoSalon('x'),'todos');assert.equal(S.modoSalon(null),'todos');
});
