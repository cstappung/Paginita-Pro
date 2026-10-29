/* PRODROP: el motor compartido (juegos/prodrop/motor.js), el gasto en
   monedas (src/juegos/monedas.js) y lo que la página dice de las cartas
   (src/juegos/prodrop-cartas.js). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const PM=require('../../juegos/prodrop/motor.js');
const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={__PM:PM,__MM:require('../../juegos/mascotas/motor.js')};vm.createContext(ctx);
vm.runInContext('const PM=__PM,MM=__MM;'+sin('src/juegos/motor.js')+'\n'+sin('src/juegos/logros.js')+'\n'+sin('src/juegos/tienda.js')+'\n'+sin('src/juegos/cortes.js')+'\n'+sin('src/juegos/referidos.js')+'\n'+sin('src/juegos/monedas.js')+'\n'+sin('src/juegos/prodrop-cartas.js')+
 ';globalThis.__M={TARIFA,monedasDe,economia,copiasDe,proximoGratis,claveCopia,topMonedas,exhibidasDe,mejoresDrops,cifras,miniCarta,rankingColeccion,topColecciones,puntosGraduada,fijaSerie1,veSerie1,copiaVisible,totalVisible}',ctx);
const M=ctx.__M;
// quien mira ve la Serie 01 (los profes), salvo en la prueba que dice lo contrario
const VE_TODO={mira:{at:1,por:'adm'}};
M.fijaSerie1(VE_TODO,'mira');

test('el catálogo: profes (17 personas por 10 variantes), componentes (25 por 11 temáticas) y fútbol (48 del Clásico, 155 de la Premier, 163 de siete clubes de la Champions, las dos cartas especiales, 20 del Bayern, 277 de Chile, Argentina, la MLS y Arabia y la especial de Cristiano, una carta cada uno), con su imagen',()=>{
 assert.equal(PM.TOTAL,170+275+48+155+163+2+20+61+72+72+72+1);
 assert.deepEqual(PM.POOL.futbol.map(l=>l.length),[484,108,46,28]);assert.equal(PM.POOL.futbol.tope,3);
 assert.deepEqual(PM.POOL.futbolplus.map(l=>l.length),[484,108,46,28]);
 assert.deepEqual(PM.POOL.futbol1.map(l=>l.length),[13,19,7,9],'el Clásico de antes: para rehacer sus sobres');
 // las de antes conservan su id: fútbol va después de todo
 assert.equal(PM.POR_COL.futbol.length,666);
 assert.ok(PM.POR_COL.futbol.every((c,i)=>c.n===445+i),'fútbol va después de todo: no mueve el id de nada');
 assert.ok(PM.POR_COL.futbol.slice(48,203).every(c=>/cards\/premier\//.test(c.img)),'los 155 de la Premier siguen con su id y su foto');
 assert.ok(PM.POR_COL.futbol.slice(203,366).every(c=>/cards\/champions\//.test(c.img)),'los de la Champions van después');
 assert.ok(PM.POR_COL.futbol.slice(366,368).every(c=>/cards\/especiales\//.test(c.img)),'después las especiales');
 assert.ok(PM.POR_COL.futbol.slice(368,388).every(c=>c.club==='bayern'&&/cards\/champions\/bayern\//.test(c.img)),'después el Bayern');
 assert.ok(PM.POR_COL.futbol.slice(388,-1).every(c=>['colocolo','ucatolica','udechile','river','boca','estudiantes','intermiami','montreal','lafc','alnassr','alhilal','alittihad'].includes(c.club)&&/cards\/champions\//.test(c.img)),'y Chile, Argentina, la MLS y Arabia después');
 assert.equal(PM.POR_COL.futbol[665].img,'cards/especiales/alnassr/cristiano-balon-all-time.webp','y la especial de Cristiano, la última de todas');
 assert.equal(PM.CARDS[648].person,'betis-alvaro-valles','la primera de las nuevas es el id 648: nada se mueve');
 assert.deepEqual(PM.POOL.premier1.map(l=>l.length),[92,39,16,8]);assert.equal(PM.POOL.premier1.tope,3);
 assert.deepEqual(PM.POR_TIER.map(l=>l.length),[51,34,68,17]);
 assert.deepEqual(PM.POOL.legado.map(l=>l.length),[51,34,51,17],'los sobres de antes salen de las 153 de antes');
 assert.deepEqual(PM.POOL.comp.map(l=>l.length),[75,75,75,50]);
 assert.equal(PM.POR_COL.profes.length,170);assert.equal(PM.POR_COL.comp.length,275);
 // las 153 de antes conservan su número, que es lo que guarda cada sobre
 assert.ok(PM.CARDS.slice(0,153).every((c,i)=>c.n===i&&c.col==='profes'&&!/starwars/.test(c.uid)));
 assert.ok(PM.CARDS.slice(153,170).every(c=>c.vkey==='starwars'&&c.tier===2));
 assert.equal(PM.TIERS.reduce((s,t)=>s+t.w,0),10000);
 assert.equal(PM.GRADE_W.reduce((s,w)=>s+w,0),1000);
 for(const c of PM.CARDS)assert.ok(fs.existsSync(path.join(__dirname,'../../juegos/prodrop',c.img)),'falta '+c.img);
 assert.equal(new Set(PM.CARDS.map(c=>c.uid)).size,PM.TOTAL);
 assert.equal(new Set(PM.CARDS.map(c=>c.col+c.num)).size,PM.TOTAL,'cada colección numera sus cartas sin repetir');
 // las comunes y raras de componentes llevan además su arte apaisado para la ventana con marco
 for(const c of PM.POR_COL.comp.filter(c=>c.tier<2)){const a=c.img.replace(/\/([^/]+)$/,'/ancho/$1');assert.ok(fs.existsSync(path.join(__dirname,'../../juegos/prodrop',a)),'falta '+a);}
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

// ganado: 'juego' no tiene PESO, así que pesa 1. Los números de abajo
// están en «partidas de 5»: v vale 5·v monedas, sea cual sea la tarifa.
const conGanado=(u,n,extra)=>({completo:true,ranks:{juego:Object.fromEntries(Object.entries(u).map(([k,v])=>[k,{jugadas:v*5/M.TARIFA.partida}]))},solo:{},logros:{},diario:{},...extra});
const K=i=>'-Nk'+String(i).padStart(9,'0');

test('el sobre Plus de fútbol (prefijo h): el doble de precio, sin gratis, y la regla lo exige',()=>{
 const kh=i=>'h-Nplus000'+i,kg=i=>'g-Nnorm000'+i;
 const cartas={s:{a:{[kh(1)]:{at:5000,p:160},[kh(2)]:{at:6000,p:80},[kh(3)]:{at:7000,p:0},[kg(1)]:{at:8000,p:80},[kg(2)]:{at:9000,p:160}}}};
 const d=conGanado({a:100},0,{cartas}),ks=Object.keys(M.economia(d).usuarios.a.sobres);
 assert.ok(ks.includes(kh(1)),'un Plus a 160 vale');
 assert.ok(!ks.includes(kh(2)),'un Plus a 80 no vale');
 assert.ok(!ks.includes(kh(3)),'un Plus gratis no vale');
 assert.ok(ks.includes(kg(1)),'un normal a 80 vale');
 assert.ok(!ks.includes(kg(2)),'un normal a 160 no vale');
 assert.equal(M.monedasDe('a',d).gastadas,240);
 // las reglas de la base de datos piden lo mismo: el doble para la h y nada de gratis para ella
 const reglas=JSON.parse(fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8')).rules.cartas.s.$uid.$k['.validate'];
 assert.match(reglas,/\* \(\$k\.beginsWith\('h'\) \? 2 : 1\)/);
 assert.match(reglas,/!\$k\.beginsWith\('h'\) &&/);
});

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

/* ---------- re-roll ---------- */
test('re-roll: la nota sale del promedio de las diez más un punto',()=>{
 const d=PM.distribucionReroll([5,4,6,4,9,8,8,5,3,2]);
 assert.ok(Math.abs(d.centro-6.4)<1e-9);
 assert.ok(Math.abs(d.prob.reduce((s,x)=>s+x,0)-1)<1e-12);
 const p=i=>d.prob[i-1];
 assert.ok(p(6)+p(7)>.55&&p(6)+p(7)<.6,'6 o 7 es lo común: '+(p(6)+p(7)));
 assert.ok(p(5)>.1&&p(8)>.1,'5 y 8 salen a menudo');
 assert.ok(p(4)>.03&&p(9)>.03,'4 y 9 todavía salen');
 assert.ok(p(1)+p(2)<.002,'1 o 2, casi nunca');
 // todo 10: sale 10; todo 1: alrededor de 2
 assert.ok(PM.distribucionReroll(Array(10).fill(10)).prob[9]>.6);
 const bajo=PM.distribucionReroll(Array(10).fill(1)).prob;assert.ok(bajo[1]>bajo[0]&&bajo[1]>bajo[2]);
 // la tabla de enteros es la campana de σ = 1,3
 PM.PESO_REROLL.forEach((w,dd)=>assert.ok(Math.abs(w-1e6*Math.exp(-((dd/10)**2)/(2*1.69)))<=1,'peso '+dd));
 // y lo que de verdad sale se reparte así
 const n=20000,c=Array(11).fill(0);let suma=0;
 for(let i=0;i<n;i++){const r=PM.reroll('usrAAAA','-Nrr'+i+'abcdef',1790000000000+i,0,[5,4,6,4,9,8,8,5,3,2]);c[r.g]++;suma+=r.g;
  assert.equal(PM.CARDS[r.id].tier,1,'de común sale rara');}
 assert.ok(Math.abs(suma/n-6.4)<.05,'media '+suma/n);
 assert.ok(Math.abs((c[6]+c[7])/n-(p(6)+p(7)))<.015);
});

