/* PRO PACMAN (juegos/club/propac/): los laberintos no tienen rincones
   perdidos ni callejones, el motor es repetible, cada mecánica nueva hace
   lo que dice, y el verificador acepta la partida de un bot que gira como
   una mano y rechaza cada vía de trampa. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path'),fs=require('node:fs');
const carga=(entry)=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const VP=carga('src/juegos/solo/verifica/propac.js');
const D=path.join(__dirname,'../../juegos/club/propac');
const M=require(path.join(D,'motor.js'));
const CP='club-propac-puntos';

/* Un bot que va al punto más cercano esquivando fantasmas. `mano`: pide el
   giro antes de llegar al cruce (en mitad de la casilla, como una persona,
   y el motor lo guarda); sin ella gira en el tic exacto del centro, como un
   programa. */
function juega(semilla,u,{mano=true,max=60*60*8,v}={}){
 const E=M.nueva(semilla,u,v),jug=[];let ult=0,a=semilla*7+3,plan='';
 const azar=()=>{a=(a*1103515245+12345)>>>0;return a/4294967296;};
 const pide=(c,o)=>{if(c<=3&&(E.pac.quiere===c||(E.pac.quiere<0&&E.pac.dir===c)))return;if(M.entrada(E,c)){jug.push([E.tick-ult,c,o]);ult=E.tick;}};
 const rumbo=(sx,sy)=>{
  const m=E.mapa,W=m.ancho,peligro=new Set();
  for(const g of E.fantasmas)if(g.estado==='caza'||g.estado==='disperso'||g.estado==='sale'){
   const gx=M.casilla(g.x),gy=M.casilla(g.y);
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(Math.abs(dx)+Math.abs(dy)<=2)peligro.add((gy+dy)*W+((gx+dx+W)%W));
  }
  const ini=sy*W+sx,prev=new Map([[ini,null]]),q=[[sx,sy]];
  while(q.length){
   const [x,y]=q.shift(),k=y*W+x;
   if(k!==ini&&(m.comida[k]||(E.item&&E.item.x===x&&E.item.y===y))){let c=k;while(prev.get(c)[0]!==ini)c=prev.get(c)[0];return prev.get(c)[1];}
   for(let d=0;d<4;d++){const nx=(x+M.DIRS[d][0]+W)%W,ny=y+M.DIRS[d][1],nk=ny*W+nx;
    if(prev.has(nk)||!M.libre(E,nx,ny,E.pac)||peligro.has(nk))continue;prev.set(nk,[k,d]);q.push([nx,ny]);}
  }
  return Math.floor(azar()*4);
 };
 while(E.estado!=='fin'&&E.tick<max){
  const p=E.pac;
  if(E.estado==='jugando'){
   const centro=M.enCentro(p),tx=M.casilla(p.x),ty=M.casilla(p.y);
   if(!mano&&centro)pide(rumbo(tx,ty),'k');
   if(mano){
    // La próxima casilla cuyo centro va a pisar, y el giro pedido antes de llegar.
    const [dx,dy]=M.DIRS[p.dir],off=dx*(p.x%M.U-M.C)+dy*(p.y%M.U-M.C);
    const nx=off<0?tx:(tx+dx+E.mapa.ancho)%E.mapa.ancho,ny=off<0?ty:ty+dy,clave=E.nivel+':'+E.vidas+':'+nx+','+ny;
    if(!centro&&(clave!==plan||E.tick%4===0)){plan=clave;const d=rumbo(nx,ny);if(d!==M.OPUESTA[p.dir])pide(d,'t');}
    if(centro&&!M.libre(E,tx+dx,ty+dy,p)){plan='';pide(rumbo(tx,ty),'t');}
   }
   if(E.energia>=M.TURBO_COSTO&&azar()<0.02)pide(4,'t');
   if(E.pulsos&&azar()<0.01)pide(5,'t');
  }
  M.paso(E);E.ev.length=0;
 }
 return {E,jug};
}
const ms=n=>Math.max(1,Math.round(n*1000/60));
const prueba=(s,u,op)=>{const {E,jug}=juega(s,u,op),t=ms(E.tick);return {E,jug,dato:{categoria:CP,puntos:E.puntos,tiempo:t},p:{v:E.v,s,u,j:M.codifica(jug),n:E.tick,r:t+50,a:t+20,w:t+120}};};

