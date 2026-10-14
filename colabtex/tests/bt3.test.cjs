/* Budokai Tenkaichi 3: el vestíbulo de la sala (redBt3), la palabra de reglas que espera gs/net.c, y que el
   juego esté en las tablas que un juego de sala necesita (logros, niveles, peso, marco, reglas de Firebase). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const raiz=f=>path.join(__dirname,'..',f);
const sin=f=>fs.readFileSync(raiz(f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={crypto:require('node:crypto').webcrypto,TextEncoder};vm.createContext(ctx);
vm.runInContext(sin('src/juegos/motor.js')+'\n'+sin('src/juegos/logros.js')+'\n'+sin('src/juegos/tienda.js')+'\n'+sin('src/juegos/cortes.js')+'\n'+sin('src/juegos/monedas.js')+
 ';globalThis.__B={reducir,reglasBt3,JUEGOS,LOGROS,NIVEL,PESO,detecta,BT3_TIEMPOS};',ctx);
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
