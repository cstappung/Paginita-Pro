const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync('src/juegos/motor.js','utf8').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto};vm.createContext(context);
vm.runInContext(code+';Object.assign(this,{jugadaExternaMemazo,MZ_PLANTILLAS,fuenteMemazo,MZ_VOTO_MS,MZ_REVELA_MS,MZ_RESUMEN_MS,MZ_LARGO});',context);
const {jugadaExternaMemazo,reducir,meToca,progreso,ofertasMemazo,textosMemazo,externoMemazo,fuenteMemazo,MZ_PLANTILLAS,MZ_VOTO_MS,MZ_REVELA_MS,MZ_RESUMEN_MS,MZ_LARGO}=context;
const nombres=['a','b','c','d','e','f','g','h','i','j'];

const sala=(n,extra={})=>{
 const p={juego:'memazo',semilla:12345,estado:'jugando',anfitrion:'a',cupo:10,jugadores:{},jugadas:{},...extra};
 for(let i=0;i<n;i++)p.jugadores[nombres[i]]={nombre:nombres[i].toUpperCase(),orden:i};
 return p;
};
let reloj=1e12;
const pon=(p,j)=>{p.jugadas[String(Object.keys(p.jugadas).length).padStart(4,'0')]=j;return reducir(p);};
const tic=(ms=1000)=>(reloj+=ms);
const asiento=(p,u)=>p.jugadores[u].orden;
const memeDe=(p,est,u,txt='hola')=>{const pl=ofertasMemazo(p.semilla,est.r,asiento(p,u))[0];return {t:'meme',uid:u,r:est.r,p:pl,x:Array(MZ_PLANTILLAS[pl]).fill(txt),at:tic()};};

/* Una partida entera en la que todos escriben y todos califican. */
function partida(n,nota=(u,autor)=>((u.charCodeAt(0)+autor.charCodeAt(0))%5)+1,extra){
 const p=sala(n,extra);let est=reducir(p);
 assert.equal(est.etapa,'arranque');
 est=pon(p,{t:'arranca',uid:'a',at:tic()});
 let vueltas=0;
 while(est.fase==='jugando'&&vueltas++<2000){
  if(est.etapa==='escribir'){for(const u of [...est.debe])est=pon(p,memeDe(p,est,u));continue;}
  if(est.etapa==='votar'){const autor=est.memes[est.m].uid;for(const u of [...est.debe])est=pon(p,{t:'nota',uid:u,r:est.r,m:est.m,v:nota(u,autor),at:tic()});continue;}
  assert.fail('etapa inesperada '+est.etapa);
 }
 return {p,est};
}

test('Las plantillas del motor son las del dibujo',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../src/juegos/memazo-plantillas.js'),'utf8');
 const ids=Object.keys(MZ_PLANTILLAS);
 for(const id of ids){
  const m=src.match(new RegExp('\\n  '+id+': \\{[\\s\\S]*?\\n  \\}'));
  assert.ok(m,'sin dibujo: '+id);
  const cajas=(m[0].match(/\{ ?x: /g)||[]).length-(m[0].match(/de: \d/g)||[]).length;
  assert.equal(cajas,MZ_PLANTILLAS[id],'cajas de '+id);
 }
 assert.ok(ids.length>=24);
});

test('Ofertas: tres distintas por asiento y nadie comparte con nadie hasta nueve',()=>{
 for(let r=1;r<=7;r++){
  const vistas=new Set();
  for(let i=0;i<9;i++){const o=ofertasMemazo(77,r,i);assert.equal(new Set(o).size,3);for(const x of o){assert.ok(!vistas.has(x));vistas.add(x);}}
 }
 assert.notDeepEqual([...ofertasMemazo(77,1,0)],[...ofertasMemazo(77,2,0)]);
});

test('Textos: recortados, tantos como cajas, y vacío no vale',()=>{
 assert.equal(textosMemazo('sino',['','  ']),null);
 assert.equal(textosMemazo('nada',['x']),null);
 const t=textosMemazo('sino',['  a \n b  ','x'.repeat(200),'sobra']);
 assert.deepEqual([...t],['a b','x'.repeat(MZ_LARGO)]);
});