test('re-roll: la carta es una función de (uid, clave, hora, entradas)',()=>{
 const a=PM.reroll('usrAAAA','-Nrrabcdefgh',1790000000000,2,Array(10).fill(7));
 assert.deepEqual({...a},{...PM.reroll('usrAAAA','-Nrrabcdefgh',1790000000000,2,Array(10).fill(7))});
 assert.equal(PM.CARDS[a.id].tier,3,'de épica sale legendaria');
 const ids=new Set();for(let i=0;i<400;i++)ids.add(PM.reroll('usrAAAA','-Nrr'+i+'abcdefg',1790000000000,2,Array(10).fill(7)).id);
 assert.equal(ids.size,17,'cualquiera de las 17 legendarias');
});

// una cuenta con muchas comunes, para cambiarlas
function conComunes(u,n){
 const s={};let t=1789000000000;const comunes=[];
 for(let i=0;comunes.length<n;i++){const k=K(500+i);s[k]={at:t+i*1000,p:50};
  PM.sobre(u,k,t+i*1000).cartas.forEach((c,j)=>{if(PM.CARDS[c.id].tier===0)comunes.push(`${u}~${k}.${j}`);});}
 return {s:{[u]:s},comunes};
}
test('re-roll en la economía: diez de una rareza por una de la siguiente',()=>{
 const u='usrAAAA',v='usrBBBB',{s,comunes}=conComunes(u,12),at=1789900000000,rk='-Nrr000000001';
 const base=x=>conGanado({[u]:2000,[v]:2000},0,{cartas:{s,...x},mercado:{o:{},t:{}}});
 const d=base({r:{[u]:{[rk]:{at,c:comunes.slice(0,10)}}}}),e=M.economia(d);
 for(const cc of comunes.slice(0,10))assert.equal(e.dueno[cc],undefined,'las diez desaparecen');
 assert.equal(e.dueno[comunes[10]],u,'las demás siguen');
 const nueva=`${u}~${rk}.0`;assert.equal(e.dueno[nueva],u);
 const notas=comunes.slice(0,10).map(cc=>{const [o,r]=cc.split('~'),[k,i]=r.split('.');return PM.sobre(o,k,s[o][k].at).cartas[+i].g;});
 assert.deepEqual({...e.sobres[u+'~'+rk].r},{...PM.reroll(u,rk,at,0,notas)});
 const mia=M.copiasDe(u,d).find(x=>x.c===nueva);assert.ok(mia&&mia.id!=null&&PM.CARDS[mia.id].tier===1);
 assert.equal(M.monedasDe(u,d).gastadas,M.monedasDe(u,base({})).gastadas,'no cuesta monedas');
 // no vale: nueve, repetidas, ajenas, a la venta, rarezas mezcladas
 const vale=c=>!!M.economia(base({r:{[u]:{[rk]:{at,c}}}})).sobres[u+'~'+rk];
 assert.equal(vale(comunes.slice(0,9)),false,'nueve no');
 assert.equal(vale([...comunes.slice(0,9),comunes[0]]),false,'repetida no');
 const otra=PM.sobre(u,Object.keys(s[u])[0],s[u][Object.keys(s[u])[0]].at).cartas.findIndex(c=>PM.CARDS[c.id].tier>=1);
 if(otra>=0)assert.equal(vale([...comunes.slice(0,9),`${u}~${Object.keys(s[u])[0]}.${otra}`]),false,'mezclada no');
 assert.equal(vale([...comunes.slice(0,9),`${v}~${K(1)}.0`]),false,'ajena no');
 const enVenta=M.economia(base({r:{[u]:{[rk]:{at,c:comunes.slice(0,10)}}}}));void enVenta;
 const dv=conGanado({[u]:2000},0,{cartas:{s,r:{[u]:{[rk]:{at,c:comunes.slice(0,10)}}}},mercado:{o:{'-Nof0000001':{u,c:comunes[0],p:5,at:at-1}},t:{}}});
 assert.ok(!M.economia(dv).sobres[u+'~'+rk],'una a la venta no');
 // las que se gastaron ya no sirven para otro
 const dos=base({r:{[u]:{[rk]:{at,c:comunes.slice(0,10)},'-Nrr000000002':{at:at+5,c:comunes.slice(1,11)}}}});
 assert.ok(!M.economia(dos).sobres[u+'~-Nrr000000002'],'no se usan dos veces');
 // la nueva se puede graduar, vender y entra en los drops si es buena
 const dg=base({r:{[u]:{[rk]:{at,c:comunes.slice(0,10)}}},g:{[u]:{[rk]:{0:{at:at+10,p:100}}}}});
 assert.ok(M.economia(dg).graduada[nueva],'se gradúa');
});

