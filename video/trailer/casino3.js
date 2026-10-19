/* ---------- CASINO RECREADO (v3) ----------
   El Avión sube hasta el espacio y cobra ×27,10; en Plinko caen muchas bolas y una dorada
   cae en ×988 con zoom y cámara lenta. No usa tomas: todo se dibuja a partir del tiempo
   (lt = segundos dentro de la escena), con azar() en lugar de Math.random.
   casinoAvion(lt) y casinoPlinko(lt) devuelven { tomas, textos, flash } como escena(t). */
const DUR_AVION = 6.4, DUR_PLINKO = 8.0;

/* ===== piezas comunes: monedas, bombillas, rodillos de tragamonedas, rayos ===== */
const DEFS_CASINO = `<svg width="0" height="0" style="position:absolute"><defs>
  <radialGradient id="cOro" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff6c2"/><stop offset=".35" stop-color="#ffd54a"/><stop offset=".8" stop-color="#e09a12"/><stop offset="1" stop-color="#a86400"/></radialGradient>
  <radialGradient id="cBola" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ffd0e2"/><stop offset=".45" stop-color="#ff4f8b"/><stop offset="1" stop-color="#b0124c"/></radialGradient>
  <radialGradient id="cBolaOro" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fffbe0"/><stop offset=".4" stop-color="#ffd21f"/><stop offset="1" stop-color="#c77800"/></radialGradient>
  <radialGradient id="cHalo" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".3" stop-color="#ffd21f" stop-opacity=".55"/><stop offset="1" stop-color="#ffd21f" stop-opacity="0"/></radialGradient>
  <radialGradient id="cHaloRosa" r="50%"><stop offset="0" stop-color="#ff7ab0" stop-opacity=".7"/><stop offset="1" stop-color="#ff4f8b" stop-opacity="0"/></radialGradient>
  <linearGradient id="cTraza" x1="0" x2="1" y1="1" y2="0"><stop offset="0" stop-color="#ff9f43"/><stop offset="1" stop-color="#ff3d6e"/></linearGradient>
  <linearGradient id="cRelleno" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ff3d6e" stop-opacity=".38"/><stop offset="1" stop-color="#ff3d6e" stop-opacity="0"/></linearGradient>
  <radialGradient id="cTierra" cx="50%" cy="8%" r="70%"><stop offset="0" stop-color="#3fb4ff"/><stop offset=".25" stop-color="#1e6fc4"/><stop offset=".6" stop-color="#123a75"/><stop offset="1" stop-color="#050c22"/></radialGradient>
  <radialGradient id="cPlaneta" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#ffc2e8"/><stop offset=".5" stop-color="#c04aa8"/><stop offset="1" stop-color="#3a0d4a"/></radialGradient>
  <g id="cMoneda"><circle r="20" fill="url(#cOro)" stroke="#a86400" stroke-width="2.5"/><circle r="14" fill="none" stroke="#fff2a8" stroke-opacity=".7" stroke-width="2"/>
    <path d="M0 -8 L2.4 -2.6 8 -2.4 3.6 1.2 5 7 0 3.8 -5 7 -3.6 1.2 -8 -2.4 -2.4 -2.6Z" fill="#c98200"/></g>
</defs></svg>`;

// Una moneda que gira (el giro achata el ancho) en (x,y), tamaño r (radio en px)
const moneda = (x, y, r, giro, op = 1) =>
  `<use href="#cMoneda" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(giro * 9 % 30).toFixed(0)}) scale(${(r / 20 * Math.max(.08, Math.abs(Math.cos(giro)))).toFixed(3)} ${(r / 20).toFixed(3)})" opacity="${op.toFixed(2)}"/>`;