for(const n of [2,3,6,10]){
 test(`Robots: partida entera a ${n}`,()=>{
  const {est}=partida(n);
  assert.equal(est.fase,'fin');
  assert.equal(est.historial.length,3);
  for(const h of est.historial){assert.equal(h.memes.length,n);for(const mm of h.memes)assert.equal(Object.keys(mm.notas).length,n-1);}
  const suma=Object.values(est.puntos).reduce((a,b)=>a+b,0);
  assert.equal(suma,est.historial.reduce((s,h)=>s+h.memes.reduce((t,mm)=>t+mm.total,0),0));
  if(est.ganador)assert.equal(Math.max(...Object.values(est.puntos)),est.puntos[est.ganador]);
  assert.ok(['risas','empate'].includes(est.motivo));
 });
}

test('Rondas a elegir y el ganador es quien más suma',()=>{
 const {est}=partida(3,(u,autor)=>autor==='c'?5:1,{rondas:5});
 assert.equal(est.historial.length,5);
 assert.equal(est.ganador,'c');assert.equal(est.motivo,'risas');
 assert.equal(est.puntos.c,5*2*5);assert.equal(est.fuegos.c,10);assert.equal(est.tomates.a,10);
});

test('Empate a todo: puntos y fuegos iguales',()=>{
 const {est}=partida(2,()=>3);
 assert.equal(est.ganador,'');assert.equal(est.motivo,'empate');
});

test('Solo vale una plantilla ofrecida, el último meme corrige y el autor no se califica',()=>{
 const p=sala(3);let est=pon(p,{t:'arranca',uid:'a',at:tic()});
 const otra=Object.keys(MZ_PLANTILLAS).find(k=>!ofertasMemazo(p.semilla,1,0).includes(k));
 est=pon(p,{t:'meme',uid:'a',r:1,p:otra,x:['x','y','z','w'],at:tic()});
 assert.ok(est.debe.includes('a'));
 est=pon(p,memeDe(p,est,'a','primero'));
 est=pon(p,memeDe(p,est,'a','segundo'));
 assert.ok(!est.debe.includes('a'));assert.ok(meToca(est,'b'));assert.ok(!meToca(est,'a'));
 est=pon(p,memeDe(p,est,'b'));est=pon(p,memeDe(p,est,'c'));
 assert.equal(est.etapa,'votar');
 assert.equal(est.memes.find(mm=>mm.uid==='a').x[0],'segundo');
 const autor=est.memes[0].uid;
 est=pon(p,{t:'nota',uid:autor,r:1,m:0,v:5,at:tic()});
 assert.ok(!(autor in est.memes[0].notas));
 assert.ok(!est.debe.includes(autor));
 const otro=est.debe[0];
 est=pon(p,{t:'nota',uid:otro,r:1,m:0,v:2,at:tic()});
 est=pon(p,{t:'nota',uid:otro,r:1,m:0,v:5,at:tic()});
 assert.equal(est.memes[0].notas[otro],2);
 est=pon(p,{t:'nota',uid:est.debe[0],r:1,m:0,v:9,at:tic()});
 assert.equal(est.m,0);
});

test('El plazo: cierra antes de tiempo no vale, después sí; sin meme no hay meme',()=>{
 const p=sala(3);let est=pon(p,{t:'arranca',uid:'a',at:tic()});
 assert.equal(est.plazo,est.desde+90000);
 est=pon(p,memeDe(p,est,'a'));
 est=pon(p,{t:'cierra',uid:'b',r:1,e:'escribir',at:est.plazo-5});
 assert.equal(est.etapa,'escribir');
 est=pon(p,{t:'cierra',uid:'b',r:1,e:'votar',m:0,at:est.plazo+5});
 assert.equal(est.etapa,'escribir');
 reloj=est.plazo+10;
 est=pon(p,{t:'cierra',uid:'b',r:1,e:'escribir',at:tic()});
 assert.equal(est.etapa,'votar');assert.equal(est.total,1);assert.equal(est.plazo,est.desde+MZ_VOTO_MS);
 reloj=est.plazo+1;
 est=pon(p,{t:'cierra',uid:'c',r:1,e:'votar',m:0,at:tic()});
 assert.equal(est.r,2);assert.equal(est.etapa,'escribir');
 assert.equal(est.plazo,est.desde+MZ_RESUMEN_MS+90000);
 assert.equal(est.historial[0].memes[0].total,0);
 /* Ronda sin memes: se salta la votación. */
 reloj=est.plazo+1;
 est=pon(p,{t:'cierra',uid:'c',r:2,e:'escribir',at:tic()});
 assert.equal(est.r,3);assert.equal(est.historial[1].memes.length,0);
 assert.ok(progreso(est,'memazo')>0.6);
});