test('re-roll: a veces sube dos o tres calidades (común 92/7,5/0,5 %, rara 96/4 %)',()=>{
 assert.deepEqual(PM.SALTO_W.map(f=>[...f]),[[9200,750,50],[9600,400],[10000]]);
 assert.deepEqual([...PM.probSalida(0)].map(x=>+x.toFixed(4)),[0,.92,.075,.005]);
 assert.deepEqual([...PM.probSalida(1)].map(x=>+x.toFixed(4)),[0,0,.96,.04],'de rara: épica 96 %, legendaria 4 %');
 assert.deepEqual([...PM.probSalida(2)],[0,0,0,1]);
 const n=40000,c=[0,0,0,0];
 for(let i=0;i<n;i++)c[PM.CARDS[PM.reroll('usrAAAA','-Ns'+i+'abcdefgh',PM.SALTOS_DESDE+i,0,Array(10).fill(7)).id].tier]++;
 assert.ok(Math.abs(c[1]/n-.92)<.006,'rara '+c[1]/n);
 assert.ok(Math.abs(c[2]/n-.075)<.005,'épica '+c[2]/n);
 assert.ok(Math.abs(c[3]/n-.005)<.0015,'legendaria '+c[3]/n);
 // antes del corte, un re-roll da lo que siempre dio: una sola rareza más
 const c1=[0,0,0,0];
 for(let i=0;i<n;i++)c1[PM.CARDS[PM.reroll('usrAAAA','-Nr'+i+'abcdefgh',PM.SALTOS_DESDE+i,1,Array(10).fill(7)).id].tier]++;
 assert.ok(Math.abs(c1[2]/n-.96)<.005,'épica desde rara '+c1[2]/n);
 assert.ok(Math.abs(c1[3]/n-.04)<.005,'legendaria desde rara '+c1[3]/n);
 for(let i=0;i<300;i++)assert.equal(PM.CARDS[PM.reroll('usrAAAA','-Nv'+i+'abcdefgh',PM.SALTOS_DESDE-1-i,0,Array(10).fill(7)).id].tier,1);
});

test('clasificación de cartas: colección (distintas) y las graduadas más raras, con su dueño de ahora',()=>{
 const u='usrAAAA',v='usrBBBB';
 const ka='-Nka000000000000a',kb='-Nka000000000000b',kc='-Nkb000000000000c';
 const s={[u]:{[ka]:{at:100,p:0},[kb]:{at:200,p:50}},[v]:{[kc]:{at:300,p:50}}};
 const d=conGanado({[u]:2000,[v]:2000},0,{cartas:{s,g:{[u]:{[ka]:{0:{at:400,p:100},3:{at:401,p:100}}},[v]:{[kc]:{2:{at:402,p:100}}}}},mercado:{o:{},t:{}}});
 const col=M.rankingColeccion(d);
 const distintas=(o,ks)=>new Set(ks.flatMap(k=>PM.sobre(o,k,s[o][k].at).cartas.map(c=>c.id))).size;
 const fu=col.find(f=>f.uid===u),fv=col.find(f=>f.uid===v);
 assert.equal(fu.tiene,distintas(u,[ka,kb]));assert.equal(fu.copias,10);assert.equal(fu.total,PM.TOTAL);
 assert.equal(fv.tiene,distintas(v,[kc]));assert.equal(fv.copias,5);
 assert.ok(col[0].tiene>=col[1].tiene,'ordenada por cartas distintas');
 // colecciones más raras: solo graduadas, la mejor de cada carta, rareza por nota
 assert.equal(M.puntosGraduada(3,10),200);assert.equal(M.puntosGraduada(3,9),180);assert.equal(M.puntosGraduada(0,10),10);
 const col0=PM.coleccionDe(ka),top=M.topColecciones(d,col0);
 assert.equal(JSON.stringify(top.map(f=>f.uid).sort()),JSON.stringify([u,v].sort()));
 const tu=top.find(f=>f.uid===u),tv=top.find(f=>f.uid===v);
 assert.equal(tu.cartas.length,2);assert.equal(tv.cartas.length,1);
 assert.ok(tu.cartas.every(c=>c.gr));
 assert.equal(tu.puntos,tu.cartas.reduce((s,c)=>s+M.puntosGraduada(c.carta.tier,c.g),0));
 assert.equal(tu.sobres,2);assert.equal(tv.sobres,1);
 for(let i=1;i<top.length;i++)assert.ok(top[i-1].puntos>=top[i].puntos,'de más puntos a menos');
 // vendida en el mercado, la carta pasa a su comprador y la tabla lo dice
 const cc=u+'~'+ka+'.0';
 const d2=conGanado({[u]:2000,[v]:2000},0,{cartas:d.cartas,mercado:{o:{o1:{u,c:cc,p:10,at:500,v:{u:v,at:600}}},t:{}}});
 const t2=M.topColecciones(d2,col0);
 assert.ok(t2.find(f=>f.uid===v).cartas.some(c=>c.c===cc));
 assert.ok(!t2.find(f=>f.uid===u).cartas.some(c=>c.c===cc));
 assert.equal(t2.find(f=>f.uid===u).sobres,2,'los sobres abiertos no se venden con la carta');
 assert.equal(M.topColecciones({completo:false},col0),null);
 assert.equal(M.rankingColeccion({completo:false}),null);
});

test('colecciones más raras: dos copias de la misma carta cuentan una vez, la de mejor nota',()=>{
 const u='usrAAAA',s={},g={};let at=1792000000000;
 for(let i=0;i<40;i++){const k='c-Nd'+String(i).padStart(9,'0');s[k]={at:at+=1000,p:80};g[k]={};for(let j=0;j<5;j++)g[k][j]={at:at+=10,p:100};}
 const d=conGanado({[u]:40*80+200*100},0,{cartas:{s:{[u]:s},g:{[u]:g}},mercado:{o:{},t:{}}});
 const mejor={};
 for(const k of Object.keys(s))PM.sobre(u,k,s[k].at).cartas.forEach(c=>{mejor[c.id]=Math.max(mejor[c.id]||0,c.g);});
 const f=M.topColecciones(d,'comp')[0];
 assert.equal(f.cartas.length,Object.keys(mejor).length,'una por carta');
 assert.ok(Object.keys(mejor).length<200,'hubo repetidas');
 for(const c of f.cartas)assert.equal(c.g,mejor[c.id]);
 assert.equal(f.puntos,Object.entries(mejor).reduce((t,[id,gr])=>t+M.puntosGraduada(PM.CARDS[id].tier,gr),0));
 assert.equal(f.sobres,40);assert.equal(f.total,PM.POR_COL.comp.length);
 for(let i=1;i<f.cartas.length;i++)assert.ok(f.cartas[i-1].pts>=f.cartas[i].pts);
 assert.equal(M.topColecciones(d,'futbol').length,0);
});

