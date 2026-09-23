/* Música y efectos de Circuit Breakers, con el chip de la sala de juegos.

   Las dos canciones (`worms-menu`, `worms-combate`) viven en
   `juegos/audio/temas.js` y las toca `Chip.Reproductor`, el mismo motor que
   usa el vestíbulo: así el juego suena a la misma consola que el resto de la
   sala, y no a una radio aparte. Tres cosas que sostienen esto:

   - **El modo se lee en cada `tick()`**, no se avisa. `app.js` escribe
     `soundtrack.mode = 'combat'` a pelo en varios sitios, y pedirle que llame
     a un método en cada uno era dejar la puerta abierta a olvidarse de uno.
   - **Pausar calla lo ya agendado.** El reproductor va 0,2 s por delante del
     reloj; bajar solo la ganancia dejaba esas notas sonando al volver, y
     `detener()` además rearma el reloj, así que al reanudar no hay ráfaga de
     notas atrasadas.
   - **Los efectos van por su propio bus**, con su propia casilla: quien quiere
     jugar sin música sigue oyendo el disparo, y al revés. */
(function(root){
'use strict';
const Chip=root.Chip,Temas=root.Temas;
const CANCION={menu:'worms-menu',combat:'worms-combate'};

class Soundtrack{
 constructor(){this.ctx=null;this.enabled=true;this.effects=true;this.volume=.42;this.mode='menu';this.paused=false;this.ready=false;this.failed=false;this.appliedGain=-1;this.reps={};this.rep=null;this.sonando=null;}
 async unlock(){
  try{
   if(!this.ctx){
    const Audio=root.AudioContext||root.webkitAudioContext;
    if(!Audio||!Chip||!Temas){this.failed=true;return false;}
    this.ctx=new Audio();
    this.master=this.ctx.createGain();this.master.gain.value=.7;this.master.connect(this.ctx.destination);
    this.music=this.ctx.createGain();this.music.gain.value=this.volume;this.music.connect(this.master);
    this.fx=this.ctx.createGain();this.fx.gain.value=.62;this.fx.connect(this.master);
   }
   await this.ctx.resume();this.ready=this.ctx.state==='running';return this.ready;
  }catch{this.failed=true;return false;}
 }
 /** El reproductor de un modo, creado la primera vez que hace falta. */
 reproductor(modo){
  const id=CANCION[modo]||CANCION.menu;
  if(!this.reps[id])this.reps[id]=new Chip.Reproductor(this.ctx,this.music,Temas.temas[id]);
  return this.reps[id];
 }
 tick(){
  if(!this.ready||!this.ctx)return;
  const t=this.ctx.currentTime,suena=this.enabled&&!this.paused,target=suena?this.volume:0;
  if(target!==this.appliedGain){this.music.gain.setTargetAtTime(target,t,.08);this.appliedGain=target;}
  if(!suena){if(this.rep&&this.rep.voces.size)this.rep.detener();return;}
  const modo=this.mode==='combat'?'combat':'menu';
  if(modo!==this.sonando){
   if(this.rep)this.rep.detener();
   this.rep=this.reproductor(modo);this.rep.reinicia();this.sonando=modo;
  }
  this.rep.tick(.2);
 }
 setPause(value){this.paused=value;}
 setMusic(value){this.enabled=value;if(value&&!this.ready)this.unlock();}
 setVolume(value){this.volume=Math.max(0,Math.min(.7,value));}
 effect(kind,pitch=1){
  if(!this.ready||!this.effects||!this.ctx)return;
  const c=this.ctx,d=this.fx,t=c.currentTime+.005,H=Chip.hz;
  const P=(f,dur,o={})=>Chip.voz(c,d,Object.assign({t,f,dur,vol:.12,onda:'p25',sus:.8},o));
  const N=(dur,o={})=>Chip.ruido(c,d,Object.assign({t,dur,vol:.2},o));
  const serie=(notas,paso,o={})=>notas.forEach((n,i)=>P(H(n),paso*.95,Object.assign({t:t+i*paso},o)));
  const w=Math.max(1,Math.min(12,+pitch||1));
  switch(kind){
   case 'explosion':N(.75,{vol:.32,tono:1,tono1:.18});P(140,.45,{f1:28,onda:'tri',vol:.3,sus:1});N(.12,{vol:.22,corto:true,tono:.6});break;
   case 'shot':P(1300-w*60,.14,{f1:180,onda:'p12',vol:.1});N(.07,{vol:.12,tono:1.4});break;
   case 'lightning':for(let i=0;i<5;i++){P(H(84-i*3),.05,{t:t+i*.035,f1:H(72-i*3),onda:'p12',vol:.08});}N(.24,{vol:.14,corto:true,tono:1.8,tono1:.8});break;
   case 'turn':serie([81,88],.09,{vol:.09});break;
   case 'heal':serie([72,76,79,84,88],.06,{onda:'tri',vol:.16,sus:1});break;
   case 'pickup':P(H(83),.07,{vol:.1,onda:'p50'});P(H(88),.28,{t:t+.07,vol:.1,onda:'p50',sus:.6});break;
   case 'victory':serie([67,72,76,79,76,79],.11,{vol:.11});P(H(84),.6,{t:t+.66,vol:.11,vib:.008});P(H(60),.9,{t:t+.66,onda:'tri',vol:.18,sus:1});break;
   case 'jump':P(260,.1,{f1:620,onda:'p50',vol:.06});break;
   case 'splash':N(.4,{vol:.2,tono:.9,tono1:.25});P(420,.25,{f1:90,onda:'tri',vol:.12,sus:1});break;
   case 'bounce':P(H(64+Math.floor(w)),.05,{onda:'tri',vol:.1,sus:1});break;
   case 'select':P(H(91),.03,{onda:'p12',vol:.05});break;
  }
 }
}
root.CB.Soundtrack=Soundtrack;
})(globalThis);
