/* Antitrampas de Mina Club: partidas honestas jugadas por un robot con el
   mismo motor (juegos/club/minas/engine.js) pasan; cada vía de trampa se
   rechaza. Ver docs/antitrampas/minas.md. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const carga=(entry,extra='')=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text+extra)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const MV=carga('src/juegos/solo/verifica/minas.js');
const Mina=require('../../juegos/club/minas/engine.js');
// Un azar fijo para los ritmos irregulares de las partidas humanas.
const lcg=s=>()=>(s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296;

/* Un robot que juega como game.js anota: conoce las minas (es un robot),
   así que solo despeja. Cada jugada cuesta `paso(k)` ms de juego; la pared
   avanza lo mismo más lo que duren las pausas. Con `banderas`, marca las
   minas que bordean lo abierto y usa acordes, como un jugador avanzado.
   `gesto(k)` da la forma de cada jugada [origen, movs, msGesto]: por
   defecto, un ratón de verdad (0–3 movimientos, 40–140 ms apretado). */
const R=lcg(99);
const humano=()=>150+Math.floor(R()*1200);
const raton=()=>[0,Math.floor(R()*4),40+Math.floor(R()*100)];
function juega(nivel,semilla,{paso=()=>400,banderas=false,pausas={},pared=d=>d,primera,gesto=raton}={}){
  const g=new Mina.Game(nivel,Mina.azar(semilla)),e=[];
  let t=0,w=0,pt=0,pw=0,k=0;
  const anota=c=>{e.push(c,t-pt,e.length?w-pw:0,...(c<0?[0,0,-1]:gesto(k)));pt=t;pw=w;};
  const avanza=k=>{const d=paso(k);t+=d;w+=pared(d);};
  const inicio=primera??(Math.floor(g.rows/2)*g.cols+Math.floor(g.cols/2));
  g.open(inicio);anota(inicio*2);
  while(g.state==='playing'){
    k++;
    if(pausas[k]){avanza(k);anota(-1);w+=pausas[k];}
    let hecho=false;
    if(banderas){
      for(let i=0;i<g.cells.length&&!hecho;i++){const c=g.cells[i];
        if(c.mine&&!c.flag&&g.neighbors(i).some(n=>g.cells[n].open)&&g.flags<g.mines){avanza(k);g.flag(i);anota(i*2+1);hecho=true;}}
      for(let i=0;i<g.cells.length&&!hecho;i++){const c=g.cells[i];
        if(!c.open||!c.count)continue;const v=g.neighbors(i);
        if(v.filter(n=>g.cells[n].flag).length===c.count&&v.some(n=>!g.cells[n].open&&!g.cells[n].flag)){avanza(k);if(g.open(i).length){anota(i*2);hecho=true;}}}
    }
    if(!hecho){const i=g.cells.findIndex(c=>!c.mine&&!c.open&&!c.flag);avanza(k);g.open(i);anota(i*2);}
  }
  assert.equal(g.state,'won');
  return {dato:{categoria:'club-minas-'+nivel,puntos:1,tiempo:Math.max(1,t),partida:'p'},prueba:{v:1,n:nivel,s:semilla,u:'uid1',e}};
}
const vale=async({dato,prueba})=>V.verificaClub('minas',dato,prueba);
const copia=x=>JSON.parse(JSON.stringify(x));