test('colecciones: el prefijo de la clave dice de qué colección es el sobre',()=>{
 assert.equal(PM.coleccionDe('-Nabcdefgh'),'profes');assert.equal(PM.coleccionDe('p-Nabcdefgh'),'profes');assert.equal(PM.coleccionDe('c-Nabcdefgh'),'comp');
 const N=30000,t=[0,0,0,0];let navidad=0,leg=0,dios=0;
 for(let i=0;i<N;i++){
  const so=PM.sobre('u'+(i%11),'c-Nk'+i+'abcdefg',1792000000000+i*7);
  assert.equal(so.col,'comp');
  assert.ok(so.cartas.every(x=>PM.CARDS[x.id].col==='comp'),'un sobre de componentes solo trae componentes');
  assert.equal(new Set(so.cartas.map(x=>x.id)).size,5);
  if(so.dios)dios++;
  for(const x of so.cartas){const c=PM.CARDS[x.id];t[c.tier]++;if(c.tier===3){leg++;if(c.vkey==='navidad')navidad++;}}
 }
 t.forEach((n,i)=>assert.ok(Math.abs(n/N-PM.ESPERADO[i])<Math.max(.012,PM.ESPERADO[i]*.15),`rareza ${i}: ${n/N} vs ${PM.ESPERADO[i]}`));
 assert.ok(Math.abs(dios/N-.02)<.005,'god packs: '+dios/N);
 assert.ok(leg>200&&Math.abs(navidad/leg-.25)<.06,'Navidad es una de cada cuatro legendarias: '+navidad/leg);
 // los de profes nuevos incluyen Star Wars; los de antes, nunca
 let sw=0,swViejo=0;
 for(let i=0;i<20000;i++){
  if(PM.sobre('u1','p-Nk'+i+'abcdefg',1792000000000+i).cartas.some(x=>PM.CARDS[x.id].vkey==='starwars'))sw++;
  if(PM.sobre('u1','-Nk'+i+'abcdefg',1792000000000+i).cartas.some(x=>x.id>=PM.LEGADO))swViejo++;
 }
 assert.ok(sw>0);assert.equal(swViejo,0,'un sobre sin prefijo sale del catálogo de antes');
 // la probabilidad exacta cuenta el peso: una navideña es tres veces más rara que una quemada
 const nav=PM.CARDS.find(c=>c.vkey==='navidad'),que=PM.CARDS.find(c=>c.vkey==='quemado');
 assert.ok(Math.abs(PM.probabilidad(que.n,5).exacta/PM.probabilidad(nav.n,5).exacta-3)<1e-9);
 const pc=PM.POR_COL.comp.reduce((s,c)=>s+PM.probabilidad(c.n,1).exacta,0);
 assert.ok(Math.abs(pc-5)<1e-9,'las exactas de una colección suman cinco cartas por sobre');
});

test('colecciones: un re-roll da una carta de la colección de su clave, y no mezcla',()=>{
 for(let i=0;i<500;i++){
  const r=PM.reroll('usrAAAA','c-Nrr'+i+'abcdef',PM.SALTOS_DESDE+i,1,Array(10).fill(6));
  assert.equal(PM.CARDS[r.id].col,'comp');assert.ok(PM.CARDS[r.id].tier>=2);
 }
 // en la economía: diez comunes de componentes con una clave de profes no valen
 const u='usrAAAA',s={},comunes=[];
 for(let i=0;comunes.length<10;i++){const k='c-Nk'+String(i).padStart(9,'0');s[k]={at:1792000000000+i*1000,p:80};
  PM.sobre(u,k,s[k].at).cartas.forEach((c,j)=>{if(PM.CARDS[c.id].tier===0&&comunes.length<10)comunes.push(`${u}~${k}.${j}`);});}
 const at=1792900000000;
 const d=rk=>conGanado({[u]:9000},0,{cartas:{s:{[u]:s},r:{[u]:{[rk]:{at,c:comunes}}}},mercado:{o:{},t:{}}});
 assert.ok(M.economia(d('c-Nrr000000001')).sobres[u+'~c-Nrr000000001'],'con la clave de su colección vale');
 assert.equal(PM.CARDS[M.economia(d('c-Nrr000000001')).sobres[u+'~c-Nrr000000001'].r.id].col,'comp');
 assert.ok(!M.economia(d('p-Nrr000000001')).sobres[u+'~p-Nrr000000001'],'con clave de profes no');
 assert.ok(!M.economia(d('-Nrr0000000001')).sobres[u+'~-Nrr0000000001'],'ni con una clave de antes');
 // y los sobres con prefijo se cobran igual que los de siempre
 assert.equal(M.monedasDe(u,d('c-Nrr000000001')).gastadas,Object.keys(s).length*80);
});

test('la Serie 01 (profes): solo la ve quien está en la lista, y nadie pierde nada al salir de ella',()=>{
 const u='usrAAAA';
 let kp='',kc='';
 for(let i=0;!kp||!kc;i++){
  const p='p-Nks'+String(i).padStart(8,'0'),c='c-Nks'+String(i).padStart(8,'0'),at=1790000000000+i;
  if(!kp&&PM.CARDS[PM.sobre(u,p,at).cartas[4].id].tier>=2)kp=p;
  if(!kc&&PM.CARDS[PM.sobre(u,c,at).cartas[4].id].tier>=2)kc=c;
 }
 const atDe=k=>1790000000000+ +k.slice(5);
 const d=conGanado({[u]:1000},0,{cartas:{s:{[u]:{[kp]:{at:atDe(kp),p:80},[kc]:{at:atDe(kc),p:80}}}},mercado:{o:{},t:{}}});
 const perfil={cartas:[u+'~'+kp+'.4',u+'~'+kc+'.4']};
 assert.ok(M.veSerie1());
 assert.equal(M.exhibidasDe(u,perfil,d).length,2);
 assert.equal(M.rankingColeccion(d)[0].total,PM.TOTAL);
 const saldo=M.monedasDe(u,d).saldo,copias=M.copiasDe(u,d).length;
 // sin estar en la lista
 assert.equal(M.fijaSerie1({},'mira'),true,'cambió lo que se ve');
 assert.equal(M.veSerie1(),false);
 assert.equal(M.fijaSerie1({},'mira'),false,'la misma lista no repinta');
 assert.equal(M.copiaVisible(u+'~'+kp+'.0'),false);assert.equal(M.copiaVisible(u+'~'+kc+'.0'),true);
 assert.equal(M.copiaVisible(u+'~-Nviejo00000.0'),false,'un sobre sin prefijo es de los profes');
 assert.equal(M.copiaVisible('ma:'+u+'~-Nadop00001'),true,'una mascota no es una carta');
 const ex=M.exhibidasDe(u,perfil,d);
 assert.equal(ex.length,1);assert.equal(ex[0].carta.col,'comp');
 assert.ok(M.mejoresDrops(d).every(c=>c.carta.col==='comp'));
 assert.ok(M.mejoresDrops(d).length>=1);
 const col=M.rankingColeccion(d);
 assert.equal(col[0].total,PM.POR_COL.comp.length+PM.POR_COL.futbol.length);assert.equal(col[0].copias,5,'solo cuentan las de componentes');
 assert.equal(M.totalVisible(),PM.POR_COL.comp.length+PM.POR_COL.futbol.length);
 assert.equal(M.cifras(d).sobres,1,'el sobre de los profes no se cuenta');
 // la economía no lee la lista: las cartas, el saldo y el gasto siguen iguales
 assert.equal(M.monedasDe(u,d).saldo,saldo);assert.equal(M.copiasDe(u,d).length,copias);assert.equal(copias,10);
 // otra cuenta en la lista: quien mira sigue sin verla, pero sabe que esa sí
 M.fijaSerie1({otra:{at:1}},'mira');
 assert.equal(M.veSerie1(),false);assert.equal(M.veSerie1('otra'),true);
 assert.equal(M.copiaVisible(u+'~'+kp+'.0','otra'),true);
 // al volver a la lista vuelve todo
 M.fijaSerie1(VE_TODO,'mira');
 assert.equal(M.exhibidasDe(u,perfil,d).length,2);
 assert.equal(M.rankingColeccion(d)[0].copias,10);
});

