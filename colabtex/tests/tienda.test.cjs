/* La tienda del perfil y los marcos de campeón: el cobro en la economía
   (src/juegos/monedas.js), los requisitos (src/juegos/perfil-tarjeta.js)
   y los dibujos animados (src/juegos/marcos-animados.js). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const PM=require('../../juegos/prodrop/motor.js');
const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const carga=(fs_,exp)=>{const c={__PM:PM};vm.createContext(c);vm.runInContext('const PM=__PM;'+fs_.map(f=>sin('src/juegos/'+f+'.js')).join('\n')+';globalThis.__T={'+exp+'}',c);return c.__T;};
/* Cada módulo es suyo en el bundle; concatenados, chocan nombres internos
   (`juegoDeCategoria`, `snake`), así que van en contextos separados. */
const T=Object.assign(carga(['motor','logros','tienda','cortes','monedas'],'TIENDA,PRECIO_TIENDA,economia,monedasDe'),
 carga(['motor','logros','tienda','perfil-tarjeta'],'MARCOS,FONDOS,estadisticas,requisito,marcoVisible,fondoVisible,campeones,topDeCategoria,SOLO_PREFIJO,JUEGOS'),
 carga(['marcos-animados'],'MARCOS_ANIMADOS,adorno,tieneAdorno'));

/* BBTAN hasta la ronda 300: unas once mil monedas. */
const rico={solo:{'club-bbtan-rondas':{a:{nombre:'Ana',puntos:300,tiempo:1}}}};
const conTienda=(t,base=rico)=>Object.assign({},base,{tienda:t});

test('la tienda: diez artículos, cinco marcos y cinco fondos, a 5000',()=>{
 assert.equal(T.PRECIO_TIENDA,5000);
 const v=Object.values(T.TIENDA);
 assert.equal(v.filter(x=>x==='marco').length,5);assert.equal(v.filter(x=>x==='fondo').length,5);
 for(const [id,t] of Object.entries(T.TIENDA)){
  const l=t==='marco'?T.MARCOS:T.FONDOS,x=l.find(m=>m.id===id);
  assert.ok(x,'falta '+id);assert.ok(x.anim,id+' es animado');assert.ok(x.req&&x.req.tienda,id+' se compra');
 }
});

test('una compra cobra una vez, al precio, y solo con saldo',()=>{
 const g=T.monedasDe('a',rico).saldo;
 assert.ok(g>=10000,'BBTAN 300 da para dos compras');
 let d=conTienda({a:{cometa:{at:10,p:5000}}});
 assert.equal(T.monedasDe('a',d).saldo,g-5000);
 assert.ok(T.economia(d).usuarios.a.tienda.cometa);
 d=conTienda({a:{cometa:{at:10,p:50}}});
 assert.equal(T.monedasDe('a',d).saldo,g,'precio equivocado: no cuenta');
 assert.ok(!(T.economia(d).usuarios.a||{tienda:{}}).tienda.cometa);
 d=conTienda({a:{inventado:{at:10,p:5000}}});
 assert.equal(T.monedasDe('a',d).saldo,g,'artículo que no existe');
 d=conTienda({b:{olas:{at:10,p:5000}}});
 const b=T.economia(d).usuarios.b;
 assert.ok(!b.tienda.olas,'sin saldo no se compra');assert.ok(b.parada);
 assert.equal(T.monedasDe('b',d).saldo,0,'el saldo nunca queda negativo');
 const tres={a:{cometa:{at:1,p:5000},olas:{at:2,p:5000},holo:{at:3,p:5000}}};
 const e=T.economia(conTienda(tres)).usuarios.a;
 assert.ok(e.tienda.cometa&&e.tienda.olas&&!e.tienda.holo,'la tercera no cabe');
});

test('lo comprado desbloquea; lo no comprado cae al anillo',()=>{
 const d=conTienda({a:{cometa:{at:10,p:5000}}});
 d.compras={a:T.economia(d).usuarios.a.tienda};
 const est=T.estadisticas('a',d);
 assert.ok(T.requisito(T.MARCOS.find(m=>m.id==='cometa'),est).ok);
 const r=T.requisito(T.MARCOS.find(m=>m.id==='plasma'),est);
 assert.ok(!r.ok);assert.ok(r.tienda);
 assert.equal(T.marcoVisible({marco:'cometa'},est),'cometa');
 assert.equal(T.marcoVisible({marco:'plasma'},est),'anillo');
 assert.equal(T.marcoVisible({marco:'plasma'},Object.assign({},est,{parcial:true})),'plasma','sin la lectura entera se confía');
});