/* Explosión de monedas desde (x0,y0) en el instante t0: arcos con gravedad. */
function explosion(t, t0, x0, y0, n, o = {}) {
  let s = ''; const k = t - t0; if (k < 0) return '';
  const fuerza = o.fuerza || 1, sem = o.sem || 0, g = o.g || 1500;
  for (let i = 0; i < n; i++) {
    const d = (azar(i * 3.1 + sem) * .25);               // salen escalonadas
    const u = k - d; if (u < 0) continue;
    const a = -Math.PI / 2 + (azar(i * 7.3 + sem) - .5) * (o.abre || 2.6);
    const v = (600 + azar(i * 1.7 + sem) * 1300) * fuerza;
    const x = x0 + Math.cos(a) * v * u, y = y0 + Math.sin(a) * v * u + .5 * g * u * u;
    if (y > H + 60 || x < -60 || x > W + 60) continue;
    const r = 13 + azar(i * 5.9 + sem) * 17;
    s += moneda(x, y, r, u * (6 + azar(i * 2.2 + sem) * 10) + i, Math.min(1, u * 8));
  }
  return s;
}
/* Lluvia de monedas desde arriba entre t0 y t1. */
function lluvia(t, t0, t1, n, sem = 0) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const nace = t0 + azar(i * 4.7 + sem) * (t1 - t0), u = t - nace; if (u < 0) continue;
    const vy = 380 + azar(i * 2.9 + sem) * 600, y = -60 + vy * u + 500 * u * u;
    if (y > H + 60) continue;
    const x = azar(i * 9.1 + sem) * W + Math.sin(u * 3 + i) * 30;
    s += moneda(x, y, 12 + azar(i * 6.3 + sem) * 16, u * (5 + azar(i + sem) * 9) + i * 1.3);
  }
  return s;
}
/* Marco de bombillas de tragamonedas que se persiguen. */
function bombillas(t, op = 1, inset = 26, paso = 48) {
  if (op <= 0) return '';
  const pts = [], w = W - inset * 2, h = H - inset * 2;
  for (let x = 0; x <= w; x += paso) { pts.push([inset + x, inset]); pts.push([inset + x, H - inset]); }
  for (let y = paso; y < h; y += paso) { pts.push([inset, inset + y]); pts.push([W - inset, inset + y]); }
  const fase = Math.floor(t * 10);
  let s = '';
  pts.forEach(([x, y], i) => {
    const on = (i + fase) % 3 !== 0, col = i % 2 ? '#ffd21f' : '#fff6d8';
    if (on) s += `<circle cx="${x}" cy="${y}" r="17" fill="${col}" opacity=".22"/>`;
    s += `<circle cx="${x}" cy="${y}" r="7.5" fill="${on ? col : '#5a4310'}"/>`;
  });
  return `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;opacity:${op}">${s}</svg>`;
}
/* Rayos de sol girando detrás del cartel. */
const rayos = (t, cx, cy, r, op, col = '255,210,31') => op <= 0 ? '' :
  `<div style="position:absolute;left:${cx - r}px;top:${cy - r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;opacity:${op};
    background:repeating-conic-gradient(from ${(t * 24) % 360}deg, rgba(${col},.32) 0deg 7deg, rgba(${col},0) 7deg 15deg);
    -webkit-mask:radial-gradient(circle, #000 0%, #000 25%, transparent 70%);mask:radial-gradient(circle, #000 0%, #000 25%, transparent 70%)"></div>`;

/* Contador de tragamonedas: cada dígito es un rodillo que gira y frena en orden. */
function rodillos(texto, t, t0, o = {}) {
  const tam = o.tam || 170, alto = Math.round(tam * 1.05), dur = o.dur || .9, sep = o.sep || .16;
  let i = 0, s = '';
  for (const ch of texto) {
    if (!/\d/.test(ch)) { s += ch === '+' ? `<span style="display:inline-block;height:${alto}px;line-height:${alto}px;font-size:.8em;vertical-align:top;margin-right:.08em">+</span>` : `<span style="display:inline-block;height:${alto}px;line-height:${alto}px;margin:0 .02em">${ch}</span>`; continue; }
    const fin = t0 + dur + i * sep, u = prog(t, t0, fin), meta = +ch + 10 * (6 + i);
    let p = meta - 10 * (6 + i) * Math.pow(1 - u, 2.2);
    if (t > fin) p = meta + Math.sin((t - fin) * 26) * .18 * Math.exp(-(t - fin) * 9);   // rebote al frenar
    const vel = t < fin ? 10 * (6 + i) * 2.2 * Math.pow(1 - u, 1.2) / (fin - t0) : 0;
    const base = Math.floor(p), fr = p - base;
    let col = '';
    for (let k = -1; k <= 1; k++) col += `<div style="height:${alto}px;line-height:${alto}px">${(((base + k) % 10) + 10) % 10}</div>`;
    s += `<span style="display:inline-block;height:${alto}px;overflow:hidden;vertical-align:top">
      <div style="transform:translateY(${(-alto - fr * alto).toFixed(1)}px);filter:blur(${Math.min(6, vel * .1).toFixed(1)}px)">${col}</div></span>`;
    i++;
  }
  return s;
}
/* Cartel BIG WIN / MEGA WIN con letras doradas. */
function cartel(texto, t, t0, y, tam = 230) {
  const k = prog(t, t0, t0 + .32); if (k <= 0) return '';
  const e = eOutX(k), lat = 1 + .035 * Math.sin((t - t0) * 9);
  return `<div class="centro" style="top:${y}px;font-family:'Bungee',sans-serif;font-size:${tam}px;line-height:1;transform:scale(${(lerp(2.2, 1, e) * lat).toFixed(3)}) rotate(${lerp(-8, -3, e).toFixed(2)}deg);opacity:${Math.min(1, k * 3)}">
    <span style="position:relative;display:inline-block">
      <span style="position:absolute;left:0;top:0;color:transparent;-webkit-text-stroke:26px #3a1300;filter:drop-shadow(0 18px 0 #1a0700) drop-shadow(0 0 50px rgba(255,140,0,.7))">${texto}</span>
      <span style="position:relative;color:transparent;background:linear-gradient(180deg,#fffbe0 0%,#ffe36b 30%,#ffb11f 55%,#ff7a00 78%,#ffd21f 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-stroke:3px #fff4b0">${texto}</span>
    </span></div>`;
}
/* Placa del contador: «+13.550 🪙» con rodillos. */
function placa(texto, t, t0, y, tam = 150) {
  const k = eOutX(prog(t, t0, t0 + .3)); if (k <= 0) return '';
  return `<div class="centro" style="top:${y}px;transform:scale(${lerp(.6, 1, k).toFixed(3)});opacity:${k}">
    <div style="display:inline-flex;align-items:center;gap:26px;padding:14px 46px 14px 40px;border-radius:30px;background:linear-gradient(180deg,#2a1406,#120802);border:5px solid #ffd21f;box-shadow:0 0 0 4px #7a4300,0 0 70px rgba(255,190,40,.55),inset 0 0 40px rgba(0,0,0,.8)">
      <div style="font-family:'Anton',sans-serif;font-size:${tam}px;color:#ffe36b;text-shadow:0 0 30px rgba(255,200,40,.7);white-space:nowrap">${rodillos(texto, t, t0 + .1, { tam, dur: .5, sep: .09 })}</div>
      <svg width="${tam * .62}" height="${tam * .62}" viewBox="-22 -22 44 44"><use href="#cMoneda" transform="scale(${1 + .1 * Math.sin(t * 8)} 1)"/></svg>
    </div></div>`;
}
const coma = (n, d = 2) => n.toFixed(d).replace('.', ',');
const textoMultPk = m => m >= 100 ? String(Math.round(m)) : m >= 10 ? coma(m, 1) : coma(m, 2);