test('fútbol: una sola colección; la rareza sale de la media del jugador',()=>{
 assert.deepEqual(PM.BANDAS,[80,84,87]);
 assert.deepEqual([60,80,81,84,85,87,88,99].map(PM.tierDeMedia),[0,0,1,1,2,2,3,3]);
 assert.ok(PM.esFutbol('futbol')&&!PM.esFutbol('premier')&&!PM.esFutbol('comp')&&!PM.esFutbol('profes'));
 assert.deepEqual(PM.COLECCIONES.map(c=>c.key),['profes','comp','futbol'],'ya no hay Clásico y Premier aparte');
 assert.equal(PM.COL.futbol.prefijo,'g');
 for(const c of PM.POR_COL.futbol)assert.equal(c.tier,PM.tierDeMedia(c.media),c.name+' tiene la rareza de su media');
 assert.equal(PM.POR_COL.futbol.find(c=>c.name==='Mbappé').tier,3,'Mbappé (91) es legendaria');
 assert.equal(PM.POR_COL.futbol.find(c=>c.name==='C. Espí').tier,0,'Espí (68) es común');
 assert.ok(PM.POR_COL.futbol.every(c=>c.col==='futbol'),'todas las cartas de futbolistas son de fútbol');
});

test('fútbol: las claves de antes (f, e) siguen rehaciendo los mismos sobres, y las nuevas (g, h) salen del catálogo entero',()=>{
 for(const [pre,col] of [['f','futbol'],['e','futbol'],['g','futbol'],['h','futbol'],['p','profes'],['c','comp'],['','profes']])assert.equal(PM.coleccionDe((pre?pre+'-':'-')+'Nabcdefgh'),col,pre);
 assert.deepEqual(['f','e','g','h','p','c','-'].map(p=>PM.sobreDe(p+'-Nabcdefgh')),['futbol','futbol','futbol','futbolplus','profes','comp','profes']);
 // los de antes: solo sus cartas, con los pesos de entonces; y salen exactamente lo que salían
 const clasico=new Set(PM.POOL.futbol1.flat().map(c=>c.n)),premier=new Set(PM.POOL.premier1.flat().map(c=>c.n));
 assert.equal(clasico.size,48);assert.equal(premier.size,155);
 assert.deepEqual(PM.PESOS_FUTBOL.v1,{futbol:[5500,3300,1000,200],premier:[5500,3500,900,100]});
 for(let i=0;i<400;i++){
  assert.ok(PM.sobre('u'+(i%7),'f-Nk'+i+'abcdefg',1792000000000+i).cartas.every(x=>clasico.has(x.id)),'un sobre f sale del Clásico');
  assert.ok(PM.sobre('u'+(i%7),'e-Nk'+i+'abcdefg',1792000000000+i).cartas.every(x=>premier.has(x.id)),'un sobre e sale de la Premier');
 }
 // fijado con el motor de antes de la unión: estos ids no pueden cambiar nunca
 assert.deepEqual(PM.sobre('u1','e-Nk7abcdefg',1792000000000).cartas.map(c=>c.id),[599,563,596,633,582]);
 assert.deepEqual(PM.sobre('u1','f-Nk7abcdefg',1792000000000).cartas.map(c=>c.id),[467,449,491,478,485]);
 // un re-roll de antes también: con la lista de su colección de entonces
 for(let i=0;i<200;i++){
  const r=PM.reroll('usrAAAA','f-Nrr'+i+'abcdef',PM.SALTOS_DESDE+i,2,Array(10).fill(6));
  assert.ok(clasico.has(r.id));assert.equal(PM.CARDS[r.id].tier,3,'10 épicas dan una legendaria');
  assert.ok(premier.has(PM.reroll('usrAAAA','e-Nrr'+i+'abcdef',PM.SALTOS_DESDE+i,1,Array(10).fill(6)).id));
 }
 // y uno de ahora sale de todo el catálogo de fútbol
 const salen=new Set();
 for(let i=0;i<400;i++){const r=PM.reroll('usrAAAA','g-Nrr'+i+'abcdef',PM.SALTOS_DESDE+i,0,Array(10).fill(6));assert.equal(PM.CARDS[r.id].col,'futbol');salen.add(PM.CARDS[r.id].club);}
 assert.ok(salen.size>=6,'el re-roll nuevo mezcla clubes: '+salen.size);
});

