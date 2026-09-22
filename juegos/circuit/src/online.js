(function(root){
'use strict';
const N=root.CBNet;
class Online{
 constructor(h){this.h=h;this.uid='';this.est=null;this.seq=0;this.frames=[];this.pending=null;this.queue=[];this.actions={};this.error=false;this.executing=false;
  addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.canal!=='circuit-parent')return;const d=e.data;
   if(d.tipo==='error'){this.error=true;this.h.status('Conexión interrumpida · pulsa Reconectar encima del juego.');}
   if(d.tipo==='estado'||d.tipo==='restaurar'){this.uid=d.uid;this.receive(d.est,d.tipo==='restaurar');}
  });this.send({tipo:'listo'});
 }
 send(d){parent.postMessage({canal:'circuit-child',...d},location.origin);}
 canAct(){return !this.error&&!this.pending&&!this.queue.length&&this.est?.fase==='jugando'&&this.est.jugadores[this.h.game()?.teamIndex]?.uid===this.uid;}
 receive(est,force=false){
  this.est=est;if(!est||est.fase==='espera'){this.h.status('Esperando a que empiece la sala…');return;}
  if(force||!this.h.game()||est.packets.length<this.seq){this.rebuild();return;}
  if(this.pending&&est.packets.length>this.seq){const p=est.packets[this.seq];
   if(p.t==='circuit'&&p.uid===this.uid&&JSON.stringify(p.frames)===JSON.stringify(this.pending)){this.seq++;this.pending=null;this.frames=[];this.error=false;}
   else{this.rebuild();return;}
  }else if(this.frames.length&&est.packets.length>this.seq){this.rebuild();return;}
  this.queue.push(...est.packets.slice(this.seq+this.queue.length).map(p=>({...p,cursor:0})));
  this.h.status(this.canAct()?'Tu cuadrilla · combate en línea':'Combate en línea · siguiendo el turno');this.h.refresh();
 }
 rebuild(){
  const g=N.create(this.est.opciones);for(const p of this.est.packets)N.apply(g,p);g.drainEvents();
  g.teams.forEach((t,i)=>t.name=String(this.est.jugadores[i].nombre||'Jugador '+(i+1)));
  this.seq=this.est.packets.length;this.frames=[];this.pending=null;this.queue=[];this.actions={};this.error=false;
  const normal=g.humanTurn.bind(g);g.humanTurn=()=>normal()&&(this.executing||this.canAct());
  g.fire=()=>{if(this.canAct())this.actions.fire=1;};g.jump=()=>{if(this.canAct())this.actions.jump=1;};this.h.attach(g);this.h.refresh();
 }
 skip(){if(this.canAct())this.actions.skip=1;}
 tick(){
  const g=this.h.game();if(!g||this.error)return;
  if(this.queue.length){const p=this.queue[0];this.executing=true;
   if(p.t==='circuit'){
    if(p.turn===undefined)p.turn=g.turn;
    for(let n=0;n<2&&p.cursor<p.frames.length;n++){if(g.turn!==p.turn||g.phase==='over'){p.cursor=p.frames.length;break;}N.step(g,p.frames[p.cursor++]);}
   }else{N.apply(g,p);p.cursor=1;}
   this.executing=false;if(p.t!=='circuit'||p.cursor>=p.frames.length){this.queue.shift();this.seq++;this.h.refresh();}return;
  }
  if(!this.canAct()||g.phase==='over')return;
  this.h.inputs();const round=v=>Math.round(v*100)/100;
  const f=[round(g.angle),round(g.power),g.weapon,+!!g.keys.left,+!!g.keys.right,+!!this.actions.jump,+!!this.actions.fire,+!!this.actions.skip,round(CB.clamp(g.aimTarget?.x||0,0,CB.W)),round(CB.clamp(g.aimTarget?.y||0,-CB.H,CB.H))];
  this.actions={};const turn=g.turn;this.executing=true;N.step(g,f);this.executing=false;this.frames.push(f);
  if(this.frames.length>=N.MAX||g.turn!==turn||g.phase==='over'){this.pending=this.frames;this.send({tipo:'bloque',seq:this.seq,frames:this.pending});this.h.refresh();}
 }
}
root.CircuitOnline=Online;
})(window);
