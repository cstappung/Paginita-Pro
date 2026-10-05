/* Los rieles del salón (juegos/rieles-datos.js y juegos/repeticion.js):
   la clave de orden de las repeticiones del día, el chat general, y que
   cada reproductor rehace una partida de robot hasta el mismo final que
   el motor del juego — también yendo hacia atrás, que es lo que hace el
   bucle. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),fs=require('node:fs');
const carga=entry=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const D=carga('src/juegos/rieles-datos.js');
const {crearRepro}=carga('src/juegos/repeticion.js');
const TM=require('../../juegos/club/tetris/motor.js');
const Snake=require('../../juegos/club/snake/motor.js');
const Sortem=require('../../juegos/club/sortem/motor.js');
const Mina=require('../../juegos/club/minas/engine.js');
const lcg=s=>()=>(s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296;

/* ---------- robots que juegan y dejan su prueba ---------- */
function tetris(sal){
  const r=lcg(sal),g=TM.grabadora({cuenta:'uid1',sal,modo:'maraton'});
  let piezas=-1,plan=[],k=0,fin=null;
  while(!fin&&k<400000){
    if(g.s.piezas!==piezas){piezas=g.s.piezas;plan=[];
      for(let i=Math.floor(r()*4);i--;)plan.push('gira');
      const dx=Math.floor(r()*9)-4;for(let i=Math.abs(dx);i--;)plan.push(dx<0?'izq':'der');
      plan.push(...Array(8+Math.floor(r()*20)).fill(null),'caer');}
    const a=plan.shift();if(a)g.pide(a);
    fin=g.paso(r()<.3);k++;
  }
  return g.prueba({});
}
function snake(semilla){
  const m=Snake.crear({mode:'classic',size:'mediano',speed:'normal',semilla});
  let g='',ultimo=0;
  const libre=(x,y)=>x>=0&&y>=0&&x<m.COLS&&y<m.ROWS&&!m.snake.slice(0,-1).some(p=>p.x===x&&p.y===y);
  while(m.state==='playing'&&m.ticks<6000){
    const c=m.snake[0],d=m.queue.length?m.queue[m.queue.length-1]:m.direction;
    const op=Object.entries(Snake.DIRS).filter(([,v])=>!(v.x===-d.x&&v.y===-d.y)&&libre(c.x+v.x,c.y+v.y));
    op.sort((a,b)=>(Math.abs(c.x+a[1].x-m.fruit.x)+Math.abs(c.y+a[1].y-m.fruit.y))-(Math.abs(c.x+b[1].x-m.fruit.x)+Math.abs(c.y+b[1].y-m.fruit.y)));
    const quiere=m.ticks>1500?null:op.length?op[0][0]:null;
    if(quiere&&!(Snake.DIRS[quiere].x===d.x&&Snake.DIRS[quiere].y===d.y)&&m.enqueue(quiere)){g+=Snake.codificaGiro(ultimo,m.ticks,quiere);ultimo=m.ticks;}
    m.tick();m.ev.length=0;
  }
  assert.equal(m.state,'over','la serpiente del robot termina');
  return {prueba:{v:1,m:'classic',t:'mediano',r:'normal',s:semilla,n:m.ticks,g,w:0,p:0,u:'uid1'},score:m.score,ms:Math.round(m.gameTime*1000)};
}
function sortem(semilla){
  const e=Sortem.nuevo(20,semilla);let a='';const t=[];
  const hace=x=>{Sortem.aplica(e,x);a+=x;t.push(a.length===1?400:150+(a.length*37)%200);};
  while(!e.ganado){
    const b=e.bloques;let i=1;while(i<b.length&&b[i-1][0]<b[i][0])i++;
    while(e.sel<i)hace('R');while(e.sel>i)hace('L');
    hace('A');
    while(e.sel>0&&e.bloques[e.sel-1][0]>e.bloques[e.sel][0])hace('L');
    hace('A');
  }
  return {prueba:{v:1,n:20,s:semilla,d:0,w:0,a,t,f:'.'.repeat(a.length),k:t.map(()=>60)},tiempo:t.reduce((x,y)=>x+y,0)};
}
function minas(semilla){
  const g=new Mina.Game('medium',Mina.azar(semilla)),e=[];
  const r=lcg(semilla);let pt=0;
  const anota=(c,d)=>{e.push(c,d,d,0,1,80);};
  const inicio=7*18+9;g.open(inicio);anota(inicio*2,0);
  while(g.state==='playing'){const i=g.cells.findIndex(c=>!c.mine&&!c.open&&!c.flag);const d=200+Math.floor(r()*600);pt+=d;g.open(i);anota(i*2,d);}
  return {prueba:{v:1,n:'medium',s:semilla,u:'uid1',e},tiempo:pt};
}

