/* El castigo del antitrampas (src/juegos/castigo.js): qué cuenta como
   trampa, cuánto dura la retención y de quién es, y el recorrido entero
   —pantallazo, «wasted», retención, liberar— sobre un DOM de mentira con
   el reloj y los temporizadores en la mano. */
const {test, mock}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const codigo=esbuild.buildSync({entryPoints:['src/juegos/castigo.js'],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text;
const carga=()=>{const mod={exports:{}};new Function('module','exports','require',codigo)(mod,mod.exports,require);return mod.exports;};

/* Lo justo del navegador: localStorage, un <body> que guarda la capa y su
   HTML, y un Audio que no suena. Cada prueba carga el módulo de nuevo,
   porque guarda estado (la capa, a quién castiga). */
function entorno(){
  const store={},body={hijos:[],appendChild(x){this.hijos.push(x);}},sonidos=[];
  const capa=()=>body.hijos[body.hijos.length-1]||null;
  global.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}};
  global.document={body,activeElement:null,fullscreenElement:null,documentElement:{requestFullscreen:()=>Promise.resolve()},querySelectorAll:()=>[],
    createElement:()=>{const clases=new Set(),cuenta={textContent:''},boton={onclick:null};
      const el={className:'',innerHTML:'',style:{},classList:{add:c=>clases.add(c),contains:c=>clases.has(c)},addEventListener(){},
        remove(){body.hijos=body.hijos.filter(x=>x!==el);},
        querySelector:s=>s==='.jg-cs-r'?cuenta:s==='.jg-cs-e'?(el.innerHTML.includes('class="jg-cs-e"')?boton:null):null};
      return el;}};
  global.window={addEventListener(){},removeEventListener(){}};
  global.Audio=function(src){this.src=src;sonidos.push(src);this.play=()=>Promise.resolve();this.pause=()=>{};};
  return {store,capa,sonidos};
}
const MIN=60000;

test('Castigo: solo castiga la trampa recién jugada',()=>{
  const C=(entorno(),carga());
  assert.equal(C.esTrampa({c:'club-sortem-10',m:'El tiempo no cuadra con las jugadas.',vivo:true}),true);
  assert.equal(C.esTrampa({c:'club-sortem-10',m:'La partida llegó sin prueba (¿una versión vieja del juego? recarga la página).',vivo:true}),true,'Club.result desde la consola');
  assert.equal(C.esTrampa({c:'club-sortem-10',m:'El tiempo no cuadra.',d:'pendiente',vivo:false}),false,'un pendiente viejo de localStorage');
  assert.equal(C.esTrampa({c:'club-frontera-torre-50',m:'El combate no se gana así.',d:'fr-1'}),false,'la Frontera re-verificando al entrar');
  assert.equal(C.esTrampa({m:'No se pudo comprobar la partida: x is undefined',vivo:true}),false,'el verificador falló');
  assert.equal(C.esTrampa({m:'La prueba de la partida es demasiado grande.',vivo:true}),false,'una partida larguísima');
  assert.equal(C.esTrampa({c:'club-metrorush-carrera',m:'la prueba es de otra versión del juego',vivo:true}),false,'un juego viejo en caché no es trampa');
  assert.equal(C.esTrampa({c:'club-atasco-estrellas',m:'La prueba es de otra versión de Atasco (recarga la página).',vivo:true}),false);
  assert.equal(C.esTrampa(null),false);
});

test('Castigo: cuenta atrás, registro local y lo de la cuenta',()=>{
  const C=(entorno(),carga());
  assert.equal(C.restante(1000+10*MIN,1000),'10:00');
  assert.equal(C.restante(1000+61500,1000),'01:02');
  assert.equal(C.restante(1000,1000),'');
  assert.equal(C.restante(NaN,1000),'');
  assert.deepEqual(C.leeRegistro('{"h":5,"u":"ana"}'),{h:5,u:'ana'});
  assert.deepEqual(C.leeRegistro('123'),{h:123,u:''},'un número suelto vale, sin dueño');
  assert.equal(C.leeRegistro('basura'),null);
  assert.equal(C.leeRegistro(null),null);
  assert.equal(C.leeRegistro('{"h":"x"}'),null);
  assert.equal(C.hastaDeCuenta({at:1000}),1000+C.RETENCION_MS);
  assert.equal(C.hastaDeCuenta(null),0);
  assert.equal(C.hastaDeCuenta({}),0);
});

