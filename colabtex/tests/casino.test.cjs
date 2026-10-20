/* Casino: el motor (src/juegos/casino-motor.js) y su cuenta en las monedas
   (src/juegos/monedas.js). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const PM=require('../../juegos/prodrop/motor.js');
const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={__PM:PM,__MM:require('../../juegos/mascotas/motor.js')};vm.createContext(ctx);
vm.runInContext('const PM=__PM,MM=__MM;'+sin('src/juegos/casino-motor.js')+
 ';const CM={RETORNO,APUESTA_MIN,azar,AVION,multAvion,horaAvion,apuestaValida,resuelveAvion,PINGUINO,multPinguino,resuelvePinguino,CLAVE_RONDA,resuelve,RULETA,RUEDA,ROJOS,casillaRuleta,sumaRuleta,resuelveRuleta,PLINKO,caminoPlinko,resuelvePlinko,BLACKJACK,totalBJ,esBlackjack,resuelveBlackjack,POKER,manoPoker,resuelvePoker};\n'+
 sin('src/juegos/motor.js')+'\n'+sin('src/juegos/logros.js')+'\n'+sin('src/juegos/tienda.js')+'\n'+sin('src/juegos/cortes.js')+'\n'+sin('src/juegos/referidos.js')+'\n'+sin('src/juegos/monedas.js')+
 ';globalThis.__M={CM,TARIFA,monedasDe,economia}',ctx);
const M=ctx.__M,CM=M.CM;
const plano=x=>JSON.parse(JSON.stringify(x));

/* Una cuenta con 5·n monedas ganadas jugando. */
const conGanado=(n,extra)=>({completo:true,ranks:{juego:{a:{jugadas:n*5/M.TARIFA.partida}}},solo:{},logros:{},diario:{},...extra});
const T0=1.8e12;

test('límites de apuesta por juego y dificultad',()=>{
 assert.ok(CM.apuestaValida('a',10));assert.ok(CM.apuestaValida('a',500));
 assert.ok(!CM.apuestaValida('a',9));assert.ok(!CM.apuestaValida('a',501));assert.ok(!CM.apuestaValida('a',10.5));
 assert.deepEqual([...CM.PINGUINO.map(x=>x.max)],[1000,500,200,50]);
 assert.ok(CM.apuestaValida('p',1000,0));assert.ok(!CM.apuestaValida('p',1001,0));
 assert.ok(CM.apuestaValida('p',50,3));assert.ok(!CM.apuestaValida('p',51,3));
 assert.ok(!CM.apuestaValida('p',50));assert.ok(!CM.apuestaValida('p',50,4));assert.ok(!CM.apuestaValida('x',50));
 assert.equal(CM.resuelve('u','corta',{j:'a',p:50,at:T0}),null,'clave ilegible');
});

test('el multiplicador del avión: ×1 en la espera, exponencial, tope en ×100',()=>{
 assert.equal(CM.multAvion(T0,T0+CM.AVION.ESPERA),1);
 assert.ok(Math.abs(CM.multAvion(T0,CM.horaAvion(T0,2))-2)<1e-6);
 assert.equal(CM.multAvion(T0,T0+1e7),100);
 assert.ok(Math.abs(CM.AVION.VUELO-41865)<5);
});

test('determinismo: la misma ronda da siempre lo mismo',()=>{
 const r={j:'a',p:100,at:T0,t:{0:T0+2000,1:T0+2350},c:T0+2700};
 assert.deepEqual(plano(CM.resuelve('u','abcdefgh',r)),plano(CM.resuelve('u','abcdefgh',r)));
 assert.notEqual(CM.azar('u','abcdefgh','t',1),CM.azar('u','abcdefgh','t',2));
});

