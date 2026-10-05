/* Antitrampas de Snake Club: partidas honestas jugadas por un robot con el
   mismo motor (juegos/club/snake/motor.js) pasan, también la que arma el
   game.js de verdad; cada vía de trampa se rechaza. Ver
   docs/antitrampas/snake.md. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const carga=(entry,extra='')=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text+extra)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const SV=carga('src/juegos/solo/verifica/snake.js');
const Motor=require('../../juegos/club/snake/motor.js');
const ESPEJO={left:'right',right:'left',up:'down',down:'up'};

/* El robot: en cada tic va hacia la fruta por la casilla segura más
   cercana; después de `frutas` bocados deja de cuidarse y se enrosca sobre
   sí mismo para terminar (en los modos que atraviesan bordes no hay pared
   con que chocar); también se rinde si lleva 600 tics sin comer (en el
   laberinto puede quedarse dando vueltas a un muro). Con `ciego` no sabe
   dónde está la fruta nueva (aún no reaccionó): sigue derecho si puede.
   Elige la dirección que quiere ver en pantalla, y en el
   espejo pulsa la contraria, como haría una persona. */
function robot(m,frutas,desde=0,ciego=false){
  const h=m.snake[0],cuerpo=new Set(m.snake.slice(0,-1).map(p=>p.x+','+p.y)),muro=new Set(m.obstacles.map(p=>p.x+','+p.y));
  const envuelve=['zen','portals','laberinto'].includes(m.mode);
  const libre=d=>{let x=h.x+d.x,y=h.y+d.y;if(x<0||y<0||x>=m.COLS||y>=m.ROWS){if(!envuelve)return false;x=(x+m.COLS)%m.COLS;y=(y+m.ROWS)%m.ROWS;}const k=x+','+y;return !cuerpo.has(k)&&!muro.has(k);};
  const nombres=Object.keys(Motor.DIRS);
  if(m.eaten>=frutas||m.ticks-desde>600){const giro={right:'up',up:'left',left:'down',down:'right'};return nombres.find(n=>Motor.same(Motor.DIRS[n],m.direction))&&giro[nombres.find(n=>Motor.same(Motor.DIRS[n],m.direction))];}
  const ok=nombres.filter(n=>libre(Motor.DIRS[n])&&!(Motor.DIRS[n].x===-m.direction.x&&Motor.DIRS[n].y===-m.direction.y));
  const actual=nombres.find(n=>Motor.same(Motor.DIRS[n],m.direction));
  if(ciego)return ok.includes(actual)?actual:ok[0];
  const f=m.fruit,dist=d=>Math.abs(h.x+d.x-f.x)+Math.abs(h.y+d.y-f.y);
  return ok.sort((a,b)=>dist(Motor.DIRS[a])-dist(Motor.DIRS[b]))[0];
}
/* `reaccion()` da los ms que tarda en ver cada fruta nueva (una persona:
   150–400); sin ella, el robot es un bot de reflejos perfectos. `marca()`
   dice cómo llegó cada giro (teclado '', toque 'T', mando 'M', script 'X'). */