/* ======================= EL AVIÓN ======================= */
const AV = { despega: .4, cobro: 4.2, mFin: 27.1 };
function multAv(lt) {
  const k = prog(lt, AV.despega, AV.cobro);
  return Math.exp(Math.log(AV.mFin) * Math.pow(k, 1.55));
}
// altitud del avión (px de mundo): velocidad que crece; tras el cobro sigue a velocidad fija
function altAv(lt) {
  const u = Math.max(0, Math.min(lt, AV.cobro) - AV.despega), T = AV.cobro - AV.despega, k = u / T;
  let a = 160 * u + 2700 * T * k * k * k / 3;
  if (lt > AV.cobro) a += (160 + 2700) * (lt - AV.cobro) * .6;
  return a;
}
function posAv(lt) {
  // en la pista, despegue hacia el centro, luego se mece
  const k = eIO(prog(lt, .15, 1.5));
  let x = lerp(250, 1060, k) + 34 * Math.sin(lt * 1.9) * prog(lt, 1.2, 2), y = lerp(H - 150, 560, k) + 18 * Math.sin(lt * 2.6) * prog(lt, 1.2, 2);
  // tras cobrar se aleja hacia arriba a la derecha, haciéndose chico
  const f = eIn(prog(lt, AV.cobro + .5, DUR_AVION)); x = lerp(x, 1500, f); y = lerp(y, 120, f);
  return { x, y, esc: lerp(3.2, 1.1, f), ang: lerp(-4, -32, eOut(prog(lt, .3, 1.3))) - 8 * f };
}
function avionSvg(x, y, ang, esc, lt, llama) {
  const hel = (lt * 33) % 2;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(2)}) scale(${esc.toFixed(3)})">
    ${llama > 0 ? `<path d="M-30 -4 Q${-60 - 40 * llama - 8 * Math.sin(lt * 40)} 0 -30 4Z" fill="#ffb11f" opacity=".9"/><path d="M-30 -2.4 Q${-48 - 22 * llama} 0 -30 2.4Z" fill="#fff6c2"/>` : ''}
    <path d="M-26 -5 Q-10 -9 16 -6 Q27 -4 29 0 Q27 4 16 6 Q-10 9 -26 5Z" fill="#e8304a" style="filter:drop-shadow(0 0 6px rgba(255,61,110,.6))"/>
    <path d="M-2 -5 L-15 -25 L-6 -25 L11 -5Z M-2 5 L-13 20 L-6 20 L10 5Z M-24 -4 L-33 -16 L-26 -16 L-18 -4Z" fill="#b81d34"/>
    <rect x="-20" y="-2.4" width="30" height="1.6" fill="#ffffff55"/>
    <path d="M8 -4.5 Q17 -4.5 20 0 L8 0Z" fill="#9fe3ff"/>
    <ellipse cx="30" cy="0" rx="2" ry="${(13 * Math.abs(1 - hel)).toFixed(1)}" fill="#ffffffaa"/><circle cx="30" cy="0" r="2.2" fill="#ffd36b"/></g>`;
}
function nube(x, y, e, op) {
  if (y < -260 || y > H + 260 || op <= 0) return '';
  let s = '';
  const bolas = [[0, 0, 60], [-62, 18, 44], [64, 16, 48], [-28, -30, 46], [32, -34, 50], [-100, 34, 30], [104, 34, 32]];
  for (const [dx, dy, r] of bolas) s += `<circle cx="${(x + dx * e).toFixed(1)}" cy="${(y + dy * e).toFixed(1)}" r="${(r * e).toFixed(1)}"/>`;
  return `<g fill="#e7d8ff" opacity="${op.toFixed(2)}">${s}</g>`;
}
const mezcla = (a, b, k) => a.map((x, i) => Math.round(x + (b[i] - x) * k));
const rgbS = c => `rgb(${c.join(',')})`;

function casinoAvion(lt) {
  const m = multAv(lt), alt = altAv(lt), p = posAv(lt), cobrado = lt >= AV.cobro;
  const q = clamp(alt / 4300);                                   // 0 pista → 1 espacio
  const k = prog(lt, AV.despega, AV.cobro);
  // cielo: el del sitio (morado→rosa) → noche índigo → espacio negro
  const arribaA = [42, 22, 80], abajoA = [176, 48, 106], arribaB = [12, 10, 42], abajoB = [52, 22, 96], arribaC = [2, 1, 8], abajoC = [8, 10, 30];
  const fa = clamp(q / .5), fb = clamp((q - .5) / .4);
  const cArr = fb > 0 ? mezcla(arribaB, arribaC, fb) : mezcla(arribaA, arribaB, fa), cAba = fb > 0 ? mezcla(abajoB, abajoC, fb) : mezcla(abajoA, abajoB, fa);
  // sacudida de cámara que crece con la velocidad, y golpe al cobrar
  const sac = (2 + 12 * k * k) * (cobrado ? Math.max(0, 1 - (lt - AV.cobro) * 2) : 1) + (cobrado ? 26 * Math.max(0, 1 - (lt - AV.cobro) * 5) : 0);
  const sx = (azar(lt * 30 + 1) - .5) * sac, sy = (azar(lt * 30 + 5) - .5) * sac;
  let svg = '';
  // estrellas (titilan), más visibles arriba
  const opE = .25 + .75 * clamp((q - .25) / .5);
  for (let i = 0; i < 170; i++) {
    const x = azar(i * 1.3) * W, y = ((azar(i * 2.7) * (H + 400) + (alt * (.05 + azar(i * 4.1) * .12))) % (H + 400)) - 200;
    const r = .8 + azar(i * 5.5) * 2.2, tw = .55 + .45 * Math.sin(lt * (2 + azar(i) * 5) + i);
    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#fff" opacity="${(opE * tw).toFixed(2)}"/>`;
  }
  // planeta con anillo y luna en el tramo espacial
  if (q > .55) {
    const y0 = lerp(-260, 250, clamp((q - .55) / .45)) + (lt - 3) * 6, op = clamp((q - .55) / .2);
    svg += `<g opacity="${op.toFixed(2)}" transform="translate(1580 ${y0.toFixed(1)}) rotate(-18)">
      <ellipse rx="230" ry="46" fill="none" stroke="#ffb8e8" stroke-opacity=".35" stroke-width="16"/>
      <circle r="120" fill="url(#cPlaneta)"/>
      <path d="M-230 0 A230 46 0 0 0 230 0" fill="none" stroke="#ffb8e8" stroke-opacity=".6" stroke-width="16"/></g>
      <circle cx="330" cy="${(y0 + 120).toFixed(1)}" r="46" fill="#d9d4ee" opacity="${(op * .85).toFixed(2)}"/><circle cx="318" cy="${(y0 + 110).toFixed(1)}" r="10" fill="#b7b0d6" opacity="${(op * .85).toFixed(2)}"/>`;
  }
  // la Tierra se ve abajo, curva, cuando ya estamos arriba
  if (q > .62) {
    const sube = clamp((q - .62) / .38), R = 2900, cy = H + R - lerp(-40, 300, eOut(sube));
    const top = cy - R;
    svg += `<defs><linearGradient id="cTierraL" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${top.toFixed(1)}" y2="${(top + 420).toFixed(1)}">
        <stop offset="0" stop-color="#8fe0ff"/><stop offset=".06" stop-color="#2f8fe0"/><stop offset=".35" stop-color="#14498f"/><stop offset="1" stop-color="#050d26"/></linearGradient></defs>
      <circle cx="${W / 2}" cy="${cy.toFixed(1)}" r="${R + 60}" fill="#4fc3ff" opacity=".12"/><circle cx="${W / 2}" cy="${cy.toFixed(1)}" r="${R + 22}" fill="#7fd8ff" opacity=".25"/>
      <circle cx="${W / 2}" cy="${cy.toFixed(1)}" r="${R}" fill="url(#cTierraL)"/>`;
    for (let i = 0; i < 7; i++) {   // continentes difusos
      const x = (azar(i * 4.2) * W + lt * 18) % W, y = top + 60 + azar(i * 7.7) * 260 + R - Math.sqrt(R * R - (x - W / 2) ** 2);
      svg += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(80 + azar(i) * 160).toFixed(0)}" ry="${(14 + azar(i * 3) * 26).toFixed(0)}" fill="#2f7a4f" opacity=".35"/>`;
    }
  }
  // nubes: bandas de altitud que pasan hacia abajo (paralaje)
  for (let i = 0; i < 26; i++) {
    const a = 250 + i * 105 + azar(i * 3.3) * 80, f = .55 + azar(i * 8.1) * .7;
    const y = p.y - (a - alt) * f, x = azar(i * 6.6) * (W + 300) - 150;
    svg += nube(x, y, .7 + azar(i * 2.2) * 1.2, .55 * (1 - clamp((a - 2300) / 600)));
  }
  // suelo y pista al despegar
  if (alt < 500) svg += `<rect x="0" y="${(H - 150 + 60 + alt).toFixed(1)}" width="${W}" height="400" fill="#140a26"/>
    <rect x="0" y="${(H - 150 + 58 + alt).toFixed(1)}" width="${W}" height="5" fill="#ff3d6e" opacity=".6"/>`;
  // líneas de hito: pasan bajo el avión justo cuando el multiplicador llega a ese valor
  for (const M of [2, 5, 10, 15, 20, 25]) {
    const tM = AV.despega + Math.pow(Math.log(M) / Math.log(AV.mFin), 1 / 1.55) * (AV.cobro - AV.despega);
    const y = p.y + (alt - altAv(tM)) * .9 + 40;
    if (y < -20 || y > H + 20) continue;
    svg += `<line x1="0" x2="${W}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#fff" stroke-opacity=".14" stroke-width="2" stroke-dasharray="14 12"/>
      <text x="70" y="${(y - 12).toFixed(1)}" fill="#fff" fill-opacity=".55" font-family="JetBrains Mono" font-weight="700" font-size="30">×${M}</text>`;
  }
  // líneas de velocidad hacia abajo
  const vel = clamp(k * 1.4) * (cobrado ? Math.max(.3, 1 - (lt - AV.cobro)) : 1);
  if (vel > .15) for (let i = 0; i < 46; i++) {
    const largo = (120 + azar(i * 3.7) * 380) * vel, y = ((azar(i * 9.9) * (H + 600) + lt * (2600 + azar(i) * 2400)) % (H + 600)) - 400;
    svg += `<rect x="${(azar(i * 4.4) * W).toFixed(1)}" y="${y.toFixed(1)}" width="${(2 + azar(i * 1.9) * 3).toFixed(1)}" height="${largo.toFixed(0)}" fill="#fff" opacity="${(.22 * vel).toFixed(2)}"/>`;
  }
  // la curva del multiplicador detrás del avión (forma exponencial anclada al avión), con su relleno rosado
  if (lt > AV.despega) {
    const crece = eOut(prog(lt, AV.despega, AV.despega + 1.2)), largo = 1500 * crece, alto = (H + 80 - p.y) * crece;
    const pts = [];
    for (let j = 0; j <= 30; j++) { const u = 1 - j / 30; pts.push([p.x - 40 - u * largo, p.y + 22 + alto * (1 - Math.pow(1 - u, 3.2))]); }
    const d = 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');
    const opC = 1 - prog(lt, AV.cobro + .3, AV.cobro + 1);
    svg += `<path d="${d} L${pts[30][0].toFixed(1)} ${H + 50} L${pts[0][0].toFixed(1)} ${H + 50}Z" fill="url(#cRelleno)" opacity="${opC.toFixed(2)}"/>
      <path d="${d}" fill="none" stroke="#ff3d6e" stroke-opacity=".3" stroke-width="26" stroke-linecap="round" opacity="${opC.toFixed(2)}"/>
      <path d="${d}" fill="none" stroke="url(#cTraza)" stroke-width="9" stroke-linecap="round" opacity="${opC.toFixed(2)}"/>`;
  }
  // humo detrás del avión
  for (let i = 0; i < 16; i++) {
    const u = ((lt * 6 + i / 16) % 1), x = p.x - (40 + u * 260) * p.esc / 3.2, y = p.y + (12 + u * 140 * vel) * p.esc / 3.2;
    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${((6 + u * 26) * p.esc / 3.2).toFixed(1)}" fill="#ffd6e0" opacity="${((1 - u) * .35).toFixed(2)}"/>`;
  }
  // chispas en cada hito (×2, ×5, ×10, ×20)
  for (const [j, M] of [2, 5, 10, 20].entries()) {
    const tM = AV.despega + Math.pow(Math.log(M) / Math.log(AV.mFin), 1 / 1.55) * (AV.cobro - AV.despega), u = lt - tM;
    if (u < 0 || u > .7) continue;
    for (let i = 0; i < 18; i++) {
      const a = azar(i * 3 + j * 50) * 6.283, v = 200 + azar(i * 7 + j) * 500;
      svg += `<circle cx="${(p.x + Math.cos(a) * v * u).toFixed(1)}" cy="${(p.y + Math.sin(a) * v * u + 300 * u * u).toFixed(1)}" r="${(3 + azar(i) * 4).toFixed(1)}" fill="${['#ffd36b', '#fff', '#ff9f43'][i % 3]}" opacity="${(1 - u / .7).toFixed(2)}"/>`;
    }
  }
  svg += avionSvg(p.x, p.y, p.ang, p.esc, lt, clamp((q - .55) / .3));
  const tomas = DEFS_CASINO + `<div class="capa" style="background:linear-gradient(180deg, ${rgbS(cArr)} 0%, ${rgbS(cAba)} 100%)"></div>
    <svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;transform:translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)">${svg}</svg>
    ${cobrado ? `<div class="capa" style="background:rgba(0,0,0,${(.45 * prog(lt, AV.cobro + .15, AV.cobro + .6)).toFixed(2)})"></div>` : ''}`;

  // ---- textos ----
  let textos = '';
  const colM = cobrado ? '#33e07a' : m >= 10 ? '#ff5cf0' : m >= 2 ? '#ffcf3f' : '#ff3d6e';
  const mostrar = cobrado ? AV.mFin : m;
  const pul = cobrado ? 1 + .25 * Math.max(0, 1 - (lt - AV.cobro) * 4) : 1 + .04 * Math.sin(lt * 14) * k;
  const subeM = eIO(prog(lt, AV.cobro + .35, AV.cobro + .8));          // al cobrar sube para dar paso al cartel
  textos += `<div class="centro" style="top:${lerp(110, 40, subeM)}px;transform:scale(${(pul * lerp(1, .62, subeM)).toFixed(3)});transform-origin:50% 0">
    <div style="font:700 210px/1 'Space Grotesk',sans-serif;letter-spacing:-.02em;color:#fff;text-shadow:0 0 40px ${colM},0 0 90px ${colM}88,0 8px 0 rgba(0,0,0,.35)">×${coma(mostrar)}</div>
    <div class="mono" style="margin-top:14px;font-size:34px;font-weight:700;color:${cobrado ? '#33e07a' : '#ffffffcc'}">${cobrado ? 'Te retiraste a tiempo' : lt < AV.despega ? 'Despegando…' : 'retiro automático en ×27,10'}</div></div>`;
  if (!cobrado) textos += `<div class="chip" style="right:96px;top:80px;background:var(--ros);color:#0a0a0f">El Avión · apuesta 500</div>`;
  // monedas, cartel y contador
  if (cobrado) {
    const pc = posAv(AV.cobro);
    textos += rayos(lt, W / 2, 470, 900, .9 * prog(lt, AV.cobro + .3, AV.cobro + .8));
    textos += `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0">${explosion(lt, AV.cobro, pc.x, pc.y, 170, { sem: 3 })}${lluvia(lt, AV.cobro + .45, DUR_AVION, 120, 7)}</svg>`;
    textos += cartel('BIG WIN', lt, AV.cobro + .45, 300, 250);
    textos += placa('+13.550', lt, AV.cobro + .45, 640, 150);
    textos += golpe('¡COBRADO!', lt, AV.cobro, { tam: 120, color: '#33e07a', y: 920, estilo: 'text-shadow:0 0 40px rgba(51,224,122,.7)' });
    textos += bombillas(lt, prog(lt, AV.cobro + .3, AV.cobro + .5));
  }
  let flash = 0;
  for (const M of [2, 5, 10, 20]) { const tM = AV.despega + Math.pow(Math.log(M) / Math.log(AV.mFin), 1 / 1.55) * (AV.cobro - AV.despega); if (lt >= tM) flash = Math.max(flash, .16 - (lt - tM) * 1.2); }
  if (cobrado) flash = Math.max(flash, .95 - (lt - AV.cobro) * 4);
  flash = Math.max(flash, .5 - lt * 3);
  return { tomas, textos, flash: Math.max(0, flash) };
}

