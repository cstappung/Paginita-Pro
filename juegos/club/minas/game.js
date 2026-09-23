(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(window.Club?.storageKey(key) || key)) ?? fallback; } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(window.Club?.storageKey(key) || key, JSON.stringify(value)); } catch { /* Storage is optional. */ } };
  const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  /* La música es el tema `minas` del chip de la sala (juegos/audio), y crece
     con el tablero: el arpegio entra pasado un 30 % despejado y la batería
     pasado un 65 %, con el tempo subiendo hasta un 8 %. Los efectos van por el
     mismo chip y se guardan en `voices`, así `stop()` calla también lo que
     aún no ha empezado a sonar. */
  class Soundtrack {
    constructor() {
      this.enabled = read('mina-sound', true); this.volume = read('mina-volume', 45) / 100;
      this.context = null; this.master = null; this.loop = null; this.progress = 0; this.active = false;
      this.voices = new Set(); this.player = null; this.lastOpen = -Infinity;
    }
    unlock() {
      if (!this.enabled) return;
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio || !window.Chip) { $('music-label').textContent = 'Audio no disponible en este navegador'; return; }
      if (!this.context) {
        this.context = new Audio(); this.master = this.context.createGain();
        this.master.gain.value = this.volume * .6; this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    }
    ready() { return this.enabled && this.context && this.context.state === 'running'; }
    note(midi, time, length = .3, volume = .1, wave = 'p25', extra = {}) {
      if (!this.ready()) return;
      const ctx = this.context;
      window.Chip.voz(ctx, this.master, Object.assign({ t: Math.max(time, ctx.currentTime), f: window.Chip.hz(midi), dur: length, vol: volume, onda: wave, sus: .75 }, extra), this.voices);
    }
    start() {
      if (this.active) return; // Un solo secuenciador, también ante eventos repetidos.
      this.stop(); this.unlock();
      if (!this.enabled || !this.context) return;
      if (!this.player && window.Temas) this.player = new window.Chip.Reproductor(this.context, this.master, window.Temas.temas.minas);
      if (!this.player) return;
      this.player.reinicia();
      this.active = true;
      this.loop = setInterval(() => this.schedule(), 75); this.schedule(); this.updateUI();
    }
    schedule() {
      if (!this.active || !this.player || this.context.state !== 'running') return;
      const p = this.progress, r = this.player;
      r.capas.arp = p > .3 ? 1 : 0; r.capas.bat = p > .65 ? 1 : 0;
      r.tempo = 1 + Math.min(1, Math.max(0, p)) * .08;
      r.tick(.2);
    }
    stop(clearVoices = true) {
      clearInterval(this.loop); this.loop = null; this.active = false;
      if (clearVoices) {
        if (this.player) this.player.detener();
        for (const v of this.voices) {
          try { v.fuente.stop(0); } catch {}
          for (const n of v.nodos) { try { n.disconnect(); } catch {} }
        }
        this.voices.clear();
      }
      this.lastOpen = -Infinity;
      this.updateUI();
    }
    effect(kind, amount = 1) {
      this.unlock(); if (!this.context) return;
      const t = this.context.currentTime;
      // Los clics son acentos breves, no otra canción encima del fondo; abrir
      // una zona grande suena un poco más agudo que abrir una casilla.
      if (kind === 'open' && t - this.lastOpen >= .12) {
        this.lastOpen = t; this.note(84 + Math.min(7, Math.floor(Math.log2(Math.max(1, amount)))), t, .05, .05, 'p12');
      }
      if (kind === 'flag') this.note(79, t, .09, .07, 'p50', { f1: window.Chip.hz(86) });
      if (kind === 'unflag') this.note(74, t, .08, .06, 'p50', { f1: window.Chip.hz(67) });
      if (kind === 'win') {
        [67,71,74,79,83,86,83,86].forEach((n, i) => this.note(n, t + i * .12, .2, .1, 'p25'));
        this.note(91, t + .98, 1.2, .1, 'p25', { vib: .008 });
        [55,62,67,71].forEach(n => this.note(n, t + .98, 1.4, .07, 'p12', { sus: .5 }));
        this.note(43, t + .98, 1.4, .2, 'tri', { sus: 1 });
      }
      if (kind === 'lose') {
        // Cierre de cuatro segundos en sol menor, la tonalidad del tema:
        // golpe grave, bajada cromática y reposo. Se cancela al reiniciar.
        this.stop();
        this.note(31, t, .6, .24, 'tri', { f1: window.Chip.hz(19), sus: 1 });
        [[74,.18,.3],[70,.52,.3],[67,.86,.48],[66,1.38,.3],
          [69,1.72,.3],[70,2.06,.48],[69,2.65,.5],[67,3.2,1.15]]
          .forEach(([n,offset,duration]) => this.note(n,t+offset,duration,.1,'p25',{vib:.006}));
        [[43,0],[39,1.36],[38,2.04],[43,3.2]]
          .forEach(([n,offset]) => this.note(n,t+offset,.85,.18,'tri',{sus:1}));
        [55,58,62].forEach(n => this.note(n,t+3.2,1.25,.04,'p12',{sus:.5}));
      }
    }
    setVolume(value) {
      this.volume = value / 100; save('mina-volume', value);
      if (this.master) this.master.gain.setTargetAtTime(this.volume * .6, this.context.currentTime, .05);
    }
    updateUI() {
      $('sound').setAttribute('aria-pressed', String(this.enabled));
      $('sound').setAttribute('aria-label', this.enabled ? 'Desactivar música y efectos' : 'Activar música y efectos');
      $('waveform').classList.toggle('playing', this.active);
      $('music-dot').classList.toggle('playing', this.active);
      $('music-label').textContent = !this.enabled ? 'Tu momento de silencio' : this.active ? (this.progress > .65 ? '¡El jardín está vibrando!' : 'Cada jugada tiene su melodía') : 'La música empieza con tu jugada';
    }
  }

  const soundtrack = new Soundtrack();
  const board = $('board'); let game, buttons = [], level = 'easy', paused = false, flagMode = false;
  let elapsed = 0, startedAt = 0, resultTimeout, animationId = 0, focusedIndex = 0;
  let pending = [], particles = [], lastFrame = 0, longPress = null, touchStart = null, suppressClickUntil = 0;
  const canvas = $('effects'), ctx = canvas.getContext('2d');
  let viewWidth = innerWidth, viewHeight = innerHeight;
  function resizeEffects() {
    viewWidth = innerWidth; viewHeight = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = viewWidth * dpr; canvas.height = viewHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeEffects(); window.addEventListener('resize', resizeEffects);
  function burst(x, y, count, celebration = false) {
    if (reducedMotion.matches) return;
    const colors = celebration ? ['#d4e987','#a2c977','#b6a2d1','#e7b865','#f09f83','#f9efc4'] : ['#efaa78','#a9c375','#c1a5d6','#ffe3a3'];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, speed = 90 + Math.random() * (celebration ? 310 : 120);
      particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-(celebration?170:60),size:3+Math.random()*6,life:celebration?2.7:1.1,max:celebration?2.7:1.1,angle:Math.random()*6,spin:Math.random()*8-4,color:colors[i%colors.length],flower:celebration&&i%6===0});
    }
    if (!animationId) { lastFrame = performance.now(); animationId = requestAnimationFrame(drawEffects); }
  }
  function drawEffects(now) {
    const dt = Math.min((now - lastFrame) / 1000, .04); lastFrame = now;
    ctx.clearRect(0,0,viewWidth,viewHeight);
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.life -= dt; p.vy += 150 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.angle += p.spin * dt;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angle); ctx.globalAlpha = Math.min(1,p.life/.5); ctx.fillStyle = p.color;
      if (p.flower) { for (let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.ellipse(p.size*.6,0,p.size,p.size*.45,0,0,Math.PI*2);ctx.fill();} }
      else ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*.6);
      ctx.restore();
    });
    animationId = particles.length ? requestAnimationFrame(drawEffects) : 0;
  }
  function later(fn, ms) { const id = setTimeout(fn, ms); pending.push(id); }
  function seconds() { return elapsed + (game.state === 'playing' && !paused ? (performance.now() - startedAt) / 1000 : 0); }
  window.addEventListener('club-record',e=>{if(e.detail.categoria!==`club-minas-${level}`)return;const t=e.detail.tiempo/1000;if(currentBest()===null||t<currentBest()){save(`mina-best-${level}`,t);updateHUD();}});
  function currentBest() { const value = read(`mina-best-${level}`, null); return typeof value === 'number' && Number.isFinite(value) ? value : null; }
  function updateHUD() {
    $('flags').textContent = String(game.mines - game.flags).padStart(2, '0');
    $('timer').textContent = formatTime(seconds()); $('progress').style.width = `${game.progress * 100}%`;
    $('pause').disabled = game.state !== 'playing';
    const best = currentBest(); $('best').textContent = best === null ? '— —' : formatTime(best);
    $('field-name').textContent = `EL JARDÍN · ${game.label}`; $('field-size').textContent = `${game.cols} × ${game.rows}`;
    document.querySelector('.best-row>span').textContent = {easy:'Tu mejor paseo',medium:'Tu mejor aventura',hard:'Tu mejor desafío'}[level];
  }
  function reset(nextLevel = level) {
    pending.forEach(clearTimeout); pending = []; clearTimeout(resultTimeout); clearTimeout(longPress); longPress = null;
    soundtrack.stop(); soundtrack.progress = 0;
    $('result').close(); $('help-dialog').close(); particles = []; cancelAnimationFrame(animationId); animationId = 0; ctx.clearRect(0,0,viewWidth,viewHeight);
    level = nextLevel; window.Club?.category(`club-minas-${level}`); game = new Mina.Game(level); paused = false; elapsed = 0; startedAt = 0; focusedIndex = 0;
    $('field').classList.remove('shake', 'defeat'); $('result').classList.remove('defeat'); $('pause-screen').hidden = true; $('pause').textContent = 'Ⅱ'; $('pause').setAttribute('aria-label','Pausar');
    $('status').textContent = 'Todo empieza con un clic.'; $('field-caption').innerHTML = '<span>✦</span> Tu primera jugada siempre es segura.';
    board.style.setProperty('--cols',game.cols); board.style.setProperty('--min-cell',level === 'easy' ? '24px' : '26px');
    board.setAttribute('aria-rowcount',game.rows); board.setAttribute('aria-colcount',game.cols);
    const fragment = document.createDocumentFragment();
    buttons = game.cells.map((cell,i) => {
      const el = document.createElement('button'); el.className = `cell${(i % game.cols + Math.floor(i/game.cols))%2 ? ' odd' : ''}`;
      el.dataset.index = i; el.setAttribute('role','gridcell'); el.setAttribute('aria-rowindex',Math.floor(i/game.cols)+1); el.setAttribute('aria-colindex',i%game.cols+1);
      el.setAttribute('aria-label',`Fila ${Math.floor(i/game.cols)+1}, columna ${i%game.cols+1}: sin explorar`); el.tabIndex = i === 0 ? 0 : -1; fragment.appendChild(el); return el;
    });
    board.replaceChildren(fragment); $('board-scroll').scrollLeft = 0;
    document.querySelectorAll('[data-level]').forEach(b => { const active = b.dataset.level === level; b.classList.toggle('active',active); b.setAttribute('aria-pressed',String(active)); });
    updateHUD(); soundtrack.updateUI();
  }
  function paint(i, delay = 0) {
    const c = game.cells[i], b = buttons[i]; b.classList.toggle('open',c.open); b.classList.toggle('flagged',c.flag);
    b.style.setProperty('--delay',`${delay}ms`);
    b.dataset.number = c.count;
    b.innerHTML = c.flag ? icon('flag') : c.open ? (c.mine ? icon('mine') : c.count || '') : '';
    if (c.open) b.classList.add('reveal');
    const description = c.flag ? 'bandera' : !c.open ? 'sin explorar' : c.mine ? 'mina' : c.count ? `${c.count} ${c.count === 1 ? 'mina' : 'minas'} alrededor` : 'vacía';
    b.setAttribute('aria-label',`Fila ${Math.floor(i/game.cols)+1}, columna ${i%game.cols+1}: ${description}`);
  }
  function focusCell(i, focus = false) {
    buttons[focusedIndex].tabIndex = -1; focusedIndex = i; buttons[i].tabIndex = 0;
    if (focus) buttons[i].focus({preventScroll:true});
  }
  function flag(i) {
    if (paused) return; soundtrack.unlock();
    if (game.flag(i)) { paint(i); soundtrack.effect(game.cells[i].flag ? 'flag' : 'unflag'); updateHUD(); $('status').textContent = game.cells[i].flag ? 'Una sospecha bien marcada.' : 'Volvemos a mirar con otros ojos.'; }
    else if (game.flags === game.mines && !game.cells[i].open && game.state !== 'won' && game.state !== 'lost') $('status').textContent = 'Retira una bandera para colocar otra.';
  }
  function open(i) {
    if (paused || ['won','lost'].includes(game.state)) return;
    soundtrack.unlock(); const before = game.state; const changed = game.open(i);
    if (before === 'ready' && game.state !== 'ready') { startedAt = performance.now(); soundtrack.start(); }
    changed.forEach((n,j) => paint(n,Math.min(350,j*8)));
    if (!changed.length) return;
    soundtrack.progress = game.progress;
    if (game.state === 'won' || game.state === 'lost') { elapsed += (performance.now()-startedAt)/1000; finish(); }
    else {
      soundtrack.effect('open',changed.length); soundtrack.updateUI();
      $('status').textContent = changed.length > 5 ? `¡${changed.length} casillas de un solo clic!` : game.progress > .8 ? 'Un poquito más. Ya casi florece.' : 'Sigue las pistas. Encuentra tu camino.';
      $('field-caption').textContent = `${Math.round(game.progress*100)}% explorado · Cada número tiene algo que contarte.`;
      if (changed.length > 6) { const r = buttons[i].getBoundingClientRect(); burst(r.x+r.width/2,r.y+r.height/2,14); }
    }
    updateHUD();
  }
  function finish() {
    const won = game.state === 'won';
    if(won)window.Club?.result({categoria:`club-minas-${level}`,puntos:1,tiempo:Math.max(1,Math.round(elapsed*1000))}); soundtrack.stop(); soundtrack.effect(won ? 'win' : 'lose');
    $('status').textContent = won ? '¡El jardín es todo tuyo!' : 'Una sorpresa en el camino. ¿Otra vez?';
    $('field-caption').textContent = won ? '✿ Todas las casillas a salvo. Bien jugado.' : 'Las mejores aventuras merecen otro intento.';
    let newBest = false;
    if (won) {
      const best = currentBest(); if (best === null || elapsed < best) {save(`mina-best-${level}`,elapsed);newBest=true;}
      game.cells.forEach((c,i) => { const b=buttons[i]; b.classList.add('win'); b.style.setProperty('--delay',`${(i%game.cols+Math.floor(i/game.cols))*35}ms`); if(c.mine){c.flag=true;paint(i);} });
      game.flags = game.mines;
      for(let j=0;j<5;j++) later(()=>burst(viewWidth*(.18+j*.16),viewHeight*.5,55,true),j*200);
    } else {
      $('field').classList.add('shake', 'defeat');
      const origin = game.exploded, ox=origin%game.cols, oy=Math.floor(origin/game.cols);
      const maxDistance = Math.max(1, Math.hypot(Math.max(ox,game.cols-1-ox),Math.max(oy,game.rows-1-oy)));
      const waveDelay = i => reducedMotion.matches ? 0 : 80 + 900 * Math.hypot(i%game.cols-ox,Math.floor(i/game.cols)-oy) / maxDistance;
      buttons.forEach((b,i) => {
        b.style.setProperty('--wave-delay', `${waveDelay(i)}ms`);
        b.classList.add('loss-wave');
      });
      const mines = game.cells.map((c,i)=>({c,i})).filter(({c})=>c.mine).sort((a,b)=>Math.hypot(a.i%game.cols-ox,Math.floor(a.i/game.cols)-oy)-Math.hypot(b.i%game.cols-ox,Math.floor(b.i/game.cols)-oy));
      mines.forEach(({c,i},j)=>later(()=>{
        const b=buttons[i];b.innerHTML=icon('mine');b.classList.remove('flagged');b.classList.add('mine');b.classList.toggle('exploded',i===origin);
        b.style.setProperty('--mine-color',['#edb98d','#cab2d9','#edce82','#a6c6c6','#dba6a4'][j%5]);b.style.setProperty('--delay','0ms');
        b.setAttribute('aria-label',`Fila ${Math.floor(i/game.cols)+1}, columna ${i%game.cols+1}: mina`);
        const r=b.getBoundingClientRect();burst(r.x+r.width/2,r.y+r.height/2,i===origin?28:4);
      },waveDelay(i)));
      game.cells.forEach((c,i)=>{if(c.flag&&!c.mine)buttons[i].classList.add('wrong');});
    }
    $('result').classList.toggle('defeat', !won);
    $('result-icon').innerHTML=won?'✿':icon('mine');$('result-icon').style.background=won?'#e7edcb':'#f4dfcc';$('result-icon').style.color=won?'#819e49':'#bb7f58';
    $('result-kicker').textContent=won?(newBest?'UN NUEVO RÉCORD PERSONAL':'UN JARDÍN DE POSIBILIDADES'):'HASTA LAS FLORES TIENEN SORPRESAS';
    $('result-title').textContent=won?'¡Lo hiciste florecer!':'Ups… había una mina.';
    $('result-copy').textContent=won?'Calma, intuición y una gran jugada. Este pequeño triunfo es tuyo.':'No pasa nada. Respira, sacúdete el polvo y vuelve a seguir las pistas.';
    $('result-time').textContent=formatTime(elapsed);$('result-progress').textContent=`${Math.round(game.progress*100)}%`;
    resultTimeout=setTimeout(()=>{$('result').showModal();},reducedMotion.matches?250:won?1500:2100);
  }
  function togglePause(force) {
    if(game.state!=='playing')return;
    const next=typeof force==='boolean'?force:!paused;if(next===paused)return;
    if(next){elapsed+=(performance.now()-startedAt)/1000;soundtrack.stop();}else{startedAt=performance.now();soundtrack.start();}
    paused=next;$('pause-screen').hidden=!paused;$('pause').textContent=paused?'▷':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Continuar':'Pausar');
    $('status').textContent=paused?'Un respiro también cuenta.':'Seguimos donde lo dejamos.';
    if(paused)$('resume').focus();else focusCell(focusedIndex,true);
    updateHUD();
  }
  function cellIndex(event) { const cell=event.target.closest('.cell');return cell?Number(cell.dataset.index):null; }
  board.addEventListener('click',event=>{const i=cellIndex(event);if(i===null||performance.now()<suppressClickUntil)return;focusCell(i);if(flagMode)flag(i);else open(i);});
  board.addEventListener('contextmenu',event=>{event.preventDefault();const i=cellIndex(event);if(i!==null){focusCell(i);if(performance.now()>=suppressClickUntil)flag(i);}});
  board.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse')return;const i=cellIndex(event);if(i===null)return;
    clearTimeout(longPress);touchStart={x:event.clientX,y:event.clientY};
    longPress=setTimeout(()=>{focusCell(i);flag(i);suppressClickUntil=performance.now()+800;longPress=null;},430);
  });
  board.addEventListener('pointermove',event=>{if(touchStart&&Math.hypot(event.clientX-touchStart.x,event.clientY-touchStart.y)>9){clearTimeout(longPress);longPress=null;}});
  ['pointerup','pointercancel','pointerleave'].forEach(type=>board.addEventListener(type,()=>{clearTimeout(longPress);longPress=null;touchStart=null;}));
  board.addEventListener('keydown',event=>{
    const i=cellIndex(event);if(i===null)return;
    const col=i%game.cols,row=Math.floor(i/game.cols);let next=i;
    if(event.key==='ArrowLeft')next=row*game.cols+Math.max(0,col-1);
    else if(event.key==='ArrowRight')next=row*game.cols+Math.min(game.cols-1,col+1);
    else if(event.key==='ArrowUp')next=Math.max(0,row-1)*game.cols+col;
    else if(event.key==='ArrowDown')next=Math.min(game.rows-1,row+1)*game.cols+col;
    else if(event.key.toLowerCase()==='f'){event.preventDefault();flag(i);return;}
    else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(flagMode)flag(i);else open(i);return;}else return;
    event.preventDefault();focusCell(next,true);buttons[next].scrollIntoView({block:'nearest',inline:'nearest'});
  });
  document.addEventListener('keydown',event=>{
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target.matches('input')||$('result').open||$('help-dialog').open)return;
    if(event.key.toLowerCase()==='p'||event.key==='Escape'){event.preventDefault();togglePause();}
    if(event.key.toLowerCase()==='r'){event.preventDefault();reset();}
  });
  $('restart').addEventListener('click',()=>reset());$('play-again').addEventListener('click',()=>{reset();focusCell(0,true);});
  $('view-board').addEventListener('click',()=>{$('result').close();focusCell(focusedIndex,true);});
  $('pause').addEventListener('click',()=>togglePause());$('resume').addEventListener('click',()=>togglePause(false));
  $('flag-mode').addEventListener('click',()=>{flagMode=!flagMode;$('flag-mode').setAttribute('aria-pressed',String(flagMode));$('flag-mode-state').textContent=flagMode?'ON':'OFF';});
  document.querySelectorAll('[data-level]').forEach(b=>b.addEventListener('click',()=>reset(b.dataset.level)));
  $('sound').addEventListener('click',()=>{soundtrack.enabled=!soundtrack.enabled;save('mina-sound',soundtrack.enabled);if(soundtrack.enabled&&game.state==='playing'&&!paused)soundtrack.start();else soundtrack.stop();soundtrack.updateUI();});
  $('volume').value=soundtrack.volume*100;$('volume').addEventListener('input',event=>soundtrack.setVolume(Number(event.target.value)));
  $('help').addEventListener('click',()=>{togglePause(true);$('help-dialog').showModal();});$('help-close').addEventListener('click',()=>$('help-dialog').close());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){togglePause(true);soundtrack.stop();}});
  window.addEventListener('pagehide',()=>soundtrack.stop());
  for(let i=0;i<43;i++){const bar=document.createElement('i');bar.style.setProperty('--h',`${10+Math.sin(i*.75)**2*24+Math.sin(i*.31)**2*8}px`);bar.style.setProperty('--speed',`${.35+(i%7)*.12}s`);bar.style.setProperty('--offset',`${-i*.13}s`);$('waveform').appendChild(bar);}
  setInterval(()=>{if(game?.state==='playing'&&!paused)$('timer').textContent=formatTime(seconds());},200);
  reset();
})();
