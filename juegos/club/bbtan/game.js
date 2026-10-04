(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const { clamp, stepBall } = BBTANPhysics;
  const { grid, ballRadius, initialBalls, createRow: makeRow, enterPickup, activatePowerup, keepPickupNextRound, shotPace, aimVisibility, hasClearedBoard } = BBTANRules;
  const W = grid.width, H = 580, FLOOR = 540, SIZE = grid.size, TOP = grid.top, ROW = grid.size;
  const bounds = { width: W, floor: FLOOR, radius: ballRadius };
  const colors = { lime: '#c4f568', purple: '#b7a1f7', orange: '#ffa675', cyan: '#77d9d2' };
  // El descenso (descenso.js): desde la ronda 50 y hasta la 350 la máquina se
  // pudre de a poco, en cinco pisos fundidos uno tras otro, sin mesetas. Solo cambia lo que se ve, se oye y se lee; la física no lo lee.
  const DSC = BBTANDescenso, T = DSC.TEXTOS;
  // Y pasada la 350, el mundo perfecto: `cielo` (0..3) sube mientras el
  // descenso se deshace (corrupcionVista). Tampoco toca la jugabilidad.
  const TC = DSC.TEXTOS_CIELO;
  let corr = 0, pal = DSC.mezcla(0), etapaT = 0, cielo = 0, etapaC = 0;
  const CSS_VARS = Object.keys(pal.css);
  // Peso de cada piso ya entrado (0..1): el 2 son las grietas, el 3 la
  // estática, el 4 los ojos, el 5 el vacío.
  const peso = j => clamp(corr - (j - 1), 0, 1);
  // Lo mismo arriba: el 1 es dulce, el 2 radiante, el 3 perfecto.
  const pesoC = j => clamp(cielo - (j - 1), 0, 1);
  function paleta() {
    corr = DSC.corrupcionVista(round); cielo = DSC.perfeccion(round);
    pal = DSC.mezclaCielo(DSC.mezcla(corr), cielo); etapaT = DSC.etapa(corr); etapaC = DSC.etapaCielo(cielo);
    Object.assign(colors, { lime: pal.lime, purple: pal.purple, orange: pal.orange, cyan: pal.cyan });
    const html = document.documentElement, pinta = corr > 0 || cielo > 0;
    html.classList.toggle('descenso', corr > 0);
    html.classList.toggle('cielo', cielo > 0);
    // Nada cambia de golpe: el CSS lee los pesos y los funde en 3 s.
    for (let k = 2; k <= 5; k++) corr > 0 ? html.style.setProperty('--w' + k, peso(k).toFixed(3)) : html.style.removeProperty('--w' + k);
    for (let k = 1; k <= 3; k++) cielo > 0 ? html.style.setProperty('--p' + k, pesoC(k).toFixed(3)) : html.style.removeProperty('--p' + k);
    for (const k of CSS_VARS) pinta ? html.style.setProperty('--' + k, pal.css[k]) : html.style.removeProperty('--' + k);
    canvas.style.cursor = lento(3.4, 4.4) > .5 ? MIRA_ROJA : cielo > 1.2 ? CORAZON : '';
  }
  // Un efecto del cielo que entra entre dos perfecciones cualesquiera.
  const suave = (a, b) => clamp((cielo - a) / (b - a), 0, 1);
  const CORAZON = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\'%3E%3Cpath d=\'M12 20 4 12a4 4 0 0 1 8-5 4 4 0 0 1 8 5z\' fill=\'%23ff5fa8\' stroke=\'%23fff\' stroke-width=\'2\'/%3E%3C/svg%3E") 12 12, pointer';
  const CONFETI = ['#ff6fae', '#ffd84d', '#5ec8ff', '#6fdc8c', '#c58cff', '#ffffff'];
  // El texto de un piso: el del cielo si ya se nota, si no el del descenso.
  const tx = clave => etapaC ? TC[clave][etapaC] : T[clave][etapaT];
  // Un efecto que entra entre dos corrupciones cualesquiera, no en un piso.
  const lento = (a, b) => clamp((corr - a) / (b - a), 0, 1);
  // Un número fijo en [0,1) por entero: decide qué bloque mira, cuál sangra…
  const hsh = n => { n = Math.imul((n + 1) ^ ((n + 1) >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const MIRA_ROJA = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\'%3E%3Cpath d=\'M12 2v8M12 14v8M2 12h8M14 12h8\' stroke=\'%23ff1a2e\' stroke-width=\'2\'/%3E%3C/svg%3E") 12 12, crosshair';
  /* Un texto que se va convirtiendo en otro, letra a letra: con t de 0 a 1
     cada posición cambia en su propio momento (fijo por semilla), así una
     palabra pasa por mitades que no son ninguna de las dos. Con `vivo`, las
     letras que están por cambiar dudan. */
  function transmuta(a, b, t, semilla, vivo) {
    if (t <= 0) return a; if (t >= 1 && !vivo) return b;
    const n = Math.max(a.length, b.length); let out = '';
    for (let i = 0; i < n; i++) {
      const h = hsh(semilla * 31 + i) * .9 + .05;
      let usaB = t > h;
      if (vivo && Math.abs(t - h) < .08 && Math.random() < .35) usaB = !usaB;
      out += (usaB ? b[i] : a[i]) || '';
    }
    return out.replace(/\s+$/, '');
  }
  // El texto de un estado según la corrupción (o la perfección): fundido
  // entre los dos pisos.
  function fundeTexto(clave, semilla) {
    if (etapaC) {
      const arr = TC.estado[clave];
      if (cielo < 1) return arr[1];
      const i = Math.min(2, Math.floor(cielo));
      return transmuta(arr[i], arr[i + 1], cielo - i, semilla, false);
    }
    const arr = T.estado[clave], i = Math.min(4, Math.floor(corr)), t = corr - i;
    return roto(transmuta(arr[i], arr[i + 1], t, semilla, false));
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
    BBTANAudio.mood({ filas, bloques: vivos, ronda: round, disparando: state === 'shoot', descenso: corr, cielo });
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
  let characterX = W / 2, throwKick = 0, sombraX = W / 2, idSeq = 0, disparoDesdeCarga = false;
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
  // Cada 50 rondas el juego habla (voz.js, grabada en assets/voz): alegre,
  // luego roto, luego en contra tuya y en susurros, y desde la 350 perfecto.
  // La frase también se lee, por si el sonido está apagado.
  function hablaJuego() {
    const V = BBTANVoz, i = V.eleccion(round, Math.random()), frase = V.texto(round, i), animo = V.animo(round);
    toast(animo === 'alegre' ? frase.toUpperCase() : animo === 'susurro' ? frase.toLowerCase() : frase, Math.min(12, V.estimada(frase) + .8));
    const el = $('toast'); el.dataset.voz = animo;
    // Con el audio ya decodificado se sabe cuánto dura: el aviso lo espera.
    BBTANAudio.anuncio(round, i, dur => { if (el.dataset.voz === animo) toastTime = Math.max(toastTime, Math.min(14, dur + .5)); });
  }
  function toast(message, secs = 2) { delete $('toast').dataset.voz; $('toast').textContent = message; $('toast').classList.add('visible'); toastTime = secs; }
  function blockColor(block) { return block.reinforced ? colors.orange : block.max >= 24 ? colors.orange : block.max >= 14 ? colors.purple : block.max >= 8 ? colors.cyan : colors.lime; }
  function pickupColor(p) { return p.kind === 'ball' ? colors.lime : p.kind === 'laser-h' ? colors.purple : p.kind === 'laser-v' ? colors.cyan : colors.orange; }
  function createRow(y) {
    const row = makeRow(round, y);
    for (const b of row.blocks) b.id = idSeq++;
    blocks.push(...row.blocks); pickups.push(...row.pickups);
  }
  function reset() {
    state = 'aim'; paused = false; tocando = false; score = 0; round = 1; count = initialBalls; blocks = []; pickups = []; balls = []; particles = []; rings = []; floaters = [];
    launchX = W / 2; nextX = null; angle = -Math.PI / 2 - .26; queue = 0; returned = 0; gained = 0; combo = 0; mult = 1; shotTime = 0; shotRealTime = 0; roundTimer = 0; archived = false; activo = 0; reportada = false; fast = false; clearCelebrated = false; clearTime = 0; idSeq = 0;
    pointerDown = false; toastTime = 0; $('toast').classList.remove('visible'); BBTANAudio.calla();
    createRow(TOP); characterX = sombraX = launchX; throwKick = 0; hintSeen = false; paleta(); animoEn = 0;
    $('overlay').hidden = true; $('pause').disabled = false; $('speed').setAttribute('aria-pressed','false'); $('speed-label').textContent = 'Velocidad ×1';
    aimDirty = true; uiDirty = true; updateUI();
  }
  function updateUI() {
    $('score').textContent = number(score); $('best').textContent = number(Math.max(best, score));
    $('round').textContent = String(round).padStart(2,'0');
    $('balls').textContent = String(count + gained).padStart(2,'0');
    $('multiplier').textContent = `×${mult}`;
    $('remaining').textContent = state === 'shoot' ? `● ${returned}/${count}` : `● ×${count}`;
    $('status').textContent = clearTime > 0 && !paused && state !== 'over' ? 'PANTALLA LIMPIA' : state === 'shoot' && !paused && mult > 1 ? `COMBO ×${mult}`
      : paused ? fundeTexto('pause', 1) : state === 'over' ? fundeTexto('over', 2) : state === 'shoot' ? fundeTexto('shoot', 3) : state === 'descend' ? fundeTexto('descend', 4) : fundeTexto('aim', 5);
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
      // Con el descenso, parte de lo que salta ya no es luz: es sangre, y pesa.
      const sangre = Math.random() < .7 * lento(2, 4);
      // Arriba, en cambio, es confeti: de colores, liviano y dura más.
      const confeti = !sangre && Math.random() < suave(.2, 1);
      particles.push({ x, y, vx:Math.cos(a)*speed, vy:Math.sin(a)*speed-(confeti?40:0), life:(.35+Math.random()*.3)*(sangre?1.8:confeti?1.9:1), color:sangre?(Math.random()<.5?'#b00018':'#6a0010'):confeti?CONFETI[Math.random()*CONFETI.length|0]:color, size:confeti?2+Math.random()*2:1+Math.random()*3, g:sangre?420:confeti?70:130 });
    }
    if (particles.length > 350) particles.splice(0, particles.length - 350);
  }
  function damage(block, amount = 1) {
    if (block.hp <= 0) return;
    const hits = Math.min(block.hp, amount); block.hp -= hits; block.flash = .12; score += hits * 10 * mult;
    if (block.hp <= 0) {
      score += 50 * mult; combo++;
      burst(block.x + SIZE/2, block.y + SIZE/2, blockColor(block));
      floaters.push({ x:block.x+SIZE/2, y:block.y+SIZE/2, text:cielo>.5?(cielo>2.4&&Math.random()<.35?'¡GRACIAS!':`+${50*mult} ♥`):roto(`+${50*mult}`), color:blockColor(block), life:cielo>2.4?1.1:.7 });
      const next = Math.min(5, 1 + Math.floor(combo / 5));
      BBTANAudio.broken(combo);
      if (next > mult) { mult = next; toast(tx('combo')(mult)); BBTANAudio.combo(mult); }
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
        gained++; floaters.push({x:p.x,y:p.y,text:roto('+1 BOLA'),color,life:1});
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
    BBTANAudio.unlock(); tocando = true; disparoDesdeCarga = true; state = 'shoot'; queue = count; launchTimer = 0; returned = 0; gained = 0; combo = 0; mult = 1; nextX = null; shotTime = 0; shotRealTime = 0; hintSeen = true; uiDirty = true;
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
    state = 'over'; archive(); reportar(); borraPartida(); $('overlay').hidden = false;
    const f = tx('fin');
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
      const q = tx('pausa');
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
    toast(tx('recall')); finishShot();
  }
  function update(dt) {
    if (paused) return;
    time+=dt; if (state !== 'over') activo += dt;
    if (clearTime > 0) { clearTime = Math.max(0, clearTime - dt); if (clearTime === 0) uiDirty = true; }
    throwKick = Math.max(0, throwKick - dt * 9);
    if (state === 'descend') characterX += (launchX - characterX) * Math.min(1, dt * 16);
    sombraX += (characterX - sombraX) * Math.min(1, dt * 1.4);
    if (toastTime>0) { toastTime-=dt; if (toastTime<=0) $('toast').classList.remove('visible'); }
    particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.g||130)*dt;p.life-=dt;}); particles=particles.filter(p=>p.life>0);
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
        const b=balls[i]; b.trail.unshift({x:b.x,y:b.y});if(b.trail.length>largoEstela())b.trail.pop();
        if(stepBall(b,elapsed,blocks,bounds,damage,collect)) {
          if(nextX===null)nextX=b.x; returned++; balls.splice(i,1); uiDirty=true;
        }
      }
      if(queue===0 && balls.length===0)finishShot();
      else if(shotTime>35)recall();
    } else if(state==='descend') {
      // Abajo, los bloques dejan de bajar juntos: cada uno llega cuando
      // quiere y a tirones. Terminan en el mismo sitio; solo cambia el viaje.
      roundTimer+=dt;const lag=.25*peso(3), wj=peso(4);
      const baja=(o,sem)=>{const tb=clamp((roundTimer-lag*sem)/.4,0,1);o.y=o.startY+ROW*(tb>=1?1:1-Math.pow(1-tb,3)+wj*.12*Math.sin(tb*Math.PI)*Math.sin(tb*9));};
      blocks.forEach(b=>baja(b,hsh(b.id)));pickups.forEach(p=>baja(p,hsh(p.x|0)));
      if(roundTimer>=.4+lag) {
        if(blocks.some(b=>b.hp>0 && b.y+b.h>=FLOOR-12))gameOver();
        else { round++;clearCelebrated=false;paleta();createRow(TOP);characterX=launchX;state='aim';aimDirty=true;uiDirty=true; if(BBTANVoz.habla(round))hablaJuego();else if(round%5===0){const a=tx('animo');toast(roto(`RONDA ${round} · ${a[(round/5)%a.length]}`));} if((round+5)%50===0)BBTANAudio.prepara(round+5); guarda(); }
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
  // La sombra del personaje se despega: lo sigue tarde y cada vez más grande.
  const sombraLienzo=document.createElement('canvas');sombraLienzo.width=240;sombraLienzo.height=200;
  const sctx=sombraLienzo.getContext('2d');
  function drawSombra(opts) {
    const w=lento(3.8,5);if(w<=0)return;
    sctx.setTransform(1,0,0,1,0,0);sctx.clearRect(0,0,240,200);sctx.setTransform(2,0,0,2,0,0);
    BBTANCharacter.draw(sctx,BBTANAppearance.get(),51,90,.48,opts);
    sctx.setTransform(1,0,0,1,0,0);sctx.globalCompositeOperation='source-in';sctx.fillStyle='#060001';sctx.fillRect(0,0,240,200);sctx.globalCompositeOperation='source-over';
    const s=1+.7*w, ox=sombraX+14*w-9-51*s, oy=FLOOR+35-90*s;
    ctx.globalAlpha=.8*w;ctx.drawImage(sombraLienzo,ox,oy,120*s,100*s);ctx.globalAlpha=1;
    if(w>.5){const ex=sombraX+14*w-9, ey=FLOOR+35-49*s, abierto=!reducedMotion?Math.sin(performance.now()/900)>-.85:true;
      if(abierto){ctx.fillStyle='#ff1a2e';ctx.globalAlpha=(w-.5)*2;ctx.fillRect(Math.round(ex-6*s),Math.round(ey),3,2);ctx.fillRect(Math.round(ex+4*s),Math.round(ey),3,2);ctx.globalAlpha=1;}}
  }
  function drawCharacter() {
    const w5 = peso(5), tic = !reducedMotion && w5 > 0 && Math.random() < .04 * w5 ? (Math.random() < .5 ? -1 : 1) : 0;
    const x = characterX + tic, y = FLOOR, scale = .48;
    const kick = reducedMotion ? 0 : throwKick;
    const pose = {
      handX: (9 + Math.cos(angle) * kick * 5) / scale,
      handY: (-36 + Math.sin(angle) * kick * 5) / scale,
      maldad: corr,
      perfecto: cielo,
      t: reducedMotion ? 0 : performance.now()
    };
    drawSombra(pose);
    BBTANCharacter.draw(ctx, BBTANAppearance.get(), x - 9, y + 35, scale, pose);
    if (state === 'aim' || (state === 'shoot' && queue > 0)) {
      drawBola(x,y-1,0,-1,performance.now(),!reducedMotion,0);
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
    if(cielo>0)drawCielo(now,mov);
    drawDescenso(now,mov);
    drawCara(now,mov);
    const danger=blocks.some(b=>b.hp>0 && b.y+b.h>FLOOR-ROW*2), w4=peso(4);
    if(danger){const gradient=ctx.createLinearGradient(0,FLOOR-100,0,FLOOR);gradient.addColorStop(0,'#ff846000');gradient.addColorStop(1,'#ff84600c');ctx.fillStyle=gradient;ctx.fillRect(0,FLOOR-100,W,100);}
    ctx.strokeStyle=danger?'#e48b69':pal.suelo;ctx.lineWidth=1;ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(12,FLOOR+7);ctx.lineTo(W-12,FLOOR+7);ctx.stroke();ctx.setLineDash([]);
    if(state==='aim' && !paused)drawAim();
    const ojosB=lento(2,4.5), sangreB=lento(3,5), mira=objetivo(), caras=suave(.1,1);
    // Arriba todos los bloques saltan juntos, al mismo compás (solo a la vista).
    const brinco=mov&&cielo>1?Math.round(Math.sin(now/260)*2*suave(1,2)):0;
    if(brinco)ctx.save(),ctx.translate(0,brinco);
    for(const b of blocks) {
      if(b.hp<=0)continue;const color=blockColor(b);
      if(cielo>0){ctx.globalAlpha=.3*suave(0,.8);ctx.fillStyle=color;ctx.fillRect(Math.round(b.x)+3,Math.round(b.y)+3,b.w-6,b.h-6);ctx.globalAlpha=.5*suave(0,.8);ctx.fillStyle='#ffffff';ctx.fillRect(Math.round(b.x)+5,Math.round(b.y)+5,b.w-10,3);ctx.globalAlpha=1;}
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
      ctx.fillStyle=cielo>0?DSC.mezclaHex(color,'#5a1a40',.35*suave(0,1)):color;ctx.fillText(b.hp,nx,ny);ctx.textBaseline='alphabetic';
      if(hsh(b.id*7+3)<ojosB)ojosDeBloque(b,now,mov,mira);
      if(hsh(b.id+999)<sangreB)gotea(b,now,mov);
      if(cielo>0&&hsh(b.id*5+1)<caras)carita(b,now,mov,mira);
    }
    if(brinco)ctx.restore();
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
    balls.forEach((b,i)=>{if(!reducedMotion)drawEstelaBola(b,now,i);drawBola(b.x,b.y,b.vx,b.vy,now,mov,i);});
    if(state==='shoot' && nextX!==null) {
      drawBola(nextX,FLOOR,0,-1,now,mov,-1,colors.lime);
      ctx.fillStyle=pal.texto;ctx.font=`7px ${PIXEL}`;ctx.textAlign='center';ctx.fillText(`+${returned}`,clamp(nextX,15,W-15),FLOOR-12);
    }
    drawCharacter();
    for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}ctx.globalAlpha=1;
    for(const p of floaters){ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle=p.color;ctx.font=`9px ${PIXEL}`;ctx.textAlign='center';ctx.fillText(p.text,p.x,p.y);}ctx.globalAlpha=1;
    if(mov&&corr>2)drawEstatica();
    if (clearTime > 0) drawClear();
  }
  // Lo que se va apoderando del juego. Nada entra de golpe ni se anuncia: cada
  // cosa tiene su propio tramo de corrupción (`lento`) y crece en silencio.
  // La bola también se pudre, solo a la vista: primero un rescoldo rojo en el
  // centro y un halo que late, después un ojo que mira hacia donde vuela, y al
  // final un agujero negro de borde rojo. La estela pasa de copias a brasas y
  // humo que suben. El radio de choque no cambia.
  function drawBola(x,y,vx,vy,now,mov,sem,base) {
    if(cielo>.4)return drawBolaCielo(x,y,now,mov,sem);
    const r=bounds.radius, wA=lento(.8,2.6), wO=lento(2.4,4), wN=lento(4,5);
    const late=mov?.5+.5*Math.sin(now/(140-40*Math.min(1,wN))+sem*1.9):.5;
    if(wA>0){ctx.globalAlpha=(.12+.18*late)*wA;ctx.fillStyle=wN>.5?'#ff1030':DSC.mezclaHex('#ff9040','#ff1030',wA);pixelBall(x,y,r+2+Math.round(late*wA));ctx.globalAlpha=1;}
    let color=base||pal.bola;
    if(wO>0)color=DSC.mezclaHex(color,'#f0e0d8',wO*.6);
    if(wN>0)color=DSC.mezclaHex(color,'#0a0003',wN);
    if(wN>0){ctx.fillStyle=DSC.mezclaHex(color,'#ff1a2e',wN);pixelBall(x,y,r);ctx.fillStyle=color;pixelBall(x,y,r-1);}
    else{ctx.fillStyle=color;pixelBall(x,y,r);}
    x=Math.round(x);y=Math.round(y);
    if(wA>0&&wO<1){ctx.globalAlpha=wA*(1-wO)*(.6+.4*late);ctx.fillStyle='#ff2a1a';ctx.fillRect(x-1,y-1,2,2);ctx.globalAlpha=1;}
    if(wO>0){
      const v=Math.hypot(vx,vy)||1, dx=Math.round(vx/v*2), dy=Math.round(vy/v*2);
      const parpadea=mov&&Math.sin(now/600+sem*2.3)>.985;
      ctx.globalAlpha=wO;ctx.fillStyle=wN>.5?'#ff1a2e':'#a0101c';
      if(parpadea)ctx.fillRect(x-3,y,6,1);else{ctx.fillRect(x-2+dx,y-2+dy,4,4);ctx.fillStyle='#050000';ctx.fillRect(x-1+dx,y-1+dy,2,2);}
      ctx.globalAlpha=1;
    }
  }
  function drawEstelaBola(b,now,i) {
    if(cielo>.4)return drawEstelaCielo(b,now,i);
    const n=b.trail.length, wE=lento(1.5,4.5), wH=lento(2,4.2);
    const colorEstela=wE>0?DSC.mezclaHex(pal.estela,'#ff1030',wE):pal.estela;
    b.trail.forEach((p,j)=>{
      const f=j/n, sube=wH*f*f*18, deriva=wH*Math.sin(now/200+j*1.3+i)*3*f;
      ctx.globalAlpha=(1-f)*(.15+.2*wE);
      ctx.fillStyle=wH>0&&(j+i)%3===2?DSC.mezclaHex(colorEstela,'#2a1418',wH):wH>0&&j%4===1?DSC.mezclaHex(colorEstela,'#ffb040',wH*.7):colorEstela;
      const rr=Math.max(2,Math.round(bounds.radius-1-j*6/n));
      if(wH>.5&&j%2)ctx.fillRect(Math.round(p.x+deriva)-1,Math.round(p.y-sube)-1,2,2);else pixelBall(p.x+deriva,p.y-sube,rr);
    });
    ctx.globalAlpha=1;
  }
  const largoEstela = () => 5 + Math.round(10 * Math.max(lento(1.5, 4.5), suave(.5, 2)));
  // Lo que miran los ojos: la bola más alta en vuelo o, si no hay, tú.
  function objetivo() {
    let o = null;
    for (const b of balls) if (!o || b.y < o.y) o = b;
    return o ? { x: o.x, y: o.y } : { x: characterX, y: FLOOR - 20 };
  }
  function ojosDeBloque(b, now, mov, mira) {
    const bx = Math.round(b.x), by = Math.round(b.y) + 11;
    if (mov && Math.sin(now / 700 + b.id * 1.7) > .97) { ctx.fillStyle = '#1a0000'; ctx.fillRect(bx + 14, by + 2, 10, 1); ctx.fillRect(bx + 36, by + 2, 10, 1); return; }
    const dx = clamp((mira.x - (b.x + 30)) / 60, -1, 1), dy = clamp((mira.y - (b.y + 30)) / 60, -1, 1);
    for (const ex of [bx + 15, bx + 37]) {
      ctx.fillStyle = '#e8d8d0'; ctx.fillRect(ex, by, 8, 5);
      ctx.fillStyle = corr > 4 ? '#ff1a2e' : '#1a0000'; ctx.fillRect(ex + 3 + Math.round(dx * 2), by + 1 + Math.round(dy), 2, 3);
    }
    // cejas en V, más marcadas cuanto más abajo
    ctx.fillStyle = '#1a0000'; ctx.fillRect(bx + 14, by - 3, 4, 2); ctx.fillRect(bx + 18, by - 2, 4, 2); ctx.fillRect(bx + 38, by - 2, 4, 2); ctx.fillRect(bx + 42, by - 3, 4, 2);
  }
  function gotea(b, now, mov) {
    const x = Math.round(b.x + 10 + hsh(b.id + 11) * (b.w - 20)), y = Math.round(b.y + b.h - 2);
    const f = mov ? (now / 1600 + hsh(b.id + 5)) % 1 : .6, largo = Math.round(4 + f * 14);
    ctx.fillStyle = '#8a0010'; ctx.fillRect(x, y, 2, largo); ctx.fillRect(x - 1, y + largo, 4, 3);
    if (f > .85 && mov) { ctx.globalAlpha = (1 - f) / .15; ctx.fillRect(x, y + largo + 6 + (f - .85) * 120, 2, 3); ctx.globalAlpha = 1; }
  }
  /* Una cara hecha con los mismos puntos de la cuadrícula: ojos rasgados,
     sonrisa con dientes y cuernos. Los puntos solo se encienden en rojo, así
     que al principio no se ve la cara, se ve que la cuadrícula está rara. */
  const CARA = (() => {
    const out = [], dSeg = (x, y, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy), 0, 1); return Math.hypot(x - ax - vx * t, y - ay - vy * t); };
    for (let y = 14; y < FLOOR; y += 19) for (let x = 15; x < W; x += 19) {
      let m = 0;
      for (const s of [-1, 1]) {
        const dx = x - (W / 2 + 75 * s), dy = y - 200;
        if ((dx / 50) ** 2 + (dy / 26) ** 2 < 1 && dy > -12 - .45 * dx * s) m = 1;
        if (dSeg(x, y, W / 2 + 110 * s, 130, W / 2 + 150 * s, 40) < 9) m = Math.max(m, .8);
      }
      const dx = x - W / 2, curva = 360 - .004 * dx * dx;
      if (Math.abs(dx) < 150) {
        if (Math.abs(y - curva) < 9.5) m = 1;
        else if (y > curva && y - curva < 30 && Math.round((x - 15) / 19) % 2 === 0) m = Math.max(m, .7);
      }
      if (m) out.push([x, y, m]);
    }
    return out;
  })();
  const VENAS = (() => {
    let s = 0xbadc0de; const r = () => ((s = Math.imul(s ^ (s >>> 13), 0x5bd1e995) ^ (s << 7)) >>> 0) / 4294967296;
    const out = [];
    for (const [x0, y0] of [[0, 0], [W, 0], [0, FLOOR], [W, FLOOR]]) for (let k = 0; k < 3; k++) {
      let x = x0, y = y0, a = Math.atan2(FLOOR / 2 - y0, W / 2 - x0) + (r() - .5) * 1.2; const pts = [[x, y]];
      for (let i = 0; i < 14; i++) { a += (r() - .5) * .8; x += Math.cos(a) * 14; y += Math.sin(a) * 14; pts.push([x, y]); if (r() < .18 && pts.length > 3) { const b = [[x, y]]; let bx = x, by = y, ba = a + (r() < .5 ? -1 : 1) * .9; for (let j = 0; j < 5; j++) { ba += (r() - .5) * .7; bx += Math.cos(ba) * 10; by += Math.sin(ba) * 10; b.push([bx, by]); } out.push({ pts: b, desde: i / 14 }); } }
      out.push({ pts, desde: 0 });
    }
    return out;
  })();
  function latido(now) { const f = (now / 1100) % 1; return Math.exp(-f * 14) + .6 * Math.exp(-Math.max(0, f - .18) * 14) * (f > .18); }
  function drawCara(now, mov) {
    const wf = lento(1.2, 4), wv = lento(2, 4.5), wp = lento(3.5, 5), lat = mov ? latido(now) : .3;
    if (wv > 0) {
      ctx.lineCap = 'square';
      for (const [ancho, color, alfa] of [[2, '#5a0010', .5], [1, '#a0001a', .35]]) {
        ctx.strokeStyle = color; ctx.lineWidth = ancho; ctx.globalAlpha = wv * (alfa + .35 * lat); ctx.beginPath();
        for (const v of VENAS) {
          const vis = (wv - v.desde) / (1 - v.desde); if (vis <= 0) continue;
          const n = Math.max(2, Math.ceil(v.pts.length * Math.min(1, vis)));
          ctx.moveTo(v.pts[0][0], v.pts[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(v.pts[i][0], v.pts[i][1]);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.lineCap = 'butt';
    }
    if (wp > 0) {
      const g = mov ? now / 40000 : 0, cx = W / 2, cy = 290, r = 150;
      ctx.strokeStyle = '#ff1a2e'; ctx.lineWidth = 1; ctx.globalAlpha = wp * (.07 + .04 * lat); ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.moveTo(cx + r * .92 * Math.cos(g - Math.PI / 2), cy + r * .92 * Math.sin(g - Math.PI / 2));
      for (let i = 1; i <= 5; i++) { const a = g - Math.PI / 2 + i * Math.PI * 4 / 5; ctx.lineTo(cx + r * .92 * Math.cos(a), cy + r * .92 * Math.sin(a)); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (wf > 0) {
      const pulso = mov ? Math.sin(now / 1700) * .5 + .5 : .5;
      ctx.fillStyle = '#ff1a2e';
      for (const [x, y, m] of CARA) { const k = m * wf, t = 1 + Math.round(k * 2); ctx.globalAlpha = k * (.35 + .2 * pulso); ctx.fillRect(x - (t >> 1), y - (t >> 1), t, t); }
      const wo = lento(2.5, 4.5);
      if (wo > 0) {
        const o = objetivo();
        for (const s of [-1, 1]) {
          const cx = W / 2 + 75 * s, cy = 204, a = Math.atan2(o.y - cy, o.x - cx), d = Math.min(14, Math.hypot(o.x - cx, o.y - cy) / 20);
          ctx.globalAlpha = wo * (.5 + .3 * lat); ctx.fillRect(Math.round(cx + Math.cos(a) * d) - 2, Math.round(cy + Math.sin(a) * d * .6) - 3, 4, 6);
        }
      }
      ctx.globalAlpha = 1;
    }
  }
  /* Los rótulos cambian de nombre letra a letra, sin avisar. Mientras están
     a medio camino, de vez en cuando se asoma la palabra entera un instante. */
  const ETIQUETAS = [['PUNTAJE', 'PECADOS', 1.2, 3.6], ['RÉCORD', 'CONDENA', 1.6, 4.0], ['RONDA', 'CÍRCULO', 2.0, 4.3], ['BOLAS', 'ALMAS', 2.4, 4.6]];
  // Y arriba se vuelven otra cosa: todo es alegría.
  const ETIQUETAS_CIELO = [['ALEGRÍA', .6, 1.6], ['ORGULLO', .9, 1.9], ['SONRISA', 1.2, 2.2], ['AMIGOS', 1.5, 2.5]];
  const RETULOS = [...document.querySelectorAll('.score-strip span')], TITULO = document.querySelector('.game-header h1');
  let mutaEn = 0;
  function mutaciones(now) {
    if (now - mutaEn < 120) return; mutaEn = now;
    const vivo = !reducedMotion;
    ETIQUETAS.forEach(([a, b, d, h], i) => {
      const el = RETULOS[i]; if (!el) return;
      const t = lento(d, h), susurro = vivo && t > 0 && t < 1 && Math.random() < .015 * t;
      let txt = susurro ? b : transmuta(a, b, t, 40 + i, vivo && t < 1);
      if (cielo > 0) { const [c, dc, hc] = ETIQUETAS_CIELO[i], tc = suave(dc, hc); txt = transmuta(txt, c, tc, 60 + i, vivo && tc > 0 && tc < 1); }
      if (el.textContent !== txt) el.textContent = txt;
      el.classList.toggle('susurro', susurro);
    });
    const t = lento(2.6, 4.8), tc = suave(1.4, 2.4);
    let nombre = transmuta('BBTAN', 'SATAN', t, 77, vivo && t > 0 && t < 1);
    if (cielo > 0) nombre = transmuta(nombre, 'BBTAN :)', tc, 78, vivo && tc > 0 && tc < 1);
    if (TITULO && TITULO.firstChild && TITULO.firstChild.nodeValue !== nombre) { TITULO.firstChild.nodeValue = nombre; document.title = nombre; }
  }
  /* La partida guardada: se escribe al empezar cada ronda (desde la 2) en el
     navegador y, dentro de Juegos, en la cuenta (users/<uid>/club/bbtan). Se
     vuelve al principio de esa ronda; al terminar la partida se borra. */
  const PARTIDA = Club && Club.storageKey ? Club.storageKey('bbtan-partida-v1') : 'bbtan-partida-v1';
  function foto() {
    return { v: 1, at: Date.now(), score, round, count, launchX, angle, activo, reportada, clearCelebrated, idSeq,
      blocks: blocks.filter(b => b.hp > 0).map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h, hp: b.hp, max: b.max, reinforced: b.reinforced, id: b.id })),
      pickups: pickups.filter(p => p.alive).map(p => ({ x: p.x, y: p.y, kind: p.kind })) };
  }
  function guarda() {
    if (round < 2 || state === 'over') return;
    const txt = JSON.stringify(foto());
    try { localStorage.setItem(PARTIDA, txt); } catch {}
    try { Club && Club.guardarPartida && Club.guardarPartida(txt); } catch {}
  }
  function borraPartida() {
    try { localStorage.removeItem(PARTIDA); } catch {}
    try { Club && Club.guardarPartida && Club.guardarPartida(null); } catch {}
  }
  const fin = v => Number.isFinite(+v);
  function valida(d) {
    return !!d && d.v === 1 && Number.isInteger(d.round) && d.round >= 2 && [d.score, d.count, d.launchX, d.angle, d.at].every(fin)
      && Array.isArray(d.blocks) && Array.isArray(d.pickups) && d.blocks.every(b => b && [b.x, b.y, b.hp, b.max].every(fin)) && d.pickups.every(p => p && fin(p.x) && fin(p.y) && typeof p.kind === 'string');
  }
  function lee(txt) { try { const d = typeof txt === 'string' ? JSON.parse(txt) : txt; return valida(d) ? d : null; } catch { return null; } }
  function restaura(d) {
    state = 'aim'; paused = false; score = +d.score; round = d.round; count = Math.max(1, d.count | 0);
    launchX = clamp(+d.launchX, 26, W - 26); angle = clamp(+d.angle, -Math.PI + .15, -.15); nextX = null; queue = 0;
    activo = fin(d.activo) ? +d.activo : 0; reportada = !!d.reportada; clearCelebrated = !!d.clearCelebrated; archived = false;
    blocks = d.blocks.map(b => ({ x: +b.x, y: +b.y, w: SIZE, h: SIZE, hp: +b.hp, max: +b.max, reinforced: !!b.reinforced, id: b.id | 0, flash: 0 }));
    idSeq = Math.max(d.idSeq | 0, ...blocks.map(b => b.id + 1));
    pickups = d.pickups.map(p => ({ x: +p.x, y: +p.y, kind: p.kind, alive: true }));
    balls = []; particles = []; rings = []; floaters = [];
    characterX = sombraX = launchX; hintSeen = true; $('overlay').hidden = true; $('pause').disabled = false;
    paleta(); aimDirty = true; uiDirty = true; updateUI(); toast(`Partida recuperada · ronda ${round}`);
    const prox = Math.ceil((round + 1) / 50) * 50; if (prox - round <= 5) BBTANAudio.prepara(prox);
  }
  function cargaPartida() {
    let local = null;
    try { local = lee(localStorage.getItem(PARTIDA)); } catch {}
    if (local) restaura(local);
    const localAt = local ? local.at : 0;
    if (!Club || !Club.pedirPartida) return;
    Club.pedirPartida(dato => {
      if (disparoDesdeCarga || !dato || !(dato.at > localAt)) return;
      const nube = lee(dato.d);
      if (nube) { restaura(nube); try { localStorage.setItem(PARTIDA, dato.d); } catch {} }
      else if (dato.d == null && local) { try { localStorage.removeItem(PARTIDA); } catch {} reset(); }
    });
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
  /* El mundo perfecto (desde la 350). Es el descenso al revés: cada cosa
     entra en su propio tramo de perfección (`suave`) y nada se anuncia. Primero
     es bonito —cielo celeste, un sol, nubes, bloques con carita, bolas de
     colores y confeti—; después es radiante —un arcoíris, las nubes sonríen,
     los bloques abren los ojos y todo salta al mismo compás—; y al final es
     perfecto, que es lo incómodo: el sol crece, todas las caras dejan de mirar
     la bola y te miran a ti, las sonrisas no caben en la cara, y muy de vez en
     cuando, un instante, se ve lo que hay debajo. */
  const INK = '#5a1a40';
  const NUBES = [[40, 34, 1], [210, 88, .8], [330, 26, 1.1], [120, 150, .7]];
  const FELICES = ['TODO ESTÁ BIEN', 'SONRÍE', 'PERFECTO', 'QUÉDATE', 'NO MIRES DEBAJO'];
  let debajo = -1e9;
  function drawCielo(now, mov) {
    const w1 = suave(0, 1), w2 = suave(1, 2), w3 = suave(2, 3), o = objetivo();
    const g = ctx.createLinearGradient(0, 0, 0, FLOOR);
    g.addColorStop(0, '#bfe6ff'); g.addColorStop(.6, pal.bg);
    ctx.globalAlpha = .85 * w1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, FLOOR + 40); ctx.globalAlpha = 1;
    // Destellos en la cuadrícula: los mismos puntos, que ahora titilan.
    if (w1 > 0) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 26; i++) {
        const x = 15 + 19 * Math.floor(hsh(i * 3) * 22), y = 14 + 19 * Math.floor(hsh(i * 3 + 1) * 28);
        const f = mov ? Math.sin(now / 400 + i * 1.7) : .5; if (f < .2) continue;
        ctx.globalAlpha = w1 * f * .9; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
      }
      ctx.globalAlpha = 1;
    }
    if (w2 > 0) {
      ctx.lineWidth = 6;
      ['#ff8fb8', '#ffc36b', '#fff07a', '#8ff0a8', '#8fd3ff', '#c9a0ff'].forEach((c, i) => {
        ctx.strokeStyle = c; ctx.globalAlpha = .3 * w2; ctx.beginPath(); ctx.arc(W / 2, FLOOR + 40, 290 - i * 6, Math.PI, 2 * Math.PI); ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
    // Las nubes derivan; al final se quedan quietas, mirándote.
    NUBES.forEach(([x0, y, e], i) => {
      const x = ((x0 + (mov ? now / 90 * (.25 + i * .07) * (1 - w3) : 0)) % (W + 90)) - 45;
      nube(x, y, e, w1, w2, w3, now, mov, i);
    });
    sol(W - 58, 42, 17 + 9 * w3, w1, w2, w3, now, mov, o);
    if (w2 > 0 && mov) { // corazones que suben
      for (let i = 0; i < 6; i++) {
        const f = (now / 5200 + hsh(i + 70)) % 1, x = 20 + hsh(i + 80) * (W - 40) + Math.sin(now / 600 + i) * 8, y = FLOOR - f * (FLOOR - 40);
        ctx.globalAlpha = w2 * .35 * Math.sin(f * Math.PI); corazon(x, y, CONFETI[i % 5], 1); ctx.globalAlpha = 1;
      }
    }
    if (w3 > 0) { // las palabras felices del fondo, como las otras
      ctx.fillStyle = '#ff5fa8'; ctx.font = `16px ${PIXEL}`; ctx.textAlign = 'center';
      for (let i = 0; i < 3; i++) { const x = 60 + ((i * 197 + round * 53) % (W - 120)), y = 120 + ((i * 151 + round * 37) % (FLOOR - 220)); ctx.globalAlpha = .07 * w3; ctx.fillText(FELICES[(round + i) % FELICES.length], x, y); }
      ctx.globalAlpha = 1;
    }
    if (w1 > 0) { // flores en el suelo
      ctx.globalAlpha = w1;
      for (let x = 12; x < W; x += 26) {
        const c = CONFETI[(x / 26 | 0) % 5], b = mov && cielo > 1 ? Math.round(Math.sin(now / 260) * suave(1, 2)) : 0;
        ctx.fillStyle = '#7fd88f'; ctx.fillRect(x, FLOOR + 24, 1, 9); ctx.fillRect(x + 1, FLOOR + 29, 2, 1);
        ctx.fillStyle = c; ctx.fillRect(x - 2, FLOOR + 21 + b, 5, 3); ctx.fillRect(x - 1, FLOOR + 20 + b, 3, 5);
        ctx.fillStyle = '#fff07a'; ctx.fillRect(x, FLOOR + 22 + b, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    // Lo de debajo: al final, rarísima vez y por un instante, asoma la cara.
    if (mov && w3 > .6 && Math.random() < .0008 * w3) debajo = now;
    if (now - debajo < 90) {
      ctx.fillStyle = '#ff1a2e'; ctx.globalAlpha = .08; ctx.fillRect(0, 0, W, H);
      for (const [x, y, m] of CARA) { ctx.globalAlpha = .55 * m; ctx.fillRect(x - 1, y - 1, 3, 3); }
      ctx.globalAlpha = 1;
    }
  }
  function nube(x, y, e, w1, w2, w3, now, mov, i) {
    x = Math.round(x); y = Math.round(y);
    ctx.globalAlpha = .9 * w1; ctx.fillStyle = '#ffffff';
    const R = (a, b, c, d) => ctx.fillRect(x + Math.round(a * e), y + Math.round(b * e), Math.round(c * e), Math.round(d * e));
    R(0, 8, 56, 14); R(8, 2, 20, 8); R(24, -4, 22, 12); R(44, 4, 10, 6);
    ctx.globalAlpha = 1;
    if (w2 > .3) { // una carita, primero con ojos felices y al final abiertos
      const cx = x + Math.round(28 * e), cy = y + Math.round(12 * e);
      ctx.globalAlpha = Math.min(1, (w2 - .3) * 2); ctx.fillStyle = INK;
      if (w3 > .5) { const d = mov ? Math.round(clamp((characterX - cx) / 120, -1, 1)) : 0; ctx.fillRect(cx - 7 + d, cy - 2, 2, 3); ctx.fillRect(cx + 5 + d, cy - 2, 2, 3); }
      else { ctx.fillRect(cx - 8, cy - 1, 2, 1); ctx.fillRect(cx - 6, cy - 2, 2, 1); ctx.fillRect(cx + 4, cy - 2, 2, 1); ctx.fillRect(cx + 6, cy - 1, 2, 1); }
      const a = 4 + Math.round(6 * w3); ctx.fillRect(cx - a, cy + 3, a * 2, 1); ctx.fillRect(cx - a - 1, cy + 2, 1, 1); ctx.fillRect(cx + a, cy + 2, 1, 1);
      ctx.fillStyle = '#ff8fb8'; ctx.globalAlpha *= .6; ctx.fillRect(cx - 13, cy + 1, 4, 2); ctx.fillRect(cx + 9, cy + 1, 4, 2);
      ctx.globalAlpha = 1;
    }
  }
  function sol(x, y, r, w1, w2, w3, now, mov, o) {
    const giro = mov ? now / 3000 : 0;
    ctx.globalAlpha = w1; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = giro + i * Math.PI / 5, l = r + 6 + (i % 2) * 5; ctx.moveTo(x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3)); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); }
    ctx.stroke();
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3a8'; ctx.beginPath(); ctx.arc(x - r * .3, y - r * .3, r * .35, 0, Math.PI * 2); ctx.fill();
    // La cara: al principio ojos felices; al final te sigue con la mirada.
    ctx.fillStyle = INK;
    if (w2 > .5) {
      const a = Math.atan2(o.y - y, o.x - x), d = 2 * w2;
      for (const s of [-1, 1]) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x + s * r * .35) - 3, Math.round(y - r * .2) - 3, 6, 6); ctx.fillStyle = INK; ctx.fillRect(Math.round(x + s * r * .35 + Math.cos(a) * d) - 1, Math.round(y - r * .2 + Math.sin(a) * d) - 1, 2 + (w3 > .5 ? 0 : 1), 2 + (w3 > .5 ? 0 : 1)); }
    } else for (const s of [-1, 1]) { const ex = Math.round(x + s * r * .35), ey = Math.round(y - r * .2); ctx.fillRect(ex - 3, ey, 2, 1); ctx.fillRect(ex - 1, ey - 1, 2, 1); ctx.fillRect(ex + 1, ey, 2, 1); }
    const ancho = r * (.45 + .45 * w3);
    ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(x, y + r * .05, ancho, .15 * Math.PI, .85 * Math.PI); ctx.stroke();
    if (w3 > .6) { ctx.fillStyle = '#ffffff'; for (let i = -3; i <= 3; i++) ctx.fillRect(Math.round(x + i * ancho * .22) - 1, Math.round(y + r * .05 + ancho * .85) - 2, 2, 2); }
    ctx.fillStyle = '#ff8fb8'; ctx.globalAlpha = .5 * w1; ctx.fillRect(Math.round(x - r * .75), Math.round(y + r * .15), 5, 3); ctx.fillRect(Math.round(x + r * .75) - 5, Math.round(y + r * .15), 5, 3);
    ctx.globalAlpha = 1;
  }
  // Una carita en el bloque. Cuando lo golpean, cierra los ojos de gusto.
  function carita(b, now, mov, mira) {
    const x = Math.round(b.x), y = Math.round(b.y), w2 = suave(1.6, 2.4), w3 = suave(2.4, 3);
    ctx.fillStyle = INK;
    if (w2 < .5 || b.flash > 0) {
      for (const ex of [x + 16, x + 38]) { ctx.fillRect(ex, y + 16, 2, 2); ctx.fillRect(ex + 2, y + 14, 2, 2); ctx.fillRect(ex + 4, y + 16, 2, 2); }
    } else {
      // Abiertos: miran la bola; al final, todos a la vez, te miran a ti.
      const o = w3 > .5 ? { x: characterX, y: FLOOR - 30 } : mira;
      const dx = Math.round(clamp((o.x - (b.x + 30)) / 60, -1, 1) * 2), dy = Math.round(clamp((o.y - (b.y + 30)) / 60, -1, 1) * 2);
      const p = w3 > .5 ? 2 : 3;
      for (const ex of [x + 15, x + 37]) { ctx.fillStyle = '#ffffff'; ctx.fillRect(ex, y + 11, 9, 9); ctx.fillStyle = INK; ctx.fillRect(ex + 4 - (p >> 1) + dx, y + 15 - (p >> 1) + dy, p, p); }
    }
    ctx.globalAlpha = .6; ctx.fillStyle = '#ff8fb8'; ctx.fillRect(x + 8, y + 22, 6, 3); ctx.fillRect(x + 46, y + 22, 6, 3); ctx.globalAlpha = 1;
    // La sonrisa crece con la perfección hasta no caber en la cara.
    const ancho = Math.round(10 + 34 * suave(1, 3)), mx = x + 30 - (ancho >> 1), my = y + 41;
    ctx.fillStyle = INK; ctx.fillRect(mx, my, ancho, 2); ctx.fillRect(mx - 2, my - 2, 2, 2); ctx.fillRect(mx + ancho, my - 2, 2, 2);
    if (w2 > 0) {
      const alto = 1 + Math.round(4 * w2);
      ctx.fillRect(mx + 1, my + 2, ancho - 2, alto);
      ctx.fillStyle = '#ffffff'; for (let i = 2; i < ancho - 3; i += 4) ctx.fillRect(mx + i, my + 2, 3, Math.min(2, alto));
    }
  }
  // Un corazón de píxeles de 13×11, centrado en (x, y).
  const CORAZON_PX = ['..XXX...XXX..', '.XXXXX.XXXXX.', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX', '.XXXXXXXXXXX.', '..XXXXXXXXX..', '...XXXXXXX...', '....XXXXX....', '.....XXX.....', '......X......'];
  function corazon(x, y, color, e = 1) {
    x = Math.round(x - 6.5 * e); y = Math.round(y - 5.5 * e); ctx.fillStyle = color;
    CORAZON_PX.forEach((fila, j) => { const a = fila.indexOf('X'), b = fila.lastIndexOf('X'); ctx.fillRect(x + Math.round(a * e), y + Math.round(j * e), Math.round((b - a + 1) * e), Math.max(1, Math.round(e))); });
  }
  // La bola de arriba: de todos los colores, luego un corazón, luego con cara.
  function drawBolaCielo(x, y, now, mov, sem) {
    const r = bounds.radius, h = ((mov ? now / 5 : 0) + sem * 47) % 360, color = `hsl(${h} 95% 64%)`;
    ctx.globalAlpha = .25 + .15 * suave(1, 2); ctx.fillStyle = color; pixelBall(x, y, r + 2 + (mov && cielo > 1 ? Math.round(Math.sin(now / 150 + sem) + 1) : 0)); ctx.globalAlpha = 1;
    if (suave(1.1, 1.9) > .5) corazon(x, y + 1, color, 1); else { ctx.fillStyle = color; pixelBall(x, y, r); }
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y - 3, 2, 2);
    if (suave(2.2, 2.8) > .5) { ctx.fillStyle = INK; ctx.fillRect(x - 2, y - 1, 1, 2); ctx.fillRect(x + 1, y - 1, 1, 2); ctx.fillRect(x - 2, y + 2, 4, 1); }
  }
  function drawEstelaCielo(b, now, i) {
    const n = b.trail.length;
    b.trail.forEach((p, j) => {
      const f = j / n, h = (now / 5 + i * 47 + j * 24) % 360;
      ctx.globalAlpha = (1 - f) * .45; ctx.fillStyle = `hsl(${h} 95% 70%)`;
      if (j % 3 === 2) { ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y), 5, 1); ctx.fillRect(Math.round(p.x), Math.round(p.y) - 2, 1, 5); }
      else pixelBall(p.x, p.y, Math.max(2, Math.round(bounds.radius - 1 - j * 5 / n)));
    });
    ctx.globalAlpha = 1;
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
  $('confirm-restart').addEventListener('click',()=>{archive();if(state!=='over')reportar();pauseBeforeDialog=false;$('restart-dialog').close();borraPartida();reset();});
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
  /* Mando de consola (juegos/audio/mando.js): la cruceta o el stick apuntan
     (repitiendo rápido, como mantener la flecha), A lanza, X recoge las
     bolas, B acelera. En pausa o al perder, el cursor toca el botón. */
  if(window.Mando)window.Mando.configura({
    botones:{izq:{tecla:'ArrowLeft',rep:22,retardo:120},der:{tecla:'ArrowRight',rep:22,retardo:120},a:'Space',start:'KeyP',y:'KeyM',
      x:()=>$('recall').click(),b:()=>$('speed').click()},
    menu:()=>paused||state==='over',inicio:'#resume',junto:'.canvas-wrap',
    pistas:[['dpad stickL','apuntar'],['a','lanzar'],['x','recoger'],['b','velocidad'],['y','sonido'],['start','pausa']]
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden && !paused && state!=='over')pause(true);if(document.hidden)BBTANAudio.music(false);uiDirty=true;});
  window.addEventListener('pagehide',()=>{best=Math.max(best,score);persist();});
  function resize() {const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);draw();}
  function frame(timestamp) {const dt=Math.min((timestamp-lastFrame)/1000||0,.035);lastFrame=timestamp;update(dt);if(blocks)animoMusica(timestamp);mutaciones(timestamp);if(uiDirty)updateUI();draw();requestAnimationFrame(frame);}
  if(Club&&Club.category)Club.category(CATEGORIA);
  BBTANAudio.setEnabled(sound, false);setSound();reset();cargaPartida();resize();window.addEventListener('resize',resize);requestAnimationFrame(frame);
})();
