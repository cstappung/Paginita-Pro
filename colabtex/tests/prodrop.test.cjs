/* PRODROP: el motor compartido (juegos/prodrop/motor.js), el gasto en
   monedas (src/juegos/monedas.js) y lo que la página dice de las cartas
   (src/juegos/prodrop-cartas.js). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const PM=require('../../juegos/prodrop/motor.js');
const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={__PM:PM};vm.createContext(ctx);
vm.runInContext('const PM=__PM;'+sin('src/juegos/motor.js')+'\n'+sin('src/juegos/logros.js')+'\n'+sin('src/juegos/monedas.js')+'\n'+sin('src/juegos/prodrop-cartas.js')+
 ';globalThis.__M={monedasDe,economia,copiasDe,proximoGratis,claveCopia,topMonedas,exhibidasDe,mejoresDrops,cifras,miniCarta}',ctx);
const M=ctx.__M;

test('el catálogo: 17 personas por 9 variantes, con su imagen',()=>{
 assert.equal(PM.TOTAL,153);
 assert.deepEqual(PM.POR_TIER.map(l=>l.length),[51,34,51,17]);
 assert.equal(PM.TIERS.reduce((s,t)=>s+t.w,0),10000);
 assert.equal(PM.GRADE_W.reduce((s,w)=>s+w,0),1000);
 for(const c of PM.CARDS)assert.ok(fs.existsSync(path.join(__dirname,'../../juegos/prodrop',c.img)),'falta '+c.img);
 assert.equal(new Set(PM.CARDS.map(c=>c.uid)).size,153);
});

test('SHA-256 es el de verdad',()=>{
 const hex=s=>PM.sha256(s).map(x=>x.toString(16).padStart(8,'0')).join('');
 const c=require('node:crypto');
 for(const s of ['','abc','prodrop:uid|-Nabc|1790000000000','ñandú'.repeat(40)])
  assert.equal(hex(s),c.createHash('sha256').update(s).digest('hex'));
});

test('un sobre es una función de (uid, clave, hora): el mismo en todas partes',()=>{
 const a=PM.sobre('u1','-Nk1abcdefgh',1790000000000),b=PM.sobre('u1','-Nk1abcdefgh',1790000000000);
 assert.equal(a,b);
 assert.notDeepEqual(PM.sobre('u1','-Nk1abcdefgh',1790000000001).cartas,a.cartas,'un milisegundo después es otro sobre');
 assert.notDeepEqual(PM.sobre('u2','-Nk1abcdefgh',1790000000000).cartas,a.cartas,'otra cuenta, otro sobre');
});

test('las reglas del sobre se cumplen siempre, y las proporciones son las anunciadas',()=>{
 const N=60000,t=[0,0,0,0],g=Array(11).fill(0);let dios=0;
 for(let i=0;i<N;i++){
  const s=PM.sobre('u'+(i%13),'k'+i+'abcdefg',1790000000000+i*7);
  const ts=s.cartas.map(x=>PM.CARDS[x.id].tier);
  assert.equal(new Set(s.cartas.map(x=>x.id)).size,5,'cinco cartas distintas');
  assert.deepEqual(ts,[...ts].sort((a,b)=>a-b),'de la peor a la mejor');
  if(s.dios){dios++;assert.ok(ts.every(x=>x>=2),'god pack: todas épicas o mejores');assert.ok(ts.filter(x=>x===3).length<=1,'como mucho una legendaria');}
  else assert.ok(ts[4]>=1,'la mejor es rara o más');
  for(const x of s.cartas){t[PM.CARDS[x.id].tier]++;g[x.g]++;assert.ok(x.w>0);}
 }
 assert.ok(Math.abs(dios/N-.02)<.004,'god packs: '+dios/N);
 t.forEach((n,i)=>assert.ok(Math.abs(n/N-PM.ESPERADO[i])<Math.max(.012,PM.ESPERADO[i]*.15),`rareza ${i}: ${n/N} vs ${PM.ESPERADO[i]}`));
 assert.ok(Math.abs(g[7]/N/5-.26)<.01,'la nota 7 es la más común');
 assert.ok(Math.abs(g[10]/N/5-.08)<.006,'GEM MINT, 8 %');
});

test('la probabilidad que se dice al graduar',()=>{
 const leg=PM.POR_TIER[3][0].n,com=PM.POR_TIER[0][0].n;
 const p=PM.probabilidad(leg,10);
 assert.ok(Math.abs(p.porSobre-PM.ESPERADO[3]*.08)<1e-12);
 assert.ok(Math.abs(p.exacta-PM.ESPERADO[3]/17*.08)<1e-12);
 assert.equal(PM.probabilidad(com,1).porSobre,5,'una común con nota 1 o más: todas');
 assert.ok(PM.probabilidad(leg,9).porSobre>p.porSobre,'nota 9 o más es más fácil que 10');
 assert.ok(Math.abs(PM.ESPERADO.reduce((s,x)=>s+x,0)-5)<1e-9,'cinco cartas por sobre');
});

test('el precio: 50 de lanzamiento, 80 después',()=>{
 assert.equal(PM.precioSobre(PM.PRECIO.promoHasta-1),50);
 assert.equal(PM.precioSobre(PM.PRECIO.promoHasta),80);
 assert.equal(PM.PRECIO.gradua,100);
 // la regla escribe el mismo instante
 const r=JSON.parse(fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8'));
 assert.match(r.rules.cartas.s.$uid.$k['.validate'],new RegExp('now < '+PM.PRECIO.promoHasta+' \\? 50 : 80'));
 assert.match(r.rules.cartas.g.$uid.$k.$i['.validate'],/=== 100/);
});

const datos=(extra)=>Object.assign({completo:true,ranks:{juego:{a:{jugadas:100,ganadas:50,puntos:150}}},solo:{},logros:{},diario:{}},extra);

// ganado: 'juego' no tiene PESO, así que pesa 1: 5 por partida
const conGanado=(u,n,extra)=>({completo:true,ranks:{juego:Object.fromEntries(Object.entries(u).map(([k,v])=>[k,{jugadas:v}]))},solo:{},logros:{},diario:{},...extra});
const K=i=>'-Nk'+String(i).padStart(9,'0');

test('lo gastado se resta del saldo, no de lo ganado',()=>{
 const d=conGanado({a:100},0,{cartas:{s:{a:{[K(1)]:{at:1,p:50},[K(2)]:{at:2,p:80}}},g:{a:{[K(1)]:{0:{at:3,p:100}}}}}});
 const m=M.monedasDe('a',d);
 assert.equal(m.total,500);assert.equal(m.gastadas,230);assert.equal(m.saldo,270);assert.equal(m.parada,false);
 assert.equal(M.monedasDe('b',d).gastadas,0);
 assert.equal(M.topMonedas(d)[0].total,500,'el top ordena por lo ganado');
});

test('el saldo nunca es negativo: un gasto sin fondos no vale y para la cuenta',()=>{
 const s={};for(let i=0;i<40;i++)s[K(i)]={at:1000+i,p:50};
 const cartas={s:{a:s},g:{a:{[K(1)]:{2:{at:1001,p:100}}}}};
 // 175 ganadas (35 partidas): dos sobres; la graduación (100) ya no cabe y ahí se para
 let m=M.monedasDe('a',conGanado({a:35},0,{cartas}));
 assert.equal(m.gastadas,100);assert.equal(m.parada,true);
 assert.equal(Object.keys(M.economia(conGanado({a:35},0,{cartas})).usuarios.a.sobres).length,2);
 m=M.monedasDe('a',conGanado({a:50},0,{cartas}));
 assert.equal(m.gastadas,250);
 // lo aceptado solo crece al ganar más, y nunca se gasta más de lo ganado
 let antes=new Set();
 for(let j=0;j<=600;j+=7){
  const d=conGanado({a:j},0,{cartas}),e=M.economia(d),ahora=new Set(Object.keys(e.usuarios.a.sobres)),mm=M.monedasDe('a',d);
  assert.ok(mm.saldo>=0,'saldo >= 0');
  for(const k of antes)assert.ok(ahora.has(k),'un sobre aceptado no vuelve a quedar fuera');
  antes=ahora;
 }
 const pobre=M.monedasDe('a',conGanado({},0,{cartas}));
 assert.equal(pobre.saldo,0);assert.equal(pobre.gastadas,0);
 // un precio que no es de la tienda no vale ni regala monedas
 const raro=M.monedasDe('a',conGanado({a:20},0,{cartas:{s:{a:{[K(1)]:{at:1,p:-500}}}}}));
 assert.equal(raro.saldo,100);assert.equal(raro.gastadas,0);
});

test('un sobre gratis cada 6 horas',()=>{
 const H=3600*1000,s={[K(1)]:{at:0,p:0},[K(2)]:{at:5*H,p:0},[K(3)]:{at:6*H,p:0},[K(4)]:{at:7*H,p:0},[K(5)]:{at:12*H,p:0}};
 const d=conGanado({},0,{cartas:{s:{a:s}}}),e=M.economia(d);
 assert.deepEqual([...Object.keys(e.usuarios.a.sobres)].sort(),[K(1),K(3),K(5)]);
 assert.equal(M.monedasDe('a',d).gastadas,0,'gratis no es gasto');
 assert.equal(M.proximoGratis('a',d,13*H),18*H);
 assert.equal(M.proximoGratis('a',d,18*H),0);
 assert.equal(M.proximoGratis('b',d,0),0,'quien nunca sacó uno lo tiene listo');
});

test('mercado: la carta pasa al comprador y las monedas al vendedor',()=>{
 const c=M.claveCopia('usrAAA',K(1),2);
 const base={cartas:{s:{usrAAA:{[K(1)]:{at:10,p:0}}}},mercado:{o:{o1:{u:'usrAAA',c,p:120,at:20,v:{u:'usrBBB',at:30}}}}};
 let d=conGanado({usrBBB:30},0,base),e=M.economia(d);
 assert.equal(e.dueno[c],'usrBBB');assert.equal(e.ofertas.o1.estado,'vendida');
 assert.equal(M.monedasDe('usrAAA',d).cobradas,120);assert.equal(M.monedasDe('usrBBB',d).saldo,30);
 assert.deepEqual([...M.copiasDe('usrBBB',d).map(x=>x.c)],[c]);
 // sin fondos: no se paga, la carta se queda con quien vendía y el comprador queda parado
 d=conGanado({usrBBB:10},0,base);e=M.economia(d);
 assert.equal(e.dueno[c],'usrAAA');assert.equal(e.ofertas.o1.estado,'impaga');
 assert.equal(M.monedasDe('usrAAA',d).cobradas,0);assert.equal(M.monedasDe('usrBBB',d).parada,true);assert.equal(M.monedasDe('usrBBB',d).saldo,50);
 // vender lo que no es tuyo no vale; vender dos veces la misma carta tampoco
 d=conGanado({usrBBB:30,usrZZZ:30},0,{cartas:base.cartas,mercado:{o:{o0:{u:'usrZZZ',c,p:1,at:15,v:{u:'usrBBB',at:16}},o1:{u:'usrAAA',c,p:5,at:20},o2:{u:'usrAAA',c,p:6,at:21,v:{u:'usrBBB',at:22}}}}});
 e=M.economia(d);
 assert.equal(e.ofertas.o0.estado,'nula');assert.equal(e.ofertas.o1.estado,'activa');assert.equal(e.ofertas.o2.estado,'nula');
 assert.equal(e.dueno[c],'usrAAA');assert.equal(M.monedasDe('usrBBB',d).gastadas,0);
 // retirada antes de la compra: la compra no ocurre
 d=conGanado({usrBBB:30},0,{cartas:base.cartas,mercado:{o:{o1:{u:'usrAAA',c,p:5,at:20,x:25}}}});
 assert.equal(M.economia(d).ofertas.o1.estado,'retirada');
 // en venta no se gradúa
 d=conGanado({usrAAA:30},0,{cartas:{...base.cartas,g:{usrAAA:{[K(1)]:{2:{at:22,p:100}}}}},mercado:{o:{o1:{u:'usrAAA',c,p:5,at:20}}}});
 assert.equal(M.economia(d).graduada[c],undefined);assert.equal(M.monedasDe('usrAAA',d).gastadas,0);
 // quien compró puede graduarla (con `o` = origen) y la nota viaja con la carta
 d=conGanado({usrBBB:60},0,{cartas:{...base.cartas,g:{usrBBB:{[K(1)]:{2:{at:40,p:100,o:'usrAAA'}}}}},mercado:base.mercado});
 e=M.economia(d);assert.ok(e.graduada[c]);assert.equal(M.monedasDe('usrBBB',d).gastadas,220);
});

test('intercambios: se hacen al aceptar si las cartas siguen con sus dueños',()=>{
 const ca=M.claveCopia('usrAAA',K(1),0),cb=M.claveCopia('usrBBB',K(2),4);
 const cartas={s:{usrAAA:{[K(1)]:{at:10,p:0}},usrBBB:{[K(2)]:{at:11,p:0}}}};
 let d=conGanado({},0,{cartas,mercado:{t:{t1:{de:'usrAAA',para:'usrBBB',dar:[ca],pedir:[cb],at:20,ok:30}}}}),e=M.economia(d);
 assert.equal(e.dueno[ca],'usrBBB');assert.equal(e.dueno[cb],'usrAAA');assert.equal(e.cambios.t1.estado,'hecho');
 // sin aceptar, o cerrado, no pasa nada
 d=conGanado({},0,{cartas,mercado:{t:{t1:{de:'usrAAA',para:'usrBBB',dar:[ca],pedir:[cb],at:20}}}});
 assert.equal(M.economia(d).dueno[ca],'usrAAA');
 // si una carta estaba a la venta al aceptar, no vale
 d=conGanado({},0,{cartas,mercado:{o:{o1:{u:'usrBBB',c:cb,p:9,at:25}},t:{t1:{de:'usrAAA',para:'usrBBB',dar:[ca],pedir:[cb],at:20,ok:30}}}});
 e=M.economia(d);assert.equal(e.cambios.t1.estado,'nulo');assert.equal(e.dueno[ca],'usrAAA');
 // un regalo (sin pedir nada) vale
 d=conGanado({},0,{cartas,mercado:{t:{t1:{de:'usrAAA',para:'usrBBB',dar:[ca],at:20,ok:30}}}});
 assert.equal(M.economia(d).dueno[ca],'usrBBB');
});

test('exhibidas y drops: solo lo que vale, y la exhibida debe ser tuya ahora',()=>{
 let k='',at=0;
 for(let i=0;!k;i++){const kk='-Nkb'+String(i).padStart(8,'0'),s=PM.sobre('usrAAA',kk,1790000000000+i);if(PM.CARDS[s.cartas[4].id].tier>=2){k=kk;at=1790000000000+i;}}
 const d=conGanado({usrAAA:100},0,{cartas:{s:{usrAAA:{[k]:{at,p:50}}},g:{usrAAA:{[k]:{4:{at:at+1,p:100}}}}}});
 const ex=M.exhibidasDe('usrAAA',{cartas:[k+'.4','-Nnoexistexx.1','<img>.2']},d);
 assert.equal(ex.length,1);assert.equal(ex[0].gr,true);
 assert.equal(M.exhibidasDe('usrAAA',{cartas:['usrAAA~'+k+'.4']},d).length,1,'la clave nueva también');
 const top=M.mejoresDrops(d);
 assert.ok(top.length>=1&&top.every(c=>c.carta.tier>=2));
 assert.ok(M.miniCarta(top[0]).includes('juegos/prodrop/cards/'));
 const pobre=conGanado({},0,{cartas:d.cartas});
 assert.equal(M.exhibidasDe('usrAAA',{cartas:[k+'.4']},pobre).length,0,'sin fondos el sobre no existe');
 assert.equal(M.mejoresDrops(pobre).length,0);
 // vendida a b: ya no se exhibe en a, sí en b
 const v=conGanado({usrAAA:100,usrBBB:100},0,{cartas:d.cartas,mercado:{o:{o1:{u:'usrAAA',c:'usrAAA~'+k+'.4',p:5,at:at+5,v:{u:'usrBBB',at:at+6}}}}});
 assert.equal(M.exhibidasDe('usrAAA',{cartas:[k+'.4']},v).length,0);
 assert.equal(M.exhibidasDe('usrBBB',{cartas:['usrAAA~'+k+'.4']},v).length,1);
 assert.equal(M.mejoresDrops(Object.assign({},d,{completo:false})).length,0,'con la lectura a medias no se juzga a nadie');
});