test('Castigo: de quién es la retención',()=>{
  const C=(entorno(),carga());
  const reg={h:2000,u:'ana'};
  assert.equal(C.vigente(reg,undefined,0,1000),2000,'antes de saber quién es, manda lo local');
  assert.equal(C.vigente(reg,null,0,1000),2000,'un invitado no lo esquiva saliendo de la cuenta');
  assert.equal(C.vigente(reg,'ana',0,1000),2000);
  assert.equal(C.vigente(reg,'beto',0,1000),0,'otra cuenta en el mismo navegador no lo hereda');
  assert.equal(C.vigente(null,'beto',3000,1000),3000,'lo de la cuenta vale en cualquier aparato');
  assert.equal(C.vigente(reg,'ana',3000,1000),3000,'el más largo');
  assert.equal(C.vigente(null,null,3000,1000),0,'sin cuenta no hay lo de la cuenta');
  assert.equal(C.vigente(reg,'ana',0,2000),0,'terminado');
  assert.equal(C.vigente({h:2000,u:''},'beto',0,1000),2000,'un registro sin dueño vale para todos');
});

test('Castigo: pantallazo, «wasted», retención y liberar sin recargar',()=>{
  mock.timers.enable({apis:['setTimeout','setInterval']});
  try{
    const E=entorno(),C=carga();let t=1e12,cambios=0,escrito=0;
    C.configuraCastigo({ahora:()=>t,alCambiar:()=>cambios++});
    assert.equal(C.castiga({m:'no cuadra',vivo:false},{uid:'ana'}),false);
    assert.equal(C.castigoActivo(),false,'lo que no es trampa no tapa nada');
    assert.equal(C.castiga({m:'no cuadra',vivo:true},{uid:'ana',escribe:()=>escrito++}),true);
    assert.equal(C.castigoActivo(),true);
    assert.equal(cambios,1,'juegos-main desmonta la vista');
    assert.match(E.capa().innerHTML,/bsod\.png/);
    assert.deepEqual(JSON.parse(E.store['jg.castigo']),{h:t+C.RETENCION_MS,u:'ana'});
    assert.deepEqual(E.sonidos,['juegos/castigo/bsod.mp3']);
    /* Una lectura de la cuenta que aún no trae su `at` no corta el pantallazo. */
    C.revisaCastigo({uid:'ana',cuenta:0});
    assert.equal(E.capa().classList.contains('retenido'),false);
    mock.timers.tick(C.PANTALLAZO_MS);
    assert.equal(E.capa().classList.contains('retenido'),true);
    assert.match(E.capa().innerHTML,/WASTED/);
    assert.deepEqual(E.sonidos,['juegos/castigo/bsod.mp3','juegos/castigo/wasted.mp3']);
    assert.equal(E.capa().querySelector('.jg-cs-r').textContent,'10:00');
    t+=4*MIN;mock.timers.tick(500);
    assert.equal(E.capa().querySelector('.jg-cs-r').textContent,'06:00');
    t+=6*MIN;mock.timers.tick(500);
    assert.equal(C.castigoActivo(),false,'termina solo');
    assert.equal(E.capa(),null);
    assert.equal(cambios,2,'y la página vuelve a montar lo de la ruta');
    return Promise.resolve().then(()=>assert.equal(escrito,1,'se guarda en la cuenta'));
  }finally{mock.timers.reset();}
});

test('Castigo: al cargar vuelve, también para un invitado, pero no para otra cuenta',()=>{
  mock.timers.enable({apis:['setTimeout','setInterval']});
  try{
    const E=entorno();let t=1e12,entradas=0;
    E.store['jg.castigo']=JSON.stringify({h:t+5*MIN,u:'ana'});
    const C=carga();C.configuraCastigo({ahora:()=>t,entrar:()=>entradas++});
    assert.equal(C.revisaCastigo(),true,'antes de la sesión ya tapa');
    assert.equal(E.capa().classList.contains('retenido'),true,'directo a la retención, sin pantallazo');
    assert.equal(E.capa().querySelector('.jg-cs-e'),null,'aún no se sabe quién es: sin botón');
    assert.equal(C.revisaCastigo({uid:'beto',cuenta:0}),false,'entra otra persona');
    assert.equal(C.castigoActivo(),false);
    assert.equal(C.revisaCastigo({uid:null,cuenta:0}),true,'sale a invitado: vuelve');
    const b=E.capa().querySelector('.jg-cs-e');
    assert.ok(b,'y al invitado se le ofrece entrar con su cuenta');
    b.onclick();assert.equal(entradas,1);
    assert.equal(C.revisaCastigo({uid:'ana',cuenta:0}),true,'la misma cuenta sigue retenida');
    assert.equal(E.capa().querySelector('.jg-cs-e'),null);
  }finally{mock.timers.reset();}
});

