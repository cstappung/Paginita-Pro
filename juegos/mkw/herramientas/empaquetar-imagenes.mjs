// Junta las imágenes de elegir pista en unos pocos PAQUETES, para gastar pocas pedidas al Worker/R2 — bitácora §56.
//
// Resumen: la cuenta gratis de Cloudflare da ~100 000 pedidas al día al Worker y 10 GB en R2. Con un archivo por
// imagen (105 íconos + 360 fotos + 360 planos + 360 videítos) cada persona que mira la lista gastaría cientos de
// pedidas. Con paquetes gasta unas pocas, una sola vez (después quedan en la caché del navegador):
//   copas.pak       los 105 íconos de 64 px                                   (1 pedida al abrir la lista)
//   planos.pak      los planos SVG, comprimidos con gzip                       (1 pedida)
//   fotos-N.pak     las fotos, de a 12 copas (48 pistas) por paquete          (1 pedida por grupo que se mira)
//   clips-NNN.pak   los videítos de una copa (4 pistas)                       (1 pedida por copa, solo si te quedas
//                                                                               mirando una pista ~½ s)
//   indice.json     qué paquete tiene qué (lo único que se pide siempre; es chico)
// Cada paquete lleva en el nombre una huella de su contenido (p. ej. copas.3f9a1c2e.pak): si cambia, cambia el nombre,
// así el Worker puede decirle al navegador "guárdalo para siempre" (Cache-Control: immutable) sin riesgo.
//
// Formato de un paquete: "MKWI" + largo del índice (4 bytes, little-endian) + índice JSON {nombre: [desde, largo,
// tipo]} + los archivos uno tras otro. El de planos va además entero en gzip (la página lo abre con
// DecompressionStream). Lo lee web/navegador/imagenes.mjs.
// Son imágenes del juego: build/ nunca va a git; los paquetes se suben a R2 detrás del Worker de amigos.
//
// Uso:  node herramientas/empaquetar-imagenes.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(raiz, 'build/web/navegador/imagenes');
const salida = path.join(base, 'paquetes');
const TIPOS = { '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function paquete(archivos) {                         // archivos: [[nombre, ruta]] → Buffer
  const datos = [], indice = {};
  let desde = 0;
  for (const [nombre, ruta] of archivos) {
    const b = readFileSync(ruta);
    indice[nombre] = [desde, b.length, TIPOS[path.extname(ruta)] || 'application/octet-stream'];
    datos.push(b); desde += b.length;
  }
  const j = Buffer.from(JSON.stringify(indice)), largo = Buffer.alloc(4);
  largo.writeUInt32LE(j.length);
  return Buffer.concat([Buffer.from('MKWI'), largo, j, ...datos]);
}
const huella = b => createHash('sha256').update(b).digest('hex').slice(0, 8);
rmSync(salida, { recursive: true, force: true });
mkdirSync(salida, { recursive: true });
const indice = { version: 1, copas: null, planos: null, fotos: {}, clips: {}, nombres: null };
let total = 0, cuantos = 0;
function guardar(prefijo, b) {
  const nombre = `${prefijo}.${huella(b)}.pak`;
  writeFileSync(path.join(salida, nombre), b);
  total += b.length; cuantos++;
  return nombre;
}
const lista = carpeta => existsSync(path.join(base, carpeta)) ? readdirSync(path.join(base, carpeta)).map(f => [f, path.join(base, carpeta, f)]) : [];

// íconos: copa n → "n" (copas64/NNN.png)
const copas = lista('copas64').map(([f, r]) => [String(parseInt(f, 10)), r]);
if (copas.length) indice.copas = guardar('copas', paquete(copas));
// planos: pista hex → "hex", el paquete entero en gzip
const planos = lista('planos').filter(([f]) => /^[0-9a-f]+\.svg$/.test(f)).map(([f, r]) => [f.replace('.svg', ''), r]);
if (planos.length) indice.planos = guardar('planos', gzipSync(paquete(planos), { level: 9 }));
// fotos: de a 48 pistas (grupo = floor((hex - 0x100) / 48))
const grupos = {};
for (const [f, r] of lista('pistas')) {
  if (!/^[0-9a-f]+\.webp$/.test(f)) continue;
  const n = parseInt(f, 16) - 0x100, g = Math.floor(n / 48);
  (grupos[g] ||= []).push([f.replace('.webp', ''), r]);
}
for (const [g, archivos] of Object.entries(grupos)) indice.fotos[g] = guardar(`fotos-${g}`, paquete(archivos));
// videítos: de a una copa (4 pistas)
const porCopa = {};
for (const [f, r] of lista('clips')) {
  if (!/^[0-9a-f]+\.webp$/.test(f)) continue;
  const c = (parseInt(f, 16) - 0x100) >> 2;
  (porCopa[c] ||= []).push([f.replace('.webp', ''), r]);
}
for (const [c, archivos] of Object.entries(porCopa)) indice.clips[c] = guardar(`clips-${String(c).padStart(3, '0')}`, paquete(archivos));
// los nombres de las pistas (para mostrarlos antes de que arranque el juego)
if (existsSync(path.join(base, 'pistas.json'))) indice.nombres = JSON.parse(readFileSync(path.join(base, 'pistas.json'), 'utf8'));
writeFileSync(path.join(salida, 'indice.json'), JSON.stringify(indice));
console.log(`${cuantos} paquetes, ${(total / 1048576).toFixed(1)} MB en ${path.relative(raiz, salida)}: ` +
  `${copas.length} íconos, ${planos.length} planos, ${Object.values(grupos).flat().length} fotos (${Object.keys(grupos).length} paquetes), ` +
  `${Object.values(porCopa).flat().length} videítos (${Object.keys(porCopa).length} paquetes)`);
