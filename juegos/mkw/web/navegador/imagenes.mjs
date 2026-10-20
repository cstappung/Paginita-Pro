// Las imágenes para elegir pista (ícono de copa, foto, plano y videíto), sacadas de los paquetes — bitácora §56.
//
// Resumen: herramientas/empaquetar-imagenes.mjs junta cientos de imágenes en unos pocos paquetes (.pak) para gastar
// pocas pedidas al Worker/R2 (la cuenta gratis da ~100 000 al día). Este módulo:
//   - pide indice.json una vez (qué paquete tiene qué);
//   - pide cada paquete solo cuando hace falta y una sola vez (el navegador además lo guarda en su caché);
//   - lo abre ("MKWI" + índice + archivos) y le da a cada imagen una dirección local (blob:), que un <img> muestra;
//   - de los videítos guarda solo los de las últimas 12 copas (cada uno pesa ~100 KB) y suelta los viejos;
//   - si no hay paquetes (probando sin empaquetar), usa los archivos sueltos de build/imagenes.
//
// Uso:  const img = crearImagenes(ORIGEN + '/build/imagenes');
//       await img.copa(3) / img.foto(3, 1) / img.plano(3, 1) / img.clip(3, 1)  → dirección para <img src>, o ''

const hex = (c, f) => (0x100 + 4 * c + f).toString(16);
const MAX_CLIPS = 12;

export function crearImagenes(base) {
  const dir = base + '/paquetes/';
  let indice = null;
  const paquetes = new Map();                       // nombre del paquete → Promise<Map(nombre → blob: URL)>
  const clipsUsados = [];                           // nombres de paquetes de videítos, del más viejo al más nuevo

  const leerIndice = () => indice ||= fetch(dir + 'indice.json').then(r => r.ok ? r.json() : null).catch(() => null);

  async function abrir(nombre) {
    const r = await fetch(dir + nombre);
    if (!r.ok) throw new Error(`${nombre}: ${r.status}`);
    let b = new Uint8Array(await r.arrayBuffer());
    if (b[0] === 0x1F && b[1] === 0x8B) {           // en gzip (el de planos): se abre en el navegador
      b = new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    }
    if (String.fromCharCode(...b.subarray(0, 4)) !== 'MKWI') throw new Error(nombre + ': no es un paquete');
    const largo = new DataView(b.buffer, b.byteOffset).getUint32(4, true);
    const lista = JSON.parse(new TextDecoder().decode(b.subarray(8, 8 + largo)));
    const urls = new Map();
    for (const [n, [desde, cuanto, tipo]] of Object.entries(lista)) {
      urls.set(n, URL.createObjectURL(new Blob([b.subarray(8 + largo + desde, 8 + largo + desde + cuanto)], { type: tipo })));
    }
    return urls;
  }
  function paquete(nombre) {
    if (!paquetes.has(nombre)) paquetes.set(nombre, abrir(nombre).catch(e => { paquetes.delete(nombre); console.warn('[imagenes]', e.message); return new Map(); }));
    return paquetes.get(nombre);
  }
  function soltarClipsViejos(nombre) {
    const i = clipsUsados.indexOf(nombre);
    if (i >= 0) clipsUsados.splice(i, 1);
    clipsUsados.push(nombre);
    while (clipsUsados.length > MAX_CLIPS) {
      const viejo = clipsUsados.shift(), p = paquetes.get(viejo);
      paquetes.delete(viejo);
      p?.then(urls => urls.forEach(u => URL.revokeObjectURL(u)));
    }
  }
  // De un paquete o, si no hay índice, el archivo suelto
  async function una(tipo, clave, nombrePaquete, suelto) {
    const ind = await leerIndice();
    if (!ind) return suelto;
    const n = nombrePaquete(ind);
    if (!n) return '';
    if (tipo === 'clip') soltarClipsViejos(n);
    return (await paquete(n)).get(clave) || '';
  }
  return {
    copa: c => una('copa', String(c), i => i.copas, `${base}/copas64/${String(c).padStart(3, '0')}.png`),
    foto: (c, f) => una('foto', hex(c, f), i => i.fotos[Math.floor((4 * c + f) / 48)], `${base}/pistas/${hex(c, f)}.webp`),
    plano: (c, f) => una('plano', hex(c, f), i => i.planos, `${base}/planos/${hex(c, f)}.svg`),
    clip: (c, f) => una('clip', hex(c, f), i => i.clips[c], `${base}/clips/${hex(c, f)}.webp`),
    nombres: async () => (await leerIndice())?.nombres || null,
    // §74: al abrir la lista se bajan de a uno (sin apurar al juego ni a la red) los paquetes que la vista previa usa
    // apenas se pasa el mouse: íconos, planos y las fotos de las pistas (~6 MB en total). Los videítos no: pesan más y
    // se piden solo si uno se queda mirando una pista. Sin esto, la primera pista de cada grupo de 48 tardaba hasta
    // 1,5 s en mostrarse con la red del sitio.
    async precargar() {
      const ind = await leerIndice();
      if (!ind) return;
      for (const n of [ind.copas, ind.planos, ...Object.values(ind.fotos || {})]) if (n) await paquete(n);
    },
  };
}
