/* Sudoku Arcade: el motor (juegos/club/sudoku/motor.js) y su registro en el club.
   Comprueba que los sudokus generados tengan solución única y la dificultad
   pedida, que el diario sea el mismo para todos, la fecha de Chile, el
   resolvedor, los choques, la racha y los puntos del arcade. La última parte
   (categorías en club-datos.js y en las reglas) depende de la integración. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const M=require('../../juegos/club/sudoku/motor.js');

// Pasa una cadena de 81 caracteres a tablero.
const T=s=>M.deCadena(s);
// El sudoku de Wikipedia: se resuelve solo con únicos.
const WIKI=T('530070000600195000098000060800060003400803001700020006060000280000419005000080079');
const DIFS=['facil','medio','dificil','experto'];
// ¿Respeta la solución las pistas y es una cuadrícula completa y válida?
function solucionBuena(p,sol){
 assert.equal(sol.length,81);
 assert.ok(sol.every(v=>v>=1&&v<=9),'llena');
 assert.ok(M.esValido(sol),'sin repetidos');
 p.forEach((v,i)=>{if(v)assert.equal(sol[i],v,'respeta la pista '+i);});
}

test('resolver cuenta 0, 1 y 2 soluciones sin tocar el tablero',()=>{
 const copia=WIKI.slice();
 const r=M.resolver(WIKI);
 assert.equal(r.soluciones,1);solucionBuena(WIKI,r.solucion);
 assert.deepEqual(WIKI,copia,'no muta la entrada');
 // Vacío: muchísimas soluciones, se detiene en el límite.
 assert.equal(M.resolver(new Array(81).fill(0)).soluciones,2);
 assert.equal(M.resolver(new Array(81).fill(0),1).soluciones,1);
 // Quitar pistas al de Wikipedia hasta que tenga varias.
 const flojo=WIKI.slice();for(let i=0;i<30;i++)flojo[i]=0;
 assert.equal(M.resolver(flojo).soluciones,2);
 // Repetido de entrada: 0.
 const malo=WIKI.slice();malo[2]=5;
 assert.equal(M.resolver(malo).soluciones,0);
 // Sin repetidos pero imposible: la celda 0 no admite nada.
 const imp=new Array(81).fill(0);[1,2,3,4,5,6,7,8].forEach((d,k)=>{imp[k+1]=d;});imp[9]=9;
 assert.ok(M.esValido(imp));assert.equal(M.resolver(imp).soluciones,0);
 // Forma rara.
 assert.equal(M.resolver([1,2,3]).soluciones,0);
});

test('esValido, candidatos, conflictos y unidades completas',()=>{
 assert.ok(M.esValido(WIKI));
 assert.ok(!M.esValido([1,2]));
 const sol=M.resolver(WIKI).solucion;
 assert.deepEqual(M.conflictos(WIKI),[]);
 // Un 5 repetido en la fila 0 (celdas 0 y 2): las dos chocan.
 const malo=WIKI.slice();malo[2]=5;
 assert.ok(!M.esValido(malo));
 assert.deepEqual(M.conflictos(malo),[0,2]);
 // Los candidatos de la celda 2 (fila 0, col 2) no repiten pares y contienen la solución.
 const c=M.candidatos(WIKI,2);
 assert.ok(c.includes(sol[2]));
 assert.ok(!c.includes(5)&&!c.includes(3)&&!c.includes(7)&&!c.includes(9)&&!c.includes(8));
 assert.deepEqual(M.candidatos(WIKI,0),[],'llena: sin candidatos');
 // Unidades: con la solución todo está completo; quitando una celda, su fila/col/caja no.
 assert.deepEqual(M.unidadesCompletas(sol,40),{fila:true,columna:true,caja:true});
 const casi=sol.slice();casi[40]=0;
 assert.deepEqual(M.unidadesCompletas(casi,40),{fila:false,columna:false,caja:false});
 assert.deepEqual(M.unidadesCompletas(casi,0),{fila:true,columna:true,caja:true},'la celda 0 no comparte nada con la 40');
 // Cadenas.
 assert.equal(M.aCadena(WIKI),'530070000600195000098000060800060003400803001700020006060000280000419005000080079');
 assert.equal(M.deCadena('x'),null);
 assert.deepEqual(M.deCadena('.'.repeat(81)),new Array(81).fill(0));
});

test('califica por técnicas: el de Wikipedia es fácil y un imposible lo dice',()=>{
 const c=M.califica(WIKI);
 assert.equal(c.dificultad,'facil');
 assert.ok(c.tecnicas.length>0&&c.tecnicas.every(t=>t.startsWith('unico')));
 assert.equal(M.califica(new Array(81).fill(0)).dificultad,'imposible','varias soluciones: hay que adivinar');
 const malo=WIKI.slice();malo[2]=5;
 assert.equal(M.califica(malo).dificultad,'imposible');
 // Cada técnica tiene un nivel válido y los ids no se repiten.
 assert.equal(new Set(M.TECNICAS.map(t=>t.id)).size,M.TECNICAS.length);
 assert.ok(M.TECNICAS.every(t=>t.nivel>=0&&t.nivel<=3));
});

test('generar: solución única y la dificultad pedida en cada nivel',()=>{
 /* Con el tope de INTENTOS puede no salir exacta: entonces se entrega la
    más cercana y `calificacion` dice cuál es. En estas semillas sale
    exacta en todas, y se exige al menos 90 % por si cambian. */
 for(const dif of DIFS){
  let exactas=0;const N=12;
  for(let s=0;s<N;s++){
   const g=M.generar({dificultad:dif,rng:M.mulberry32(1000+s*31)});
   assert.equal(g.dificultad,dif);
   assert.equal(M.resolver(g.pistas).soluciones,1,`${dif} #${s}: solución única`);
   solucionBuena(g.pistas,g.solucion);
   assert.deepEqual(M.resolver(g.pistas).solucion,g.solucion);
   assert.equal(g.calificacion,M.califica(g.pistas).dificultad,'calificacion es la de califica');
   if(g.calificacion===dif)exactas++;
   // Simetría de 180°: la celda i y la 80-i están las dos o ninguna.
   for(let i=0;i<81;i++)assert.equal(!!g.pistas[i],!!g.pistas[80-i],'simétrico');
   assert.ok(M.cuentaPistas(g.pistas)>=17);
  }
  assert.ok(exactas>=Math.ceil(N*0.9),`${dif}: ${exactas}/${N} exactas`);
 }
 // Fácil trae al menos las pistas mínimas de su rango.
 const f=M.generar({dificultad:'facil',rng:M.mulberry32(7)});
 assert.ok(M.cuentaPistas(f.pistas)>=M.DIFICULTADES.facil.pistas[0]);
 // Con la misma semilla, el mismo sudoku.
 assert.deepEqual(M.generar({dificultad:'dificil',rng:M.mulberry32(5)}),M.generar({dificultad:'dificil',rng:M.mulberry32(5)}));
 // Dificultad desconocida: medio.
 assert.equal(M.generar({dificultad:'xx',rng:M.mulberry32(1)}).dificultad,'medio');
});

