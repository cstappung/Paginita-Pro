/* Simulación compartida: se transmiten comandos, nunca vida, terreno o posiciones. */
(function(root){
'use strict';
const CB=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.CB;
const MAPS=['substation','alpine','desert','tidal'],MAX=120,WAIT=40000;
function options(p,players){return{humans:players.length,bots:0,squad:[2,3,4,5,6].includes(p.escuadra)?p.escuadra:4,map:MAPS[p.mapa]||MAPS[0],seed:p.semilla>>>0,turnTime:45};}
function create(o){return new CB.Game(o);}
function valid(frames){return Array.isArray(frames)&&frames.length>0&&frames.length<=MAX&&frames.every(f=>Array.isArray(f)&&f.length===10&&f.every(Number.isFinite)&&f[0]>=-85&&f[0]<=265&&f[1]>=12&&f[1]<=100&&Number.isInteger(f[2])&&f[2]>=0&&f[2]<10&&f.slice(3,8).every(v=>v===0||v===1)&&f[8]>=0&&f[8]<=CB.W&&f[9]>=-CB.H&&f[9]<=CB.H);}
function step(g,f){
 g.paused=false;
 if(g.phase==='aim'){
  if(g.weapon!==f[2])g.selectWeapon(f[2]);
  g.setAim(f[0],f[1]);g.keys={left:!!f[3],right:!!f[4]};
  if(CB.WEAPONS[g.weapon].type==='airstrike')g.aimTarget={x:f[8],y:f[9]};
  if(f[5])CB.Game.prototype.jump.call(g);
  if(f[6])CB.Game.prototype.fire.call(g);
  if(f[7]&&g.phase==='aim')g.settle(.6);
 }
 g.update(CB.STEP);
}
function control(g,kind,team){
 const target=kind==='abandona'?team:g.teamIndex;
 for(const u of g.units)if(u.team===target)g.eliminate(u);
 if(!g.checkWinner()&&g.teamIndex===target){g.projectiles=[];g.nextTurn();}
}
function apply(g,p){
 if(p.t==='circuit'){const turn=g.turn;for(const f of p.frames){if(g.turn!==turn||g.phase==='over')break;step(g,f);}}
 else control(g,p.t,p.team);
}
const cache=new Map();
function reduce(p,players,entries,ready){
 if(!ready)return{fase:'espera',turno:'',packets:[]};
 const opts=options(p,players),key=JSON.stringify([p.at,p.inicio,opts,players.map(x=>x.uid)]),signatures=entries.map(e=>JSON.stringify(e));let c=cache.get(key);
 if(!c||c.seen.length>entries.length||c.seen.some((v,i)=>v!==signatures[i])){
  c={game:create(opts),seen:[],packets:[],at:Math.max(p.inicio||0,p.at||0,...players.map(j=>j.at||0))};
  cache.set(key,c);if(cache.size>3)cache.delete(cache.keys().next().value);
 }
 const g=c.game;
 for(let i=c.seen.length;i<entries.length;i++){
  const e=entries[i],team=players.findIndex(j=>j.uid===e.uid);c.seen.push(signatures[i]);
  if(team<0||g.phase==='over')continue;
  let packet;
  if(e.t==='abandona'&&g.units.some(u=>u.team===team&&u.hp>0))packet={t:e.t,team};
  if(e.seq===c.packets.length&&e.t==='circuit'&&team===g.teamIndex&&typeof e.datos==='string'&&e.datos.length<=40000){
   let frames;try{frames=JSON.parse(e.datos);}catch{}
   if(valid(frames))packet={t:e.t,frames,uid:e.uid};
  }
  if(e.seq===c.packets.length&&e.t==='circuit-timeout'&&Number.isFinite(e.at)&&e.at-c.at>=WAIT)packet={t:e.t};
  if(!packet)continue;
  apply(g,packet);c.packets.push(packet);if(Number.isFinite(e.at))c.at=Math.max(c.at,e.at);g.drainEvents();
 }
 return{fase:g.phase==='over'?'fin':'jugando',turno:players[g.teamIndex]?.uid||'',ganador:g.phase==='over'?(players[g.winner]?.uid||''):null,motivo:g.phase==='over'?'circuit':'',puntos:Object.fromEntries(players.map((p,i)=>[p.uid,g.units.filter(u=>u.team===i).reduce((s,u)=>s+u.hp,0)])),packets:c.packets.slice(),opciones:opts,ultima:c.at};
}
const api={options,create,valid,step,apply,control,reduce,MAX,WAIT};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CBNet=api;
})(typeof globalThis!=='undefined'?globalThis:this);
