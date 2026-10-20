/* Referidos: quién puede referir, qué código vale y lo que paga en el
   saldo (src/juegos/referidos.js, sumado en src/juegos/monedas.js). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
const ctx={};vm.createContext(ctx);
vm.runInContext(sin('src/juegos/motor.js')+'\n'+sin('src/juegos/logros.js')+'\n'+sin('src/juegos/tienda.js')+'\n'+sin('src/juegos/cortes.js')+'\n'+sin('src/juegos/referidos.js')+'\n'+sin('src/juegos/monedas.js')+
 ';globalThis.__M={PREMIO_REFERIDO,MIN_JUEGOS,normalizaCodigo,juegosJugados,puedeReferir,codigoDe,duenoCodigo,referidos,monedasReferidos,motivoNoCanje,motivoNoCodigo,monedasDe,topMonedas,topReferidos}',ctx);
const M=ctx.__M;
/* Las cuentas se memorizan por objeto, como en la página, donde cada
   llegada es un objeto nuevo: tras cambiar algo, se pasa una copia. */
const copia=x=>JSON.parse(JSON.stringify(x));

/* A jugó tres juegos distintos (uno de sala, uno del club y una marca);
   B, dos. C y D, tres del club cada uno (para poder canjear). */
const base=()=>({
 ranks:{cuadritos:{A:{jugadas:2,ganadas:1},B:{jugadas:1}},reversi:{B:{jugadas:0}}},
 clubJugadas:{A:{snake:{dia:1,hoy:1,total:1,at:1}},B:{snake:{dia:1,hoy:1,total:3,at:1}},
  C:{snake:{total:1},minas:{total:1},sopa:{total:1}},D:{snake:{total:1},minas:{total:1},sopa:{total:1}}},
 solo:{'club-minas-facil':{A:{puntos:1,tiempo:30,partida:'p1'}}},
 referidos:{c:{ANA2024:'A',BETO:'B'},m:{A:{c:'ANA2024',at:10},B:{c:'BETO',at:11}},u:{}}
});

test('el código se normaliza: mayúsculas, sin espacios ni signos, hasta 12',()=>{
 assert.equal(M.normalizaCodigo(' pia-2026 '),'PIA2026');
 assert.equal(M.normalizaCodigo('ñandú'),'AND');
 assert.equal(M.normalizaCodigo('a'.repeat(20)).length,12);
});

test('referir pide tres juegos distintos: sala, club y marcas cuentan',()=>{
 const d=base();
 assert.deepEqual([...M.juegosJugados('A',d)].sort(),['cuadritos','minas','snake']);
 assert.equal(M.puedeReferir('A',d),true);
 assert.deepEqual([...M.juegosJugados('B',d)].sort(),['cuadritos','snake'],'una fila sin partidas no cuenta');
 assert.equal(M.puedeReferir('B',d),false);
 d.solo['yemas-zombis-base']={B:{puntos:5}};
 assert.equal(M.puedeReferir('B',d),true,'Yemas zombis cuenta como yemas');
});

test('el código es de quien lo tiene en las dos ramas',()=>{
 const d=base();
 assert.equal(M.codigoDe('A',d),'ANA2024');
 assert.equal(M.duenoCodigo('ANA2024',d),'A');
 d.referidos.c.ROBADO='A';
 assert.equal(M.duenoCodigo('ROBADO',d),'','un segundo código sin su `m` no es de nadie');
 assert.equal(M.duenoCodigo('NOEXISTE',d),'');
});

test('usar un código paga 5000 a los dos',()=>{
 const d=base();d.referidos.u.C={c:'ANA2024',r:'A',at:20};
 assert.equal(M.monedasReferidos('C',d),M.PREMIO_REFERIDO);
 assert.equal(M.monedasReferidos('A',d),M.PREMIO_REFERIDO);
 assert.equal(M.monedasDe('C',d).partes.referidos,5000);
 const mc=M.monedasDe('C',d);assert.equal(mc.saldo,5000+mc.partes.club,'el premio entra al saldo');
 d.referidos.u.D={c:'ANA2024',r:'A',at:21};
 const d2=copia(d);
 assert.equal(M.monedasReferidos('A',d2),10000,'cada persona que entra paga otra vez');
 assert.deepEqual([...M.referidos(d2).de.A],['C','D']);
 assert.ok(M.topMonedas(d2).some(x=>x.uid==='C'&&x.partes.referidos===5000),'quien solo canjeó aparece en el top');
});