/* Simula muchas rondas con una estrategia y devuelve pagado / apostado. */
function retornoAvion(meta,avisos,n){
 let ap=0,pa=0;
 for(let i=0;i<n;i++){
  const at=T0+i*977,k='ronda'+String(i).padStart(6,'0'),c=Math.round(CM.horaAvion(at,meta))+1,t={};
  if(avisos)for(let x=at+CM.AVION.ESPERA+CM.AVION.AVISO,j=0;x<c;x+=CM.AVION.AVISO,j++)t[j]=x;
  const res=CM.resuelve('u',k,{j:'a',p:100,at,t,c},Infinity);
  ap+=100;pa+=res.pago;
 }
 return pa/ap;
}
test('avión: esperanza ≈ 0,97 para cualquier forma de retirarse',()=>{
 for(const [meta,avisos] of [[1.5,true],[2,false],[3,true],[10,false]]){
  const r=retornoAvion(meta,avisos,20000);
  assert.ok(r>0.9&&r<1.0,`meta ${meta}: ${r}`);
 }
 // y con muchas rondas a ×2 se acerca mucho
 const r=retornoAvion(2,true,60000);assert.ok(Math.abs(r-0.97)<0.015,String(r));
});

test('avión: lo que llega después del retiro no cuenta, y sin retiro se pierde en ×100',()=>{
 let cobrada=null;
 for(let i=0;i<200&&!cobrada;i++){
  const at=T0+i*1000,c=Math.round(CM.horaAvion(at,1.2));
  const r={j:'a',p:100,at,c},res=CM.resuelve('u','despues'+i,r,Infinity);
  if(res.estado==='cobrada')cobrada={r,res,k:'despues'+i};
 }
 assert.ok(cobrada);
 const r2={...cobrada.r,t:{0:cobrada.r.c+10,1:cobrada.r.c+5000}};
 assert.deepEqual(plano(CM.resuelve('u',cobrada.k,r2,Infinity)),plano(cobrada.res));
 assert.equal(cobrada.res.pago,Math.round(100*cobrada.res.mult*100)/100);
 const sola=CM.resuelveAvion('u','sinretiro',{j:'a',p:100,at:T0},T0+1000);
 assert.ok(sola.estado==='vuela'||sola.estado==='perdida');
 const tarde=CM.resuelveAvion('u','sinretiro',{j:'a',p:100,at:T0},T0+CM.AVION.ESPERA+CM.AVION.VUELO+1);
 assert.equal(tarde.estado,'perdida');assert.equal(tarde.pago,0);
});

test('pingüino: multiplicadores y esperanza ≈ 0,97 en cada dificultad',()=>{
 assert.equal(CM.multPinguino(1,0),1);
 assert.equal(CM.multPinguino(3,1),1.94);
 for(let d=0;d<4;d++){
  const D=CM.PINGUINO[d];
  for(const plantarEn of [1,Math.ceil(D.n/2),D.n]){
   let ap=0,pa=0;const N=20000;
   for(let i=0;i<N;i++){
    const at=T0+i*5000,s={};
    for(let j=0;j<plantarEn;j++)s[j]=at+300+j*700;
    const r={j:'p',p:10,d,at,s};
    if(plantarEn<D.n)r.c=at+300+plantarEn*700;
    const res=CM.resuelve('u','pg'+d+'x'+String(i).padStart(6,'0'),r);
    assert.notEqual(res.estado,'juega');
    ap+=10;pa+=res.pago;
   }
   const ret=pa/ap,tol=plantarEn===D.n?[0.12,0.15,0.3,0.6][d]:0.05;
   assert.ok(Math.abs(ret-0.97)<tol,`dif ${d} plantarse en ${plantarEn}: ${ret}`);
  }
 }
});

test('los premios del casino suman centésimas y se redondean hacia abajo una vez',()=>{
 const ks=[];
 for(let i=0;i<3000&&ks.length<3;i++){const kk='cent'+String(i).padStart(5,'0');if(CM.resuelve('a',kk,{j:'p',p:10,d:0,at:T0+i,s:{0:T0+i+1},c:T0+i+2}).estado==='cobrada')ks.push([kk,i]);}
 const casino={a:Object.fromEntries(ks.map(([kk,i])=>[kk,{j:'p',p:10,d:0,at:T0+i,s:{0:T0+i+1},c:T0+i+2}]))};
 const m=M.monedasDe('a',conGanado(1000,{casino}));
 assert.equal(m.premios,32,'3 × 10,7 = 32,1');assert.equal(m.casino.pagado,32.1);
});

