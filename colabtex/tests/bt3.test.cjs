/* Budokai Tenkaichi 3: el vestíbulo de la sala (redBt3), la palabra de reglas que espera gs/net.c, y que el
   juego esté en las tablas que un juego de sala necesita (logros, niveles, peso, marco, reglas de Firebase). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const raiz=f=>path.join(__dirname,'..',f);
const sin=f=>fs.readFileSync(raiz(f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={crypto:require('node:crypto').webcrypto,TextEncoder};vm.createContext(ctx);
vm.runInContext(sin('src/juegos/motor.js')+'\n'+sin('src/juegos/logros.js')+'\n'+sin('src/juegos/tienda.js')+'\n'+sin('src/juegos/cortes.js')+'\n'+sin('src/juegos/monedas.js')+
 ';globalThis.__B={reducir,reglasBt3,esCpuBt3,JUEGOS,LOGROS,NIVEL,PESO,detecta,BT3_TIEMPOS};',ctx);
const B=ctx.__B;

// Una sala de dos (a la abrió) con estas jugadas en orden.
const sala=(...js)=>({juego:'bt3',anfitrion:'a',estado:'jugando',cupo:2,semilla:1,
 jugadores:{a:{nombre:'Ana',orden:0},b:{nombre:'Beto',orden:1}},
 jugadas:Object.fromEntries(js.map((j,i)=>[String(i).padStart(4,'0'),j]))});

test('la palabra de reglas es la de gs/net.c',()=>{
 assert.equal(B.reglasBt3('single',240),3<<8,'single, 240 s: el valor por defecto del juego');
 assert.equal(B.reglasBt3('team',60),1);
 assert.equal(B.reglasBt3('dp15',0),2|1<<4|4<<8);
 assert.equal(B.reglasBt3('dp20',90),2|2<<4|1<<8);
 assert.equal(B.reglasBt3('cualquiera',7),3<<8,'lo que no existe vuelve al valor por defecto');
});

test('cualquiera de los dos elige al anfitrión, y solo el anfitrión pone las reglas',()=>{
 let e=B.reducir(sala());
 assert.equal(e.fase,'vestibulo');assert.equal(e.anfitrion,'a','empieza siendo quien abrió la sala');
 e=B.reducir(sala({t:'anfitrion',uid:'a',a:'b'}));assert.equal(e.anfitrion,'b','el anfitrión le pasa el puesto al otro');
 e=B.reducir(sala({t:'anfitrion',uid:'b',a:'b'}));assert.equal(e.anfitrion,'b','el otro también puede pedirlo');
 e=B.reducir(sala({t:'ajuste',uid:'b',k:'batalla',v:'team'}));assert.equal(e.batalla,'single','b no es anfitrión: no cuenta');
 e=B.reducir(sala({t:'anfitrion',uid:'b',a:'b'},{t:'ajuste',uid:'b',k:'batalla',v:'dp10'},{t:'ajuste',uid:'b',k:'tiempo',v:60}));
 assert.equal(e.batalla,'dp10');assert.equal(e.tiempo,60);assert.equal(e.reglas,B.reglasBt3('dp10',60));
 e=B.reducir(sala({t:'anfitrion',uid:'a',a:'intruso'}));assert.equal(e.anfitrion,'a','solo a uno de los jugadores');
});

test('empezar pide al anfitrión y las dos ISO; volver deja todo listo para la revancha',()=>{
 let e=B.reducir(sala({t:'disco',uid:'a'},{t:'empieza',uid:'a'}));
 assert.equal(e.fase,'vestibulo','falta la ISO de b');
 e=B.reducir(sala({t:'disco',uid:'a'},{t:'disco',uid:'b'},{t:'empieza',uid:'b'}));
 assert.equal(e.fase,'vestibulo','b no es el anfitrión');
 const pelea=[{t:'disco',uid:'a'},{t:'disco',uid:'b'},{t:'empieza',uid:'a'}];
 e=B.reducir(sala(...pelea));
 assert.equal(e.fase,'jugando');assert.equal(e.ronda,1);
 e=B.reducir(sala(...pelea,{t:'anfitrion',uid:'b',a:'b'}));assert.equal(e.anfitrion,'a','en plena pelea no se cambia');
 e=B.reducir(sala(...pelea,{t:'vuelve',uid:'b'}));
 assert.equal(e.fase,'vestibulo');assert.deepEqual({...e.discos},{},'los marcos se recargan: las ISO se confirman de nuevo');
 e=B.reducir(sala(...pelea,{t:'vuelve',uid:'b'},...pelea));assert.equal(e.ronda,2);
});

test('si alguien se va la sala termina; con peleas jugadas, gana el que se quedó',()=>{
 let e=B.reducir(sala({t:'abandona',uid:'b'}));
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'','sin peleas no hay ganador');
 e=B.reducir(sala({t:'disco',uid:'a'},{t:'disco',uid:'b'},{t:'empieza',uid:'a'},{t:'abandona',uid:'a'}));
 assert.equal(e.fase,'fin');assert.equal(e.ganador,'b');assert.equal(e.motivo,'abandono');assert.equal(e.anfitrion,'b');
});

test('diez logros propios, todos de partida, con su nivel; y su peso',()=>{
 assert.equal(B.LOGROS.bt3.length,10);
 assert.ok(!B.LOGROS.bt3.some(x=>x.f),'no lleva los de la fila: la sala no clasifica');
 assert.equal(B.NIVEL.bt3.length,10);assert.match(B.NIVEL.bt3,/^[1-4]+$/);
 assert.ok(B.PESO.bt3>=1);
 const p=sala({t:'disco',uid:'a'},{t:'disco',uid:'b'},{t:'ajuste',uid:'a',k:'batalla',v:'team'},{t:'ajuste',uid:'a',k:'tiempo',v:60},{t:'empieza',uid:'a'});
 const e=B.reducir(p);
 assert.deepEqual([...B.detecta(p,e,'a')].sort(),['anfitrion','equipo','primera','relampago']);
 assert.deepEqual([...B.detecta(p,e,'b')].sort(),['equipo','primera','relampago','visita']);
});

test('está en las reglas de Firebase, en el marco de campeón y en el salón',()=>{
 const reglas=JSON.parse(fs.readFileSync(raiz('../firebase/database.rules.json'),'utf8'));
 assert.match(JSON.stringify(reglas.rules.partidas),/'bt3'/,'falta en la lista del campo juego');
 assert.ok(new RegExp(reglas.rules.logros.$juego['.validate'].match(/matches\(\/(.*)\/\)/)[1]).test('bt3'),'falta en la regla de logros');
 assert.match(fs.readFileSync(raiz('src/juegos/perfil-tarjeta.js'),'utf8'),/\["tbt3", "bt3",/);
 assert.match(fs.readFileSync(raiz('src/juegos/marcos-animados.js'),'utf8'),/tbt3: bt3/);
 assert.match(fs.readFileSync(raiz('src/juegos/salon-datos.js'),'utf8'),/bt3: "Pelea"/);
});

// ---------- el torneo ----------
const torneo=(n,...js)=>({juego:'bt3',anfitrion:'u0',estado:'jugando',cupo:8,semilla:3,
 jugadores:Object.fromEntries(Array.from({length:n},(_,i)=>['u'+i,{nombre:'J'+i,orden:i}])),
 jugadas:Object.fromEntries(js.map((j,i)=>[String(i).padStart(4,'0'),j]))});
// Juega la pelea actual del estado `e` con el ganador que diga `quien(m)`, y devuelve las jugadas.
const pelea=(m,g)=>[{t:'disco',uid:m.a},{t:'disco',uid:m.b},{t:'empieza',uid:m.a,m:m.id},{t:'resultado',uid:m.a,m:m.id,g},{t:'resultado',uid:m.b,m:m.id,g}];

test('torneo: lo empieza el organizador con 3 o más; la llave tiene byes y todos son distintos',()=>{
 assert.equal(B.reducir(torneo(2,{t:'torneo',uid:'u0'})).fase,'vestibulo','con 2 no hay torneo');
 assert.equal(B.reducir(torneo(5,{t:'torneo',uid:'u1'})).fase,'vestibulo','u1 no organiza');
 const e=B.reducir(torneo(5,{t:'torneo',uid:'u0'}));
 assert.equal(e.fase,'torneo');assert.equal(e.llave.length,3,'5 jugadores: llave de 8, tres rondas');
 const primera=e.llave[0].flatMap(m=>[m.a,m.b]).filter(Boolean);
 assert.deepEqual([...primera].sort(),['u0','u1','u2','u3','u4']);
 assert.equal(e.llave[0].filter(m=>m.b==='').length,3,'tres pasan directo');
 assert.ok(e.actual&&e.actual.a&&e.actual.b,'hay una pelea esperando');
 assert.deepEqual(JSON.stringify(B.reducir(torneo(5,{t:'torneo',uid:'u0'})).llave),JSON.stringify(e.llave),'la misma semilla, la misma llave');
});

test('torneo completo de 8: siete peleas y un campeón, con los resultados que cuentan los dos marcos',()=>{
 const js=[{t:'torneo',uid:'u0'}];let e=B.reducir(torneo(8,...js)),n=0;
 while(e.fase==='torneo'&&n<20){const m=e.actual;js.push(...pelea(m,m.b));e=B.reducir(torneo(8,...js));n++;}
 assert.equal(n,7);assert.equal(e.fase,'fin');assert.equal(e.motivo,'torneo');assert.ok(e.ganador);
 assert.equal(e.ronda,7,'cada pelea cuenta como una ronda para los logros');
});

test('torneo: si no coinciden decide el organizador; un empate se vuelve a pelear; sin los dos discos no empieza',()=>{
 let js=[{t:'torneo',uid:'u0'}],e=B.reducir(torneo(4,...js));const m=e.actual;
 e=B.reducir(torneo(4,...js,{t:'disco',uid:m.a},{t:'empieza',uid:m.a,m:m.id}));assert.equal(e.actual.enCurso,false,'falta un disco');
 js.push({t:'disco',uid:m.a},{t:'disco',uid:m.b},{t:'empieza',uid:m.b,m:m.id},{t:'resultado',uid:m.a,m:m.id,g:m.a},{t:'resultado',uid:m.b,m:m.id,g:m.b});
 e=B.reducir(torneo(4,...js));assert.equal(e.actual.id,m.id);assert.equal(e.actual.conflicto,true);
 assert.equal(B.reducir(torneo(4,...js,{t:'decide',uid:'u1',m:m.id,g:m.a})).actual.id,m.id,'u1 no organiza: su decisión no cuenta');
 e=B.reducir(torneo(4,...js,{t:'decide',uid:'u0',m:m.id,g:m.b}));assert.notEqual(e.actual.id,m.id,'decidió: pasa a la siguiente');
 assert.equal(e.llave[0].find(x=>x.id===m.id).g,m.b);
 const emp=[{t:'torneo',uid:'u0'},{t:'disco',uid:m.a},{t:'disco',uid:m.b},{t:'empieza',uid:m.a,m:m.id},{t:'resultado',uid:m.a,m:m.id,g:'empate'},{t:'resultado',uid:m.b,m:m.id,g:'empate'}];
 e=B.reducir(torneo(4,...emp));assert.equal(e.actual.id,m.id);assert.equal(e.actual.enCurso,false,'empate: la misma pelea otra vez');
 assert.equal(e.discos[m.a],false,'sus marcos se recargan: los discos se confirman de nuevo');
});

test('torneo: quien se va pierde su pelea en curso y las que le tocaban',()=>{
 let js=[{t:'torneo',uid:'u0'}],e=B.reducir(torneo(4,...js));const m=e.actual;
 js.push({t:'disco',uid:m.a},{t:'disco',uid:m.b},{t:'empieza',uid:m.a,m:m.id},{t:'abandona',uid:m.a});
 e=B.reducir(torneo(4,...js));assert.equal(e.llave[0].find(x=>x.id===m.id).g,m.b,'gana el que se quedó');
 assert.notEqual(e.fase,'fin','el torneo sigue');
 const resto=[...js];while(e.fase==='torneo'){const x=e.actual;resto.push(...pelea(x,x.a));e=B.reducir(torneo(4,...resto));}
 assert.equal(e.fase,'fin');assert.notEqual(e.ganador,m.a);
});

test('duelo: al terminar cada pelea vuelven solos al vestíbulo; el marcador cuenta las que los dos marcos dicen igual',()=>{
 const base=[{t:'disco',uid:'a'},{t:'disco',uid:'b'},{t:'empieza',uid:'a'}];
 const r=(n,ga,gb)=>[{t:'resultado',uid:'a',n,b:0,g:ga},{t:'resultado',uid:'b',n,b:0,g:gb}];
 let e=B.reducir(sala(...base,{t:'resultado',uid:'a',n:1,b:0,g:'a'}));
 assert.equal(e.fase,'jugando','con un solo marco no se cierra');
 e=B.reducir(sala(...base,...r(1,'a','a')));
 assert.equal(e.fase,'vestibulo','los dos lo dijeron: de vuelta al vestíbulo');assert.deepEqual({...e.discos},{},'los discos se piden de nuevo');
 e=B.reducir(sala(...base,...r(1,'a','a'),...base,...r(2,'b','a'),...base,...r(3,'empate','empate')));
 assert.deepEqual({...e.marcador},{a:1},'la segunda no cuenta: no coinciden');assert.equal(e.empates,1);
 assert.equal(e.ronda,3);assert.equal(e.fase,'vestibulo');
 e=B.reducir(sala(...base,...r(1,'a','a'),{t:'resultado',uid:'a',n:1,b:1,g:'b'}));
 assert.deepEqual({...e.marcador},{a:1},'un resultado tardío de la pelea ya cerrada no cuenta');
});

test('duelo: la revancha la confirman los dos y empieza sola cuando cargan los discos',()=>{
 const pelea=[{t:'disco',uid:'a'},{t:'disco',uid:'b'},{t:'empieza',uid:'a'},{t:'resultado',uid:'a',n:1,b:0,g:'a'},{t:'resultado',uid:'b',n:1,b:0,g:'a'}];
 let e=B.reducir(sala({t:'revancha',uid:'a'}));assert.deepEqual({...e.revancha},{},'sin una pelea antes no hay revancha');
 e=B.reducir(sala(...pelea,{t:'revancha',uid:'b'}));
 assert.equal(e.fase,'vestibulo');assert.deepEqual({...e.revancha},{b:true},'falta que confirme a');
 e=B.reducir(sala(...pelea,{t:'revancha',uid:'b'},{t:'revancha',uid:'a'}));
 assert.equal(e.fase,'vestibulo','los dos dijeron que sí, pero faltan los discos');
 e=B.reducir(sala(...pelea,{t:'revancha',uid:'b'},{t:'revancha',uid:'a'},{t:'disco',uid:'a'},{t:'disco',uid:'b'}));
 assert.equal(e.fase,'jugando','empieza sola');assert.equal(e.ronda,2);assert.deepEqual({...e.revancha},{});
 e=B.reducir(sala(...pelea,{t:'revancha',uid:'b'},{t:'revancha',uid:'b',no:true},{t:'revancha',uid:'a'},{t:'disco',uid:'a'},{t:'disco',uid:'b'}));
 assert.equal(e.fase,'vestibulo','b se arrepintió');
 e=B.reducir(sala(...pelea,{t:'revancha',uid:'b'},{t:'ajuste',uid:'a',k:'tiempo',v:60},{t:'revancha',uid:'a'},{t:'disco',uid:'a'},{t:'disco',uid:'b'}));
 assert.equal(e.fase,'vestibulo','cambiaron las reglas: b tiene que confirmar de nuevo');
});

test('torneo: el organizador saca a alguien (antes o durante); nadie más puede',()=>{
 let e=B.reducir(torneo(4,{t:'echa',uid:'u1',a:'u2'}));
 assert.ok(!e.fuera.u2,'solo el organizador saca');
 e=B.reducir(torneo(4,{t:'echa',uid:'u0',a:'u0'}));assert.ok(!e.fuera.u0,'no se saca a sí mismo');
 e=B.reducir(torneo(4,{t:'echa',uid:'u0',a:'u3'},{t:'torneo',uid:'u0'}));
 assert.ok(e.fuera.u3);assert.equal(e.llave[0].flatMap(m=>[m.a,m.b]).filter(Boolean).length,3,'antes de empezar: no entra a la llave');
 e=B.reducir(torneo(4,{t:'torneo',uid:'u0'}));
 const m=e.actual,saca=m.a===('u0')?m.b:m.a;
 e=B.reducir(torneo(4,{t:'torneo',uid:'u0'},{t:'disco',uid:m.a},{t:'disco',uid:m.b},{t:'empieza',uid:m.a,m:m.id},{t:'echa',uid:'u0',a:saca}));
 assert.ok(e.fuera[saca]);assert.notEqual(e.llave[0].find(x=>x.id===m.id).g,saca,'pierde la pelea en curso');
 assert.ok(e.hist.some(h=>h.e==='echado'&&h.uid===saca));
});

test('torneo con CPU: rellenar, niveles, CPU contra CPU se decide sola, contra la CPU decide un solo marco',()=>{
 // dos humanos + dos CPU (una fácil, una difícil)
 const base=[{t:'cpu',uid:'u0',id:'cpu:1',nivel:0},{t:'cpu',uid:'u0',id:'cpu:2',nivel:4}];
 let e=B.reducir(torneo(2,...base,{t:'cpu',uid:'u1',id:'cpu:3',nivel:2}));
 assert.deepEqual(Object.keys(e.cpus).sort(),['cpu:1','cpu:2'],'solo el organizador pone CPU');
 e=B.reducir(torneo(2,...base,{t:'cpu',uid:'u0',id:'cpu:1',nivel:3}));assert.equal(e.cpus['cpu:1'].nivel,3,'cambia el nivel');
 e=B.reducir(torneo(2,...base,{t:'cpu',uid:'u0',id:'cpu:2',quita:true}));assert.deepEqual(Object.keys(e.cpus),['cpu:1']);
 e=B.reducir(torneo(2,...base,{t:'torneo',uid:'u0'}));
 assert.equal(e.fase,'torneo','2 humanos + 2 CPU = 4');
 const todos=e.llave[0].flatMap(m=>[m.a,m.b]);assert.equal(todos.filter(B.esCpuBt3).length,2);
 // jugar hasta el final: contra la CPU basta el resultado del humano
 const js=[...base,{t:'torneo',uid:'u0'}];
 for(let i=0;i<5&&e.fase==='torneo';i++){
  const m=e.actual;assert.ok(!(B.esCpuBt3(m.a)&&B.esCpuBt3(m.b)),'CPU contra CPU no espera a nadie');
  const h=[m.a,m.b].filter(u=>!B.esCpuBt3(u));
  js.push(...h.map(u=>({t:'disco',uid:u})),{t:'empieza',uid:h[0],m:m.id},{t:'resultado',uid:h[0],m:m.id,g:h[0]});
  if(h.length===2)js.push({t:'resultado',uid:h[1],m:m.id,g:h[0]});
  e=B.reducir(torneo(2,...js));
 }
 assert.equal(e.fase,'fin');assert.ok(!B.esCpuBt3(e.ganador),'ganó un humano (cada humano ganó sus peleas)');
});

test('torneo: CPU contra CPU es igual en todas las pantallas; volver al menú corta la pelea sin decidirla',()=>{
 const base=[{t:'cpu',uid:'u0',id:'cpu:1',nivel:1},{t:'cpu',uid:'u0',id:'cpu:2',nivel:1},{t:'cpu',uid:'u0',id:'cpu:3',nivel:3},{t:'torneo',uid:'u0'}];
 const a=B.reducir(torneo(1,...base)),b=B.reducir(torneo(1,...base));
 assert.deepEqual(a.llave,b.llave);
 let e=a;const m=e.actual;const h=[m.a,m.b].find(u=>!B.esCpuBt3(u));
 e=B.reducir(torneo(1,...base,{t:'disco',uid:h},{t:'empieza',uid:h,m:m.id},{t:'vuelve',uid:h,m:m.id}));
 assert.equal(e.actual.id,m.id);assert.equal(e.actual.enCurso,false);assert.ok(!e.discos[h],'el disco se vuelve a cargar');
 assert.equal(B.reglasBt3('team3',240)>>12,3,'3 vs 3: tope de tres en los bits altos');assert.equal(B.reglasBt3('team3',240)&15,1,'es un Team Battle');
});

// Las reglas de personajes (bt3-tiers.js): el nombre y la forma que trae el disco contra la tier list.
const T=(()=>{const c={};vm.createContext(c);vm.runInContext(sin('src/juegos/bt3-tiers.js')+';globalThis.__T={BT3_TIERS,palabrasBt3,vetadosBt3,catalogoBt3,tiersVetadas};',c);return c.__T;})();
// Un catálogo con los nombres del juego como los escribe (USA): un personaje por forma.
const ROSTER=[["Goku (Early)"],["Goku (Mid)","Super Saiyan"],["Goku (End)","Super Saiyan","Super Saiyan 2","Super Saiyan 3"],["Kid Goku"],["Goku (GT)","Super Saiyan","Super Saiyan 3"],["Super Saiyan 4 Goku"],
 ["Kid Gohan","Super Saiyan"],["Teen Gohan","Super Saiyan","Super Saiyan 2"],["Gohan (Adult)","Super Saiyan","Super Saiyan 2"],["Ultimate Gohan"],["Great Saiyaman"],
 ["Vegeta (Scouter)"],["Vegeta (Early)","Great Ape"],["Vegeta (Mid)","Super Saiyan"],["Vegeta (End)","Super Saiyan","Super Vegeta","Super Saiyan 2"],["Majin Vegeta"],["Super Saiyan 4 Vegeta"],
 ["Trunks (Sword)","Super Saiyan"],["Trunks (Battle Armor)","Super Saiyan","Super Trunks"],["Kid Trunks","Super Saiyan"],["Goten","Super Saiyan"],["Gotenks","Super Saiyan","Super Saiyan 3"],
 ["Vegito","Super Vegito"],["Gogeta","Super Saiyan"],["Super Saiyan 4 Gogeta"],["Piccolo (Early)","Sync with Nail"],["Piccolo (End)","Fused with Kami"],["Nail"],["Mr. Popo"],
 ["Android 13","Super Android 13"],["Android 16"],["Android #17"],["Android 18"],["Super 17"],["Cell","Semi-Perfect Form","Perfect Form","Super Perfect Form"],["Cell Jr."],
 ["Frieza","2nd Form","3rd Form","Final Form","100% Full Power"],["Cooler","Final Form"],["Majin Buu"],["Super Buu","Gotenks Absorbed","Gohan Absorbed"],["Kid Buu"],["Babidi"],["Dabura"],
 ["Burter"],["Guldo"],["Bardock","Great Ape"],["Bojack","Full Power"],["Chiaotzu"],["Ninja Murasaki"],["Majin Buu (Pure Evil)"],["Fasha"],["Mecha Frieza"],["Krillin"],["Recoome"],["Tapion"],["Tien"],["Yamcha"],["Zarbon","Post-Transformation"],["Great Saiyaman 2"],["Hirudegarn"],["Broly","Super Saiyan","Legendary Super Saiyan"],["Arale"],["Baby","Baby Vegeta","Super Baby 1","Super Baby 2","Great Ape Baby"],["Syn Shenron","Omega Shenron"],["Nuova Shenron"],["Uub","Majuub"],["Great Ape"]];
const CATALOGO=ROSTER.flatMap(([n,...f])=>[[n,''],...f.map(x=>[n,x])]).map(([n,f])=>[[...n].map(c=>c.charCodeAt(0)),[...f].map(c=>c.charCodeAt(0))]);

test('reglas de personajes: el anfitrión elige una (No OP o Sólo malos), y queda en el torneo',()=>{
 let e=B.reducir(sala({t:'ajuste',uid:'a',k:'veto',v:'noop'}));assert.equal(e.veto,'noop');
 e=B.reducir(sala({t:'ajuste',uid:'a',k:'veto',v:'noop'},{t:'ajuste',uid:'a',k:'veto',v:'malos'}));assert.equal(e.veto,'malos','una o la otra: la última manda');
 e=B.reducir(sala({t:'ajuste',uid:'b',k:'veto',v:'noop'}));assert.equal(e.veto,'','solo el anfitrión');
 e=B.reducir(sala({t:'ajuste',uid:'a',k:'veto',v:'trampa'}));assert.equal(e.veto,'','lo que no existe es «todos»');
 e=B.reducir(torneo(3,{t:'ajuste',uid:'u0',k:'veto',v:'malos'},{t:'torneo',uid:'u0'},{t:'ajuste',uid:'u0',k:'veto',v:''}));
 assert.equal(e.veto,'malos','con el torneo andando ya no cambia');
 assert.deepEqual([...T.tiersVetadas('noop')],['BROLY','S++','S+','S']);
 assert.deepEqual([...T.tiersVetadas('malos')],['BROLY','S++','S+','S','A','B'],'Sólo malos: de C hacia abajo');
});

test('reglas de personajes: cada entrada de la tier list encuentra exactamente a su personaje en el disco',()=>{
 const cat=T.catalogoBt3(CATALOGO);
 assert.equal(cat[0].nombre,'Goku (Early)','el catálogo llega como códigos de 16 bits');
 const no=T.vetadosBt3(cat,'noop'),ma=T.vetadosBt3(cat,'malos');
 for(const d of ma.detalle)assert.equal(d.juego.length,1,d.nombre+' → '+JSON.stringify(d.juego));
 const nombre=i=>[cat[i].nombre,cat[i].forma].filter(Boolean).join(' · ');
 const nNo=no.ids.map(nombre),nMa=ma.ids.map(nombre);
 for(const x of ['Broly · Legendary Super Saiyan','Cell · Super Perfect Form','Android #17','Super 17','Vegito','Vegito · Super Vegito','Super Saiyan 4 Gogeta','Nuova Shenron'])assert.ok(nNo.includes(x),'No OP deja fuera a '+x);
 for(const x of ['Broly','Broly · Super Saiyan','Cell · Perfect Form','Goku (Early)','Android 13 · Super Android 13','Frieza · Final Form'])assert.ok(!nNo.includes(x),'No OP permite a '+x);
 assert.ok(no.ids.every(i=>ma.ids.includes(i)),'Sólo malos deja fuera todo lo que No OP');
 for(const x of ['Android 13 · Super Android 13','Frieza · 100% Full Power','Super Saiyan 4 Goku','Teen Gohan · Super Saiyan 2','Goku (Mid) · Super Saiyan'])assert.ok(nMa.includes(x),'Sólo malos deja fuera a '+x);
 for(const x of ['Frieza · Final Form','Cell · Perfect Form','Vegeta (End) · Super Vegeta','Teen Gohan','Goku (End) · Super Saiyan 3','Piccolo (Early) · Sync with Nail','Bojack · Full Power','Zarbon · Post-Transformation'])assert.ok(nMa.includes(x),'Sólo malos (de C para abajo) deja fuera también a la B: '+x);
 for(const x of ['Goku (Early)','Kid Buu','Great Ape','Bardock · Great Ape','Piccolo (Early)','Bojack','Zarbon','Great Saiyaman 2','Hirudegarn','Kid Goku','Goten'])assert.ok(!nMa.includes(x),'Sólo malos permite a '+x);
 assert.equal(ma.detalle.length,90,'BROLY..B: los 90 retratos (el dorado de S+ es Nuova Shenron)');
 assert.equal(no.detalle.length,14,'No OP: los 14 de BROLY..S');
 assert.equal(T.vetadosBt3([], 'noop').ids.length,0,'sin catálogo todavía no se sabe a quién: nadie');
 assert.equal(T.vetadosBt3(cat,'').ids.length,0);
});

test('la pelea en vivo manda también el sonido del juego (si hay), en el mismo flujo que el video',async()=>{
 const c={};vm.createContext(c);
 vm.runInContext(sin('src/juegos/bt3-directo.js')+';globalThis.__D={crearEmisor};',c);
 class MS{constructor(t){this.t=t;}}
 c.MediaStream=MS;
 const pcs=[];
 class RTC{constructor(){this.tracks=[];this.signalingState='stable';pcs.push(this);}
  addTrack(t,s){this.tracks.push([t.kind,s]);return{getParameters:()=>({encodings:[{}]}),setParameters:async()=>{}};}
  createOffer(){return Promise.resolve({type:'offer',sdp:'x'});} setLocalDescription(){this.signalingState='have-local-offer';return Promise.resolve();} close(){}}
 const canvas={height:540,captureStream:()=>({getVideoTracks:()=>[{kind:'video',readyState:'live'}]})};
 const hacia=[];let oye=null;
 const senal={envia:(p,m)=>hacia.push(m),alMensajes:f=>{oye=f;return()=>{};}};
 const con=c.__D.crearEmisor({senal,uid:'a',canvas,audio:()=>({kind:'audio'}),RTC});
 await oye('b',{t:'ver',s:'1'});
 assert.deepEqual(pcs[0].tracks.map(x=>x[0]),['video','audio']);
 assert.equal(pcs[0].tracks[0][1],pcs[0].tracks[1][1],'video y sonido van juntos: el visor los recibe en un solo flujo');
 assert.equal(hacia[0].t,'vof');
 con.cierra();
 const sin_=c.__D.crearEmisor({senal,uid:'a',canvas,RTC});
 await oye('c',{t:'ver',s:'2'});
 assert.deepEqual(pcs[1].tracks.map(x=>x[0]),['video'],'sin sonido todavía, igual se ve');
 sin_.cierra();
});

test('la pelea en vivo en árbol: el que pelea manda a uno; los demás la reciben de espectadores que ya la ven (2 cada uno)',async()=>{
 const c={};vm.createContext(c);
 vm.runInContext(sin('src/juegos/bt3-directo.js')+';globalThis.__D={crearEmisor};',c);
 c.MediaStream=class{constructor(t){this.t=t;}};
 class RTC{constructor(){this.signalingState='stable';}addTrack(){return{getParameters:()=>({encodings:[{}]}),setParameters:async()=>{}};}
  createOffer(){return Promise.resolve({type:'offer',sdp:'x'});} setLocalDescription(){return Promise.resolve();} close(){} getSenders(){return[];}}
 const canvas={height:540,captureStream:()=>({getVideoTracks:()=>[{kind:'video',readyState:'live'}]})};
 const a=[];let oye=null;
 const senal={envia:(p,m)=>a.push([p,m]),alMensajes:f=>{oye=f;return()=>{};}};
 const E=c.__D.crearEmisor({senal,uid:'E',canvas,RTC});
 const ultimo=p=>[...a].reverse().find(x=>x[0]===p)[1];
 await oye('A',{t:'ver',s:'a'});assert.equal(ultimo('A').t,'vof','el primero la recibe del que pelea');
 await oye('B',{t:'ver',s:'b'});assert.equal(ultimo('B').t,'vespera','nadie la ve todavía: que espere');
 await oye('A',{t:'vya',s:'a'});
 await oye('B',{t:'ver',s:'b'});assert.deepEqual([ultimo('B').t,ultimo('B').a,ultimo('B').as],['vir','A','a'],'de A');
 await oye('C',{t:'ver',s:'c'});assert.equal(ultimo('C').a,'A','de A también (dos cada uno)');
 await oye('D',{t:'ver',s:'d'});assert.equal(ultimo('D').t,'vespera','A está lleno y B y C no ven todavía');
 await oye('B',{t:'vya',s:'b'});
 await oye('D',{t:'ver',s:'d'});assert.equal(ultimo('D').a,'B');
 assert.equal(E.cuantos(),1,'el que pelea manda a uno solo');
 // se va A: B y C piden de nuevo; B pasa a recibir del que pelea, y C de B (no de su propia rama)
 await oye('A',{t:'vfin',s:'a'});
 assert.equal(ultimo('B').t,'vreve');assert.equal(ultimo('C').t,'vreve');
 await oye('B',{t:'ver',s:'b'});assert.equal(ultimo('B').t,'vof','B queda directo');
 await oye('C',{t:'ver',s:'c'});assert.equal(ultimo('C').a,'B');
 await oye('B',{t:'ver',s:'b',cae:'x|y'});   // (un «cae» de alguien que no está no rompe nada)
 const arbol=E.arbol();
 assert.ok(arbol.every(n=>n.hijos.length<=2));assert.equal(arbol.filter(n=>n.padre==='').length,1);
 assert.ok(!arbol.some(n=>n.k.startsWith('A|')),'A ya no está');
 // D cuelga de B, y si B pidiera colgarse de D sería un ciclo: nunca se le ofrece alguien de su propia rama
 await oye('D',{t:'vya',s:'d'});
 const n=arbol.length;assert.equal(n,3);
 E.cierra();
});

test('un corte de conexión (o alguien que recarga en plena pelea) vuelve a empezar solo; salir al menú no',()=>{
 const base=[{t:'disco',uid:'a'},{t:'disco',uid:'b'},{t:'empieza',uid:'a'}];
 let e=B.reducir(sala(...base,{t:'vuelve',uid:'b',por:'corte'}));
 assert.equal(e.fase,'vestibulo');assert.equal(e.reanudar,true,'se cortó: queda para empezar sola');
 e=B.reducir(sala(...base,{t:'vuelve',uid:'b',por:'corte'},{t:'disco',uid:'a'}));assert.equal(e.fase,'vestibulo','falta el otro disco');
 e=B.reducir(sala(...base,{t:'vuelve',uid:'b',por:'corte'},{t:'disco',uid:'a'},{t:'disco',uid:'b'}));
 assert.equal(e.fase,'jugando','con los dos discos empieza sola');assert.equal(e.ronda,2);assert.equal(e.reanudar,false);
 e=B.reducir(sala(...base,{t:'vuelve',uid:'a'},{t:'disco',uid:'a'},{t:'disco',uid:'b'}));
 assert.equal(e.fase,'vestibulo','salir al menú del juego no vuelve a empezar solo');assert.equal(e.reanudar,false);
 // el torneo: la pelea cortada vuelve a empezar sola, sin decidirse
 const t=[{t:'torneo',uid:'u0'}];
 let s=B.reducir(torneo(3,...t));const m=s.actual;const [x,y]=[m.a,m.b];
 const pelea=[...t,{t:'disco',uid:x},{t:'disco',uid:y},{t:'empieza',uid:x,m:m.id}];
 s=B.reducir(torneo(3,...pelea,{t:'vuelve',uid:y,m:m.id,por:'corte'}));
 assert.equal(s.actual.enCurso,false);assert.equal(s.actual.reanudar,true);assert.equal(s.actual.g,undefined,'nadie gana por un corte');
 s=B.reducir(torneo(3,...pelea,{t:'vuelve',uid:y,m:m.id,por:'corte'},{t:'disco',uid:x},{t:'disco',uid:y}));
 assert.equal(s.actual.enCurso,true,'con los dos discos vuelve a empezar sola');assert.equal(s.actual.n,2);
 s=B.reducir(torneo(3,...pelea,{t:'vuelve',uid:y,m:m.id},{t:'disco',uid:x},{t:'disco',uid:y}));
 assert.equal(s.actual.enCurso,false,'cortada desde el menú: hay que empezarla');
});

test('una pelea que se corta una y otra vez deja de volver sola (3 cortes seguidos)',()=>{
 const js=[{t:'disco',uid:'a'},{t:'disco',uid:'b'},{t:'empieza',uid:'a'}];
 for(let i=0;i<3;i++)js.push({t:'vuelve',uid:'b',por:'corte'},{t:'disco',uid:'a'},{t:'disco',uid:'b'});
 let e=B.reducir(sala(...js));assert.equal(e.fase,'jugando','3 cortes: todavía vuelve sola');
 e=B.reducir(sala(...js,{t:'vuelve',uid:'b',por:'corte'},{t:'disco',uid:'a'},{t:'disco',uid:'b'}));
 assert.equal(e.fase,'vestibulo','el cuarto ya no: hay que empezarla a mano');assert.equal(e.reanudar,false);
});

test('duelo: el anfitrión da la victoria (en plena pelea o de la última sin resultado); nadie más puede',()=>{
 const base=[{t:'disco',uid:'a'},{t:'disco',uid:'b'},{t:'empieza',uid:'a'}];
 let e=B.reducir(sala(...base));assert.equal(e.pendiente,true,'la pelea en curso no tiene resultado');
 e=B.reducir(sala(...base,{t:'decide',uid:'b',n:1,g:'b'}));
 assert.equal(e.fase,'jugando','b no es el anfitrión: no cuenta');assert.deepEqual({...e.marcador},{});
 e=B.reducir(sala(...base,{t:'decide',uid:'a',n:1,g:'b'}));
 assert.equal(e.fase,'vestibulo','termina la pelea');assert.deepEqual({...e.marcador},{b:1},'cuenta en el marcador');
 assert.equal(e.pendiente,false);assert.deepEqual({...e.discos},{},'los marcos se recargan');
 e=B.reducir(sala(...base,{t:'decide',uid:'a',n:1,g:'b'},{t:'decide',uid:'a',n:1,g:'a'},{t:'resultado',uid:'a',n:1,b:0,g:'a'},{t:'resultado',uid:'b',n:1,b:0,g:'a'}));
 assert.deepEqual({...e.marcador},{b:1},'una vez dada, ni otra decisión ni los juegos la cambian');
 // después de un corte: la da en vez de esperar que vuelva sola
 e=B.reducir(sala(...base,{t:'vuelve',uid:'b',por:'corte'},{t:'decide',uid:'a',n:1,g:'a'},{t:'disco',uid:'a'},{t:'disco',uid:'b'}));
 assert.equal(e.fase,'vestibulo','ya decidida: no vuelve a empezar sola');assert.equal(e.reanudar,false);assert.deepEqual({...e.marcador},{a:1});
 // una pelea que ya contaron los juegos no se puede dar; tampoco una pelea vieja
 const r=[{t:'resultado',uid:'a',n:1,b:0,g:'a'},{t:'resultado',uid:'b',n:1,b:0,g:'a'}];
 e=B.reducir(sala(...base,...r,{t:'decide',uid:'a',n:1,g:'b'}));
 assert.deepEqual({...e.marcador},{a:1});assert.equal(e.pendiente,false);
 e=B.reducir(sala(...base,{t:'vuelve',uid:'a'},...base,{t:'decide',uid:'a',n:1,g:'b'}));
 assert.deepEqual({...e.marcador},{},'la pelea 1 ya quedó atrás');assert.equal(e.fase,'jugando');
});

test('torneo: el organizador da la victoria antes o durante la pelea; queda marcada como dada',()=>{
 const t=[{t:'torneo',uid:'u0'}];
 let s=B.reducir(torneo(4,...t));const m=s.actual;
 s=B.reducir(torneo(4,...t,{t:'decide',uid:'u0',m:m.id,g:m.b}));
 assert.equal(s.llave[0].find(x=>x.id===m.id).g,m.b,'sin pelearla');
 assert.ok(s.hist.some(h=>h.e==='gana'&&h.m===m.id&&h.mano),'el historial dice que la dio el organizador');
 const pelea=[...t,{t:'disco',uid:m.a},{t:'disco',uid:m.b},{t:'empieza',uid:m.a,m:m.id}];
 s=B.reducir(torneo(4,...pelea,{t:'decide',uid:'u0',m:m.id,g:m.a}));
 assert.equal(s.llave[0].find(x=>x.id===m.id).g,m.a,'en plena pelea');assert.notEqual(s.actual.id,m.id);
 assert.equal(s.discos[m.a],false,'sus marcos se recargan');
 assert.ok(!B.reducir(torneo(4,...pelea,...[{t:'resultado',uid:m.a,m:m.id,g:m.a},{t:'resultado',uid:m.b,m:m.id,g:m.a}])).hist.some(h=>h.mano),'la que cuentan los juegos no lleva la marca');
});

test('la pelea en vivo parte con buen ancho (la respuesta lleva x-google-start-bitrate) y se copia achicada con el aviso de cada cuadro',async()=>{
 const c={};vm.createContext(c);
 vm.runInContext(sin('src/juegos/bt3-directo.js')+';globalThis.__D={crearEmisor,conArranque};',c);
 const sdp=['v=0','m=audio 9 UDP/TLS/RTP/SAVPF 111','a=rtpmap:111 opus/48000/2','a=fmtp:111 minptime=10;useinbandfec=1',
  'm=video 9 UDP/TLS/RTP/SAVPF 96 97 98','a=rtpmap:96 VP8/90000','a=rtpmap:97 rtx/90000','a=fmtp:97 apt=96','a=rtpmap:98 H264/90000','a=fmtp:98 profile-level-id=42e01f',''].join('\r\n');
 const r=c.__D.conArranque(sdp);
 assert.match(r,/a=rtpmap:96 VP8\/90000\r\na=fmtp:96 x-google-start-bitrate=1200;x-google-min-bitrate=400\r\n/,'VP8 sin fmtp: uno nuevo');
 assert.match(r,/a=fmtp:98 profile-level-id=42e01f;x-google-start-bitrate=1200/,'H264: se suma al suyo');
 assert.doesNotMatch(r,/fmtp:97 [^\r]*x-google|fmtp:111 [^\r]*x-google/,'ni el rtx ni el sonido');
 assert.equal(c.__D.conArranque(r),r,'dos veces da lo mismo');
 // con el aviso: una copia de 540 de alto con la forma del juego, como mucho 30 por segundo, y nada sin espectadores
 const pedidos=[];let dibujos=0,cuadro=null,suelto=0;
 const chico={width:0,height:0,getContext:()=>({drawImage:(f,x,y,w,h)=>{dibujos++;pedidos.push([w,h]);}}),captureStream:()=>({getVideoTracks:()=>[{kind:'video',readyState:'live',requestFrame(){}}]})};
 c.document={createElement:()=>chico};let t=0;c.performance={now:()=>t};
 c.MediaStream=class{constructor(x){this.x=x;}};
 class RTC{constructor(){this.signalingState='stable';}addTrack(){return{getParameters:()=>({encodings:[{}]}),setParameters:async()=>{}};}
  createOffer(){return Promise.resolve({type:'offer',sdp:'x'});} setLocalDescription(){return Promise.resolve();} close(){} getSenders(){return[];}}
 const canvas={width:1920,height:1080,captureStream:()=>{throw new Error('no debe capturar el lienzo grande');}};
 let oye=null;const senal={envia:()=>{},alMensajes:f=>{oye=f;return()=>{};}};
 const E=c.__D.crearEmisor({senal,uid:'E',canvas,RTC,alCuadro:f=>{cuadro=f;return()=>{suelto++;cuadro=null;};}});
 assert.equal(cuadro,null,'sin nadie mirando no se copia nada');
 await oye('A',{t:'ver',s:'a'});
 for(let i=0;i<60;i++){t=i*1000/60;cuadro();}   // un segundo a 60 cuadros
 assert.ok(dibujos>=28&&dibujos<=31,'unos 30 por segundo: '+dibujos);
 assert.deepEqual(pedidos[0],[960,540]);
 E.cierra();assert.equal(suelto,1,'al cerrar deja de copiar');
});

test('los nombres del disco se leen como el juego (UTF-16, byte bajo primero) y una lista vieja al revés se corrige',()=>{
 // la función del programa compilado (EM_JS del parche), sobre una memoria armada como el texto del disco
 const js=fs.readFileSync(raiz('../juegos/bt3/bt3-jspi.js'),'utf8');
 const fuente=/function web_catalogo\(nombres,formas\)\{[\s\S]*?\n?\}(?=\s*web_catalogo\.sig)/.exec(js);
 assert.ok(fuente,'el programa trae web_catalogo');
 const archivo=lineas=>{   // palabra n+1 = desplazamiento de la línea n; texto UTF-16LE terminado en 0
  const cab=4*(lineas.length+1),partes=[];let off=cab;const offs=[];
  for(const l of lineas){offs.push(off);const b=Buffer.alloc((l.length+1)*2);for(let i=0;i<l.length;i++)b.writeUInt16LE(l.charCodeAt(i),2*i);partes.push(b);off+=b.length;off=(off+3)&~3;partes.push(Buffer.alloc(((off-(offs.at(-1)+b.length))))) ;}
  const h=Buffer.alloc(cab);h.writeUInt32LE(lineas.length,0);offs.forEach((o,i)=>h.writeUInt32LE(o,4*(i+1)));
  return Buffer.concat([h,...partes]);
 };
 const nombres=Array.from({length:161},(_,i)=>i===2?'Goku (End)':i===0?'Goku (Early)':'X'+i),formas=Array.from({length:161},(_,i)=>i===2?'Super Saiyan 3':'');
 const a=archivo(nombres),b=archivo(formas),mem=new Uint8Array(64+a.length+b.length);mem.set(a,16);mem.set(b,32+a.length);
 let lista=null;const ctx={HEAPU8:mem,Module:{onCatalogo:l=>{lista=l;}},console};vm.createContext(ctx);
 vm.runInContext(fuente[0]+';web_catalogo(16,'+(32+a.length)+');',ctx);
 assert.equal(lista[2][0][0],'G'.charCodeAt(0),'el programa da «G» como 0x47, no 0x4700');
 const cat=T.catalogoBt3(lista);
 assert.deepEqual([cat[2].nombre,cat[2].forma,cat[0].nombre],['Goku (End)','Super Saiyan 3','Goku (Early)']);
 // una lista guardada por bt3-12 o antes (cada carácter con los bytes dados vuelta) se lee igual
 const vuelta=JSON.parse(JSON.stringify(lista),(k,v)=>typeof v==='number'?((v&0xFF)<<8|v>>8):v);
 const cat2=T.catalogoBt3(vuelta);
 assert.deepEqual([cat2[2].nombre,cat2[2].forma],['Goku (End)','Super Saiyan 3']);
 // y con la tier list: la lista al revés veta lo mismo que la buena
 const alReves=CATALOGO.map(e=>e.map(a=>a.map(v=>(v&0xFF)<<8|v>>8)));
 assert.deepEqual(T.vetadosBt3(T.catalogoBt3(alReves),'noop').ids,T.vetadosBt3(T.catalogoBt3(CATALOGO),'noop').ids);
 assert.ok(T.vetadosBt3(T.catalogoBt3(alReves),'noop').ids.length>10);
});

test('torneo: el organizador arma la llave antes de empezar (arrastrando o mezclando) y empieza con esa',()=>{
 const J=x=>JSON.stringify(x);
 let e=B.reducir(torneo(5));
 assert.equal(e.previa.length,8,'5 peleadores: llave de 8');
 assert.equal(e.previa.filter(Boolean).length,5);
 for(let k=0;k<8;k+=2)assert.ok(e.previa[k]||e.previa[k+1],'ninguna pelea sin nadie');
 const sorteo=J(e.previa);
 const vacia=['u4','u0','u1','u2','u3','','',''];   // la última pelea sin nadie: no vale
 assert.equal(J(B.reducir(torneo(5,{t:'orden',uid:'u0',lista:vacia})).previa),sorteo,'una pelea sin nadie: queda la del sorteo');
 const valida=['u4','u0','u1','','u2','','u3',''];
 assert.equal(J(B.reducir(torneo(5,{t:'orden',uid:'u1',lista:valida})).previa),sorteo,'solo el organizador');
 assert.equal(J(B.reducir(torneo(5,{t:'orden',uid:'u0',lista:valida})).previa),J(valida));
 e=B.reducir(torneo(5,{t:'orden',uid:'u0',lista:valida},{t:'torneo',uid:'u0'}));
 assert.equal(J(e.llave[0].map(m=>[m.a,m.b])),J([['u4','u0'],['u1',''],['u2',''],['u3','']]),'empieza con esa llave');
 assert.equal(e.previa,null);
 assert.equal(e.actual.id,'0.0','la primera pelea es la que armó');
 // alguien se va antes de empezar y la llave sigue siendo de 8: su lugar queda libre y lo demás se mantiene
 const seis=['u4','u0','u1','u5','u2','','u3',''];
 const sin=B.reducir(torneo(6,{t:'orden',uid:'u0',lista:seis},{t:'abandona',uid:'u5'}));
 assert.equal(J(sin.previa),J(['u4','u0','u1','','u2','','u3','']));
 // si la llave cambia de tamaño (de 5 a 4: de 8 lugares a 4), se vuelve a sortear
 assert.equal(B.reducir(torneo(5,{t:'orden',uid:'u0',lista:valida},{t:'abandona',uid:'u2'})).previa.length,4);
 // una CPU que se agrega después ocupa un lugar libre
 const cpu=B.reducir(torneo(5,{t:'orden',uid:'u0',lista:valida},{t:'cpu',uid:'u0',id:'cpu:1',nivel:2}));
 assert.ok(cpu.previa.includes('cpu:1')&&cpu.previa.length===8);
});

test('una pelea que terminó con un solo aviso del ganador cuenta (la sesión del otro se cerró antes de que avisara)',()=>{
 const base=[{t:'disco',uid:'a'},{t:'disco',uid:'b'},{t:'empieza',uid:'a'}];
 let e=B.reducir(sala(...base,{t:'resultado',uid:'a',n:1,b:0,g:'b'},{t:'vuelve',uid:'b',por:'corte'}));
 assert.deepEqual({...e.marcador},{b:1},'lo que dijo un juego vale');
 assert.equal(e.reanudar,false,'y no vuelve a empezar sola');assert.equal(e.pendiente,false);
 // el aviso del otro, tarde (la sala ya en el vestíbulo): no cuenta dos veces
 e=B.reducir(sala(...base,{t:'resultado',uid:'a',n:1,b:0,g:'b'},{t:'vuelve',uid:'b',por:'corte'},{t:'resultado',uid:'b',n:1,b:0,g:'b'}));
 assert.deepEqual({...e.marcador},{b:1});
 // un corte sin ningún aviso: sigue siendo un corte (vuelve a empezar sola)
 e=B.reducir(sala(...base,{t:'vuelve',uid:'b',por:'corte'}));
 assert.equal(e.reanudar,true);assert.equal(e.pendiente,true);
 // y un aviso que llega después de ese corte: la pelea ya terminó en ese juego, cuenta
 e=B.reducir(sala(...base,{t:'vuelve',uid:'b',por:'corte'},{t:'resultado',uid:'a',n:1,b:0,g:'a'}));
 assert.deepEqual({...e.marcador},{a:1});assert.equal(e.reanudar,false);
 // el torneo igual: un aviso y después el corte
 const t=[{t:'torneo',uid:'u0'}];let s=B.reducir(torneo(4,...t));const m=s.actual;
 s=B.reducir(torneo(4,...t,{t:'disco',uid:m.a},{t:'disco',uid:m.b},{t:'empieza',uid:m.a,m:m.id},{t:'resultado',uid:m.a,m:m.id,g:m.b},{t:'vuelve',uid:m.b,m:m.id,por:'corte'}));
 assert.equal(s.llave[0].find(x=>x.id===m.id).g,m.b);
});

/* BT3 es privado: a quien no está en la lista de amigos del Worker no se le muestra ni nombra. Estas son las puertas;
   si una vista nueva lista juegos, tiene que pasar por bt3Visible() o juegoOculto(). */
