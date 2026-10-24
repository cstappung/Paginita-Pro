/* Los tacos de Pool y sus cofres: el sorteo (src/juegos/tacos.js) y el
   cobro en la economía (src/juegos/monedas.js). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const PM=require('../../juegos/prodrop/motor.js');
const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const carga=(fs_,exp)=>{const c={__PM:PM};vm.createContext(c);vm.runInContext('const PM=__PM;'+fs_.map(f=>sin('src/juegos/'+f+'.js')).join('\n')+';globalThis.__T={'+exp+'}',c);return c.__T;};
const T=carga(['motor','logros','tienda','tacos','cortes','referidos','monedas'],'RAREZAS,TACOS,IDS_PREMIO,IDS_TACOS,PRECIO_COFRE,abreCofre,reembolsoDe,esTaco,economia,monedasDe');

const rico={solo:{'club-bbtan-rondas':{a:{nombre:'Ana',puntos:300,tiempo:1}}}};
const conCofres=(c,base=rico)=>Object.assign({},base,{cofres:c});

test('las probabilidades suman 100 % y cada rareza tiene tacos',()=>{
 assert.equal(T.RAREZAS.reduce((a,r)=>a+r.mil,0),1000);
 for(const r of T.RAREZAS)assert.ok(T.IDS_PREMIO.some(k=>T.TACOS[k].rareza===r.id),'sin tacos '+r.id);
 // lo más raro es lo más improbable y lo que más devuelve
 for(let i=1;i<T.RAREZAS.length;i++){assert.ok(T.RAREZAS[i].mil<T.RAREZAS[i-1].mil);assert.ok(T.RAREZAS[i].reembolso>T.RAREZAS[i-1].reembolso)}
 assert.ok(T.IDS_TACOS.length>=10);
 assert.ok(T.TACOS.escuela.regalo&&!T.IDS_PREMIO.includes('escuela'));
});

test('el sorteo es determinista y respeta las probabilidades',()=>{
 assert.equal(T.abreCofre('ana','clave12345',1700000000000),T.abreCofre('ana','clave12345',1700000000000));
 const n=60000,c={};
 for(let i=0;i<n;i++){const id=T.abreCofre('u'+(i%40),'k'+i,1.7e12+i*13);assert.ok(T.TACOS[id]&&!T.TACOS[id].regalo);const r=T.TACOS[id].rareza;c[r]=(c[r]||0)+1}
 for(const r of T.RAREZAS){const f=(c[r.id]||0)/n*1000;assert.ok(Math.abs(f-r.mil)<Math.max(4,r.mil*.25),r.id+' salió '+f+' y debía ser '+r.mil)}
});

test('un cofre cobra una vez al precio y solo con saldo',()=>{
 const g=T.monedasDe('a',rico).saldo;
 let d=conCofres({a:{abcdefgh12:{at:10,p:T.PRECIO_COFRE}}});
 const premio=T.abreCofre('a','abcdefgh12',10);
 const dev=0; // el primero nunca es repetido
 assert.equal(T.monedasDe('a',d).saldo,g-T.PRECIO_COFRE+dev);
 assert.ok(T.economia(d).usuarios.a.tacos[premio]);
 d=conCofres({a:{abcdefgh12:{at:10,p:50}}});
 assert.equal(T.monedasDe('a',d).saldo,g,'precio equivocado: no cuenta');
 d=conCofres({a:{corta:{at:10,p:T.PRECIO_COFRE}}});
 assert.equal(T.monedasDe('a',d).saldo,g,'clave inválida');
 d=conCofres({pobre:{abcdefgh12:{at:10,p:T.PRECIO_COFRE}}},{});
 assert.ok(T.monedasDe('pobre',d).parada,'sin saldo, la cuenta queda parada');
 assert.ok(!Object.keys((T.economia(d).usuarios.pobre||{tacos:{}}).tacos).length);
});

test('un taco repetido devuelve monedas por su rareza',()=>{
 // se busca una clave que repita el premio de la primera
 const u='a',at1=10,k1='primera123',p1=T.abreCofre(u,k1,at1);
 let k2=null,at2=20;
 for(let i=0;i<5000&&!k2;i++){const k='segunda'+String(i).padStart(4,'0');if(T.abreCofre(u,k,at2)===p1)k2=k}
 assert.ok(k2,'debe haber una clave que repita');
 const g=T.monedasDe('a',rico).saldo;
 const d=conCofres({a:{[k1]:{at:at1,p:T.PRECIO_COFRE},[k2]:{at:at2,p:T.PRECIO_COFRE}}});
 assert.equal(T.monedasDe('a',d).saldo,g-2*T.PRECIO_COFRE+T.reembolsoDe(p1));
 const x=T.economia(d).usuarios.a;
 assert.equal(x.cofres.length,2);assert.equal(x.cofres[1].dup,true);assert.equal(Object.keys(x.tacos).length,1);
});
