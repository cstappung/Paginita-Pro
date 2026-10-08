/* Antitrampas de FANAL (docs/antitrampas/fanal.md).

   FANAL no se rehace cuadro a cuadro: la prueba es el registro de cada
   jornada (juegos/club/fanal/prueba.js) y el verificador recalcula con el
   motor los puntos exactos y comprueba que cada jornada pudo jugarse así.

   Aquí: un ROBOT que juega a nivel de eventos (dispara, toca polillas con
   la bala de un tiro anterior, afina sobre el pulso de la música, recibe
   golpes, toma poderes, mata jefes, cruza el Alba) y lleva los puntos por
   su cuenta, con una implementación aparte del recuento (si el juego y el
   verificador se equivocaran igual, aquí no coincidiría). Sus partidas
   —lentas, rápidas pero humanas, con muerte, desde un punto de control, en
   el sin fin— pasan; y cada vía de trampa se rechaza: resultado inventado,
   puntos inflados, tiempo recortado, prueba de otra partida o de otra
   cuenta, prueba editada, __fanal.salta / dano / acerca / limpia, tiros más
   rápidos que el fanal, cámara rápida, entradas sintéticas, y el bot que se
   vio en la tabla (26 jornadas del sin fin en 56 s). Al final, una partida
   real del juego corriendo en Chromium, y la de la versión anterior. */