test('pingüino: el salto después de plantarse no cuenta; llegar al final cobra solo',()=>{
 const at=T0;
 let ok=null;
 for(let i=0;i<500&&!ok;i++){const res=CM.resuelve('u','unsalto'+i,{j:'p',p:10,d:0,at,s:{0:at+100},c:at+200});if(res.estado==='cobrada')ok=i;}
 const base=CM.resuelve('u','unsalto'+ok,{j:'p',p:10,d:0,at,s:{0:at+100},c:at+200});
 assert.equal(base.n,1);assert.equal(base.pago,10.7,'el pago va en centésimas, no se redondea a 10');
 assert.deepEqual(plano(CM.resuelve('u','unsalto'+ok,{j:'p',p:10,d:0,at,s:{0:at+100,1:at+300},c:at+200})),plano(base));
 // buscar una ronda de Extremo que llegue al final
 for(let i=0;i<20000;i++){
  const s={};for(let j=0;j<12;j++)s[j]=at+100*(j+1);
  const res=CM.resuelve('u','fin'+String(i).padStart(6,'0'),{j:'p',p:10,d:3,at,s});
  if(res.estado==='cobrada'){assert.equal(res.n,10);assert.equal(res.mult,CM.multPinguino(3,10));assert.equal(res.saltos.length,10);return;}
 }
 assert.fail('ninguna ronda llegó al final');
});

test('economía: la apuesta se cobra y el premio se paga',()=>{
 let k=null,res=null;
 for(let i=0;i<500;i++){const kk='econ'+String(i).padStart(4,'0');res=CM.resuelve('a',kk,{j:'p',p:100,d:0,at:T0,s:{0:T0+100},c:T0+200});if(res.estado==='cobrada'){k=kk;break;}}
 const casino={a:{[k]:{j:'p',p:100,d:0,at:T0,s:{0:T0+100},c:T0+200}}};
 const sin=M.monedasDe('a',conGanado(1000)),con=M.monedasDe('a',conGanado(1000,{casino}));
 assert.equal(con.saldo,sin.saldo-100+Math.floor(res.pago));
 assert.equal(con.premios,Math.floor(res.pago));
 assert.equal(con.casino.apostado,100);assert.equal(con.casino.pagado,res.pago);
 assert.equal(M.economia(conGanado(1000,{casino})).rondas['a~'+k].valida,true);assert.equal(con.casino.rondas,1);
 // una que perdió solo cobra
 let kp=null;
 for(let i=0;i<500;i++){const kk='perd'+String(i).padStart(4,'0');if(CM.resuelve('a',kk,{j:'p',p:50,d:3,at:T0,s:{0:T0+100}}).estado==='perdida'){kp=kk;break;}}
 const m2=M.monedasDe('a',conGanado(1000,{casino:{a:{[kp]:{j:'p',p:50,d:3,at:T0,s:{0:T0+100}}}}}));
 assert.equal(m2.saldo,sin.saldo-50);assert.equal(m2.premios,0);assert.ok(!m2.parada);
});

test('economía: una apuesta sin fondos no vale, no paga y para la cuenta',()=>{
 let k=null;
 for(let i=0;i<500;i++){const kk='pobre'+String(i).padStart(4,'0');if(CM.resuelve('a',kk,{j:'p',p:500,d:1,at:T0,s:{0:T0+100},c:T0+200}).estado==='cobrada'){k=kk;break;}}
 const m=M.monedasDe('a',conGanado(50,{casino:{a:{[k]:{j:'p',p:500,d:1,at:T0,s:{0:T0+100},c:T0+200}}}}));
 assert.equal(m.premios,0);assert.equal(m.casino.rondas,0);assert.ok(m.parada);
 assert.ok(!M.economia(conGanado(50,{casino:{a:{[k]:{j:'p',p:500,d:1,at:T0,s:{0:T0+100},c:T0+200}}}})).rondas['a~'+k].valida);
});

