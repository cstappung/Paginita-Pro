const {test}=require('node:test');
const assert=require('node:assert/strict');
const T=require('./motor.js');

test('la bolsa de siete trae una de cada',()=>{
 const b=T.bolsa(42);
 for(let k=0;k<5;k++){const t=[];for(let i=0;i<7;i++)t.push(b());assert.equal(t.sort().join(''),'IJLOSTZ');}
 const a=T.bolsa(7),c=T.bolsa(7);for(let i=0;i<30;i++)assert.equal(a(),c());
});

test('una I tumbada en el fondo, cuatro veces, no limpia; diez columnas sí',()=>{
 const s=T.crear({semilla:3});
 /* Relleno a mano la fila de abajo menos una celda y dejo caer una I vertical. */
 for(let x=0;x<9;x++)s.pozo[(T.H-1)*T.W+x]='G';
 s.p={t:'I',r:1,x:7,y:0};
 T.caer(s);
 assert.equal(s.lineas,1);
 assert.ok(s.eventos.some(e=>e.e==='fija'&&e.n===1));
});

test('la gravedad hace caer y fijar sola',()=>{
 const s=T.crear({semilla:5});
 for(let i=0;i<200000&&!s.fin;i+=16)T.avanza(s,16);
 assert.ok(s.fin,'sin tocar nada el pozo se llena');
 assert.ok(s.piezas>10);
});

test('SRS: la T gira contra la pared con patada',()=>{
 const s=T.crear({semilla:1});
 s.p={t:'T',r:1,x:-1,y:5};
 assert.ok(T.cabe(s,s.p));
 assert.ok(T.rotar(s,1));
 assert.ok(T.cabe(s,s.p));
});

test('la basura entra desde abajo y el ataque la cancela',()=>{
 const s=T.crear({semilla:9});
 T.recibe(s,3);
 assert.equal(T.pendiente(s),3);
 T.caer(s);
 const fondo=s.pozo.slice((T.H-3)*T.W);
 assert.equal(fondo.filter(c=>c==='G').length,27);
 const r=T.crear({semilla:9});
 T.recibe(r,2);
 for(let x=0;x<9;x++)for(let y=T.H-4;y<T.H;y++)r.pozo[y*T.W+x]='G';
 r.pozo[(T.H-5)*T.W]='G';
 r.p={t:'I',r:1,x:7,y:0};
 T.caer(r);
 assert.equal(r.lineas,4);
 assert.equal(T.pendiente(r),0);
 assert.equal(r.salida,2);
});

test('el resumen mide 200 letras',()=>{
 const s=T.crear({semilla:2});
 assert.equal(T.resumen(s).length,200);
});

test('guardar cambia la pieza una vez por caída',()=>{
 const s=T.crear({semilla:4});
 const t=s.p.t;
 assert.ok(T.guardar(s));
 assert.equal(s.guardada,t);
 assert.ok(!T.guardar(s));
 T.caer(s);
 assert.ok(T.guardar(s));
});
