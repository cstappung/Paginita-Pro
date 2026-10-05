/* Atasco: el motor (juegos/club/atasco/motor.js), los 240 niveles
   (niveles.js), los dibujos (dibujo.js) y su registro en el club.
   No abre un navegador: todo lo que se prueba es puro.

   Lo central, que es lo que se pidió verificar:
   - Todos los niveles tienen salida, y el mínimo escrito en niveles.js es
     el verdadero. Se comprueba DOS veces: con el solucionador del juego y
     con otro escrito aquí desde cero, sobre textos en vez de números, para
     que un error compartido entre el juego y el generador no pase.
   - Cada nivel se puede terminar con 3, con 2 y con 1 estrella. No se
     deduce de las cuentas: se JUEGA cada nivel tres veces con el motor,
     comprobando que cada movida sea legal, y se mira cuántas estrellas da
     el final. ★★★ = la solución mínima; ★★ = la misma con una movida de ida
     y vuelta antes; ★ = con idas y vueltas suficientes para pasarse del
     margen de las dos estrellas. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const D=path.join(__dirname,'../../juegos/club/atasco');
const M=require(path.join(D,'motor.js'));
const N=require(path.join(D,'niveles.js'));
const DIB=require(path.join(D,'dibujo.js'));

// Todos los niveles en una lista plana, con su piso.
const NIVELES=N.pisos.flatMap((p,j)=>p.niveles.map(([texto,optimo],k)=>({texto,optimo,piso:j,k})));

/* Juega una lista de movidas con el motor, exigiendo que cada una sea
   legal, y devuelve cuántas se hicieron y si el auto rojo salió. */
function juega(nivel,movidas){
 let pos=nivel.pos.slice(),n=0;
 for(const [i,d] of movidas){
  assert.ok(!M.resuelto(pos),'no se sigue jugando después de salir');
  assert.ok(M.puede(nivel,pos,i,d),`movida ilegal ${i},${d}`);
  pos=M.aplica(pos,i,d);n++;
 }
 return {n,salio:M.resuelto(pos),pos};
}
/* Una movida de ida y vuelta que deja el estacionamiento como estaba: el
   primer vehículo que tenga hueco, una casilla y de regreso. */
function idaYVuelta(nivel){
 const m=M.movimientos(nivel,nivel.pos).find(([i,d])=>Math.abs(d)===1&&!(i===0&&nivel.pos[0]+d===M.META));
 assert.ok(m,'algo se puede mover al empezar');
 return [[m[0],m[1]],[m[0],-m[1]]];
}

/* ---------- Un segundo solucionador, independiente del motor ----------
   Trabaja sobre el texto de 36 letras: busca cada vehículo por su letra,
   lo corre casilla a casilla en el texto mismo y usa el texto como clave.
   Más lento, pero no comparte ni una línea con motor.js. */
function minimoIndependiente(texto){
 const deslizamientos=t=>{
  const out=[],vistos=new Set();
  for(let k=0;k<36;k++){
   const l=t[k];if(l==='o'||l==='x'||vistos.has(l))continue;vistos.add(l);
   const cs=[];for(let j=0;j<36;j++)if(t[j]===l)cs.push(j);
   const h=cs[1]-cs[0]===1,paso=h?1:6;
   for(const s of [-1,1]){
    let a=t.split(''),cola=cs.slice();
    while(true){
     const frente=s>0?cola[cola.length-1]+paso:cola[0]-paso;
     if(frente<0||frente>35||a[frente]!=='o')break;
     if(h&&Math.floor(frente/6)!==Math.floor(cola[0]/6))break;   // no se sale de su fila
     const atras=s>0?cola[0]:cola[cola.length-1];
     a[frente]=l;a[atras]='o';
     cola=cola.map(c=>c+s*paso);
     out.push(a.join(''));
    }
   }
  }
  return out;
 };
 const fuera=t=>t[16]==='A'&&t[17]==='A';                        // el rojo en las columnas 4-5 de la fila 2
 if(fuera(texto))return 0;
 const visto=new Set([texto]);let frente=[texto],d=0;
 while(frente.length){
  d++;const sig=[];
  for(const t of frente)for(const n of deslizamientos(t)){
   if(visto.has(n))continue;
   if(fuera(n))return d;
   visto.add(n);sig.push(n);
  }
  frente=sig;
 }
 return null;
}