const R=(s=>()=>(s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296)(5);
const persona=()=>150+R()*250;
function juega(modo,tam,velocidad,semilla,{frutas=25,pared=1,reaccion=persona,marca=()=>'',nervios=0}={}){
  const m=Motor.crear({mode:modo,size:tam,speed:velocidad,semilla});let g='',ultimo=0,comidas=0,desde=0,hasta=0;
  while(m.state==='playing'&&m.ticks<200000){
    if(m.eaten!==comidas){comidas=m.eaten;desde=m.ticks;hasta=m.ticks+(reaccion?Math.ceil(reaccion()/1000/m.interval()):0);}
    let quiero=robot(m,frutas,desde,m.ticks<hasta);
    // Nervios: a veces gira sin motivo (si no es para morir).
    if(nervios&&R()<nervios&&m.eaten<frutas){const otro=robot(m,frutas,desde,true),lado=Object.keys(Motor.DIRS).find(n=>n!==otro&&n!==quiero&&!(Motor.DIRS[n].x===-m.direction.x&&Motor.DIRS[n].y===-m.direction.y));
      const h=m.snake[0],d=lado&&Motor.DIRS[lado],x=d&&h.x+d.x,y=d&&h.y+d.y;
      if(d&&x>0&&y>0&&x<m.COLS-1&&y<m.ROWS-1&&!m.snake.some(p=>p.x===x&&p.y===y)&&!m.obstacles.some(p=>p.x===x&&p.y===y))quiero=lado;}
    if(quiero&&!Motor.same(Motor.DIRS[quiero],m.direction)){const tecla=m.mirrored?ESPEJO[quiero]:quiero;if(m.enqueue(tecla)){g+=Motor.codificaGiro(ultimo,m.ticks,tecla,marca());ultimo=m.ticks;}}
    m.tick();m.ev.length=0;
  }
  assert.equal(m.state,'over',modo+' termina');
  const ms=Math.round(m.gameTime*1000);
  return {m,dato:{categoria:`club-snake-${modo}-${tam}`,puntos:m.score,tiempo:Math.max(1,ms),partida:'p'},prueba:{v:1,m:modo,t:tam,r:velocidad,s:semilla,n:m.ticks,g,w:Math.round(ms*pared),p:0,u:'uid1'}};
}
const vale=({dato,prueba})=>V.verificaClub('snake',dato,prueba);
const copia=x=>JSON.parse(JSON.stringify(x));

/* El game.js de verdad en una caja (como game.test.cjs), para comprobar
   que la prueba que arma es la que el verificador entiende. */
function juegoReal(modo,tam,velocidad){
  const noop=()=>{},enviados=[],els=new Map();
  const ctx2d=new Proxy({},{get:(_,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop:noop}):noop,set:()=>true});
  const el=()=>({textContent:'',innerHTML:'',style:{setProperty:noop},classList:{add:noop,remove:noop,toggle:noop},setAttribute:noop,addEventListener:noop,focus:noop,getBoundingClientRect:()=>({width:784,height:616}),getContext:()=>ctx2d});
  const guardado=new Map([['snake-club-v1',JSON.stringify({mode:modo,size:tam,speed:velocidad})]]);
  const sb={document:{getElementById:id=>{if(!els.has(id))els.set(id,el());return els.get(id);},querySelectorAll:()=>[],documentElement:el(),addEventListener:noop},
    window:{addEventListener:noop,SnakeMotor:Motor,Club:{storageKey:k=>k,category:noop,result:(d,prueba)=>enviados.push({dato:{...d,partida:'p'},prueba:JSON.parse(JSON.stringify(prueba))})}},
    matchMedia:()=>({matches:true}),localStorage:{getItem:k=>guardado.get(k),setItem:(k,v)=>guardado.set(k,v)},location:{search:'?cuenta=uid1'},URLSearchParams,
    ResizeObserver:class{observe(){}},requestAnimationFrame:noop,devicePixelRatio:1,setTimeout:noop,clearTimeout:noop};
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../../juegos/club/snake/game.js'),'utf8').replace(/\}\)\(\);\s*$/,'globalThis.motor=()=>m;globalThis.api={start,step,enqueue,pause,frame};})();'),sb);
  return {api:sb.api,motor:sb.motor,enviados};
}

test('Snake antitrampas: partidas honestas pasan en los seis modos, tamaños y velocidades',async()=>{
  assert.equal(SV.PRUEBA,1);
  let n=0;
  for(const modo of ['classic','arcade','portals','reloj','espejo','laberinto'])for(const tam of ['chico','grande'])for(const vel of ['chill','fast']){
    const p=juega(modo,tam,vel,1000+n++,{frutas:modo==='reloj'?60:30,pared:1.02});
    assert.ok(p.dato.puntos>0,modo);
    assert.equal(await vale(p),null,`${modo} ${tam} ${vel}`);
  }
  // Un aparato lento (8 fotogramas por segundo): el juego corre al 60 %.
  const lento=juega('classic','mediano','normal',5,{frutas:40,pared:1/.6});
  assert.ok(lento.prueba.w>=20000);assert.equal(await vale(lento),null,'aparato lento');
  // Con mando (teclas de mando.js con el mando conectado) y con el dedo.
  assert.equal(await vale(juega('arcade','grande','fast',7,{frutas:60,marca:()=>'M'})),null,'mando');
  assert.equal(await vale(juega('portals','chico','normal',8,{frutas:40,marca:()=>R()<.5?'T':'TM'})),null,'toque');
  // Muy rápida pero humana: reacción de 150 ms al ritmo más rápido.
  assert.equal(await vale(juega('classic','grande','fast',9,{frutas:80,reaccion:()=>150})),null,'reflejos rápidos');
  // Alguien que gira mucho sin mirar la fruta (zigzag): su casualidad es
  // alta y los giros que coinciden con una fruta nueva no lo delatan.
  const nervioso=juega('classic','grande','fast',12,{frutas:60,reaccion:()=>150,nervios:.35});
  assert.equal(await vale(nervioso),null,'nervioso');
  // Una partida larga en el tablero gigante, rehecha entera.
  const larga=juega('classic','gigante','normal',10,{frutas:150,reaccion:()=>250});
  assert.ok(larga.prueba.n>1000,String(larga.prueba.n));assert.equal(await vale(larga),null,'gigante');
});

test('Snake antitrampas: la prueba que arma game.js pasa el verificador',async()=>{
  for(const [modo,tam,vel] of [['classic','grande','normal'],['espejo','chico','fast'],['portals','mediano','chill'],['reloj','chico','normal']]){
    const {api,motor,enviados}=juegoReal(modo,tam,vel);api.start();
    for(let k=0;k<100000&&!enviados.length;k++){
      const m=motor(),quiero=robot(m,12);
      if(quiero&&!Motor.same(Motor.DIRS[quiero],m.direction))api.enqueue(m.mirrored?ESPEJO[quiero]:quiero);
      if(k===40){api.pause();api.enqueue('up');api.pause();}
      api.step();
    }
    assert.equal(enviados.length,1,modo);
    const {dato,prueba}=enviados[0];
    assert.equal(prueba.m,modo);assert.equal(prueba.r,vel);assert.equal(prueba.u,'uid1');assert.equal(prueba.p,1);
    assert.equal(await vale({dato,prueba}),null,modo);
  }
});

