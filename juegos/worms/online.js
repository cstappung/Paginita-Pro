/* Circuit Breakers en línea.

   La simulación es determinista (engine.js), así que lo que viaja no es el
   dibujo sino lo que hace quien juega: cada paso de 1/60 s el que tiene el
   turno anota sus cambios (puntería, arma, teclas, salto, disparo) y cada
   300 ms los manda en un trozo a `vivo/<pid>`. Los demás los reproducen sobre
   la misma partida y ven lo mismo casi en directo.

   Al acabar el turno quien lo jugó publica una foto del estado como jugada
   del registro (`turno`), y esa foto — no lo que cada uno simuló — es la que
   todos cargan antes del turno siguiente. Dos navegadores pueden discrepar en
   el último decimal de un seno, y así esa discrepancia dura un turno como
   mucho. La primera foto de cada turno es la que vale, igual que en motor.js.

   Si el que juega desaparece (pestaña cerrada, red caída) los demás siguen
   solos sin entradas: el reloj del turno se agota, y el primero de ellos en
   llegar a la espera escribe la foto por él. Nadie queda colgado. */
(function(root){
'use strict';
const CB=root.CB,STEP=CB.STEP;
const HIJO='worms-child',PADRE='worms-parent';
const pad=(n,l)=>String(n).padStart(l,'0');
const claveTrozo=(k,n)=>'k'+pad(k,5)+'c'+pad(n,4);
const q2=v=>Math.round(v*100)/100,q1=v=>Math.round(v*10)/10;
const lista=x=>Array.isArray(x)?x:Object.values(x||{});

CB.Online=function(hooks){
 const post=(tipo,datos={})=>{try{root.parent.postMessage({canal:HIJO,tipo,...datos},location.origin);}catch{}};
 let cfg=null,jug=[],yo='',miEquipo=-1,game=null,T=null,arrancado=false,tieneTurnos=false,tieneVivo=false;
 const entradas=new Map(),vistos=new Set(),abandonos=new Set(),trozos=new Map(),cacheHuecos=new Map();
 let cabecera=null;

 /* Los cráteres viajan como delta (ver exportState): los del final del
    turno k son los del k-1 recortados a `hb` más los nuevos `hn`. */
 function huecosTras(k){
  if(k<=0)return[];if(cacheHuecos.has(k))return cacheHuecos.get(k);
  let j=k-1;while(j>0&&!cacheHuecos.has(j))j--;let h=j>0?cacheHuecos.get(j):[];
  for(let i=j+1;i<=k;i++){const e=entradas.get(i);if(!e)return null;h=h.slice(0,e.st.hb|0).concat(e.st.hn||[]);cacheHuecos.set(i,h);}
  return h;
 }
 function registraTurno(t){
  if(!t||vistos.has(t.idx))return;vistos.add(t.idx);const k=+t.k;if(!(k>0)||entradas.has(k))return;
  let st;try{st=typeof t.s==='string'?JSON.parse(t.s):t.s;}catch{return;}if(!st||!Array.isArray(st.un)||!Array.isArray(st.te))return;
  entradas.set(k,{uid:t.uid,st,at:performance.now()});
 }
 function registraTrozo(i,s){let c;try{c=typeof s==='string'?JSON.parse(s):s;}catch{return;}if(c&&c.k>0)trozos.set(i,c);}
 function eliminaEquipo(uid){const e=jug.findIndex(j=>j.uid===uid);if(e<0||!game)return false;let hubo=false;for(const u of game.units)if(u.team===e&&u.hp>0){game.eliminate(u);hubo=true;}return hubo;}
 function registraAbandono(uid){
  if(!uid||abandonos.has(uid))return;abandonos.add(uid);if(!arrancado)return;
  const e=jug.findIndex(j=>j.uid===uid);if(eliminaEquipo(uid))hooks.notice((jug[e]?.nombre||'Un jugador')+' abandonó la partida.');
  if(T&&(uid===T.uid||uid===yo)){T.rec=false;if(uid===T.uid){T.libre=true;T.cola=[];T.teclas=0;}}
  hooks.hud();
 }

 function arranca(){
  jug=lista(cfg.jugadores).slice().sort((a,b)=>(a.orden-b.orden)||(a.uid<b.uid?-1:a.uid>b.uid?1:0));
  yo=cfg.yo||'';miEquipo=jug.findIndex(j=>j.uid===yo);const o=cfg.opciones||{};
  game=new CB.Game({humans:jug.length,bots:0,names:jug.map(j=>String(j.nombre||'Jugador').slice(0,22)),online:true,seed:o.semilla|0,map:o.mapa,squad:o.escuadra,turnTime:o.tiempo});
  /* Ponerse al día: la última foto con toda la cadena de cráteres detrás. */
  let K=0;while(entradas.has(K+1)&&huecosTras(K+1))K++;
  if(K>0)game.importState(entradas.get(K).st,huecosTras(K));
  arrancado=true;for(const uid of abandonos)eliminaEquipo(uid);
  game.nextTurn();asegurarActivo();empiezaTurno();hooks.start(game);
 }
 function asegurarActivo(){if(!game.active)game.active=game.units.find(u=>u.team===game.teamIndex&&u.hp>0)||game.units.find(u=>u.team===game.teamIndex)||game.units[0];}
 const corriendo=()=>game.phase!=='espera'&&game.phase!=='over';
 const mascara=()=>(game.keys.left?1:0)|(game.keys.right?2:0);
 const claveApunte=()=>q2(game.angle)+','+q2(game.power);
 const claveBlanco=()=>game.aimTarget?game.aimTarget.x+','+game.aimTarget.y:'';

 function empiezaTurno(){
  const ahora=performance.now();
  for(const [i,c]of trozos)if(c.k<game.turn)trozos.delete(i);
  for(const k of cacheHuecos.keys())if(k<game.turn-2)cacheHuecos.delete(k);
  const uid=jug[game.teamIndex]?.uid||'';
  T={k:game.turn,uid,rec:false,paso:0,cubierto:0,sigTrozo:0,cola:[],teclas:0,ultTrozo:ahora,libre:false,esperaDesde:0,enviado:false,hb:game.terrain.holes.length,acc:0,t0:ahora,
   buf:[],nTrozo:0,ultEnvio:ahora,enviadoHasta:0,ultW:game.weapon,ultK:0,ultM:claveApunte(),ultT:claveBlanco(),ultPasoM:-99,fin:game.phase==='over'};
  if(T.fin)return;
  if(abandonos.has(uid)){T.libre=true;return;}
  if(uid!==yo||abandonos.has(yo))return;
  T.rec=true;
  if(cabecera&&cabecera.k===T.k&&cabecera.uid===yo){
   /* Recargó la página en mitad de su propio turno: se rehace lo ya
      grabado y se sigue grabando a continuación. */
   consumeTrozos();while(T.paso<T.cubierto&&corriendo())pasoVisto();vaciaCola();
   T.nTrozo=T.sigTrozo;T.enviadoHasta=T.paso;T.ultW=game.weapon;T.ultK=mascara();T.ultM=claveApunte();T.ultT=claveBlanco();
  }else{cabecera={k:T.k,uid:yo};post('vivo-cabecera',{k:T.k,uid:yo});}
 }

 /* —— quien juega —— */
 function cuantiza(){if(game.active)game.setAim(q2(game.angle),q2(game.power));if(game.aimTarget)game.aimTarget={x:q1(game.aimTarget.x),y:q1(game.aimTarget.y)};}
 function diferencias(forzar){
  const n=T.paso;
  if(game.weapon!==T.ultW){T.buf.push([n,'w',game.weapon]);T.ultW=game.weapon;}
  const m=claveApunte(),t=claveBlanco();
  if((m!==T.ultM||t!==T.ultT)&&(forzar||n-T.ultPasoM>=6)){
   if(m!==T.ultM){T.buf.push([n,'m',q2(game.angle),q2(game.power)]);T.ultM=m;}
   if(t!==T.ultT){T.buf.push(game.aimTarget?[n,'t',game.aimTarget.x,game.aimTarget.y]:[n,'t']);T.ultT=t;}
   T.ultPasoM=n;
  }
  const k=mascara();if(k!==T.ultK){T.buf.push([n,'k',k]);T.ultK=k;}
 }
 function pasoGrabado(){hooks.input(STEP);cuantiza();diferencias(false);game.update(STEP);T.paso++;}
 function vuelca(ahora){
  if(!T.buf.length&&T.paso===T.enviadoHasta){T.ultEnvio=ahora;return;}
  post('vivo-trozo',{i:claveTrozo(T.k,T.nTrozo++),s:JSON.stringify({k:T.k,d:T.paso,e:T.buf})});
  T.buf=[];T.enviadoHasta=T.paso;T.ultEnvio=ahora;
 }
 function mandaFoto(){
  if(T.enviado||miEquipo<0||abandonos.has(yo))return;T.enviado=true;
  const st=game.exportState(T.hb);
  post('turno',{k:T.k,s:JSON.stringify(st),v:game.livingTeams().map(t=>jug[t.id]?.uid).filter(Boolean),d:game.teams.map(t=>t.damage),ti:game.teamIndex});
 }
 function cuadroGrabando(delta,ahora){
  T.acc+=delta;let n=0;while(T.acc>=STEP&&n<8&&corriendo()){pasoGrabado();T.acc-=STEP;n++;}
  if(!corriendo())T.acc=0;
  if(game.phase==='espera'&&!T.enviado){vuelca(ahora);mandaFoto();}
  else if(ahora-T.ultEnvio>=300)vuelca(ahora);
 }

 /* —— quien mira —— */
 function consumeTrozos(){
  if(T.libre)return;
  for(;;){const c=trozos.get(claveTrozo(T.k,T.sigTrozo));if(!c||c.k!==T.k)break;
   for(const ev of lista(c.e))T.cola.push(ev);T.cubierto=Math.max(T.cubierto,c.d|0);T.sigTrozo++;T.ultTrozo=performance.now();}
 }
 function aplicaEvento(ev){
  const c=ev[1];
  if(c==='m')game.setAim(+ev[2],+ev[3]);
  else if(c==='w'){if(!game.selectWeapon(+ev[2]))game.weapon=+ev[2];}
  else if(c==='t')game.aimTarget=ev.length>3?{x:+ev[2],y:+ev[3]}:null;
  else if(c==='k')T.teclas=ev[2]|0;
  else if(c==='j')game.jump();
  else if(c==='f')game.fire();
  else if(c==='s')game.settle(.6);
 }
 function vaciaCola(){while(T.cola.length&&T.cola[0][0]<=T.paso)aplicaEvento(T.cola.shift());}
 function pasoVisto(){vaciaCola();game.keys={left:!!(T.teclas&1),right:!!(T.teclas&2)};game.update(STEP);T.paso++;}
 function cuadroMirando(delta,ahora){
  consumeTrozos();
  if(!T.libre&&corriendo()&&T.paso>=T.cubierto&&ahora-T.ultTrozo>5000){T.libre=true;T.cola=[];T.teclas=0;}
  let n=0;
  if(T.libre){T.acc+=delta;while(T.acc>=STEP&&n<8&&corriendo()){pasoVisto();T.acc-=STEP;n++;}T.acc=Math.min(T.acc,STEP);return;}
  const atraso=T.cubierto-T.paso;
  if(atraso>30){const max=atraso>600?240:16;while(n<max&&T.paso<T.cubierto&&corriendo()){pasoVisto();n++;}T.acc=0;}
  else{T.acc+=delta;while(T.acc>=STEP&&n<8&&T.paso<T.cubierto&&corriendo()){pasoVisto();T.acc-=STEP;n++;}T.acc=Math.min(T.acc,STEP);}
  vaciaCola();
 }

 /* —— cambio de turno —— */
 function revisaFoto(ahora){
  const e=entradas.get(T.k);if(!e)return;
  const espera=ahora-Math.max(e.at,T.t0);
  const listo=entradas.has(T.k+1)||game.phase==='espera'||(T.rec&&e.uid!==yo)||espera>=8000||(espera>=2500&&(T.libre||T.paso>=T.cubierto));
  if(!listo)return;const huecos=huecosTras(T.k);if(!huecos)return;
  if(game.importState(e.st,huecos))hooks.rebuild();
  for(const uid of abandonos)eliminaEquipo(uid);
  game.nextTurn();asegurarActivo();empiezaTurno();hooks.hud();
 }
 function relevo(ahora){
  if(T.rec||T.enviado||miEquipo<0||abandonos.has(yo)||game.phase!=='espera'||entradas.has(T.k))return;
  const espera=abandonos.has(T.uid)?500+miEquipo*300:6000+miEquipo*700;
  if(ahora-T.esperaDesde>=espera)mandaFoto();
 }

 function frame(delta){
  if(!game||!T||T.fin)return;const ahora=performance.now();
  revisaFoto(ahora);if(T.fin)return;
  if(T.rec)cuadroGrabando(delta,ahora);else cuadroMirando(delta,ahora);
  if(game.phase==='espera'){if(!T.esperaDesde)T.esperaDesde=ahora;relevo(ahora);}
 }
 function canControl(){return !!(game&&T&&T.rec&&game.teamIndex===miEquipo&&game.humanTurn());}
 function accion(code){
  if(!canControl())return false;
  cuantiza();diferencias(true);let ok=true;
  if(code==='j')game.jump();else if(code==='f')ok=game.fire();else if(code==='s')game.settle(.6);else return false;
  if(ok){T.buf.push([T.paso,code]);if(code==='f')vuelca(performance.now());}
  return ok;
 }

 addEventListener('message',e=>{
  if(e.source!==root.parent||e.origin!==location.origin)return;const m=e.data;if(!m||m.canal!==PADRE)return;
  if(m.tipo==='config'){if(!cfg)cfg=m;}
  else if(m.tipo==='turnos'){for(const t of lista(m.lista))registraTurno(t);tieneTurnos=true;}
  else if(m.tipo==='vivo'){if(m.v){if(m.v.h)cabecera=m.v.h;for(const [i,s]of Object.entries(m.v.c||{}))registraTrozo(i,s);}tieneVivo=true;}
  else if(m.tipo==='vivo-h')cabecera=m.h||null;
  else if(m.tipo==='vivo-c')registraTrozo(m.i,m.s);
  else if(m.tipo==='abandonos'){for(const a of lista(m.lista))registraAbandono(a.uid);}
  if(!arrancado&&cfg&&tieneTurnos&&tieneVivo)arranca();
 });
 post('listo');
 return{frame,canControl,accion,game:()=>game,equipo:()=>miEquipo};
};
})(typeof globalThis!=='undefined'?globalThis:this);