test('Minas antitrampas: partidas honestas pasan (lentas, rápidas, con banderas y pausas)',async()=>{
  assert.equal(MV.PRUEBA,1);
  for(const nivel of ['easy','medium','hard'])for(const s of [1,77,4242]){
    const r=lcg(s);
    // Lenta: entre 0,5 y 6 s por jugada.
    assert.equal(await vale(juega(nivel,s,{paso:()=>500+Math.floor(r()*5500)})),null,nivel+' lenta');
    // Rápida pero humana: 110–200 ms por jugada (5–9 por segundo).
    assert.equal(await vale(juega(nivel,s,{paso:()=>110+Math.floor(r()*90)})),null,nivel+' rápida');
    // Con banderas y acordes, y dos pausas largas (cambió de pestaña).
    assert.equal(await vale(juega(nivel,s,{banderas:true,paso:()=>200+Math.floor(r()*600),pausas:{3:60000,9:5000}})),null,nivel+' banderas');
  }
  // Dos dedos a la vez en el móvil: una pareja de jugadas en el mismo ms.
  assert.equal(await vale(juega('medium',9,{paso:k=>k%7?250+Math.floor(R()*400):0})),null,'pareja simultánea');
  // Con teclado, con un mando (teclas sintéticas de mando.js con el mando
  // conectado) y con «tap to click» del panel táctil (gestos de 2–6 ms).
  assert.equal(await vale(juega('medium',10,{paso:humano,gesto:()=>[4,0,-1]})),null,'teclado');
  assert.equal(await vale(juega('medium',11,{paso:humano,gesto:()=>[6,0,-1]})),null,'mando');
  assert.equal(await vale(juega('hard',12,{paso:humano,gesto:()=>[0,0,2+Math.floor(R()*5)]})),null,'tap to click');
  assert.equal(await vale(juega('easy',13,{paso:humano,gesto:()=>[8,Math.floor(R()*6),60+Math.floor(R()*90)]})),null,'táctil');
  // Muy rápida pero humana, en el fácil: ~8 por segundo con ráfagas.
  assert.equal(await vale(juega('easy',14,{paso:k=>k===1?180:80+Math.floor(R()*120)})),null,'fácil muy rápido');
  // El portátil se durmió sin avisar: un intervalo de pared enorme suelto.
  const dormido=juega('hard',9,{paso:()=>700+Math.floor(R()*900)});dormido.prueba.e[6*20+2]+=3600000;
  assert.equal(await vale(dormido),null,'una hora de pared en un solo intervalo');
});

test('Minas antitrampas: ganar con el primer clic es legítimo (1 de cada ~20 000)',async()=>{
  let s=0,g;
  do{s++;g=new Mina.Game('easy',Mina.azar(s));g.open(44);}while(g.state!=='won');
  const p={dato:{categoria:'club-minas-easy',puntos:1,tiempo:1,partida:'p'},prueba:{v:1,n:'easy',s,e:[88,0,0,0,1,95]}};
  assert.equal(await vale(p),null);
});

