/* Circuit Breakers: deterministic simulation, independent of the browser. */
(function(root){
'use strict';
const W=3200,H=1200,G=330,STEP=1/60;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const randomSeed=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const COLORS=['#eaff83','#65e7ed','#ff9b9e','#beabff','#ffbe7d','#94bfff'];
const TEAM_NAMES=['Fase Lima','Neutro Azul','Arco Coral','Ohm Violeta','Cobre Naranja','Volt Cobalto'];
const NAMES=['Tesla','Faraday','Ampère','Curie','Ohm','Volta','Maxwell','Hertz','Joule','Edison','Watt','Kirchhoff','Lenz','Gauss','Coulomb','Weber','Henry','Oersted','Heaviside','Marconi','Franklin','Hopper','Clarke','Lovelace','Fleming','Bardeen','Shannon','Boole','Nyquist','Turing','Norton','Thévenin','Hedy','Raman','Fermi','Planck'];
const ROLES=['Potencia','Automatización','Telecomunicaciones','Alta tensión','Instrumentación','Electrónica'];
const MAPS={
 substation:{name:'Valle del reactor',tag:'INDUSTRIAL · ATARDECER',desc:'Colinas amplias, instalaciones eléctricas y depósitos explosivos.',sky:['#102235','#617580','#e4a67c'],ground:['#75836b','#445554','#24343f'],grass:'#b3bd88',water:'#3f8c9f',accent:'#ffd292',seed:27},
 alpine:{name:'Cordillera Boreal',tag:'ALPINO · AURORA',desc:'Picos nevados, valles profundos y una red eólica bajo la aurora.',sky:['#0d172d','#283d66','#779aaa'],ground:['#a9c3c7','#526f86','#263b56'],grass:'#e2f3ed',water:'#4c99b7',accent:'#a0f5e4',seed:93},
 desert:{name:'Desierto de cobre',tag:'SOLAR · HORA DORADA',desc:'Mesetas de arenisca y paneles solares entre nubes de polvo.',sky:['#34334d','#ab756c','#f5c592'],ground:['#dba06b','#995d47','#493b46'],grass:'#f8ca88',water:'#766e7c',accent:'#ffc885',seed:54},
 tidal:{name:'Puerto de tormenta',tag:'COSTERO · NOCHE',desc:'Islas, grúas y lluvia eléctrica. Cada salto cuenta.',sky:['#101a2b','#314d66','#708695'],ground:['#738e80','#39565d','#233845'],grass:'#accca0',water:'#4d9daf',accent:'#97e4f2',seed:71}
};
const WEAPONS=[
 {id:'arc',name:'Bobina de arco',short:'Arco',icon:'arc',type:'rocket',damage:48,radius:55,ammo:Infinity,color:'#eaff83',description:'Proyectil preciso. El viento y la gravedad afectan su trayectoria.'},
 {id:'capacitor',name:'Granada capacitor',short:'Capacitor',icon:'grenade',type:'grenade',damage:67,radius:79,ammo:5,color:'#ffc082',description:'Rebota y detona a los 2,8 segundos. Ideal para una trinchera.'},
 {id:'emp',name:'Pulso electromagnético',short:'EMP',icon:'emp',type:'emp',damage:41,radius:112,ammo:3,color:'#65e7ed',description:'Gran radio y empuje. Desplaza a varios rivales de una sola descarga.'},
 {id:'rail',name:'Cañón de riel',short:'Riel',icon:'rail',type:'rail',damage:78,radius:26,ammo:3,color:'#c5adff',description:'Tiro recto y veloz. Ignora viento y gravedad; requiere línea de visión.'},
 {id:'cluster',name:'Banco de capacitores',short:'Racimo',icon:'cluster',type:'cluster',damage:29,radius:47,ammo:3,color:'#ffb482',description:'Se abre en el aire y libera cinco cargas explosivas.'},
 {id:'mortar',name:'Mortero de inducción',short:'Mortero',icon:'mortar',type:'mortar',damage:88,radius:96,ammo:3,color:'#ff9b9e',description:'Carga pesada de gran impacto. Busca una trayectoria elevada.'},
 {id:'tesla',name:'Cadena Tesla',short:'Tesla',icon:'tesla',type:'chain',damage:51,radius:285,ammo:3,color:'#7fedff',description:'Alcanza al rival más cercano hasta 285 m y encadena hasta tres objetivos.'},
 {id:'drill',name:'Taladro de plasma',short:'Taladro',icon:'drill',type:'drill',damage:60,radius:63,ammo:3,color:'#e8b0ff',description:'Perfora hasta 130 m de terreno antes de explotar.'},
 {id:'airstrike',name:'Tormenta de voltaje',short:'Tormenta',icon:'airstrike',type:'airstrike',damage:36,radius:61,ammo:2,color:'#ffc878',description:'Marca un lugar del mapa: cinco descargas caen desde el cielo.'},
 {id:'repair',name:'Estación de reparación',short:'Reparar',icon:'repair',type:'repair',damage:0,radius:0,ammo:3,color:'#91efb6',description:'Recupera 45 puntos de vida y termina el turno.'}
];

class Terrain{
 constructor(map='substation'){
  this.map=MAPS[map]?map:'substation';this.width=W;this.height=H;this.mask=new Uint8Array(W*H);this.heights=new Int16Array(W);this.holes=[];this.version=0;
  for(let x=0;x<W;x++){
   let y;
   if(map==='alpine')y=733+Math.sin(x*.0032)*94+Math.sin(x*.009+1)*52+Math.sin(x*.019)*12;
   else if(map==='desert')y=752+Math.sin(x*.003)*53+Math.tanh(Math.sin(x*.006))*60+Math.sin(x*.018)*9;
   else if(map==='tidal'){y=778+Math.sin(x*.006)*62+Math.sin(x*.016)*14;for(const gap of [[640,732],[1440,1550],[2310,2420]])if(x>gap[0]&&x<gap[1])y=1120;}
   else y=752+Math.sin(x*.0045+1)*54+Math.sin(x*.011)*27+Math.sin(x*.021)*7;
   this.heights[x]=Math.round(y);for(let yy=this.heights[x];yy<H;yy++)this.mask[yy*W+x]=1;
  }
 }
 solid(x,y){x=Math.floor(x);y=Math.floor(y);return x>=0&&x<W&&y>=0&&y<H&&this.mask[y*W+x]===1;}
 surface(x,start=150){x=clamp(Math.floor(x),0,W-1);for(let y=Math.max(0,Math.floor(start));y<H;y++)if(this.mask[y*W+x])return y;return H;}
 crater(x,y,r){let removed=0;for(let yy=Math.max(0,Math.floor(y-r));yy<=Math.min(H-1,Math.ceil(y+r));yy++){const dy=yy-y;if(dy*dy>r*r)continue;const reach=Math.sqrt(r*r-dy*dy),left=Math.max(0,Math.ceil(x-reach)),right=Math.min(W-1,Math.floor(x+reach));for(let xx=left;xx<=right;xx++){let i=yy*W+xx;removed+=this.mask[i];this.mask[i]=0;}}
  this.holes.push({x,y,r});this.version++;return removed;
 }
}

class Game{
 constructor(options={}){
  this.options={humans:1,bots:1,squad:4,difficulty:'normal',map:'substation',turnTime:45,seed:Date.now(),...options};
  const o=this.options;o.humans=clamp(Math.round(+o.humans)||1,1,6);o.bots=clamp(Math.round(+o.bots)||0,o.humans===1?1:0,6-o.humans);o.squad=clamp(Math.round(+o.squad)||4,2,6);o.turnTime=clamp(+o.turnTime||45,30,90);if(!MAPS[o.map])o.map='substation';
  this.rng=randomSeed(o.seed);this.terrain=new Terrain(o.map);this.water=1030;this.turn=0;this.teamIndex=-1;this.active=null;this.phase='intro';this.paused=false;this.time=0;this.turnTime=o.turnTime;this.delay=0;this.wind=0;this.energy=240;this.angle=45;this.power=52;this.weapon=0;this.aimTarget=null;this.projectiles=[];this.events=[];this.keys={left:false,right:false};this.jumpBuffer=0;this.botPlan=null;this.botDelay=0;this.winner=undefined;this.round=1;this.crates=[];this.barrels=[];this.nextProjectile=0;this.settleElapsed=0;
  this.teams=Array.from({length:o.humans+o.bots},(_,id)=>({id,name:TEAM_NAMES[id],color:COLORS[id],bot:id>=o.humans,cursor:0,damage:0,kills:0,ammo:WEAPONS.map(w=>w.ammo*Math.ceil(o.squad/4))}));
  this.units=[];const count=this.teams.length*o.squad;
  for(let i=0;i<count;i++){
   const ideal=140+i*(W-280)/(count-1),x=this.safeSpawn(ideal,this.units.map(u=>u.x));
   this.units.push({id:i,team:i%this.teams.length,name:NAMES[i],role:ROLES[Math.floor(i/this.teams.length)%ROLES.length],variant:Math.floor(i/this.teams.length),x,y:this.terrain.surface(x)-.1,hp:120,maxHp:120,vx:0,vy:0,ground:true,coyote:.1,facing:i<count/2?1:-1,walk:0,hurt:0,eliminated:false,lastHit:-1,landing:0});
  }
  for(let i=0;i<8;i++){let x=230+i*390;if(this.terrain.surface(x)<950&&!this.units.some(u=>Math.abs(u.x-x)<54))this.barrels.push({x,y:this.terrain.surface(x),alive:true});}
  this.nextTurn();
 }
 emit(type,data={}){this.events.push({type,...data});if(this.events.length>1800)this.events.splice(0,500);}
 drainEvents(){return this.events.splice(0);}
 safeSpawn(ideal,used=[]){for(let d=0;d<1000;d+=4)for(const sign of [1,-1]){const x=Math.round(clamp(ideal+d*sign,60,W-60)),y=this.terrain.surface(x);if(y<920&&Math.abs(this.terrain.surface(x-9)-y)<10&&Math.abs(this.terrain.surface(x+9)-y)<10&&!used.some(v=>Math.abs(v-x)<49))return x;}throw Error('No safe spawn');}
 livingTeams(){return this.teams.filter(t=>this.units.some(u=>u.team===t.id&&u.hp>0));}
 humanTurn(){return this.phase==='aim'&&!this.paused&&this.active?.hp>0&&!this.teams[this.teamIndex].bot;}
 isSettled(){return !this.units.some(u=>u.hp>0&&(!u.ground||Math.abs(u.vx)>14));}
 nextTurn(){
  if(this.checkWinner())return;
  do{this.teamIndex=(this.teamIndex+1)%this.teams.length;}while(!this.units.some(u=>u.team===this.teamIndex&&u.hp>0));
  const team=this.teams[this.teamIndex],living=this.units.filter(u=>u.team===team.id&&u.hp>0);this.active=living[team.cursor%living.length];team.cursor++;
  this.turn++;this.round=Math.ceil(this.turn/this.teams.length);this.phase='intro';this.delay=1.15;this.turnTime=this.options.turnTime;this.energy=240;this.weapon=0;this.wind=(this.rng()-.5)*46;this.angle=this.active.x<W/2?43:137;this.power=52;this.active.facing=Math.cos(this.angle*Math.PI/180)>0?1:-1;this.keys={left:false,right:false};this.botPlan=null;this.botDelay=.9;this.jumpBuffer=0;this.aimTarget=null;
  if(this.turn>1&&(this.turn-1)%this.teams.length===0){if(this.round>=12){this.water=Math.max(570,this.water-32);this.emit('tide',{water:this.water});}if(this.round%2===0)this.spawnCrate();}
  this.emit('turn',{team:team.id,unit:this.active.id,round:this.round});
 }
 checkWinner(){const living=this.livingTeams();if(living.length>1)return false;if(this.phase==='over')return true;this.winner=living.length?living[0].id:null;this.phase='over';this.projectiles=[];this.keys={left:false,right:false};this.emit('victory',{winner:this.winner});return true;}
 selectWeapon(index){if(!this.humanTurn()||index<0||index>=WEAPONS.length||this.teams[this.teamIndex].ammo[index]<=0)return false;this.weapon=index;if(WEAPONS[index].type==='airstrike'){const foe=this.nearestEnemy(this.active);this.aimTarget={x:foe?.x||this.active.x+150,y:foe?.y||this.active.y};}this.emit('select',{weapon:index});return true;}
 nearestEnemy(u){let best=null,d=Infinity;for(const v of this.units)if(v.hp>0&&v.team!==u.team){const n=Math.hypot(u.x-v.x,u.y-v.y);if(n<d){d=n;best=v;}}return best;}
 setAim(a,p){this.angle=clamp(a,-85,265);this.power=clamp(p,12,100);if(this.active)this.active.facing=Math.cos(this.angle*Math.PI/180)>=0?1:-1;}
 jump(){if(this.phase==='aim'&&!this.paused&&this.energy>=22)this.jumpBuffer=.14;}
 supported(u,y=u.y){return this.terrain.solid(u.x-6,y+2)||this.terrain.solid(u.x+6,y+2)||this.terrain.solid(u.x,y+2);}
 walkUnit(u,dir,dt){if(this.energy<=0||u.hp<=0)return;const speed=u.ground?98:77,goal=dir*speed;u.drive=(u.drive||0)+(goal-(u.drive||0))*(1-Math.exp(-dt*(u.ground?18:7)));if(Math.abs(u.drive)<1){u.drive=0;return;}dir=Math.sign(u.drive);const dx=u.drive*dt;let nx=clamp(u.x+dx,12,W-12),step=0;
  if(this.terrain.solid(nx+dir*9,u.y-9)||this.terrain.solid(nx,u.y-23)){if(!u.ground)return;let found=false;for(let s=1;s<=11;s++){if(!this.terrain.solid(nx+dir*9,u.y-s-8)&&!this.terrain.solid(nx,u.y-s-23)){step=s;found=true;break;}}if(!found)return;}
  const distance=Math.abs(nx-u.x);u.x=nx;u.y-=step;u.facing=dir;u.walk+=distance*.14;this.energy=Math.max(0,this.energy-distance);if(distance>0&&u.ground&&this.rng()<.12)this.emit('step',{x:u.x,y:u.y});
 }
 unitPhysics(u,dt){
  if(u.hp<=0)return;u.hurt=Math.max(0,u.hurt-dt);u.landing=Math.max(0,u.landing-dt);u.ground=u.vy>=0&&this.supported(u);u.coyote=u.ground?.1:Math.max(0,u.coyote-dt);
  if(u.ground){u.vy=0;u.vx*=Math.exp(-dt*9);}else u.vy=Math.min(620,u.vy+G*dt);
  if(u===this.active&&this.phase==='aim'&&this.jumpBuffer>0&&u.coyote>0&&this.energy>=22){u.vy=-255;u.ground=false;u.coyote=0;this.energy-=22;this.jumpBuffer=0;this.emit('jump',{x:u.x,y:u.y});}
  let dx=u.vx*dt,steps=Math.max(1,Math.ceil(Math.abs(dx)/3));for(let i=0;i<steps;i++){let nx=u.x+dx/steps;if(!this.terrain.solid(nx+Math.sign(dx)*8,u.y-12)&&!this.terrain.solid(nx,u.y-25))u.x=nx;else{u.vx*=-.15;break;}}
  const dy=u.vy*dt,n=Math.max(1,Math.ceil(Math.abs(dy)));for(let i=0;i<n;i++){
   const ny=u.y+dy/n;
   if(dy>=0&&(this.terrain.solid(u.x-6,ny)||this.terrain.solid(u.x+6,ny)||this.terrain.solid(u.x,ny))){const impact=u.vy;u.vy=0;u.ground=true;u.coyote=.1;if(impact>140){u.landing=.2;this.emit('land',{x:u.x,y:u.y,force:impact});}if(impact>400)this.damage(u,Math.min(40,Math.round((impact-400)*.17)),u.lastHit);break;}
   if(dy<0&&(this.terrain.solid(u.x-6,ny-46)||this.terrain.solid(u.x+6,ny-46))){u.vy=0;break;}u.y=ny;
  }
  if(u.y>this.water+10||u.x<-25||u.x>W+25){this.emit('splash',{x:u.x,y:this.water});this.eliminate(u,u.lastHit);}
  for(const c of this.crates)if(c.alive&&Math.hypot(c.x-u.x,c.y-u.y)<31){c.alive=false;if(c.kind==='health'){const gain=Math.min(35,u.maxHp-u.hp);u.hp+=gain;this.emit('heal',{x:u.x,y:u.y,gain});}else{for(let i=1;i<WEAPONS.length;i++)this.teams[u.team].ammo[i]++;this.emit('pickup',{x:u.x,y:u.y,text:'+1 a todo el arsenal'});}this.emit('hud');}
 }
 damage(u,amount,by=-1){if(u.hp<=0)return;amount=Math.max(0,Math.round(amount));const actual=Math.min(u.hp,amount);u.hp-=actual;u.hurt=.4;u.lastHit=by;if(by>=0&&by!==u.team)this.teams[by].damage+=actual;this.emit('damage',{x:u.x,y:u.y-56,value:actual,unit:u.id});if(u.hp<=0)this.eliminate(u,by);}
 eliminate(u,by=-1){if(u.eliminated)return;u.hp=0;u.eliminated=true;if(by>=0&&by!==u.team)this.teams[by].kills++;this.emit('eliminate',{x:u.x,y:u.y,team:u.team,name:u.name});}
 launchData(u,a,p,index){const w=WEAPONS[index],rad=a*Math.PI/180,speed=w.type==='rail'?1450:(210+p*6.4)*(w.type==='mortar'?.86:w.type==='grenade'?.84:1),dx=Math.cos(rad),dy=-Math.sin(rad);return{x:u.x+dx*18,y:u.y-25+dy*18,vx:dx*speed,vy:dy*speed};}
 makeProjectile(u,a,p,index,extra={}){return{id:this.nextProjectile++,...this.launchData(u,a,p,index),weapon:index,type:WEAPONS[index].type,age:0,team:u.team,owner:u.id,drilled:0,bounces:0,delay:0,trail:[],...extra};}
 fire(){
  if(this.phase!=='aim'||this.paused||!this.active||this.active.hp<=0)return false;const u=this.active,team=this.teams[u.team],w=WEAPONS[this.weapon];if(team.ammo[this.weapon]<=0)return false;
  if(w.type==='repair'&&u.hp>=u.maxHp){this.emit('notice',{text:'El ingeniero ya tiene la vida completa.'});return false;}
  if(w.type==='chain'&&!this.units.some(v=>v.hp>0&&v.team!==u.team&&Math.hypot(v.x-u.x,v.y-u.y)<w.radius)){this.emit('notice',{text:'Sin rivales a menos de 285 m. Acércate o cambia de arma.'});return false;}
  team.ammo[this.weapon]--;this.phase='flight';if(!u.ground)u.vx+=(u.drive||0)*.7;u.drive=0;this.keys={left:false,right:false};this.emit('shot',{x:u.x,y:u.y,weapon:this.weapon});
  if(w.type==='repair'){const gain=Math.min(45,u.maxHp-u.hp);u.hp+=gain;this.emit('heal',{x:u.x,y:u.y,gain});this.settle(1.4);}
  else if(w.type==='chain'){
   const struck=new Set();let origin={x:u.x,y:u.y-24};for(let i=0;i<3;i++){let target=null,dist=i===0?w.radius:200;for(const v of this.units)if(v.hp>0&&v.team!==u.team&&!struck.has(v.id)){let d=Math.hypot(v.x-origin.x,v.y-24-origin.y);if(d<dist){dist=d;target=v;}}if(!target)break;this.emit('lightning',{x1:origin.x,y1:origin.y,x2:target.x,y2:target.y-24,color:w.color});this.damage(target,w.damage*(1-i*.22),u.team);struck.add(target.id);origin={x:target.x,y:target.y-24};}this.settle(1.7);
  }else if(w.type==='airstrike'){
   const tx=clamp(this.aimTarget?.x||u.x+200,90,W-90);for(let i=0;i<5;i++)this.projectiles.push(this.makeProjectile(u,0,50,this.weapon,{x:tx+(i-2)*60,y:-70-i*55,vx:12,vy:470,delay:i*.16,type:'bomb'}));
  }else this.projectiles.push(this.makeProjectile(u,this.angle,this.power,this.weapon));
  this.emit('hud');return true;
 }
 settle(delay=1.8){this.phase='settle';this.delay=delay;this.settleElapsed=0;}
 traceStep(p,dt,simulation=false){
  if(p.delay>0){p.delay-=dt;return '';}
  p.age+=dt;const w=WEAPONS[p.weapon];if(p.type!=='rail'){p.vx+=this.wind*dt*(p.type==='bomb'?.15:1);p.vy+=G*dt;}
  const dx=p.vx*dt,dy=p.vy*dt,n=Math.max(1,Math.ceil(Math.hypot(dx,dy)));
  for(let i=0;i<n;i++){
   const nx=p.x+dx/n,ny=p.y+dy/n,land=this.terrain.solid(nx,ny);
   if(p.penetrating){p.drilled+=Math.hypot(dx/n,dy/n);if(p.drilled>=130){p.x=nx;p.y=ny;return 'hit';}}
   let hit=null;for(const u of this.units){if(u.hp<=0||(u.id===p.owner&&p.age<.13))continue;if(Math.abs(u.x-nx)<13&&Math.abs(u.y-24-ny)<25){hit=u;break;}}
   if(land||hit){
    if(p.type==='drill'&&land&&!hit&&p.drilled<130){p.penetrating=true;p.x=nx;p.y=ny;if(!simulation&&(p.lastDrill===undefined||Math.hypot(p.x-p.lastDrill.x,p.y-p.lastDrill.y)>9)){this.terrain.crater(p.x,p.y,13);p.lastDrill={x:p.x,y:p.y};this.emit('drill',{x:p.x,y:p.y});}continue;}
    if(p.type==='grenade'&&!hit){const side=this.terrain.solid(nx,p.y),floor=this.terrain.solid(p.x,ny);if(side&&!floor)p.vx*=-.62;else{p.vy=-Math.abs(p.vy)*.56;p.vx*=.76;}if(Math.abs(p.vy)<20&&floor)p.vy=0;p.bounces++;if(!simulation)this.emit('bounce',{x:p.x,y:p.y});break;}
    p.x=nx;p.y=ny;return 'hit';
   }
   p.x=nx;p.y=ny;
  }
  if(p.type==='grenade'&&p.age>=2.8)return 'hit';
  if(p.type==='cluster'&&p.age>.6&&p.vy>=-35&&!simulation)return 'split';
  if(p.y>this.water||p.x<-60||p.x>W+60||p.age>11)return 'miss';return '';
 }
 explosion(x,y,weapon,team,override={}){
  const w=WEAPONS[weapon],radius=override.radius||w.radius,damage=override.damage||w.damage;this.terrain.crater(x,y,radius*.83);this.emit('explosion',{x,y,radius,color:w.color,weapon});
  for(const u of this.units){if(u.hp<=0)continue;const d=Math.hypot(u.x-x,u.y-23-y),reach=radius+24;if(d<reach){const falloff=1-d/reach;this.damage(u,damage*(.34+.66*falloff),team);u.vx+=(u.x>=x?1:-1)*(60+falloff*(w.type==='emp'?310:200));u.vy=-100-falloff*190;u.ground=false;u.lastHit=team;}}
  const chain=[];for(const b of this.barrels)if(b.alive&&Math.hypot(b.x-x,b.y-18-y)<radius+18){b.alive=false;chain.push(b);}for(const b of chain)this.explosion(b.x,b.y-16,0,team,{radius:80,damage:44});
  for(const c of this.crates)if(c.alive&&Math.hypot(c.x-x,c.y-y)<radius*.6)c.alive=false;this.emit('hud');
 }
 spawnCrate(){const x=this.safeSpawn(140+this.rng()*(W-280));this.crates.push({x,y:80,vy:0,kind:this.rng()>.48?'health':'ammo',alive:true,landed:false});this.emit('supply',{x});}
 simulateShot(a,p,index,u=this.active){const s=this.makeProjectile(u,a,p,index);let result='';for(let i=0;i<650;i++){result=this.traceStep(s,STEP,true);if(result)break;}return{x:s.x,y:s.y,result};}
 computeBotPlan(){
  const u=this.active,team=this.teams[u.team],enemies=this.units.filter(v=>v.hp>0&&v.team!==u.team).sort((a,b)=>Math.abs(a.x-u.x)-Math.abs(b.x-u.x)),target=enemies[0],difficulty=this.options.difficulty;
  if(!target)return{angle:45,power:50,weapon:0};
  if(u.hp<=(difficulty==='easy'?32:66)&&team.ammo[9]>0)return{angle:this.angle,power:50,weapon:9,score:0};
  const distance=Math.hypot(u.x-target.x,u.y-target.y);
  if(distance<270&&team.ammo[6]>0&&(difficulty!=='easy'||this.rng()>.5))return{angle:this.angle,power:50,weapon:6,score:0};
  if(team.ammo[8]>0&&this.turn>this.teams.length&&this.rng()<(difficulty==='hard'?.25:.12))return{angle:90,power:50,weapon:8,target:{x:target.x+(this.rng()-.5)*(difficulty==='easy'?180:45),y:target.y},score:0};
  let index=0;const choices=[0,0,1,2,4,5,7].filter(i=>team.ammo[i]>0);if(difficulty!=='easy'||this.rng()>.5)index=choices[Math.floor(this.rng()*choices.length)];
  let aim=Math.atan2(u.y-25-(target.y-24),target.x-u.x)*180/Math.PI;if(aim<-85)aim+=360;
  if(team.ammo[3]>0&&distance<1300){const end=this.simulateShot(aim,50,3);if(Math.hypot(end.x-target.x,end.y-(target.y-24))<34&&this.rng()>.35)return{angle:aim+(this.rng()-.5)*(difficulty==='easy'?8:difficulty==='hard'?.6:2),power:50,weapon:3,score:0};}
  let best={angle:target.x>u.x?45:135,power:60,weapon:index,score:Infinity};const direction=target.x>u.x?1:-1,step=difficulty==='hard'?4:7;
  for(let elevation=17;elevation<=80;elevation+=step){
   const rad=elevation*Math.PI/180,dx=Math.abs(target.x-u.x),dy=u.y-25-(target.y-24),denom=2*Math.cos(rad)**2*(dx*Math.tan(rad)-dy);if(denom<=0)continue;
   const desired=Math.sqrt(G*dx*dx/denom),factor=WEAPONS[index].type==='mortar'?.86:WEAPONS[index].type==='grenade'?.84:1,base=(desired/factor-210)/6.4;
   for(const offset of [-13,-7,-2,3,8,13]){const power=clamp(base+offset,12,100),angle=direction===1?elevation:180-elevation,end=this.simulateShot(angle,power,index),d=Math.hypot(end.x-target.x,end.y-(target.y-24));let score=d;
    for(const friend of this.units)if(friend.hp>0&&friend.team===u.team){const fd=Math.hypot(end.x-friend.x,end.y-friend.y);if(fd<WEAPONS[index].radius+25)score+=(WEAPONS[index].radius+25-fd)*2;}
    if(end.result==='miss')score+=50;if(score<best.score)best={angle,power,weapon:index,score};
   }
  }
  if(best.score>280&&index!==0){index=0;const end=this.simulateShot(direction===1?42:138,75,0);best={angle:direction===1?42:138,power:75,weapon:0,score:Math.hypot(end.x-target.x,end.y-target.y)};}
  const error=difficulty==='easy'?10:difficulty==='hard'?1.2:3.6;best.angle=clamp(best.angle+(this.rng()-.5)*error*2,-85,265);best.power=clamp(best.power+(this.rng()-.5)*error*1.5,12,100);return best;
 }
 update(dt=STEP){
  if(this.paused||this.phase==='over')return;this.time+=dt;this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
  for(const u of this.units)this.unitPhysics(u,dt);
  for(const b of this.barrels)if(b.alive&&!this.terrain.solid(b.x,b.y+2)){b.y+=80*dt;if(b.y>this.water)b.alive=false;}
  for(const c of this.crates)if(c.alive){if(c.landed&&!this.terrain.solid(c.x,c.y+2)){c.landed=false;c.vy=0;}if(!c.landed){c.vy=Math.min(95,c.vy+40*dt);c.y+=c.vy*dt;if(this.terrain.solid(c.x,c.y+2)){c.y=this.terrain.surface(c.x,c.y-10)-1;c.landed=true;}}if(c.y>this.water)c.alive=false;}
  if(this.phase==='intro'){this.delay-=dt;if(this.delay<=0){this.phase='aim';this.emit('ready');}return;}
  if(this.phase==='aim'){
   if(this.active.hp<=0){this.settle(1);return;}this.turnTime-=dt;if(this.turnTime<=0){this.emit('notice',{text:'Tiempo agotado. Cambio de cuadrilla.'});this.keys={left:false,right:false};this.settle(1);return;}
   if(this.teams[this.teamIndex].bot){
    this.botDelay-=dt;
    if(!this.botPlan&&this.botDelay>.3&&this.energy>190){const enemy=this.nearestEnemy(this.active);if(enemy&&Math.abs(enemy.x-this.active.x)>330){const dir=Math.sign(enemy.x-this.active.x),ahead=this.terrain.surface(this.active.x+dir*24);if(ahead<this.water-75&&Math.abs(ahead-this.active.y)<11)this.walkUnit(this.active,dir,dt);}}
    if(!this.botPlan&&this.botDelay<=0){this.botPlan=this.computeBotPlan();this.botDelay=.75;this.weapon=this.botPlan.weapon;this.emit('hud');}
    if(this.botPlan){const blend=1-Math.exp(-dt*7);this.setAim(this.angle+(this.botPlan.angle-this.angle)*blend,this.power+(this.botPlan.power-this.power)*blend);if(this.botDelay<=0){this.setAim(this.botPlan.angle,this.botPlan.power);this.aimTarget=this.botPlan.target||null;if(!this.fire()){this.weapon=0;this.fire();}}}
   }else this.walkUnit(this.active,(this.keys.right?1:0)-(this.keys.left?1:0),dt);
  }else if(this.phase==='flight'){
   const children=[];
   for(let i=this.projectiles.length-1;i>=0;i--){const p=this.projectiles[i],result=this.traceStep(p,dt);if(p.delay<=0){p.trail.push({x:p.x,y:p.y});if(p.trail.length>30)p.trail.shift();}
    if(result==='hit'){this.explosion(p.x,p.y,p.weapon,p.team);this.projectiles.splice(i,1);}
    else if(result==='split'){for(let j=0;j<5;j++)children.push({...p,id:this.nextProjectile++,type:'bomblet',vx:p.vx*.65+(j-2)*70,vy:-80+Math.abs(j-2)*12,age:0,trail:[]});this.emit('split',{x:p.x,y:p.y});this.projectiles.splice(i,1);}
    else if(result==='miss'){if(p.y>=this.water)this.emit('splash',{x:p.x,y:this.water});this.projectiles.splice(i,1);}
   }
   this.projectiles.push(...children);if(!this.projectiles.length)this.settle(1.65);
  }else if(this.phase==='settle'){this.delay-=dt;this.settleElapsed+=dt;if(this.delay<=0&&(this.isSettled()||this.settleElapsed>5.5))this.nextTurn();}
 }
 snapshot(){return{phase:this.phase,turn:this.turn,round:this.round,water:this.water,active:this.active?.id,winner:this.winner,teams:this.teams.map(t=>({id:t.id,bot:t.bot,ammo:[...t.ammo],damage:t.damage,kills:t.kills})),units:this.units.map(u=>({id:u.id,team:u.team,x:u.x,y:u.y,hp:u.hp})),projectiles:this.projectiles.length};}
}
const api={W,H,G,STEP,clamp,randomSeed,COLORS,TEAM_NAMES,NAMES,ROLES,MAPS,WEAPONS,Terrain,Game};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CB=api;
})(typeof globalThis!=='undefined'?globalThis:this);
