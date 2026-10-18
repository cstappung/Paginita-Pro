/* Mario Kart Wii: el vestíbulo de la sala (redMkw), la dirección del marco para cada jugador, y que el juego esté en
   las tablas que un juego de sala necesita (logros, niveles, peso, reglas de Firebase, salón, privacidad). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const raiz=f=>path.join(__dirname,'..',f);
const sin=f=>fs.readFileSync(raiz(f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={crypto:require('node:crypto').webcrypto,TextEncoder};vm.createContext(ctx);
vm.runInContext(sin('src/juegos/motor.js')+'\n'+sin('src/juegos/logros.js')+'\n'+sin('src/juegos/tienda.js')+'\n'+sin('src/juegos/cortes.js')+'\n'+sin('src/juegos/monedas.js')+
 ';globalThis.__M={reducir,JUEGOS,LOGROS,NIVEL,PESO,detecta,MKW_CPU,cupoDe,minimoDe,mkwCarrera,MKW_SINCRO_MAX,MKW_COPAS};',ctx);
const M=ctx.__M;

// Una sala de tres (a la abrió) con estas jugadas en orden.
const sala=(...js)=>({juego:'mkw',anfitrion:'a',estado:'esperando',cupo:12,cpu:'normal',semilla:1,
 jugadores:{a:{nombre:'Ana',orden:0},b:{nombre:'Beto',orden:1},c:{nombre:'Carla',orden:2}},
 jugadas:Object.fromEntries(js.map((j,i)=>[String(i).padStart(4,'0'),j]))});

test('cabe hasta 12 y se abre desde uno (con CPU de relleno)',()=>{
 assert.equal(M.JUEGOS.mkw.cupo,12);assert.equal(M.minimoDe({juego:'mkw'}),1);
 assert.equal(M.cupoDe({juego:'mkw',cupo:12}),12);assert.equal(M.cupoDe({juego:'mkw',cupo:40}),12,'más de 12 se recorta');
 const e=M.reducir({...sala(),jugadores:{a:{nombre:'Ana',orden:0}}});
 assert.equal(e.fase,'vestibulo','uno solo ya tiene vestíbulo');
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

test('pasar el anfitrión: solo en el vestíbulo y a alguien de la sala',()=>{
 let e=M.reducir(sala({t:'anfitrion',uid:'a',a:'b'}));assert.equal(e.anfitrion,'b');
 e=M.reducir(sala({t:'anfitrion',uid:'b',a:'b'}));assert.equal(e.anfitrion,'a','no se lo puede tomar');
 e=M.reducir(sala({t:'anfitrion',uid:'a',a:'intruso'}));assert.equal(e.anfitrion,'a');
 e=M.reducir(sala({t:'empieza',uid:'a'},{t:'anfitrion',uid:'a',a:'c'}));assert.equal(e.anfitrion,'a','corriendo, no (el servidor vive en su pestaña)');
});

test('cada jugador tiene su nodo fijo (10.77.0.<nodo>), aunque otros se vayan',()=>{
 let e=M.reducir(sala());
 assert.deepEqual({...e.nodos},{a:2,b:3,c:4});
 e=M.reducir(sala({t:'abandona',uid:'b'}));
 assert.equal(e.nodos.c,4,'el de Carla no cambia');
 const nodos=Object.values(e.nodos);assert.equal(new Set(nodos).size,nodos.length,'sin repetidos');
});

test('si se va el anfitrión el puesto pasa al siguiente y, si corrían en línea, vuelven al vestíbulo; sin nadie, fin',()=>{
 const sinCpu={t:'ajuste',uid:'a',k:'cpu',v:'ninguna'};
 let e=M.reducir(sala(sinCpu,{t:'empieza',uid:'a'},{t:'abandona',uid:'a'}));
 assert.equal(e.anfitrion,'b');assert.equal(e.fase,'vestibulo','en línea su pestaña era el servidor');
 e=M.reducir(sala({t:'empieza',uid:'a'},{t:'abandona',uid:'a'}));
 assert.equal(e.anfitrion,'b');assert.equal(e.fase,'jugando','con CPU (carrera sincronizada) no hay servidor: siguen');
 e=M.reducir(sala({t:'empieza',uid:'a'},{t:'abandona',uid:'c'}));
 assert.equal(e.fase,'jugando','si se va otro, siguen');
 e=M.reducir(sala({t:'abandona',uid:'a'},{t:'abandona',uid:'b'},{t:'abandona',uid:'c'}));
 assert.equal(e.fase,'fin');assert.equal(e.motivo,'abandono');assert.equal(e.ganador,'','la sala no clasifica');
 e=M.reducir(sala({t:'abandona',uid:'b'},{t:'empieza',uid:'b'}));assert.equal(e.fase,'vestibulo','quien se fue ya no juega');
});

test('con CPU y hasta 4 pilotos la tanda es una carrera sincronizada con los que estaban al empezar',()=>{
 let e=M.reducir(sala({t:'empieza',uid:'a'}));
 assert.deepEqual([...e.sincro],['a','b','c'],'en orden: puerto 1, 2, 3');
 e=M.reducir(sala({t:'ajuste',uid:'a',k:'cpu',v:'ninguna'},{t:'empieza',uid:'a'}));
 assert.equal(e.sincro,null,'sin CPU: en línea');
 e=M.reducir(sala());assert.equal(e.sincro,null,'en el vestíbulo no hay');
 e=M.reducir(sala({t:'empieza',uid:'a'},{t:'vuelve',uid:'a'}));assert.equal(e.sincro,null);
 e=M.reducir(sala({t:'abandona',uid:'b'},{t:'empieza',uid:'a'}));assert.deepEqual([...e.sincro],['a','c'],'quien se fue no corre');
 e=M.reducir(sala({t:'empieza',uid:'a'},{t:'abandona',uid:'b'}));assert.deepEqual([...e.sincro],['a','b','c'],'si alguien se va corriendo, la lista no cambia (su kart sigue sin nadie)');
 const cinco={...sala({t:'empieza',uid:'a'}),jugadores:Object.fromEntries('abcde'.split('').map((u,i)=>[u,{nombre:u,orden:i}]))};
 assert.equal(M.MKW_SINCRO_MAX,4);
 assert.equal(M.reducir(cinco).sincro,null,'con 5 no caben (4 puertos de mando): en línea');
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

test('la dirección del marco: su malla, su nodo, servidor solo en el anfitrión, la CPU y el programa privado',()=>{
 const src=fs.readFileSync(raiz('src/juegos/mkw.js'),'utf8');
 const c={URLSearchParams,mkwCarrera:M.mkwCarrera};vm.runInNewContext(src.slice(src.indexOf('const PAGINA'),src.indexOf('let privado'))+src.slice(src.indexOf('export function srcMkw')).replace(/export /g,'').split('export function crearMkw')[0]+';__s=srcMkw',c);
 const u=new URL('https://x/'+c.__s({pid:'p1',uid:'a',nodo:2,anfitrion:true,cpu:'dificil',privado:'https://w.example',ronda:3}));
 assert.equal(u.pathname,'/juegos/mkw/web/navegador/index.html');
 const q=u.searchParams;
 assert.equal(q.get('red'),'malla');assert.equal(q.get('senal'),'padre');assert.equal(q.get('modo'),'enlinea');
 assert.equal(q.get('sala'),'p1');assert.equal(q.get('uid'),'a');assert.equal(q.get('nodo'),'2');assert.equal(q.get('anfitrion'),'1');
 assert.equal(q.get('relleno'),'dificil');assert.equal(q.get('privado'),'https://w.example');assert.equal(q.get('r'),'3');
 const v=new URL('https://x/'+c.__s({pid:'p1',uid:'b',nodo:3,anfitrion:false,cpu:'normal',privado:'',ronda:1})).searchParams;
 assert.equal(v.get('anfitrion'),null,'los demás no corren servidor');assert.equal(v.get('privado'),null);
 // la carrera sincronizada (con CPU, hasta 4): la copa con la semilla y las pistas de la tanda, sin servidor en línea
 const s=new URL('https://x/'+c.__s({pid:'p1',uid:'b',nodo:3,anfitrion:true,cpu:'facil',privado:'',ronda:2,sincro:['a','b']})).searchParams;
 const t=M.mkwCarrera('p1',2);
 assert.equal(s.get('modo'),'copa');assert.equal(s.get('sincro'),'a,b');assert.equal(s.get('semilla'),String(t.semilla));
 assert.equal(s.get('pistas'),t.pistas.map(x=>x.copa+'.'+x.fila).join(','));assert.equal(s.get('cpu'),'facil');
 assert.equal(s.get('anfitrion'),null,'sin servidor en línea');assert.equal(s.get('relleno'),null);assert.equal(s.get('uid'),'b');
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
