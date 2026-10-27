/* Una fuente de mentira con la forma de las del juego (nada del juego: letras dibujadas por el navegador), para las
   páginas del banco que prueban la letra del juego (cuenta-dnf, letreros). Antes vivía dentro de cuenta-dnf; M22 la
   pasó aquí para usarla en las dos.
   Resumen: hacerBrfnt(letras, celdaW, celdaH, estiloCanvas) = un BRFNT (las letras en hojas IA4, con sus anchos y su
   mapa de caracteres); hacerU8([[nombre, bytes], …]) = el archivo U8 que las junta; hacerYaz0(bytes) = comprimido como
   los .szs. hacerYaz0(hacerU8([...])) es un «Font.szs» que fuente-wii.mjs abre igual que el de verdad. */
// ---- una fuente de mentira con la forma de las del juego (nada del juego: letras del navegador) ----
// Cada letra se dibuja en su celda: relleno blanco (intensidad 1) y borde negro (intensidad 0), y la opacidad de la
// letra; se guarda en IA4 (4 bits de opacidad arriba, 4 de intensidad abajo) en baldosas de 8×4, como la Wii.
export function hacerBrfnt(letras, celdaW, celdaH, estilo) {
  const porFila = 8, porCol = Math.ceil(letras.length / porFila);
  const hojaW = Math.ceil(porFila * (celdaW + 1) / 8) * 8, hojaH = Math.ceil(porCol * (celdaH + 1) / 4) * 4;
  const lz = document.createElement('canvas'); lz.width = hojaW; lz.height = hojaH;
  const ctx = lz.getContext('2d');
  ctx.font = estilo; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  const anchos = [];
  [...letras].forEach((ch, k) => {
    const x = (k % porFila) * (celdaW + 1), y = Math.floor(k / porFila) * (celdaH + 1), w = Math.ceil(ctx.measureText(ch).width);
    ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(ch, x + 3, y + celdaH - 8);
    ctx.fillStyle = '#fff'; ctx.fillText(ch, x + 3, y + celdaH - 8);
    anchos.push([0, Math.min(celdaW, w + 6), Math.min(celdaW, w + 4)]);
  });
  const px = ctx.getImageData(0, 0, hojaW, hojaH).data, hoja = new Uint8Array(hojaW * hojaH);
  let p = 0;
  for (let by = 0; by < hojaH; by += 4) for (let bx = 0; bx < hojaW; bx += 8)
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
      const q = ((by + y) * hojaW + bx + x) * 4;
      hoja[p++] = (Math.round(px[q + 3] / 17) << 4) | Math.round(px[q] / 17);
    }
  // secciones: FINF (0x20) · TGLP (0x20 + la hoja, alineada a 0x20) · CWDH · CMAP de los dígitos (tramo) · CMAP del resto (pares)
  const digitos = [...letras].map((ch, i) => [ch, i]).filter(([ch]) => /[0-9]/.test(ch));
  const resto = [...letras].map((ch, i) => [ch.codePointAt(0), i]).filter(([c]) => c < 0x30 || c > 0x39);
  const tramo = digitos.length === 10 && digitos.every(([ch, i], k) => ch === String(k) && i === digitos[0][1] + k);
  const finf = 0x10, tglp = 0x30, datos = 0x60, cwdh = datos + hoja.length;
  const cwdhTam = Math.ceil((0x10 + 3 * letras.length) / 4) * 4;
  const cmap1 = cwdh + cwdhTam, cmap1Tam = tramo ? 0x18 : 0;
  const cmap2 = cmap1 + cmap1Tam, cmap2Tam = Math.ceil((0x16 + 4 * resto.length) / 4) * 4;
  const total = cmap2 + cmap2Tam, b = new Uint8Array(total), v = new DataView(b.buffer);
  const tag = (o, t) => [...t].forEach((c, i) => b[o + i] = c.charCodeAt(0));
  tag(0, 'RFNT'); v.setUint16(4, 0xFEFF); v.setUint16(6, 0x0104); v.setUint32(8, total); v.setUint16(12, 0x10); v.setUint16(14, tramo ? 5 : 4);
  tag(finf, 'FINF'); v.setUint32(finf + 4, 0x20); b[finf + 8] = 1; b[finf + 9] = celdaH; b[finf + 0xF] = 1;
  v.setUint32(finf + 0x10, tglp + 8); v.setUint32(finf + 0x14, cwdh + 8); v.setUint32(finf + 0x18, (tramo ? cmap1 : cmap2) + 8);
  b[finf + 0x1C] = celdaH; b[finf + 0x1D] = celdaW; b[finf + 0x1E] = celdaH - 8;
  tag(tglp, 'TGLP'); v.setUint32(tglp + 4, cwdh - tglp); b[tglp + 8] = celdaW; b[tglp + 9] = celdaH; b[tglp + 10] = celdaH - 8; b[tglp + 11] = celdaW;
  v.setUint32(tglp + 12, hoja.length); v.setUint16(tglp + 16, 1); v.setUint16(tglp + 18, 2); v.setUint16(tglp + 20, porFila); v.setUint16(tglp + 22, porCol);
  v.setUint16(tglp + 24, hojaW); v.setUint16(tglp + 26, hojaH); v.setUint32(tglp + 28, datos);
  b.set(hoja, datos);
  tag(cwdh, 'CWDH'); v.setUint32(cwdh + 4, cwdhTam); v.setUint16(cwdh + 8, 0); v.setUint16(cwdh + 10, letras.length - 1);
  anchos.forEach(([izq, an, av], i) => { v.setInt8(cwdh + 16 + 3 * i, izq); b[cwdh + 17 + 3 * i] = an; b[cwdh + 18 + 3 * i] = av; });
  if (tramo) {
    tag(cmap1, 'CMAP'); v.setUint32(cmap1 + 4, cmap1Tam); v.setUint16(cmap1 + 8, 0x30); v.setUint16(cmap1 + 10, 0x39); v.setUint16(cmap1 + 12, 0);
    v.setUint32(cmap1 + 16, cmap2 + 8); v.setUint16(cmap1 + 20, digitos[0][1]);
  }
  tag(cmap2, 'CMAP'); v.setUint32(cmap2 + 4, cmap2Tam); v.setUint16(cmap2 + 8, 0); v.setUint16(cmap2 + 10, 0xFFFF); v.setUint16(cmap2 + 12, 2);
  v.setUint16(cmap2 + 20, resto.length); resto.forEach(([c, i], k) => { v.setUint16(cmap2 + 22 + 4 * k, c); v.setUint16(cmap2 + 24 + 4 * k, i); });
  return b;
}
// U8 (raíz + carpeta "." + los archivos, datos alineados a 32) y Yaz0 (copias de la misma letra repetida + bytes tal cual)
export function hacerU8(archivos) {
  const nombres = ['', '.', ...archivos.map(([n]) => n)], offNom = [];
  let s = 0; const tablaNom = [];
  for (const n of nombres) { offNom.push(s); for (const c of n) tablaNom.push(c.charCodeAt(0)); tablaNom.push(0); s += n.length + 1; }
  const nodos = nombres.length, cab = 0x20, tamNodos = nodos * 12 + tablaNom.length;
  let datos = Math.ceil((cab + tamNodos) / 32) * 32;
  const pos = archivos.map(([, d]) => { const p = datos; datos = Math.ceil((datos + d.length) / 32) * 32; return p; });
  const b = new Uint8Array(datos), v = new DataView(b.buffer);
  v.setUint32(0, 0x55AA382D); v.setUint32(4, cab); v.setUint32(8, tamNodos); v.setUint32(12, Math.ceil((cab + tamNodos) / 32) * 32);
  const nodo = (i, carpeta, nom, a, c) => { const o = cab + i * 12; v.setUint32(o, (carpeta ? 0x01000000 : 0) | nom); v.setUint32(o + 4, a); v.setUint32(o + 8, c); };
  nodo(0, true, offNom[0], 0, nodos); nodo(1, true, offNom[1], 0, nodos);
  archivos.forEach(([, d], k) => { nodo(2 + k, false, offNom[2 + k], pos[k], d.length); b.set(d, pos[k]); });
  b.set(tablaNom, cab + nodos * 12);
  return b;
}
export function hacerYaz0(d) {
  const out = [0x59, 0x61, 0x7A, 0x30, d.length >>> 24, (d.length >> 16) & 255, (d.length >> 8) & 255, d.length & 255, 0, 0, 0, 0, 0, 0, 0, 0];
  let i = 0;
  while (i < d.length) {
    const control = out.length; out.push(0);
    for (let bit = 7; bit >= 0 && i < d.length; bit--) {
      let n = 0;
      if (i > 0) while (n < 0x111 && i + n < d.length && d[i + n] === d[i - 1]) n++;
      if (n >= 3) {                                           // copia de 1 atrás (la letra repetida): 3 bytes
        out.push(0x00, 0x00, n - 0x12 >= 0 ? n - 0x12 : 0);
        if (n < 0x12) { out.length -= 3; out.push(((n - 2) << 4) | 0, 0x00); }
        i += n;
      } else { out[control] |= 1 << bit; out.push(d[i++]); }
    }
  }
  return new Uint8Array(out);
}
