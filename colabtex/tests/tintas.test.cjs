/* El color del nombre (src/juegos/tintas.js): qué desbloquea cada
   cantidad de referidos, el re-chequeo donde se ve y la hoja que pinta. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={};vm.createContext(ctx);
vm.runInContext(sin('src/juegos/tintas.js')+';globalThis.__T={TINTAS,EFECTOS,tintaDe,tintaVisible,siguienteTinta,nombreHtml,cssTintas}',ctx);
const T=ctx.__T;
const copia=x=>JSON.parse(JSON.stringify(x));

test('1, 3, 5 y 10 referidos: rojo, verde claro, azul y dorado, cada uno con su efecto',()=>{
 assert.deepEqual(copia(T.TINTAS.map(t=>[t.id,t.n])),[['rojo',1],['verde',3],['azul',5],['dorado',10]]);
 for(const t of T.TINTAS){assert.ok(t.efecto,'sin efecto: '+t.id);assert.match(T.EFECTOS[t.id].d,/animation:/,t.id+' no se mueve');}
 assert.equal(T.siguienteTinta(0).id,'rojo');
 assert.equal(T.siguienteTinta(4).id,'azul');
 assert.equal(T.siguienteTinta(10),null);
});

test('los efectos van de menos a más',()=>{
 const capas=id=>{const e=T.EFECTOS[id];return (e.d.match(/animation:[^;]*/)[0].split(',').length)+(/background-clip:text/.test(e.d)?1:0)+(e.antes?1:0)+(e.despues?1:0);};
 const n=T.TINTAS.map(t=>capas(t.id));
 for(let i=1;i<n.length;i++)assert.ok(n[i]>n[i-1],`${T.TINTAS[i].id} (${n[i]}) no suma sobre ${T.TINTAS[i-1].id} (${n[i-1]})`);
 assert.ok(T.EFECTOS.dorado.antes&&T.EFECTOS.dorado.despues,'el dorado lleva dos chispas');
 assert.match(T.EFECTOS.dorado.antes,/-webkit-text-fill-color:var/,'la chispa no hereda el relleno transparente del reflejo');
});

test('se ve solo si los referidos alcanzan (y se confía mientras no se sabe)',()=>{
 assert.equal(T.tintaVisible('rojo',1),'rojo');
 assert.equal(T.tintaVisible('rojo',0),'','puesto a mano sin referidos: nombre normal');
 assert.equal(T.tintaVisible('dorado',9),'');
 assert.equal(T.tintaVisible('dorado',10),'dorado');
 assert.equal(T.tintaVisible('dorado',null),'dorado','lecturas a medias: lo guardado');
 assert.equal(T.tintaVisible('fucsia',99),'');
 assert.equal(T.tintaVisible('',99),'');
});

test('el nombre va marcado con su uid; un uid raro no',()=>{
 assert.equal(T.nombreHtml('abc123','Pía'),'<span class="jg-nm" data-nm="abc123">Pía</span>');
 assert.equal(T.nombreHtml('a"b','Pía'),'Pía');
 assert.equal(T.nombreHtml('','Pía'),'Pía');
 assert.equal(T.nombreHtml('abc','Pía','rojo'),'<span class="jg-nm jg-tn-rojo" data-nm="abc">Pía</span>','la vista previa fija el color');
 assert.equal(T.nombreHtml('','Pía','normal'),'<span class="jg-nm jg-tn-normal">Pía</span>');
 assert.equal(T.nombreHtml('abc','Pía','fucsia'),'<span class="jg-nm" data-nm="abc">Pía</span>');
});

test('la hoja: una regla por color con sus uid, y la vista previa detrás',()=>{
 const vacia=T.cssTintas({});
 assert.doesNotMatch(vacia,/data-nm/,'sin nadie, solo la vista previa');
 for(const t of T.TINTAS)assert.match(vacia,new RegExp(`html \\.jg-nm\\.jg-tn-${t.id}\\{`));
 const css=T.cssTintas({a1:'rojo',b2:'rojo',c3:'dorado',d4:'',e5:'fucsia','x"}body{':'rojo'});
 assert.match(css,/:is\(\.jg-nm\[data-nm="a1"\],\.jg-nm\[data-nm="b2"\]\)\{color:var\(--tn-rojo\)/);
 assert.match(css,/data-nm="c3"\]\)\{color:var\(--tn-dorado\)[^}]*jgTnAura/);
 assert.match(css,/data-nm="c3"\]\)::before\{/);assert.match(css,/data-nm="c3"\]\)::after\{/);
 assert.doesNotMatch(css,/d4|e5|body/,'sin color, color inventado o uid raro: nada');
 assert.ok(css.indexOf('data-nm')<css.indexOf('html .jg-nm.jg-tn-'),'la vista previa va detrás y manda');
});

test('cada variable y animación que usan los efectos está en juegos.html',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','..','juegos.html'),'utf8');
 const usadas=new Set();
 for(const e of Object.values(T.EFECTOS))for(const x of [e.d,e.antes||'',e.despues||''].join(';').matchAll(/var\((--tn-[a-z0-9-]+)\)/g))usadas.add(x[1]);
 for(const v of usadas)assert.match(html,new RegExp(v+':'),'falta '+v);
 for(const e of Object.values(T.EFECTOS))for(const x of [e.d,e.antes||'',e.despues||''].join(';').matchAll(/(jgTn[A-Za-z]+)/g))assert.match(html,new RegExp('@keyframes '+x[1]),'falta @keyframes '+x[1]);
});