test('los tres laberintos: 19 × 21, todo alcanzable, sin callejones, casa de tres',()=>{
 for(let i=0;i<M.MAPAS.length;i++){
  const m=M.leeMapa(i),W=m.ancho,H=m.alto;
  assert.deepEqual([W,H],[19,21],m.nombre);
  assert.ok(M.MAPAS[i].filas.every(f=>f.length===W),m.nombre+': filas parejas');
  assert.equal(m.casa.length,3,m.nombre);
  assert.ok(m.pac&&m.puerta&&m.item,m.nombre);
  const ab=(x,y)=>{if(y<0||y>=H)return false;const t=m.tipo[y*W+((x+W)%W)];return t===M.LIBRE||t===M.TUNEL||t===M.COMPUERTA;};
  const vis=new Set([m.pac[1]*W+m.pac[0]]),q=[m.pac];
  while(q.length){const [x,y]=q.shift();for(const [dx,dy] of M.DIRS){const nx=(x+dx+W)%W,ny=y+dy;if(ab(nx,ny)&&!vis.has(ny*W+nx)){vis.add(ny*W+nx);q.push([nx,ny]);}}}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(ab(x,y)){
   assert.ok(vis.has(y*W+x),`${m.nombre}: ${x},${y} no se alcanza`);
   const sobre=x===m.puerta[0]&&y===m.puerta[1]-1;
   if(!sobre)assert.ok(M.DIRS.filter(([dx,dy])=>ab(x+dx,y+dy)).length>=2,`${m.nombre}: ${x},${y} es un callejón`);
  }
  assert.ok(m.total>=140,m.nombre+': puntos');
 }
 assert.equal(M.leeMapa(0).compuertas,0,'Neón no tiene compuertas');
 assert.ok(M.leeMapa(1).compuertas>0&&M.leeMapa(2).compuertas>0);
});

test('el motor es repetible y la cuenta va en el azar',()=>{
 for(const s of [11,2026,987654321]){
  const {E,jug}=juega(s,'ana');
  assert.equal(E.estado,'fin');
  assert.ok(E.nivel>=2,'el bot pasa al menos un nivel ('+E.nivel+')');
  const r=M.rehace(s,'ana',M.decodifica(M.codifica(jug)),E.tick);
  assert.ok(r.E,r.error);
  assert.deepEqual([r.E.puntos,r.E.tick,r.E.nivel,r.E.estado],[E.puntos,E.tick,E.nivel,E.estado]);
  const otra=M.rehace(s,'beto',jug,E.tick);
  assert.ok(otra.error||otra.E.puntos!==E.puntos,'otra cuenta reparte otro azar');
 }
 assert.deepEqual(M.decodifica('k30,t019,m5rs'),[[0,3,'k'],[45,0,'t'],[1000,5,'m']]);
 assert.equal(M.decodifica('k3'),null);assert.equal(M.decodifica('k60'),null);assert.equal(M.decodifica('q30'),null);
 assert.equal(M.rehace(1,'a',[[5,9]],100).error!==undefined,true);
});

