const {test}=require('node:test');
const assert=require('node:assert/strict');
const {context,reducir,mazoF7,lineaValidaF7,valorLineaF7,aporteF7,compromiso,auditaFlip7,progreso,meToca,golpeF7,aplicaGolpeF7,nombres,MODOS,eleccion,bono,cuenta,sala,mover,juega,aporte,azar}=require('./flip7-comun.cjs');
/* Flip 7: irse a mitad de partida (en su propio archivo: 120 partidas, corre en paralelo con los demás). */

/* Nada puede dejar la mesa sin nadie a quien esperar: en cualquier punto de
   la partida —a mitad de un reparto incluido— alguien se va o lo expulsan por
   votación, y la partida tiene que seguir teniendo una espera que alguien
   sentado pueda cumplir, hasta acabar. */
test('flip7: nadie que se va, por su pie o expulsado, deja la mesa colgada',async()=>{
 for(let s=1;s<=120;s++){
  const modo=MODOS[s%3],nj=2+(s%9);
  const {p,sec}=await sala(modo,nj,s*31);
  let e=reducir(p),pasos=0,cortes=0;
  const corteEn=new Set([5+(s%17),40+(s%23),90+(s%11)]);
  while(e.fase==='jugando'){
   assert.ok(++pasos<20000,'semilla '+s+': la partida no termina');
   const w=e.espera;assert.ok(w,'semilla '+s+': jugando sin nada que esperar');
   const sentados=Object.keys(p.jugadores).filter(u=>!e.fuera[u]);
   /* La espera siempre nombra a alguien que sigue en la mesa. */
   const deQuien=w.k==='roba'?w.faltan:[w.k==='decide'?w.uid:w.quien];
   assert.ok(deQuien.length&&deQuien.every(u=>sentados.includes(u)),'semilla '+s+': espera a quien no está ('+w.k+')');
   if(corteEn.has(pasos)&&sentados.length>1){
    cortes++;
    const vic=deQuien[0];
    if(cortes%2){e=mover(p,{t:'abandona',uid:vic});}
    else{for(const u of sentados)if(u!==vic&&!e.fuera[vic])e=mover(p,{t:'voto',uid:u,contra:vic});
     assert.ok(e.fuera[vic],'semilla '+s+': la votación no expulsa');}
    continue;
   }
   if(w.k==='roba'){const u=w.faltan[0];e=mover(p,{t:'r',uid:u,n:w.n,v:await aporteF7(sec[u].sem,sec[u].sal,w.n)});}
   else if(w.k==='decide'){
    const u=w.uid;
    if(!w.cero&&e.valor[u]>=20)e=mover(p,{t:'planta',uid:u});
    else e=mover(p,{t:'pide',uid:u,n:e.n,v:await aporteF7(sec[u].sem,sec[u].sal,e.n)});
   }else if(w.k==='bono')e=mover(p,bono(w,cuenta(pasos)));
   else e=mover(p,{t:'apunta',uid:w.quien,...eleccion(w.op,cuenta(pasos))});
  }
  assert.equal(e.fase,'fin','semilla '+s);
 }
});