test('generar experto tarda menos de 1,5 s',()=>{
 for(let s=0;s<6;s++){
  const t=Date.now();
  M.generar({dificultad:'experto',rng:M.mulberry32(424242+s)});
  const ms=Date.now()-t;
  assert.ok(ms<1500,`experto #${s}: ${ms} ms`);
 }
});

test('el diario es el mismo para la misma fecha y cambia entre fechas',()=>{
 const a=M.sudokuDiario('2026-10-04'),b=M.sudokuDiario('2026-10-04');
 assert.deepEqual(a,b);
 assert.equal(a.fecha,'2026-10-04');assert.equal(a.dificultad,'medio');
 assert.equal(M.resolver(a.pistas).soluciones,1);
 solucionBuena(a.pistas,a.solucion);
 assert.notDeepEqual(a.pistas,M.sudokuDiario('2026-10-05').pistas);
 assert.notDeepEqual(a.pistas,M.sudokuDiario('2026-10-03').pistas);
 // La semilla es la del contrato.
 const g=M.generar({dificultad:'medio',rng:M.mulberry32(M.hashTexto('sudoku:2026-10-04'))});
 assert.deepEqual(a.pistas,g.pistas);
 // hashTexto: FNV-1a de 32 bits (el vacío da la base).
 assert.equal(M.hashTexto(''),0x811c9dc5);
});