test('BT3 oculto por omisión, y cada vista que nombra juegos lo respeta',()=>{
 const o={};vm.runInNewContext(sin('src/juegos/ocultos.js')+';__o={juegoOculto,ponOculto}',o);
 assert.equal(o.__o.juegoOculto('bt3'),true,'hasta que el Worker diga que sí, oculto');
 o.__o.ponOculto('bt3',false);assert.equal(o.__o.juegoOculto('bt3'),false);
 o.__o.ponOculto('bt3',true);assert.equal(o.__o.juegoOculto('bt3'),true);
 assert.equal(o.__o.juegoOculto('uno'),false);
 const lee=f=>fs.readFileSync(raiz(f),'utf8'),main=lee('src/juegos-main.js');
 assert.match(lee('src/juegos/bt3-amigos.js'),/ponOculto\("bt3", !v\)/,'la respuesta del Worker mueve juegoOculto');
 // la sala abierta por enlace: «Sala privada», sin chat, sin quiénes, sin «Unirse»; y entrar() se niega
 assert.match(main,/const privada = p\.juego === "bt3" && !bt3Visible\(\);[\s\S]{0,80}\$\("jgChat"\)\.hidden = privada;/);
 assert.match(main,/async function entrar\(pid\) \{[\s\S]{0,400}sala\.juego === "bt3" && !bt3Visible\(\)\) return;/);
 assert.match(main,/function pintaQuienes\(p, est\) \{[\s\S]{0,150}p\.juego === "bt3" && !bt3Visible\(\)/);
 // las listas del salón (catálogo, solos, novedades, salas abiertas, en juego), clasificación y logros
 for (const r of [/k !== "bt3" \|\| bt3Visible\(\)/, /n\.id !== "bt3" \|\| bt3Visible\(\)/, /s\.juego !== "bt3" \|\| bt3Visible\(\)/, /x\.juego !== "bt3" \|\| bt3Visible\(\)/, /ocultos: \(\) => bt3Visible\(\) \? \[\] : \["bt3"\]/])
  assert.match(main,r);
 assert.match(lee('src/juegos/logros-vista.js'),/!fuera\.has\(j\)/,'los logros no vuelven a meter un juego oculto');
 assert.match(lee('src/juegos/monedas-vista.js'),/filter\(j => !juegoOculto\(j\)\)/,'la tabla de monedas no nombra a BT3');
 assert.match(lee('src/juegos/perfil.js'),/!juegoOculto\(it\.req\.top\)/,'la tienda no muestra su premio de campeón');
});
