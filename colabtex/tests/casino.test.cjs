/* Casino: el motor (src/juegos/casino-motor.js) y su cuenta en las monedas
   (src/juegos/monedas.js). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const PM=require('../../juegos/prodrop/motor.js');
const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={__PM:PM,__MM:require('../../juegos/mascotas/motor.js')};vm.createContext(ctx);
vm.runInContext('const PM=__PM,MM=__MM;'+sin('src/juegos/casino-motor.js')+
 ';const CM={RETORNO,APUESTA_MIN,azar,AVION,multAvion,horaAvion,apuestaValida,resuelveAvion,PINGUINO,multPinguino,resuelvePinguino,CLAVE_RONDA,resuelve};\n'+
 sin('src/juegos/motor.js')+'\n'+sin('src/juegos/logros.js')+'\n'+sin('src/juegos/tienda.js')+'\n'+sin('src/juegos/cortes.js')+'\n'+sin('src/juegos/monedas.js')+
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