test('Votación: el siguiente meme deja ver la nota del anterior',()=>{
 const p=sala(2,{tiempo:60});let est=pon(p,{t:'arranca',uid:'a',at:tic()});
 assert.equal(est.plazo,est.desde+60000);
 est=pon(p,memeDe(p,est,'a'));est=pon(p,memeDe(p,est,'b'));
 est=pon(p,{t:'nota',uid:est.debe[0],r:1,m:0,v:4,at:tic()});
 assert.equal(est.m,1);assert.equal(est.plazo,est.desde+MZ_REVELA_MS+MZ_VOTO_MS);
 assert.equal(est.memes[0].total,4);
});

test('Abandono: completa la etapa sin hora y se cierra con el siguiente cierra',()=>{
 const p=sala(3);let est=pon(p,{t:'arranca',uid:'a',at:tic()});
 est=pon(p,memeDe(p,est,'a'));est=pon(p,memeDe(p,est,'b'));
 est=pon(p,{t:'abandona',uid:'c'});
 assert.equal(est.etapa,'escribir');assert.equal(est.completa,true);assert.deepEqual([...est.debe],[]);
 est=pon(p,{t:'cierra',uid:'a',r:1,e:'escribir',at:tic()});
 assert.equal(est.etapa,'votar');assert.equal(est.total,2);
 est=pon(p,{t:'abandona',uid:'b'});
 assert.equal(est.fase,'fin');assert.equal(est.ganador,'a');assert.equal(est.motivo,'abandono');
});

test('Expulsar por votación es un abandono',()=>{
 const p=sala(3);let est=pon(p,{t:'arranca',uid:'a',at:tic()});
 est=pon(p,{t:'voto',uid:'a',contra:'c'});
 est=pon(p,{t:'voto',uid:'b',contra:'c'});
 assert.equal(est.fuera.c,true);
 est=pon(p,memeDe(p,est,'a'));est=pon(p,memeDe(p,est,'b'));
 assert.equal(est.etapa,'votar');
});

test('Sin arranca no se escribe, y quien no está en la sala no juega',()=>{
 const p=sala(2);let est=reducir(p);
 est=pon(p,memeDe(p,{r:1},'a'));
 assert.equal(est.etapa,'arranque');
 est=pon(p,{t:'arranca',uid:'zz',at:tic()});
 assert.equal(est.etapa,'arranque');
 est=pon(p,{t:'arranca',uid:'b'});
 assert.equal(est.etapa,'arranque');
 const q=sala(3,{estado:'esperando'});
 assert.equal(pon(q,{t:'arranca',uid:'a',at:tic()}).fase,'espera');
});

test('Plantillas de afuera: solo valen en su sala y con una imagen de su servicio',()=>{
 const j={p:'if',u:'30b1gx.jpg',an:1200,al:1200,n:'Drake Hotline Bling',c:[[3,3,94,22],[3,75,94,22]]};
 assert.ok(externoMemazo(j,'reales'));
 assert.equal(externoMemazo(j,'gif'),null);
 assert.equal(externoMemazo(j,'dibujos'),null);
 assert.equal(externoMemazo({...j,u:'../x.jpg'},'reales'),null);
 assert.equal(externoMemazo({...j,u:'javascript:alert(1)'},'reales'),null);
 assert.equal(externoMemazo({...j,u:'30b1gx.jpg" onerror="x'},'reales'),null);
 assert.equal(externoMemazo({...j,c:[]},'reales'),null);
 assert.equal(externoMemazo({...j,c:Array(6).fill([0,0,10,10])},'reales'),null);
 assert.equal(externoMemazo({...j,an:10},'reales'),null);
 assert.equal(externoMemazo({...j,an:5000,al:100},'reales'),null);
 const g=externoMemazo({p:'gif',u:'3o7aCSPqXE5C6T8tBC',an:480,al:270,c:[[90,90,50,50]]},'gif');
 assert.deepEqual(JSON.parse(JSON.stringify(g.c)),[[90,90,10,10]]);
 assert.equal(externoMemazo({p:'gif',u:'a/b',an:480,al:270,c:[[0,0,50,50]]},'gif'),null);
 assert.equal(fuenteMemazo({fuente:'gif'}),'gif');assert.equal(fuenteMemazo({fuente:'otra'}),'dibujos');
});