test('la fecha es la de Santiago, no la del equipo (con y sin horario de verano)',()=>{
 // 2 de octubre 2026: Chile en UTC−3 (horario de verano desde septiembre).
 assert.equal(M.diaChile(new Date('2026-10-01T02:30:00Z')),'2026-09-30');
 assert.equal(M.diaChile(new Date('2026-10-01T03:30:00Z')),'2026-10-01');
 // Junio: Chile en UTC−4.
 assert.equal(M.diaChile(new Date('2026-06-15T03:30:00Z')),'2026-06-14');
 assert.equal(M.diaChile(new Date('2026-06-15T04:30:00Z')),'2026-06-15');
 assert.match(M.diaChile(),/^\d{4}-\d{2}-\d{2}$/);
 assert.equal(M.diaAnterior('2026-03-01'),'2026-02-28');
 assert.equal(M.diaAnterior('2028-03-01'),'2028-02-29','bisiesto');
 assert.equal(M.diaAnterior('2027-01-01'),'2026-12-31');
});

test('la racha: hoy, ayer, día saltado y repetir el día',()=>{
 let r=M.rachaVacia();
 assert.equal(r.n,0);
 r=M.registraDiaria(r,'2026-10-01');
 assert.equal(r.ult,'2026-10-01');assert.equal(r.n,1);assert.equal(r.mejor,1);
 assert.equal(r.racha,r.n,'el nombre de la Sopa también está');
 assert.deepEqual(M.registraDiaria(r,'2026-10-01'),r,'repetir el mismo día no suma');
 r=M.registraDiaria(r,'2026-10-02');r=M.registraDiaria(r,'2026-10-03');
 assert.equal(r.n,3);
 assert.equal(M.rachaVisible(r,'2026-10-03'),3,'hoy');
 assert.equal(M.rachaVisible(r,'2026-10-04'),3,'ayer: aún se puede seguir');
 assert.equal(M.rachaVisible(r,'2026-10-05'),0,'se saltó un día');
 r=M.registraDiaria(r,'2026-10-05');
 assert.equal(r.n,1);assert.equal(r.mejor,3);
 assert.deepEqual(M.limpiaRacha({ult:'x',n:9}),M.rachaVacia());
 assert.equal(M.limpiaRacha({ult:'2026-10-01',racha:4}).n,4,'lee el campo de la Sopa');
 assert.equal(M.limpiaRacha({ult:'2026-10-01',n:-3,mejor:2.5}).n,0);
});

test('mezclar la racha de dos dispositivos',()=>{
 const local={ult:'2026-10-03',n:3,mejor:3},nube={ult:'2026-10-02',n:8,mejor:12};
 const m=M.mezclaRacha(local,nube);
 assert.equal(m.ult,'2026-10-03');assert.equal(m.n,3);assert.equal(m.mejor,12);
 const m2=M.mezclaRacha(null,nube);
 assert.equal(m2.ult,'2026-10-02');assert.equal(m2.n,8);assert.equal(m2.mejor,12);
 assert.deepEqual(M.mezclaRacha(local,null),M.limpiaRacha(local));
 // El mismo día en los dos: gana la racha más larga.
 assert.equal(M.mezclaRacha({ult:'2026-10-03',n:2},{ult:'2026-10-03',n:5}).n,5);
});