test('fútbol: el sobre normal y el Plus; probabilidades por rareza, quinta carta y precio',()=>{
 assert.deepEqual(PM.SOBRES.map(x=>x.key),['profes','comp','futbol','futbolplus']);
 assert.deepEqual(PM.SOBRES.filter(x=>x.grupo==='futbol').map(x=>[x.prefijo,x.mult]),[['g',1],['h',2]]);
 assert.ok(PM.SOBRES.every(x=>PM.COL[x.col]),'cada sobre es de una colección');
 assert.deepEqual(PM.PESOS_FUTBOL.normal,[6600,3000,340,60]);
 assert.deepEqual(PM.PESOS_FUTBOL.plus,[3000,6800,150,50]);assert.deepEqual(PM.PESOS_FUTBOL.ultimaPlus,[9300,700]);
 assert.equal(PM.PESOS_FUTBOL.normal.reduce((a,b)=>a+b,0),10000);assert.equal(PM.PESOS_FUTBOL.plus.reduce((a,b)=>a+b,0),10000);
 assert.equal(PM.PESOS_FUTBOL.ultimaPlus.reduce((a,b)=>a+b,0),10000);
 // el Plus cuesta el doble, en la promo y después
 assert.equal(PM.precioSobre(PM.PRECIO.promoHasta,2),160);assert.equal(PM.precioSobre(PM.PRECIO.promoHasta-1,2),100);assert.equal(PM.precioSobre(PM.PRECIO.promoHasta),80);
 const N=20000,tn=[0,0,0,0],tp=[0,0,0,0];let sin=0;
 for(let i=0;i<N;i++){
  const a=PM.sobre('u'+(i%7),'g-Nk'+i+'abcdefg',1792000000000+i*7),b=PM.sobre('u'+(i%7),'h-Nk'+i+'abcdefg',1792000000000+i*7);
  for(const so of [a,b]){assert.equal(so.col,'futbol');assert.equal(new Set(so.cartas.map(x=>x.id)).size,5);}
  const ta=a.cartas.map(x=>PM.CARDS[x.id].tier),tb=b.cartas.map(x=>PM.CARDS[x.id].tier);
  assert.ok(ta[4]>=1,'la quinta del normal es rara o mejor');
  assert.ok(tb[4]>=2,'la quinta del Plus es épica o mejor: siempre');
  assert.ok(tb.some(t=>t>=2),'todo sobre Plus trae una épica');
  if(!ta.some(t=>t>=2))sin++;
  ta.forEach(t=>tn[t]++);tb.forEach(t=>tp[t]++);
 }
 const en=PM.POOL.futbol.esperado,ep=PM.POOL.futbolplus.esperado;
 for(let k=0;k<4;k++){
  assert.ok(Math.abs(tn[k]/N-en[k])<.04,'normal rareza '+k+': '+(tn[k]/N).toFixed(3)+' vs '+en[k].toFixed(3));
  assert.ok(Math.abs(tp[k]/N-ep[k])<.04,'Plus rareza '+k+': '+(tp[k]/N).toFixed(3)+' vs '+ep[k].toFixed(3));
 }
 assert.ok(sin/N>.3,'un sobre normal sin épica es lo común: '+sin/N);
 assert.ok(tp[0]/N<tn[0]/N-.5,'el Plus trae bastantes menos comunes');
 // vale un poco más por moneda en lo más raro: por el doble de precio, bastante más épicas (la quinta está asegurada) y algo más del doble de legendarias
 assert.ok(ep[2]+ep[3]>=1.4*(en[2]+en[3])&&ep[2]+ep[3]<=3.4*(en[2]+en[3]),'épicas o mejores por sobre: '+(ep[2]+ep[3])+' vs '+(en[2]+en[3]));
 assert.ok(ep[3]>=1.8*en[3]&&ep[3]<3.2*en[3],'legendarias por sobre: '+ep[3]+' vs '+en[3]);
 // lo que se promete: una legendaria en 1 de cada ~20 sobres normales y ~10 Plus (con el god pack)
 const unaLeg=k=>{const P=PM.POOL[k],w=P.w,u=P.ultima,t=w.reduce((a,b)=>a+b,0),alta=w[1]+w[2]+w[3],q3=u?u[1]/(u[0]+u[1]):w[3]/alta,pl=w[3]/t,pd=PM.DIOS/10000,pg=1-Math.pow(w[2]/(w[2]+w[3]),5);return (1-pd)*(1-(1-pl)**4*(1-q3))+pd*pg;};
 assert.ok(Math.abs(1/unaLeg('futbol')-19.5)<1.5,'normal: '+1/unaLeg('futbol'));
 assert.ok(Math.abs(1/unaLeg('futbolplus')-10)<1,'Plus: '+1/unaLeg('futbolplus'));
 // mejor media, más difícil: de la rara hacia arriba un jugador en concreto sale menos
 for(const k of ['futbol','futbolplus']){
  const P=PM.POOL[k],porJugador=P.map((l,t)=>P.esperado[t]/l.length);
  for(let t=2;t<4;t++)assert.ok(porJugador[t]<porJugador[t-1],k+': un jugador de rareza '+t+' sale menos que uno de la '+(t-1)+' ('+porJugador.map(x=>x.toFixed(3))+')');
 }
 // las cinco cartas de un sobre normal se reparten entre todos los jugadores (exacta, por colección)
 const pe=PM.POR_COL.futbol.reduce((s,c)=>s+PM.probabilidad(c.n,1).exacta,0);
 assert.ok(Math.abs(pe-5)<1e-9,'los jugadores suman las cinco cartas del sobre');
 // y dentro de un mismo sobre no se repiten ni clubes imposibles: salen de los ocho
 const clubes=new Set();for(let i=0;i<300;i++)for(const x of PM.sobre('u1','g-Nc'+i+'abcdefg',1792000000000+i).cartas)clubes.add(PM.CARDS[x.id].club);
 assert.equal(clubes.size,8,'el sobre trae jugadores de los ocho clubes');
});

test('ampliaciones: un sobre g o h comprado antes sigue viendo solo las cartas de entonces',()=>{
 const v=PM.AMPLIACIONES[0];
 assert.equal(v.n,648,'las 648 de antes de los siete clubes de la Champions');
 // fijados con el motor de antes de agregar esos clubes: estos ids no pueden cambiar nunca
 const ids=pre=>[0,1,2].map(i=>PM.sobre('u'+i,pre+'-Nk'+(7+i)+'abcdefg',1792000000000+i*1234567).cartas.map(c=>c.id));
 assert.deepEqual(ids('g'),[[617,598,645,581,570],[535,475,448,474,454],[645,545,514,535,605]]);
 assert.deepEqual(ids('h'),[[626,639,475,631,625],[529,532,609,590,643],[494,479,581,592,454]]);
 assert.deepEqual([0,1].map(i=>{const r=PM.reroll('usrAAAA','g-Nrr'+i+'abcdef',PM.SALTOS_DESDE+i*99,i,Array(10).fill(6));return r.id+'/'+r.g+'/'+r.w;}),['630/6/1531451647','518/5/1469846715']);
 // antes de `hasta`: ninguna carta nueva, ni en sobres ni en re-rolls; después, sí
 let nuevasAntes=0,nuevasDespues=0;
 for(let i=0;i<300;i++){
  for(const pre of ['g','h']){
   if(PM.sobre('u'+(i%9),pre+'-Nm'+i+'abcdefg',v.hasta-1-i).cartas.some(c=>c.id>=648))nuevasAntes++;
   if(PM.sobre('u'+(i%9),pre+'-Nm'+i+'abcdefg',v.hasta+i).cartas.some(c=>c.id>=648))nuevasDespues++;
  }
  if(PM.reroll('usrAAAA','g-Nrr'+i+'abcdef',v.hasta-1-i,0,Array(10).fill(6)).id>=648)nuevasAntes++;
 }
 assert.equal(nuevasAntes,0,'un sobre de antes no ve las nuevas');
 assert.ok(nuevasDespues>500,'un sobre de ahora sí: '+nuevasDespues);
 assert.ok(PM.poolDe('g-N0',v.hasta-1).every(l=>l.every(c=>c.n<648)));
 assert.equal(PM.poolDe('g-N0').reduce((s,l)=>s+l.length,0),666,'sin hora: el catálogo de hoy');
 // la segunda ampliación (el Bayern): un sobre de antes de su corte ve las 813 de entonces, ni una más
 const b=PM.AMPLIACIONES[1];
 assert.equal(b.n,813);assert.ok(b.hasta>v.hasta);
 assert.equal(PM.poolDe('g-N0',b.hasta-1).reduce((s,l)=>s+l.length,0),368);
 let bayernAntes=0;
 for(let i=0;i<300;i++)for(const pre of ['g','h'])if(PM.sobre('u'+(i%9),pre+'-Nb'+i+'abcdefg',b.hasta-1-i).cartas.some(c=>c.id>=813))bayernAntes++;
 assert.equal(bayernAntes,0,'un sobre de antes no ve al Bayern');
 // la tercera (Chile, Argentina, la MLS y Arabia): un sobre de antes de su corte ve las 833 de entonces
 const ch=PM.AMPLIACIONES[2];
 assert.equal(ch.n,833);assert.ok(ch.hasta>b.hasta);
 assert.equal(PM.poolDe('g-N0',ch.hasta-1).reduce((s,l)=>s+l.length,0),388);
 let chileAntes=0,chileDespues=0;
 for(let i=0;i<300;i++)for(const pre of ['g','h']){
  if(PM.sobre('u'+(i%9),pre+'-Nc'+i+'abcdefg',ch.hasta-1-i).cartas.some(c=>c.id>=833))chileAntes++;
  if(PM.sobre('u'+(i%9),pre+'-Nc'+i+'abcdefg',ch.hasta+i).cartas.some(c=>c.id>=833))chileDespues++;
 }
 assert.equal(chileAntes,0,'un sobre de antes no ve a Chile ni Argentina');
 assert.ok(chileDespues>0,'un sobre de ahora sí');
 // la cuarta (la especial de Cristiano): un sobre de antes de su corte ve las 1110 de entonces, ni una más
 const cr=PM.AMPLIACIONES[3];
 assert.equal(cr.n,1110);assert.ok(cr.hasta>ch.hasta);
 assert.equal(PM.poolDe('g-N0',cr.hasta-1).reduce((s,l)=>s+l.length,0),665);
 assert.equal(PM.poolDe('h-N0',cr.hasta-1).reduce((s,l)=>s+l.length,0),665);
 let crAntes=0,crDespues=0;
 for(let i=0;i<3000;i++)for(const pre of ['g','h']){
  if(PM.sobre('u'+(i%9),pre+'-Nx'+i+'abcdefg',cr.hasta-1-i).cartas.some(c=>c.id>=1110))crAntes++;
  if(PM.sobre('u'+(i%9),pre+'-Nx'+i+'abcdefg',cr.hasta+i).cartas.some(c=>c.id>=1110))crDespues++;
 }
 assert.equal(crAntes,0,'un sobre de antes no ve la de Cristiano');
 assert.ok(crDespues>0,'un sobre de después sí');
});

