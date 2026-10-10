const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const sin=f=>fs.readFileSync(f,'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const context={crypto:require('node:crypto').webcrypto,TextEncoder};vm.createContext(context);
vm.runInContext(sin('src/juegos/motor.js')+'\n'+sin('src/juegos/logros.js')+'\n'+sin('src/juegos/tienda.js')+'\n'+sin('src/juegos/perfil-tarjeta.js')+
 '\n;globalThis.__P={MARCOS,FONDOS,estadisticas,requisito,marcoVisible,fondoVisible,opcionesVitrina,vitrinaDe,limpiaPerfil,nombreCategoria,valorMarca,oscurece,MAX_VITRINA,LOGROS};',context);
const P=context.__P;

const datos={
 ranks:{cacho:{a:{nombre:'Ana',puntos:30,ganadas:10,jugadas:12,mejorRacha:3},b:{nombre:'Beto',puntos:12,ganadas:4,jugadas:10},c:{nombre:'Cata',puntos:3,ganadas:1,jugadas:5}},
        uno:{a:{nombre:'Ana',puntos:3,ganadas:1,jugadas:4},b:{nombre:'Beto',puntos:9,ganadas:3,jugadas:3}}},
 solo:{'club-minas-hard':{a:{nombre:'Ana',puntos:1,tiempo:95000},c:{nombre:'Cata',puntos:1,tiempo:80000}},
       'club-bbtan-rondas':{b:{nombre:'Beto',puntos:120,tiempo:1}}},
 logros:{cacho:{a:{calzo:1}}}
};

test('las estadísticas salen de las tres lecturas',()=>{
 const e=P.estadisticas('a',datos);
 assert.equal(e.nombre,'Ana');
 assert.equal(e.partidas,16);assert.equal(e.victorias,11);
 const cacho=e.tablas.find(t=>t.clave==='r:cacho');
 assert.equal(cacho.puesto,1);assert.equal(cacho.de,3);
 assert.equal(e.tablas.find(t=>t.clave==='r:uno').puesto,2);
 const minas=e.tablas.find(t=>t.clave==='s:club-minas-hard');
 assert.equal(minas.puesto,2);assert.equal(minas.valor,'95.00 s');
 assert.equal(e.primeros,1,'n.º 1 en una tabla de tres');
 assert.equal(e.podios,1,'las tablas de dos no cuentan como podio');
 assert.ok(e.nLogros>=4,'primera, diez, racha y el de la sala');
 assert.equal(e.mejorPuesto,1);
 const nadie=P.estadisticas('zz',datos);
 assert.equal(nadie.tablas.length,0);assert.equal(nadie.nLogros,0);assert.equal(nadie.mejorPuesto,0);
});

test('los marcos que se ganan piden lo que dicen',()=>{
 const a=P.estadisticas('a',datos),c=P.estadisticas('c',datos);
 const m=id=>P.MARCOS.find(x=>x.id===id);
 assert.ok(P.requisito(m('corona'),a).ok);
 assert.ok(!P.requisito(m('corona'),c).ok);
 assert.match(P.requisito(m('galaxia'),c).falta,/30 logros/);
 assert.ok(!P.requisito(m('fuego'),null).ok,'sin datos, cerrado');
 assert.ok(P.requisito(m('anillo'),null).ok,'lo libre, siempre');
 assert.equal(P.marcoVisible({marco:'corona'},c),'anillo','un marco que no se ganó no se ve');
 assert.equal(P.marcoVisible({marco:'corona'},a),'corona');
 assert.equal(P.marcoVisible({marco:'corona'},null),'corona','sin estadísticas se confía');
 assert.equal(P.marcoVisible({marco:'inventado'},a),'anillo');
 assert.equal(P.fondoVisible({fondo:'oro'},P.estadisticas('zz',datos)).id,'color');
 assert.equal(P.fondoVisible({fondo:'oro'},c).id,'oro','tercera de tres es podio');
 for(const f of P.FONDOS){const css=f.css('#2563eb');assert.ok(css&&!/undefined/.test(css),f.id);}
 assert.equal(new Set(P.MARCOS.map(x=>x.id)).size,P.MARCOS.length);
 assert.equal(new Set(P.FONDOS.map(x=>x.id)).size,P.FONDOS.length);
});

test('la vitrina: lo elegido que existe, o lo mejor si no eligió',()=>{
 const e=P.estadisticas('a',datos);
 const ops=P.opcionesVitrina(e);
 assert.ok(ops.some(o=>o.clave==='r:cacho')&&ops.some(o=>o.clave==='l:cacho:calzo'));
 const auto=P.vitrinaDe({},e);
 assert.equal(auto[0].clave,'r:cacho','primero su mejor puesto');
 assert.ok(auto.length<=P.MAX_VITRINA);
 const elegida=P.vitrinaDe({vitrina:['l:cacho:calzo','r:nada','s:club-minas-hard']},e);
 assert.deepEqual([...elegida.map(o=>o.clave)],['l:cacho:calzo','s:club-minas-hard'],'lo que ya no existe se cae');
 assert.deepEqual([...P.vitrinaDe({vitrina:{0:'r:uno'}},e).map(o=>o.clave)],['r:uno'],'la base devuelve un objeto');
 assert.equal(P.vitrinaDe({},P.estadisticas('zz',datos)).length,0);
});

test('lo que se guarda va limpio',()=>{
 const l=P.limpiaPerfil({marco:'fuego',fondo:'nope',bio:'  hola \n  mundo '+'x'.repeat(300),vitrina:['r:cacho','r:cacho','<script>','l:uno:primera','s:club-minas-hard','r:a','r:b','r:c','r:d']});
 assert.equal(l.marco,'fuego');assert.equal(l.fondo,undefined);
 assert.ok(l.bio.startsWith('hola mundo'));assert.equal(l.bio.length,120);
 assert.deepEqual([...l.vitrina],['r:cacho','l:uno:primera','s:club-minas-hard','r:a','r:b','r:c']);
 assert.equal(P.nombreCategoria('club-snake-classic-grande'),'Snake Club · Clásico, mapa grande');
 assert.equal(P.valorMarca('club-bbtan-rondas',{puntos:312}),'ronda 312');
 assert.equal(P.oscurece('#ffffff',.5),'#808080');assert.equal(P.oscurece('rojo',.5),'#1e293b');
});

test('la mascota del perfil: limpiaPerfil solo deja una copia ma: y un baile válido',()=>{
 const M='ma:abcdef123~-Nadop00001';
 assert.deepEqual({...P.limpiaPerfil({mascota:{m:M,b:'start-dance-salsa'}}).mascota},{m:M,b:'start-dance-salsa'});
 assert.deepEqual({...P.limpiaPerfil({mascota:{m:M,b:'ob:abcdef123~-Nrega00001'}}).mascota},{m:M,b:'ob:abcdef123~-Nrega00001'});
 assert.deepEqual({...P.limpiaPerfil({mascota:{m:M,b:'<script>'}}).mascota},{m:M},'un baile raro se cae, la mascota no');
 assert.equal(P.limpiaPerfil({mascota:{m:'abcdef123~p-Npack0001.0'}}).mascota,undefined,'una carta no es una mascota');
 assert.equal(P.limpiaPerfil({mascota:null}).mascota,undefined);
});

/* El re-chequeo al pintar (mascotas-datos.js, con la economía): se compila
   con esbuild porque importa el catálogo .ts de Mascotas. */
const esbuild=require('esbuild'),path=require('node:path');
const rb=esbuild.buildSync({stdin:{contents:`export { mascotaVisible, opcionesMascotaPerfil } from './juegos/mascotas-datos.js';`,resolveDir:path.join(__dirname,'..','src'),loader:'js'},
 bundle:true,write:false,format:'cjs',platform:'node',target:'node20',logLevel:'silent'});
const MD={exports:{}};new Function('module','exports','require',rb.outputFiles[0].text)(MD,MD.exports,require);

test('la mascota del perfil se re-chequea: dueño, a la venta y baile',()=>{
 const T=1791700000000,A='duenia001',B='otraaa001';
 const d={ranks:{},solo:{},logros:{},diario:{},cartas:{s:{}},mercado:{o:{},t:{}},clubJugadas:{},podios:{},tienda:{},completo:true,
  ajustes:{[B]:{a:{n:9000,m:'x',por:'admin',at:T-1}}},
  mascotas:{a:{[A]:{'-Nadop00001':{at:T,e:'cat',p:0}}},r:{[A]:{}},c:{}}};
 const c=`ma:${A}~-Nadop00001`;
 const v=MD.exports.mascotaVisible(A,{mascota:{m:c,b:'start-dance-salsa'}},d);
 assert.equal(v.c,c);assert.equal(v.baile,'salsa');assert.equal(v.m.e,'cat');
 assert.equal(MD.exports.mascotaVisible(B,{mascota:{m:c}},d),null,'una mascota ajena no sale');
 assert.equal(MD.exports.mascotaVisible(A,{mascota:{m:c,b:`ob:${A}~-Nnoexiste1`}},d).baile,null,'un baile que no tiene no baila');
 const op=MD.exports.opcionesMascotaPerfil(A,d);
 assert.deepEqual(op.mascotas.map(x=>x.c),[c]);
 assert.ok(op.bailes.some(x=>x.b==='start-dance-salsa'),'los bailes iniciales los tiene todo el mundo');
 /* La economía se recuerda por lectura: cada cambio es una lectura nueva. */
 const d2=structuredClone(d);d2.mercado.o['-Nof0000001']={u:A,c,p:300,at:T+5};
 assert.equal(MD.exports.mascotaVisible(A,{mascota:{m:c}},d2),null,'a la venta no sale');
 assert.equal(MD.exports.opcionesMascotaPerfil(A,d2).mascotas.length,0);
 const d3=structuredClone(d2);d3.mercado.o['-Nof0000001'].v={u:B,at:T+6};
 assert.equal(MD.exports.mascotaVisible(A,{mascota:{m:c}},d3),null,'vendida, tampoco');
 assert.equal(MD.exports.mascotaVisible(B,{mascota:{m:c}},d3).c,c,'y sale en el perfil de quien la compró');
});
