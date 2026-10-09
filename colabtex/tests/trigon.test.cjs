/* Trigon (juegos/club/trigon/): la geometría del tablero, el motor es
   repetible, la partida se rehace igual, y el verificador acepta la partida
   de un bot que juega a ritmo de mano y rechaza cada vía de trampa. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path'),fs=require('node:fs');
const carga=(entry)=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const VT=carga('src/juegos/solo/verifica/trigon.js');
const D=path.join(__dirname,'../../juegos/club/trigon');
const M=require(path.join(D,'motor.js'));
const CP='club-trigon-puntos';

/* Un bot que pone la primera pieza que cabe en la primera casilla libre.
   Cada jugada tarda `lento`…`lento+rango` ms. */
function juega(semilla,u,lento=400,rango=600,max=100000){
 const E=M.nueva(semilla,u);let a=semilla*13+5;
 const azar=()=>{a=(a*1103515245+12345)>>>0;return a/4294967296;};
 while(!E.fin&&E.jugadas<max){
  let hecho=false;
  for(let k=0;k<3&&!hecho;k++){
   const p=E.mano[k];if(!p)continue;
   const [x0,y0,d0]=M.celdasDe(p)[0];
   const c=M.CELDAS.find(c=>c.d===d0&&M.destino(E,p,c.x-x0,c.y-y0));
   if(c){M.coloca(E,k,c.x-x0,c.y-y0,[E.jugadas%3?'r':'t',Math.round(lento+azar()*rango)]);hecho=true;}
  }
  if(!hecho)break;
 }
 return E;
}
const prueba=(s,u,lento,rango,max)=>{
 const E=juega(s,u,lento,rango,max),ms=E.registro.reduce((t,j)=>t+j[4],0);
 return {E,ms,p:{v:1,s,u,j:E.registro,a:ms+20,w:ms+120,fin:E.fin}};
};

test('el tablero: 96 triángulos, 24 líneas de 9 a 15 y piezas conexas',()=>{
 assert.equal(M.CELDAS.length,96);
 assert.equal(M.LINEAS.length,24);
 const largos=M.LINEAS.map(l=>l.length);
 assert.equal(Math.min(...largos),9);assert.equal(Math.max(...largos),15);
 // Cada triángulo está en exactamente una línea de cada dirección.
 const veces=new Array(96).fill(0);M.LINEAS.forEach(l=>l.forEach(i=>veces[i]++));
 assert.ok(veces.every(v=>v===3));
 const comparte=(a,b)=>a.filter(p=>b.some(q=>q[0]===p[0]&&q[1]===p[1])).length===2;
 for(const f of M.FORMAS)for(const o of f.orient){
  const vs=o.map(t=>M.vertices(...t)),vistos=new Set([0]),pila=[0];
  while(pila.length){const i=pila.pop();vs.forEach((v,j)=>{if(!vistos.has(j)&&comparte(vs[i],v)){vistos.add(j);pila.push(j);}});}
  assert.equal(vistos.size,o.length,f.id);
 }
});

test('el motor es determinista y la cuenta cambia las piezas',()=>{
 const a=juega(7,'ana'),b=juega(7,'ana');
 assert.deepEqual(a.t,b.t);assert.equal(a.puntos,b.puntos);assert.deepEqual(a.registro,b.registro);
 const manos=u=>{const E=M.nueva(7,u);return JSON.stringify(E.mano);};
 let distintas=0;for(const u of ['beto','carla','dani','eli'])if(manos(u)!==manos('ana'))distintas++;
 assert.ok(distintas>=3);
 assert.ok(a.fin&&a.puntos>50,`el bot suma ${a.puntos}`);
});

test('cerrar una línea la borra y paga el bono con la racha',()=>{
 const E=M.nueva(1,'x'),L=M.LINEAS[0],hueco=L[L.length-1],c=M.CELDAS[hueco];
 L.forEach(i=>{if(i!==hueco)E.t[i]=1;});
 E.mano=[{f:0,o:M.FORMAS[0].orient.findIndex(t=>t[0][2]===c.d)},{f:0,o:0},{f:0,o:1}];
 const [x0,y0]=M.celdasDe(E.mano[0])[0];
 const r=M.coloca(E,0,c.x-x0,c.y-y0);
 assert.equal(r.lineas,1);assert.equal(r.suma,1+M.bonoLineas(1));
 assert.ok(L.every(i=>E.t[i]===0));
 assert.equal(M.bonoLineas(2),60);assert.equal(M.bonoLineas(3),120);
});

test('una mano nueva nunca es imposible si alguna pieza puede caber',()=>{
 for(let s=1;s<=40;s++){const E=M.nueva(s,'u');assert.ok(M.puedeJugar(E));}
});