test('cartas especiales por tiempo limitado: Mbappé (92), Kane (94) y Cristiano (96), legendarias, tres veces más seguido que otra legendaria',()=>{
 const [mb,kane,cr7]=PM.CARDS.filter(c=>c.especial),base=PM.CARDS.find(c=>c.uid==='realmadrid-mbappe-legend'&&!c.especial);
 assert.equal(mb.name,'Mbappé');assert.equal(mb.media,base.media+1,'92: una más que el Mbappé de siempre');assert.equal(mb.tier,3);
 assert.match(mb.cinta,/MVP/);assert.equal(mb.especial,'clasico');
 assert.equal(kane.name,'Harry Kane');assert.equal(kane.media,94);assert.equal(kane.tier,3);assert.match(kane.cinta,/BAL/);assert.equal(kane.club,'bayern');assert.equal(kane.pais,'ENG');
 assert.equal(cr7.name,'C. Ronaldo');assert.equal(cr7.media,96);assert.equal(cr7.tier,3);assert.equal(cr7.cinta,'BOAT');assert.equal(cr7.club,'alnassr');assert.equal(cr7.pais,'PT');assert.equal(cr7.n,1110);
 assert.ok(PM.CARDS.some(c=>!c.especial&&c.person===cr7.person&&c.name==='C. Ronaldo'),'es el mismo Cristiano de Al Nassr: no se puede tener los dos en el once');
 assert.deepEqual(cr7.posiciones,['DC']);
 for(const c of [mb,kane,cr7]){
  assert.equal(c.col,'futbol');assert.equal(c.liga,'especiales');assert.ok(c.limitada);assert.equal(c.peso,3);
  assert.ok(fs.existsSync(path.join(__dirname,'../../juegos/prodrop',c.img)),'falta '+c.img);
  assert.ok(c.n>=648,'va dentro de la ampliación: los sobres de antes no la ven');
 }
 assert.equal(mb.person,base.person,'es el mismo Mbappé: no se puede tener los dos en el once');
 assert.deepEqual(kane.posiciones,['DC']);
 assert.ok(fs.existsSync(path.join(__dirname,'../../juegos/prodrop/escudos/bayern.png')));
 assert.equal(PM.CLUBES.bayern,'Bayern Múnich');
 // salen en los sobres de ahora (el normal y el Plus) y en ninguno de antes de la ampliación
 const hasta=PM.AMPLIACIONES[0].hasta;
 const cuenta=(pre,desde)=>{let n=0;for(let i=0;i<4000;i++)if(PM.sobre('u'+(i%9),pre+'-Nw'+i+'abcdefg',desde+i).cartas.some(c=>PM.CARDS[c.id].limitada))n++;return n;};
 assert.equal(cuenta('g',hasta-5000),0,'antes de la ampliación no salen');
 assert.equal(cuenta('h',hasta-5000),0);
 assert.ok(cuenta('g',hasta)>10&&cuenta('h',hasta)>10,'después sí, en el normal y en el Plus');
 assert.deepEqual(PM.poolDe('g-N0',hasta).map(l=>l.length),[217,87,41,23]);
 assert.deepEqual(PM.poolDe('g-N0',hasta).peso,[217,87,41,21+6],'pesan el triple');
 assert.deepEqual(PM.poolDe('g-N0',hasta-1).map(l=>l.length),[105,58,23,17],'los de antes siguen viendo solo las de antes');
 // las medias del banner de la página de Juegos son estas
 const arte=fs.readFileSync(path.join(__dirname,'..','src/juegos/novedades-arte.js'),'utf8');
 const cartas=[...arte.matchAll(/img: "([^"]+)", nombre: "[^"]+", media: (\d+)/g)];
 assert.equal(cartas.length,9,'las nueve estrellas del banner');
 for(const [,img,media] of cartas){const c=PM.CARDS.find(x=>x.img==='cards/'+img+'.webp');assert.ok(c,'el banner nombra '+img+', que no está');assert.equal(c.media,+media,'el banner muestra la media de verdad: '+img);}
});

