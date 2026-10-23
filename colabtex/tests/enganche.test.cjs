/* Enganchar a los nuevos: el orden del salón para el invitado y el
   celular, lo que una cuenta le habría pagado al invitado, el reto a un
   amigo, el cierre de los diarios y la app instalable. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const carga=f=>{const code=esbuild.buildSync({entryPoints:[f],bundle:true,format:'cjs',platform:'node',write:false,logLevel:'silent'}).outputFiles[0].text;const mod={exports:{}};new Function('module','exports','require',code)(mod,mod.exports,require);return mod.exports;};
const S=carga('src/juegos/salon-datos.js');
const R=carga('src/juegos/reto.js');
const M=carga('src/juegos/monedas.js');
const raiz=p=>path.join(__dirname,'..','..',p);

test('novedades: al invitado y en el celular, primero lo que se juega ahí',()=>{
 const L=[
  {id:'a',ficha:'boxhead',juego:'boxhead',modo:'multi',cuenta:true},
  {id:'b',ruta:'#solo/hero',cuenta:true},
  {id:'c',ruta:'#solo/prodefender'},
  {id:'d',ruta:'#cartas',cuenta:true},
  {id:'e',ruta:'#solo/fanal'}];
 assert.deepEqual(S.ordenaNovedades(L,{}).map(n=>n.id),['a','b','c','d','e'],'con cuenta en el PC no cambia nada');
 assert.deepEqual(S.ordenaNovedades(L,{invitado:true}).map(n=>n.id),['c','e','a','b','d'],'lo jugable primero, en el orden de la dueña');
 assert.equal(S.novedadPideCuenta({ruta:'#solo/sopa'}),false);
 assert.equal(S.novedadPideCuenta({ruta:'#solo/hero'}),true);
 assert.equal(S.novedadPideCuenta({ficha:'uno'}),true);
});

test('carrusel: en el celular, lo que solo va en el PC al final; al invitado, lo cerrado al final',()=>{
 // (las plataformas van puestas a mano: lo que se prueba es el orden)
 const E=[{id:'minas',modo:'solo',movil:false,pc:true},{id:'heroclub',modo:'solo',movil:true,pc:true},{id:'snake',modo:'solo',movil:true,pc:true},{id:'sortem',modo:'solo',movil:false,pc:false}];
 assert.deepEqual(S.ordenaEntradas(E,{}).map(e=>e.id),['minas','heroclub','snake','sortem']);
 assert.deepEqual(S.ordenaEntradas(E,{celular:true}).map(e=>e.id),['heroclub','snake','sortem','minas'],'sin datos de plataforma no se castiga');
 assert.deepEqual(S.ordenaEntradas(E,{celular:true,invitado:true}).map(e=>e.id),['snake','sortem','minas','heroclub']);
});

test('lo que se pierde el invitado: partidas con tope, récord por modalidad y logros',()=>{
 assert.deepEqual(M.ganariaInvitado('snake',0,{}),{monedas:0,logros:[]});
 const una=M.ganariaInvitado('snake',1,{'club-snake-classic-m':{puntos:3,tiempo:5000}});
 assert.ok(una.monedas>=M.PAGO_CLUB.snake+M.RECORD.snake,'paga la partida y el récord');
 const muchas=M.ganariaInvitado('snake',100,{});
 assert.equal(muchas.monedas,M.PAGO_CLUB.snake*M.topeClub('snake'),'el tope del día');
 const bb=M.ganariaInvitado('bbtan',1,{'club-bbtan-rondas':{puntos:120,tiempo:1}});
 assert.ok(bb.logros.length>0&&bb.monedas>M.monedasBbtan(120),'BBTAN 120: monedas por rondas y algún logro');
 // PRO DEFENDER no paga por partida: paga las rondas del reino.
 assert.equal(M.ganariaInvitado('prodefender',3,{'club-prodefender-prado':{puntos:10,tiempo:1}}).monedas>=200,true);
 // Tetris Club: la clave es tetrisclub y la categoría club-tetris-*.
 assert.ok(M.ganariaInvitado('tetrisclub',1,{'club-tetris-marathon':{puntos:1000,tiempo:1}}).monedas>=M.PAGO_CLUB.tetrisclub+M.RECORD.tetrisclub);
});

test('reto: ida y vuelta por la URL, validado campo por campo',()=>{
 const q=R.enlaceReto({categoria:'club-tetris-sprint',puntos:40,tiempo:83456,nombre:' Pudú  27 '});
 const r=R.leeReto(q);
 assert.deepEqual({...r},{categoria:'club-tetris-sprint',puntos:40,tiempo:83456,nombre:'Pudú 27'});
 assert.equal(R.leeReto(''),null);
 assert.equal(R.leeReto('?rc=club-x&rp=-1'),null);
 assert.equal(R.leeReto('?rc=<script>&rp=1'),null);
 assert.equal(R.leeReto('?rc=otra-cosa&rp=1'),null);
 assert.equal(R.leeReto('?rc=club-snake-classic-m&rp=1.5'),null);
 assert.equal(R.leeReto('?rc=club-snake-classic-m&rp=5').nombre,'Alguien');
 assert.equal(R.leeReto('?rc=club-snake-classic-m&rp=5&rn=%3Cb%3Ex').nombre,'bx','el nombre se limpia');
 const reto={categoria:'club-tetris-sprint',puntos:40,tiempo:80000};
 assert.equal(R.superaReto({categoria:'club-tetris-sprint',puntos:40,tiempo:79999},reto),true,'mismo puntaje, menos tiempo');
 assert.equal(R.superaReto({categoria:'club-tetris-sprint',puntos:40,tiempo:80000},reto),false,'empatar no gana');
 assert.equal(R.superaReto({categoria:'club-tetris-ultra',puntos:999,tiempo:1},reto),false,'otra modalidad');
 assert.match(R.textoReto('Snake Club','12 pts'),/12 pts.*Snake Club/);
 assert.match(R.textoReto('Snake Club',''),/Snake Club/);
});

test('diarios: la cuenta regresiva va a la medianoche de Chile',()=>{
 const ctx={window:{},location:{origin:'https://paginita-pro.cl'},Intl,Date,Object,String,Math,setInterval,clearInterval,setTimeout,Set};
 ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(raiz('juegos/club/diario.js'),'utf8'),ctx);
 const D=ctx.DiarioClub;
 // 2026-10-23 20:00 UTC = 17:00 en Chile (UTC-3, horario de verano): faltan 7 h.
 assert.equal(D.faltan(new Date('2026-10-23T20:00:00Z')),7*3600);
 assert.equal(D.reloj(7*3600+61),'07:01:01');
 assert.equal(D.enlace('sopa'),'https://paginita-pro.cl/juegos.html#solo/sopa');
 for(const [j,v] of [['sopa','sopa-3'],['sudoku','sudoku-5'],['electro','electro-5']]){
  const html=fs.readFileSync(raiz(`juegos/club/${j}/index.html`),'utf8');
  assert.match(html,/\.\.\/diario\.js\?v=diario-\d+/,j+' carga diario.js');
  assert.ok(html.indexOf('diario.js')<html.indexOf('game.js?v='),j+': diario.js antes que el juego');
  assert.ok(html.includes('game.js?v='+v),j+' subió su versión');
 }
});

test('la app instalable: manifest, íconos y el enlace en Juegos',()=>{
 const m=JSON.parse(fs.readFileSync(raiz('manifest.webmanifest'),'utf8'));
 assert.equal(m.display,'standalone');
 assert.match(m.start_url,/^\/juegos\.html/);
 for(const i of m.icons)assert.ok(fs.existsSync(raiz(i.src.slice(1))),'existe '+i.src);
 assert.ok(m.icons.some(i=>i.purpose==='maskable'));
 assert.ok(m.icons.some(i=>i.sizes==='192x192')&&m.icons.some(i=>i.sizes==='512x512'));
 assert.match(fs.readFileSync(raiz('juegos.html'),'utf8'),/<link rel="manifest" href="manifest\.webmanifest">/);
});

test('el inicio de sesión de la app del iPhone: el ayudante se publica en este dominio',()=>{
 const cfg=fs.readFileSync(raiz('_config.yml'),'utf8');
 assert.match(cfg,/include:\s*\n\s*-\s*__\s*$/m,'Jekyll publica la carpeta __');
 const fl=fs.readFileSync(raiz('.github/workflows/auth-firebase.yml'),'utf8');
 for(const f of ['__/auth/handler.html','__/auth/handler.js','__/auth/iframe.html','__/auth/iframe.js'])assert.ok(fl.includes(f),f);
 const fb=fs.readFileSync(path.join(__dirname,'..','src','firebase.js'),'utf8');
 assert.match(fb,/navigator\.standalone === true/);
 assert.match(fb,/authDomain: conRedireccion \? DOMINIO_PROPIO : "mi-pagina-pro\.firebaseapp\.com"/);
 assert.equal(fs.readFileSync(raiz('CNAME'),'utf8').trim(),'paginita-pro.cl','el dominio propio es el del authDomain');
});
