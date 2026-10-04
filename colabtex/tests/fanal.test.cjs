/* FANAL: el motor (juegos/club/fanal/motor.js), el relato (relato.js), la
   teoría de la música (musica.js), los dibujos (sprites.js) y su registro
   en el club. No abre un navegador: todo lo que se prueba es puro.
   Comprueba que la travesía tenga al menos ocho oleadas y tres jefes, que
   la curva del sin fin suba y se detenga, que los puntos y la Resonancia
   sean los del manual, que el juicio del pulso sea justo, que el progreso
   guardado se mezcle sin perder nada, que cada acto tenga escala y métrica
   propias e irregulares, que los leitmotivs duren sus compases y que los
   dibujos estén bien formados. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const D=path.join(__dirname,'../../juegos/club/fanal');
const M=require(path.join(D,'motor.js'));
const R=require(path.join(D,'relato.js'));
const MU=require(path.join(D,'musica.js'));
const S=require(path.join(D,'sprites.js'));

test('la travesía: trece jornadas, al menos ocho oleadas y tres jefes, cuatro actos en orden',()=>{
 assert.equal(M.JORNADAS_HISTORIA,13);
 const oleadas=M.JORNADAS.filter(j=>j.tipo==='oleada'||j.tipo==='lumbre');
 const jefes=M.JORNADAS.filter(j=>j.tipo==='jefe');
 assert.ok(oleadas.length>=8,String(oleadas.length));
 assert.deepEqual(jefes.map(j=>j.jefe),['nodriza','faro','esfinge','alba']);
 // Los actos no retroceden y cada uno cierra con su jefe.
 M.JORNADAS.forEach((j,i)=>{assert.equal(j.n,i+1);if(i)assert.ok(j.acto>=M.JORNADAS[i-1].acto);});
 for(const a of [1,2,3])assert.equal(M.JORNADAS.filter(j=>j.acto===a).pop().tipo,'jefe');
 // El punto de control cae al empezar cada acto.
 for(const [a,n] of Object.entries(M.INICIO_ACTO))assert.equal(M.jornada(n).acto,+a);
});

test('la curva: la historia sube de jornada en jornada y el sin fin sube y se detiene',()=>{
 const ol=M.JORNADAS.filter(j=>j.tipo==='oleada');
 for(let i=1;i<ol.length;i++)assert.ok(ol[i].fuego>=ol[i-1].fuego-0.2,'fuego jornada '+ol[i].n);
 assert.equal(M.dificultad(5),1);
 assert.ok(M.dificultad(20)>M.dificultad(15));
 assert.equal(M.dificultad(500),2.4);
 // El sin fin recorre los tres actos en bloques de cuatro, con su jefe al cierre.
 assert.deepEqual([14,15,16,17].map(n=>M.jornada(n).tipo),['oleada','oleada','oleada','jefe']);
 assert.equal(M.jornada(17).jefe,'nodriza');assert.equal(M.jornada(21).jefe,'faro');assert.equal(M.jornada(25).jefe,'esfinge');
 assert.ok(M.vidaJefe(M.jornada(29))>M.vidaJefe(M.jornada(17)),'el jefe vuelve más fuerte');
 for(let n=14;n<200;n++){const j=M.jornada(n);if(j.tipo!=='oleada')continue;assert.ok(j.balas<=8&&j.cols<=11&&j.filas.length<=6,String(n));}
});

test('la formación cabe en la pantalla y deja espacio para marchar',()=>{
 for(let n=1;n<60;n++){
  const j=M.jornada(n);if(j.tipo==='jefe')continue;
  const f=M.formacion(j);
  assert.equal(f.lista.length,j.filas.length*j.cols);
  assert.ok(f.ancho<=M.ANCHO-50,'jornada '+n+' ancho '+f.ancho);
  assert.ok(M.Y_FORMACION+f.alto<M.Y_NAUFRAGIOS-60,'jornada '+n+' alto');
 }
});

test('puntos, Resonancia, bonus y llamas extra',()=>{
 assert.equal(M.resonancia(0),1);assert.equal(M.resonancia(3),1);assert.equal(M.resonancia(4),2);assert.equal(M.resonancia(99),8);
 assert.equal(M.puntosPolilla(1,'c',1,false,0),30);
 assert.equal(M.puntosPolilla(1,'c',2,true,0),90);            // 30 × 2 × 1,5
 assert.equal(M.puntosPolilla(5,'a',1,false,2),30);           // 25 × 1,2 en la segunda vuelta
 const b=M.bonusJornada({acto:2,sinDanio:true,disparos:10,aciertos:5});
 assert.deepEqual(b,{sinDanio:1000,precision:500,total:1500});
 assert.equal(M.bonusJornada({acto:1,sinDanio:false,disparos:0,aciertos:0}).total,0);
 assert.equal(M.llamasGanadas(29000,31000),1);
 assert.equal(M.llamasGanadas(0,160000),3);
 assert.equal(M.llamasGanadas(150000,260000),1);              // solo 250 000: 150 000 ya estaba
 // Una travesía perfecta queda lejos del tope del ranking.
 const pol=M.JORNADAS.reduce((t,j)=>t+M.polillasDe(j),0);
 assert.ok(pol*M.puntosPolilla(3,'c',8,true,0)+Object.values(M.PUNTOS_JEFE).reduce((a,c)=>a+c,0)<1000000);
});

test('el juicio del pulso: dentro de la ventana es afinado, fuera no, y el más cercano manda',()=>{
 assert.equal(M.juzgaPulso(1.05,1.0,1.4).afinado,true);
 assert.equal(M.juzgaPulso(1.2,1.0,1.4).afinado,false);
 assert.equal(M.juzgaPulso(1.33,1.0,1.4).afinado,true);
 assert.ok(M.juzgaPulso(1.33,1.0,1.4).error<0,'antes del pulso, error negativo');
 assert.equal(M.juzgaPulso(5,null,null).afinado,false);
 // El latido acelera la marcha al quedar pocas.
 assert.equal(M.latido(1),1);assert.ok(M.latido(0)>M.latido(0.5));assert.ok(M.latido(0)<=1.6+1e-9);
});

test('el progreso se mezcla: se suman cartas, el final no se olvida y gana el punto de control más nuevo',()=>{
 const a={frag:[0,2],ecos:[1],alba:false,punto:{j:5,puntos:9000,llamas:2,at:10},mejor:{travesia:9000,sinfin:0,jornada:4}};
 const b={frag:[1,2,99],ecos:[],alba:true,punto:{j:0,at:20},mejor:{travesia:5000,sinfin:300,jornada:13}};
 const m=M.mezclaProgreso(a,b);
 assert.deepEqual(m.frag,[0,1,2]);assert.deepEqual(m.ecos,[1]);assert.equal(m.alba,true);
 assert.equal(m.punto.j,0,'el borrado es más nuevo');
 assert.deepEqual(m.mejor,{travesia:9000,sinfin:300,jornada:13});
 assert.equal(M.mezclaProgreso(a,{punto:{j:9,puntos:1,llamas:3,at:30}}).punto.j,9);
 assert.deepEqual(M.mezclaProgreso('basura',null).frag,[]);
 const r=M.mulberry32(7),r2=M.mulberry32(7);assert.equal(r(),r2());
});

test('el relato: textos completos, en orden, y las cartas no se adelantan',()=>{
 assert.equal(R.BITACORA.length,M.JORNADAS_HISTORIA);
 R.BITACORA.forEach((t,i)=>assert.ok(t.startsWith('Jornada '+(i+1)+'.'),t));
 assert.equal(R.FRAGMENTOS.length,13);
 for(let i=1;i<R.FRAGMENTOS.length;i++)assert.ok(R.FRAGMENTOS[i].acto>=R.FRAGMENTOS[i-1].acto);
 assert.equal(R.fragmentoSiguiente([],1),0);
 assert.equal(R.fragmentoSiguiente([0,1,2,3],1),-1,'el acto I solo deja leer las suyas');
 assert.equal(R.fragmentoSiguiente([0,1,2,3],2),4);
 assert.equal(R.fragmentoSiguiente([...Array(13).keys()],4),-1);
 // Cada acto tiene Mensajeras suficientes para todas sus cartas.
 for(const a of [1,2,3,4]){const cartas=R.FRAGMENTOS.filter(f=>f.acto===a).length,cruces=M.JORNADAS.filter(j=>j.acto===a).reduce((t,j)=>t+(j.mensajeras||0),0);assert.ok(cruces>=cartas,'acto '+a+': '+cruces+' cruces para '+cartas+' cartas');}
 assert.ok(R.ECOS.length>=10);assert.ok(R.ecoSiguiente([0,1],0)===2);
 assert.match(R.bitacora(14),/^Jornada 14\. /);assert.match(R.bitacora(140),/^Jornada 140\. /);
 assert.equal(R.romano(13),'XIII');assert.equal(R.romano(4),'IV');
 assert.ok(R.REVELACION.length>=4&&R.FINAL.length>=4);
 for(const j of ['nodriza','faro','esfinge','alba'])assert.ok(R.JEFES[j].nombre&&R.JEFES[j].epiteto,j);
 // Todo el texto en español, sin restos de plantilla.
 const todo=JSON.stringify(R);assert.doesNotMatch(todo,/undefined|\bTODO\b|lorem ipsum/);
});

test('la música: cada acto con su escala y su métrica irregular, y los efectos en la misma escala',()=>{
 const acto=[1,2,3,4].map(a=>MU.ETAPAS[a]);
 assert.equal(new Set(acto.map(e=>e.escala)).size,4,'una escala por acto');
 for(const e of acto){
  const m=MU.mapaCompas(e.metrica);
  assert.ok(m.largo%2===1||e.metrica==='5/4',e.metrica+' es irregular');
  assert.ok(m.grupos.some(g=>g!==m.grupos[0])||m.largo===10,'grupos desiguales en '+e.metrica);
  assert.equal(m.nivel[0],2);assert.equal(m.pulsos[0],0);
 }
 assert.deepEqual(MU.mapaCompas('7/8').pulsos,[0,2,4]);
 assert.deepEqual(MU.mapaCompas('11/8').pulsos,[0,3,6,9]);
 // Las escalas raras de verdad: pélog y sléndro no caben en un piano.
 assert.ok(MU.ESCALAS.pelog.cents.some(c=>c%100!==0));assert.ok(MU.ESCALAS.slendro.cents.some(c=>c%100!==0));
 assert.ok(['pelog','frigiaDom','hungara','lidiaAum','slendro','tonos'].every(k=>MU.ESCALAS[k]));
 // La frecuencia: el grado n de una escala de n notas es la octava.
 assert.ok(Math.abs(MU.frecuencia(110,'hungara',7)-220)<1e-9);
 assert.ok(Math.abs(MU.frecuencia(110,'hungara',-7)-55)<1e-9);
 // El sin fin rota de escala y compás.
 assert.notEqual(MU.etapaSinFin(0).escala,MU.etapaSinFin(1).escala);
});

test('los leitmotivs duran dos compases de su acto y cambian con la vida del jefe',()=>{
 const compas={nodriza:'7/8',faro:'5/4',esfinge:'11/8'};
 for(const [j,met] of Object.entries(compas)){
  const largo=MU.mapaCompas(met).largo*2;
  assert.equal(MU.largoMotivo(MU.leitmotiv(j,0)),largo,j);
  assert.notDeepEqual(MU.leitmotiv(j,0),MU.leitmotiv(j,2),j+' cambia en la última fase');
 }
 assert.equal(MU.largoMotivo(MU.MOTIVOS.fanal),MU.mapaCompas('9/8').largo*2);
 // El Alba canta el tema del fanal al revés (espejo).
 assert.deepEqual(MU.leitmotiv('alba',0).map(n=>n[0]+0),MU.MOTIVOS.fanal.map(n=>0-n[0]));
 assert.deepEqual([0.9,0.5,0.1].map(MU.faseDeVida),[0,1,2]);
 // La Esfinge, al final, es un lamento: el doble de lento y una octava abajo.
 const lam=MU.leitmotiv('esfinge',2);assert.equal(MU.largoMotivo(lam),2*MU.largoMotivo(MU.MOTIVOS.esfinge));
 assert.ok(lam.every(([g],i)=>g===MU.MOTIVOS.esfinge[i][0]-7));
 // Fragmentar conserva el largo (no rompe el compás).
 assert.equal(MU.largoMotivo(MU.fragmenta(MU.MOTIVOS.nodriza,3)),MU.largoMotivo(MU.MOTIVOS.nodriza));
});

test('las capas: el latido siempre en juego, el colchón solo con peligro, silencio de verdad',()=>{
 const tranquilo=MU.capas({modo:'juego',tension:0,peligro:0});
 assert.ok(tranquilo.latido>0.5);assert.equal(tranquilo.tensionPad,0);assert.equal(tranquilo.melodia,0);
 const tenso=MU.capas({modo:'juego',tension:1,peligro:1});
 assert.ok(tenso.percusion>tranquilo.percusion&&tenso.tensionPad>0.9&&tenso.melodia>0.9);
 assert.equal(MU.capas({modo:'juego',tension:1,jefe:'faro'}).leitmotiv,1);
 assert.ok(Object.values(MU.capas({modo:'silencio'})).every(v=>v===0));
 assert.equal(MU.capas({modo:'transito'}).latido,0,'en el tránsito no hay latido: es soledad');
 for(const e of Object.keys(MU.ESCALAS)){const f=MU.figuraCampanas(e);assert.equal(f.length,8);assert.ok(new Set(f).size>=4,e);}
});

test('los dibujos: filas del mismo largo, papeles conocidos y una paleta por acto',()=>{
 const forma=(nombre,filas)=>{const w=filas[0].length;filas.forEach((f,i)=>assert.equal(f.length,w,nombre+' fila '+i));};
 for(const a of [1,2,3,4])for(const t of ['a','b','c']){
  const p=S.POLILLAS[a][t];assert.equal(p.length,2,a+t);
  p.forEach((cuadro,i)=>{forma('polilla '+a+t+i,cuadro);assert.match(cuadro.join(''),/^[.abBcdef]+$/);});
  for(const papel of 'abBcdef')assert.match(S.paletaPolilla(a,t)[papel],/^#[0-9a-f]{6}$/,a+t+papel);
 }
 for(const t of ['a','b','c'])assert.match(S.paletaPolilla(5,t,2).b,/^#[0-9a-f]{6}$/);
 S.MINI.forEach((c,i)=>forma('mini'+i,c));S.MENSAJERA.forEach((c,i)=>forma('mensajera'+i,c));
 forma('fanal',S.FANAL);forma('naufragio',S.NAUFRAGIO);
 for(const [k,v] of Object.entries(S.PODERES))forma(k,v);
 for(const a of [1,2,3,5]){const n=S.naufragio(a);assert.equal(n.length,S.NAUFRAGIO.length);assert.ok(n.flat().filter(Boolean).length>150);}
 assert.equal(new Set([1,2,3,4,5].map(a=>S.PALETAS[a].cielo[0])).size,5,'cinco cielos distintos');
 assert.equal(S.mezcla('#000000','#ffffff',0.5),'#808080');
});

test('las categorías de FANAL pasan por el club, por Discord y por las reglas',()=>{
 const sin=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^import [\s\S]*?;$/mg,'').replace(/\bexport\s+/g,'');
 const ctx={};vm.createContext(ctx);
 vm.runInContext(sin('src/juegos/solo/club-datos.js')+';globalThis.__C={categoriaClub,resultadoClub};',ctx);
 const C=ctx.__C;
 for(const m of ['travesia','sinfin','jornadas'])assert.ok(C.categoriaClub('fanal','club-fanal-'+m),m);
 assert.ok(!C.categoriaClub('fanal','club-fanal-otra'));assert.ok(!C.categoriaClub('fanal','club-sudoku-arcade'));
 const r=(categoria,puntos)=>C.resultadoClub('fanal',{categoria,puntos,tiempo:5000,partida:'abc-1'});
 assert.ok(r('club-fanal-travesia',45000));assert.ok(r('club-fanal-sinfin',1000000));assert.equal(r('club-fanal-sinfin',1000001),null);
 assert.ok(r('club-fanal-jornadas',13));assert.equal(r('club-fanal-jornadas',100001),null);
 // Las reglas de Firebase conocen las tres tablas y el juego del club.
 const reglas=fs.readFileSync(path.join(__dirname,'../../firebase/database.rules.json'),'utf8');
 assert.match(reglas,/club-fanal-\(travesia\|sinfin\|jornadas\)/);
 assert.match(reglas,/sudoku\|fanal\)\$\/\)/);
 assert.match(reglas,/'club-fanal-travesia' \|\| \$categoria === 'club-fanal-sinfin' \|\| [^?]*\? 1000000/);
 // El juego carga sus piezas con versión, y la página tiene i18n.
 const html=fs.readFileSync(path.join(D,'index.html'),'utf8');
 for(const f of ['relato','motor','sprites','musica','juego'])assert.match(html,new RegExp(f+'\\.js\\?v=fanal-\\d+'));
 assert.match(html,/i18n\.js\?v=/);assert.match(html,/conexion\.js\?v=club-\d+/);
});
