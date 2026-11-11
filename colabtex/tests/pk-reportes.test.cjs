/* Los reportes de Pro Kingdoms (errores y sugerencias): lo puro de
   src/juegos/pk-reportes.js y que la ventana esté enganchada donde debe. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sin=f=>fs.readFileSync(f,'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={};vm.createContext(ctx);
vm.runInContext(sin('src/juegos/pk-reportes.js')+'\n;globalThis.__R={APP_PK,LARGO,limpiaReporte,ordenaReportes,aTxt,nombreTxt,fechaReporte};',ctx);
const R=ctx.__R;
const T=Date.UTC(2026,10,11,15,0,0);
const lista=[
 {id:'a',app:'prokingdoms',tipo:'bug',titulo:'Se congela al abrir el Cuartel',cuerpo:'En era III.\nCon 40 aldeanos.',uid:'u1',userName:'Ana',at:T,ver:'pk-39',nav:'Chrome 130 · Android',estado:'abierto'},
 {id:'b',app:'prokingdoms',tipo:'idea',titulo:'Un botón para vender todo',cuerpo:'',uid:'u2',userName:'Beto',at:T+1000,estado:'abierto'},
 {id:'c',app:'prokingdoms',tipo:'bug',titulo:'El oro sale NaN',cuerpo:'',uid:'u2',userName:'Beto',at:T+2000,estado:'hecho'},
 {id:'d',app:'juegos',tipo:'bug',titulo:'Otra cosa de Juegos',uid:'u3',userName:'Cata',at:T+3000,estado:'abierto'}
];

test('lo que se manda: título obligatorio, en una línea y dentro de lo que deja la regla',()=>{
 assert.equal(R.limpiaReporte({tipo:'bug',titulo:'   \n ',cuerpo:'algo'}),null);
 const r=R.limpiaReporte({tipo:'cualquiera',titulo:'  hola\n  mundo\u0007 ',cuerpo:'a  \r\n\r\n\r\n\r\nb  '});
 assert.equal(r.tipo,'bug');assert.equal(r.titulo,'hola mundo');assert.equal(r.cuerpo,'a\n\nb');
 assert.equal(R.limpiaReporte({tipo:'idea',titulo:'x'}).tipo,'idea');
 const largo=R.limpiaReporte({titulo:'t'.repeat(999),cuerpo:'c'.repeat(9999)});
 assert.equal(largo.titulo.length,R.LARGO.titulo);assert.equal(largo.cuerpo.length,R.LARGO.cuerpo);
 assert.ok(R.LARGO.titulo<=200&&R.LARGO.cuerpo<=4000,'los topes de la regla de feedback');
});

test('la lista: solo lo de Pro Kingdoms, lo más nuevo primero, con filtro',()=>{
 assert.deepEqual(R.ordenaReportes(lista).map(r=>r.id),['c','b','a']);
 assert.deepEqual(R.ordenaReportes(lista,'bug').map(r=>r.id),['c','a']);
 assert.deepEqual(R.ordenaReportes(lista,'idea').map(r=>r.id),['b']);
 assert.deepEqual([...R.ordenaReportes(null)],[]);
});

test('el .txt del administrador: todo, abiertos primero, sin lo de otras apps',()=>{
 const t=R.aTxt(lista,T);
 assert.match(t,/Total: 3 \(2 errores, 1 sugerencia\) · abiertos: 2, arreglados: 1/);
 const ia=t.indexOf('Se congela'),ib=t.indexOf('vender todo'),ic=t.indexOf('NaN');
 assert.ok(ia>0&&ia<ib&&ib<ic,'errores abiertos, luego sugerencias, luego lo arreglado');
 assert.ok(t.includes('De: Ana (u1)')&&t.includes('Versión: pk-39 · Chrome 130 · Android')&&t.includes('En era III.\nCon 40 aldeanos.'));
 assert.ok(!t.includes('Otra cosa de Juegos'));
 assert.match(R.aTxt([],T),/Todavía no hay reportes/);
 assert.match(R.nombreTxt(T),/^prokingdoms-reportes-202611\d\d\.txt$/);
});

test('enganche: botón en la barra del juego, ventana en la página, admin para descargar y borrar',()=>{
 const sitio=fs.readFileSync('../juegos/prokingdoms/sitio.js','utf8');
 const cartero=fs.readFileSync('src/juegos/prokingdoms.js','utf8');
 const main=fs.readFileSync('src/juegos-main.js','utf8');
 const reglas=JSON.parse(fs.readFileSync('../firebase/database.rules.json','utf8')).rules.feedback;
 assert.match(sitio,/avisa\('reportes'\)/);
 assert.doesNotMatch(sitio,/BETA|paginita-pro-beta/,'ya no es beta');
 assert.match(cartero,/x\.tipo === "reportes"/);
 assert.match(cartero,/if \(!admin\) return;/,'descargar, marcar y borrar: solo con admin');
 assert.match(main,/esAdmin: \(\) =>[^\n]*esAdminJuegos\(yoPk\)/);
 assert.equal(reglas['.read'],'auth != null','todos leen los reportes de todos');
 assert.match(reglas.$id['.write'],/!newData\.exists\(\) && root\.child\('admins'\)/,'borrar lo ajeno: solo admins');
 assert.deepEqual(reglas['.indexOn'],['app']);
 assert.ok(fs.readFileSync('src/reports.js','utf8').includes('prokingdoms: "Pro Kingdoms"'),'Informes le pone nombre');
 /* la versión del juego va igual en el cartero y en su página */
 const v=cartero.match(/PK_VER = "(pk-\d+)"/)[1],html=fs.readFileSync('../juegos/prokingdoms/index.html','utf8');
 assert.ok(html.includes('sitio.js?v='+v),'sitio.js con '+v);
 assert.ok(!/\?v=pk-(?!\d+")/.test('')&&new Set(html.match(/\?v=pk-\d+/g)).size===1,'un solo ?v=pk-N en index.html');
});
