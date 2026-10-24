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
const T=Object.assign(carga(['motor','logros','tienda','cortes','referidos','monedas'],'TIENDA,PRECIO_TIENDA,HALLOWEEN,RAREZAS_HW,VENTA_HALLOWEEN,PREMIOS_HALLOWEEN,precioDe,aLaVenta,edicion,edicionesDe,economia,monedasDe'),
 carga(['motor','logros','tienda','perfil-tarjeta'],'MARCOS,FONDOS,estadisticas,requisito,marcoVisible,fondoVisible,campeones,topDeCategoria,SOLO_PREFIJO,JUEGOS'),
 carga(['marcos-animados'],'MARCOS_ANIMADOS,adorno,tieneAdorno'),
 carga(['fondos-halloween'],'ESCENAS_HW'));

/* BBTAN hasta la ronda 300: unas once mil monedas. */
const rico={solo:{'club-bbtan-rondas':{a:{nombre:'Ana',puntos:300,tiempo:1}}}};
const conTienda=(t,base=rico)=>Object.assign({},base,{tienda:t});

test('la tienda: diez artículos de siempre a 5000, y los de Halloween a su rareza',()=>{
 assert.equal(T.PRECIO_TIENDA,5000);
 const siempre=Object.entries(T.TIENDA).filter(([id])=>!T.HALLOWEEN[id]).map(([,t])=>t);
 assert.equal(siempre.filter(x=>x==='marco').length,5);assert.equal(siempre.filter(x=>x==='fondo').length,5);
 for(const [id,rz] of Object.entries(T.HALLOWEEN)){
  assert.ok(T.TIENDA[id],id+' está en la tienda');assert.ok(T.RAREZAS_HW[rz],id+': rareza '+rz);
  assert.equal(T.precioDe(id),T.RAREZAS_HW[rz].p);
 }
 assert.equal(T.precioDe('cometa'),5000);
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

test('con «desde», lo comprado antes vale entero y el saldo queda en cero, no negativo',()=>{
 const tres={a:{cometa:{at:1,p:5000},olas:{at:2,p:5000},holo:{at:3,p:5000},fuegos:{at:6,p:5000}}};
 const g=T.monedasDe('a',conTienda(tres)).total;
 const d=Object.assign(conTienda(tres),{cortes:{a:{desde:4,hasta:8,tope:g}}}),e=T.economia(d).usuarios.a;
 assert.ok(e.tienda.cometa&&e.tienda.olas&&e.tienda.holo,'antes de «desde» todo vale');
 assert.ok(!e.tienda.fuegos,'entre «desde» y «hasta» lo que no alcanza se anula');assert.ok(!e.parada);
 assert.equal(T.monedasDe('a',d).saldo,0,'lo que no alcanzaba se perdona: el saldo queda en cero');
});

/* ---------- La tienda de Halloween ---------- */
const V=T.VENTA_HALLOWEEN, EN=V.desde+3600e3;
const ricoHw={solo:{'club-bbtan-rondas':{a:{nombre:'Ana',puntos:600,tiempo:1}}}};   // ~ 43 000 monedas

test('Halloween: se cobra a su precio y solo mientras se vende',()=>{
 const g=T.monedasDe('a',ricoHw).saldo;
 assert.ok(g>=10000,'BBTAN 600 da para la Parca: '+g);
 let d=conTienda({a:{parca:{at:EN,p:10000}}},ricoHw);
 assert.equal(T.monedasDe('a',d).saldo,g-10000);
 assert.ok(T.economia(d).usuarios.a.tienda.parca);
 d=conTienda({a:{parca:{at:EN,p:5000}}},ricoHw);
 assert.equal(T.monedasDe('a',d).saldo,g,'al precio de la tienda de siempre no vale');
 d=conTienda({a:{parca:{at:V.hasta,p:10000}}},ricoHw);
 assert.equal(T.monedasDe('a',d).saldo,g,'después del cierre no vale');
 assert.ok(!(T.economia(d).usuarios.a||{tienda:{}}).tienda.parca);
 d=conTienda({a:{parca:{at:V.desde-1,p:10000}}},ricoHw);
 assert.equal(T.monedasDe('a',d).saldo,g,'antes de abrir tampoco');
 assert.ok(T.aLaVenta('cometa',V.hasta+1e9),'lo de siempre no cierra');
 assert.ok(!T.aLaVenta('inventado',EN));
});

test('Halloween: lo no comprado desaparece al cerrar; lo comprado queda',()=>{
 const est=T.estadisticas('a',{compras:{a:{calabazas:{p:3000}}}});
 const cal=T.MARCOS.find(m=>m.id==='calabazas'),parca=T.MARCOS.find(m=>m.id==='parca');
 let r=T.requisito(parca,est,EN);
 assert.ok(!r.ok&&r.tienda&&r.precio===10000&&!r.agotado,'a la venta, con su precio');
 r=T.requisito(parca,est,V.hasta);
 assert.ok(!r.ok&&r.agotado&&!r.tienda,'cerrada: agotado, no se compra');
 assert.ok(T.requisito(cal,est,V.hasta+1e9).ok,'lo comprado es para siempre');
 assert.equal(T.marcoVisible({marco:'calabazas'},est),'calabazas');
});

test('Halloween: los premios de coleccionista salen de lo comprado',()=>{
 const rey=T.MARCOS.find(m=>m.id==='reycalabaza'),noche=T.FONDOS.find(f=>f.id==='nocheeterna');
 assert.equal(rey.req.coleccion,5);assert.equal(noche.req.coleccion,Object.keys(T.HALLOWEEN).length);
 for(const p of T.PREMIOS_HALLOWEEN){
  const l=p.tipo==='marco'?T.MARCOS:T.FONDOS,x=l.find(i=>i.id===p.id);
  assert.ok(x&&x.req.coleccion===p.n&&!T.TIENDA[p.id],p.id+' se gana, no se vende');
 }
 const ids=Object.keys(T.HALLOWEEN),con=n=>T.estadisticas('a',{compras:{a:Object.fromEntries(ids.slice(0,n).map(id=>[id,{p:1}]))}});
 assert.ok(!T.requisito(rey,con(4),EN).ok);assert.ok(T.requisito(rey,con(5),EN).ok);
 assert.ok(T.requisito(rey,con(5),V.hasta+1e9).ok,'ganado, para siempre');
 assert.ok(T.requisito(rey,con(4),V.hasta).agotado,'sin ganar, al cerrar desaparece');
 assert.ok(!T.requisito(noche,con(10),EN).ok);assert.ok(T.requisito(noche,con(11),EN).ok);
 /* Lo de siempre no cuenta para la colección. */
 assert.ok(!T.requisito(rey,T.estadisticas('a',{compras:{a:{cometa:{p:1},vortice:{p:1},sakura:{p:1},plasma:{p:1},mariposas:{p:1}}}}),EN).ok);
});

test('Halloween: cada fondo tiene su escena y cada id cabe en la regla del perfil',()=>{
 for(const f of T.FONDOS.filter(f=>f.hw)){
  assert.ok(f.anim,f.id+' es animado');assert.ok(T.ESCENAS_HW[f.id],'falta la escena de '+f.id);
  assert.ok(!/undefined|NaN/.test(T.ESCENAS_HW[f.id]),f.id);
 }
 for(const id of Object.keys(T.ESCENAS_HW))assert.ok(T.FONDOS.some(f=>f.id===id&&f.hw),'escena sin fondo: '+id);
 /* users/$uid/perfil/marco y /fondo: ^[a-z]{1,20}$ */
 for(const x of [...T.MARCOS,...T.FONDOS].filter(x=>x.hw))assert.match(x.id,/^[a-z]{1,20}$/,x.id);
});

test('Halloween: la regla de `tienda` dice los mismos precios y la misma hora de cierre',()=>{
 const reglas=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','firebase','database.rules.json'),'utf8'));
 const v=reglas.rules.tienda.$uid.$item['.validate'];
 assert.ok(v.includes('now >= '+V.desde+' && now < '+V.hasta),'la ventana de la regla es VENTA_HALLOWEEN');
 const grupos=[...v.matchAll(/\$item\.matches\(\/\^\(([a-z|]+)\)\$\/\) && newData\.child\('p'\)\.val\(\) === (\d+)/g)].map(m=>[m[1].split('|'),+m[2]]);
 const deRegla={};
 for(const [ids,p] of grupos)for(const id of ids)deRegla[id]=p;
 for(const id of Object.keys(T.TIENDA))assert.equal(deRegla[id],T.precioDe(id),'precio de '+id+' en la regla');
 assert.equal(Object.keys(deRegla).length,Object.keys(T.TIENDA).length,'la regla no vende nada más');
});

test('Halloween: el número de edición es el orden de compra, y cuántos lo tienen',()=>{
 const ed=(...a)=>({...T.edicion(...a)});
 const c={b:{parca:EN+20},a:{parca:EN+10,calabazas:{at:EN+50,p:3000}},c:{parca:{p:10000}},d:{calabazas:EN+1}};
 assert.deepEqual(ed('parca','a',c),{n:1,total:3});
 assert.deepEqual(ed('parca','b',c),{n:2,total:3});
 assert.deepEqual(ed('parca','c',c),{n:3,total:3},'sin hora (recién comprada aquí) va al final');
 assert.deepEqual(ed('parca','nadie',c),{n:0,total:3});
 assert.deepEqual(ed('calabazas','a',c),{n:2,total:2},'acepta {at,p} del nodo tal cual');
 /* Empate de hora: por uid, para que todos vean el mismo número. */
 assert.deepEqual(ed('olas','y',{y:{olas:5},x:{olas:5}}),{n:2,total:2});
 /* El premio se numera por la hora de la quinta compra. */
 const ids=Object.keys(T.HALLOWEEN).slice(0,5),cinco=(u,t0)=>Object.fromEntries(ids.map((id,i)=>[id,t0+i]));
 const p={a:cinco('a',EN+100),b:cinco('b',EN),z:{parca:EN}};
 assert.deepEqual(ed('reycalabaza','a',p),{n:2,total:2});
 const e=T.edicionesDe('b',p);
 assert.deepEqual({...e.reycalabaza},{n:1,total:2});assert.equal(e[ids[0]].n,1);assert.ok(!e.nocheeterna);
});