test('Minas antitrampas: cada vía de trampa se rechaza',async()=>{
  const base=juega('medium',31337,{paso:()=>250+Math.floor(R()*700)});
  // Club.result a mano desde la consola, sin prueba.
  assert.match(await V.verificaClub('minas',base.dato,null),/sin prueba/);
  assert.match(await V.verificaClub('minas',base.dato,undefined),/sin prueba/);
  // Puntos que no son 1.
  assert.match(await vale({...base,dato:{...base.dato,puntos:2}}),/valen 1/);
  // Tiempo recortado a mano.
  assert.match(await vale({...base,dato:{...base.dato,tiempo:Math.floor(base.dato.tiempo/2)}}),/tiempo declarado/);
  // La prueba de una partida de fácil presentada como difícil.
  const facil=juega('easy',5);
  assert.match(await vale({dato:{...facil.dato,categoria:'club-minas-hard'},prueba:facil.prueba}),/otra dificultad/);
  // Las jugadas de una partida con otra semilla (otro reparto de minas).
  const otra=copia(base.prueba);otra.s=(otra.s+1)>>>0;
  assert.ok(await vale({dato:base.dato,prueba:otra}));
  // Prueba manipulada: falta la última jugada, o una casilla cambiada.
  const corta=copia(base.prueba);corta.e.splice(-6);assert.match(await vale({dato:base.dato,prueba:corta}),/no ganan/);
  const cambiada=copia(base.prueba);cambiada.e[6*5]=cambiada.e[0];assert.ok(await vale({dato:base.dato,prueba:cambiada}));
  // Jugadas después de ganar.
  const larga=copia(base.prueba);larga.e.push(0,100,100,0,1,80);assert.match(await vale({dato:base.dato,prueba:larga}),/después de terminar/);
  // El reloj corriendo antes del primer clic.
  const antes=copia(base.prueba);antes.e[1]=5000;assert.match(await vale({dato:{...base.dato,tiempo:base.dato.tiempo+5000},prueba:antes}),/antes del primer clic/);
  // Formato roto.
  for(const roto of [{...base.prueba,v:2},{...base.prueba,s:-1},{...base.prueba,e:[1,2]},{...base.prueba,e:[1.5,0,0,0,0,0]},{...base.prueba,e:base.prueba.e.slice(3)},{...base.prueba,u:7}])
    assert.ok(await vale({dato:base.dato,prueba:roto}));
  assert.equal(await vale(base),null);
  // Un bot: jugadas cada 15 ms.
  assert.match(await vale(juega('hard',8,{paso:k=>k===1?400:15})),/por segundo/);
  // Una ráfaga de diez jugadas en 180 ms dentro de una partida normal.
  assert.match(await vale(juega('hard',8,{paso:k=>k>=40&&k<50?20:300+Math.floor(R()*900)})),/rápidas/);
  // Un bot que se disimula a 50 ms (20 por segundo sostenido).
  assert.match(await vale(juega('hard',8,{paso:k=>k===1?400:50+Math.floor(R()*10)})),/por segundo/);
  // Reloj frenado: performance.now a un tercio, Date.now intacto.
  assert.match(await vale(juega('hard',8,{paso:()=>200+Math.floor(R()*500),pared:d=>d*3})),/más lento/);
  assert.match(await vale(juega('medium',8,{paso:()=>350+Math.floor(R()*500),pared:d=>Math.round(d/.55)})),/más lento/);
  // Bots. Eventos sintéticos (el.click(), dispatchEvent): isTrusted falso.
  assert.match(await vale(juega('hard',8,{paso:humano,gesto:()=>[1,0,-1]})),/sintéticos/);
  const unaSintetica=juega('hard',8,{paso:humano});unaSintetica.prueba.e[6*30+3]=1;
  assert.match(await vale(unaSintetica),/sintético/);
  // Un bot con clics «de verdad» (inyectados) a ritmo de metrónomo.
  assert.match(await vale(juega('medium',8,{paso:()=>300+Math.floor(R()*10),gesto:()=>[0,0,0]})),/metrónomo/);
  assert.match(await vale(juega('medium',8,{paso:()=>300+Math.floor(R()*10)})),/metrónomo/);
  // Algo menos regular pero con gestos instantáneos.
  assert.match(await vale(juega('medium',8,{paso:()=>270+Math.floor(R()*70),gesto:()=>[0,0,1]})),/instantáneos/);
  // Reacción imposible: la segunda jugada a 30 ms del primer clic.
  assert.match(await vale(juega('medium',8,{paso:k=>k===1?30:humano()})),/antes de poder ver/);
  // Los datos reales: 9 ms en fácil, 15 en medio, 29 en difícil.
  for(const [nivel,total] of [['easy',9],['medium',15],['hard',29]]){
    const p=juega(nivel,21,{paso:()=>0});const n=p.prueba.e.length/6;
    const r=juega(nivel,21,{paso:k=>k<=total%n?Math.ceil(total/n):Math.floor(total/n)});
    assert.ok(await vale(r),nivel);
  }
  // Pensar en pausa: pausa, clic, pausa, clic…
  const pausas={};for(let k=1;k<200;k+=2)pausas[k]=4000;
  assert.match(await vale(juega('medium',8,{paso:()=>120+Math.floor(R()*200),pausas})),/pausas/);
});

test('Minas antitrampas: sospecha de filas guardadas sin prueba',()=>{
  const f=(c,tiempo,puntos=1)=>MV.sospecha('club-minas-'+c,{nombre:'x',puntos,tiempo,partida:'p'});
  assert.equal(f('easy',2500),null);assert.equal(f('medium',15000),null);assert.equal(f('hard',60000),null);
  assert.equal(f('easy',300),null);assert.equal(f('medium',2100),null);assert.equal(f('hard',10500),null);
  assert.match(f('easy',1),/primer clic/);assert.match(f('easy',120),/por debajo/);
  assert.match(f('medium',1200),/por debajo/);assert.match(f('hard',5000),/por debajo/);
  assert.match(f('hard',60000,3),/valen siempre 1/);
  assert.equal(MV.sospecha('club-snake-classic-chico',{puntos:1,tiempo:1}),null);
  assert.match(V.sospechaFila('club-minas-hard',{puntos:1,tiempo:900}),/por debajo/);
});