test('racha, turbo, pulso, compuertas, Glitch y vidas',()=>{
 // Racha: ×1 hasta 12 puntos seguidos, ×2 desde 13, tope ×5.
 const E=M.nueva(1,'a');
 for(const [r,x] of [[0,1],[12,1],[13,2],[25,3],[49,5],[500,5]]){E.racha=r;assert.equal(M.multiplicador(E),x,'racha '+r);}
 // Turbo: sin energía no; con 35 gasta y acelera.
 const T=M.nueva(2,'a');T.congelado=0;
 assert.equal(M.entrada(T,4),false);
 T.energia=40;assert.equal(M.entrada(T,4),true);assert.equal(T.energia,5);assert.equal(T.turboT,M.TURBO_TICS);
 assert.equal(M.entrada(T,4),false,'no se encadena');
 // Pulso: aturde a los cercanos y da 100 por cada uno.
 const P=M.nueva(3,'a');P.congelado=0;P.pulsos=1;
 const g=P.fantasmas[0];g.estado='caza';g.x=P.pac.x+3*M.U;g.y=P.pac.y;
 const lejos=P.fantasmas[1];lejos.estado='caza';lejos.x=P.pac.x+12*M.U;
 assert.equal(M.entrada(P,5),true);
 assert.equal(g.estado,'aturdido');assert.equal(lejos.estado,'caza');assert.equal(P.puntos,100);assert.equal(P.pulsos,0);
 assert.equal(M.entrada(P,5),false,'sin cargas no hay pulso');
 for(let i=0;i<M.PULSO_TICS+2;i++)M.paso(P);
 assert.notEqual(g.estado,'aturdido','el aturdimiento se pasa');
 // Compuertas: abiertas al empezar, cerradas tras COMPUERTA_TICS, y cierran el paso.
 const C=M.nueva(4,'a');C.nivel=2;C.mapa=M.leeMapa(1);
 const i=C.mapa.tipo.indexOf(M.COMPUERTA),cx=i%C.mapa.ancho,cy=Math.floor(i/C.mapa.ancho);
 assert.equal(M.libre(C,cx,cy,C.pac),true);
 C.compT=M.COMPUERTA_TICS;assert.equal(M.abiertas(C),false);assert.equal(M.libre(C,cx,cy,C.pac),false);
 assert.equal(M.libre(C,cx,cy,C.fantasmas[0]),false,'también para los fantasmas');
 // Glitch, el quinto fantasma, desde el nivel 3, y salta tras avisar.
 assert.equal(M.nueva(5,'a').fantasmas.length,4,'en el nivel 1 son cuatro');
 const L=M.nueva(6,'a');L.nivel=2;L.restantes=0;L.congelado=0;M.paso(L);
 for(let n=0;n<200&&L.nivel<3;n++)M.paso(L);
 assert.equal(L.nivel,3);assert.equal(L.fantasmas.length,5);
 const gl=L.fantasmas[4];gl.estado='caza';gl.glitchT=M.GLITCH_CADA-1;L.congelado=0;
 L.pac.x=M.centro(L.mapa.pac[0]);L.pac.y=M.centro(L.mapa.pac[1]);
 const evs=[];for(let n=0;n<M.AVISO_TICS+3;n++){M.paso(L);evs.push(...L.ev.map(e=>e.k));L.ev.length=0;if(L.estado!=='jugando')break;}
 assert.ok(evs.includes('glitch-aviso'));
 if(L.estado==='jugando')assert.ok(evs.includes('glitch'),'salta después del aviso');
 // Vidas: una más a los 10 000 y cada 25 000, nunca más de 5.
 const Vd=M.nueva(7,'a'),antes=Vd.vidas;
 for(const p of [10000,35000,60000,85000,110000,135000]){Vd.puntos=p-1;Vd.fantasmas[0].estado='miedo';Vd.comidos=0;Vd.fantasmas[0].x=Vd.pac.x;Vd.fantasmas[0].y=Vd.pac.y;Vd.congelado=0;Vd.miedoT=50;M.paso(Vd);}
 assert.equal(Vd.vidas,M.VIDAS_MAX);assert.ok(Vd.vidas>antes);
});

/* Los ojos de un fantasma comido vuelven a la casa desde cualquier pasillo
   (antes podían quedar rebotando entre dos casillas junto a ella). */
test('los ojos vuelven siempre a la casa, con compuertas abiertas',()=>{
 for(let i=0;i<M.MAPAS.length;i++){
  const m=M.leeMapa(i);
  for(let y=0;y<m.alto;y++)for(let x=0;x<m.ancho;x++){
   const t=m.tipo[y*m.ancho+x];if(t!==M.LIBRE)continue;
   const E=M.nueva(1,'a');E.nivel=i+1;E.mapa=M.leeMapa(i);E.congelado=0;E.restantes=999;
   E.pac.x=E.pac.y=-999;E.fantasmas=[E.fantasmas[0]];
   const g=E.fantasmas[0];Object.assign(g,{estado:'ojos',x:M.centro(x),y:M.centro(y),dir:0,acc:0});
   let n=0;while(g.estado==='ojos'&&n<900){E.compT=0;M.paso(E);n++;}
   assert.notEqual(g.estado,'ojos',`${m.nombre}: los ojos desde ${x},${y} no llegan a la casa`);
  }
 }
});

test('el verificador acepta la partida de una mano y rechaza cada trampa',async()=>{
 const {E,dato,p}=prueba(31337,'ana');
 assert.ok(E.puntos>1000);
 assert.equal(await V.verificaClub('propac',dato,p,{uid:'ana'}),null);
 const mal=async(d,q,re)=>{const m=await V.verificaClub('propac',d,q,{uid:'ana'});assert.ok(m,'tenía que rechazar');if(re)assert.match(m,re);};
 await mal({...dato,puntos:E.puntos+10},p,/rehecha hace/);
 await mal({...dato,tiempo:dato.tiempo+17},p,/tiempo declarado/);
 await mal({...dato,categoria:'club-propac-otra'},p,/no tiene esa tabla/);
 assert.match(await V.verificaClub('propac',dato,p,{uid:'beto'}),/otra cuenta/);
 await mal(dato,{...p,v:3},/otra versión/);
 await mal(dato,{...p,v:1},/rehecha|termina antes|después/);
 await mal(dato,{...p,r:10},/reloj/);
 await mal(dato,{...p,w:2*p.a},/velocidad del juego/);
 await mal(dato,{...p,a:undefined},/relojes/);
 await mal({...dato,tiempo:ms(p.n+600)},{...p,n:p.n+600,r:p.r+10000,a:p.a+10000,w:p.w+10000},/termina antes|rehecha hace/);
 await mal(dato,{...p,j:p.j.replace(/^t/,'x')},/sintéticos/);
 await mal(dato,{...p,j:p.j+',kz5'},/no se pueden leer/);
 await mal(dato,{...p,s:-1},/semilla/);
 // El programa que gira en el tic exacto del centro.
 const b=prueba(31337,'ana',{mano:false});
 assert.match(await V.verificaClub('propac',b.dato,b.p,{uid:'ana'}),/programa/);
});

