// Los "grupos" de un archivo de sonido BRSAR (revo_kart.brsar, 102 MB): dónde empieza y termina cada uno.
//
// Resumen: el sonido de Mario Kart Wii está en un solo archivo enorme, partido en ~490 grupos (los sonidos de cada
// personaje, de cada pista, de los menús…). Al cargar una carrera el juego lee los grupos que necesita, cada uno de a
// pedazos y esperando cada pedazo; con la red del sitio eso son decenas de esperas seguidas. Si la página sabe dónde
// está cada grupo, apenas el juego toca uno puede bajarlo entero de una vez (disco.mjs, agrupar).
//
// El formato es público (Tockdom, "BRSAR"; big-endian). Lo que se usa:
//   encabezado: "RSAR", y en 0x18 dónde está la sección INFO;
//   INFO: "INFO", tamaño, y 6 referencias de 8 bytes (u8 es-desplazamiento, u8 tipo, u16, u32 valor) relativas al
//         byte 8 de INFO; la 5.ª lleva a la tabla de grupos: u32 cantidad y una referencia por grupo;
//   cada grupo: u32 nombre, s32 entrada, referencia de 8 bytes (ruta externa), u32 inicio y u32 tamaño de sus datos,
//         u32 inicio y u32 tamaño de sus ondas (los dos en bytes desde el principio del archivo).
// Escrito desde esa descripción (no se copió código de nadie). No contiene nada del juego: lee la tabla al vuelo.

// Hasta dónde hay que leer el archivo para tener la tabla (el final de la sección INFO), o 0 si no es un BRSAR.
export function largoEncabezadoBrsar(cabeza) {
  if (!cabeza || cabeza.length < 0x20) return 0;
  const v = new DataView(cabeza.buffer, cabeza.byteOffset, cabeza.byteLength);
  if (v.getUint32(0) !== 0x52534152) return 0;                  // "RSAR"
  return v.getUint32(0x18) + v.getUint32(0x1C);                 // inicio + tamaño de INFO
}

// Rangos [inicio, fin) de cada grupo (datos y ondas juntos cuando van seguidos), ordenados; [] si algo no cuadra.
export function gruposBrsar(bytes, tamArchivo = Infinity) {
  try {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (v.getUint32(0) !== 0x52534152) return [];
    const info = v.getUint32(0x18);
    if (v.getUint32(info) !== 0x494E464F) return [];            // "INFO"
    const base = info + 8;
    const tabla = base + v.getUint32(base + 4 * 8 + 4);         // 5.ª referencia: los grupos
    const n = v.getUint32(tabla);
    if (n > 100000) return [];
    const rangos = [];
    for (let i = 0; i < n; i++) {
      const g = base + v.getUint32(tabla + 4 + 8 * i + 4);
      const ini = v.getUint32(g + 16), tam = v.getUint32(g + 20), oIni = v.getUint32(g + 24), oTam = v.getUint32(g + 28);
      const partes = [[ini, ini + tam], [oIni, oIni + oTam]].filter(([a, b]) => b > a && b <= tamArchivo);
      if (partes.length === 2 && partes[0][1] === partes[1][0]) rangos.push([partes[0][0], partes[1][1]]);
      else rangos.push(...partes);
    }
    return rangos.sort((a, b) => a[0] - b[0]);
  } catch { return []; }                                         // tabla cortada o desplazamientos fuera del archivo
}