test('Sala de plantillas reales: el meme lleva su imagen y sus cajas; los dibujos siguen valiendo',()=>{
 const p=sala(2,{fuente:'reales'});let est=pon(p,{t:'arranca',uid:'a',at:tic()});
 est=pon(p,{t:'meme',uid:'a',r:1,p:'if',u:'1ur9b0.jpg',an:1200,al:800,n:'Distracted',c:[[3,60,30,20],[35,40,30,20],[68,55,30,20]],x:['yo','el meme','la tarea','sobra'],at:tic()});
 assert.ok(!est.debe.includes('a'));
 est=pon(p,memeDe(p,est,'b'));
 assert.equal(est.etapa,'votar');
 const mm=est.memes.find(m=>m.uid==='a');
 assert.equal(mm.u,'1ur9b0.jpg');assert.equal(mm.c.length,3);assert.deepEqual([...mm.x],['yo','el meme','la tarea']);
 assert.equal(est.fuente,'reales');
 const q=sala(2);let e2=pon(q,{t:'arranca',uid:'a',at:tic()});
 e2=pon(q,{t:'meme',uid:'a',r:1,p:'if',u:'1ur9b0.jpg',an:1200,al:800,c:[[0,0,50,50]],x:['yo'],at:tic()});
 assert.ok(e2.debe.includes('a'));
});

/* Las reglas reservan algunos hijos de toda jugada (`h` y `sal`, texto, el
   hash de otros juegos): una jugada de Memazo con un número en `h` (el alto
   de la imagen) se rechazaba entera y «¡Listo!» no hacía nada. */
