/* Electrodle: los catálogos, el motor (juegos/club/electro/motor.js) y su
   registro en el club, en Discord, en las monedas y en las reglas. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const D=require('../../juegos/club/electro/datos.js');
const S=require('../../juegos/club/electro/simbolos.js');
const M=require('../../juegos/club/electro/motor.js');
const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={};vm.createContext(ctx);
vm.runInContext(sin('src/juegos/solo/club-datos.js')+';globalThis.__C={categoriaClub,resultadoClub};',ctx);
const C=ctx.__C;

test('cada ficha está completa, con ids únicos y valores del vocabulario',()=>{
 const unicos=l=>assert.equal(new Set(l.map(x=>x.id)).size,l.length);
 unicos(D.COMPONENTES);unicos(D.CIENTIFICOS);unicos(D.FORMULAS);
 assert.ok(D.COMPONENTES.length>=40&&D.CIENTIFICOS.length>=40&&D.FORMULAS.length>=40);
 for(const c of D.COMPONENTES){
  assert.ok(c.n&&c.f&&c.d&&c.ref,c.id);
  assert.ok(Array.isArray(c.fn)&&c.fn.length>=1,c.id);
  assert.ok(Number.isInteger(c.t)&&c.t>=1&&c.t<=40,c.id);
  assert.equal(typeof c.p,'boolean',c.id);
  assert.ok(Number.isInteger(c.e)&&c.e>=0&&c.e<D.EPOCAS.length,c.id);
 }
 for(const c of D.CIENTIFICOS){
  assert.ok(c.n&&c.d&&c.pais.length&&c.area.length,c.id);
  assert.ok(c.nace<c.muere&&c.muere-c.nace<100,c.id);
  assert.ok(['SI','CGS','Otra','No'].includes(c.u),c.id);
  assert.equal(typeof c.nobel,'boolean',c.id);
 }
 for(const f of D.FORMULAS){assert.ok(f.n&&f.a&&f.d,f.id);assert.ok(M.variables(f.f).length>=1,f.id);}
 // Los nombres no se repiten: el buscador elige por nombre.
 for(const l of [D.COMPONENTES,D.CIENTIFICOS,D.FORMULAS])assert.equal(new Set(l.map(x=>M.normaliza(x.n))).size,l.length);
});

test('cada símbolo es de un componente y su foco cae dentro del dibujo',()=>{
 for(const [id,s] of Object.entries(S.SIMBOLOS)){
  assert.ok(D.COMPONENTES.some(c=>c.id===id),id);
  assert.ok(s.foco[0]>=0&&s.foco[0]<=S.ANCHO&&s.foco[1]>=0&&s.foco[1]<=S.ALTO,id);
  assert.doesNotMatch(s.svg,/undefined|NaN|<script|href=/,id);
 }
 assert.ok(Object.keys(S.SIMBOLOS).length>=30);
 for(const id of Object.keys(S.SIMBOLOS)){
  let antes=null;
  for(let k=0;k<=6;k++){
   const v=M.vista(id,k);
   assert.ok(v.x>=0&&v.y>=0&&v.x+v.w<=S.ANCHO+1e-6&&v.y+v.h<=S.ALTO+1e-6,id+' '+k);
   if(antes)assert.ok(v.w>=antes.w,'el zoom solo se aleja');
   antes=v;
  }
  assert.deepEqual(M.vista(id,6),{x:0,y:0,w:120,h:80,zoom:1});
 }
});

test('el objetivo del día es el mismo para todos y no se repite en una vuelta',()=>{
 for(const m of M.MODOS){
  assert.equal(M.objetivoDelDia(m.id,'2026-10-01'),M.objetivoDelDia(m.id,'2026-10-01'));
  const N=m.objetivos.length,inicio=M.numeroDia('2026-01-01'),vistos=[];
  // Una vuelta completa, desde su primer día, trae a todos una vez.
  const desde=Math.ceil(inicio/N)*N;
  for(let d=desde;d<desde+N;d++)vistos.push(M.objetivoDelDia(m.id,new Date(d*864e5).toISOString().slice(0,10)));
  assert.equal(new Set(vistos).size,N,m.id);
  // Nunca el mismo dos días seguidos, tampoco al cambiar de vuelta.
  for(let d=inicio;d<inicio+3*N;d++){
   const f=new Date(d*864e5).toISOString().slice(0,10),g=new Date((d+1)*864e5).toISOString().slice(0,10);
   assert.notEqual(M.objetivoDelDia(m.id,f),M.objetivoDelDia(m.id,g),m.id+' '+f);
  }
  for(let d=0;d<50;d++)assert.ok(m.objetivos.some(x=>x.id===M.objetivoDelDia(m.id,new Date((inicio+d)*864e5).toISOString().slice(0,10))));
 }
 // El Símbolo solo sale de los que tienen dibujo.
 assert.ok(M.MODO.simb.objetivos.every(c=>S.SIMBOLOS[c.id]));
});

test('la fecha es la de Santiago y falta lo justo para medianoche',()=>{
 assert.equal(M.diaChile(new Date('2026-10-01T02:30:00Z')),'2026-09-30');
 assert.equal(M.diaChile(new Date('2026-10-01T05:00:00Z')),'2026-10-01');
 // 23:00 en Chile (UTC−3 en octubre) = 02:00 UTC: queda una hora.
 assert.equal(M.faltaParaManana(new Date('2026-10-02T02:00:00Z')),3600000);
 assert.equal(M.diaAnterior('2026-03-01'),'2026-02-28');
});

test('comparar: verde, amarillo, rojo y flechas',()=>{
 const c=M.compara('comp','resistencia','potenciometro');
 assert.deepEqual(c.map(x=>x.e),['si','casi','no','si','no','si']);
 assert.equal(c[2].flecha,'↑','el potenciómetro tiene más terminales');
 const t=M.compara('cien','tesla','nyquist');
 assert.equal(t[0].e,'casi','comparten EE. UU.');
 assert.equal(t[1].flecha,'↑');assert.equal(t[2].flecha,'↑');
 assert.ok(M.compara('cien','ohm','ohm').every(x=>x.e==='si'));
 const e=M.compara('comp','igbt','resistencia')[5];
 assert.equal(e.e,'no');assert.equal(e.flecha,'↓','la época del correcto es anterior');
});

test('fórmulas: se destapa una variable por fallo, siempre en el mismo orden',()=>{
 assert.deepEqual(M.variables(M.item('form','joule').f),['P','I','R']);
 assert.deepEqual(M.variables(M.item('form','coulomb').f),['F','k','q_1','q_2','r']);
 for(const f of D.FORMULAS){
  const n=M.variables(f.f).length;
  assert.equal(M.destapadas(f.id,0).size,0);
  for(let k=1;k<=n;k++){
   const a=M.destapadas(f.id,k-1),b=M.destapadas(f.id,k);
   assert.equal(b.size,k);for(const x of a)assert.ok(b.has(x));
  }
  assert.equal(M.destapadas(f.id,99).size,n);
 }
});

test('puntos, pistas y buscador',()=>{
 assert.equal(M.puntosDe(1),100);assert.equal(M.puntosDe(4),70);assert.equal(M.puntosDe(10),10);assert.equal(M.puntosDe(40),10);
 const p=M.pistas('form','ohm',3);assert.ok(p[0].abierta&&!p[1].abierta);assert.match(p[0].t,/Circuitos/);
 assert.ok(M.pistas('comp','resistencia',8).every(x=>x.abierta));
 assert.deepEqual(M.sugerencias('comp','transf',[]).map(x=>x.id),['transformador']);
 for(const q of ['ORSTED','ørsted','oersted'])assert.deepEqual(M.sugerencias('cien',q,[]).map(x=>x.id),['oersted'],q);
 assert.equal(M.sugerencias('comp','condensador',[])[0].id,'capacitor','por su alias');
 assert.equal(M.sugerencias('comp','condensador',[])[0].por,'Condensador');
 assert.equal(M.sugerencias('comp','termocupla',[])[0].id,'termopar');
 assert.equal(M.sugerencias('comp','capa',[])[0].por,undefined,'por su nombre no dice alias');
 assert.equal(M.sugerencias('cien','ampere',[])[0].id,'ampere','sin tildes');
 assert.ok(!M.sugerencias('comp','diodo',['diodo']).some(x=>x.id==='diodo'),'lo ya probado no sale');
 assert.equal(M.sugerencias('comp','',[]).length,0);
});

test('racha, puntos y tiempo salen de lo terminado',()=>{
 let e=M.vacio();
 const todo=(e,f,n=1)=>{for(const m of M.IDS_MODOS)e=M.registra(e,f,m,n,1000);return e;};
 e=todo(e,'2026-09-28');e=todo(e,'2026-09-29',3);
 assert.equal(M.racha(e,'2026-09-29'),2);
 assert.equal(M.racha(e,'2026-09-30'),2,'hoy sin terminar no corta la racha de ayer');
 assert.equal(M.racha(e,'2026-10-01'),0,'un día sin jugar sí');
 e=M.registra(e,'2026-09-30','comp',2,500);
 assert.ok(!M.diaCompleto(e,'2026-09-30'));
 assert.equal(M.racha(e,'2026-09-30'),2);
 e=todo(e,'2026-10-02');
 assert.equal(M.racha(e,'2026-10-02'),1);assert.equal(M.mejorRacha(e),2);
 const t=M.total(e);
 assert.equal(t.puntos,400+4*80+90+400);
 assert.equal(t.ms,12*1000+500);
 assert.equal(M.tiempoDia(e,'2026-09-29'),4000);
 assert.match(M.resumen(e,'2026-10-02'),/Electrodle 2026-10-02[\s\S]*400 pts · 🔥 1/);
});

test('limpia descarta lo inválido y mezcla junta dos dispositivos',()=>{
 const sucio={hist:{'2026-02-30':{comp:[100,1,5]},'2026-10-01':{comp:[9999,2,5],nada:[1,1,1],cien:['x',0,1]}},
  prog:{fecha:'2026-10-01',m:{comp:{i:['resistencia','resistencia','inventado'],ms:-5}}}};
 const l=M.limpia(sucio);
 assert.deepEqual(l.hist,{'2026-10-01':{comp:[90,2,5]}},'los puntos se recalculan de los intentos');
 assert.deepEqual(l.prog.m.comp,{i:['resistencia'],ms:0});
 assert.deepEqual(M.limpia(null),M.vacio());assert.deepEqual(M.limpia('basura'),M.vacio());
 const a={hist:{'2026-09-30':{comp:[100,1,10]}},prog:{fecha:'2026-10-01',m:{comp:{i:['led'],ms:5}}}};
 const b={hist:{'2026-09-30':{cien:[80,3,10]},'2026-09-29':{form:[100,1,1]}},prog:{fecha:'2026-10-01',m:{comp:{i:['led','bjt'],ms:9}}}};
 const m=M.mezcla(a,b);
 assert.deepEqual(Object.keys(m.hist).sort(),['2026-09-29','2026-09-30']);
 assert.deepEqual(Object.keys(m.hist['2026-09-30']).sort(),['cien','comp']);
 assert.deepEqual(m.prog.m.comp.i,['led','bjt'],'gana el que lleva más intentos');
 assert.deepEqual(M.mezcla(m,m),m);
 assert.equal(M.mezcla({prog:{fecha:'2026-10-02',m:{}}},a).prog.fecha,'2026-10-02','gana el día más nuevo');
});

test('las categorías del club, la regla y Discord',()=>{
 assert.ok(C.categoriaClub('electro','club-electro-puntos'));
 assert.ok(C.categoriaClub('electro','club-electro-racha'));
 assert.ok(!C.categoriaClub('electro','club-electro-comp'));
 const r=(categoria,puntos)=>C.resultadoClub('electro',{categoria,puntos,tiempo:5000,partida:'abc-1'});
 assert.ok(r('club-electro-puntos',350));assert.ok(r('club-electro-racha',12));
 assert.equal(r('club-electro-racha',5000),null);assert.equal(r('club-electro-puntos',2000000),null);
 const reglas=JSON.parse(fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8'));
 const v=reglas.rules.soloRanks.$categoria.$uid;
 const re=new RegExp(v['.validate'].match(/matches\(\/(.+?)\/\)/)[1]);
 for(const c of ['club-electro-racha','club-electro-puntos'])assert.ok(re.test(c),c);
 assert.ok(!re.test('club-electro-otra'));
 assert.match(v.puntos['.validate'],/club-electro-puntos' \? 1000000/);
 const dctx={};vm.createContext(dctx);
 vm.runInContext(sin('src/juegos/discord.js')+'\n;globalThis.__D={marcaSolo,categoriaLegible,mensajePodio};',dctx);
 const {marcaSolo,categoriaLegible,mensajePodio}=dctx.__D;
 assert.equal(categoriaLegible('club-electro-puntos').club.nombre,'Electrodle');
 assert.equal(categoriaLegible('club-electro-racha').modalidad,'racha diaria');
 assert.equal(marcaSolo('club-electro-racha',{puntos:3,tiempo:1}),'🔥 3 días seguidos');
 assert.match(marcaSolo('club-electro-puntos',{puntos:1200,tiempo:1}),/^⚡ 1.200 pts$/);
 const msg=mensajePodio({categoria:'club-electro-puntos',uid:'a',nombre:'Ana',puesto:1,filas:[{uid:'a',nombre:'Ana',puntos:400,tiempo:9000}],enlace:'https://x/juegos.html#solo/electro'});
 assert.ok(msg&&msg.content.includes('Electrodle · puntos totales'));
});