/* ======================= PLINKO ======================= */
const PK = { filas: 16, s: 58, v: 51, cx: W / 2, y0: 132, dt: .135, oro: 1.2, lento: 2.9, vel: .34,
  tabla: [988, 128, 25.6, 8.89, 3.95, 1.97, .19, .19, .19, .19, .19, 1.97, 3.95, 8.89, 25.6, 128, 988] };
// tiempo deformado: cámara lenta mientras cae la dorada
const PK_W_LENTO_FIN = PK.oro + 16 * PK.dt + .25;                       // la dorada toca la casilla (tiempo deformado)
const PK_ATERRIZA = PK.lento + (PK_W_LENTO_FIN - PK.lento) / PK.vel;     // ... en segundos reales
function wPk(lt) {
  if (lt < PK.lento) return lt;
  if (lt < PK_ATERRIZA) return PK.lento + (lt - PK.lento) * PK.vel;
  return PK_W_LENTO_FIN + (lt - PK_ATERRIZA);
}
const colorCasilla3 = c => { const t = Math.abs(c - 8) / 8, a = [255, 216, 77], b = [255, 45, 85]; return rgbS(a.map((x, k) => Math.round(x + (b[k] - x) * Math.pow(t, .8)))); };
const pegX = (r, j) => PK.cx + (j - (r + 2) / 2) * PK.s, pegY = r => PK.y0 + r * PK.v;
const yCas = () => PK.y0 + 15 * PK.v + 42;
// bolas: 34 rosadas y la dorada (índice 34), cada una con su camino de izquierdas/derechas
const BOLAS = (() => {
  const L = [];
  for (let i = 0; i < 34; i++) {
    const c = [0]; for (let r = 0; r < 16; r++) c.push(c[r] + (azar(i * 37.1 + r * 5.3) < .5 ? 1 : 0));
    L.push({ w0: i < 20 ? i * .1 : 1.95 + (i - 20) * .16, c, oro: false });
  }
  const c = [0]; for (let r = 0; r < 16; r++) c.push(c[r] + 1);          // siempre a la derecha: ×988
  L.push({ w0: PK.oro, c, oro: true });
  return L;
})();
// posición de una bola en tiempo deformado w (o null si aún no sale / ya cayó)
function posBola(b, w) {
  const u = w - b.w0, rb = 12;
  if (u < 0) return null;
  const caida = .25;
  if (u < caida) { const k = u / caida; return { x: PK.cx, y: lerp(PK.y0 - 90, pegY(0) - 7 - rb, k * k), fila: -1 }; }
  const n = (u - caida) / PK.dt, r = Math.floor(n), k = n - r;
  if (r >= 16) { const t2 = n - 16; return t2 > 1.2 ? null : { x: PK.cx + (b.c[16] - 8) * PK.s, y: yCas() + 8, fila: 16, fuera: t2 }; }
  const x0 = pegX(r, b.c[r] + 1), y0 = pegY(r) - 7 - rb;
  const x1 = r < 15 ? pegX(r + 1, b.c[r + 1] + 1) : PK.cx + (b.c[16] - 8) * PK.s, y1 = r < 15 ? pegY(r + 1) - 7 - rb : yCas() + 8;
  const ke = k * (2 - k) * .3 + k * .7;
  return { x: lerp(x0, x1, ke), y: lerp(y0, y1, k * k) - 26 * Math.sin(Math.PI * k) * (1 - k * .4), fila: r, k };
}