test('puntos del arcade y bono de tiempo',()=>{
 assert.equal(M.puntosArcade({combo:1,unidades:0}),M.PUNTOS.acierto);
 assert.equal(M.puntosArcade({combo:1,unidades:0,error:true}),0);
 // El combo multiplica y tiene techo.
 const p1=M.puntosArcade({combo:1}),p5=M.puntosArcade({combo:5}),p99=M.puntosArcade({combo:99});
 assert.ok(p5>p1);assert.equal(p99,M.puntosArcade({combo:1000}));
 assert.equal(p99,Math.round(M.PUNTOS.acierto*M.PUNTOS.comboMax));
 // Unidades: número u objeto dan lo mismo; las tres juntas dan extra.
 assert.equal(M.puntosArcade({combo:1,unidades:2}),M.puntosArcade({combo:1,unidades:{fila:true,columna:true,caja:false}}));
 assert.ok(M.puntosArcade({combo:1,unidades:1})>M.puntosArcade({combo:1,unidades:0}));
 assert.equal(M.puntosArcade({combo:1,unidades:3}),M.PUNTOS.acierto+3*M.PUNTOS.unidad+M.PUNTOS.triple);
 assert.ok(Number.isInteger(M.puntosArcade({combo:3,unidades:1})));
 // Bono de tiempo: más rápido, más bono; nunca negativo; entero.
 assert.ok(M.bonoTiempo(60000,'medio')>M.bonoTiempo(300000,'medio'));
 assert.equal(M.bonoTiempo(10*3600e3,'medio'),0);
 assert.equal(M.bonoTiempo(0,'medio'),M.REFERENCIA.medio*M.PUNTOS.porSegundo);
 assert.ok(Number.isInteger(M.bonoTiempo(12345,'experto')));
 assert.ok(M.bonoTiempo(60000,'experto')>M.bonoTiempo(60000,'facil'),'más difícil, más referencia');
 // Una partida perfecta queda bajo el tope del ranking (1 000 000).
 const max=81*M.puntosArcade({combo:99,unidades:3})+M.bonoTiempo(0,'medio')+3*M.PUNTOS.vida;
 assert.ok(max<1000000,String(max));
});

test('las categorías del contrato pasan por el club (club-datos.js)',()=>{
 // Carga club-datos.js sin import/export, como hace sopa.test.cjs.
 const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
 const ctx={};vm.createContext(ctx);
 vm.runInContext(sin('src/juegos/solo/club-datos.js')+';globalThis.__C={categoriaClub,resultadoClub};',ctx);
 const C=ctx.__C;
 const RE=/^club-sudoku-(racha|arcade|facil|medio|dificil|experto)$/;
 for(const m of ['racha','arcade','facil','medio','dificil','experto']){
  const cat='club-sudoku-'+m;
  assert.ok(RE.test(cat));
  assert.ok(C.categoriaClub('sudoku',cat),cat);
 }
 assert.ok(!C.categoriaClub('sudoku','club-sudoku-imposible'));
 assert.ok(!C.categoriaClub('sudoku','club-sopa-racha'));
 const r=(categoria,puntos)=>C.resultadoClub('sudoku',{categoria,puntos,tiempo:5000,partida:'abc-1'});
 // Clásico: puntos fijos en 1, compite el tiempo.
 for(const d of DIFS){assert.ok(r('club-sudoku-'+d,1),d);assert.equal(r('club-sudoku-'+d,2),null,d+' con puntos != 1');}
 // Racha: días, como mucho 1000.
 assert.ok(r('club-sudoku-racha',4));assert.equal(r('club-sudoku-racha',5000),null);
 // Arcade: la puntuación, hasta 1 000 000.
 assert.ok(r('club-sudoku-arcade',12345));assert.ok(r('club-sudoku-arcade',1000000));
 assert.equal(r('club-sudoku-arcade',1000001),null);
});