test('un n.º 1 cuenta solo contra alguien',()=>{
 const d={ranks:{uno:{a:{puntos:9},b:{puntos:3}},cacho:{a:{puntos:5}},reversi:{a:{puntos:0},b:{puntos:0}}},
  solo:{'club-snake-classic-easy':{a:{puntos:40,tiempo:5},b:{puntos:20,tiempo:5}},'club-minas-hard':{b:{puntos:1,tiempo:9}},
        'yemas-zombis-nacht':{b:{puntos:7,tiempo:1},a:{puntos:3,tiempo:1}},'club-tetris-sprint':{a:{puntos:40,tiempo:9},b:{puntos:40,tiempo:12}}},
  lideres:{monedas:'b',prodrop:'a'}};
 const c=T.campeones(d),a=[...(c.get('a')||[])].sort(),b=[...(c.get('b')||[])].sort();
 assert.deepEqual(a,['prodrop','snake','tetris','uno']);
 assert.deepEqual(b,['monedas','zombis']);
 const est=T.estadisticas('b',d);
 assert.ok(T.requisito(T.MARCOS.find(m=>m.id==='tzombis'),est).ok);
 assert.ok(!T.requisito(T.MARCOS.find(m=>m.id==='tyemas'),est).ok,'zombis no es Yemas');
 assert.equal(T.marcoVisible({marco:'tsnake'},est),'anillo');
 assert.equal(T.marcoVisible({marco:'tsnake'},T.estadisticas('a',d)),'tsnake');
});

test('un marco de campeón por juego, y uno para zombis, monedas y PRODROP',()=>{
 const tops=T.MARCOS.filter(m=>m.req&&m.req.top).map(m=>m.req.top);
 assert.equal(new Set(tops).size,tops.length,'un solo marco por top');
 for(const j of Object.keys(T.JUEGOS))assert.ok(tops.includes(j),'falta el marco de '+j);
 for(const j of Object.keys(T.SOLO_PREFIJO))assert.ok(tops.includes(T.topDeCategoria(T.SOLO_PREFIJO[j]+'x')),'falta el marco de '+j);
 for(const k of ['zombis','monedas','prodrop'])assert.ok(tops.includes(k),k);
});

test('cada marco animado tiene su dibujo',()=>{
 for(const m of T.MARCOS.filter(m=>m.anim)){
  assert.ok(T.tieneAdorno(m.id),'falta el dibujo de '+m.id);
  const s=T.adorno(m.id);
  assert.match(s,/^<b class="jg-av-ad" aria-hidden="true"><svg viewBox="0 0 140 140"/);
  assert.ok(!/undefined|NaN/.test(s),m.id);
 }
 for(const id of T.MARCOS_ANIMADOS)assert.ok(T.MARCOS.some(m=>m.id===id&&m.anim),'dibujo sin marco: '+id);
});

test('un corte anula lo que no se pudo pagar sin parar la cuenta, y lo ganado después es suyo',()=>{
 const tres={a:{cometa:{at:1,p:5000},olas:{at:2,p:5000},holo:{at:3,p:5000}}};
 const g=T.monedasDe('a',conTienda(tres)).total;
 assert.ok(T.economia(conTienda(tres)).usuarios.a.parada,'sin corte la tercera la para');
 const corte={a:{hasta:5,tope:g}};
 let d=Object.assign(conTienda(tres),{cortes:corte}),e=T.economia(d).usuarios.a;
 assert.ok(!e.parada,'con corte no queda parada');assert.ok(!e.tienda.holo,'la que no cabía no vale');
 assert.equal(T.monedasDe('a',d).saldo,g-10000);
 /* Gana mucho más después: la tercera sigue anulada (se midió contra el
    tope), y una compra posterior al corte se paga con lo nuevo. */
 const masRico={solo:{'club-bbtan-rondas':{a:{nombre:'Ana',puntos:900,tiempo:1}}}};
 const cuatro=Object.assign({},tres.a,{fuegos:{at:10,p:5000}});
 d=Object.assign(conTienda({a:cuatro},masRico),{cortes:corte});e=T.economia(d).usuarios.a;
 assert.ok(!e.tienda.holo,'lo ganado después no revive lo anulado');assert.ok(e.tienda.fuegos);assert.ok(!e.parada);
 assert.equal(T.monedasDe('a',d).saldo,T.monedasDe('a',d).total-15000);
 /* Si después se borran más récords y gana menos que el tope, se mide contra eso. */
 d=Object.assign(conTienda(tres,{solo:{'club-bbtan-rondas':{a:{nombre:'Ana',puntos:200,tiempo:1}}}}),{cortes:corte});
 const g2=T.monedasDe('a',d).total;assert.ok(g2<g);
 e=T.economia(d).usuarios.a;assert.ok(!e.parada);
 assert.equal(Object.keys(e.tienda).length,Math.min(3,Math.floor(g2/5000)),'con menos ganado cabe menos');
 assert.ok(T.monedasDe('a',d).saldo>=0);
});