test('Premier: 155 jugadores de seis clubes con media, foto y rareza (ahora dentro del catálogo de fútbol)',()=>{
 const premier=PM.POR_COL.futbol.filter(c=>/cards\/premier\//.test(c.img));
 assert.equal(premier.length,155);
 const clubs=new Set(premier.map(c=>c.club));
 assert.deepEqual([...clubs].sort(),['arsenal','chelsea','liverpool','mancity','manutd','tottenham']);
 for(const c of premier)assert.ok(c.media>=60&&c.media<=91,c.name);
});

test('Premier: cada jugador tiene foto, posición, dorsal y un país que la página sabe nombrar',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../../juegos/prodrop/app.js'),'utf8');
 const nombres=new Set([...app.slice(app.indexOf('const FUT_PAIS'),app.indexOf('const bandera')).matchAll(/\b([A-Z]{2,3}):/g)].map(m=>m[1]));
 assert.equal(PM.PREMIER.length,155);
 const vistos=new Set();
 for(const [club,id,nombre,pos,dorsal,pais] of PM.PREMIER){
  assert.ok(PM.CLUBES[club],'club '+club);
  assert.ok(!vistos.has(club+id),'repetido '+club+'/'+id);vistos.add(club+id);
  assert.ok(fs.existsSync(path.join(__dirname,'../../juegos/prodrop/cards/premier',club,id+'.webp')),'falta la foto de '+club+'/'+id);
  assert.ok(['POR','DEF','MED','DEL'].includes(pos),pos);
  assert.ok(Number.isInteger(dorsal)&&dorsal>0&&dorsal<100,nombre);
  assert.ok(nombres.has(pais),'la página no nombra el país '+pais+' ('+nombre+')');
  assert.ok(nombre.length<=14,nombre+' no cabe en la carta');
 }
 for(const c of PM.POR_COL.futbol)assert.ok(nombres.has(c.pais),c.pais);
 for(const [club,id,nombre,pos,dorsal,pais] of PM.CHAMPIONS){
  assert.ok(PM.CLUBES[club],'club '+club);
  assert.ok(fs.existsSync(path.join(__dirname,'../../juegos/prodrop/cards/champions',club,id+'.webp')),'falta la foto de '+club+'/'+id);
  assert.ok(nombre.length<=14,nombre+' no cabe en la carta');
  assert.ok(nombres.has(pais),'la página no nombra el país '+pais+' ('+nombre+')');
 }
});

test('fútbol: cada futbolista tiene su media (60-99) y una sola carta',()=>{
 const por={};
 for(const c of PM.POR_COL.futbol){
  assert.ok(Number.isInteger(c.media)&&c.media>=55&&c.media<=99,c.name+' '+c.media);
  if(c.especial)continue;      // las especiales son otra carta del mismo jugador
  assert.equal(por[c.person],undefined,c.name+' tiene una sola carta');por[c.person]=c.media;
 }
 assert.equal(Object.keys(por).length,663);
 assert.equal(por['bayern-harry-kane'],89,'Kane tiene su carta de siempre, aparte del Balón de Oro');
 for(const [club,id] of PM.FUTBOLISTAS.concat(PM.PREMIER,PM.CHAMPIONS,PM.ESPECIALES,PM.ESPECIALES2,PM.BAYERN,PM.CHILE,PM.ARGENTINA,PM.MLS,PM.ARABIA))assert.ok(PM.MEDIAS[club]&&PM.MEDIAS[club][id],'sin media: '+club+'/'+id);
});

test('las portadas de los sobres de fútbol son jugadores que existen',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../../juegos/prodrop/app.js'),'utf8');
 const bloque=app.slice(app.indexOf('const PORTADA = {'),app.indexOf('const fanDe'));
 const pares=[...bloque.matchAll(/\['([a-z]+)', '([a-z-]+)'\]/g)].map(m=>m[1]+'-'+m[2]);
 assert.equal(pares.length,9);
 for(const p of pares)assert.ok(PM.CARDS.some(c=>c.person===p||c.uid.startsWith(p+'-')),'la portada nombra a '+p+', que no está');
});

test('cartas de fútbol: cada país tiene su bandera y cada club su escudo, como archivos de la página',()=>{
 const dir=path.join(__dirname,'../../juegos/prodrop');
 const paises=new Set([...PM.FUTBOLISTAS,...PM.PREMIER,...PM.CHAMPIONS,...PM.BAYERN,...PM.CHILE,...PM.ARGENTINA,...PM.MLS,...PM.ARABIA].map(x=>x[5]));
 for(const cc of paises)assert.ok(fs.existsSync(path.join(dir,'flags',cc.toLowerCase()+'.png')),'falta la bandera de '+cc);
 const clubes=new Set(PM.POR_COL.futbol.map(c=>c.club));
 assert.equal(clubes.size,28);
 for(const k of clubes){assert.ok(PM.CLUBES[k],k);assert.ok(fs.existsSync(path.join(dir,'escudos',k+'.png')),'falta el escudo de '+k)}
});

test('la formación de los desafíos es un 4-3-3',()=>{
 assert.equal(PM.FORMACION.length,11);
 assert.deepEqual([0,1,2,3].map(f=>PM.FORMACION.filter(x=>x.fila===f).length),[1,4,3,3]);
});

const FUT=PM.CARDS.filter(c=>PM.esFutbol(c.col));
test('las posiciones: cada futbolista tiene una o dos, la línea de su carta es la de la primera, y el ajuste es verde, amarillo o rojo',()=>{
 for(const c of FUT){
  assert.ok(c.posiciones.length>=1&&c.posiciones.length<=2,c.name);
  assert.ok(c.posiciones.every(p=>PM.POS_LINEA[p]),c.name+' '+c.posiciones);
  assert.equal(c.pos,PM.POS_LINEA[c.posiciones[0]],c.name);
  assert.equal(new Set(c.posiciones).size,c.posiciones.length);
  assert.ok(c.posiciones.includes('POR')===(c.pos==='POR'),'solo los porteros van de portero: '+c.name);
 }
 const por=n=>FUT.find(c=>c.name.includes(n)).posiciones;
 assert.deepEqual(por('Mbappé'),['DC','EI']);
 assert.deepEqual(por('Valverde'),['MC','LD']);
 // verde, amarillo, rojo
 assert.deepEqual(PM.ajuste('DC',['DC','EI']),{nivel:'ok',pen:0});
 assert.equal(PM.ajuste('EI',['DC','EI']).nivel,'ok');
 assert.equal(PM.ajuste('DFC',['LI']).nivel,'incomodo');      // un lateral de central
 assert.equal(PM.ajuste('MD',['LD']).nivel,'incomodo');       // el cruce de banda
 assert.equal(PM.ajuste('ED',['MD']).nivel,'incomodo');
 assert.equal(PM.ajuste('DC',['DFC']).nivel,'mal');           // un central de delantero
 assert.equal(PM.ajuste('MC',['EI']).nivel,'mal');
 assert.equal(PM.ajuste('POR',['DFC']).pen,PM.PEN_AJUSTE.porteria);
 assert.equal(PM.ajuste('DFC',['POR']).pen,PM.PEN_AJUSTE.porteria);
 assert.ok(PM.PEN_AJUSTE.ok<PM.PEN_AJUSTE.incomodo&&PM.PEN_AJUSTE.incomodo<PM.PEN_AJUSTE.mal&&PM.PEN_AJUSTE.mal<PM.PEN_AJUSTE.porteria);
 // las posiciones no tocan los sobres: la misma rareza de siempre
 assert.deepEqual(PM.POOL.premier1.map(l=>l.length),[92,39,16,8]);
 assert.deepEqual(PM.POOL.futbol1.map(l=>l.length),[13,19,7,9]);
});