/* La v1 (la primera, más rápida) se sigue rehaciendo tal cual: los récords
   y las pruebas pendientes guardados con ella valen. */
test('las pruebas de la v1 siguen valiendo',async()=>{
 const {E,dato,p}=prueba(4242,'ana',{v:1});
 assert.equal(E.v,1);assert.equal(p.v,1);assert.ok(E.puntos>1000);
 assert.equal(await V.verificaClub('propac',dato,p,{uid:'ana'}),null);
 assert.equal(M.nueva(1,'a').v,M.PRUEBA_V);
});

test('v2: más lento que la v1 y los fantasmas del arcade',()=>{
 const nuevo=(nivel=1)=>{const E=M.nueva(9,'a');if(nivel>1){E.nivel=nivel;}E.congelado=0;return E;};
 // Velocidad: el jugador va a 85 en el nivel 1 (la v1, a 100); los fantasmas, un poco menos.
 const E=nuevo(),viejo=M.nueva(9,'a',1);viejo.congelado=0;
 const avance=(X,n)=>{const x0=X.pac.x;for(let i=0;i<n;i++)M.paso(X);return Math.abs(X.pac.x-x0);};
 const a2=avance(E,40),a1=avance(viejo,40);
 assert.ok(a2<a1,'la v2 es más lenta ('+a2+' < '+a1+')');assert.equal(a2,34);
 // Salida de la casa: Eco al tiro; Rebote espera sus puntos (18 en el nivel 1), o 4 s sin comer.
 const C=nuevo();C.pac.x=C.pac.y=-999;
 for(let i=0;i<40;i++)M.paso(C);
 assert.equal(C.fantasmas[1].estado!=='casa',true,'Eco sale al empezar');
 assert.equal(C.fantasmas[2].estado,'casa','Rebote espera');
 C.casaPuntos[2]=18;for(let i=0;i<2;i++)M.paso(C);
 assert.equal(C.fantasmas[2].estado!=='casa',true,'Rebote sale con sus puntos');
 for(let i=0;i<238;i++)M.paso(C);
 assert.equal(C.fantasmas[3].estado,'sale','Tímido sale tras 4 s sin comer');
 // Tras una muerte cuenta el contador común (Eco con 4).
 const D=nuevo();D.estado='muere';D.vidas=2;D.congelado=1;M.paso(D);
 assert.equal(D.casaGlobal,0);assert.equal(D.elroyPausa,true);
 D.congelado=0;D.pac.x=D.pac.y=-999;for(let i=0;i<40;i++)M.paso(D);
 assert.equal(D.fantasmas[1].estado,'casa','Eco espera el contador común');
 D.casaGlobal=4;for(let i=0;i<2;i++)M.paso(D);
 assert.notEqual(D.fantasmas[1].estado,'casa');
 // Eco con el error de «arriba»: cuatro delante y cuatro a la izquierda.
 const P=nuevo(),px=M.casilla(P.pac.x),py=M.casilla(P.pac.y),g1=P.fantasmas[1];g1.estado='caza';
 P.pac.dir=0;assert.deepEqual(M.objetivo(P,g1),[px-4,py-4]);
 P.pac.dir=3;assert.deepEqual(M.objetivo(P,g1),[px+4,py]);
 const P1=M.nueva(9,'a',1);P1.pac.dir=0;P1.fantasmas[1].estado='caza';
 assert.deepEqual(M.objetivo(P1,P1.fantasmas[1]),[px,py-4],'la v1 apunta derecho');
 // Rebote: el doble del vector de Rayo a dos casillas delante (también con el error).
 const r=P.fantasmas[0],g2=P.fantasmas[2];g2.estado='caza';P.pac.dir=0;
 assert.deepEqual(M.objetivo(P,g2),[2*(px-2)-M.casilla(r.x),2*(py-2)-M.casilla(r.y)]);
 // Elroy: Rayo corre más y no se va a su rincón cuando quedan pocos puntos.
 const R=nuevo();R.restantes=12;assert.equal(M.elroy(R),1);R.restantes=6;assert.equal(M.elroy(R),2);
 R.restantes=100;assert.equal(M.elroy(R),0);
 const R1=M.nueva(9,'a',1);R1.restantes=5;assert.equal(M.elroy(R1),0,'la v1 no tiene Elroy');
});