function casinoPlinko(lt) {
  const w = wPk(lt), oro = BOLAS[34], po = posBola(oro, w), aterrizo = lt >= PK_ATERRIZA;
  // golpes en clavos y casillas
  const luzClavo = {}, golpeCas = {};
  for (const b of BOLAS) {
    const u = w - b.w0 - .25; if (u < 0) continue;
    const r = Math.floor(u / PK.dt);
    for (let rr = Math.max(0, r - 2); rr <= Math.min(15, r); rr++) {
      const de = u - rr * PK.dt; if (de < 0 || de > .3) continue;
      const key = rr + ',' + (b.c[rr] + 1); luzClavo[key] = Math.max(luzClavo[key] || 0, 1 - de / .3);
    }
    const dc = u - 16 * PK.dt; if (dc >= 0 && dc < .5) golpeCas[b.c[16]] = Math.max(golpeCas[b.c[16]] || 0, 1 - dc / .5);
  }
  if (aterrizo) golpeCas[16] = Math.max(golpeCas[16] || 0, 1 - (lt - PK_ATERRIZA) / 1.4);
  // cámara: se acerca a la dorada en el tramo lento y vuelve de golpe al caer
  const zIn = eIO(prog(lt, PK.lento - .15, PK.lento + .8)), zOut = eOutX(prog(lt, PK_ATERRIZA, PK_ATERRIZA + .5));
  const destino = { x: PK.cx + 8 * PK.s - 30, y: yCas() - 70 };
  const foco = po && !aterrizo ? { x: lerp(po.x, destino.x, .45), y: lerp(po.y, destino.y, .55) } : destino;
  const S = 1 + 2.6 * zIn * (1 - zOut), cxF = lerp(W / 2, foco.x, zIn * (1 - zOut)), cyF = lerp(H / 2, foco.y, zIn * (1 - zOut));
  const tx = W / 2 - cxF * S, ty = H / 2 - cyF * S;
  const lento = lt > PK.lento && !aterrizo, dim = lento ? .3 + .7 * (1 - zIn) : 1;

  let svg = '';
  // tablero
  svg += `<rect x="${PK.cx - 560}" y="${PK.y0 - 120}" width="1120" height="${yCas() - PK.y0 + 200}" rx="40" fill="#0e1838" opacity=".55"/>`;
  svg += `<rect x="${PK.cx - 34}" y="${PK.y0 - 112}" width="68" height="22" rx="8" fill="#ffffff22"/>`;
  for (let r = 0; r < 16; r++) for (let j = 0; j < r + 3; j++) {
    const kl = luzClavo[r + ',' + j] || 0, x = pegX(r, j), y = pegY(r);
    if (kl > 0) svg += `<circle cx="${x}" cy="${y}" r="${(7 * (2 + 3 * kl)).toFixed(1)}" fill="rgba(255,120,190,${(.35 * kl).toFixed(2)})"/>`;
    svg += `<circle cx="${x}" cy="${y}" r="7" fill="${kl > 0 ? `rgb(255,${Math.round(230 - 90 * kl)},${Math.round(255 - 40 * kl)})` : '#d9d6f5'}"/>`;
  }
  // casillas
  const yc = yCas(), hc = 38, wc = PK.s * .9;
  for (let c = 0; c <= 16; c++) {
    const g = golpeCas[c] || 0, dy = g > 0 ? Math.sin((1 - g) * Math.PI * 3) * 10 * g : 0, x = PK.cx + (c - 8) * PK.s, col = colorCasilla3(c);
    const grande = c === 16 && (lento || aterrizo);
    if (g > 0 || grande) svg += `<rect x="${x - wc / 2 - 8}" y="${yc + dy - 8}" width="${wc + 16}" height="${hc + 16}" rx="12" fill="${col}" opacity="${(Math.max(g, grande ? .35 + .25 * Math.sin(lt * 12) : 0) * .55).toFixed(2)}"/>`;
    svg += `<rect x="${x - wc / 2}" y="${(yc + dy).toFixed(1)}" width="${wc}" height="${hc}" rx="7" fill="${col}"/><rect x="${x - wc / 2}" y="${(yc + dy + hc - 4).toFixed(1)}" width="${wc}" height="4" fill="#0000004d"/>
      <text x="${x}" y="${(yc + dy + hc / 2 + 6.5).toFixed(1)}" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="${PK.tabla[c] >= 100 ? 19 : 18}" fill="#2a0a12">${textoMultPk(PK.tabla[c])}</text>`;
  }
  // bolas rosadas
  for (let i = 0; i < 34; i++) {
    const p = posBola(BOLAS[i], w); if (!p) continue;
    const op = (p.fuera !== undefined ? Math.max(0, 1 - p.fuera / .3) : 1) * dim;
    if (op <= 0) continue;
    svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="24" fill="url(#cHaloRosa)" opacity="${op.toFixed(2)}"/><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="12" fill="url(#cBola)" opacity="${op.toFixed(2)}"/>`;
  }
  // la dorada, con estela (más larga en cámara lenta)
  if (po && (po.fuera === undefined || po.fuera < .3)) {
    for (let j = 6; j >= 1; j--) { const pe = posBola(oro, w - j * (lento ? .012 : .025)); if (pe) svg += `<circle cx="${pe.x.toFixed(1)}" cy="${pe.y.toFixed(1)}" r="${(11 - j).toFixed(1)}" fill="#ffd21f" opacity="${(.08 + .04 * (6 - j)).toFixed(2)}"/>`; }
    svg += `<circle cx="${po.x.toFixed(1)}" cy="${po.y.toFixed(1)}" r="${lento ? 40 : 30}" fill="url(#cHalo)"/><circle cx="${po.x.toFixed(1)}" cy="${po.y.toFixed(1)}" r="13.5" fill="url(#cBolaOro)" stroke="#fff6c2" stroke-width="1.5"/>`;
  }
  let tomas = DEFS_CASINO + `<div class="capa" style="background:radial-gradient(ellipse at 50% 35%, #2a1d5e 0%, #0e1838 45%, #1d0f36 100%)"></div>
    <svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;transform-origin:0 0;transform:translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${S.toFixed(4)})">${svg}</svg>`;
  // viñeta de suspenso con latido
  if (lento) tomas += `<div class="capa" style="background:radial-gradient(ellipse at 50% 50%, transparent ${lerp(70, 34, zIn)}%, rgba(0,0,0,${(.85 * zIn).toFixed(2)}) 100%)"></div>
    <div class="capa" style="box-shadow:inset 0 0 ${(220 + 80 * Math.abs(Math.sin(lt * 6))).toFixed(0)}px rgba(255,30,80,${(.28 * zIn * (.6 + .4 * Math.abs(Math.sin(lt * 6)))).toFixed(2)})"></div>`;
  if (aterrizo) tomas += `<div class="capa" style="background:rgba(10,4,20,${(.55 * prog(lt, PK_ATERRIZA + .25, PK_ATERRIZA + .7)).toFixed(2)})"></div>`;

  // ---- textos ----
  let textos = '';
  if (!aterrizo) {
    textos += `<div class="chip" style="right:96px;top:80px;background:var(--ama);color:#0a0a0f;opacity:${(1 - zIn).toFixed(2)}">Plinko · riesgo alto · 16 filas</div>
      <div class="chip" style="left:96px;top:80px;background:#ffffff1f;color:#fff;opacity:${(1 - zIn).toFixed(2)}">Apuesta 50 · ${BOLAS.filter(b => w >= b.w0).length} bolas</div>`;
    if (lento) textos += `<div class="centro mono" style="bottom:40px;font-size:38px;font-weight:700;color:#ffd21f;text-shadow:0 0 18px #000,0 0 40px #000;opacity:${(zIn * (.6 + .4 * Math.sin(lt * 6))).toFixed(2)}">la dorada va por el borde…</div>`;
  } else {
    const xc = PK.cx + 8 * PK.s;
    textos += rayos(lt, W / 2, 400, 950, .95 * prog(lt, PK_ATERRIZA + .2, PK_ATERRIZA + .7), '255,61,127');
    textos += `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0">${explosion(lt, PK_ATERRIZA + .02, xc, yCas(), 200, { sem: 11, fuerza: 1.15, abre: 1.6 })}${lluvia(lt, PK_ATERRIZA + .3, DUR_PLINKO, 150, 21)}</svg>`;
    textos += golpe('×988', lt, PK_ATERRIZA, { tam: 300, color: 'var(--ros)', y: 40, estilo: 'text-shadow:0 0 60px rgba(255,61,127,.8)' });
    textos += cartel('MEGA WIN', lt, PK_ATERRIZA + .4, 410, 210);
    textos += placa('+49.400', lt, PK_ATERRIZA + .65, 700, 140);
    textos += bombillas(lt, prog(lt, PK_ATERRIZA + .2, PK_ATERRIZA + .4));
  }
  let flash = Math.max(0, .4 - lt * 3);
  if (aterrizo) flash = Math.max(flash, 1 - (lt - PK_ATERRIZA) * 4);
  return { tomas, textos, flash };
}
// Momentos para el audio (segundos dentro de cada escena)
const CASINO_AUDIO = {
  dipDesde: PK.lento - .1, dipHasta: PK_ATERRIZA, impactos: [PK_ATERRIZA],             // Plinko
  avion: { hitos: [2, 5, 10, 20].map(M => AV.despega + Math.pow(Math.log(M) / Math.log(AV.mFin), 1 / 1.55) * (AV.cobro - AV.despega)), cobro: AV.cobro },
};
