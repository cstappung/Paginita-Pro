/* FANAL: el motor (juegos/club/fanal/motor.js), el relato (relato.js), la
   teoría de la música (musica.js), los dibujos (sprites.js) y su registro
   en el club. No abre un navegador: todo lo que se prueba es puro.
   Comprueba que la travesía tenga una oleada y un jefe por acto y termine
   en el Sol, que después los jefes vuelvan en fase 2 y 3, que los puntos y la Resonancia
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

test('la travesía: veinte jornadas, una oleada y un jefe por acto, el Alba en la 8 y el Sol en la 20',()=>{
 assert.equal(M.JORNADAS_HISTORIA,20);assert.equal(M.JORNADA_ALBA,8);assert.equal(M.JORNADA_HOGUERA,14);
 const jefes=M.JORNADAS.filter(j=>j.tipo==='jefe');
 assert.deepEqual(jefes.map(j=>j.jefe),['nodriza','faro','esfinge','alba','casco','crisalida','hoguera','luna','constelacion','sol']);
 assert.equal(M.jornada(8).jefe,'alba');assert.equal(M.jornada(20).jefe,'sol');
 // Las impares son la pelea con el enjambre (o las lumbres, antes del Alba); las pares, el jefe.
 M.JORNADAS.forEach((j,i)=>{assert.equal(j.n,i+1);assert.equal(j.tipo==='jefe',j.n%2===0,'jornada '+j.n);if(i)assert.ok(j.acto>=M.JORNADAS[i-1].acto);});
 for(const a of [1,2,3,4,6,7,8,9,10,11])assert.equal(M.JORNADAS.filter(j=>j.acto===a).length,2,'acto '+a);
 for(const j of M.JORNADAS)assert.ok(M.ROMANO_ACTO[j.acto],'acto '+j.acto+' con número');
 for(const [a,n] of Object.entries(M.INICIO_ACTO))assert.equal(M.jornada(n).acto,+a);
 // Lo alto trae cosas nuevas: la marea y las estrellas fugaces.
 assert.ok(M.jornada(15).marea>0&&M.jornada(17).fugaces>0&&M.jornada(19).marea>0&&M.jornada(19).fugaces>0);
});

test('la curva: la historia sube de jornada en jornada; después del Sol los jefes vuelven en fase 2 y 3',()=>{
 const ol=M.JORNADAS.filter(j=>j.tipo==='oleada');
 for(let i=1;i<ol.length;i++)assert.ok(ol[i].fuego>=ol[i-1].fuego-0.2,'fuego jornada '+ol[i].n);
 // La primera oleada sigue siendo la más amable.
 assert.ok(ol.every(j=>j.n===1||j.fuego>M.jornada(1).fuego));
 assert.equal(M.dificultad(5),1);assert.equal(M.dificultad(20),1);
 assert.ok(M.dificultad(40)>M.dificultad(30));
 assert.equal(M.dificultad(500),2.4);
 // El sin fin recorre los nueve actos de pelea en bloques de dos (oleada y jefe).
 const ciclo=M.CICLO_SINFIN.length*2;
 assert.deepEqual([21,22].map(n=>M.jornada(n).tipo),['oleada','jefe']);
 assert.deepEqual([22,24,26,28,30,32,34,36,38].map(n=>M.jornada(n).jefe),['nodriza','faro','esfinge','casco','crisalida','hoguera','luna','constelacion','sol']);
 assert.ok([21,23,25].every(n=>M.jornada(n).acto===5));
 assert.equal(M.jornada(22).fase,2);assert.equal(M.jornada(22+ciclo).fase,3);assert.equal(M.jornada(22+3*ciclo).fase,3);
 assert.ok(M.vidaJefe(M.jornada(22+ciclo))>M.vidaJefe(M.jornada(22)),'el jefe vuelve más fuerte');
 assert.ok(M.vidaJefe(M.jornada(22))>M.vidaJefe(M.jornada(2)),'la fase 2 es más dura que la primera vez');
 assert.ok(M.vidaJefe(M.jornada(20))>M.vidaJefe(M.jornada(4)),'los jefes crecen con la jornada');
 for(let n=1;n<300;n++){const j=M.jornada(n);if(j.tipo!=='oleada')continue;
  assert.ok(j.balas<=12&&j.cols<=11&&j.filas.length<=6&&j.fuego<=4&&j.apunta<=0.75&&j.picada<=0.6,String(n));
  for(const v of Object.values(j.vida||{}))assert.ok(v>=1&&v<=(n>M.JORNADAS_HISTORIA?8:4),'vida en la '+n);}
 assert.ok(M.jornada(21+2*ciclo).vida.a>M.jornada(21).vida.a,'el sin fin se endurece');
});

test('los augurios: uno por jornada, fijos, y cada jornada un poco más dura que la anterior',()=>{
 assert.equal(M.augurioDe(1),null);
 assert.equal(M.augurioDe(2),'rafaga');assert.equal(M.augurioDe(10),'rafaga');assert.equal(M.augurioDe(9),'coraza');
 assert.equal(M.nivelAugurio(2,'rafaga'),1);assert.equal(M.nivelAugurio(9,'rafaga'),1);assert.equal(M.nivelAugurio(10,'rafaga'),2);
 assert.equal(M.nivelAugurio(8,'coraza'),0);assert.equal(M.nivelAugurio(9,'coraza'),1);
 for(const a of M.AUGURIOS)assert.ok(R.AUGURIOS[a],'texto del augurio '+a);
 // Lo mismo dos veces es lo mismo: no depende de la partida.
 assert.deepEqual(M.jornada(37),M.jornada(37));
 // La jornada 1 queda como estaba; la 11 dispara más que en la tabla.
 assert.equal(M.jornada(1).fuego,M.JORNADAS[0].fuego);
 assert.ok(M.jornada(11).fuego>M.JORNADAS[10].fuego);
 // La coraza endurece primero a las grandes.
 assert.equal(M.jornada(9).vida.c,(M.JORNADAS[8].vida.c||1)+1);
 // Los jefes atacan más seguido y las escamas caen más rápido con las jornadas.
 assert.ok(M.jornada(30).furia>M.jornada(8).furia&&M.jornada(30).velEscama>M.jornada(3).velEscama);
});

test('el taller: una brasa por nivel, tres niveles, evoluciones cada tres y el arma que sale de eso',()=>{
 const est={mej:M.mejorasVacias(),brasas:4,llamas:3};
 assert.equal(M.compra(est,'c'),null);assert.equal(M.compra(est,'c'),null);assert.equal(M.compra(est,'c'),null);
 assert.match(M.compra(est,'c'),/máximo/);
 assert.match(M.compra(est,'z'),/desconocida/);
 assert.equal(M.compra(est,'o'),null);assert.equal(est.brasas,0);
 assert.match(M.compra(est,'b'),/sin brasas/);
 assert.equal(M.evolucion(est.mej,'arma'),1);assert.equal(M.evolucion(est.mej,'nave'),0);
 assert.equal(M.llamasMax(est.mej),6);
 // Encender una llama: solo si cabe.
 const ll={mej:M.mejorasVacias(),brasas:3,llamas:5};
 assert.match(M.compra(ll,'l'),/llenas/);ll.llamas=2;assert.equal(M.compra(ll,'l'),null);assert.equal(ll.llamas,3);assert.equal(ll.brasas,1);assert.match(M.compra(ll,'l'),/faltan/);
 // El arma sin nada es la de siempre; llena, todo crece.
 const a0=M.armas(M.mejorasVacias()),a4=M.armas({cadencia:3,fuerza:3,perfora:3,abanico:3});
 assert.deepEqual([a0.cool,a0.danoN,a0.danoA,a0.perfN,a0.perfA,a0.patron.length,a0.tope],[0.16,1,2,0,1,1,2]);
 assert.equal(a4.evolucion,4);assert.ok(a4.chispas&&a4.rayo);
 assert.ok(a4.cool<a0.cool&&a4.danoA>a0.danoA&&a4.patron.length===4&&a4.perfN===2);
 const n4=M.nave({remo:3,vidrio:3,aceite:3,iman:3});
 assert.equal(n4.evolucion,4);assert.equal(n4.luciernagas,2);assert.ok(n4.campana&&n4.regenera>0&&n4.pulso>0);
 assert.equal(M.llamasMax({aceite:3,remo:3,vidrio:3,iman:3}),M.LLAMAS_TOPE);
 // Cada código es de una sola mejora, y los textos existen.
 assert.equal(new Set(M.LISTA_MEJORAS.map(k=>M.MEJORAS[k].codigo)).size,8);
 assert.ok(!M.POR_CODIGO[M.CODIGO_LLAMA]);
 for(const k of M.LISTA_MEJORAS){assert.ok(R.MEJORAS[k]&&R.MEJORAS[k].d.length===M.MEJORAS[k].max,k);}
 for(const r of ['arma','nave'])assert.equal(R.EVOLUCIONES[r].length,M.EVOLUCION.length+1);
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
 assert.equal(M.puntosPolilla(5,'a',1,false,2),48);           // 40 × 1,2 en la segunda vuelta
 for(const a of [6,7,8])assert.ok(M.PUNTOS[a].c>M.PUNTOS[3].c,'la otra orilla paga más: '+a);
 for(const j of ['casco','crisalida','hoguera','luna','constelacion','sol'])assert.ok(M.PUNTOS_JEFE[j]>0&&M.VIDA_JEFE[j]>0,j);
 const b=M.bonusJornada({acto:2,sinDanio:true,disparos:10,aciertos:5});
 assert.deepEqual(b,{sinDanio:1000,precision:500,total:1500});
 assert.equal(M.bonusJornada({acto:1,sinDanio:false,disparos:0,aciertos:0}).total,0);
 assert.equal(M.llamasGanadas(29000,31000),1);
 assert.equal(M.llamasGanadas(0,160000),3);
 assert.equal(M.llamasGanadas(150000,260000),1);              // solo 250 000: 150 000 ya estaba
 // La primera parte perfecta queda lejos del tope del ranking.
 const pol=M.JORNADAS.slice(0,M.JORNADA_ALBA).reduce((t,j)=>t+M.polillasDe(j),0);
 assert.ok(pol*M.puntosPolilla(3,'c',8,true,0)+8000<1000000);
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
 // El punto de control lleva las mejoras y las brasas (limpias), y la Hoguera vista no se olvida.
 const p=M.mezclaProgreso({hoguera:true,punto:{j:14,puntos:5,llamas:7,at:3,mej:{aceite:2,remo:9,trampa:3},br:4}},{hoguera:false});
 assert.equal(p.hoguera,true);assert.equal(p.punto.mej.aceite,2);assert.equal(p.punto.mej.remo,3);assert.equal(p.punto.mej.trampa,undefined);
 assert.equal(p.punto.br,4);assert.equal(p.punto.llamas,7);
});

test('el relato: textos completos, en orden, y las cartas no se adelantan',()=>{
 assert.equal(R.BITACORA.length,M.JORNADAS_HISTORIA);
 R.BITACORA.forEach((t,i)=>assert.ok(t.startsWith('Jornada '+(i+1)+'.'),t));
 assert.equal(R.FRAGMENTOS.length,25);
 for(let i=1;i<R.FRAGMENTOS.length;i++)assert.ok(R.FRAGMENTOS[i].acto>=R.FRAGMENTOS[i-1].acto);
 assert.equal(R.fragmentoSiguiente([],1),0);
 assert.equal(R.fragmentoSiguiente([0,1,2,3],1),-1,'el acto I solo deja leer las suyas');
 assert.equal(R.fragmentoSiguiente([0,1,2,3],2),4);
 assert.equal(R.fragmentoSiguiente([...Array(13).keys()],4),-1);
 // Cada acto tiene Mensajeras suficientes para todas sus cartas.
 assert.equal(R.fragmentoSiguiente([...Array(13).keys()],6),13,'la otra orilla sigue en la XIV');
 assert.equal(R.fragmentoSiguiente([...Array(19).keys()],9),19,'lo alto sigue en la XX');
 assert.equal(R.fragmentoSiguiente([],5),-1,'el sin fin no trae cartas');
 for(const a of [1,2,3,4,6,7,8,9,10,11]){const cartas=R.FRAGMENTOS.filter(f=>f.acto===a).length,cruces=M.JORNADAS.filter(j=>j.acto===a).reduce((t,j)=>t+(j.mensajeras||0),0);assert.ok(cruces>=cartas,'acto '+a+': '+cruces+' cruces para '+cartas+' cartas');}
 assert.ok(R.ECOS.length>=10);assert.ok(R.ecoSiguiente([0,1],0)===2);
 assert.match(R.bitacora(14),/^Jornada 14\. /);assert.match(R.bitacora(140),/^Jornada 140\. /);
 assert.equal(R.romano(13),'XIII');assert.equal(R.romano(4),'IV');
 assert.ok(R.REVELACION.length>=4&&R.FINAL.length>=4);
 for(const j of ['nodriza','faro','esfinge','alba','casco','crisalida','hoguera','luna','constelacion','sol'])assert.ok(R.JEFES[j].nombre&&R.JEFES[j].epiteto,j);
 for(const a of [1,2,3,4,5,6,7,8,9,10,11])assert.ok(R.actoInfo(a).nombre&&R.actoInfo(a).lema,'acto '+a);
 assert.ok(R.FINAL_HOGUERA.length>=4&&R.FINAL_HOGUERA_ORDEN&&R.AVISO_HOGUERA);
 // La Hoguera ya no cierra la historia: el Sol sí.
 assert.doesNotMatch(R.FINAL_HOGUERA_ORDEN,/SIN FIN/);
 assert.ok(R.FINAL_SOL.length>=4&&R.FINAL_SOL_CIERRE&&R.FINAL_SOL_ORDEN&&R.AVISO_SOL&&R.PARTE_TRES.nombre);
 assert.equal(R.ACTOS.at(-1).n,11);
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

test('la otra orilla y lo alto suenan distintos: escalas y compases propios e irregulares',()=>{
 const orilla=[6,7,8,9,10,11].map(a=>MU.ETAPAS[a]);
 assert.equal(new Set([1,2,3,4,6,7,8,9,10,11].map(a=>MU.ETAPAS[a].escala)).size,10,'una escala por acto');
 for(const e of orilla){const m=MU.mapaCompas(e.metrica);assert.ok(MU.METRICAS[e.metrica],e.metrica);assert.ok(m.grupos.some(g=>g!==m.grupos[0]),'grupos desiguales en '+e.metrica);}
 for(const [j,met] of [['casco','10/8'],['crisalida','15/8'],['hoguera','3+3+2']]){
  assert.equal(MU.largoMotivo(MU.leitmotiv(j,0)),MU.mapaCompas(met).largo*2,j);
  assert.notDeepEqual(MU.leitmotiv(j,0),MU.leitmotiv(j,2),j+' cambia en la última fase');
 }
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
 for(const a of [1,2,3,4,6,7,8,9,10,11])for(const t of ['a','b','c']){
  const p=S.POLILLAS[a][t];assert.equal(p.length,2,a+t);
  p.forEach((cuadro,i)=>{forma('polilla '+a+t+i,cuadro);assert.match(cuadro.join(''),/^[.abBcdef]+$/);});
  for(const papel of 'abBcdef')assert.match(S.paletaPolilla(a,t)[papel],/^#[0-9a-f]{6}$/,a+t+papel);
 }
 for(const t of ['a','b','c'])assert.match(S.paletaPolilla(5,t,2).b,/^#[0-9a-f]{6}$/);
 S.MINI.forEach((c,i)=>forma('mini'+i,c));S.MENSAJERA.forEach((c,i)=>forma('mensajera'+i,c));
 forma('fanal',S.FANAL);forma('naufragio',S.NAUFRAGIO);
 for(const [k,v] of Object.entries(S.PODERES))forma(k,v);
 S.FANAL_EVO.forEach((f,i)=>{forma('fanal evo '+i,f);assert.equal(f.length,S.FANAL.length);assert.equal(f[0].length,S.FANAL[0].length);});
 assert.equal(S.FANAL_EVO.length,S.PALETAS_FANAL.length);forma('fanalito',S.FANALITO);
 for(const a of [1,2,3,5,6,7,8]){const n=S.naufragio(a);assert.equal(n.length,S.NAUFRAGIO.length);assert.ok(n.flat().filter(Boolean).length>150);}
 assert.equal(new Set([1,2,3,4,5,6,7,8,9,10,11].map(a=>S.PALETAS[a].cielo[0])).size,11,'once cielos distintos');
 for(const k of ['COLORES_LUNA','COLORES_HERMANA','COLORES_SOL'])assert.ok(S[k],k);
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
 assert.match(reglas,/sudoku\|fanal(\|[a-z]+)*\)\$\/\)/);  // fanal en la lista de clubJugadas (puede haber juegos después)
 assert.match(reglas,/'club-fanal-travesia' \|\| \$categoria === 'club-fanal-sinfin' \|\| [^?]*\? 1000000/);
 // El juego carga sus piezas con versión, y la página tiene i18n.
 const html=fs.readFileSync(path.join(D,'index.html'),'utf8');
 for(const f of ['relato','motor','sprites','musica','juego'])assert.match(html,new RegExp(f+'\\.js\\?v=fanal-\\d+'));
 assert.match(html,/i18n\.js\?v=/);assert.match(html,/conexion\.js\?v=club-\d+/);
});