/* Lleva un reproductor al final, a la mitad y otra vez al final: hacia
   atrás tiene que rehacer desde cero y llegar al mismo sitio. */
function recorre(r){
  r.en(r.dur);const fin=JSON.stringify(r.marcador());
  r.en(r.dur/2);const medio=r.marcador();
  r.en(0);r.en(r.dur);assert.equal(JSON.stringify(r.marcador()),fin,'volver atrás y llegar otra vez da lo mismo');
  return {fin:JSON.parse(fin),medio};
}

test('Tetris: la repetición llega a los puntos que da TM.rehace',()=>{
  for(const sal of [3,11,29]){
    const p=tetris(sal),ok=TM.rehace(p);
    assert.ok(!ok.error,ok.error);
    const r=crearRepro('tetris',p);
    assert.equal(r.dur,p.n*TM.PASO);
    const {fin,medio}=recorre(r);
    assert.equal(fin.puntos,ok.puntos);assert.equal(r.fin,true);
    assert.ok(medio.puntos<=fin.puntos);
  }
});
test('Snake: la repetición termina con los puntos y el tiempo del robot',()=>{
  for(const s of [1,42,777]){
    const {prueba,score,ms}=snake(s),r=crearRepro('snake',prueba);
    assert.equal(r.dur,ms);
    const {fin}=recorre(r);
    assert.equal(fin.puntos,score);assert.equal(r.fin,true);
    r.en(r.dur-200);assert.equal(r.fin,false,'antes del final la serpiente sigue viva');
  }
});
test('sortEm: la repetición queda ordenada en la última tecla',()=>{
  for(const s of [5,6,90210]){
    const {prueba,tiempo}=sortem(s),r=crearRepro('sortem',prueba);
    assert.equal(r.dur,tiempo);
    recorre(r);assert.equal(r.fin,true);
    r.en(r.dur-1);assert.equal(r.fin,false);
    assert.equal(Sortem.repite(20,s,prueba.a).ganaEn,prueba.a.length-1);
  }
});
test('Buscaminas: la repetición gana el tablero en la última jugada',()=>{
  for(const s of [2,77,4242]){
    const {prueba,tiempo}=minas(s),r=crearRepro('minas',prueba);
    assert.equal(r.dur,tiempo);
    const {fin}=recorre(r);assert.equal(r.fin,true);assert.equal(fin.tiempo,tiempo);
    r.en(r.dur-1);assert.equal(r.fin,false);
  }
});
test('Una prueba ilegible no da reproductor (y no lanza)',()=>{
  assert.equal(crearRepro('tetris',{v:1,e:'%%%',n:5,u:'x',a:1}),null);
  assert.equal(crearRepro('snake',{g:'zz',t:'nada'}),null);
  assert.equal(crearRepro('sortem',{a:'XYZ',t:[1,2,3],n:20}),null);
  assert.equal(crearRepro('minas',{e:[1,2],n:'medium'}),null);
  assert.equal(crearRepro('bbtan',{}),null);
  assert.equal(crearRepro('minas',null),null);
});
test('Pintar no lanza con un contexto 2D de mentira',()=>{
  const ctx=new Proxy({},{get:(o,k)=>k in o?o[k]:(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  for(const r of [crearRepro('tetris',tetris(3)),crearRepro('snake',snake(1).prueba),crearRepro('sortem',sortem(5).prueba),crearRepro('minas',minas(2).prueba)])
    for(const ms of [0,r.dur/3,r.dur])for(const [w,h] of [[300,150],[180,120],[40,30]]){r.en(ms);r.pinta(ctx,w,h);}
});

test('La clave de orden: el día manda, después los puntos o el tiempo',()=>{
  const hoy=20731;
  assert.equal(D.ordenRep('club-tetris-maraton',hoy,5000,1),hoy*1e10+5000);
  assert.equal(D.ordenRep('club-minas-medium',hoy,1,42000),hoy*1e10+1e9-42000);
  assert.ok(D.ordenRep('club-minas-medium',hoy,1,30000)>D.ordenRep('club-minas-medium',hoy,1,42000),'menos tiempo es mejor');
  assert.ok(D.ordenRep('club-tetris-maraton',hoy,1,1)>D.ordenRep('club-tetris-maraton',hoy-1,1e9,1),'hoy gana a ayer');
  assert.ok(D.ordenRep('club-sortem-20',hoy,20,D.T_MAX)>D.ordenRep('club-sortem-20',hoy-1,20,1));
  assert.equal(D.ordenRep('club-tetris-sprint',hoy,1,1),null);
  const e=D.entradaRep('club-snake-classic-mediano',hoy,{puntos:240,tiempo:31000},1,'{"v":1}','Ana');
  assert.deepEqual(e,{dia:hoy,o:hoy*1e10+240,p:240,t:31000,n:'Ana',v:1,d:'{"v":1}'});
  assert.equal(D.entradaRep('club-snake-classic-mediano',hoy,{puntos:240,tiempo:31000},1,'','Ana'),null,'sin prueba no');
  assert.equal(D.entradaRep('club-snake-classic-mediano',hoy,{puntos:0,tiempo:31000},1,'x','Ana'),null);
  assert.equal(D.entradaRep('club-minas-medium',hoy,{puntos:1,tiempo:1e9},1,'x','Ana'),null,'el tiempo tiene tope');
  assert.equal(D.entradaRep('club-minas-medium',hoy,{puntos:1,tiempo:5},1,'x'.repeat(200001),'Ana'),null);
  assert.equal(D.mejoraRep(e,null),true);
  assert.equal(D.mejoraRep(e,e),false);
  assert.equal(D.mejoraRep(e,{o:e.o-1}),true);
  assert.equal(D.etiquetaDia(hoy,hoy),'Mejor de hoy');
  assert.equal(D.etiquetaDia(hoy-1,hoy),'Mejor de ayer');
  assert.equal(D.etiquetaDia(hoy-9,hoy),'Última mejor partida');
});
test('El bucle de una partida larga se acelera, como mucho ×4',()=>{
  assert.equal(D.velocidadRep(30000),1);
  assert.equal(D.velocidadRep(170000),1.5);
  assert.equal(D.velocidadRep(240000),2);
  assert.equal(D.velocidadRep(3600000),4);
  assert.equal(D.formatoTiempo(38240),'38,2 s');
  assert.equal(D.formatoTiempo(247000),'4:07');
});
test('Chat general: la ventana de 15 min, la espera de 20 s y lo no leído',()=>{
  const ahora=1e12,m=(id,uid,hace,t='hola')=>({id,uid,t,at:ahora-hace});
  const msgs=[m('c','a',1000),m('a','b',16*60000),m('b','a',14*60000),m('d','b',0,'')];
  assert.deepEqual(D.chatVisibles(msgs,ahora).map(x=>x.id),['b','c'],'los de más de 15 min y los vacíos no');
  assert.equal(D.esperaChat(null,ahora),0);
  assert.equal(D.esperaChat(ahora-5000,ahora),15000);
  assert.equal(D.esperaChat(ahora-25000,ahora),0);
  assert.equal(D.limpiaChat('  hola \n  mundo  '),'hola mundo');
  assert.equal(D.limpiaChat('x'.repeat(300)).length,D.CHAT_LARGO);
  assert.equal(D.sinLeer(msgs,ahora-15*60000,'a'),1,'solo lo de otros y lo posterior a lo visto');
});
test('Las reglas conocen los tres nodos y las cuatro categorías',()=>{
  const reglas=JSON.parse(fs.readFileSync('../firebase/database.rules.json','utf8')).rules;
  for(const n of ['chatGeneral','chatGeneralUlt','repeticiones'])assert.ok(reglas[n],n);
  const val=reglas.repeticiones.$categoria.$uid['.validate'];
  const re=new RegExp(/\$categoria\.matches\(\/(.*?)\/\)/.exec(val)[1]);
  for(const r of D.REPES)assert.ok(re.test(r.cat),r.cat);
  assert.ok(!re.test('club-tetris-sprint'));
  assert.match(reglas.chatGeneralUlt.$uid['.validate'],/\+ 20000/,'la espera de 20 s la pone la regla');
  assert.match(reglas.chatGeneral.$id.t['.validate'],/<= 200/);
  assert.equal(D.CHAT_ESPERA_MS,20000);
  // La clave de orden de la regla usa las mismas constantes que rieles-datos.
  assert.match(val,/\* 10000000000/);assert.match(val,/1000000000 - newData\.child\('t'\)/);
});