/* ---------- ruleta ---------- */
test('ruleta: cada apuesta devuelve exactamente 36/37 y la rueda tiene las 37 casillas',()=>{
 assert.deepEqual([...CM.RUEDA].sort((a,b)=>a-b),Array.from({length:37},(_,i)=>i));
 const apuestas=['n0','n17','rojo','negro','par','impar','baja','alta','d1','d2','d3','c1','c2','c3'];
 for(const b of apuestas){
  const c=CM.casillaRuleta(b);let s=0;
  for(let n=0;n<37;n++)if(c.gana(n))s+=c.mult;
  assert.equal(s,36,b);
 }
 for(const b of ['n37','n01','x','rojo2','d0','c4'])assert.equal(CM.casillaRuleta(b),null,b);
 assert.equal(CM.sumaRuleta({rojo:10,n5:5}),15);assert.equal(CM.sumaRuleta({rojo:0}),-1);assert.equal(CM.sumaRuleta({rojo:1.5}),-1);assert.equal(CM.sumaRuleta({azul:5}),-1);
});
test('ruleta: la ronda se valida entera y paga lo que sale',()=>{
 assert.equal(CM.resuelve('u','ruleta00',{j:'r',p:20,at:T0,b:{rojo:10}}),null,'la suma no cuadra');
 assert.equal(CM.resuelve('u','ruleta00',{j:'r',p:600,at:T0,b:{rojo:600}}),null,'pasa el máximo');
 const seen=new Set();let ap=0,pa=0;
 for(let i=0;i<4000;i++){
  const r={j:'r',p:37,at:T0+i,b:{n7:1,rojo:18,d2:12,c3:6}},res=CM.resuelve('u','rul'+String(i).padStart(5,'0'),r);
  seen.add(res.n);ap+=37;pa+=res.pago;
  let esperado=(res.n===7?36:0)+(CM.ROJOS.has(res.n)?36:0)+(res.n>=13&&res.n<=24?36:0)+(res.n>0&&res.n%3===0?18:0);
  assert.equal(res.pago,esperado);
 }
 assert.equal(seen.size,37);assert.ok(Math.abs(pa/ap-36/37)<0.03,String(pa/ap));
});

/* ---------- plinko ---------- */
const comb=(n,k)=>{let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return r;};
test('plinko: la esperanza exacta de cada tabla queda bajo 0,971 y sobre 0,96',()=>{
 for(const n of CM.PLINKO.filas)for(let d=0;d<3;d++){
  const t=CM.PLINKO.tablas[n][d];assert.equal(t.length,n+1);
  assert.deepEqual([...t],[...t].reverse(),'simétrica');
  let e=0;for(let k=0;k<=n;k++)e+=comb(n,k)/2**n*t[k];
  assert.ok(e<0.971&&e>0.96,`${n} filas, riesgo ${d}: ${e}`);
 }
 assert.ok(CM.apuestaValida('l',500,0,8));assert.ok(!CM.apuestaValida('l',501,0,8));assert.ok(CM.apuestaValida('l',50,2,16));assert.ok(!CM.apuestaValida('l',51,2,16));
 assert.ok(!CM.apuestaValida('l',50,0,10));assert.ok(!CM.apuestaValida('l',50,3,8));assert.ok(!CM.apuestaValida('l',50,undefined,8));
});
test('plinko: el camino decide la casilla y las casillas siguen la binomial',()=>{
 const cuenta=new Array(9).fill(0),N=20000;
 for(let i=0;i<N;i++){const res=CM.resuelve('u','plk'+String(i).padStart(6,'0'),{j:'l',p:10,d:1,n:8,at:T0+i});
  assert.equal(res.camino.length,8);assert.equal(res.casilla,res.camino.reduce((a,b)=>a+b,0));assert.equal(res.pago,Math.round(10*res.mult*100)/100);cuenta[res.casilla]++;}
 for(let k=0;k<=8;k++){const esp=comb(8,k)/256*N;assert.ok(Math.abs(cuenta[k]-esp)<5*Math.sqrt(esp)+5,`casilla ${k}: ${cuenta[k]} vs ${esp}`);}
});