test('el motor: leer, mover, alcance, ganar y rechazar niveles mal escritos',()=>{
 const n=M.lee('ooooBoooooBoAAoxBooCCCoooooooooooooo'.slice(0,36));
 assert.equal(n.vehiculos[0].l,'A');assert.equal(n.vehiculos[0].h,true);assert.equal(n.pos[0],0);
 const B=n.vehiculos.findIndex(v=>v.l==='B');
 assert.equal(n.vehiculos[B].h,false);assert.equal(n.vehiculos[B].largo,3);
 assert.equal(M.texto(n,n.pos),'ooooBoooooBoAAoxBooCCCoooooooooooooo'.slice(0,36));
 assert.deepEqual(M.alcance(n,n.pos,0),[0,1]);                     // el rojo choca con el cono
 assert.ok(M.puede(n,n.pos,0,1));assert.ok(!M.puede(n,n.pos,0,2));assert.ok(!M.puede(n,n.pos,0,0));assert.ok(!M.puede(n,n.pos,9,1));
 const p2=M.aplica(n.pos,0,1);assert.equal(p2[0],1);assert.equal(n.pos[0],0,'aplica no toca el original');
 assert.throws(()=>M.lee('o'.repeat(35)));                         // largo equivocado
 assert.throws(()=>M.lee('o'.repeat(36)));                         // sin auto rojo
 assert.throws(()=>M.lee('AA'+'o'.repeat(34)));                    // rojo fuera de la fila de salida
 assert.throws(()=>M.lee('o'.repeat(12)+'AAAooo'+'o'.repeat(18))); // rojo de largo 3
 assert.throws(()=>M.lee('Boooooo'.slice(0,6)+'o'.repeat(6)+'AAoooo'+'o'.repeat(18))); // vehículo de una casilla
 assert.equal(M.resuelve(M.lee('o'.repeat(12)+'ooooAA'+'o'.repeat(18))).length,0); // ya está afuera
 assert.equal(M.resuelve(M.lee('o'.repeat(12)+'AAoooo'+'o'.repeat(18))).length,1); // un solo deslizamiento, aunque sean cuatro casillas
 // Encerrado sin remedio: un camión de lado delante en su misma fila no existe, pero un cono sí.
 assert.equal(M.resuelve(M.lee('o'.repeat(12)+'AAxooo'+'o'.repeat(18))),null);
});

test('las estrellas: tres con el mínimo, dos con un tercio más (y al menos dos de margen), una con cualquier cosa',()=>{
 assert.deepEqual(M.limites(1),{tres:1,dos:3});
 assert.deepEqual(M.limites(4),{tres:4,dos:6});
 assert.deepEqual(M.limites(12),{tres:12,dos:16});
 assert.deepEqual(M.limites(40),{tres:40,dos:54});
 assert.equal(M.estrellas(12,12),3);assert.equal(M.estrellas(13,12),2);assert.equal(M.estrellas(16,12),2);assert.equal(M.estrellas(17,12),1);
 assert.equal(M.anota(null,0,12,1000,12).estrellas,3);
 assert.equal(M.anota(null,0,14,1000,12).estrellas,2);
});

test('los niveles: seis pisos de 40, ordenados del más corto al más largo y sin repetidos',()=>{
 assert.equal(N.pisos.length,6);
 for(const p of N.pisos){assert.equal(p.niveles.length,40,p.nombre);assert.ok(p.id&&p.nombre&&p.desc);}
 assert.equal(NIVELES.length,240);
 assert.equal(new Set(NIVELES.map(n=>n.texto)).size,240,'ningún nivel repetido');
 for(let i=1;i<NIVELES.length;i++)assert.ok(NIVELES[i].optimo>=NIVELES[i-1].optimo,`el nivel ${i+1} no es más corto que el ${i}`);
 assert.ok(NIVELES[0].optimo>=2,'el primero ya pide pensar un poco');
 assert.ok(NIVELES[239].optimo>=35,'la bóveda tiene atascos largos de verdad');
 for(const n of NIVELES){
  const nivel=M.lee(n.texto);                                     // se lee sin errores
  assert.ok(!M.resuelto(nivel.pos),'no empieza ya resuelto');
  assert.ok(nivel.vehiculos.length<=16,'cabe en la clave del motor');
 }
});

test('todos los niveles tienen salida y el mínimo escrito es el verdadero (dos solucionadores)',()=>{
 for(const [k,n] of NIVELES.entries()){
  const nivel=M.lee(n.texto),sol=M.resuelve(nivel);
  assert.ok(sol,`el nivel ${k+1} no tiene salida`);
  assert.equal(sol.length,n.optimo,`nivel ${k+1}: el motor encuentra ${sol.length}, el archivo dice ${n.optimo}`);
  assert.equal(minimoIndependiente(n.texto),n.optimo,`nivel ${k+1}: el solucionador independiente no está de acuerdo`);
 }
});

