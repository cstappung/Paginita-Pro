/* Monedas: el cálculo (src/juegos/monedas.js) y su tabla de niveles. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={};vm.createContext(ctx);
vm.runInContext(sin('src/juegos/motor.js')+'\n'+sin('src/juegos/logros.js')+'\n'+sin('src/juegos/monedas.js')+
 ';globalThis.__M={JUEGOS,LOGROS,NIVEL,PESO,VALOR_NIVEL,TARIFA,RECORD,monedasDe,topMonedas,registraDia,rachaHoy,pagoDia,diaChile,valorLogro,nivelDe}',ctx);
const M=ctx.__M;

test('cada logro tiene su nivel, y cada juego de sala su peso',()=>{
 for(const [j,l] of Object.entries(M.LOGROS)){
  assert.ok(M.NIVEL[j],'falta NIVEL de '+j);
  assert.equal(M.NIVEL[j].length,l.length,j);
  assert.match(M.NIVEL[j],/^[1-4]+$/,j);
 }
 for(const j of Object.keys(M.JUEGOS))assert.ok(M.PESO[j]>=1,'falta PESO de '+j);
 assert.deepEqual([...M.VALOR_NIVEL],[0,15,40,100,250]);
 assert.equal(M.valorLogro('bbtan','r500'),250);
 assert.equal(M.valorLogro('orbita','primera'),15);
 assert.equal(M.nivelDe('orbita','no-existe'),0);
});

test('la racha de días: paga 10 y sube 5 por día hasta 50',()=>{
 assert.deepEqual([1,2,3,9,10,40].map(M.pagoDia),[10,15,20,50,50,50]);
 let r=M.registraDia(null,100);assert.deepEqual({...r},{dia:100,racha:1,mejor:1,dias:1,bono:10});
 assert.equal(M.registraDia(r,100),null,'el mismo día no cuenta dos veces');
 assert.equal(M.registraDia(r,99),null);
 for(let d=101;d<=110;d++)r=M.registraDia(r,d);
 assert.equal(r.racha,11);assert.equal(r.dias,11);
 assert.equal(r.bono,10+15+20+25+30+35+40+45+50+50+50);
 r=M.registraDia(r,113);assert.equal(r.racha,1);assert.equal(r.mejor,11);assert.equal(r.dias,12);
 assert.equal(M.rachaHoy(r,113),1);assert.equal(M.rachaHoy(r,114),1);assert.equal(M.rachaHoy(r,115),0);
});

test('el día es el de Chile',()=>{
 const d=M.diaChile(Date.parse('2026-10-01T02:30:00Z'));
 assert.equal(d,Math.round(Date.UTC(2026,8,30)/864e5),'a las 23:30 de Santiago aún es 30 de septiembre');
 assert.equal(M.diaChile(Date.parse('2026-10-01T12:00:00Z')),d+1);
});

const datos={
 ranks:{uno:{a:{nombre:'Ana',jugadas:10,ganadas:3,empates:1,mejorRacha:2},b:{nombre:'Beto',jugadas:1,ganadas:0}},
        catan:{a:{nombre:'Ana',jugadas:2,ganadas:1}}},
 solo:{'club-minas-easy':{a:{nombre:'Ana',puntos:1,tiempo:9000}},'club-bbtan-rondas':{c:{nombre:'Caro',puntos:120,tiempo:5}},
       'club-sopa-racha':{c:{nombre:'Caro',puntos:4,tiempo:60000}}},
 logros:{uno:{a:{pilla:1}}},
 diario:{a:{dia:5,racha:2,mejor:2,dias:2,bono:25},d:{dia:5,racha:1,mejor:1,dias:1,bono:10}}
};

test('el saldo suma partidas, victorias, récords, logros y días',()=>{
 const a=M.monedasDe('a',datos);
 assert.equal(a.partes.partidas,Math.round(5*1.3*10+5*2.5*2));
 assert.equal(a.partes.victorias,Math.round(1.3*(15*3+5*1)+2.5*15));
 // minas easy: récord 30; logros easy (1) y easy10 (2) en minas
 assert.equal(a.partes.records,30);
 // logros: uno primera (15) + pilla (15) · catan primera (15) · minas easy (15) + easy10 (40)
 assert.equal(a.partes.logros,15+15+15+15+40);
 assert.equal(a.partes.dias,25);
 assert.equal(a.total,Object.values(a.partes).reduce((x,y)=>x+y,0));
 const c=M.monedasDe('c',datos);
 assert.equal(c.partes.records,25+60+15+40,'BBTAN 25 + 120/2, sopa 15 + 10 por día de racha');
 assert.equal(M.monedasDe('nadie',datos).total,0);
});

test('el top va de más a menos y deja fuera a quien no tiene nada',()=>{
 const t=M.topMonedas(datos);
 assert.deepEqual([...t.map(x=>x.uid)],['a','c','b','d'].sort((x,y)=>M.monedasDe(y,datos).total-M.monedasDe(x,datos).total||x.localeCompare(y)));
 assert.equal(t.find(x=>x.uid==='a').nombre,'Ana');
 assert.ok(t.every(x=>x.total>0));
});

test('la regla de diario es la que calcula registraDia',()=>{
 const R=JSON.parse(fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8')).rules;
 const v=R.diario.$uid['.validate'];
 assert.match(v,/=== now/);assert.match(v,/10 \+ 5 \*/);assert.match(v,/> 9 \? 8/);
 assert.equal(R.diario['.read'],'auth != null');
 assert.equal(R.diario.$uid['.write'],'auth != null && auth.uid === $uid');
});