/* ---------- blackjack ---------- */
const val=c=>Math.min(10,c%13+1);
/* Estrategia básica para H17 sin «hole card» (simplificada pero sensata). */
function decide(m,up,puedeDoblar,puedeSeparar){
 const {t,blando}=CM.totalBJ(m),u=val(up)===1?11:val(up);
 if(puedeSeparar&&m.length===2&&val(m[0])===val(m[1])){
  const v=val(m[0])===1?11:val(m[0]);
  if(v===11||v===8)return 's';
  if(v===9&&![7,10,11].includes(u))return 's';
  if((v===2||v===3||v===7)&&u<=7)return 's';
  if(v===6&&u<=6)return 's';
 }
 if(blando){
  if(puedeDoblar&&m.length===2&&((t>=13&&t<=18&&u>=5&&u<=6)||(t>=15&&t<=18&&u===4)||(t>=17&&t<=18&&u===3)))return 'd';
  return t>=19||(t===18&&u<=8)?'q':'p';
 }
 if(puedeDoblar&&m.length===2&&((t===11&&u<=10)||(t===10&&u<=9)||(t===9&&u>=3&&u<=6)))return 'd';
 if(t>=17)return 'q';
 if(t>=13&&u<=6)return 'q';
 if(t===12&&u>=4&&u<=6)return 'q';
 return 'p';
}
function juegaBJ(k,at,estrategia=decide){
 const r={j:'b',p:10,at,a:{}};let ms=at,i=0;
 for(;;){
  const res=CM.resuelveBlackjack('u',k,r);
  if(res.estado!=='juega')return res;
  const m=res.manos[res.mano];
  const t=estrategia(m.cartas,res.crupier[0],m.cartas.length===2&&!m.separada,res.manos.length===1);
  ms+=137;r.a[i++]={t,at:ms};
  if(i>40)throw new Error('no termina');
 }
}
test('blackjack: con estrategia básica la casa gana (poco)',()=>{
 let ap=0,pa=0;const N=60000;
 for(let i=0;i<N;i++){const res=juegaBJ('bj'+String(i).padStart(6,'0'),T0+i*3);ap+=res.apostado;pa+=res.pago;}
 const ret=1+(pa-ap)/(N*10);   // lo neto, por apuesta inicial
 assert.ok(ret<1&&ret>0.97,String(ret));
});
test('blackjack: reglas de la mano',()=>{
 assert.deepEqual(plano(CM.totalBJ([0,12])),{t:21,blando:true});
 assert.deepEqual(plano(CM.totalBJ([0,0,8])),{t:21,blando:true});
 assert.deepEqual(plano(CM.totalBJ([0,9,4])),{t:16,blando:false});
 assert.ok(CM.esBlackjack([13,11]));assert.ok(!CM.esBlackjack([13,11,0]));
 // una ronda sin acciones sigue en juego (salvo blackjack), sin carta tapada del crupier
 let k=null;
 for(let i=0;i<200;i++){const kk='bjvivo'+String(i).padStart(3,'0'),res=CM.resuelveBlackjack('u',kk,{j:'b',p:10,at:T0});if(res.estado==='juega'){k=kk;assert.equal(res.crupier.length,1);break;}}
 assert.ok(k);
 // doblar cobra otra apuesta, recibe una carta y termina
 const res=CM.resuelveBlackjack('u',k,{j:'b',p:10,at:T0,a:{0:{t:'d',at:T0+500}}});
 assert.notEqual(res.estado,'juega');assert.equal(res.manos[0].cartas.length,3);assert.equal(res.apostado,20);assert.deepEqual(plano(res.cargos),[{at:T0+500,p:10}]);
 // una acción imposible no cuenta: separar sin pareja
 const r2=CM.resuelveBlackjack('u',k,{j:'b',p:10,at:T0,a:{0:{t:'s',at:T0+500}}});
 if(val(r2.manos[0].cartas[0])!==val(r2.manos[0].cartas[1])){assert.equal(r2.estado,'juega');assert.equal(r2.apostado,10);}
 // con blackjack del crupier solo se pierde la apuesta original
 let visto=false;
 for(let i=0;i<20000&&!visto;i++){
  const kk='bjobo'+String(i).padStart(5,'0'),r={j:'b',p:10,at:T0,a:{0:{t:'d',at:T0+100}}},x=CM.resuelveBlackjack('u',kk,r);
  if(x.estado!=='juega'&&x.crupier.length===2&&CM.esBlackjack(x.crupier)&&x.apostado===20){assert.equal(x.pago,10);visto=true;}
 }
 assert.ok(visto);
});
test('blackjack: la carta del crupier depende de la hora de la última decisión',()=>{
 let difiere=false;
 for(let i=0;i<50&&!difiere;i++){
  const k='bjhora'+String(i).padStart(3,'0');
  const a=CM.resuelveBlackjack('u',k,{j:'b',p:10,at:T0,a:{0:{t:'q',at:T0+1000}}});
  const b=CM.resuelveBlackjack('u',k,{j:'b',p:10,at:T0,a:{0:{t:'q',at:T0+1001}}});
  if(a.estado!=='juega'&&a.crupier[1]!==b.crupier[1])difiere=true;
 }
 assert.ok(difiere);
});

