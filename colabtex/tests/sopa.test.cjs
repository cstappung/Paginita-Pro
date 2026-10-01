/* Sopa de letras: el motor (juegos/club/sopa/motor.js) y su registro en el club. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const M=require('../../juegos/club/sopa/motor.js');
const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={};vm.createContext(ctx);
vm.runInContext(sin('src/juegos/solo/club-datos.js')+';globalThis.__C={categoriaClub,resultadoClub};',ctx);
const C=ctx.__C;

test('los temas: mayúsculas sin tildes ni Ñ, al menos 16 palabras y caben en 15×15',()=>{
 assert.equal(M.TEMAS.length,7);
 for(const t of M.TEMAS){
  assert.ok(t.palabras.length>=16,t.id);
  for(const w of t.palabras)assert.match(w,/^[A-Z]{4,15}$/,w);
  assert.equal(new Set(t.palabras).size,t.palabras.length,t.id+' sin repetidas');
 }
});

test('la fecha es la de Santiago, no la del equipo',()=>{
 // 02:30 UTC del 1 de octubre todavía es 30 de septiembre en Chile.
 assert.equal(M.diaChile(new Date('2026-10-01T02:30:00Z')),'2026-09-30');
 assert.equal(M.diaChile(new Date('2026-10-01T05:00:00Z')),'2026-10-01');
 assert.equal(M.diaAnterior('2026-03-01'),'2026-02-28');
 assert.equal(M.diaAnterior('2027-01-01'),'2026-12-31');
});

test('la diaria es la misma para todos y la temática rota por día',()=>{
 const a=M.sopaDiaria('2026-10-01'),b=M.sopaDiaria('2026-10-01');
 assert.deepEqual(a,b);
 assert.equal(a.tam,12);assert.equal(a.dif,'medio');assert.equal(a.palabras.length,10);
 assert.notDeepEqual(a.grilla,M.sopaDiaria('2026-10-02').grilla);
 const temas=new Set();for(let d=0;d<7;d++)temas.add(M.temaDelDia(new Date(Date.UTC(2026,9,1+d)).toISOString().slice(0,10)).id);
 assert.equal(temas.size,7,'una semana pasa por todas las temáticas');
});

test('cada sopa respeta tamaño, dificultad y celdas',()=>{
 for(const tam of [8,12,15])for(const dif of ['facil','medio','dificil'])for(const t of M.TEMAS)for(let k=0;k<12;k++){
  const s=M.generar({tema:t.id,tam,dif,rng:M.mulberry32(k*7919+tam)});
  assert.equal(s.grilla.length,tam*tam);assert.ok(s.grilla.every(l=>/^[A-Z]$/.test(l)));
  assert.equal(s.palabras.length,M.TAMANOS[tam]);
  for(const p of s.palabras){
   assert.ok(t.palabras.includes(p.palabra));
   assert.equal(p.celdas.map(c=>s.grilla[c]).join(''),p.palabra);
   const d=p.celdas[1]-p.celdas[0],dx=((p.celdas[1]%tam)-(p.celdas[0]%tam)),dy=Math.floor(p.celdas[1]/tam)-Math.floor(p.celdas[0]/tam);
   assert.ok(M.DIRECCIONES[dif].some(([a,b])=>a===dx&&b===dy),`${dif}: ${p.palabra} va en ${dx},${dy}`);
   assert.ok(p.celdas.every((c,i)=>!i||c-p.celdas[i-1]===d),'en línea recta');
  }
  const ws=s.palabras.map(p=>p.palabra);
  for(const a of ws)for(const b of ws)if(a!==b)assert.ok(!a.includes(b),`${b} dentro de ${a}`);
 }
});

test('la selección va en línea recta y acepta la palabra al derecho o al revés',()=>{
 assert.deepEqual(M.linea(5,0,0,3,0),[0,1,2,3]);
 assert.deepEqual(M.linea(5,0,0,3,1),[0,1,2,3],'casi horizontal se endereza');
 assert.deepEqual(M.linea(5,4,4,0,0),[24,18,12,6,0]);
 assert.deepEqual(M.linea(5,2,2,2,2),[12]);
 const s=M.sopaDiaria('2026-10-01'),p=s.palabras[0];
 assert.equal(M.palabraEn(s,p.celdas,new Set()),0);
 assert.equal(M.palabraEn(s,[...p.celdas].reverse(),new Set()),0);
 assert.equal(M.palabraEn(s,p.celdas,new Set([0])),-1,'ya encontrada');
 assert.equal(M.palabraEn(s,p.celdas.slice(0,-1),new Set()),-1);
});

test('la racha: sube con ayer, vuelve a 1 si se cortó y se ve 0 tras saltarse un día',()=>{
 let r=M.rachaVacia();
 r=M.registraDiaria(r,'2026-10-01');assert.deepEqual(r,{ult:'2026-10-01',racha:1,mejor:1});
 assert.deepEqual(M.registraDiaria(r,'2026-10-01'),r,'repetir el mismo día no suma');
 r=M.registraDiaria(r,'2026-10-02');r=M.registraDiaria(r,'2026-10-03');assert.equal(r.racha,3);
 assert.equal(M.rachaVisible(r,'2026-10-04'),3,'hoy aún se puede seguir');
 assert.equal(M.rachaVisible(r,'2026-10-05'),0,'se saltó un día');
 r=M.registraDiaria(r,'2026-10-05');assert.deepEqual(r,{ult:'2026-10-05',racha:1,mejor:3});
 assert.deepEqual(M.limpiaRacha({ult:'x',racha:9}),M.rachaVacia());
});

test('mezclar la racha del navegador con la de la cuenta',()=>{
 const local={ult:'2026-10-03',racha:3,mejor:3},nube={ult:'2026-10-02',racha:8,mejor:12};
 assert.deepEqual(M.mezclaRacha(local,nube),{ult:'2026-10-03',racha:3,mejor:12});
 assert.deepEqual(M.mezclaRacha(null,nube),{ult:'2026-10-02',racha:8,mejor:12});
 assert.deepEqual(M.mezclaRacha(local,null),local);
});

test('las categorías del club y sus puntos',()=>{
 assert.ok(C.categoriaClub('sopa','club-sopa-racha'));
 assert.ok(C.categoriaClub('sopa','club-sopa-dificil-15'));
 assert.ok(!C.categoriaClub('sopa','club-sopa-medio-10'));
 const r=(categoria,puntos)=>C.resultadoClub('sopa',{categoria,puntos,tiempo:5000,partida:'abc-1'});
 assert.ok(r('club-sopa-facil-8',6));assert.ok(r('club-sopa-medio-12',10));assert.ok(r('club-sopa-dificil-15',13));
 assert.equal(r('club-sopa-facil-8',10),null,'los puntos son las palabras del tamaño');
 assert.ok(r('club-sopa-racha',4));assert.equal(r('club-sopa-racha',5000),null);
 const reglas=JSON.parse(fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8'));
 const v=reglas.rules.soloRanks.$categoria.$uid['.validate'];
 const re=new RegExp(v.match(/matches\(\/(.+?)\/\)/)[1]);
 for(const c of ['club-sopa-racha','club-sopa-facil-8','club-sopa-dificil-15'])assert.ok(re.test(c),c);
});
