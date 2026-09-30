(function(root){
  'use strict';
  const catalog={
    hair:{label:'Pelo',colorLabel:'Color del pelo',names:['Corto','De lado','Puntas','Melena','Rizos','Cresta','Moño','Coleta','Trenzas','Afro']},
    shirt:{label:'Polera',colorLabel:'Color de la polera',names:['Básica','Rayas','Deportiva','Capucha','Polo','Zigzag','Chaqueta','Bolsillo','Estrella','Diagonal']},
    pants:{label:'Pantalón',colorLabel:'Color del pantalón',names:['Recto','Short','Cargo','Jogger','Rasgado','Ancho','Ajustado','Jardinera','Laterales','Dobladillo']},
    shoes:{label:'Zapatillas',colorLabel:'Color de las zapatillas',names:['Clásicas','Caña alta','Runner','Plataforma','Botín']},
    eyes:{label:'Ojos',colorLabel:'Color de los ojos',names:['Puntos','Redondos','Felices','Cerrados','Soñolientos','Decididos','Guiño','Estrellas','Corazones','Lentes']},
    mouth:{label:'Boca',colorLabel:'Color de la boca',names:['Sonrisa','Dientes','Risa','Sorpresa','De lado','Seria','Triste','Lengua','Un diente','Beso']}
  };
  const defaults={hair:1,shirt:0,pants:3,shoes:0,eyes:0,mouth:0,colors:{hair:'#352a3e',shirt:'#c4f568',pants:'#b7a1f7',shoes:'#f1f0e9',eyes:'#24252c',mouth:'#9c414b',skin:'#ffc693'}};
  function normalize(value){
    const input=value&&typeof value==='object'?value:{};
    const result={colors:{...defaults.colors}};
    for(const key of Object.keys(catalog))result[key]=Number.isInteger(input[key])&&input[key]>=0&&input[key]<catalog[key].names.length?input[key]:defaults[key];
    for(const key of Object.keys(defaults.colors))if(/^#[0-9a-f]{6}$/i.test(input.colors?.[key]||''))result.colors[key]=input.colors[key].toLowerCase();
    return result;
  }
  function draw(ctx,appearance,x,y,scale=1,pose={}){
    const a=appearance,c=a.colors;
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';ctx.lineJoin='round';
    const rect=(x,y,w,h,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
    const circle=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
    const line=(points,color,width=2)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
    const poly=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
    const curve=(x,y,cx,cy,ex,ey,color,width=2)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(cx,cy,ex,ey);ctx.stroke();};
    const star=(x,y,r,color)=>{const pts=[];for(let i=0;i<10;i++){const ang=-Math.PI/2+i*Math.PI/5;pts.push([x+Math.cos(ang)*(i%2?r*.43:r),y+Math.sin(ang)*(i%2?r*.43:r)]);}poly(pts,color);};
    const heart=(x,y,s,color)=>{circle(x-s*.35,y-s*.2,s*.48,color);circle(x+s*.35,y-s*.2,s*.48,color);poly([[x-s*.8,y],[x+s*.8,y],[x,y+s]],color);};
    ctx.fillStyle='#05090555';ctx.beginPath();ctx.ellipse(0,2,31,4,0,0,Math.PI*2);ctx.fill();
    // Longer hairstyles behind the face and shoulders.
    if(a.hair===3)rect(-21,-85,42,40,13,c.hair);
    if(a.hair===7){circle(18,-84,9,c.hair);curve(22,-84,34,-70,22,-52,c.hair,11);}
    if(a.hair===8)for(const side of [-1,1])for(let i=0;i<4;i++)circle(side*(19+i*.5),-69+i*6,4.5,c.hair);
    // Legs: every option has a different cut or visible detail.
    line([[-9,-30],[-11,-7]],c.skin,10);line([[9,-30],[11,-7]],c.skin,10);
    const pantsWidth=a.pants===5?16:a.pants===6?8:12;
    const pantsBottom=a.pants===1?-19:-7;
    for(const side of [-1,1])rect(side*9-pantsWidth/2,-31,pantsWidth,pantsBottom+31,3,c.pants);
    rect(-15,-33,30,10,3,c.pants);
    if(a.pants===2)for(const side of [-1,1])rect(side*13-4,-23,8,8,1,'#00000035');
    if(a.pants===3)for(const side of [-1,1]){rect(side*11-5,-10,10,4,1,'#00000045');line([[0,-31],[-2,-25],[2,-27]],'#f1f0e9',1.2);}
    if(a.pants===4)for(const side of [-1,1]){line([[side*10-4,-17],[side*10+3,-16]],c.skin,2.5);line([[side*10-3,-21],[side*10+3,-20]],'#ffffff88',1);}
    if(a.pants===8)for(const side of [-1,1])line([[side*15,-28],[side*16,-10]],'#ffffffaa',2.5);
    if(a.pants===9)for(const side of [-1,1])rect(side*11-6,-12,12,5,1,'#ffffff66');
    // Five shoe silhouettes, colored independently.
    for(const side of [-1,1]){
      const sx=side*11-8, height=[7,12,7,9,14][a.shoes];
      rect(sx,-height,17,height, a.shoes===2?5:3,c.shoes);
      if(a.shoes===2)poly([[sx-2,-2],[sx+5,-9],[sx+17,-5],[sx+19,0],[sx-2,0]],c.shoes);
      rect(sx-1,-2,19,a.shoes===3?5:3,1,'#e8e9df');
      if(a.shoes===1||a.shoes===4){line([[sx+4,-8],[sx+12,-8]],'#15191d',1);line([[sx+4,-5],[sx+12,-5]],'#15191d',1);}
      if(a.shoes===0)line([[sx+5,-5],[sx+11,-5]],'#15191d',1.5);
      if(a.shoes===2)line([[sx+4,-4],[sx+7,-6],[sx+11,-4]],'#ffffff',1.5);
    }
    // Arms, followed by sleeves.
    line([[-16,-47],[-23,-31]],c.skin,7);
    if(pose.handX!==undefined)line([[16,-47],[28,-51],[pose.handX,pose.handY]],c.skin,7);
    else line([[16,-47],[23,-31]],c.skin,7);
    if(a.shirt===3)rect(-21,-59,42,35,9,c.shirt);
    rect(-18,-54,36,27,6,c.shirt);
    line([[-16,-49],[-20,-42]],c.shirt,a.shirt===2?5:10);
    line([[16,-49],[20,pose.handX!==undefined?-48:-42]],c.shirt,a.shirt===2?5:10);
    circle(0,-55,6,c.skin);
    if(a.shirt===0)curve(-5,-53,0,-49,5,-53,'#00000030',1.5);
    if(a.shirt===1)for(const yy of [-47,-40,-33])rect(-17,yy,34,3,0,'#ffffffb0');
    if(a.shirt===2){ctx.fillStyle='#ffffff';ctx.font='bold 16px Arial';ctx.textAlign='center';ctx.fillText('7',0,-32);line([[-13,-52],[-13,-29]],'#ffffff',1.5);}
    if(a.shirt===3){line([[-5,-51],[-5,-42]],'#ffffffaa',1);line([[5,-51],[5,-42]],'#ffffffaa',1);rect(-10,-37,20,7,3,'#00000025');}
    if(a.shirt===4){poly([[-8,-54],[0,-49],[-5,-44]],'#ffffffbb');poly([[8,-54],[0,-49],[5,-44]],'#ffffffbb');circle(0,-43,1,'#1b231b');}
    if(a.shirt===5)line([[-16,-43],[-8,-36],[0,-43],[8,-36],[16,-43]],'#ffffffaa',3);
    if(a.shirt===6){rect(-7,-51,14,24,1,'#182421');line([[0,-52],[0,-27]],'#ffffff',1);line([[-13,-36],[-8,-36]],'#ffffff88',2);}
    if(a.shirt===7){rect(5,-46,10,10,1,'#00000030');line([[6,-44],[13,-44]],'#ffffff',1);}
    if(a.shirt===8)star(0,-40,9,'#ffffffcc');
    if(a.shirt===9)poly([[-17,-49],[-17,-41],[12,-27],[17,-27],[17,-31]],'#ffffffaa');
    if(a.pants===7){rect(-11,-43,22,17,3,c.pants);line([[-11,-53],[-9,-37]],c.pants,5);line([[11,-53],[9,-37]],c.pants,5);circle(-8,-40,1.5,'#f1f0e9');circle(8,-40,1.5,'#f1f0e9');}
    // Face.
    circle(-16,-71,4,c.skin);circle(16,-71,4,c.skin);rect(-17,-90,34,35,14,c.skin);
    // Ten haircuts; front hair stays above the eyes.
    if(a.hair===0){rect(-17,-91,34,11,7,c.hair);rect(-18,-83,4,11,2,c.hair);}
    if(a.hair===1){poly([[-18,-78],[-20,-86],[-10,-96],[12,-94],[20,-85],[4,-82],[-5,-75],[-4,-86]],c.hair);}
    if(a.hair===2)poly([[-18,-79],[-21,-91],[-12,-87],[-10,-100],[-3,-90],[4,-101],[9,-89],[19,-95],[17,-79]],c.hair);
    if(a.hair===3){rect(-17,-91,34,12,7,c.hair);poly([[-17,-83],[7,-90],[1,-77]],c.hair);}
    if(a.hair===4)for(let i=0;i<7;i++)circle(-16+i*5,-87-(i%2)*4,6,c.hair);
    if(a.hair===5){rect(-5,-101,10,24,4,c.hair);rect(-18,-84,4,9,2,c.hair);rect(14,-84,4,9,2,c.hair);}
    if(a.hair===6){circle(0,-98,10,c.hair);rect(-17,-91,34,12,8,c.hair);rect(-8,-91,16,2,1,'#ffffff55');}
    if(a.hair===7){rect(-17,-91,34,11,8,c.hair);poly([[-16,-82],[2,-88],[-11,-75]],c.hair);}
    if(a.hair===8){rect(-17,-92,34,11,7,c.hair);line([[0,-90],[0,-83]],'#00000044',1);}
    if(a.hair===9){for(let i=0;i<9;i++){const ang=Math.PI+i*Math.PI/8;circle(Math.cos(ang)*20,-79+Math.sin(ang)*14,8,c.hair);}rect(-17,-93,34,12,5,c.hair);}
    // Eyes.
    const ec=c.eyes,ey=-73;
    for(const side of [-1,1]){
      const ex=side*7;
      if(a.eyes===0)circle(ex,ey,2.4,ec);
      if(a.eyes===1){circle(ex,ey,4,'#ffffff');circle(ex,ey,2.3,ec);circle(ex-.6,ey-1,.7,'#ffffff');}
      if(a.eyes===2)curve(ex-3,ey,ex,ey-5,ex+3,ey,ec,2);
      if(a.eyes===3){curve(ex-3,ey-1,ex,ey+3,ex+3,ey-1,ec,2);line([[ex+2,ey],[ex+4,ey+1]],ec,1);}
      if(a.eyes===4){rect(ex-3,ey-1,6,3,1,ec);line([[ex-3,ey-3],[ex+3,ey-2]],ec,1);}
      if(a.eyes===5){circle(ex,ey+1,2,ec);line([[ex-4,ey-4-side],[ex+4,ey-4+side]],ec,2);}
      if(a.eyes===6){if(side<0)circle(ex,ey,2.5,ec);else curve(ex-3,ey,ex,ey-3,ex+3,ey,ec,2);}
      if(a.eyes===7)star(ex,ey,4.5,ec);
      if(a.eyes===8)heart(ex,ey-1,4,ec);
      if(a.eyes===9){rect(ex-5,ey-3,10,7,2,ec);line([[ex-3,ey-2],[ex,ey-2]],'#ffffffaa',1);}
    }
    if(a.eyes===9)line([[-18,ey-2],[18,ey-2]],ec,2);
    // Ten mouth shapes, with their own chosen color.
    const mc=c.mouth,my=-62;
    if(a.mouth===0)curve(-5,my-1,0,my+5,5,my-1,mc,1.8);
    if(a.mouth===1){rect(-6,my-2,12,6,2,mc);rect(-5,my-1,10,2,1,'#ffffff');}
    if(a.mouth===2){ctx.fillStyle=mc;ctx.beginPath();ctx.ellipse(0,my,5,4,0,0,Math.PI*2);ctx.fill();rect(-3,my-3,6,2,1,'#ffffff');}
    if(a.mouth===3){ctx.strokeStyle=mc;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,my,2.6,3.6,0,0,Math.PI*2);ctx.stroke();}
    if(a.mouth===4)curve(-4,my,2,my+3,6,my-3,mc,2);
    if(a.mouth===5)line([[-4,my],[4,my]],mc,2);
    if(a.mouth===6)curve(-5,my+2,0,my-4,5,my+2,mc,1.8);
    if(a.mouth===7){rect(-5,my-2,10,5,2,mc);rect(0,my,4,6,2,'#f68ca4');}
    if(a.mouth===8){curve(-5,my-1,0,my+5,5,my-1,mc,2);rect(-1,my,3,3,1,'#ffffff');}
    if(a.mouth===9){poly([[-3,my-3],[3,my-1],[0,my],[3,my+2],[-3,my+3],[0,my]],mc);}
    // El descenso (pose.maldad, 0..5): la cara se va torciendo por capas,
    // cada una fundida con su propio tramo. El vestidor no la pasa.
    const m=pose.maldad||0;
    if(m>0){
      const k=v=>Math.max(0,Math.min(1,v));
      const palidez=k((m-.5)/2)*.55;
      if(palidez>0){ctx.globalAlpha=palidez;rect(-17,-90,34,35,14,'#2a1a28');ctx.globalAlpha=1;}
      const ojos=k(m-1),boca=k(m-2),hondo=k(m-3);
      if(ojos>0){
        ctx.globalAlpha=ojos;
        for(const side of [-1,1]){
          rect(side*7-5,ey-5,10,9,3,c.skin);
          if(palidez>0){ctx.globalAlpha=ojos*palidez;rect(side*7-5,ey-5,10,9,3,'#2a1a28');ctx.globalAlpha=ojos;}
          if(hondo>0){ctx.globalAlpha=ojos*hondo*.7;line([[side*6,ey+3],[side*7,ey+9]],'#1a0508',1.5);line([[side*8.5,ey+3],[side*9,ey+7]],'#1a0508',1);ctx.globalAlpha=ojos;}
          ctx.shadowColor='#ff1030';ctx.shadowBlur=4+8*hondo;
          poly([[side*3,ey+1],[side*10,ey-3],[side*9,ey+1.5]],'#ff2238');
          ctx.shadowBlur=0;
        }
        ctx.globalAlpha=1;
      }
      // Las cejas, en V, desde el primer piso.
      ctx.globalAlpha=k(m);
      for(const side of [-1,1])line([[side*3,ey-4],[side*11,ey-9]],c.hair,2.4);
      ctx.globalAlpha=1;
      if(boca>0){
        ctx.globalAlpha=boca;rect(-8,my-4,16,9,3,c.skin);
        if(palidez>0){ctx.globalAlpha=boca*palidez;rect(-8,my-4,16,9,3,'#2a1a28');}
        ctx.globalAlpha=boca;
        poly([[-8,my-3],[8,my-3],[5,my+3],[-5,my+3]],'#1a0508');
        const dientes=[];for(let i=0;i<=8;i++)dientes.push([-7+i*1.75,my-3+(i%2?3:0)]);
        dientes.push([7,my-3]);poly(dientes,'#f4ecd8');
        line([[-8,my-3],[-10,my-6]],'#1a0508',1.2);line([[8,my-3],[10,my-6]],'#1a0508',1.2);
        ctx.globalAlpha=1;
      }
    }
    ctx.restore();
  }
  const api={catalog,defaults,normalize,draw};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BBTANCharacter=api;
})(globalThis);