test('cada nivel se puede terminar con ★★★, con ★★ y con ★ (jugándolo de verdad)',()=>{
 const cuenta={1:0,2:0,3:0};
 for(const [k,n] of NIVELES.entries()){
  const nivel=M.lee(n.texto),sol=M.resuelve(nivel),l=M.limites(n.optimo),iv=idaYVuelta(nivel);
  // ★★★: la solución mínima, tal cual.
  const tres=juega(nivel,sol);
  assert.ok(tres.salio,`nivel ${k+1}: la solución no saca el auto`);assert.equal(M.estrellas(tres.n,n.optimo),3);
  // ★★: una ida y vuelta antes de la solución (dos movidas de más).
  const dos=juega(nivel,[...iv,...sol]);
  assert.ok(dos.salio);assert.ok(dos.n>l.tres&&dos.n<=l.dos,`nivel ${k+1}: ${dos.n} movidas no caen en ★★`);
  assert.equal(M.estrellas(dos.n,n.optimo),2);
  // ★: tantas idas y vueltas como hagan falta para pasarse del margen de ★★.
  const vueltas=Math.floor((l.dos-n.optimo)/2)+1,relleno=[];
  for(let v=0;v<vueltas;v++)relleno.push(...iv);
  const una=juega(nivel,[...relleno,...sol]);
  assert.ok(una.salio);assert.ok(una.n>l.dos,`nivel ${k+1}: ${una.n} movidas todavía dan ★★`);
  assert.equal(M.estrellas(una.n,n.optimo),1);
  // Y el progreso anota lo que corresponde, sin bajar nunca lo ganado.
  let prog=M.anota(null,k,una.n,9000,n.optimo).prog;assert.equal(prog.n[k][0],1);cuenta[1]++;
  const r2=M.anota(prog,k,dos.n,8000,n.optimo);assert.ok(r2.mejora);assert.equal(r2.prog.n[k][0],2);cuenta[2]++;
  const r3=M.anota(r2.prog,k,tres.n,7000,n.optimo);assert.ok(r3.mejora);assert.equal(r3.prog.n[k][0],3);cuenta[3]++;
  const otra=M.anota(r3.prog,k,una.n,500,n.optimo);assert.ok(!otra.mejora);assert.equal(otra.prog.n[k][0],3,'una peor no baja las estrellas');
  assert.equal(otra.prog.n[k][1],n.optimo,'se queda con el menor número de movidas');assert.equal(otra.prog.n[k][2],500,'y con el mejor tiempo');
 }
 assert.deepEqual(cuenta,{1:240,2:240,3:240});
});

test('el progreso: se junta con lo mejor de cada copia y los pisos se abren con la mitad de las estrellas',()=>{
 const a={v:1,n:{0:[3,4,5000],1:[1,20,9000]}},b={v:1,n:{1:[2,15,12000],2:[1,30,1000]}};
 assert.deepEqual(M.mezclaProgreso(a,b).n,{0:[3,4,5000],1:[2,15,9000],2:[1,30,1000]});
 assert.deepEqual(M.mezclaProgreso(a,null).n,a.n);
 assert.deepEqual(M.limpiaProgreso({n:{0:[9,1,1],1:[2,0,5],x:[3,3,3],5:'no',3:[2,7,-4]}}).n,{3:[2,7,0]},'descarta lo que no tiene sentido');
 assert.deepEqual(M.totales(a),{estrellas:4,tiempo:14000,niveles:2});
 const P=N.pisos,ini2=40;
 let prog={v:1,n:{}};
 assert.ok(M.nivelAbierto(prog,P,0));assert.ok(!M.nivelAbierto(prog,P,1),'el segundo espera al primero');
 assert.ok(!M.pisoAbierto(prog,P,1));assert.ok(!M.nivelAbierto(prog,P,ini2));
 for(let i=0;i<30;i++)prog.n[i]=[2,10,1000];                        // 60 estrellas en La calle
 assert.ok(M.pisoAbierto(prog,P,1),'60 de 120 abren el Subterráneo 1');assert.ok(M.nivelAbierto(prog,P,ini2));
 prog.n[29]=[1,10,1000];                                            // 59: vuelve a cerrar
 assert.ok(!M.pisoAbierto(prog,P,1));
});

test('los dibujos: un SVG bien formado para cada vehículo de cada nivel',()=>{
 const vistos=new Set();
 for(const n of NIVELES)for(const v of M.lee(n.texto).vehiculos){
  const k=v.l+v.h+v.largo;if(vistos.has(k))continue;vistos.add(k);
  const s=DIB.svg(v);
  assert.match(s,/^<svg viewBox="0 0 \d+ \d+"[^>]*role="img"[^>]*aria-label="[^"]+">/);assert.ok(s.endsWith('</svg>'));
  assert.doesNotMatch(s,/undefined|NaN|<script|href=/);
  const abre=(s.match(/<g\b/g)||[]).length,cierra=(s.match(/<\/g>/g)||[]).length;assert.equal(abre,cierra,'cada <g> se cierra');
  assert.ok(DIB.nombre(v).length>2);
 }
 assert.equal(DIB.aspecto({l:'A',h:true,largo:2}).modelo,'rojo');
 assert.equal(DIB.nombre({l:'A',h:true,largo:2}),'el auto rojo');
 assert.equal(DIB.oscuro('#ffffff',.5),'#808080');
});