const {test}=require('node:test'),assert=require('node:assert/strict'),esbuild=require('esbuild'),path=require('node:path');
const carga=(entry,extra='')=>{const mod={exports:{}};new Function('module','exports','require',esbuild.buildSync({entryPoints:[entry],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text+extra)(mod,mod.exports,require);return mod.exports;};
const V=carga('src/juegos/solo/verifica.js');
const FV=carga('src/juegos/solo/verifica/fanal.js');
const D=path.join(__dirname,'../../juegos/club/fanal');
const M=require(path.join(D,'motor.js')),FP=require(path.join(D,'prueba.js'));
const copia=x=>JSON.parse(JSON.stringify(x));

/* ---------- El robot ---------- */
function rng(s){return M.mulberry32(s);}
/* La música: pulsos de un 7/8 a 300 corcheas por minuto (0,4 0,4 0,6 s),
   como el acto I; el verificador no sabe de compases, solo mira que los
   tiros afinados caigan cerca de un pulso. */
function pulsosDesde(t0,hasta){const out=[];let p=t0,i=0;while(p<hasta){out.push(p);p+=[0.4,0.4,0.6][i++%3];}return out;}

function robot(o={}){
 const op=Object.assign({modo:'t',desde:1,hasta:13,porKill:0.7,afinados:0.5,golpes:0.3,muereEn:0,semilla:1,lat:40,id:'robotfanal01',u:'uid-robot',heredada:null,prisa:1,vuelo:null,compras:''},o);
 const r=rng(op.semilla),prueba=op.heredada?Object.assign(copia(op.heredada),{u:op.u,k:op.heredada.J.length}):FP.nueva(op.modo==='s'?'sinfin':'travesia',op.id,op.u);
 // El recuento propio (no usa prueba.js: lo hace aparte, para contrastar).
 // El taller sí usa M.compra y M.armas: son las reglas del juego, no del verificador.
 const st={pts:0,llamas:3,notas:0,taller:{mej:M.mejorasVacias(),brasas:op.modo==='s'?M.BRASAS_SINFIN:0,llamas:3}};
 if(op.heredada){const h=op.heredada.J[op.heredada.J.length-1];st.pts=h.s;st.llamas=h.v;const rh=FP.rehace(Object.assign(copia(op.heredada),{k:0}));st.taller.mej=rh.mej;st.taller.brasas=rh.brasas;}
 const suma=n=>{const a=st.pts;st.pts+=n;st.llamas=Math.min(M.llamasMax(st.taller.mej),st.llamas+M.llamasGanadas(a,st.pts));};
 const res=()=>M.resonancia(st.notas);
 let T=100,R=500000,G=0,muerto=false,completadas=op.heredada?op.heredada.J[op.heredada.J.length-1].n:0,iCompra=0;
 const base=op.modo==='s'?M.JORNADAS_HISTORIA+1:1;
 for(let n=Math.max(base,op.desde);n<=op.hasta&&!muerto;n++){
  // El taller: compra en el orden de `compras` mientras haya brasas.
  let u='';st.taller.llamas=st.llamas;
  while(iCompra<op.compras.length&&st.taller.brasas>0){const c=op.compras[iCompra];if(M.compra(st.taller,c)===null)u+=c;iCompra++;}
  st.llamas=st.taller.llamas;
  const A=M.armas(st.taller.mej);
  const j=M.jornada(n),acto=j.acto,vuelta=j.vuelta||0;
  const t0=T,reg=FP.abre(n,T,R,G,op.lat,u),pul=pulsosDesde(t0-0.9,t0+600);
  let t=t0,ult=-1,disp=0,acier=0,golpes=0,msj=0;
  // Un tiro: afinado, sobre el pulso (más la latencia); si no, lejos de él.
  // Un tiro sin afinar pierde lo que iba de la nota, como en el juego.
  const tiro=af=>{
   let x=Math.max(t,ult+A.cool+0.01+r()*0.05*op.prisa);
   if(af){const p=pul.find(p=>p+op.lat/1000-0.03>=x);x=p+op.lat/1000+(r()-0.5)*0.06;}
   else{if(!op.sinRodeo)for(let k=0;k<20&&pul.some(p=>Math.abs(x-op.lat/1000-p)<0.13);k++)x+=0.05;st.notas=Math.floor(st.notas/4)*4;}
   t=x;ult=x;disp++;return {k:FP.disparo(reg,af,x,op.lat),af};
  };
  // Lo que toca la bala: un rato después del tiro. Un acierto afinado (salvo
  // al rozar, la lumbre, el Alba o la Mensajera) sube la nota.
  const pega=(letra,b)=>{t+=op.vuelo==null?0.2+r()*0.4:op.vuelo;acier++;FP.evento(reg,letra,t,b.k);if(b.af&&'ABCORVX'.includes(letra))st.notas++;};
  const espera=s=>{t+=s;};
  const golpe=()=>{FP.evento(reg,'g',t);st.llamas--;st.notas=0;golpes++;if(st.llamas<=0)muerto=true;};
  if(j.tipo==='oleada'){
   espera(1.6+j.cols*0.06+j.filas.length*0.12);
   const lista=M.formacion(j).lista.slice().reverse();
   lista.forEach((p,i)=>{
    if(muerto)return;
    espera(op.porKill*(0.6+r()*0.8));
    const af=r()<op.afinados,d=af?A.danoA:A.danoN;
    // Las que aguantan más: roces sin afinar hasta que el último tiro alcance.
    for(let resta=p.vida;resta>d;resta-=A.danoN)pega('N',tiro(false));
    const b=tiro(af);pega('ABC'['abc'.indexOf(p.tipo)],b);
    suma(M.puntosPolilla(acto,p.tipo,res(),af,vuelta));
    if(i===Math.floor(lista.length/2)&&msj<(j.mensajeras||0)){pega('M',tiro(false));suma(M.valorMensajera(prueba.id,n,msj++));}
    if(i===5&&op.poderes!==false)FP.evento(reg,'p',t);
    if(i===8&&st.llamas>1&&r()<op.golpes)golpe();
    if(n===op.muereEn&&i===12)while(!muerto)golpe();
   });
   espera(1.3);
  }else if(j.tipo==='lumbre'){
   for(let i=0;i<24;i++){espera(0.8*op.porKill+r());if(i%2){pega('Q',tiro(false));suma(5);}else FP.evento(reg,'q',t);}
   for(let k=0;k<2;k++){pega('M',tiro(false));suma(M.valorMensajera(prueba.id,n,msj++));}
   espera(1.6);
  }else if(j.jefe==='alba'){
   espera(10);pega('R',tiro(false));suma(25*res());
   espera(Math.max(0,t0+61+r()*3-t));
   FP.evento(reg,'f',t);suma(8000+5000);                              // sin un solo tiro contra el Alba: el bonus entero
   espera(25);                                                        // el final se lee entero; la travesía sigue
  }else{
   espera(3+r());const vida=M.vidaJefe(j);let dano=0;
   if(j.jefe==='faro'||j.jefe==='hoguera')for(let k=0;k<4;k++){pega('V',tiro(true));suma(15*res());}
   if(j.jefe==='nodriza'||j.jefe==='crisalida')for(let k=0;k<3;k++){pega('O',tiro(false));suma(10*res());}
   while(dano<vida){espera(op.porKill*0.4*r());const af=r()<op.afinados;pega('X',tiro(af));dano+=af?A.danoA:A.danoN;suma(5*res());}
   FP.evento(reg,'j',t);suma(M.PUNTOS_JEFE[j.jefe]*(vuelta?1+0.25*vuelta:1));
   espera(2.3);
  }
  const fin=muerto?'m':'c';
  if(fin==='c'&&j.tipo!=='lumbre'&&j.jefe!=='alba')suma(M.bonusJornada({acto:j.acto,sinDanio:golpes===0,disparos:disp,aciertos:acier}).total);
  if(fin==='c'){completadas=n;st.taller.brasas++;}
  for(const p of pul)if(p<=t+0.15)FP.pulso(reg,p);
  const dur=t-t0;G+=dur*0.97;R+=dur*1000*1.04+3000;
  FP.cierra(prueba,reg,fin,t,R,G,st.pts,st.llamas,{b:0,d:0});
  T=t+9;                                                              // el tránsito entre jornadas
 }
 const cat=op.modo==='s'?'club-fanal-sinfin':'club-fanal-travesia',tiempo=tiempoSesion(prueba);
 return {prueba,dato:{categoria:cat,puntos:Math.min(1e6,Math.round(st.pts)),tiempo,partida:'p'},jornadas:{categoria:'club-fanal-jornadas',puntos:completadas,tiempo,partida:'p'},st};
}
/* El tiempo de juego de la sesión, como lo declara el juego. */
const tiempoSesion=pr=>Math.max(1,pr.J.slice(pr.k).reduce((s,x)=>s+x.g,0));
const verifica=(dato,prueba,ctx)=>V.verificaClub('fanal',dato,prueba).then(m=>m||FV.verifica(dato,prueba,ctx));
const conTiempo=(r)=>{r.dato.tiempo=tiempoSesion(r.prueba);r.jornadas.tiempo=tiempoSesion(r.prueba);return r;};
/* Lo que haría quien edita su prueba y la vuelve a sellar: recalcula la cadena. */
function resella(prueba){let prev=M.hashTexto('fanal|'+prueba.id+'|'+prueba.m);for(const x of prueba.J){x.h=M.hashTexto(prev+'|'+[x.n,x.t,x.r,x.g,x.e,x.p==null?'':x.p,x.f,x.s,x.v,x.b,x.d,x.u==null?'':x.u].join('|'));prev=x.h;}return prueba;}
/* Y si además ajusta los puntos de cada jornada a lo que dan sus eventos. */
function reajusta(prueba){for(let i=0;i<40;i++){resella(prueba);const r=FP.rehace(prueba),m=r.motivo&&/dice (-?\d+), dan (-?\d+)/.exec(r.motivo);if(!m)return prueba;const x=prueba.J.find(x=>x.s===+m[1]);x.s=+m[2];}return prueba;}

test('FANAL: el verificador está activo y una partida sin prueba no entra',async()=>{
 assert.equal(FV.PRUEBA,2);
 assert.match(await V.verificaClub('fanal',{categoria:'club-fanal-travesia',puntos:90000,tiempo:600000,partida:'x'},null),/sin prueba/);
});

test('FANAL: travesías honestas del robot pasan (lenta, normal y rápida pero humana)',async()=>{
 for(const [porKill,semilla] of [[2.2,1],[0.8,2],[0.32,3]]){
  const r=conTiempo(robot({porKill,semilla}));
  const rh=FP.rehace(r.prueba);
  assert.equal(rh.motivo,undefined,String(rh.motivo));
  assert.equal(rh.puntos,Math.round(r.st.pts),'el recuento del robot y el del verificador');
  assert.equal(rh.completa,true);
  assert.equal(await verifica(r.dato,r.prueba,{uid:'uid-robot'}),null,'puntos '+porKill);
  assert.equal(await verifica(r.jornadas,r.prueba),null,'jornadas '+porKill);
  assert.equal(r.jornadas.puntos,13);
  assert.ok(JSON.stringify(r.prueba).length<60000,'compacta: '+JSON.stringify(r.prueba).length);
  // Del orden de lo que hace un humano: 500–800 s y 64 000–124 000 puntos en la tabla real.
  const s=r.prueba.J.reduce((a,x)=>a+x.t,0)/100;
  assert.ok(s>240,'duración '+s);
 }
});

test('FANAL: con muerte, abandono a medias, sin fin y desde un punto de control',async()=>{
 const m=conTiempo(robot({muereEn:6,semilla:4}));
 assert.equal(m.prueba.J.at(-1).f,'m');
 assert.equal(await verifica(m.dato,m.prueba),null);
 assert.equal(await verifica(m.jornadas,m.prueba),null);
 assert.equal(m.jornadas.puntos,5);
 const s=conTiempo(robot({modo:'s',hasta:34,semilla:5,muereEn:34,compras:'cbfcbvfpbocr'}));
 assert.equal(await verifica(s.dato,s.prueba),null);
 assert.equal(s.jornadas.puntos,33);
 // Desde el punto de control del acto II (jornada 5): lo heredado viaja con él.
 const a=robot({hasta:4,semilla:6});
 const punto={v:FP.VERSION,m:'t',id:a.prueba.id,J:a.prueba.J};
 const b=robot({heredada:punto,desde:5,hasta:13,semilla:7});
 b.dato.tiempo=tiempoSesion(b.prueba);b.jornadas.tiempo=b.dato.tiempo;
 assert.equal(b.prueba.k,4);
 assert.equal(await verifica(b.dato,b.prueba),null);
 assert.equal(await verifica(b.jornadas,b.prueba),null);
 // El progreso guardado conserva la prueba del punto de control.
 const prog=M.mezclaProgreso({punto:{j:5,puntos:a.prueba.J.at(-1).s,llamas:3,at:5,pr:punto}},null);
 assert.equal(prog.punto.pr.J.length,4);
});

test('FANAL: resultado inventado, puntos inflados, tiempo recortado, otra categoría u otra cuenta',async()=>{
 const r=conTiempo(robot({semilla:8}));
 assert.match(await verifica({...r.dato,puntos:r.dato.puntos+1000},r.prueba),/puntos declarados/);
 assert.match(await verifica({...r.dato,tiempo:Math.round(r.dato.tiempo/2)},r.prueba),/tiempo declarado/);
 assert.match(await verifica({...r.dato,categoria:'club-fanal-sinfin'},r.prueba),/historia, no de la travesía sin fin/);
 assert.match(await verifica({...r.jornadas,puntos:14},r.prueba),/jornadas declaradas/);
 assert.match(await verifica(r.dato,r.prueba,{uid:'otra-cuenta'}),/otra cuenta/);
 // Una prueba de una partida corta para un resultado grande.
 const corta=conTiempo(robot({hasta:2,semilla:9}));
 assert.match(await verifica({...corta.dato,puntos:120000},corta.prueba),/puntos declarados/);
 // Un objeto cualquiera como prueba.
 assert.match(await verifica(r.dato,{v:1,m:'t',id:'abcdefg',k:0,J:[]}),/puntos declarados|no cuadra/);
 assert.match(await verifica(r.dato,{hola:1}),/no cuadra/);
});

test('FANAL: la prueba editada a mano no pasa, aunque se vuelva a sellar',async()=>{
 const r=conTiempo(robot({semilla:10}));
 // 1) Cambiar un número sin rehacer la cadena.
 const a=copia(r.prueba);a.J[2].s+=5000;
 assert.match(await verifica({...r.dato,puntos:r.dato.puntos+5000},a),/cadena/);
 // 2) Convertir tiros sin afinar en afinados (más Resonancia) y resellar con los puntos ajustados.
 const b=copia(r.prueba);
 for(const x of b.J)x.e=x.e.replace(/S/g,'T');
 reajusta(b);
 assert.match(await verifica({...r.dato,puntos:FP.rehace(b).puntos||r.dato.puntos},b),/afinado lejos de todo pulso/);
 // 3) Polillas de más.
 const c=copia(r.prueba);c.J[0].e+='A0';reajusta(c);
 assert.match(String(FP.rehace(c).motivo),/más polillas|formación/);
 // 4) Quitar una jornada del medio.
 const d=copia(r.prueba);d.J.splice(3,1);resella(d);
 assert.match(String(FP.rehace(d).motivo),/orden/);
 // 5) La marca de una partida tocada con __fanal.
 assert.match(String(FP.rehace({...copia(r.prueba),x:1}).motivo),/__fanal/);
});

test('FANAL: lo que dejan los ganchos __fanal (salta, dano, acerca, limpia) se rechaza',async()=>{
 // salta(12): la prueba empieza en la 12, sin las once de antes.
 const r=robot({semilla:11});
 const s=copia(r.prueba);s.J=s.J.slice(11);reajusta(s);
 assert.match(String(FP.rehace(s).motivo),/orden/);
 // dano(): el jefe muere sin los golpes que aguanta.
 const d=copia(r.prueba),nod=d.J[3];
 nod.e=nod.e.replace(/X[0-9a-z]\d*/g,'');reajusta(d);
 assert.match(String(FP.rehace(d).motivo),/jefe murió con 0|dos tiros a/);
 // acerca(): el Alba llega en diez segundos.
 const a=copia(r.prueba),alba=a.J[12];
 alba.e=alba.e.replace(/f\d+$/,'f10');alba.t=Math.min(alba.t,2000);alba.g=Math.min(alba.g,alba.t*10);reajusta(a);
 assert.match(String(FP.rehace(a).motivo),/Alba llegó|bala que tardó|después del cierre/);
 // limpia(): polillas apagadas sin bala ni destello.
 const l=copia(r.prueba);l.J[0].e=l.J[0].e.replace(/A([0-9a-z])/,'G');reajusta(l);
 assert.match(String(FP.rehace(l).motivo),/sin destello|no salen|no cuadra|bala/);
});

test('FANAL: tiros más rápidos que el fanal, cámara rápida, entradas sintéticas',async()=>{
 const r=robot({semilla:12});
 // Dos tiros a 5 cs.
 const t=copia(r.prueba);t.J[0].e=t.J[0].e.replace(/S(\d+)/,'S$1S5');reajusta(t);
 assert.match(String(FP.rehace(t).motivo),/dos tiros a/);
 // El reloj de juego corrió el doble que el real (requestAnimationFrame acelerado).
 const c=copia(r.prueba);c.J[1].r=Math.round(c.J[1].t/2);resella(c);
 assert.match(String(FP.rehace(c).motivo),/más rápido que el real/);
 // Teclas despachadas por un script (isTrusted falso, sin mando).
 const b=copia(r.prueba);b.J[0].b=40;resella(b);
 assert.match(String(FP.rehace(b).motivo),/sintéticas/);
 // Las del mando valen.
 const m=copia(r.prueba);m.J[0].d=200;resella(m);
 assert.equal(FP.rehace(m).motivo,undefined);
});

/* Lo que hace quien fabrica una partida a partir de otra: la misma prueba
   con el reloj apretado (cada intervalo dividido por `f`), resellada y con
   los puntos ajustados. */
function comprime(prueba,f){
 const p=copia(prueba);
 for(const x of p.J){
  x.e=x.e.replace(/([A-Za-z])([0-9a-z]?)(\d*)/g,(m,l,ref,d)=>{
   if(l==='z')return m;                                               // la latencia no es tiempo
   if('ABCNOQRVXZM'.includes(l))return l+ref+(d?Math.round(+d/f)||'':'');
   const dd=(ref||'')+d;return l+(dd?Math.round(+dd/f)||'':'');
  });
  if(x.p)x.p=x.p.split(',').map((v,i)=>i?Math.max(0,Math.round(parseInt(v,36)/f)).toString(36):v).join(',');
  x.t=Math.round(x.t/f);x.r=Math.round(x.r/f);x.g=Math.round(x.g/f);
 }
 return reajusta(p);
}
test('FANAL: el bot de la tabla (26 jornadas del sin fin en 56 s) y la travesía exprés se rechazan',async()=>{
 // Lo que se vio en la tabla: jornadas = 39 y 130 543 puntos del sin fin, con 55,98 s.
 const hon=robot({modo:'s',hasta:39,semilla:13,golpes:0});
 const seg=hon.prueba.J.reduce((a,x)=>a+x.t,0)/100;
 const bot=comprime(hon.prueba,seg/56);
 const dato={categoria:'club-fanal-sinfin',puntos:FP.rehace(bot).puntos||hon.dato.puntos,tiempo:55980,partida:'p'};
 assert.ok(Math.abs(bot.J.reduce((a,x)=>a+x.t,0)/100-56)<3);
 const motivo=await verifica(dato,bot);
 assert.ok(motivo,'tiene que rechazarse');
 assert.match(String(await verifica({categoria:'club-fanal-jornadas',puntos:39,tiempo:55980,partida:'p'},bot)),/no cuadra/);
 // Un bot que juega de verdad, pero como una máquina: dispara cada 0,17 s
 // sin esperar a nada y no falla nunca. La mecánica lo deja (cada tiro es
 // legal), el ritmo humano no.
 for(const [modo,hasta] of [['t',13],['s',39]]){
  const b=robot({modo,hasta,porKill:0,afinados:0,prisa:0,vuelo:0.05,golpes:0,sinRodeo:true,poderes:false,semilla:14});
  const m=FP.rehace(b.prueba).motivo;
  assert.match(String(m),/ninguna persona|travesía entera|cada una/,modo+': '+m+' en '+(b.prueba.J.reduce((a,x)=>a+x.t,0)/100)+' s');
 }
 // Una travesía honesta apretada a la mitad del tiempo honesto más corto (250 s).
 const h=robot({semilla:15,porKill:0.5,golpes:0}),sh=h.prueba.J.reduce((a,x)=>a+x.t,0)/100;
 assert.ok(FP.rehace(h.prueba).motivo===undefined);
 assert.ok(FP.rehace(comprime(h.prueba,sh/200)).motivo,'una travesía de 200 s');
});

test('FANAL: sospecha() marca las filas imposibles de la tabla y deja las humanas',()=>{
 assert.match(FV.sospecha('club-fanal-sinfin',{puntos:330543,tiempo:55980}),/por segundo/);
 assert.match(FV.sospecha('club-fanal-jornadas',{puntos:39,tiempo:55980}),/jornadas del sin fin/);
 assert.match(FV.sospecha('club-fanal-jornadas',{puntos:13,tiempo:20000}),/jornada 13/);
 assert.match(FV.sospecha('club-fanal-travesia',{puntos:999999,tiempo:200000}),/por segundo en una travesía/);
 for(const [c,p,t] of [['club-fanal-travesia',124000,500000],['club-fanal-travesia',64000,800000],['club-fanal-jornadas',13,500000],['club-fanal-jornadas',13,95000],['club-fanal-sinfin',60000,900000],['club-fanal-jornadas',30,700000],['club-fanal-travesia',900000,1800000],['club-fanal-jornadas',60,2400000]])
  assert.equal(FV.sospecha(c,{puntos:p,tiempo:t}),null,c+' '+p);
 // Desde el punto de control del acto IV: 90 000 puntos heredados en 100 s de sesión.
 assert.equal(FV.sospecha('club-fanal-travesia',{puntos:110000,tiempo:100000}),null);
});

/* Una partida de verdad, de la versión 2: el juego real corriendo en
   Chromium (juegos/club/fanal/index.html), jugado por un bot que lee el
   mundo con __fanal y dispara y rema con sus ganchos, sin eventos de
   entrada; el reloj real se simula al paso del juego. Compra en el taller
   (mecha corta, pabilo trenzado, aceite, vidrio: la llama y el fanal
   evolucionan), pasa la Nodriza, el Faro, la Esfinge y las lumbres, y se
   apaga frente al Alba por dispararle (lo que lanzas, vuelve). Usar
   __fanal marca la prueba con `x`; aquí se le quitó. Fue esta partida la
   que mostró que el piso de ritmo por polilla tenía que crecer con el arma
   y que la Mensajera pendiente cruzaba durante el jefe siguiente. */
const REAL={"datos":[{"categoria":"club-fanal-travesia","puntos":103076,"tiempo":267617},{"categoria":"club-fanal-jornadas","puntos":12,"tiempo":267617}],"prueba":{"v":2,"m":"t","id":"0otr41z08gfeqv1tl3","u":"local","k":0,"J":[{"n":1,"t":4863,"r":4863,"g":48617,"e":"z32T2S16T17S17S50S50A110S6T17S17C246SA114T3S17S16C164TS16T17S17S16S17A315T2B43S13C164B011SS17T17T16B322TC155S23T22A135TA122A16SB067TS17T16A140TA117A15SB145S33T22T78S17T17T16A055A05ST17S17T16A310S7S17T16S50A15A15T7S17B231TA060B05TS17B152A01TC24T13S83T17A142SS16T42S58T42S58B14B15T8C155SS45S55S45S55S45A110T7B143TM143T14B18T35T57T43S57T43B115S2T83S17T16T67T33T67T33B055B05TS17S83S17T17S66T17S17T83S17B060ST23C063S14S23T77T23T77T23S77T16T17S83T17S17T16T50T50T50S50S50T50S50T50S50S50T50T50T50T50B15C15S7B137C15TT96","p":"2q,14,14,1o,14,14,14,1o,13,13,1n,13,13,1m,12,11,1l,11,11,1j,10,10,1h,z,y,1g,y,y,1g,y,y,1e,x,x,1d,x,w,1b,v,v,19,v,u,19,u,u,19,t,u,19,t,u,17,t,s,18,t,s,18,s,t,16,s,s,16,s,s,15,s,s,16,r,r,16,r,s,15,r,s,15,r,s,15,r,q,15,q,r,15,q,r,14,r,r,14,r,r,13,q,r,13,q,q,14,q,q,13,r,q,13,q,q,14,q,q,13,r,q,13,q,r,13,q,q,14,q,q,13,q,r,13,q,q,14,q,q,13,q,p,12,p,p","f":"c","s":1838,"v":3,"u":"","b":0,"d":0,"h":"3j6vj85904"},{"n":2,"t":2267,"r":2267,"g":22650,"e":"z32T2S15S15T15S15S15S40S45A115ST15A230TS15B35S10B310C35TS15A315SA315ST15S15B325TS15A220TS15C330T20A110S5T15B235B25TB210S5B28B23S4A226B25TC232TC210S5B215B25TS15S15S35T15S50B23B110S2B22T13S15T15C412T3C247SB26C25S4C210T5C31S14A310T5S15T15C155ST15S15T15T70T15T15T15C158T12S15T15A053B05ST15S15S70C13T12S15A137B15SS28T22T15B225SC231T29T15S25T15T15C310S20T15S15C35S35C215T30S15T40B25C25T5C213T2B223T47T15T15S15C231C27TS43T57","p":"b,12,p,p,19,14,14,1o,14,14,1n,12,13,1l,12,11,1j,10,z,1f,y,x,1f,w,x,1c,w,u,1a,u,u,19,u,u,19,u,t,19,u,t,17,t,t,17,s,t,16,r,s,15,s,r,15,r,r,14,q,r,13,p,q,12,q,p,12,p,p","f":"c","s":4067,"v":3,"u":"c","b":0,"d":0,"h":"1kdufvgqciq"},{"n":3,"t":3528,"r":3528,"g":35266,"e":"z32T2S13S13T74T13S13T14A228A25SA28S5A214TB35T8S13T14A41T12S13S34S13C47A21S5T14A228ST13B224B25ST16A210A25SS14B320TC331A17TS13B212B25ST13A224SC410T23B210C27SC228SC227A13SS13S14B311T2A227TA218SB143B15SS14C211T2S13T14C416ST14A311T2S13B44B45S5T13A310g2A33SS37C220S1C32S12T13B312T1S14T13S13B47B45T2A41A134ST13C225T27T13S22T13T27T38T35A117T10C25S8T60T27S13T13T47S40T13T47C25T8C210T30B27C25S2T46C27C23T4S40g11T2T33S14C216T37T33T14S53S33T14S13B15T35M233TS27T40T33B115B15ST14S13T13S40T20S40S40T20T40T40T20T40T40T20S40T40S20S40T40T20T40S40T14S13T33T14S40B18T38T14S40T46C110T4T13S13T74S13T13C229T83T13T14","p":"e,11,p,p,1t,14,14,1o,13,14,1m,13,12,1l,12,10,1j,z,z,1g,y,x,1e,x,w,1c,v,v,1a,u,u,18,t,t,16,t,s,17,t,s,16,s,s,16,t,s,16,s,s,15,r,r,14,r,q,14,q,r,13,q,r,13,r,q,13,q,q,13,q,q,12,q,q,12,q,q,12,q,p,13,q,p,13,p,q,13,p,q,12,q,q,12,q,q,12,q,p,12,q,p,12,p,p,12,p,q,11,p,p","f":"c","s":6222,"v":1,"u":"c","b":0,"d":0,"h":"1n0whxhq794"},{"n":4,"t":3293,"r":3293,"g":32917,"e":"z32T10S12S11S12S77S11T12S77S11T12S77S11T12T12S11X424TX235X110TS11X212SS12T20X236TX212SX220S32S11S12T12S11S12T12T11S12S53T35S12S12S41T12S35S12X221T32X115SS12T11S12O410X48T32X27X111ST20X230O05X114TS13X27T31S15X32T32X220X116TS15S12X37S5T25T36T39S25T36S15T24X230X115TS16X27T32X213X117TT15X223X130S2S11X22T17T11S12S12T11S12X335TX223X112ST18X215T32X23S9X210S31O222O22O23SS32S11S30T27S43O14T8S12S11T22S67X13S8T22X237TX210S1O24X216O020SS12X35O113ST19T28X140T13X115S4S11T17T53T30S17T53S12S12T11S22X237ST41S12S12X33T8X245TX212SX212T31X214X111ST20X224jS31S25T20S55T25S20","p":"d,11,p,p,1t,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o,14,14,1o","f":"c","s":9455,"v":1,"u":"c","b":0,"d":0,"h":"d6hdfers3y"},{"n":5,"t":1798,"r":1798,"g":17967,"e":"z32T2S11T12T12S11S12T12S11S12T30T12A146A15B17SA12A15B15ST18A228TA217C35SB225B2C25A17A16B15S2B23C24A13S2B28T3B247TC310S2S30S11T12B43B44C46TA234TA33S8A34B36B35C35S22T13B32B33C35S35S42T13S12S33S42T12S11S35p15TT39S11A25A25B210A129T1T39S11A142T8S39T11T12B32B35C35S26T50A12A15S5T12S76T12T12T11S77T12T11T77T12S11T12S77T11S12T12B241C24T70T11S12","p":"u,1o,14,14,1o,14,19,19,17,16,14,12,12,11,11,z,y,w,x,x,x,w,x,x,w,x,x,v,v,w,v,v,u,u,u,u,t,t,t,t,t,t,u,t,t,t,t,t,t,t,t,t,t,t,s,t","f":"c","s":16135,"v":1,"u":"b","b":0,"d":0,"h":"pm2ha5ikbi"},{"n":6,"t":1282,"r":1282,"g":12800,"e":"z32S2T11T12S12S11T54T11S24A225A2B25A15A1C25B11B1B15B1B1SC24C25A13B17TN210S1T24B311B3TB45N44A33SB47A35B4C43C45B227C25T1C32C27T3S12N33S8T12A323B37B35A22TA210S1N42S10B32N4T10C41C45S5N342B110B15C13TN117ST12C248T5C27B18S3C25S7T12S11B414C43C45C4TS38T20S12S30T38T32N23T9T45C211TT32T57S11T32C227T30T11S12T20C240T67S11T20","p":"1,t,s,t,s,1a,19,1a,19,16,15,12,11,10,10,y,x,w,w,w,w,v,u,u,t,t,u,t,t,u,t,t,t,t,t,t,t,s,t,t,s,t,s,t","f":"c","s":33650,"v":2,"u":"b","b":0,"d":0,"h":"11mtll7gwd8"},{"n":7,"t":1108,"r":1108,"g":11066,"e":"z32S2T11S12S12T65S11S12T12T11A47A42A43A37B311A22TA35A25A2A22A25B25B2SB33A22B3C33B23B22C28C25T9A23S8B32C35A22A23C3C3SB312S8A312A35B35B33B32C33C32C33C32TB28B2S3A212N3TT12N41N42S8C427A22B33B32SA31B217N122TT11S12C310T2B328T37N16C15C1TS12T12S11A49B410B41C44C45N218T7S11T24T11C324C35N31S24T11T34S11S55C115TS19T11T32S38T19S11C34T66T39","p":"n,t,s,s,11,1a,19,1a,18,15,12,11,y,x,x,w,v,w,v,v,v,t,t,u,t,t,t,t,t,t,s,t,t,s,t,s,t,s","f":"c","s":53570,"v":2,"u":"b","b":0,"d":0,"h":"18sktj8aops"},{"n":8,"t":1442,"r":1442,"g":14400,"e":"z32S3T12S12S11V340V212V32V28S15S12T11S77T12T11V247TV38V34SV33V33T24S11V315X34S28X213X2X114X1TS15X231X2TX227X2X115X1TT12X220X2T26V212X23X2X112X1T15S12X220X2S26X214X2X111X1TS17X230X2TX225X2X117X1TT11V214X25X2g23T5V210X23X2X112X1T17S11V214X25X2S28X213X2X112X1TS17X230TV221X24X2V113SX23T12V217X21X2T29X211X2SX215X2S27X220X2X112X1TS15X226X2TX232X2X115X1TT12X215X2jT26T47S12S41","p":"p,s,t,s,11,19,1a,19,1a,19,1a,19,1a,19,19,1a,19,1a,19,1a,19,1a,19,1a,19,19,1a,19,1a,19,1a,19,1a,19,1a","f":"c","s":61200,"v":1,"u":"o","b":0,"d":0,"h":"3lofmvskuq"},{"n":9,"t":1133,"r":1133,"g":11317,"e":"z32S2T11S12S12S11T54S23S12T11A314A3A35A216B210SA27S5A23A2A24B3B25B21B25S2N33T9S11A410A310B4SC54N51A312N4SA45S15A32A35B36B219SB36S5B35B35S2N45N4S7B41N410A225SB39A26SA27N37ST25N323SB35B218SB227S2N31C3C224N2SS11B37S28A215S14N31N3S10N32C3S23N310C3S25N35C210S14C211SS25T64S11S25S37S27B25S6T25N39C228SC212T38S52","p":"k,1a,19,19,1a,19,n,1q,2c,3v,2l,3v,3v,3u,2l","f":"c","s":70290,"v":1,"u":"o","b":0,"d":0,"h":"wytqpvb61k"},{"n":10,"t":1143,"r":1143,"g":11417,"e":"z32S2S11S12T12S11T54S11S24S11B319A25A2A2A120A1SA111TA25N39SN311S20A29N3A21N34B25B21B2A14B2B21B2B2TA22N33N3N22C33S2S18B310S2N42N41N4T9A41A44A41B45B4B44N46N4C4N45N4C4SB42B4S10A35T7A35A35C43B35SC47N4N45N4S20N31B210S4B31A25C3N3A24A2T1C42N4S20S15N225N33S9B210T13B22S10C236SC35B212N25T7N25C25N2S13T12C235N2C2N21N24C2N2C2C118TC112TS30C143T15S12T30S11C232T15T12T30C223S35C112TS30S38","p":"m,35,1r,1q,16,1p,1m,1j,x,1c,1a,19,u,18,17,17,s,15,14,14,r,14,14,14,q,13,13,13","f":"c","s":92761,"v":2,"u":"o","b":0,"d":0,"h":"niz8dx8dn4"},{"n":11,"t":2703,"r":2703,"g":27016,"e":"z32T2T11S12T77S11S12S77S11T12X243TX215X115S4S11T12X38X234SS11X214S21S12X38X212X2S22S11X32X3X212X2TS33X38X3X212X2SX213X2S25X29X2S3X217X2T5X233SX212X121TX134ST11X222SX233TX134SS11T22S33T34S11S55T34S11S12X242T1X210S2X210S12T21X310X3X212SX223TX222X2X122SX23T8X212X2S33S44S11S45X217X2SX25X2S22X21X2X19X1S1X112X1X1SX15X1X1X07X0X0X0SX05X0X0X0T6X02X0X0X0X0X0T10S15S73X110X1S2T12X223X2SX25X2X17X1X011X0X0TX012X0X0X0X0g12S6T24X321S25X29S3X215T3S24X315X130S13X17X1T5T11S19S70S11T19S25X141X1T4T30S25X211S10X220T4X221X2S9X213X2SX223X130SS12X22X2T20X233X2TX212X2jS21T32S33T29S31T34S28S32T33S28S32","p":"o,13,13,y,1r,1q,1r,15,1r,1q,1r,15,1r,1q,1r,16,1q,1r,1q,16,1q,1r,1q,16,1q,1r,1q,16,1r,1q,1r,15,1r,1q,1r,15,1r,1q,1r,16,1q,1r,1q,16,1q,1r,1q,16,1q,1r","f":"c","s":102856,"v":1,"u":"v","b":0,"d":0,"h":"249bi91jwox"},{"n":12,"t":1717,"r":1717,"g":17150,"e":"z32S2S11S12Q217TQ131Q022T7T11S29Q115Q13S42S11S29Q043SQ17S10S11Q219T10Q21Q040S2T28S29S43S28Q120TT12Q050T18S20S12Q27Q040SM38S13S20Q127SS32Q116S5S20S59S21S20Q24S8Q23Q25Q039TS21Q114S6S59S21S20Q120TS39S41S20S39Q038ST12T11T77S12S11S77S12S11Q210S2S77S11S12","p":"e,1r,1q,1w,1v,28,29,29,3d,28,29,29,3d,28,29,29,3d,28,29,28,3d,29","f":"c","s":103076,"v":1,"u":"v","b":0,"d":0,"h":"1svrcmb0pys"},{"n":13,"t":765,"r":765,"g":5034,"e":"z32S2S11S12Z267Z2SZ211Z2TZ212Z2TZ267TS21Z22Z22S8Z258T9Z211Z2SS22S67Z21S10Z212TZ267SZ31S20g10","p":"7,29,1t,1e,23,1e,1e,1e,23,1e,1e,29,4m","f":"m","s":103076,"v":0,"u":"v","b":0,"d":0,"h":"131l7ftzowo"}]}};
/* La partida real de la versión 1 (antes del taller): ya no cuadra con
   estas reglas, y se rechaza como de otra versión (caché, no trampa). */
const REAL_V1='{"datos":[{"categoria":"club-fanal-travesia","puntos":9268,"tiempo":183803},{"categoria":"club-fanal-jornadas","puntos":2,"tiempo":183803}],"prueba":{"v":1,"m":"t","id":"1ow5v311ncy9620mf6","u":"uidprueba","k":0,"J":[{"n":1,"t":5233,"r":6831,"g":52279,"e":"z32T22S31S35S50T24S31A129A15S10C136S10S55A15S27T23S19A223T5T97S20T116S24S43B22B25T26S19S31A29A25S18B137T16A15T25A134B035B05T10S20T31A057SA17T26B134T26B112C15S23S65C112T10B067B03S18S60S32M088T3T35T29S68T55S57T63S55T25S52T50S51S57B112T8T104S18T90S28S108T19C071S24T21T102S35T20T25T90T28C072T5A050A05S28S52A13T17T25A125A17S21T47T77T31S84S31A117T15C135S12B116B040TT37C132B026T25S24S23T62S48T65S28T45B055SB15S25S74S23T25T20T90S22S35B25C23T15T110T40T25C138A05A07T13S17T112S35T108T28B125B15S7","p":"1e,1s,1o,14,14,1o,14,14,1n,14,13,1n,12,13,1n,13,13,1m,12,13,1l,11,11,1j,10,10,1h,10,z,1g,x,y,1f,x,y,1d,w,x,1d,x,x,1d,x,x,1d,x,w,1e,w,x,1d,x,x,1d,x,x,1c,x,w,1d,w,w,1d,w,x,1c,x,w,1c,w,w,1c,w,w,1c,w,w,1c,w,w,1b,v,u,1a,u,u,19,u,u,18,u,u,19,u,t,18,s,t,17,s,s,15,s,s,16,r,s,16,s,r,16,r,s,14,r,s,14,r,s,14,r,r,14,r,q,14,r,q,14,q,p,13,p,q,12,q,p,13,p,q,12,p,p,12","f":"c","s":2010,"v":3,"b":0,"d":0,"h":"vkno3dz7i9"},{"n":2,"t":7121,"r":8924,"g":71179,"e":"z32T30S25S28S47S55T27T31A129B15S15T55T45S21A060T22S22S30S56A14T25B138S17T75S23S33S74T41B125S9B130C110S8T65C18S17C153T22T32S30T25S56S55B17T17T36C215S7C075S21T39S25S23A132T11S29A128T45C13T25A054B06S2S22B143T8B114T10S18T35B123T24T30C138C15S22S35A118S15T27T35T75S28B128B15T7T78T34S70T50C115S6p52B03T12S37S23T82S30T18C217B123T23S52C117S10S31C130T27T43g42S43S29T26B129C15T6A17B15T17B126C15T5A19B15B16C14T6S20A045T19T23T20T95S28S25T100T32B050T53T32S72T28S72S60T48T63T42T27T51T32T33S74T56T57T58T32T30S82T25S76T32T97T30T98T27T33T90T28C129g61T2S25S90S33T32S23T42S62T43C057TC056T9T63T57B045C06S27T17T105S16S32T28T82T18S17T93S32S80T27S95T23S35C050T13T75","p":"w,2p,14,14,1o,14,14,1o,13,14,1o,13,14,1n,14,13,1n,13,13,1n,13,13,1m,13,12,1m,11,12,1l,11,12,1k,12,11,1k,11,10,1j,11,11,1i,10,10,1h,z,z,1f,z,y,1f,x,y,1d,x,x,1e,w,x,1d,w,x,1c,w,x,1c,w,w,1b,w,v,1b,w,v,1b,v,v,1a,u,u,1a,u,u,1a,u,u,18,t,r,15,r,r,14,r,r,15,r,r,14,r,r,14,r,r,14,q,r,14,r,q,14,r,q,14,r,r,14,q,r,14,q,r,14,r,q,14,r,r,13,r,r,14,q,r,14,r,q,14,r,q,14,r,r,14,q,r,14,r,q,14,r,q,14,r,q,14,q,q,14,q,r,13,r,q,13,r,q,14,q,q,13,q,q,12,q,q,12,q,p,12,p,p,12,p,q,12,p,p,12,p,q,11,q,p,12,p,p,12,q,p,12,p,p,12,p,p","f":"c","s":4888,"v":1,"b":0,"d":0,"h":"1uqyjjy4ka0"},{"n":3,"t":6296,"r":7913,"g":60345,"e":"z32S28S22S27T26A130T12A118T74S31B067S18T34S21C220S12T20A135T23A14S60C18C17S11S22S38A120T9A123SB145C15ST17C211S15A132B13T7A053T5B110S7B063T5S27B140C13T5B112S8T85T25S24S30S21C155S7S60T48T39S35S41C129S3S85T18A135S10S25S37A112S19S87S23S87S38S55T47T33M27T35B120C15T27B16C114S20T41B120S19B055T5T18T97T45T68C12S55C16C15S15T75S52T78S32S30B125A017SS26S45T55A040A05S10S25S50T39T30S23A122B13T3C137S13C110T55S39S70T53S77S40T73S28T75S25T24S85T26T30S32T83S25T77S25T83S22S98T32S77T31A037B03T14S20B043T28S25T84S21S97T25T93S17T115T30B15S83S35T54S33S77S36C110T10S40T20A14S21T102g32","p":"k,1s,1g,1o,14,14,1o,14,14,1n,14,14,1n,13,13,1m,13,13,1l,12,11,1k,10,10,1j,10,z,1h,z,z,1h,z,10,1g,z,z,1g,z,z,1g,y,z,1f,z,y,1f,y,y,1f,y,y,1f,y,y,1f,y,y,1d,x,x,1d,w,x,1c,x,w,1c,w,w,1c,v,w,1b,w,v,1b,w,v,1b,v,v,1a,v,u,1a,u,v,19,u,u,18,u,t,18,t,u,18,t,t,18,u,t,18,t,u,18,t,t,18,u,t,18,t,t,18,u,t,18,t,u,18,t,t,18,u,t,18,t,u,17,t,t,16,t,s,17,t,s,17,t,s,17,t,s,17,t,s,17,s,s,17,s,s,17,s,t,16,s,s,16,s,s,16,r,s,3p,2h","f":"m","s":9268,"v":0,"b":0,"d":0,"h":"x3ysq6vg2l"}]}}';
test('FANAL: una partida real (Chromium, el juego de verdad) pasa, y editada no',async()=>{
 const {datos,prueba}=REAL;
 for(const d of datos)assert.equal(await verifica({...d,partida:'p'},prueba,{uid:'local'}),null,d.categoria);
 const r=FP.rehace(prueba);
 assert.equal(r.puntos,datos[0].puntos);assert.equal(r.completadas,12);assert.equal(r.muerto,true);
 assert.ok(M.evolucion(r.mej,'arma')>=2&&M.evolucion(r.mej,'nave')>=2,'evolucionó el arma y el fanal');
 // Todos los tiros sin afinar convertidos en afinados: lejos del pulso que sonó.
 const b=copia(prueba);for(const x of b.J)x.e=x.e.replace(/S/g,'T');reajusta(b);
 assert.match(String(FP.rehace(b).motivo),/afinado lejos de todo pulso/);
 // Mejoras que no se pagaron: una compra de más antes de la primera jornada.
 const c=copia(prueba);c.J[0].u='c';resella(c);
 assert.match(String(FP.rehace(c).motivo),/compra imposible/);
 // Un récord inflado con la prueba real.
 assert.match(await verifica({...datos[0],puntos:datos[0].puntos*3,partida:'p'},prueba),/puntos declarados/);
 // La de la versión 1.
 const v1=JSON.parse(REAL_V1);
 assert.match(await verifica({...v1.datos[0],partida:'p'},v1.prueba,{uid:'uidprueba'}),/otra versión/);
});