/* ---------- póker ---------- */
test('póker: el evaluador reconoce cada jugada',()=>{
 const c=(v,p)=>p*13+v;   // v: 0 = as
 const casos=[
  [[c(0,0),c(9,0),c(10,0),c(11,0),c(12,0)],0],[[c(4,1),c(5,1),c(6,1),c(7,1),c(8,1)],1],[[c(0,1),c(1,1),c(2,1),c(3,1),c(4,1)],1],
  [[c(3,0),c(3,1),c(3,2),c(3,3),c(8,1)],2],[[c(3,0),c(3,1),c(3,2),c(8,3),c(8,1)],3],[[c(1,2),c(5,2),c(7,2),c(9,2),c(12,2)],4],
  [[c(0,0),c(9,1),c(10,2),c(11,3),c(12,0)],5],[[c(0,0),c(1,1),c(2,2),c(3,3),c(4,0)],5],[[c(6,0),c(6,1),c(6,2),c(1,3),c(4,0)],6],
  [[c(6,0),c(6,1),c(2,2),c(2,3),c(4,0)],7],[[c(10,0),c(10,1),c(2,2),c(5,3),c(4,0)],8],[[c(0,0),c(0,1),c(2,2),c(5,3),c(4,0)],8],
  [[c(9,0),c(9,1),c(2,2),c(5,3),c(4,0)],-1],[[c(0,0),c(1,1),c(10,2),c(11,3),c(12,0)],-1]
 ];
 for(const [m,j] of casos)assert.equal(CM.manoPoker(m),j,JSON.stringify(m));
 assert.deepEqual(plano(CM.POKER.tabla.map(x=>x[2])),[800,50,25,8,5,4,3,2,1]);
});
test('póker: cartas distintas, las guardadas se quedan y el reemplazo sale de la hora del cambio',()=>{
 let difiere=0;
 for(let i=0;i<300;i++){
  const k='pk'+String(i).padStart(6,'0'),r={j:'v',p:10,at:T0+i};
  const a=CM.resuelve('u',k,r);assert.equal(a.estado,'juega');assert.equal(new Set(a.mano).size,5);
  const b=CM.resuelve('u',k,{...r,x:{m:5,at:T0+i+900}}),c=CM.resuelve('u',k,{...r,x:{m:5,at:T0+i+901}});
  assert.equal(new Set(b.mano).size,5);assert.equal(b.mano[0],a.mano[0]);assert.equal(b.mano[2],a.mano[2]);
  for(const x of [1,3,4])assert.ok(!a.mano.includes(b.mano[x]));
  if(b.mano[1]!==c.mano[1])difiere++;
  assert.equal(CM.resuelve('u',k,{...r,x:{m:31,at:T0+i+900}}).mano.join(),a.mano.join());
 }
 assert.ok(difiere>250);
 assert.ok(!CM.apuestaValida('v',101));assert.ok(CM.apuestaValida('v',100));
});
test('póker: guardar lo obvio devuelve menos de 1',()=>{
 let ap=0,pa=0;
 for(let i=0;i<40000;i++){
  const k='pkev'+String(i).padStart(6,'0'),r={j:'v',p:10,at:T0+i},a=CM.resuelve('u',k,r);
  // guarda las cartas repetidas, o todo si ya paga
  let m=0;const v=a.mano.map(x=>x%13);
  if(a.jugada>=0&&a.jugada<=5)m=31;else v.forEach((x,j)=>{if(v.filter(y=>y===x).length>1)m|=1<<j;});
  const b=CM.resuelve('u',k,{...r,x:{m,at:T0+i+800}});ap+=10;pa+=b.pago;
 }
 assert.ok(pa/ap<0.973&&pa/ap>0.8,String(pa/ap));
});

