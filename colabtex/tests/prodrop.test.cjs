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
 ';globalThis.__M={monedasDe,gastoDe,topMonedas,exhibidasDe,mejoresDrops,solvente,cifras,miniCarta}',ctx);
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

test('lo gastado se resta del saldo, no de lo ganado',()=>{
 const sinGasto=M.monedasDe('a',datos());
 const d=datos({cartas:{s:{a:{'-Nk1abcdefgh':{at:1,p:50},'-Nk2abcdefgh':{at:2,p:80}}},g:{a:{'-Nk1abcdefgh':{0:{at:3,p:100}}}}}});
 const m=M.monedasDe('a',d);
 assert.equal(m.total,sinGasto.total);
 assert.equal(m.gastadas,230);
 assert.equal(m.saldo,m.total-230);
 assert.equal(M.gastoDe('b',d.cartas),0);
 assert.equal(M.topMonedas(d)[0].total,m.total,'el top ordena por lo ganado');
});

test('exhibidas y mejores drops: solo lo que existe, y nada de quien está en negativo',()=>{
 // un sobre con épica o mejor para que salga en los drops
 let k='',at=0;
 for(let i=0;!k;i++){const kk='-Nkb'+String(i).padStart(8,'0'),s=PM.sobre('a',kk,1790000000000+i);if(PM.CARDS[s.cartas[4].id].tier>=2){k=kk;at=1790000000000+i;}}
 const d=datos({cartas:{s:{a:{[k]:{at,p:50}}},g:{a:{[k]:{4:{at:at+1,p:100}}}}}});
 const ex=M.exhibidasDe('a',{cartas:[k+'.4','-Nnoexistexx.1','<img>.2']},d);
 assert.equal(ex.length,1);assert.equal(ex[0].gr,true);assert.equal(ex[0].id,PM.sobre('a',k,at).cartas[4].id);
 const top=M.mejoresDrops(d);
 assert.ok(top.length>=1&&top.every(c=>c.carta.tier>=2));
 assert.ok(top.every((c,i)=>!i||top[i-1].carta.tier>=c.carta.tier),'las legendarias primero');
 assert.ok(M.miniCarta(top[0]).includes('juegos/prodrop/cards/'));
 const pobre=datos({ranks:{},cartas:d.cartas});
 assert.equal(M.solvente('a',pobre),false,'compró sin haber ganado nada');
 assert.equal(M.exhibidasDe('a',{cartas:[k+'.4']},pobre).length,0);
 assert.equal(M.mejoresDrops(pobre).length,0);
 assert.equal(M.mejoresDrops(Object.assign({},d,{completo:false})).length,0,'con la lectura a medias no se juzga a nadie');
 assert.equal(M.cifras(d).sobres,1);
});