/* Un fantasma comido sale de la casa cazando aunque el susto siga; uno que
   estaba dentro sin ser comido sale azul, y con otro núcleo vuelve a
   asustarse. */
test('v2: el fantasma comido sale cazando, no azul',()=>{
 for(const v of [1,2]){
  const E=M.nueva(3,'a',v);E.congelado=0;
  const g=E.fantasmas[0];
  // Un núcleo y el fantasma encima del jugador.
  E.miedoT=2000;g.estado='miedo';g.x=E.pac.x;g.y=E.pac.y;M.paso(E);
  assert.equal(g.estado,'ojos');assert.equal(E.fantasmasComidos,1);
  E.pac.x=E.pac.y=-999;E.congelado=0;
  let n=0;while(g.estado!=='caza'&&g.estado!=='disperso'&&g.estado!=='miedo'&&n<2000){E.congelado=0;M.paso(E);n++;}
  assert.ok(E.miedoT>0,'el susto sigue');
  assert.equal(g.estado,v===1?'miedo':modo(E),'v'+v+': sale '+g.estado);
 }
 function modo(E){return E.modoIdx%2===0?'disperso':'caza';}
 // Con otro núcleo, el que volvió se asusta de nuevo.
 const E=M.nueva(3,'a');E.congelado=0;const g=E.fantasmas[0];g.comido=true;g.estado='caza';
 const m=E.mapa,k=m.comida.indexOf(2);m.comida[k]=2;E.pac.x=M.centro(k%m.ancho);E.pac.y=M.centro(Math.floor(k/m.ancho))-1;E.pac.dir=2;E.pac.acc=0;
 g.x=g.y=-999;
 for(let i=0;i<3&&E.miedoT===0;i++)M.paso(E);
 assert.ok(E.miedoT>0);assert.equal(g.estado,'miedo');assert.equal(g.comido,false);
});

test('sospecha de las filas guardadas',()=>{
 assert.equal(V.sospechaFila(CP,{puntos:50000,tiempo:200000}),null);
 assert.match(V.sospechaFila(CP,{puntos:500000,tiempo:60000}),/por segundo/);
 assert.match(V.sospechaFila(CP,{puntos:VP.MAX_PUNTOS+1,tiempo:1e8}),/admite/);
 assert.equal(V.juegoDeCategoria(CP),'propac');
});

test('el Club, las reglas y la página saben de PRO PACMAN',()=>{
 const C=carga('src/juegos/solo/club-datos.js');
 assert.ok(C.categoriaClub('propac',CP));
 assert.equal(C.categoriaClub('propac','club-propac-otra'),false);
 assert.ok(C.resultadoClub('propac',{categoria:CP,puntos:1200,tiempo:61235,partida:'abc'}));
 assert.equal(C.resultadoClub('propac',{categoria:CP,puntos:1200,tiempo:61234.7,partida:'abc'}),null);
 assert.equal(C.resultadoClub('propac',{categoria:CP,puntos:VP.MAX_PUNTOS+1,tiempo:5,partida:'abc'}),null);
 const reglas=fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8');
 assert.equal((reglas.match(/\|club-propac-puntos\|/g)||[]).length,2,'soloRanks y soloPruebas');
 assert.match(reglas,/\|hero\|propac\)\$/,'clubJugadas');
 assert.match(reglas,/\$categoria === 'club-propac-puntos' \? 10000000/,'el tope de puntos');
 const html=fs.readFileSync(path.join(D,'index.html'),'utf8');
 const orden=['i18n.js','mando.js','conexion.css','volumen.js','conexion.js','estilo.css','motor.js','juego.js'].map(f=>html.indexOf(f));
 assert.deepEqual([...orden].sort((a,b)=>a-b),orden,'el orden de carga');
 assert.ok(orden.every(i=>i>0));
 assert.match(html,/class="scorebar"/,'sitio para el volumen');
 const juego=fs.readFileSync(path.join(D,'juego.js'),'utf8');
 assert.match(juego,/Club\.inmersivo/);assert.match(juego,/Club\.result\(\{ categoria: CATEGORIA, puntos: E\.puntos, tiempo: M\.tiempoMs\(E\) \}/);
 const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8'));
 assert.match(pkg.scripts['test:juegos'],/tests\/propac\.test\.cjs/);
});
