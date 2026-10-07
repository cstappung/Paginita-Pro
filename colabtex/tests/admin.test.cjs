/* El panel de administración: la parte pura (src/juegos/admin-datos.js),
   los ajustes de monedas en el saldo (monedas.js) y la forma de las
   reglas nuevas (firebase/database.rules.json). */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const fs=require('node:fs'),path=require('node:path');
const carga=f=>{const code=esbuild.buildSync({entryPoints:[f],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text;const mod={exports:{}};new Function('module','exports','require',code)(mod,mod.exports,require);return mod.exports;};
const A=carga('src/juegos/admin-datos.js');
const M=carga('src/juegos/monedas.js');
const UUID=i=>`0000000${i}-1111-2222-3333-444444444444`;

test('auditoría: señales sin bajar ninguna prueba',()=>{
  const solo={'club-minas-easy':{
    a:{nombre:'Ana',puntos:1,tiempo:400,partida:UUID(1)},
    b:{nombre:'Beto',puntos:1,tiempo:30000,partida:UUID(2)},
    c:{nombre:'Caro',puntos:1,tiempo:32000,partida:UUID(3)},
    d:{nombre:'Dani',puntos:1,tiempo:35000,partida:'a-mano'}}};
  const h=A.auditaSenales(solo,null,{d:{at:1}});
  const por=Object.fromEntries(h.map(x=>[x.uid,x]));
  assert.match(por.a.motivos.join(),/terminada en 400 ms/);
  assert.match(por.d.motivos.join(),/no es un UUID/);
  assert.equal(por.d.vetado,true);
  assert.ok(!por.b&&!por.c,'lo normal no se marca');
  assert.equal(A.partidaRara('yemas-zombis-kino','abcdef'),null);
  assert.match(A.partidaRara('club-frontera-torre-50','x y'),/Frontera/);
  /* Puntos: el ritmo frente a los demás. */
  const t={'club-tetris-maraton':{a:{puntos:900000,tiempo:60000},b:{puntos:10000,tiempo:600000},c:{puntos:12000,tiempo:600000},d:{puntos:9000,tiempo:600000}}};
  assert.match(A.anomalia('club-tetris-maraton','a',t['club-tetris-maraton']),/ritmo/);
  assert.equal(A.anomalia('club-tetris-maraton','b',t['club-tetris-maraton']),null);
  assert.equal(A.mediana([3,1,2]),2);assert.equal(A.mediana([4,1,2,3]),2.5);
});

test('auditoría: solo se bajan las pruebas que nadie auditó con esa partida',()=>{
  const solo={'club-minas-easy':{a:{partida:'p1'},b:{partida:'p2'},c:{partida:'p3'}},'yemas-zombis-kino':{a:{partida:'zz'}}};
  const aud={'club-minas-easy':{a:{p:'p1',ok:true,vv:A.AUDITORIA_V},b:{p:'viejo',ok:false,m:'x'}}};
  const juegoDe=c=>c.startsWith('club-minas-')?'minas':null;
  const pend=A.pruebasPendientes(solo,aud,juegoDe).map(x=>x.uid).sort();
  assert.deepEqual(pend,['b','c'],'a ya está; b cambió de partida; c nunca; zombis no tiene prueba');
  // Auditada con verificadores de antes: vuelve a la cola, salvo si se revisó a mano.
  const viejo={'club-minas-easy':{a:{p:'p1',ok:true},b:{p:'p2',ok:true,vv:A.AUDITORIA_V-1},c:{p:'p3',ok:true,h:true}}};
  assert.deepEqual(A.pruebasPendientes(solo,viejo,juegoDe).map(x=>x.uid).sort(),['a','b']);
  const malos=A.auditadosMalos({'club-minas-easy':{b:{partida:'p2'},c:{partida:'p3',nombre:'C'}}},{'club-minas-easy':{b:{p:'viejo',ok:false,m:'x'},c:{p:'p3',ok:false,m:'no cuadra'}}});
  assert.equal(malos.length,1);assert.equal(malos[0].uid,'c');assert.match(malos[0].motivos[0],/no cuadra/);
  const j=A.juntaHallazgos([{categoria:'k',uid:'u',motivos:['anómala: x']}],[{categoria:'k',uid:'u',motivos:['la prueba no cuadra: y']},{categoria:'k',uid:'v',motivos:['anómala: z']}]);
  assert.equal(j.length,2);assert.equal(j[0].uid,'u','la prueba que no cuadra va primero');
  assert.deepEqual(j[0].motivos,['anómala: x','la prueba no cuadra: y']);
});

test('revisiones: la cola y quién entra en ella',()=>{
  const l=A.listaRevisiones({'club-snake-classic-mediano':{u1:{p:'p1',pts:50,t:9,l:1,n:'Uno',at:5},u2:{p:'p9',pts:40,t:9,l:2,at:7}}},
    {'club-snake-classic-mediano':{u1:{partida:'p1',nombre:'Uno'},u2:{partida:'otra',nombre:'Dos'}}});
  assert.deepEqual(l.map(r=>[r.uid,r.vigente]),[['u2',false],['u1',true]],'la más nueva arriba; la que ya no es la fila se marca');
  assert.equal(l[0].nombre,'Dos');
  assert.equal(A.merecesRevision('club-tetris-maraton',1,null),true);
  assert.equal(A.merecesRevision('club-tetris-maraton',2,3),true);
  assert.equal(A.merecesRevision('club-tetris-maraton',2,2),false,'mejorar el tiempo sin subir de puesto no');
  assert.equal(A.merecesRevision('club-tetris-maraton',4,null),false);
  assert.equal(A.merecesRevision('yemas-zombis-kino',1,null),false,'sin prueba no hay repetición que ver');
});

test('suspensiones: duraciones y vigencia',()=>{
  const H=3600000,D=24*H;
  assert.equal(A.duracionMs('30m'),30*60000);
  assert.equal(A.duracionMs('2h'),2*H);
  assert.equal(A.duracionMs('1d 12h'),36*H);
  assert.equal(A.duracionMs('1s'),7*D,'s es semana');
  assert.equal(A.duracionMs('1,5d'),36*H);
  for(const x of ['', 'mañana', '3', '2h y algo', '400d', '-1d'])assert.equal(A.duracionMs(x),0,x);
  assert.equal(A.formatoDuracion(2*D+3*H+4*60000+5000),'2 d 03:04:05');
  assert.equal(A.formatoDuracion(65000),'01:05');
  assert.equal(A.formatoDuracion(0),'');
  assert.equal(A.duracionTexto(3*D),'3 días');
  assert.equal(A.duracionTexto(D+12*H+60000),'1 día, 12 horas y 1 minuto');
  assert.equal(A.duracionTexto(H),'1 hora');
  assert.equal(A.suspensionHasta({hasta:10},5),10);
  assert.equal(A.suspensionHasta({hasta:10},10),0);
  assert.deepEqual(A.listaSuspensiones({a:{hasta:30,m:'x'},b:{hasta:20},c:{hasta:1}},5).map(s=>s.uid),['b','a']);
});

test('monedas: los ajustes de un administrador suman y restan en el saldo',()=>{
  assert.equal(A.ajusteValido(5),true);assert.equal(A.ajusteValido(-5),true);
  for(const x of [0,1.5,NaN,'5',A.AJUSTE_MAX+1])assert.equal(A.ajusteValido(x),false,String(x));
  const ajustes={ana:{k1:{n:500,m:'premio',por:'adm',at:1},k2:{n:-200,m:'corrección',por:'adm',at:2},k3:{n:1.5},k4:{n:99999999}}};
  assert.equal(A.sumaAjustes(ajustes,'ana'),300,'lo que no cumple la regla no cuenta');
  assert.deepEqual(A.listaAjustes(ajustes,'ana').slice(0,2).map(a=>a.id),['k2','k1']);
  const d={ranks:{},solo:{},logros:{},diario:{},ajustes};
  const m=M.monedasDe('ana',d);
  assert.equal(m.partes.ajustes,300);
  assert.equal(m.total,300);assert.equal(m.saldo,300);
  assert.equal(M.monedasDe('beto',d).partes.ajustes,0);
  assert.ok(M.topMonedas(d).some(f=>f.uid==='ana'),'y entra en el top');
});

test('reglas: los nodos del panel solo los escribe un administrador',()=>{
  const R=JSON.parse(fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8')).rules;
  const ADMIN="root.child('admins').child(auth.uid).val() === true";
  assert.ok(R.ajustesMonedas['$uid']['$id']['.write'].includes(ADMIN));
  assert.ok(R.ajustesMonedas['$uid']['$id']['.write'].includes('!data.exists()'),'un ajuste no se reescribe ni se borra');
  assert.equal(R.ajustesMonedas['$uid']['$id'].por['.validate'],'newData.val() === auth.uid');
  assert.ok(R.suspensiones['.read'].includes(ADMIN));
  assert.equal(R.suspensiones['$uid']['.read'],'auth != null && auth.uid === $uid','cada uno ve solo la suya');
  assert.ok(R.suspensiones['$uid']['.write'].includes(ADMIN));
  assert.ok(R.auditados['.read'].includes(ADMIN)&&R.auditados['$categoria']['$uid']['.write'].includes(ADMIN));
  assert.ok(R.revisiones['.read'].includes(ADMIN),'la cola solo la leen ellos');
  assert.ok(R.revisiones['$categoria']['$uid']['.validate'].includes("child('partida').val() === newData.child('p').val()"),'la revisión nombra la fila de verdad');
  /* Una cuenta suspendida no escribe récords ni cobra. */
  for(const [n,w] of [['soloRanks',R.soloRanks['$categoria']['$uid']['.write']],['clubJugadas',R.clubJugadas['$uid']['$juego']['.write']],['podios',R.podios['$uid']['$p']['.write']]])
    assert.ok(w.includes("root.child('suspensiones').child(auth.uid).child('hasta').val() <= now"),n);
});
