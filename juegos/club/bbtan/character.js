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
  // Mezcla lineal de dos #rrggbb (t en 0..1).
  const mix=(p,q,t)=>{if(t<=0)return p;const A=[1,3,5].map(i=>parseInt(p.slice(i,i+2),16)),B=[1,3,5].map(i=>parseInt(q.slice(i,i+2),16));return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');};
  const kk=v=>Math.max(0,Math.min(1,v));
  function draw(ctx,appearance,x,y,scale=1,pose={}){
    const a=appearance,m=pose.maldad||0,t=pose.t||0;
    // El descenso no se queda en la cara: la piel palidece y luego enrojece, la
    // ropa se ennegrece y se rompe, y le salen cuernos, garras, cola y alas.
    // Cada capa entra en su propio tramo de maldad; el vestidor no la pasa.
    let c=a.colors;
    if(m>0){
      const ropa=kk((m-.8)/2.2),piel=kk((m-.5)/2.5),rojo=kk((m-3)/2);
      c={...c,skin:mix(mix(c.skin,'#9c8e98',piel*.8),'#7a2432',rojo*.55),hair:mix(c.hair,'#0c0608',kk(m-1)),
        shirt:mix(mix(c.shirt,'#2a1a24',ropa),'#4a0a14',rojo*.5),pants:mix(c.pants,'#1c1018',ropa),
        shoes:mix(c.shoes,'#140a0c',ropa),mouth:mix(c.mouth,'#3a0008',kk(m-1))};
    }
    // Y arriba, lo contrario: vuelve a ser él, pero perfecto. La ropa pasa a
    // pastel, le sale una corona de flores, una aureola y alas, se le ponen
    // rosadas las mejillas y la sonrisa crece hasta no caberle en la cara.
    const p=pose.perfecto||0;
    if(p>0){const v=kk(p/.8);
      c={...c,skin:mix(c.skin,'#ffd9cf',.25*v),shirt:mix(c.shirt,'#ffb8dc',.85*v),pants:mix(c.pants,'#9fdcff',.8*v),shoes:mix(c.shoes,'#ffffff',v),mouth:mix(c.mouth,'#d0306a',v)};}
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';ctx.lineJoin='round';
    // Se va encorvando y respira hondo.
    const encorva=kk((m-2)/2);
    if(encorva>0)ctx.transform(1,0,-.09*encorva,1-.05*encorva+.015*encorva*Math.sin(t/520),0,0);
    const rect=(x,y,w,h,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
    const circle=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
    const line=(points,color,width=2)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
    const poly=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
    const curve=(x,y,cx,cy,ex,ey,color,width=2)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(cx,cy,ex,ey);ctx.stroke();};
    const star=(x,y,r,color)=>{const pts=[];for(let i=0;i<10;i++){const ang=-Math.PI/2+i*Math.PI/5;pts.push([x+Math.cos(ang)*(i%2?r*.43:r),y+Math.sin(ang)*(i%2?r*.43:r)]);}poly(pts,color);};
    const heart=(x,y,s,color)=>{circle(x-s*.35,y-s*.2,s*.48,color);circle(x+s*.35,y-s*.2,s*.48,color);poly([[x-s*.8,y],[x+s*.8,y],[x,y+s]],color);};
    ctx.fillStyle='#05090555';ctx.beginPath();ctx.ellipse(0,2,31,4,0,0,Math.PI*2);ctx.fill();
    // Brinca de alegría, siempre al mismo compás.
    if(p>1.4)ctx.translate(0,-kk((p-1.4)/.8)*Math.abs(Math.sin(t/300))*4);
    if(p>1.8){const alas=kk((p-1.8)/.8),b=Math.sin(t/400)*2*alas;ctx.globalAlpha=alas;
      for(const s of [-1,1]){for(let i=0;i<4;i++)circle(s*(17+i*6*alas),-54-i*3*alas-b+i*i*.6,6+2*alas-i*.8,i%2?'#ffffff':'#fff4fa');
        circle(s*(15+10*alas),-44+b*.5,5,'#ffffff');}
      ctx.globalAlpha=1;}
    if(m>2){
      const aura=kk((m-2.5)/1.5),alas=kk((m-4)/.9),cola=kk((m-2.2)/1.4),late=.75+.25*Math.sin(t/260);
      if(aura>0){const g=ctx.createRadialGradient(0,-50,6,0,-50,52);g.addColorStop(0,'#ff103000');g.addColorStop(.6,'#ff10301c');g.addColorStop(1,'#ff103000');ctx.globalAlpha=aura*late;ctx.fillStyle=g;ctx.fillRect(-56,-106,112,112);ctx.globalAlpha=1;}
      if(alas>0){ctx.globalAlpha=alas;const b=Math.sin(t/340)*3*alas;
        for(const s of [-1,1])poly([[s*12,-50],[s*(26+14*alas),-74-b],[s*(40+10*alas),-66-b],[s*(34+8*alas),-56],[s*(38+8*alas),-46+b],[s*28,-47],[s*30,-38+b],[s*16,-40]],'#14060a');
        ctx.globalAlpha=1;}
      if(cola>0){const w=Math.sin(t/300)*4;ctx.globalAlpha=cola;
        ctx.strokeStyle='#1a0508';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(8,-30);ctx.bezierCurveTo(26,-24,30+w,-8,36+w*1.5,-26-10*cola);ctx.stroke();
        const tx=36+w*1.5,ty=-26-10*cola;poly([[tx-4,ty+3],[tx+1,ty-7],[tx+5,ty+3],[tx,ty+1]],'#3a0810');ctx.globalAlpha=1;}
    }
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
    if(m>1.5){
      const roto=kk((m-1.5)/1.5),venas=kk((m-3)/1.5),runa=kk((m-3.5)/1.2),puas=kk((m-4)/.8);
      ctx.globalAlpha=roto;
      // desgarros: borde dentado de la polera, jirones con piel a la vista
      const dz=[];for(let i=0;i<=8;i++)dz.push([-18+i*4.5,-27+(i%2?-4:0)]);dz.push([18,-24],[-18,-24]);poly(dz,c.pants);
      poly([[-11,-44],[-6,-41],[-9,-37],[-7,-33],[-12,-36]],c.skin);poly([[7,-38],[12,-35],[9,-31]],c.skin);
      for(const side of [-1,1])poly([[side*9-4,-17],[side*9+2,-15],[side*9-1,-11],[side*9+3,-9],[side*9-3,-10]],c.skin);
      for(const side of [-1,1])for(let i=0;i<3;i++)line([[side*(6+i*4),-8],[side*(6+i*4)+1,-4]],c.pants,2);
      ctx.globalAlpha=1;
      if(venas>0){ctx.globalAlpha=venas*.7;
        for(const side of [-1,1]){line([[side*17,-47],[side*19,-41],[side*18,-37],[side*21,-33]],'#ff1030',.8);line([[side*9,-16],[side*10,-12],[side*8,-9]],'#ff1030',.8);}
        ctx.globalAlpha=1;}
      if(runa>0){ctx.save();ctx.globalAlpha=runa*(.6+.4*Math.sin(t/230));ctx.shadowColor='#ff1030';ctx.shadowBlur=6;
        const pts=[];for(let i=0;i<5;i++){const g=-Math.PI/2+i*Math.PI*4/5;pts.push([Math.cos(g)*7,-40+Math.sin(g)*7]);}pts.push(pts[0]);line(pts,'#ff2238',1.1);
        ctx.restore();}
      if(puas>0){ctx.globalAlpha=puas;for(const side of [-1,1]){poly([[side*12,-54],[side*20,-54-7*puas],[side*18,-50]],'#1a0508');poly([[side*16,-52],[side*24,-54-4*puas],[side*20,-47]],'#1a0508');}ctx.globalAlpha=1;}
    }
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
    if(p>.5){const fl=kk((p-.5)/.6);ctx.globalAlpha=fl;
      ['#ff6fae','#ffd84d','#ffffff','#5ec8ff','#ff6fae'].forEach((col,i)=>{const fx=-14+i*7,fy=-93+Math.abs(i-2)*1.5;for(const [dx,dy] of [[-2,0],[2,0],[0,-2],[0,2]])circle(fx+dx,fy+dy,2,col);circle(fx,fy,1.3,'#ffe066');});
      ctx.globalAlpha=1;}
    if(p>1.2){const au=kk((p-1.2)/.6),fl=Math.sin(t/500)*1.5;ctx.globalAlpha=au;ctx.strokeStyle='#ffd23f';ctx.lineWidth=3;ctx.shadowColor='#fff3a8';ctx.shadowBlur=8;
      ctx.beginPath();ctx.ellipse(0,-108+fl,14,4,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=1;}
    if(m>2){
      const cuernos=kk((m-2)/1.5),garras=kk((m-3)/1.2);
      if(cuernos>0){ctx.globalAlpha=Math.min(1,cuernos*1.5);const L=6+12*cuernos;
        for(const s of [-1,1]){poly([[s*7,-89],[s*14,-88],[s*(17+L*.35),-89-L*.7],[s*(13+L*.2),-89-L]],'#2a0a10');line([[s*9,-90],[s*(12+L*.2),-89-L*.8]],'#5a1a22',1);}
        ctx.globalAlpha=1;}
      if(garras>0){ctx.globalAlpha=garras;const manos=[[-23,-31,-1,1]];
        manos.push(pose.handX!==undefined?[pose.handX,pose.handY,1,0]:[23,-31,1,1]);
        for(const [hx,hy,s,abajo] of manos)for(let i=-1;i<=1;i++){const bx=hx+i*2.2;poly(abajo?[[bx-1,hy+2],[bx+1,hy+2],[bx+s*.8,hy+6+garras*2]]:[[bx,hy-1],[bx,hy+1],[bx+5+garras*2,hy+i*1.5]],'#140406');}
        ctx.globalAlpha=1;}
    }
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
    // La cara se tuerce por capas, cada una fundida con su propio tramo.
    if(m>0){
      const k=kk;
      const ojos=k(m-1),boca=k(m-2),hondo=k(m-3);
      if(ojos>0){
        ctx.globalAlpha=ojos;
        for(const side of [-1,1]){
          rect(side*7-5,ey-5,10,9,3,c.skin);
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
        ctx.globalAlpha=boca;
        poly([[-8,my-3],[8,my-3],[5,my+3],[-5,my+3]],'#1a0508');
        const dientes=[];for(let i=0;i<=8;i++)dientes.push([-7+i*1.75,my-3+(i%2?3:0)]);
        dientes.push([7,my-3]);poly(dientes,'#f4ecd8');
        line([[-8,my-3],[-10,my-6]],'#1a0508',1.2);line([[8,my-3],[10,my-6]],'#1a0508',1.2);
        ctx.globalAlpha=1;
      }
    }
    if(p>0){
      const k=kk,mej=k(p/.6),brillo=k((p-.3)/.6),grandes=k((p-1.8)/.6),sonrisa=k((p-.8)/.6),abierta=k((p-1.5)/.6),ancho=6+10*k((p-.8)/2.2);
      ctx.globalAlpha=.55*mej;circle(-11,-65,3.2,'#ff8fb8');circle(11,-65,3.2,'#ff8fb8');ctx.globalAlpha=1;
      if(grandes>0){ctx.globalAlpha=grandes;
        // Ojos grandes y abiertos, con la pupila chica: mira fijo, sin parpadear.
        for(const side of [-1,1]){const ex=side*7;rect(ex-5,ey-5,10,9,3,c.skin);circle(ex,ey,4.6,'#ffffff');circle(ex,ey,1.4+.6*(1-k((p-2.5)/.5)),'#241018');circle(ex-1.6,ey-1.8,1,'#ffffff');}
        ctx.globalAlpha=1;
      }else if(brillo>0){ctx.globalAlpha=brillo;for(const side of [-1,1])circle(side*7+1.4,ey-1.6,.9,'#ffffff');ctx.globalAlpha=1;}
      if(sonrisa>0){ctx.globalAlpha=sonrisa;rect(-9,my-4,18,9,3,c.skin);
        if(abierta>0){ctx.fillStyle='#5a1a30';ctx.beginPath();ctx.moveTo(-ancho,my-2);ctx.quadraticCurveTo(0,my+4+5*abierta,ancho,my-2);ctx.closePath();ctx.fill();
          ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(-ancho+1,my-2);ctx.lineTo(ancho-1,my-2);ctx.lineTo(ancho-2,my);ctx.lineTo(-ancho+2,my);ctx.closePath();ctx.fill();}
        curve(-ancho,my-2,0,my+4+5*abierta,ancho,my-2,'#5a1a30',1.6);
        line([[-ancho,my-2],[-ancho-1.5,my-4]],'#5a1a30',1.4);line([[ancho,my-2],[ancho+1.5,my-4]],'#5a1a30',1.4);
        ctx.globalAlpha=1;}
    }
    ctx.restore();
  }
  const api={catalog,defaults,normalize,draw};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BBTANCharacter=api;
})(globalThis);
