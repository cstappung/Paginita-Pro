/* Mario Kart Wii: el vestíbulo de la sala (redMkw), la dirección del marco para cada jugador, y que el juego esté en
   las tablas que un juego de sala necesita (logros, niveles, peso, reglas de Firebase, salón, privacidad). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const raiz=f=>path.join(__dirname,'..',f);
const sin=f=>fs.readFileSync(raiz(f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={crypto:require('node:crypto').webcrypto,TextEncoder};vm.createContext(ctx);
vm.runInContext(sin('src/juegos/motor.js')+'\n'+sin('src/juegos/logros.js')+'\n'+sin('src/juegos/tienda.js')+'\n'+sin('src/juegos/cortes.js')+'\n'+sin('src/juegos/monedas.js')+
 ';globalThis.__M={reducir,JUEGOS,LOGROS,NIVEL,PESO,detecta,MKW_MODOS,MKW_CARRERAS,cupoDe,minimoDe,mkwCarrera,mkwPlaylist,mkwTabla,MKW_CC,MKW_NIVEL,MKW_SINCRO_MAX,MKW_COPAS};',ctx);
const M=ctx.__M;

// Una sala de tres (a la abrió) con estas jugadas en orden.
const sala=(...js)=>({juego:'mkw',anfitrion:'a',estado:'esperando',cupo:12,cpu:'normal',semilla:1,
 jugadores:{a:{nombre:'Ana',orden:0},b:{nombre:'Beto',orden:1},c:{nombre:'Carla',orden:2}},
 jugadas:Object.fromEntries(js.map((j,i)=>[String(i).padStart(4,'0'),j]))});

test('caben 12 como en Mario Kart en línea (cada piloto es un jugador de verdad en todas las consolas) y se abre desde uno',()=>{
 assert.equal(M.JUEGOS.mkw.cupo,12);assert.equal(M.minimoDe({juego:'mkw'}),1);
 assert.equal(M.cupoDe({juego:'mkw',cupo:4}),4,'una sala vieja de 4 sigue en 4');assert.equal(M.cupoDe({juego:'mkw',cupo:12}),12);assert.equal(M.cupoDe({juego:'mkw',cupo:20}),12,'más de 12 se recorta a 12');
 const e=M.reducir({...sala(),jugadores:{a:{nombre:'Ana',orden:0}}});
 assert.equal(e.fase,'vestibulo','uno solo ya tiene vestíbulo');
 // al crearla, la sala va con sus 12 pilotos sin preguntar (§87, el dueño: «por defecto es para el número máximo»):
 // la opción va oculta (sin ella cupoDe la dejaba en 2 y el tercero no podía entrar) y la ficha no dibuja las ocultas
 const opciones=fs.readFileSync(raiz('src/juegos-main.js'),'utf8').match(/^  mkw: \[([\s\S]*?)\]\s*\}\],?$/m);
 assert.ok(opciones&&/clave: "cupo", etiqueta: "Pilotos", por: JUEGOS\.mkw\.cupo, oculta: true, valores: \[\{ v: JUEGOS\.mkw\.cupo,/.test(opciones[1]),'la opción Pilotos, oculta, con el máximo');
 assert.match(fs.readFileSync(raiz('src/juegos/salon.js'),'utf8'),/ctx\.opciones\(e\.id\)\.filter\(o => !o\.oculta\)/,'la ficha no pregunta las opciones ocultas');
 assert.equal(M.cupoDe({juego:'mkw',cupo:4}),4);
});

test('el anfitrión pone la CPU de relleno, abre y cierra las carreras; los demás no',()=>{
 let e=M.reducir(sala());
 assert.equal(e.fase,'vestibulo');assert.equal(e.anfitrion,'a');assert.equal(e.cpu,'normal');
 e=M.reducir(sala({t:'ajuste',uid:'b',k:'cpu',v:'dificil'}));assert.equal(e.cpu,'normal','b no es el anfitrión');
 e=M.reducir(sala({t:'ajuste',uid:'a',k:'cpu',v:'ninguna'}));assert.equal(e.cpu,'ninguna');
 e=M.reducir(sala({t:'ajuste',uid:'a',k:'cpu',v:'turbo'}));assert.equal(e.cpu,'normal','lo que no existe vuelve a normal');
 e=M.reducir(sala({t:'empieza',uid:'b'}));assert.equal(e.fase,'vestibulo','solo el anfitrión abre');
 e=M.reducir(sala({t:'empieza',uid:'a'}));assert.equal(e.fase,'jugando');assert.equal(e.ronda,1);
 e=M.reducir(sala({t:'empieza',uid:'a'},{t:'vuelve',uid:'b'}));assert.equal(e.fase,'jugando','solo el anfitrión cierra');
 e=M.reducir(sala({t:'empieza',uid:'a'},{t:'vuelve',uid:'a'},{t:'empieza',uid:'a'}));assert.equal(e.fase,'jugando');assert.equal(e.ronda,2);
});

test('los dos modos de la sala (sin Retro WFC, pedido del dueño): copa por omisión; el anfitrión elige modo y carreras en el vestíbulo',()=>{
 assert.deepEqual(Object.keys(M.MKW_MODOS),['copa','playlist']);
 const nueva=(...js)=>{const s=sala(...js);delete s.cpu;return s;};      // una sala nueva no trae `cpu`
 let e=M.reducir(nueva());
 assert.equal(e.estilo,'copa');assert.equal(e.carreras,4);
 e=M.reducir(nueva({t:'empieza',uid:'a'}));assert.deepEqual([...e.sincro],['a','b','c'],'siempre la carrera sincronizada (nada del Wi-Fi del juego)');
 e=M.reducir({...nueva(),estilo:'copa',carreras:8});assert.equal(e.estilo,'copa');assert.equal(e.carreras,8,'lo elegido al crear la sala');
 e=M.reducir({...nueva(),estilo:'wfc'});assert.equal(e.estilo,'copa','una sala vieja de Retro WFC pasa a copa');
 e=M.reducir(nueva({t:'ajuste',uid:'a',k:'estilo',v:'playlist'}));assert.equal(e.estilo,'playlist');
 e=M.reducir(nueva({t:'ajuste',uid:'b',k:'estilo',v:'playlist'}));assert.equal(e.estilo,'copa','b no es el anfitrión');
 e=M.reducir(nueva({t:'ajuste',uid:'a',k:'estilo',v:'wfc'}));assert.equal(e.estilo,'copa','Retro WFC ya no existe');
 e=M.reducir(nueva({t:'ajuste',uid:'a',k:'estilo',v:'copa'},{t:'ajuste',uid:'a',k:'carreras',v:2}));assert.equal(e.carreras,2);
 e=M.reducir(nueva({t:'ajuste',uid:'a',k:'carreras',v:5}));assert.equal(e.carreras,4,'solo 2, 4, 8 o 12');
 e=M.reducir(nueva({t:'empieza',uid:'a'},{t:'ajuste',uid:'a',k:'estilo',v:'playlist'}));assert.equal(e.estilo,'copa','corriendo no se cambia el modo');
});

test('M20: el nivel de la CPU es un ajuste propio del anfitrión, aparte de la cilindrada, Máximo por omisión, y va al marco',()=>{
 const nueva=(...js)=>{const s=sala(...js);delete s.cpu;return s;};
 assert.deepEqual(Object.keys(M.MKW_NIVEL),['facil','normal','dificil','maximo','intenso','imposible'],'de menos a más (el orden de los botones; M23: intenso e imposible)');
 let e=M.reducir(nueva());assert.equal(e.nivel,'maximo','Máximo por omisión');
 e=M.reducir(nueva({t:'ajuste',uid:'a',k:'nivel',v:'normal'}));assert.equal(e.nivel,'normal');assert.equal(e.cc,'c150','la cilindrada no cambia');
 e=M.reducir(nueva({t:'ajuste',uid:'a',k:'cc',v:'c100'},{t:'ajuste',uid:'a',k:'nivel',v:'facil'}));assert.equal(e.cc,'c100');assert.equal(e.nivel,'facil','los dos ajustes, cada uno el suyo');
 e=M.reducir(nueva({t:'ajuste',uid:'b',k:'nivel',v:'facil'}));assert.equal(e.nivel,'maximo','b no es el anfitrión');
 e=M.reducir(nueva({t:'ajuste',uid:'a',k:'nivel',v:'turbo'}));assert.equal(e.nivel,'maximo','lo que no existe vuelve a Máximo');
 e=M.reducir(nueva({t:'ajuste',uid:'a',k:'nivel',v:'imposible'}));assert.equal(e.nivel,'imposible','M23: imposible existe');
 e=M.reducir(nueva({t:'empieza',uid:'a'},{t:'ajuste',uid:'a',k:'nivel',v:'normal'}));assert.equal(e.nivel,'maximo','corriendo no se cambia');
 e=M.reducir(nueva({t:'ajuste',uid:'a',k:'nivel',v:'dificil'},{t:'empieza',uid:'a'}));
 assert.equal(e.hist[e.hist.length-1].nivel,'dificil','la ronda anota el nivel');
 // la dirección del marco lleva &cpu= (lo que lee la página del juego) y la ficha lo ofrece
 const fuente=fs.readFileSync(raiz('src/juegos/mkw.js'),'utf8');
 assert.match(fuente,/q\.set\("cpu", MKW_NIVEL\[nivel\] \? nivel : "maximo"\)/);
 assert.match(fuente,/data-nivel="\$\{k\}"/);assert.match(fuente,/k: "nivel", v: b\.dataset\.nivel/);
});

test('copa y playlist: la cilindrada del anfitrión, y al terminar vuelven al vestíbulo con la tabla final',()=>{
 const nueva=(...js)=>{const s=sala(...js);delete s.cpu;return s;};
 assert.deepEqual(Object.keys(M.MKW_CC),['c150','espejo','c100','azar'],'de menos a más: 150cc, espejo, 200cc; al azar al final');
 let e=M.reducir(nueva());assert.equal(e.cc,'c150','150cc por omisión');assert.equal(e.ultimaTabla,null);
 e=M.reducir(nueva({t:'ajuste',uid:'a',k:'cc',v:'espejo'}));assert.equal(e.cc,'espejo');
 e=M.reducir(nueva({t:'ajuste',uid:'b',k:'cc',v:'c100'}));assert.equal(e.cc,'c150','b no es el anfitrión');
 e=M.reducir(nueva({t:'ajuste',uid:'a',k:'cc',v:'200'}));assert.equal(e.cc,'c150','lo que no existe vuelve a 150cc');
 e=M.reducir(nueva({t:'empieza',uid:'a'},{t:'ajuste',uid:'a',k:'cc',v:'c100'}));assert.equal(e.cc,'c150','corriendo no se cambia');
 const tabla=[{nombre:'Ana',puntos:27},{nombre:'Beto',puntos:24}];
 e=M.reducir(nueva({t:'ajuste',uid:'a',k:'estilo',v:'copa'},{t:'empieza',uid:'a'},{t:'vuelve',uid:'a',tabla}));
 assert.equal(e.fase,'vestibulo');assert.deepEqual(JSON.parse(JSON.stringify(e.ultimaTabla)),{n:1,estilo:'copa',tabla});
 assert.deepEqual(JSON.parse(JSON.stringify(e.hist[e.hist.length-1])),{e:'vuelve',n:1,tabla});
 e=M.reducir(nueva({t:'empieza',uid:'a'},{t:'vuelve',uid:'a'}));assert.equal(e.ultimaTabla,null,'volver sin tabla (el anfitrión cortó antes): no hay');
 // la tabla del marco se limpia: hasta 12 filas, nombres de 20 letras, puntos enteros 0..9999
 assert.equal(M.mkwTabla('x'),null);assert.equal(M.mkwTabla([]),null);
 const sucia=[{nombre:'X'.repeat(40),puntos:12.4},{nombre:5,puntos:3},{nombre:'Y',puntos:-1},{nombre:'Z',puntos:'7'},...Array(20).fill({nombre:'W',puntos:1})];
 const limpia=M.mkwTabla(sucia);
 assert.equal(limpia[0].nombre.length,20);assert.equal(limpia[0].puntos,12);assert.equal(limpia[1].nombre,'Z');assert.equal(limpia[1].puntos,7);
 assert.ok(limpia.length<=12);
 // la cola de la playlist: n pistas distintas, igual en cada navegador, distinta en otra tanda
 const l=M.mkwPlaylist('p1',1,8);
 assert.equal(l.length,8);assert.equal(new Set(l.map(x=>x.copa*4+x.fila)).size,8);
 assert.ok(l.every(x=>x.copa>=0&&x.copa<M.MKW_COPAS&&x.fila>=0&&x.fila<4));
 assert.deepEqual(M.mkwPlaylist('p1',1,8),l);assert.notDeepEqual(M.mkwPlaylist('p1',2,8),l);
});

test('pasar el anfitrión: solo en el vestíbulo y a alguien de la sala',()=>{
 let e=M.reducir(sala({t:'anfitrion',uid:'a',a:'b'}));assert.equal(e.anfitrion,'b');
 e=M.reducir(sala({t:'anfitrion',uid:'b',a:'b'}));assert.equal(e.anfitrion,'a','no se lo puede tomar');
 e=M.reducir(sala({t:'anfitrion',uid:'a',a:'intruso'}));assert.equal(e.anfitrion,'a');
 e=M.reducir(sala({t:'empieza',uid:'a'},{t:'anfitrion',uid:'a',a:'c'}));assert.equal(e.anfitrion,'a','corriendo, no (la sala del juego la lleva él)');
});

test('§99: si el anfitrión desaparece con la copa andando, el reemplazo la toma (solo con la copa andando y de quien manda)',()=>{
 let e=M.reducir(sala({t:'empieza',uid:'a'},{t:'toma',uid:'b',de:'a'}));
 assert.equal(e.anfitrion,'b');assert.equal(e.fase,'jugando');assert.equal(e.hist[e.hist.length-1].e,'toma');
 e=M.reducir(sala({t:'empieza',uid:'a'},{t:'toma',uid:'b',de:'a'},{t:'vuelve',uid:'b'}));assert.equal(e.fase,'vestibulo','el nuevo cierra la copa');
 e=M.reducir(sala({t:'toma',uid:'b',de:'a'}));assert.equal(e.anfitrion,'a','en el vestíbulo, no');
 e=M.reducir(sala({t:'empieza',uid:'a'},{t:'toma',uid:'b',de:'c'}));assert.equal(e.anfitrion,'a','una toma de quien no manda no vale');
 e=M.reducir(sala({t:'empieza',uid:'a'},{t:'toma',uid:'b',de:'a'},{t:'toma',uid:'c',de:'a'}));assert.equal(e.anfitrion,'b','una toma vieja (de antes del cambio) no hace nada');
 e=M.reducir(sala({t:'abandona',uid:'c'},{t:'empieza',uid:'a'},{t:'toma',uid:'c',de:'a'}));assert.equal(e.anfitrion,'a','quien no corre la copa no la toma');
 const mk=require('fs').readFileSync(require('path').join(__dirname,'../src/juegos/mkw.js'),'utf8');
 assert.match(mk,/Date\.now\(\) - ausenteDesde < 15000/,'se espera 15 s antes de reemplazar');
 assert.match(mk,/anota\(\{ t: "toma", uid, de: jefe \}\)/,'el reemplazo escribe la toma');
});

test('cada jugador tiene su nodo fijo (10.77.0.<nodo>), aunque otros se vayan',()=>{
 let e=M.reducir(sala());
 assert.deepEqual({...e.nodos},{a:2,b:3,c:4});
 e=M.reducir(sala({t:'abandona',uid:'b'}));
 assert.equal(e.nodos.c,4,'el de Carla no cambia');
 const nodos=Object.values(e.nodos);assert.equal(new Set(nodos).size,nodos.length,'sin repetidos');
});

test('si se va el anfitrión el puesto pasa al siguiente y la copa sigue (no hay servidor); sin nadie, fin',()=>{
 let e=M.reducir(sala({t:'empieza',uid:'a'},{t:'abandona',uid:'a'}));
 assert.equal(e.anfitrion,'b');assert.equal(e.fase,'jugando','siguen: el nuevo anfitrión lleva la sala del juego');
 assert.deepEqual([...e.sincro],['a','b','c'],'la lista de la carrera no cambia (el kart de quien se fue sigue sin nadie)');
 e=M.reducir(sala({t:'empieza',uid:'a'},{t:'abandona',uid:'c'}));
 assert.equal(e.fase,'jugando','si se va otro, siguen');
 e=M.reducir(sala({t:'abandona',uid:'a'},{t:'abandona',uid:'b'},{t:'abandona',uid:'c'}));
 assert.equal(e.fase,'fin');assert.equal(e.motivo,'abandono');assert.equal(e.ganador,'','la sala no clasifica');
 e=M.reducir(sala({t:'abandona',uid:'b'},{t:'empieza',uid:'b'}));assert.equal(e.fase,'vestibulo','quien se fue ya no juega');
});

test('cada tanda es una carrera sincronizada con los que estaban al empezar (hasta 12)',()=>{
 let e=M.reducir(sala({t:'empieza',uid:'a'}));
 assert.deepEqual([...e.sincro],['a','b','c'],'en orden: puerto 1, 2, 3');
 e=M.reducir(sala({t:'ajuste',uid:'a',k:'cpu',v:'ninguna'},{t:'empieza',uid:'a'}));
 assert.deepEqual([...e.sincro],['a','b','c'],'la CPU ya no decide nada: siempre sincronizada');
 e=M.reducir(sala());assert.equal(e.sincro,null,'en el vestíbulo no hay');
 e=M.reducir(sala({t:'empieza',uid:'a'},{t:'vuelve',uid:'a'}));assert.equal(e.sincro,null);
 e=M.reducir(sala({t:'abandona',uid:'b'},{t:'empieza',uid:'a'}));assert.deepEqual([...e.sincro],['a','c'],'quien se fue no corre');
 e=M.reducir(sala({t:'empieza',uid:'a'},{t:'abandona',uid:'b'}));assert.deepEqual([...e.sincro],['a','b','c'],'si alguien se va corriendo, la lista no cambia (su kart sigue sin nadie)');
 const con=n=>({...sala({t:'empieza',uid:'a'}),jugadores:Object.fromEntries('abcdefghijklm'.slice(0,n).split('').map((u,i)=>[u,{nombre:u,orden:i}]))});
 assert.equal(M.MKW_SINCRO_MAX,12);
 assert.deepEqual([...M.reducir(con(5)).sincro],['a','b','c','d','e'],'con 5 corren los 5 (del 5.º en adelante, mandos virtuales)');
 assert.deepEqual([...M.reducir(con(12)).sincro],'abcdefghijkl'.split(''),'la sala llena: 12, como Mario Kart en línea');
 assert.deepEqual([...M.reducir(con(13)).sincro],'abcdefghijkl'.split(''),'en una sala con 13 (no debería haber): corren los 12 primeros');
});

test('la semilla y las 4 pistas de cada tanda salen de la sala y del número de tanda',()=>{
 const a=M.mkwCarrera('p1',1),b=M.mkwCarrera('p1',1),c=M.mkwCarrera('p1',2),d=M.mkwCarrera('p2',1);
 assert.deepEqual(a,b,'lo mismo en cada navegador');
 assert.notDeepEqual(a.pistas,c.pistas,'otra tanda, otras pistas');assert.notEqual(a.semilla,d.semilla,'otra sala, otra semilla');
 for (let r=1;r<200;r++){
  const x=M.mkwCarrera('sala-'+r,r);
  assert.equal(x.pistas.length,4);assert.ok(x.semilla>0);
  assert.equal(new Set(x.pistas.map(t=>t.copa*4+t.fila)).size,4,'sin repetir pista');
  assert.ok(x.pistas.every(t=>t.copa>=0&&t.copa<M.MKW_COPAS&&t.fila>=0&&t.fila<4),'solo copas de carrera');
 }
});

test('diez logros propios, todos de partida, con su nivel; y su peso',()=>{
 assert.equal(M.LOGROS.mkw.length,10);
 assert.ok(!M.LOGROS.mkw.some(x=>x.f),'no lleva los de la fila: la sala no clasifica');
 assert.equal(new Set(M.LOGROS.mkw.map(x=>x.id)).size,10);
 assert.equal(M.NIVEL.mkw.length,10);assert.match(M.NIVEL.mkw,/^[1-4]+$/);
 assert.ok(M.PESO.mkw>=1);
 const p=sala({t:'ajuste',uid:'a',k:'cpu',v:'ninguna'},{t:'empieza',uid:'a'});
 const e=M.reducir(p);
 assert.deepEqual([...M.detecta(p,e,'a')].sort(),['anfitrion','largada','puros']);
 assert.deepEqual([...M.detecta(p,e,'b')].sort(),['largada','puros','visita']);
});

test('la dirección del marco: la sala nueva del juego (modo=sala) con su malla, su nodo, los pilotos, el anfitrión y la copa',()=>{
 const src=fs.readFileSync(raiz('src/juegos/mkw.js'),'utf8');
 const c={URLSearchParams,mkwCarrera:M.mkwCarrera,mkwPlaylist:M.mkwPlaylist,MKW_NIVEL:M.MKW_NIVEL};vm.runInNewContext(src.slice(src.indexOf('const PAGINA'),src.indexOf('let privado'))+src.slice(src.indexOf('export function srcMkw')).replace(/export /g,'').split('export function crearMkw')[0]+';__s=srcMkw',c);
 const u=new URL('https://x/'+c.__s({pid:'p1',uid:'b',nodo:3,privado:'https://w.example',ronda:3,sincro:['a','b'],jefe:'a'}));
 assert.equal(u.pathname,'/juegos/mkw/web/navegador/index.html');
 const q=u.searchParams, t=M.mkwCarrera('p1',3);
 assert.equal(q.get('red'),'malla');assert.equal(q.get('senal'),'padre');assert.equal(q.get('modo'),'sala','la sala nueva: nada del Wi-Fi del juego');
 assert.equal(q.get('sala'),'p1');assert.equal(q.get('uid'),'b');assert.equal(q.get('nodo'),'3');
 assert.equal(q.get('sincro'),'a,b');assert.equal(q.get('jefe'),'a');assert.equal(q.get('semilla'),String(t.semilla),'la semilla de la tanda (la misma carrera en todos)');
 assert.equal(q.get('estilo'),'copa','copa por omisión');assert.equal(q.get('carreras'),'4');assert.equal(q.get('cc'),'c150');
 assert.equal(q.get('cpu'),'maximo','M20: la CPU en Máximo por omisión');
 assert.equal(q.get('pistas'),null,'en la copa las pistas las elige el anfitrión en el juego');
 assert.equal(q.get('privado'),'https://w.example');assert.equal(q.get('r'),'3');
 for (const k of ['anfitrion','relleno','nombres']) assert.equal(q.get(k),null,k+' ya no va (los nombres van por mensaje)');
 const w=new URL('https://x/'+c.__s({pid:'p1',uid:'a',nodo:2,privado:'',ronda:1,sincro:['a'],jefe:'a',estilo:'copa',carreras:8,cc:'espejo'})).searchParams;
 assert.equal(w.get('carreras'),'4','la copa es una copa del juego: siempre 4 carreras (§74)');assert.equal(w.get('cc'),'espejo');assert.equal(w.get('privado'),null);
 const pl=new URL('https://x/'+c.__s({pid:'p1',uid:'b',nodo:3,privado:'',ronda:2,sincro:['a','b'],jefe:'a',estilo:'playlist',carreras:4,cc:'azar'})).searchParams;
 assert.equal(pl.get('estilo'),'playlist');assert.equal(pl.get('cc'),'azar');
 const nv=n=>new URL('https://x/'+c.__s({pid:'p1',uid:'b',nodo:3,privado:'',ronda:2,sincro:['a','b'],jefe:'a',cc:'c100',nivel:n})).searchParams;
 assert.equal(nv('normal').get('cpu'),'normal','M20: el nivel del anfitrión, aparte de la cilindrada');assert.equal(nv('normal').get('cc'),'c100');
 assert.equal(nv('turbo').get('cpu'),'maximo','un nivel que no existe va como Máximo');
 assert.equal(pl.get('pistas'),null,'la lista de la playlist la arma el anfitrión en el juego, con sugerencias (§74)');assert.equal(pl.get('carreras'),'4','hasta cuántas llena su 🎲');
 const sinJefe=new URL('https://x/'+c.__s({pid:'p1',uid:'b',nodo:3,privado:'',ronda:2,sincro:['c','b']})).searchParams;
 assert.equal(sinJefe.get('jefe'),'c','sin anfitrión: el primero de la lista');
});

test('está en las reglas de Firebase (con el tope de 12 y su nodo mkw), en el salón y es privado como BT3',()=>{
 const reglas=JSON.parse(fs.readFileSync(raiz('../firebase/database.rules.json'),'utf8'));
 assert.match(JSON.stringify(reglas.rules.partidas),/'mkw'/,'falta en la lista del campo juego');
 assert.match(reglas.rules.partidas.$pid.cupo['.validate'],/<= 12/);
 assert.ok(new RegExp(reglas.rules.logros.$juego['.validate'].match(/matches\(\/(.*)\/\)/)[1]).test('mkw'),'falta en la regla de logros');
 const vr=reglas.rules.mkw.vr.$uid, rec=reglas.rules.mkw.records.$tabla.$uid;
 assert.match(vr['.write'],/auth\.uid === \$uid/,'cada uno escribe solo su VR');
 assert.match(rec['.write'],/newData\.child\('ms'\)\.val\(\) < data\.child\('ms'\)\.val\(\)/,'un récord solo se reemplaza por uno mejor');
 assert.equal(vr.$otro['.validate'],false);assert.equal(rec.$otro['.validate'],false);
 assert.match(fs.readFileSync(raiz('src/juegos/salon-datos.js'),'utf8'),/mkw: "Carreras"/);
 const main=fs.readFileSync(raiz('src/juegos-main.js'),'utf8');
 for (const r of [/k !== "mkw" \|\| bt3Visible\(\)/, /n\.id !== "mkw" \|\| bt3Visible\(\)/, /s\.juego !== "mkw" \|\| bt3Visible\(\)/, /x\.juego !== "mkw" \|\| bt3Visible\(\)/,
   /sala\.juego === "mkw" && !bt3Visible\(\)\) return;/, /p\.juego === "mkw" && !bt3Visible\(\)\) \{ caja\.innerHTML = ""; return; \}/, /juego !== "bt3" && juego !== "mkw"\) anunciaSala/])
  assert.match(main,r);
 const o={};vm.runInNewContext(sin('src/juegos/ocultos.js')+';__o={juegoOculto}',o);
 assert.equal(o.__o.juegoOculto('mkw'),true,'oculto hasta que el Worker diga que sí');
 assert.match(fs.readFileSync(raiz('src/juegos/bt3-amigos.js'),'utf8'),/ponOculto\("mkw", !v\)/);
});

test('el marco recibe el token de Firebase para el Worker de amigos, solo él y como el de BT3',()=>{
 const src=fs.readFileSync(raiz('src/juegos/mkw.js'),'utf8');
 assert.match(src,/import \{[^}]*\bauth\b[^}]*\} from "\.\.\/firebase\.js"/,'usa la sesión del sitio');
 // solo contesta a su propio marco (mensaje() ya filtra source, origin y canal) y con el canal del padre
 assert.match(src,/e\.source !== frame\?\.contentWindow \|\| e\.origin !== location\.origin \|\| e\.data\?\.canal !== HIJO/);
 assert.match(src,/d\.tipo === "token"[\s\S]{0,200}getIdToken\(!!d\.nuevo\)[\s\S]{0,200}postMessage\(\{ canal: PADRE, tipo: "token"/);
 // y el Worker de BT3 tiene las rutas de Mario Kart detrás de la misma lista de amigos
 const w=fs.readFileSync(raiz('../juegos/bt3/fuente/disco/worker.js'),'utf8');
 assert.match(w,/if \(!esta\) return responde\("sin acceso", 403, c\);[\s\S]{0,200}if \(deMkw\) return mkw\(/,'primero la lista, después /mkw/');
});

test('las partidas de cada uno van a Storage (mkw/<uid>/partidas.mkwp): solo su dueño, y el marco las recibe antes de leerlas',()=>{
 const src=fs.readFileSync(raiz('src/juegos/mkw.js'),'utf8');
 assert.match(src,/import \{[^}]*\bstorage\b[^}]*\} from "\.\.\/firebase\.js"/,'usa el Storage del sitio');
 // lo que sube viene del marco (otro reino): se copia antes de dárselo a Firebase, y la metadata va como texto
 assert.match(src,/const datos = new Uint8Array\(bytes\.byteLength\); datos\.set\(bytes\);/);
 assert.match(src,/customMetadata\[k\] = String\(meta\[k\]\)/);
 assert.match(src,/"storage\/object-not-found"\) return null/,'sin partida en la nube = null, no error');
 // primero las partidas (el juego espera hasta 4 s), después récords y VR
 assert.match(src,/w\.mkwConectarNube\(\{ almacen: almacenPartidas, uid \}\)[\s\S]{0,120}w\.mkwConectarRecords/);
 const reglas=fs.readFileSync(raiz('../firebase/storage.rules'),'utf8');
 const bloque=reglas.match(/match \/mkw\/\{uid\}\/partidas\.mkwp \{[\s\S]*?\n    \}/);
 assert.ok(bloque,'falta el bloque de Mario Kart en storage.rules');
 assert.match(bloque[0],/request\.auth != null && request\.auth\.uid == uid/,'solo su dueño');
 assert.match(bloque[0],/allow read: if esSuyo\(\);/);
 assert.match(bloque[0],/request\.resource\.size < 8 \* 1024 \* 1024/,'con tope');
 assert.match(bloque[0],/metadata\.get\('uid', ''\) == uid/,'marcado con su uid');
 assert.match(bloque[0],/html\|javascript\|ecmascript/,'nunca HTML ni JS');
 assert.ok(reglas.indexOf('match /mkw/{uid}') < reglas.indexOf('match /{allPaths=**}'),'antes del «todo cerrado»');
});
test('§92 la Contrarreloj contra el mejor de la página: el fantasma del récord de cada uno en Storage, lo leen todos y lo escribe su dueño',()=>{
 const src=fs.readFileSync(raiz('src/juegos/mkw.js'),'utf8');
 const rec=src.slice(src.indexOf('const almacenRecords'),src.indexOf('const almacenPartidas'));
 assert.match(rec,/async fantasmaSubir\(k, u, bytes\)[\s\S]{0,200}new Uint8Array\(bytes\.byteLength\); datos\.set\(bytes\)/,'copia lo del marco');
 assert.match(rec,/mkw\/fantasmas\/\$\{k\}\/\$\{u\}\.rkg[\s\S]{0,120}customMetadata: \{ uid: u \}/,'en su carpeta y marcado con su uid');
 assert.match(rec,/async fantasmaBajar\(k, u\)[\s\S]{0,200}"storage\/object-not-found"\) return null/,'sin fantasma = null, no error');
 const reglas=fs.readFileSync(raiz('../firebase/storage.rules'),'utf8');
 const bloque=reglas.match(/match \/mkw\/fantasmas\/\{tabla\}\/\{archivo\} \{[\s\S]*?\n    \}/);
 assert.ok(bloque,'falta el bloque de los fantasmas en storage.rules');
 assert.match(bloque[0],/allow read: if request\.auth != null;/,'lo leen todos los que tienen sesión');
 assert.match(bloque[0],/archivo == request\.auth\.uid \+ '\.rkg'/,'cada uno escribe solo el suyo');
 assert.match(bloque[0],/tabla\.matches\('\^\[0-9a-f\]\+-tt\(150\|200\)\$'\)/,'solo tablas de Contrarreloj');
 assert.match(bloque[0],/request\.resource\.size < 64 \* 1024/,'con tope');
 assert.match(bloque[0],/html\|javascript\|ecmascript/,'nunca HTML ni JS');
 assert.ok(reglas.indexOf('match /mkw/fantasmas/') < reglas.indexOf('match /{allPaths=**}'),'antes del «todo cerrado»');
});
test('un jugador (#solo/mkw): solo para la lista de amigos, el marco con el menú de inicio y sus avisos',async()=>{
 const src=fs.readFileSync(raiz('src/juegos/mkw.js'),'utf8');
 const trozo=src.slice(src.indexOf('const PADRE'),src.indexOf('let privado'))+src.slice(src.indexOf('/* «Un jugador» dentro de Juegos (`#solo/mkw`)'),src.indexOf('export function crearMkw({')).replace(/export /g,'');
 // un DOM de mentira: lo justo para montar el marco y ver qué se registra, en qué orden y qué se le contesta
 const pasos=[],oyentes=new Set(),enviados=[];
 const marcoWin={postMessage:(m,o)=>enviados.push([m,o])};
 const crear=()=>{const f={className:'',title:'',allow:'',attrs:{},contentWindow:marcoWin,setAttribute(k,v){this.attrs[k]=v;},remove(){pasos.push('quitado');},focus(){},
  set src(v){pasos.push('src');this._src=v;},get src(){return this._src;}};return f;};
 const c={URLSearchParams,setInterval:()=>0,clearInterval:()=>{},console,location:{origin:'https://sitio'},
  document:{createElement:crear},
  window:{addEventListener:(t,f)=>{pasos.push('oye');oyentes.add(f);},removeEventListener:(t,f)=>oyentes.delete(f)},
  auth:{currentUser:{uid:'u1',displayName:'Ana',getIdToken:async nuevo=>nuevo?'fresco':'tok'}},almacenPartidas:{},almacenRecords:{}};
 vm.runInNewContext(trozo+';__c=crearMkwSolo;__s=srcMkwSolo',c);
 const host=()=>({innerHTML:'',hijos:[],append(x){this.hijos.push(x);}});
 const espera=()=>new Promise(r=>setTimeout(r,10));
 // no está en la lista: «privado», sin marco
 let h=host();c.__c({volver(){},enLinea(){},revisar:async()=>false,privadoUrl:async()=>'https://w/mkw'}).montar(h);await espera();
 assert.match(h.innerHTML,/Este juego es privado/);assert.equal(h.hijos.length,0);
 // en la lista pero sin publicar
 h=host();c.__c({volver(){},enLinea(){},revisar:async()=>true,privadoUrl:async()=>''}).montar(h);await espera();
 assert.match(h.innerHTML,/todavía no está publicado/);assert.equal(h.hijos.length,0);
 // en la lista: el marco, con el oyente puesto ANTES de cargarlo (lo primero que pide es el token)
 let volvio=0,salas=0;h=host();
 const s=c.__c({volver(){volvio++;},enLinea(){salas++;},revisar:async()=>true,privadoUrl:async()=>'https://w/mkw'});s.montar(h);await espera();
 const f=h.hijos[0];
 assert.ok(f,'monta el marco');assert.equal(f.className,'jg-bt3-solo');assert.match(f.allow,/gamepad/);
 assert.ok(pasos.indexOf('oye')<pasos.indexOf('src'),'el oyente va antes de cargar la página');
 const u=new URL('https://sitio/'+f.src);
 assert.equal(u.pathname,'/juegos/mkw/web/navegador/index.html');
 assert.equal(u.searchParams.get('privado'),'https://w/mkw');assert.equal(u.searchParams.get('senal'),'padre','espera sus partidas de la cuenta');
 assert.equal(u.searchParams.get('modo'),null,'sin modo: abre con el menú de inicio');
 const avisa=(d,de=marcoWin,origen='https://sitio')=>{for(const o of oyentes)o({source:de,origin:origen,data:{canal:'mkw-hijo',...d}});};
 avisa({tipo:'volver'});avisa({tipo:'salas'});
 avisa({tipo:'volver'},{},'https://sitio');avisa({tipo:'salas'},marcoWin,'https://otro');   // de otro marco u otro origen: nada
 assert.equal(volvio,1);assert.equal(salas,1);
 avisa({tipo:'token',nuevo:true});await espera();
 assert.deepEqual(JSON.parse(JSON.stringify(enviados[0])),[{canal:'mkw-padre',tipo:'token',token:'fresco'},'https://sitio'],'el token fresco, solo a su marco');
 s.destruir();assert.equal(oyentes.size,0,'al salir deja de escuchar');
 // y en el sitio: la ruta, su vista a pantalla completa (las reglas de BT3), la entrada «un jugador» y escondida a los demás
 const main=fs.readFileSync(raiz('src/juegos-main.js'),'utf8');
 assert.match(main,/\|bt3\|mkw\)\$\/\.test\(h\)/,'la ruta #solo/mkw');
 assert.match(main,/state\.vista === "solo-mkw"\) \{[\s\S]{0,300}crearMkwSolo\(\{ volver: \(\) => ir\(""\), enLinea: \(\) => \{ ir\(""\); setTimeout\(\(\) => salon\.abre && salon\.abre\("mkw"\)/);
 assert.match(main,/classList\.toggle\("jg-mkwsolo", state\.vista === "solo-mkw" && !motivo\)/);
 assert.match(main,/e\.juego !== "bt3" && e\.juego !== "mkw"/,'la entrada no se ve fuera de la lista');
 assert.match(fs.readFileSync(raiz('../juegos.html'),'utf8'),/html\.jg-bt3solo #pantalla,html\.jg-mkwsolo #pantalla\{position:fixed/);
 assert.match(fs.readFileSync(raiz('src/juegos/salon-datos.js'),'utf8'),/id: "bots-mkw", tipo: "bots", juego: "mkw"[\s\S]{0,200}ruta: "#solo\/mkw"/);
});

test('el ensayo local (jugar.bat): los emuladores de Firebase y el catálogo «solo Mario Kart» existen solo en esta PC',()=>{
 // Se toma la condición tal cual está en el código y se evalúa con otra dirección de página: en el sitio publicado
 // (o en un dominio que solo empieza con "localhost") no hay emuladores ni filtro, aunque alguien ponga el objeto.
 const fb=fs.readFileSync(raiz('src/firebase.js'),'utf8'),main=fs.readFileSync(raiz('src/juegos-main.js'),'utf8');
 const emu=/const EMU = ([\s\S]*?);\r?\n/.exec(fb)[1],solo=/const SOLO_LOCAL = ([\s\S]*?);\r?\n/.exec(main)[1];
 const evalua=(expr,host)=>vm.runInNewContext(expr,{location:{hostname:host},window:{__FIREBASE_EMU:{auth:'http://127.0.0.1:9099'},__JG_SOLO:['mkw']}});
 for(const host of['cstappung.github.io','localhost.malo.com','127.0.0.1.malo.com','192.168.1.5']){
  assert.equal(evalua(emu,host),null,`sin emuladores en ${host}`);assert.equal(evalua(solo,host),null,`sin filtro en ${host}`);
 }
 for(const host of['127.0.0.1','localhost']){
  assert.equal(evalua(emu,host).auth,'http://127.0.0.1:9099');assert.deepEqual([...evalua(solo,host)],['mkw']);
 }
 // sin el objeto (la página normal en esta PC) tampoco
 assert.equal(vm.runInNewContext(emu,{location:{hostname:'127.0.0.1'},window:{}}),null);
 assert.equal(vm.runInNewContext(solo,{location:{hostname:'127.0.0.1'},window:{}}),null);
 // con emuladores: ni App Check ni Analytics (nada sale de la PC)
 assert.match(fb,/if \(APP_CHECK_SITE_KEY && !EMU &&/);
 assert.match(fb,/connectAuthEmulator\(auth, EMU\.auth/);
});

test('§87 echar: el anfitrión saca a quien quiera (vestíbulo o copa andando); la votación, con 3 o más',()=>{
 const J=x=>JSON.stringify(x);
 let e=M.reducir(sala({t:'echa',uid:'a',a:'c'}));
 assert.ok(e.fuera.c,'el anfitrión echa a Carla');assert.equal(e.expulsados.length,1);assert.equal(e.expulsados[0].echado,true);
 assert.equal(J(e.hist[e.hist.length-1]),J({e:'echado',uid:'c',por:'a'}));
 e=M.reducir(sala({t:'echa',uid:'b',a:'c'}));assert.ok(!e.fuera.c,'Beto no es el anfitrión');assert.equal(e.expulsados.length,0);
 e=M.reducir(sala({t:'echa',uid:'a',a:'a'}));assert.ok(!e.fuera.a,'no se echa a sí mismo');
 e=M.reducir(sala({t:'echa',uid:'a',a:'zz'}));assert.equal(Object.keys(e.fuera).length,0,'a nadie que no esté');
 // con la copa andando: sale al momento y la copa sigue con el mismo orden (su kart, sin nadie)
 e=M.reducir(sala({t:'empieza',uid:'a'},{t:'echa',uid:'a',a:'b'}));
 assert.ok(e.fuera.b);assert.equal(e.fase,'jugando');assert.deepEqual([...e.sincro],['a','b','c']);
 // quien pasó el puesto ya no echa; el nuevo anfitrión sí; si el anfitrión se va, echa el siguiente
 e=M.reducir(sala({t:'anfitrion',uid:'a',a:'b'},{t:'echa',uid:'a',a:'c'}));assert.ok(!e.fuera.c,'Ana ya no manda');
 e=M.reducir(sala({t:'anfitrion',uid:'a',a:'b'},{t:'echa',uid:'b',a:'c'}));assert.ok(e.fuera.c,'Beto manda ahora');
 e=M.reducir(sala({t:'abandona',uid:'a'},{t:'echa',uid:'b',a:'c'}));assert.ok(e.fuera.c,'se fue Ana: manda Beto');
 // lo que haga el echado ya no cuenta: ni su voto ni sus jugadas
 e=M.reducir(sala({t:'echa',uid:'a',a:'c'},{t:'voto',uid:'c',contra:'b'},{t:'voto',uid:'a',contra:'b'}));
 assert.ok(e.fuera.b,'con Carla fuera quedan dos: el voto de Ana basta');
 e=M.reducir(sala({t:'echa',uid:'a',a:'c'},{t:'voto',uid:'c',contra:'b'}));assert.ok(!e.fuera.b,'el voto de Carla (echada) no cuenta');
 // la votación de todos los juegos: con 3, hacen falta los otros dos
 e=M.reducir(sala({t:'voto',uid:'b',contra:'a'}));assert.ok(!e.fuera.a,'falta un voto');assert.equal(J(e.votos),J({a:['b']}));
 e=M.reducir(sala({t:'voto',uid:'b',contra:'a'},{t:'voto',uid:'c',contra:'a'}));
 assert.ok(e.fuera.a,'los otros dos votaron');assert.equal(e.anfitrion,'b','manda el siguiente');
 assert.equal(J(e.hist.find(h=>h.uid==='a')),J({e:'expulsado',uid:'a'}));
 // en la pantalla: el ⏏ de Mario Kart con 3 o más, el botón «Echar» del anfitrión y el aviso al juego
 const main=fs.readFileSync(raiz('src/juegos-main.js'),'utf8'),mk=fs.readFileSync(raiz('src/juegos/mkw.js'),'utf8');
 assert.match(main,/enMkw \? juego && !datosFin\(p, est\) && !fuera\.has\(yo\) && activos\.length >= 3/,'la votación con 3 o más pilotos');
 // (M21: «Echar» va en el menú «⋯» de cada piloto, para el anfitrión, en el vestíbulo y en la tira de la carrera)
 assert.match(mk,/if \(!\(manda && j\.uid !== uid\)\) return "";/,'el «⋯» solo para el anfitrión y en las filas de los otros');
 assert.match(mk,/<button type="button" class="jg-mkw-echa" role="menuitem" data-e="\$\{u\}"/,'el anfitrión tiene «Echar» en cada fila (también con la copa andando)');
 assert.match(mk,/const ficha = j => .*\$\{menuDe\(j\)\}/,'en la tira de la carrera también');
 assert.match(mk,/anota\(\{ t: "echa", uid, a: b\.dataset\.e \}\)/);
 assert.match(mk,/enviar\("fuera", \{ uids: salieron \}\)/,'el marco sabe quién salió (la carrera lo corta ya)');
});

test('M22 «Modo consola»: inmersivo solo al empezar, la precarga con el estado de cada piloto, la tira con la fase real y solo PC',()=>{
 const main=fs.readFileSync(raiz('src/juegos-main.js'),'utf8'),mk=fs.readFileSync(raiz('src/juegos/mkw.js'),'utf8');
 // el sitio le presta su modo inmersivo al módulo; Mario Kart lo pone al cargar el marco (una vez por copa) y lo saca al volver
 assert.match(main,/inmersivo: si => ponInmersivo\(si\)/);
 // (opcional y apagado por omisión: «Pantalla completa al empezar», de cada uno en su navegador)
 assert.match(mk,/if \(inmersivo && inmPref && inmAuto !== est\.ronda\) \{ inmAuto = est\.ronda; try \{ inmersivo\(true\); \} catch \{\} \}/);
 assert.match(mk,/let inmPref = \(\(\) => \{ try \{ return localStorage\.getItem\(CLAVE_INM\) === "1"; \} catch \{ return false; \} \}\)\(\);/);
 assert.match(mk,/class="jg2-inm" data-inm data-foco="inm" aria-pressed="\$\{inmPref\}"/);
 assert.match(mk,/html\.jg-inm:has\(\.jg-mkw-marco:not\(\[hidden\]\)\) \.jg-cab,html\.jg-inm:has\(\.jg-mkw-marco:not\(\[hidden\]\)\) \.jg-chat-abre\{backdrop-filter:none/,'nada difuminado encima del juego');
 assert.match(mk,/if \(inmAuto !== null\) \{ inmAuto = null; try \{ inmersivo\?\.\(false\); \} catch \{\} \}/);
 assert.match(mk,/html\.jg-inm \.jg-mkw-marco\{height:calc\(100dvh - 84px\)/,'el marco llena la pantalla en inmersivo');
 // la precarga: un marco escondido con precarga=1, su token, y lo que lleva cada uno en su presencia («~40», «~listo»)
 assert.match(mk,/new URLSearchParams\(\{ precarga: "1", senal: "padre", privado: origen \}\)/);
 assert.match(mk,/marcoPre && e\.source === marcoPre\.contentWindow && e\.origin === location\.origin && e\.data\?\.canal === HIJO/,'solo los mensajes de ESE marco');
 assert.match(mk,/senal\.entra\("~" \+ t\)/,'la presencia lleva «~»: la malla del juego no la toma por una sesión');
 // §99: el TURN del Worker (el de BT3) va al marco apenas la sala del juego escucha
 assert.match(mk,/import \{ revisaBt3, relevoBt3 \} from "\.\/bt3-amigos\.js";/);
 assert.match(mk,/relevoBt3\(\)\.then\(ice => \{ if \(!muerto && frame\?\.contentWindow === w && ice\.length\) enviar\("turn", \{ iceServers: ice \}\); \}/);
 assert.match(mk,/● listo/);assert.match(mk,/⬇ \$\{escapeHtml\(t\)\} %/);
 // la tira dice la fase que manda el marco (antes, un texto fijo toda la copa); «Terminar la copa» pregunta
 assert.match(mk,/d\.tipo === "fase" && typeof d\.fase === "string"/);
 assert.match(mk,/function notaFase\(manda, estilo\)/);
 assert.match(mk,/confirm\("¿Terminar la copa para todos\?/);
 // al echado no se le arma la caja de invitar, y el sitio no le busca el botón «Copiar» (se cortaba la actualización)
 assert.match(main,/if \(p\.juego === "mkw" && est\.fuera && est\.fuera\[state\.user\.uid\]\) return "";/);
 assert.match(main,/if \(!est\.listos && \$\("jgCopiar"\)\)/);
 // solo PC (celulares fuera del lanzamiento): ni táctil en los controles ni Android en «Qué hace falta»
 const datos=fs.readFileSync(raiz('src/juegos/controles-datos.js'),'utf8'),reg=fs.readFileSync(raiz('src/juegos/reglas.js'),'utf8');
 assert.match(datos,/"mkw": \{"movil":false,"pc":true,"pide":"teclado o mando"/);
 assert.ok(!/Chrome en Android \(el juego usa WebGPU\)/.test(reg),'sin Android en Mario Kart');
});
