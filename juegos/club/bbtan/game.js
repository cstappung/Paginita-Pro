(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const { clamp, stepBall } = BBTANPhysics;
  const { grid, ballRadius, initialBalls, createRow: makeRow, enterPickup, activatePowerup, keepPickupNextRound, shotPace, aimVisibility, hasClearedBoard } = BBTANRules;
  const W = grid.width, H = 580, FLOOR = 540, SIZE = grid.size, TOP = grid.top, ROW = grid.size;
  const bounds = { width: W, floor: FLOOR, radius: ballRadius };
  const colors = { lime: '#c4f568', purple: '#b7a1f7', orange: '#ffa675', cyan: '#77d9d2' };
  // El descenso (descenso.js): desde la ronda 100, y otra vez en la 200, 300,
  // 400 y 500, la máquina se pudre de a poco, fundida a lo largo de veinte
  // rondas. Solo cambia lo que se ve, se oye y se lee; la física no lo lee.
  const DSC = BBTANDescenso, T = DSC.TEXTOS;
  let corr = 0, pal = DSC.mezcla(0), etapaT = 0;
  const CSS_VARS = Object.keys(pal.css);
  // Peso de cada piso ya entrado (0..1): el 2 son las grietas, el 3 la
  // estática, el 4 los ojos, el 5 el vacío.
  const peso = j => clamp(corr - (j - 1), 0, 1);
  function paleta() {
    corr = DSC.corrupcion(round); pal = DSC.mezcla(corr); etapaT = DSC.etapa(corr);
    Object.assign(colors, { lime: pal.lime, purple: pal.purple, orange: pal.orange, cyan: pal.cyan });
    const html = document.documentElement;
    html.classList.toggle('descenso', corr > 0);
    for (let k = 2; k <= 5; k++) html.classList.toggle('desc-' + k, corr >= k - .5);
    for (const k of CSS_VARS) corr > 0 ? html.style.setProperty('--' + k, pal.css[k]) : html.style.removeProperty('--' + k);
  }
  // Cómo de rotas salen las letras: nada antes del tercer piso.
  const roto = s => DSC.corrompe(s, Math.max(0, (corr - 2) / 3), round);
  // Grietas fijas del segundo piso: siempre las mismas, crecen con el peso.
  const GRIETAS = (() => {
    let s = 0x5eed; const r = () => ((s = Math.imul(s ^ (s >>> 13), 0x5bd1e995) ^ (s << 7)) >>> 0) / 4294967296;
    const out = [];
    for (let i = 0; i < 7; i++) {
      let x = r() * W, y = r() * FLOOR; const pts = [[x, y]];
      for (let k = 0; k < 9; k++) { x += (r() - .5) * 60; y += (r() - .3) * 44; pts.push([x, y]); }
      out.push(pts);
    }
    return out;
  })();
  const PALABRAS = ['VETE', 'NO', 'APÁGALO', 'NADIE', 'FUERA', 'NO MIRES'];
  /* La música lee el tablero: cuántas filas quedan entre el bloque más bajo
     y el suelo, y cuántos bloques hay. Cinco veces por segundo basta. */
  let animoEn = 0;
  function animoMusica(now) {
    if (now - animoEn < 200) return;
    animoEn = now;
    let fondo = 0, vivos = 0;
    for (const b of blocks) if (b.hp > 0) { vivos++; fondo = Math.max(fondo, b.y + b.h); }
    const filas = vivos ? Math.max(0, Math.round((FLOOR - fondo) / ROW)) : 8;
    BBTANAudio.mood({ filas, bloques: vivos, ronda: round, disparando: state === 'shoot', descenso: corr });
  }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const number = n => Math.floor(n).toLocaleString('es-CL');
  const Club = window.Club || null;
  // Cada cuenta guarda su récord aparte (Club.storageKey), como el resto del club.
  const STORE = Club && Club.storageKey ? Club.storageKey('bbtan-after-hours-v1') : 'bbtan-after-hours-v1';
  const CATEGORIA = 'club-bbtan-rondas';
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { saved = {}; }
  if (!saved || typeof saved !== 'object') saved = {};
  let best = Number.isFinite(saved.best) ? Math.max(0, saved.best) : 0;
  let history = Array.isArray(saved.history) ? saved.history.filter(s => s && Number.isFinite(s.score) && s.score >= 0 && Number.isFinite(s.round)).sort((a,b) => b.score-a.score).slice(0,5) : [];
  let sound = saved.sound !== false, fast = false;
  let tocando = false; // la canción empieza con el primer tiro de cada partida
  let state, paused = false, pauseBeforeDialog = false, score, round, count, blocks, pickups, balls, particles, rings, floaters;
  let launchX, nextX, angle, queue, launchTimer, returned, gained, combo, mult, roundTimer, shotTime, shotRealTime, archived;
  let pointerDown = false, toastTime = 0, time = 0, lastFrame = 0, uiDirty = true, aimPoints = [], aimDirty = true;
  let hintSeen = false, clearCelebrated = false, clearTime = 0;
  let characterX = W / 2, throwKick = 0;
  // Tiempo jugado sin pausas, para desempatar en la clasificación.
  let activo = 0, reportada = false;
  // La clasificación es por ronda máxima alcanzada; el tiempo solo desempata.
  function reportar() {
    if (reportada || !Club || round < 2) return;
    reportada = true;
    try { Club.result({ categoria: CATEGORIA, puntos: round, tiempo: Math.max(1, Math.round(activo * 1000)) }); } catch {}
  }

  function persist() {
    try { localStorage.setItem(STORE, JSON.stringify({ best, history, sound })); }
    catch { $('storage-notice').textContent = 'Récord sin guardar'; }
  }
  function archive() {
    if (archived || score <= 0) return;
    archived = true; history.push({ score, round }); history.sort((a,b) => b.score-a.score); history = history.slice(0,5);
    best = Math.max(best, score); persist();
  }
  function setSound() {
    $('sound').setAttribute('aria-pressed', String(sound)); $('sound').setAttribute('aria-label', sound ? 'Desactivar sonido' : 'Activar sonido');
  }
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); toastTime = 2; }
  function blockColor(block) { return block.reinforced ? colors.orange : block.max >= 24 ? colors.orange : block.max >= 14 ? colors.purple : block.max >= 8 ? colors.cyan : colors.lime; }
  function pickupColor(p) { return p.kind === 'ball' ? colors.lime : p.kind === 'laser-h' ? colors.purple : p.kind === 'laser-v' ? colors.cyan : colors.orange; }
  function createRow(y) {
    const row = makeRow(round, y);
    blocks.push(...row.blocks); pickups.push(...row.pickups);
  }
  function reset() {
    state = 'aim'; paused = false; tocando = false; score = 0; round = 1; count = initialBalls; blocks = []; pickups = []; balls = []; particles = []; rings = []; floaters = [];
    launchX = W / 2; nextX = null; angle = -Math.PI / 2 - .26; queue = 0; returned = 0; gained = 0; combo = 0; mult = 1; shotTime = 0; shotRealTime = 0; roundTimer = 0; archived = false; activo = 0; reportada = false; fast = false; clearCelebrated = false; clearTime = 0;
    pointerDown = false; toastTime = 0; $('toast').classList.remove('visible');
    createRow(TOP); characterX = launchX; throwKick = 0; hintSeen = false; paleta(); animoEn = 0;
    $('overlay').hidden = true; $('pause').disabled = false; $('speed').setAttribute('aria-pressed','false'); $('speed-label').textContent = 'Velocidad ×1';
    aimDirty = true; uiDirty = true; updateUI();
  }
  function updateUI() {
    $('score').textContent = number(score); $('best').textContent = number(Math.max(best, score));
    $('round').textContent = String(round).padStart(2,'0');
    $('balls').textContent = String(count + gained).padStart(2,'0');
    $('multiplier').textContent = `×${mult}`;
    $('remaining').textContent = state === 'shoot' ? `● ${returned}/${count}` : `● ×${count}`;
    const E = T.estado, k = etapaT;
    $('status').textContent = clearTime > 0 && !paused && state !== 'over' ? 'PANTALLA LIMPIA' : state === 'shoot' && !paused && mult > 1 ? `COMBO ×${mult}`
      : roto(paused ? E.pause[k] : state === 'over' ? E.over[k] : state === 'shoot' ? E.shoot[k] : state === 'descend' ? E.descend[k] : E.aim[k]);
    $('recall').disabled = state !== 'shoot' || paused;
    $('pause').innerHTML = paused ? '<span>▶</span> Seguir' : '<span>Ⅱ</span> Pausa';
    BBTANAudio.music(sound && tocando && !paused && state !== 'over' && !document.hidden, round);
    uiDirty = false;
  }
  function updateSpeedLabel() {
    const pace = state === 'shoot' ? shotPace(shotRealTime, fast) : fast ? 3 : 1;
    const shown = Math.floor(pace * 10) / 10;
    const label = `Velocidad ×${shown === 1 || shown === 3 || shown === 4 ? shown : shown.toFixed(1)}`;
    if ($('speed-label').textContent !== label) $('speed-label').textContent = label;
  }
  function burst(x, y, color, amount = 12) {
    const n = reducedMotion ? 3 : amount;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, speed = 25 + Math.random() * 135;
      particles.push({ x, y, vx:Math.cos(a)*speed, vy:Math.sin(a)*speed, life:.35+Math.random()*.3, color, size:1+Math.random()*3 });
    }
    if (particles.length > 350) particles.splice(0, particles.length - 350);
  }
  function damage(block, amount = 1) {
    if (block.hp <= 0) return;
    const hits = Math.min(block.hp, amount); block.hp -= hits; block.flash = .12; score += hits * 10 * mult;
    if (block.hp <= 0) {
      score += 50 * mult; combo++;
      burst(block.x + SIZE/2, block.y + SIZE/2, blockColor(block));
      floaters.push({ x:block.x+SIZE/2, y:block.y+SIZE/2, text:`+${50*mult}`, color:blockColor(block), life:.7 });
      const next = Math.min(5, 1 + Math.floor(combo / 5));
      BBTANAudio.broken(combo);
      if (next > mult) { mult = next; toast(T.combo[etapaT](mult)); BBTANAudio.combo(mult); }
      if (hasClearedBoard(blocks, clearCelebrated)) celebrateClear();
    } else BBTANAudio.hit(block.hp);
    uiDirty = true;
  }
  function celebrateClear() {
    clearCelebrated = true; clearTime = 2.3;
    BBTANAudio.clear(); BBTANAudio.duck();
    for (let x = 55; x < W; x += 65) burst(x, 170 + Math.random() * 140, [colors.lime, colors.purple, colors.cyan][Math.floor(x / 65) % 3], 9);
    uiDirty = true;
  }
  function collect(ball) {
    for (const p of pickups) {
      if (!enterPickup(ball, p, bounds.radius)) continue;
      const color = pickupColor(p);
      burst(p.x,p.y,color,8); BBTANAudio.pickup(p.kind);
      if (p.kind === 'ball') {
        gained++; floaters.push({x:p.x,y:p.y,text:'+1 BOLA',color,life:1});
      } else {
        activatePowerup(ball, p, blocks, damage);
        // Refresh a beam instead of accumulating one effect per ball.
        const effect = rings.find(r => r.pickup === p);
        if (effect) effect.life = .35;
        else rings.push({kind:p.kind,pickup:p,x:p.x,y:p.y,life:.35,color});
      }
      uiDirty = true;
    }
  }
  function fire() {
    if (state !== 'aim' || paused || document.querySelector('dialog[open]')) return;
    BBTANAudio.unlock(); tocando = true; state = 'shoot'; queue = count; launchTimer = 0; returned = 0; gained = 0; combo = 0; mult = 1; nextX = null; shotTime = 0; shotRealTime = 0; hintSeen = true; uiDirty = true;
    canvas.focus({preventScroll:true}); BBTANAudio.launch();
  }
  function finishShot() {
    launchX = nextX === null ? launchX : clamp(nextX,26,W-26); count += gained; gained = 0;
    blocks = blocks.filter(b=>b.hp>0); pickups = pickups.filter(keepPickupNextRound);
    // Used beams and dispersers expire at the round transition, after every ball has returned.
    pickups = pickups.filter(p=>p.y+ROW<FLOOR-15);
    best = Math.max(best,score); persist();
    state = 'descend'; roundTimer = 0; blocks.forEach(b=>b.startY=b.y); pickups.forEach(p=>p.startY=p.y); updateSpeedLabel(); uiDirty=true;
  }
  function gameOver() {
    state = 'over'; archive(); reportar(); $('overlay').hidden = false;
    const f = T.fin[etapaT];
    $('overlay-label').textContent = roto(score >= best && score > 0 ? f.record : f.rotulo);
    $('overlay-title').innerHTML = `${f.titulo}<span>${f.signo}</span>`; $('overlay-copy').textContent = f.copia;
    $('result-stats').hidden = false; $('result-stats').innerHTML = `<div class="result-score">${number(score)}</div><div class="result-detail">PUNTOS · RONDA ${round} · ${count} BOLAS</div>`;
    $('resume').innerHTML = `${f.boton} <span>↗</span>`; $('overlay-restart').hidden = true; $('pause').disabled = true;
    $('resume').focus({preventScroll:true}); BBTANAudio.gameOver(); uiDirty = true;
  }
  function pause(value) {
    if (state === 'over') return;
    paused = value; pointerDown = false; $('overlay').hidden = !value;
    if (value) {
      const q = T.pausa[etapaT];
      $('overlay-label').textContent = roto(q.rotulo); $('overlay-title').innerHTML = `${q.titulo}<span>${q.signo}</span>`;
      $('overlay-copy').textContent = q.copia; $('result-stats').hidden = true;
      $('resume').innerHTML = `${q.boton} <span>↗</span>`; $('overlay-restart').hidden = false;
      $('resume').focus({preventScroll:true});
    } else canvas.focus({preventScroll:true});
    uiDirty=true;
  }
  function recall() {
    if (state !== 'shoot' || paused) return;
    if (nextX === null) nextX = balls.length ? balls[0].x : launchX;
    balls.forEach(b=>burst(b.x,b.y,'#e5f2d6',3)); balls=[]; queue=0; returned=count;
    toast(T.recall[etapaT]); finishShot();
  }
  function update(dt) {
    if (paused) return;
    time+=dt; if (state !== 'over') activo += dt;
    if (clearTime > 0) { clearTime = Math.max(0, clearTime - dt); if (clearTime === 0) uiDirty = true; }
    throwKick = Math.max(0, throwKick - dt * 9);
    if (state === 'descend') characterX += (launchX - characterX) * Math.min(1, dt * 16);
    if (toastTime>0) { toastTime-=dt; if (toastTime<=0) $('toast').classList.remove('visible'); }
    particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=130*dt;p.life-=dt;}); particles=particles.filter(p=>p.life>0);
    floaters.forEach(p=>{p.y-=25*dt;p.life-=dt;});floaters=floaters.filter(p=>p.life>0);
    rings.forEach(p=>p.life-=dt);rings=rings.filter(p=>p.life>0);
    blocks.forEach(b=>b.flash=Math.max(0,b.flash-dt));
    if (state==='shoot') {
      shotRealTime += dt;
      const elapsed = dt * shotPace(shotRealTime, fast);
      shotTime += elapsed; launchTimer -= elapsed;
      updateSpeedLabel();
      while(queue>0 && launchTimer<=0) {
        balls.push({x:launchX,y:FLOOR-1,vx:Math.cos(angle)*620,vy:Math.sin(angle)*620,trail:[]});queue--;launchTimer+=.065;throwKick=1;
      }
      for(let i=balls.length-1;i>=0;i--) {
        const b=balls[i]; b.trail.unshift({x:b.x,y:b.y});if(b.trail.length>5)b.trail.pop();
        if(stepBall(b,elapsed,blocks,bounds,damage,collect)) {
          if(nextX===null)nextX=b.x; returned++; balls.splice(i,1); uiDirty=true;
        }
      }
      if(queue===0 && balls.length===0)finishShot();
      else if(shotTime>35)recall();
    } else if(state==='descend') {
      roundTimer+=dt;const t=Math.min(1,roundTimer/.4), eased=1-Math.pow(1-t,3);
      blocks.forEach(b=>b.y=b.startY+ROW*eased);pickups.forEach(p=>p.y=p.startY+ROW*eased);
      if(t===1) {
        if(blocks.some(b=>b.hp>0 && b.y+b.h>=FLOOR-12))gameOver();
        else { round++;clearCelebrated=false;paleta();createRow(TOP);characterX=launchX;state='aim';aimDirty=true;uiDirty=true; const piso=DSC.DESDE.indexOf(round); if(piso>=0)toast(`RONDA ${round} · ${T.entrada[piso+1]}`);else if(round%5===0){const a=T.animo[etapaT];toast(roto(`RONDA ${round} · ${a[(round/5)%a.length]}`));} }
      }
    }
  }
  // Toque retro: esquinas rectas, bordes de 2 px con las esquinas mordidas y
  // bolas de píxeles. Todo se dibuja con fillRect en coordenadas enteras.
  const PIXEL = '"Press Start 2P",ui-monospace,monospace';
  function rounded(x,y,w,h) {ctx.beginPath();ctx.rect(x,y,w,h);}
  function pixelFrame(x,y,w,h,color) {
    x=Math.round(x);y=Math.round(y);ctx.fillStyle=color;
    ctx.fillRect(x+4,y+1,w-8,2);ctx.fillRect(x+4,y+h-3,w-8,2);ctx.fillRect(x+1,y+4,2,h-8);ctx.fillRect(x+w-3,y+4,2,h-8);
    ctx.fillRect(x+2,y+2,2,2);ctx.fillRect(x+w-4,y+2,2,2);ctx.fillRect(x+2,y+h-4,2,2);ctx.fillRect(x+w-4,y+h-4,2,2);
  }
  function pixelBall(x,y,r) {x=Math.round(x);y=Math.round(y);ctx.fillRect(x-r+2,y-r,r*2-4,r*2);ctx.fillRect(x-r,y-r+2,r*2,r*2-4);}
  function drawCharacter() {
    const w5 = peso(5), tic = !reducedMotion && w5 > 0 && Math.random() < .04 * w5 ? (Math.random() < .5 ? -1 : 1) : 0;
    const x = characterX + tic, y = FLOOR, scale = .48;
    const kick = reducedMotion ? 0 : throwKick;
    BBTANCharacter.draw(ctx, BBTANAppearance.get(), x - 9, y + 35, scale, {
      handX: (9 + Math.cos(angle) * kick * 5) / scale,
      handY: (-36 + Math.sin(angle) * kick * 5) / scale,
      maldad: corr
    });
    if (state === 'aim' || (state === 'shoot' && queue > 0)) {
      ctx.fillStyle = pal.bola; pixelBall(x,y-1,bounds.radius);
    }
    ctx.fillStyle=pal.texto; ctx.font=`7px ${PIXEL}`; ctx.textAlign='center';
    ctx.fillText(`×${state==='shoot'?queue:count}`,x,y-22);
  }
  function drawAim() {
    if(aimDirty) {
      aimPoints=[];const ghost={x:launchX,y:FLOOR-1,vx:Math.cos(angle)*620,vy:Math.sin(angle)*620};let hits=0, randomized=false;
      for(let i=0;i<145;i++) {
        const landed=stepBall(ghost,.008,blocks,bounds,()=>hits++,p=>{
          if(pickups.some(extra=>extra.alive && extra.kind==='scatter' && Math.hypot(p.x-extra.x,p.y-extra.y)<=bounds.radius+11))randomized=true;
        });
        if(i%3===0)aimPoints.push({x:ghost.x,y:ghost.y});
        if(landed || hits>=2 || randomized)break;
      }
      aimDirty=false;
    }
    const visibility = aimVisibility(round);
    aimPoints.forEach((p,i)=>{ctx.globalAlpha=((1-i/aimPoints.length)*.5+.08)*visibility;ctx.fillStyle=colors.lime;ctx.fillRect(Math.round(p.x)-1,Math.round(p.y)-1,3,3);});ctx.globalAlpha=1;
  }
  function draw() {
    const now=performance.now(), mov=!reducedMotion;
    ctx.clearRect(0,0,W,H);ctx.fillStyle=pal.bg;ctx.fillRect(0,0,W,H);
    if(corr>0){const r=mov?Math.sin(now/(900-60*Math.min(corr,5)))*.5+.5:.5,g=ctx.createRadialGradient(W/2,H*.45,60-6*Math.min(corr,5),W/2,H*.45,W*.85);g.addColorStop(0,'#00000000');g.addColorStop(1,pal.velo);ctx.globalAlpha=.75+.25*r;ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
    ctx.fillStyle=pal.puntos;for(let y=14;y<FLOOR;y+=19)for(let x=15;x<W;x+=19)ctx.fillRect(x,y,1,1);
    drawDescenso(now,mov);
    const danger=blocks.some(b=>b.hp>0 && b.y+b.h>FLOOR-ROW*2), w4=peso(4);
    if(danger){const gradient=ctx.createLinearGradient(0,FLOOR-100,0,FLOOR);gradient.addColorStop(0,'#ff846000');gradient.addColorStop(1,'#ff84600c');ctx.fillStyle=gradient;ctx.fillRect(0,FLOOR-100,W,100);}
    ctx.strokeStyle=danger?'#e48b69':pal.suelo;ctx.lineWidth=1;ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(12,FLOOR+7);ctx.lineTo(W-12,FLOOR+7);ctx.stroke();ctx.setLineDash([]);
    if(state==='aim' && !paused)drawAim();
    for(const b of blocks) {
      if(b.hp<=0)continue;const color=blockColor(b);
      ctx.fillStyle=color+'22';ctx.fillRect(Math.round(b.x)+3,Math.round(b.y)+3,b.w-6,b.h-6);
      ctx.fillStyle='#ffffff14';ctx.fillRect(Math.round(b.x)+4,Math.round(b.y)+4,b.w-8,2);
      pixelFrame(b.x,b.y,b.w,b.h,color);
      ctx.fillStyle=color+'55';ctx.fillRect(Math.round(b.x)+5,Math.round(b.y)+b.h-8,Math.round((b.w-10)*(b.hp/b.max)),2);
      if(b.flash>0){ctx.globalAlpha=b.flash*3;ctx.fillStyle=color;ctx.fillRect(Math.round(b.x)+1,Math.round(b.y)+1,b.w-2,b.h-2);ctx.globalAlpha=1;}
      ctx.font=`${b.hp>99?11:14}px ${PIXEL}`;ctx.textAlign='center';ctx.textBaseline='middle';
      let nx=Math.round(b.x+b.w/2)+1, ny=Math.round(b.y+b.h/2);
      if(w4>0){ // el número ya no se queda quieto: se desdobla en rojo y cian
        if(mov&&Math.random()<.012*w4){nx+=Math.random()<.5?-2:2;}
        ctx.globalAlpha=.55*w4;ctx.fillStyle='#ff1030';ctx.fillText(b.hp,nx-1,ny);ctx.fillStyle='#10e0ff';ctx.fillText(b.hp,nx+1,ny);ctx.globalAlpha=1;
      }
      ctx.fillStyle=color;ctx.fillText(b.hp,nx,ny);ctx.textBaseline='alphabetic';
    }
    for(const p of pickups) {
      if(!p.alive)continue;const color=pickupColor(p);
      const pulse=reducedMotion?0:Math.sin(time*3+p.x)*1.2;
      ctx.strokeStyle=color+'35';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,15+pulse,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle=color+'12';ctx.beginPath();ctx.arc(p.x,p.y,11,0,Math.PI*2);ctx.fill();ctx.strokeStyle=color;ctx.stroke();
      if(p.kind==='scatter') {
        ctx.lineWidth=1.4;ctx.beginPath();
        for(const dx of [-6,0,6]){ctx.moveTo(p.x,p.y+6);ctx.lineTo(p.x+dx,p.y-6);ctx.moveTo(p.x+dx-2,p.y-3);ctx.lineTo(p.x+dx,p.y-6);ctx.lineTo(p.x+dx+2,p.y-3);}ctx.stroke();
      } else {
        ctx.fillStyle=color;ctx.font=`${p.kind==='ball'?14:18}px ${p.kind==='ball'?PIXEL:'ui-monospace,monospace'}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.kind==='ball'?'+':p.kind==='laser-h'?'↔':'↕',p.x,p.y+.5);ctx.textBaseline='alphabetic';
      }
    }
    for(const effect of rings) {
      ctx.globalAlpha=Math.min(1,effect.life*3);ctx.strokeStyle=effect.color;ctx.lineWidth=effect.kind==='scatter'?2:3;ctx.beginPath();
      if(effect.kind==='laser-h'){ctx.moveTo(0,effect.y);ctx.lineTo(W,effect.y);}
      else if(effect.kind==='laser-v'){ctx.moveTo(effect.x,0);ctx.lineTo(effect.x,FLOOR);}
      else ctx.arc(effect.x,effect.y,(.35-effect.life)*75+12,0,Math.PI*2);
      ctx.stroke();ctx.globalAlpha=1;
    }
    for(const b of balls) {
      if(!reducedMotion)b.trail.forEach((p,i)=>{ctx.globalAlpha=(1-i/5)*.15;ctx.fillStyle=pal.estela;pixelBall(p.x,p.y,Math.max(3,Math.round(bounds.radius-1-i*.6)));});
      ctx.globalAlpha=1;ctx.fillStyle=pal.bola;pixelBall(b.x,b.y,bounds.radius);
    }
    if(state==='shoot' && nextX!==null) {
      ctx.fillStyle=colors.lime;pixelBall(nextX,FLOOR,bounds.radius);
      ctx.fillStyle=pal.texto;ctx.font=`7px ${PIXEL}`;ctx.textAlign='center';ctx.fillText(`+${returned}`,clamp(nextX,15,W-15),FLOOR-12);
    }
    drawCharacter();
    for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}ctx.globalAlpha=1;
    for(const p of floaters){ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle=p.color;ctx.font=`9px ${PIXEL}`;ctx.textAlign='center';ctx.fillText(p.text,p.x,p.y);}ctx.globalAlpha=1;
    if(mov&&corr>2)drawEstatica();
    if (clearTime > 0) drawClear();
  }
  // Lo que el descenso pone detrás de los bloques: grietas (piso 2), ojos
  // que parpadean en los huecos (piso 4) y palabras apenas visibles (piso 5).
  function drawDescenso(now,mov) {
    const w2=peso(2), w4=peso(4), w5=peso(5);
    if(w2>0){
      ctx.strokeStyle=pal.suelo;ctx.lineWidth=1;ctx.globalAlpha=.55*w2;ctx.beginPath();
      for(const g of GRIETAS){const n=Math.max(2,Math.ceil(g.length*w2));ctx.moveTo(g[0][0],g[0][1]);for(let i=1;i<n;i++)ctx.lineTo(g[i][0],g[i][1]);}
      ctx.stroke();ctx.globalAlpha=1;
    }
    if(w5>0){
      ctx.fillStyle=pal.texto;ctx.font=`20px ${PIXEL}`;ctx.textAlign='center';
      for(let i=0;i<3;i++){const x=40+((i*197+round*53)%(W-80)), y=80+((i*151+round*37)%(FLOOR-160));ctx.globalAlpha=.07*w5;ctx.fillText(PALABRAS[(round+i)%PALABRAS.length],x,y);}
      ctx.globalAlpha=1;
    }
    if(w4>0){
      ctx.fillStyle='#ff1a2e';
      for(let i=0;i<4;i++){
        const cx=30+((i*229+round*71)%(W-60)), cy=TOP+30+((i*113+round*29)%(FLOOR-TOP-120));
        const abierto=mov?Math.sin(now/650+i*2.3)>-.7:true;
        if(!abierto)continue;
        ctx.globalAlpha=w4*(.35+.25*(mov?Math.sin(now/300+i):0));
        ctx.fillRect(Math.round(cx-6),Math.round(cy),4,2);ctx.fillRect(Math.round(cx+3),Math.round(cy),4,2);
      }
      ctx.globalAlpha=1;
    }
  }
  // Estática (piso 3 en adelante): ruido de píxeles y, de vez en cuando, una
  // franja de la pantalla que se corre de lugar; en el vacío, un destello
  // invertido. Solo sin «reducir movimiento».
  function drawEstatica() {
    const w3=peso(3), w5=peso(5);
    ctx.fillStyle=pal.texto;
    for(let i=0,n=Math.round(90*w3+60*w5);i<n;i++){ctx.globalAlpha=.08+Math.random()*.18;ctx.fillRect(Math.random()*W|0,Math.random()*H|0,1+(Math.random()*2|0),1);}
    ctx.globalAlpha=1;
    if(Math.random()<.02*w3){
      const r=canvas.width/W, sy=Math.round((20+Math.random()*(FLOOR-40))*r), sh=Math.round((4+Math.random()*16)*r), dx=Math.round((Math.random()-.5)*14*r);
      ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(canvas,0,sy,canvas.width,sh,dx,sy,canvas.width,sh);ctx.restore();
    }
    if(Math.random()<.003*w5){ctx.save();ctx.globalCompositeOperation='difference';ctx.globalAlpha=.35;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);ctx.restore();}
  }
  function drawClear() {
    const age = 2.3 - clearTime;
    const alpha = Math.min(1, age * 6, clearTime * 1.5);
    const scale = reducedMotion ? 1 : 1 + .06 * Math.max(0, .45 - age);
    ctx.save(); ctx.globalAlpha = alpha;
    if (!reducedMotion) {
      ctx.strokeStyle = '#c4f568'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(W / 2, 276, 54 + age * 52, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.translate(W / 2, 278); ctx.scale(scale, scale);
    ctx.fillStyle = '#151d17f2'; ctx.fillRect(-138, -48, 276, 96);
    pixelFrame(-138, -48, 276, 96, '#a8d65d'); pixelFrame(-132, -42, 264, 84, '#a8d65d55');
    ctx.textAlign = 'center'; ctx.fillStyle = '#c4f568'; ctx.font = `30px ${PIXEL}`;
    ctx.fillStyle = '#3d5a1c'; ctx.fillText('NICE!', 3, 11); ctx.fillStyle = '#c4f568'; ctx.fillText('NICE!', 0, 8);
    ctx.fillStyle = '#e9f2d8'; ctx.font = `8px ${PIXEL}`;
    ctx.fillText('PANTALLA LIMPIA', 0, 30);
    ctx.restore();
  }
  function point(event) {const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*W/rect.width,y:(event.clientY-rect.top)*H/rect.height};}
  function aim(event) {
    if(state!=='aim'||paused)return false;
    const p=point(event);if(p.y>FLOOR-12)return false;
    angle=clamp(Math.atan2(p.y-FLOOR,p.x-launchX),-Math.PI+.15,-.15);aimDirty=true;return true;
  }
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0 || state!=='aim'||paused)return;pointerDown=true;canvas.setPointerCapture(event.pointerId);aim(event);});
  canvas.addEventListener('pointermove',event=>{if(event.pointerType==='mouse'||pointerDown)aim(event);});
  canvas.addEventListener('pointerup',event=>{if(!pointerDown)return;pointerDown=false;const valid=aim(event);if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(valid)fire();});
  canvas.addEventListener('pointercancel',()=>pointerDown=false);
  $('pause').addEventListener('click',()=>pause(!paused));
  $('resume').addEventListener('click',()=>state==='over'?reset():pause(false));
  $('speed').addEventListener('click',()=>{fast=!fast;$('speed').setAttribute('aria-pressed',String(fast));updateSpeedLabel();});
  $('recall').addEventListener('click',recall);
  $('sound').addEventListener('click',()=>{sound=!sound;BBTANAudio.setEnabled(sound);setSound();persist();if(sound)BBTANAudio.pickup('ball');uiDirty=true;});
  function openDialog(id) {pauseBeforeDialog=paused;if(state!=='over')pause(true);$(id).showModal();}
  $('customize').addEventListener('click',()=>{openDialog('customizer-dialog');BBTANAppearance.refresh();});
  $('restart').addEventListener('click',()=>openDialog('restart-dialog'));
  $('overlay-restart').addEventListener('click',()=>openDialog('restart-dialog'));
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.close).close()));
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{if(state!=='over')pause(pauseBeforeDialog);}));
  $('confirm-restart').addEventListener('click',()=>{archive();if(state!=='over')reportar();pauseBeforeDialog=false;$('restart-dialog').close();reset();});
  document.addEventListener('keydown',event=>{
    if(document.querySelector('dialog[open]')||event.ctrlKey||event.metaKey||event.altKey)return;
    const key=event.key.toLowerCase();
    if(['arrowleft','arrowright',' '].includes(key)&&event.target.tagName!=='BUTTON') {
      event.preventDefault();
      if(key===' ') {if(!event.repeat)fire();}
      else if(state==='aim'&&!paused){angle=clamp(angle+(key==='arrowleft'?-.035:.035),-Math.PI+.15,-.15);aimDirty=true;}
    }
    if(event.repeat)return;
    if(key==='p'||key==='escape')pause(!paused);
    if(key==='m')$('sound').click();
    if(key==='r')openDialog('restart-dialog');
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden && !paused && state!=='over')pause(true);if(document.hidden)BBTANAudio.music(false);uiDirty=true;});
  window.addEventListener('pagehide',()=>{best=Math.max(best,score);persist();});
  function resize() {const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);draw();}
  function frame(timestamp) {const dt=Math.min((timestamp-lastFrame)/1000||0,.035);lastFrame=timestamp;update(dt);if(blocks)animoMusica(timestamp);if(uiDirty)updateUI();draw();requestAnimationFrame(frame);}
  if(Club&&Club.category)Club.category(CATEGORIA);
  BBTANAudio.setEnabled(sound, false);setSound();reset();resize();window.addEventListener('resize',resize);requestAnimationFrame(frame);
})();