/* ---------- la economía con cargos extra ---------- */
test('economía: lo doblado en blackjack se cobra a su hora; sin fondos anula la ronda',()=>{
 let k=null,res=null;
 for(let i=0;i<5000;i++){const kk='ecbj'+String(i).padStart(5,'0'),r={j:'b',p:100,at:T0,a:{0:{t:'d',at:T0+500}}};res=CM.resuelve('a',kk,r);if(res.estado==='cobrada'&&res.apostado===200&&res.pago===400){k=kk;break;}}
 assert.ok(k);
 const ronda={j:'b',p:100,at:T0,a:{0:{t:'d',at:T0+500}}};
 const sin=M.monedasDe('a',conGanado(1000)),con=M.monedasDe('a',conGanado(1000,{casino:{a:{[k]:ronda}}}));
 assert.equal(con.saldo,sin.saldo+200);assert.equal(con.casino.apostado,200);assert.equal(con.casino.pagado,400);assert.equal(con.casino.rondas,1);
 // con 150 monedas alcanza la apuesta pero no el doblar
 const pobre=M.monedasDe('a',conGanado(30,{casino:{a:{[k]:ronda}}}));
 assert.equal(pobre.premios,0);assert.ok(pobre.parada);
 assert.equal(M.economia(conGanado(30,{casino:{a:{[k]:ronda}}})).rondas['a~'+k].valida,false);
});
test('economía: la ruleta y el plinko se cobran y pagan al apostar',()=>{
 let k=null,res=null;
 for(let i=0;i<500;i++){const kk='ecrl'+String(i).padStart(4,'0');res=CM.resuelve('a',kk,{j:'r',p:30,at:T0,b:{rojo:20,n0:10}});if(res.pago>0){k=kk;break;}}
 const sin=M.monedasDe('a',conGanado(1000)),con=M.monedasDe('a',conGanado(1000,{casino:{a:{[k]:{j:'r',p:30,at:T0,b:{rojo:20,n0:10}}}}}));
 assert.equal(con.saldo,sin.saldo-30+res.pago);
 const pl=CM.resuelve('a','ecplinko',{j:'l',p:10,d:0,n:8,at:T0});
 const con2=M.monedasDe('a',conGanado(1000,{casino:{a:{ecplinko:{j:'l',p:10,d:0,n:8,at:T0}}}}));
 assert.equal(con2.casino.pagado,pl.pago);assert.equal(con2.saldo,sin.saldo-10+Math.floor(pl.pago+1e-6));
 /* el detalle por juego y los movimientos (la pestaña de monedas) */
 assert.equal(con.casino.porJuego.r.apostado,30);assert.equal(con.casino.porJuego.r.rondas,1);assert.equal(con.casino.porJuego.r.pagado,res.pago);
 assert.equal(con.gasto.apuesta,30);
 assert.deepEqual(con.movs.map(x=>x.c+':'+x.d).join(),'apuesta:r,premio:r');
 assert.equal(con2.casino.porJuego.l.apostado,10);
});