test('la canción: el tema «atasco» está en el cancionero y en el reproductor de la cabecera',()=>{
 const T=require('../../juegos/audio/temas.js');
 const t=T.temas.atasco;assert.ok(t,'existe');assert.equal(t.bpm,124);
 for(const s of t.orden.split(/\s+/))assert.ok(t.secciones[s.replace(/[+-]\d+$/,'')],s);
 assert.match(fs.readFileSync(path.join(__dirname,'../src/juegos/sonido.js'),'utf8'),/chip: "atasco"/);
});

test('las estrellas pasan por el club, por las reglas y por la página',()=>{
 const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
 const ctx={};vm.createContext(ctx);
 vm.runInContext(sin('src/juegos/solo/club-datos.js')+';globalThis.__C={categoriaClub,resultadoClub};',ctx);
 const C=ctx.__C;
 assert.ok(C.categoriaClub('atasco','club-atasco-estrellas'));
 assert.ok(!C.categoriaClub('atasco','club-atasco-otra'));assert.ok(!C.categoriaClub('atasco','club-fanal-travesia'));
 const r=puntos=>C.resultadoClub('atasco',{categoria:'club-atasco-estrellas',puntos,tiempo:60000,partida:'abc-1'});
 assert.ok(r(1));assert.ok(r(720));assert.equal(r(3001),null);
 const reglas=fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8');
 assert.match(reglas,/\|club-atasco-estrellas\|/);
 assert.match(reglas,/fanal\|atasco(\|[a-z]+)*\)\$\/\)/);  // atasco en clubJugadas (puede haber juegos después)
 const html=fs.readFileSync(path.join(D,'index.html'),'utf8');
 for(const f of ['motor','niveles','dibujo','game'])assert.match(html,new RegExp(f+'\\.js\\?v=atasco-\\d+'));
 assert.match(html,/estilo\.css\?v=atasco-\d+/);
 assert.match(html,/i18n\.js\?v=/);assert.match(html,/conexion\.js\?v=club-\d+/);assert.match(html,/volumen\.js\?v=/);assert.match(html,/mando\.js\?v=/);
 // Cada id que game.js busca existe en la página.
 const js=fs.readFileSync(path.join(D,'game.js'),'utf8');
 for(const [,id] of js.matchAll(/\$\("([A-Za-z-]+)"\)/g))assert.match(html,new RegExp(`id="${id}"`),'falta #'+id);
});

test('sin pistas, y hecho para el dedo (reglas táctiles que no deben perderse)',()=>{
 const html=fs.readFileSync(path.join(D,'index.html'),'utf8'),js=fs.readFileSync(path.join(D,'game.js'),'utf8'),css=fs.readFileSync(path.join(D,'estilo.css'),'utf8');
 // Las pistas se quitaron a pedido: ni botón, ni tecla, ni tope de estrellas.
 assert.doesNotMatch(html,/btnPista|fantasma/);assert.doesNotMatch(js,/pista\(|btnPista|KeyH|globo\(/);
 assert.equal(M.anota.length,5,'anota ya no recibe un tope');
 // Los autos no dejan desplazar la página al arrastrarlos; el asfalto vacío sí.
 assert.match(css,/\.veh\{[^}]*touch-action:none/);assert.match(css,/\.lote\{[^}]*touch-action:manipulation/);
 // iPhone: ni selección ni menú de pulsación larga (dejaba el auto pegado al dedo).
 assert.match(css,/-webkit-touch-callout:none/);assert.match(css,/\.veh,\.veh \*[^{]*\{[^}]*user-select:none/);
 assert.match(js,/lostpointercapture/);assert.match(js,/contextmenu/);
 // El «hover» solo donde hay ratón, botones de 46 px para el dedo y el tablero a lo alto de la pantalla.
 assert.doesNotMatch(css.replace(/@media \(hover:hover\)\{[^{}]*\{[^}]*\}\}/g,''),/:hover\{/);
 assert.match(css,/@media \(pointer:coarse\)\{[^]*min-height:46px/);
 assert.match(css,/--alto-pantalla/);assert.match(js,/window\.top\.innerHeight/);assert.match(css,/html\.apaisado #vistaJuego/);
});