test('Castigo: adelantar el reloj no lo acorta para una cuenta',()=>{
  mock.timers.enable({apis:['setTimeout','setInterval']});
  try{
    const E=entorno();let servidor=1e12,aparato=servidor+11*MIN;
    /* Castigado hace un minuto (hora del servidor); el aparato va 11
       minutos adelantado, así que su registro local ya parece vencido. */
    E.store['jg.castigo']=JSON.stringify({h:servidor+9*MIN,u:'ana'});
    const C=carga();let corregido=false;
    C.configuraCastigo({ahora:()=>corregido?servidor:aparato});
    assert.equal(C.revisaCastigo(),false,'con el reloj del aparato no se ve');
    assert.equal(C.revisaCastigo({uid:'ana',cuenta:C.hastaDeCuenta({at:servidor-MIN})}),false,'ni al llegar la cuenta, si el reloj aún no se corrige');
    corregido=true;
    assert.equal(C.revisaCastigo(),true,'llega la corrección del servidor y vuelve');
    assert.equal(E.capa().querySelector('.jg-cs-r').textContent,'09:00');
    assert.equal(JSON.parse(E.store['jg.castigo']).h,servidor+9*MIN,'el registro local no se borró al parecer vencido');
  }finally{mock.timers.reset();}
});

test('Castigo: está conectado donde se rechaza una partida',()=>{
  const fs=require('node:fs'),path=require('node:path'),lee=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
  const main=lee('src/juegos-main.js'),club=lee('src/juegos/solo/club.js'),fr=lee('src/juegos/frontera.js');
  const sospecha=main.slice(main.indexOf('const sospechaClub'),main.indexOf('function armazon'));
  assert.match(sospecha,/esTrampa\(s\)\)\s*castiga\(s,\s*\{\s*uid,\s*escribe:\s*\(\)\s*=>\s*fb\.ponCastigo\(uid\)/,'sospechaClub castiga y lo guarda en la cuenta');
  assert.match(sospecha,/fb\.reportaSospecha\(uid,\s*s\)/,'y sigue avisando a los administradores');
  const render=main.slice(main.indexOf('function render()'),main.indexOf('function desmontaVista'));
  assert.match(render,/if \(castigoActivo\(\)\)/,'render no monta nada bajo la capa');
  assert.match(main,/watchCastigo\(user\.uid/,'la retención de la cuenta se escucha al entrar');
  assert.match(main,/seguirReloj\(\(\) => revisaCastigo\(\)\)/,'y se vuelve a mirar cuando se corrige el reloj');
  assert.match(club,/vivo:donde==='en vivo'/,'club.js: solo lo recién jugado castiga');
  assert.match(fr,/dRacha\.partida \}, prueba, true\)/,'la Frontera: solo la victoria recién ganada');
  for(const f of ['bsod.png','bsod.mp3','wasted.mp3'])assert.ok(fs.existsSync(path.join(__dirname,'../../juegos/castigo',f)),f);
});

test('Castigo: la suspensión de un administrador usa la misma capa y se levanta en vivo',()=>{
  mock.timers.enable({apis:['setTimeout','setInterval']});
  try{
    const E=entorno(),C=carga();let t=1e12,cambios=0;
    C.configuraCastigo({ahora:()=>t,alCambiar:()=>cambios++});
    const DIA=24*60*MIN;
    assert.equal(C.revisaCastigo({uid:'ana',cuenta:0,suspension:null}),false);
    assert.equal(C.revisaCastigo({suspension:{hasta:t+2*DIA+3*60*MIN,m:'Récords falsos'}}),true);
    assert.equal(E.capa().classList.contains('retenido'),true,'directo al WASTED, sin pantallazo');
    assert.match(E.capa().innerHTML,/WASTED/);
    assert.match(E.capa().innerHTML,/administrador suspendió/);
    assert.match(E.capa().innerHTML,/Récords falsos/);
    assert.equal(E.capa().querySelector('.jg-cs-r').textContent,'2d 03:00:00','los días se cuentan');
    assert.deepEqual(E.sonidos,['juegos/castigo/wasted.mp3'],'suena el «wasted» al llegar');
    C.revisaCastigo({});
    assert.equal(E.sonidos.length,1,'no vuelve a sonar al repintar');
    assert.equal(C.revisaCastigo({uid:null}),false,'sin sesión no se aplica (un invitado no guarda nada)');
    assert.equal(C.revisaCastigo({uid:'ana'}),true);
    assert.equal(C.revisaCastigo({suspension:null}),false,'el administrador la levanta: la capa se va sola');
    assert.equal(E.capa(),null);
    assert.ok(cambios>=2);
    /* La que ya pasó no tapa nada. */
    assert.equal(C.revisaCastigo({suspension:{hasta:t-1,m:''}}),false);
    assert.equal(C.hastaDeSuspension({hasta:t+5},t),t+5);
    assert.equal(C.hastaDeSuspension({hasta:'x'},t),0);
    assert.equal(C.restante(1000+3600000,1000),'01:00:00');
  }finally{mock.timers.reset();}
});