test('rehace la partida del bot',()=>{
 for(const s of [1,2,3,12345]){
  const {E,ms,p}=prueba(s,'uid'+s),r=M.rehace(p.s,p.u,p.j);
  assert.equal(r.error,undefined);assert.equal(r.E.puntos,E.puntos);assert.equal(r.E.fin,true);assert.equal(r.ms,ms);
 }
 assert.ok(M.rehace(1,'u',[[0,99,99,'r',10]]).error);
 assert.ok(M.rehace(1,'u',[[0,0,0,'z',10]]).error);
 assert.ok(M.rehace(1,'u',[[0,0,0,'r',1.5]]).error);
});

test('el verificador acepta la partida honesta y rechaza las trampas',async()=>{
 const {E,ms,p}=prueba(99,'ana');
 const dp={categoria:CP,uid:'ana',puntos:E.puntos,tiempo:ms};
 assert.equal(await V.verificaClub('trigon',dp,p),null);
 const mal=async(d,q)=>assert.notEqual(await V.verificaClub('trigon',d,q),null);
 await mal({...dp,puntos:E.puntos+1},p);
 await mal({...dp,tiempo:ms-100},p);
 await mal({...dp,uid:'beto'},p);
 await mal({...dp,categoria:'club-trigon-lineas'},p);
 await mal(dp,{...p,u:'beto'});
 await mal(dp,{...p,s:p.s+1});
 await mal(dp,{...p,v:2});
 await mal(dp,{...p,j:p.j.map((j,i)=>i?j:[j[0],j[1],j[2],'x',j[4]])});
 await mal(dp,{...p,j:p.j.map(j=>j.slice(0,3))});
 await mal(dp,{...p,a:1000,w:1000});
 await mal(dp,null);
 // Una partida a medias no puede decir que terminó.
 const m=prueba(99,'ana',400,600,8),rm=M.rehace(m.p.s,m.p.u,m.p.j);
 assert.equal(rm.E.fin,false);
 const dm={categoria:CP,uid:'ana',puntos:rm.E.puntos,tiempo:rm.ms};
 assert.equal(await V.verificaClub('trigon',dm,{...m.p,fin:false}),null);
 await mal(dm,{...m.p,fin:true});
});

test('rechaza al programa que juega a ráfagas',async()=>{
 for(const s of [5,6]){
  const {E,ms,p}=prueba(s,'bot',5,40);
  assert.match(await V.verificaClub('trigon',{categoria:CP,uid:'bot',puntos:E.puntos,tiempo:ms},p),/programa/);
 }
});

test('rechaza una partida con el reloj del juego alterado',async()=>{
 const {E,ms,p}=prueba(99,'ana');
 assert.ok(ms>10000);
 const dp={categoria:CP,uid:'ana',puntos:E.puntos,tiempo:ms};
 assert.match(await V.verificaClub('trigon',dp,{...p,w:2*p.a}),/velocidad del juego/);
 assert.notEqual(await V.verificaClub('trigon',dp,{...p,w:undefined}),null);
});

test('sospecha de lo imposible',()=>{
 assert.equal(VT.sospecha(CP,{puntos:5000,tiempo:600000}),null);
 assert.notEqual(VT.sospecha(CP,{puntos:2000000,tiempo:1e9}),null);
 assert.equal(VT.sospecha('club-otro-puntos',{puntos:5}),null);
});

test('resultadoClub: tabla, tope y ms enteros',()=>{
 const {resultadoClub,categoriaClub}=carga('src/juegos/solo/club-datos.js');
 assert.ok(categoriaClub('trigon',CP));
 assert.ok(!categoriaClub('trigon','club-trigon-lineas'));
 assert.ok(resultadoClub('trigon',{categoria:CP,puntos:1200,tiempo:61235,partida:'abc'}));
 assert.equal(resultadoClub('trigon',{categoria:CP,puntos:1200,tiempo:61234.7,partida:'abc'}),null);
 assert.equal(resultadoClub('trigon',{categoria:CP,puntos:1000001,tiempo:5000,partida:'abc'}),null);
});

test('las versiones, el juego y las reglas',()=>{
 const html=fs.readFileSync(path.join(D,'index.html'),'utf8');
 assert.match(html,/motor\.js\?v=trigon-\d+/);assert.match(html,/juego\.js\?v=trigon-\d+/);
 assert.match(html,/temas\.css\?v=trigon-\d+/);
 const js=fs.readFileSync(path.join(D,'juego.js'),'utf8');
 assert.match(js,/Math\.round\(ahora - ultimaA\)/);
 assert.match(js,/Club\.result\(/);
 const reglas=fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8');
 assert.equal((reglas.match(/club-trigon-puntos/g)||[]).length,3,'soloRanks, su tope y soloPruebas');
 assert.match(reglas,/\|dosmil\|trigon\|/,'clubJugadas');
 /* El tope de `puntos` en soloRanks tiene que dejar pasar lo que el
    verificador acepta (1 000 000); con el tope general de 100 000 las
    partidas buenas se rechazarían al guardarse. */
 assert.match(reglas,/'club-trigon-puntos' \|\| [^?]*\? 1000000 /);
});