test('La jugada de una plantilla de afuera pasa las reglas de jugadas/$n',()=>{
 const reglas=JSON.parse(fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8'));
 const n=reglas.rules.partidas.$pid.jugadas.$n;
 const reservados=Object.keys(n).filter(k=>!k.startsWith('.')&&!k.startsWith('$')&&k!=='at');
 assert.ok(reservados.includes('h'));
 const j={t:'meme',uid:'a',r:1,...jugadaExternaMemazo({p:'if',u:'30b1gx.jpg',w:1200,h:1200,n:'Drake',c:[[3,3,94,22]]},['hola']),at:1};
 for(const k of reservados)assert.ok(!(k in j),'la jugada usa el campo reservado '+k);
 assert.ok(j.t.length<=16);
 const e=externoMemazo(j,'reales');
 assert.equal(e.w,1200);assert.equal(e.h,1200);
});

/* GIPHY: la clave de prueba da ~100 llamadas por hora para todos. Cada
   «navegador» de estas pruebas es el módulo cargado aparte con su propio
   localStorage; el reloj y fetch son de mentira. */
const esbuild=require('esbuild');
let codigoFuentes=null;
function navegador(red,reloj){
 if(!codigoFuentes) codigoFuentes=esbuild.buildSync({entryPoints:[path.join(__dirname,'../src/juegos/memazo-fuentes.js')],bundle:true,format:'cjs',write:false,
  external:['../firebase.js','firebase/database']}).outputFiles[0].text;
 const almacen={};
 const ctx={module:{exports:{}},__clave:'claveDePrueba123',
  localStorage:{getItem:k=>almacen[k]??null,setItem:(k,v)=>{almacen[k]=v;}},
  fetch:async u=>{red.llamadas.push({t:reloj.t,u:String(u)});return red.responde(String(u));},
  Date:{now:()=>reloj.t},JSON,Math,Number,String,Array,Object,Map,Error,encodeURIComponent,Promise,
  require:m=>m==='firebase/database'?{ref:()=>0,get:async()=>({val:()=>ctx.__clave})}:{db:{}}};
 ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(codigoFuentes,ctx);
 return Object.assign(ctx.module.exports,{almacen,ctx});
}
const resp=(status,body)=>({ok:status===200,status,json:async()=>body});
const conGifs=u=>{const q=new URL(u).searchParams.get('q')||'moda';return resp(200,{meta:{status:200},data:[{id:'gif'+q.replace(/\W/g,'')+'abcdef',title:q,images:{original:{width:'480',height:'270'}}}]});};
const HORA=3600e3;

test('GIPHY: un 429 o una clave mala son un error con motivo, nunca «cero GIFs»',async()=>{
 const reloj={t:1e12},red={llamadas:[],responde:conGifs};
 const sinClave=navegador(red,reloj);sinClave.ctx.__clave=null;
 await assert.rejects(sinClave.gifsGiphy(),e=>/Falta la clave/.test(e.motivo));
 for(const [st,body,re] of [[429,{meta:{status:429}},/límite/],[200,{meta:{status:401},data:[]},/clave/],[200,{meta:{status:200},data:[]},/no devolvió/]]){
  const b=navegador({llamadas:[],responde:()=>resp(st,body)},reloj);
  await assert.rejects(b.gifsGiphy(),e=>re.test(e.motivo));
 }
});

test('GIPHY: lo guardado no gasta: los de moda 6 h y cada búsqueda 1 día, también tras recargar',async()=>{
 const reloj={t:1e12},red={llamadas:[],responde:conGifs};
 let b=navegador(red,reloj);
 await b.gifsGiphy();await b.gifsGiphy();await b.gifsGiphy('gato');await b.gifsGiphy('  GATO ');
 assert.equal(red.llamadas.length,2);
 /* recargar la página: módulo nuevo, mismo localStorage */
 const almacen=b.almacen;b=navegador(red,reloj);Object.assign(b.almacen,almacen);
 reloj.t+=5*HORA;await b.gifsGiphy();await b.gifsGiphy('gato');
 assert.equal(red.llamadas.length,2,'nada nuevo dentro de las 6 h / el día');
 reloj.t+=2*HORA;await b.gifsGiphy();
 assert.equal(red.llamadas.length,3,'pasadas 6 h los de moda se piden otra vez');
});

test('GIPHY: como mucho GIPHY_TOPE llamadas por navegador y hora, compartidas entre pestañas',async()=>{
 const reloj={t:1e12},red={llamadas:[],responde:conGifs};
 const a=navegador(red,reloj),tope=a.GIPHY_TOPE;
 assert.ok(tope*8<100,'ocho jugadores al tope no llegan a 100 por hora');
 const b=navegador(red,reloj);b.almacen=a.almacen;   // otra pestaña: mismo localStorage
 b.ctx.localStorage=a.ctx.localStorage;
 let rechazos=0;
 for(let i=0;i<30;i++){
  const nav=i%2?a:b;
  try{await nav.gifsGiphy('busqueda '+i);}catch(e){rechazos++;assert.match(e.motivo,/búsquedas de GIFs de esta hora/);}
  reloj.t+=60e3;
 }
 assert.equal(red.llamadas.length,tope);
 assert.equal(rechazos,30-tope);
 assert.ok(a.cupoGiphy().quedan===0);
 reloj.t+=HORA;
 assert.equal(a.cupoGiphy().quedan,tope,'una hora después vuelve el cupo');
 await a.gifsGiphy('otra cosa');
 assert.equal(red.llamadas.length,tope+1);
});

test('GIPHY: tras un 429 el navegador no vuelve a llamar en 15 minutos',async()=>{
 const reloj={t:1e12};let estado=429;
 const red={llamadas:[],responde:u=>estado===429?resp(429,{meta:{status:429}}):conGifs(u)};
 const b=navegador(red,reloj);
 await assert.rejects(b.gifsGiphy());
 estado=200;
 reloj.t+=10*60e3;
 await assert.rejects(b.gifsGiphy('gato'),e=>/pausa/.test(e.motivo));
 assert.equal(red.llamadas.length,1);
 reloj.t+=6*60e3;
 assert.equal((await b.gifsGiphy('gato')).length,1);
 assert.equal(red.llamadas.length,2);
});

/* El caso que se comía el cupo: una sala de ocho jugando una hora, todos
   buscando mucho y recargando la página. Nunca 100 llamadas en una hora. */
test('GIPHY: una hora de partida con ocho jugadores no llega a 100 llamadas',async()=>{
 const reloj={t:1e12},red={llamadas:[],responde:conGifs};
 const navs=Array.from({length:8},()=>navegador(red,reloj));
 const palabras=['gato','perro','risa','fail','baile','lunes','viernes','examen','profe','sueño','pizza','gol'];
 for(let ronda=0;ronda<12;ronda++){                // una ronda cada 5 minutos
  for(const [i,nav] of navs.entries()){
   const recarga=navegador(red,reloj);recarga.ctx.localStorage=nav.ctx.localStorage;   // cada ronda recarga la página
   await recarga.gifsGiphy().catch(()=>{});
   for(let k=0;k<4;k++) await recarga.gifsGiphy(palabras[(ronda*3+i+k)%palabras.length]+' '+(ronda%3)).catch(()=>{});
  }
  reloj.t+=5*60e3;
 }
 /* la ventana de una hora con más llamadas */
 const ts=red.llamadas.map(l=>l.t).sort((a,b)=>a-b);
 let peor=0;for(let i=0;i<ts.length;i++){let j=i;while(j<ts.length&&ts[j]-ts[i]<HORA)j++;peor=Math.max(peor,j-i);}
 assert.ok(peor<100,'peor hora: '+peor+' llamadas');
 assert.ok(peor<=8*navs[0].GIPHY_TOPE);
});