test('no paga si el dueño no cumple, si el código no es suyo o si es el propio',()=>{
 const d=base();d.referidos.u.C={c:'BETO',r:'B',at:20};
 assert.equal(M.monedasReferidos('C',d),0,'B aún no juega tres juegos');
 assert.equal(M.monedasReferidos('B',d),0);
 d.ranks.ajedrez={B:{jugadas:1}};
 assert.equal(M.monedasReferidos('C',copia(d)),5000,'en cuanto cumple, paga (se deriva)');
 const e=base();e.referidos.u.C={c:'ANA2024',r:'B',at:20};
 assert.equal(M.monedasReferidos('C',e),0,'el dueño inventado no vale');
 assert.equal(M.monedasReferidos('B',e),0);
 const f=base();f.referidos.u.A={c:'ANA2024',r:'A',at:20};
 assert.equal(M.monedasReferidos('A',f),0,'el propio no paga');
});

test('dos que se refieren el uno al otro: vale solo el primero',()=>{
 const d=base();d.ranks.ajedrez={B:{jugadas:1}};
 d.referidos.u.B={c:'ANA2024',r:'A',at:20};
 d.referidos.u.A={c:'BETO',r:'B',at:30};
 assert.equal(M.referidos(d).usado.B.valido,true);
 assert.equal(M.referidos(d).usado.A.valido,false);
 assert.equal(M.monedasReferidos('A',d),5000);
 assert.equal(M.monedasReferidos('B',d),5000);
});

test('los motivos para no canjear ni configurar',()=>{
 const d=base();
 assert.equal(M.motivoNoCanje('C','ANA2024',d),'');
 assert.match(M.motivoNoCanje('C','XX',d),/4 a 12/);
 assert.match(M.motivoNoCanje('C','NADA',d),/no existe/);
 assert.match(M.motivoNoCanje('A','ANA2024',d),/propio/);
 assert.match(M.motivoNoCanje('C','BETO',d),/no está activo/);
 d.referidos.u.A={c:'BETO',r:'B',at:20};
 assert.match(M.motivoNoCanje('B','ANA2024',d),/primero juega 3/,'B aún no juega tres juegos');
 d.ranks.ajedrez={B:{jugadas:1}};
 assert.match(M.motivoNoCanje('B','ANA2024',copia(d)),/el uno al otro/);
 assert.match(M.motivoNoCanje('A','ANA2024',d),/Ya usaste/);
 assert.match(M.motivoNoCodigo('A','OTRO',d),/Ya configuraste/);
 const e=base();delete e.referidos.m.A;delete e.referidos.c.ANA2024;
 assert.equal(M.motivoNoCodigo('A','NUEVO1',e),'');
 assert.match(M.motivoNoCodigo('A','BETO',e),/otra persona/);
 assert.match(M.motivoNoCodigo('A','ab',e),/4 a 12/);
 assert.match(M.motivoNoCodigo('Z','NUEVO2',e),/Primero juega/);
});

test('canjear también pide tres juegos distintos a quien canjea',()=>{
 const d=base();d.referidos.u.E={c:'ANA2024',r:'A',at:20};
 assert.match(M.motivoNoCanje('E','ANA2024',base()),/primero juega 3/);
 assert.equal(M.monedasReferidos('E',d),0,'E no jugó nada: no paga');
 assert.equal(M.monedasReferidos('A',d),0,'ni a quien lo invitó');
 d.clubJugadas.E={snake:{total:1},minas:{total:2}};d.ranks.uno={E:{jugadas:1}};
 assert.equal(M.motivoNoCanje('E','ANA2024',Object.assign(copia(d),{referidos:base().referidos})),'');
 assert.equal(M.monedasReferidos('E',copia(d)),5000,'en cuanto cumple, paga a los dos');
 assert.equal(M.monedasReferidos('A',copia(d)),5000);
});

test('el top de referidos: los cinco con más, solo los que pagan',()=>{
 const d=base();d.ranks.ajedrez={B:{jugadas:1}};
 const u=d.referidos.u,club={snake:{total:1},minas:{total:1},sopa:{total:1}};
 for(const [x,c,at] of [['C','ANA2024',20],['D','ANA2024',21],['E','BETO',15],['F','BETO',16],['G','ANA2024',22]]){u[x]={c,r:x==='C'||x==='D'||x==='G'?'A':'B',at};d.clubJugadas[x]=club;}
 u.H={c:'BETO',r:'B',at:30};   // H no jugó: no cuenta
 const t=M.topReferidos(d);
 assert.deepEqual(copia(t.map(x=>[x.uid,x.n])),[['A',3],['B',2]]);
 assert.equal(M.topReferidos(base()).length,0);
 /* a igual cuenta, primero quien llegó antes */
 const e=base();e.ranks.ajedrez={B:{jugadas:1}};
 e.referidos.u={C:{c:'BETO',r:'B',at:10},D:{c:'ANA2024',r:'A',at:20}};e.clubJugadas.C=club;e.clubJugadas.D=club;
 assert.deepEqual(copia(M.topReferidos(e).map(x=>x.uid)),['B','A']);
});