test('Snake antitrampas: cada vía de trampa se rechaza',async()=>{
  const base=juega('arcade','grande','normal',777,{frutas:20});
  assert.equal(await vale(base),null);
  // Club.result a mano desde la consola, sin prueba.
  assert.match(await V.verificaClub('snake',base.dato,null),/sin prueba/);
  // Puntos inflados y tiempo cambiado.
  assert.match(await vale({...base,dato:{...base.dato,puntos:base.dato.puntos*10}}),/puntos declarados/);
  assert.match(await vale({...base,dato:{...base.dato,tiempo:base.dato.tiempo-500}}),/tiempo declarado/);
  // La prueba de otro modo, otro tamaño u otra velocidad.
  assert.match(await vale({dato:{...base.dato,categoria:'club-snake-classic-grande'},prueba:base.prueba}),/otro modo/);
  assert.match(await vale({dato:{...base.dato,categoria:'club-snake-arcade-chico'},prueba:base.prueba}),/otro modo/);
  assert.ok(await vale({dato:base.dato,prueba:{...base.prueba,r:'fast'}}));
  // Las mismas teclas con otra semilla (otra partida).
  assert.ok(await vale({dato:base.dato,prueba:{...base.prueba,s:(base.prueba.s+1)>>>0}}));
  // Prueba manipulada: un giro imposible (media vuelta), más o menos tics,
  // giros después del final.
  assert.match(await vale({dato:base.dato,prueba:{...base.prueba,g:'0L'+base.prueba.g}}),/no se puede hacer/);
  assert.match(await vale({dato:base.dato,prueba:{...base.prueba,n:base.prueba.n+50}}),/no terminan/);
  assert.match(await vale({dato:base.dato,prueba:{...base.prueba,n:base.prueba.n-1}}),/no terminan/);
  assert.match(await vale({dato:base.dato,prueba:{...base.prueba,g:base.prueba.g+'zzR'}}),/después del final/);
  for(const g of ['1x','R','0r',7,'0R'.repeat(2)+'-1U'])assert.ok(await vale({dato:base.dato,prueba:{...base.prueba,g}}),String(g));
  for(const roto of [{...base.prueba,v:0},{...base.prueba,s:2**32},{...base.prueba,n:0},{...base.prueba,w:-1},{...base.prueba,r:'turbo'},{...base.prueba,u:{}}])
    assert.ok(await vale({dato:base.dato,prueba:roto}));
  // Bots. Teclas despachadas por un script (isTrusted falso).
  const script=juega('classic','grande','normal',41,{marca:()=>'X'});
  assert.match(await vale(script),/sintéticos/);
  const unGiro=juega('classic','grande','normal',41);unGiro.prueba.g=unGiro.prueba.g.replace(/([UDLR])/,'$1X');
  assert.match(await vale(unGiro),/sintético/);
  // Un bot de reflejos perfectos: gira hacia cada fruta nueva en el mismo tic.
  for(const [modo,vel,semilla] of [['classic','fast',50],['arcade','fast',50],['reloj','fast',52],['espejo','fast',50]]){
    const bot=juega(modo,'grande',vel,semilla,{frutas:60,reaccion:null});
    assert.match(await vale(bot),/reflejos de bot/,modo);
  }
  // El zen no tiene tabla.
  assert.match(await vale({dato:{...base.dato,categoria:'club-snake-zen-grande'},prueba:{...base.prueba,m:'zen'}}),/desconocida/);
  // Cámara lenta: requestAnimationFrame a la mitad o menos del tiempo real.
  const lenta=juega('classic','grande','fast',9,{frutas:40,pared:2.5});
  assert.ok(lenta.prueba.w>=20000);assert.match(await vale(lenta),/reloj frenado/);
});

test('Snake antitrampas: sospecha de filas guardadas sin prueba',()=>{
  const f=(c,puntos,tiempo)=>SV.sospecha('club-snake-'+c,{nombre:'x',puntos,tiempo,partida:'p'});
  assert.equal(f('classic-grande',600,120000),null);assert.equal(f('arcade-gigante',25000,900000),null);
  assert.equal(f('laberinto-mediano',3000,300000),null);assert.equal(f('espejo-chico',345,60000),null);
  assert.match(f('classic-chico',1000000,999999),/tablero/);
  assert.match(f('classic-grande',605,120000),/de a 10/);
  assert.match(f('arcade-grande',1001,120000),/de a 2/);
  assert.match(f('classic-grande',3000,5000),/al menos/);
  // Lo que salió de partidas honestas de robot no es sospechoso.
  for(const modo of ['classic','arcade','portals','reloj','espejo','laberinto']){
    const p=juega(modo,'chico','fast',3,{frutas:30});
    assert.equal(SV.sospecha(p.dato.categoria,p.dato),null,modo);
  }
});
