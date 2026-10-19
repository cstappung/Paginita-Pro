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
