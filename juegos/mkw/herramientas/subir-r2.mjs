// Sube lo privado de Mario Kart Wii al R2 del dueño (el bucket del Worker de amigos) — bitácora §65.
//
// Resumen: el juego compilado, el disco extraído y Retro Rewind NO van a git ni a GitHub Pages: van al bucket R2 del
// dueño (el mismo `DISCO` de BT3, con el prefijo `mkw/`), y el Worker de amigos los entrega solo a la lista de amigos.
// Este script arma la lista exacta de lo que hay que subir, con la huella SHA-256 de cada archivo, y lo sube por la
// API "S3" de R2 directo desde este PC (no por el Worker: así no gasta pedidos del plan gratis ni choca con su tope de
// 100 MB por pedido; hay archivos del disco de más de 100 MB). Lo corre EL DUEÑO, con sus llaves de R2 en variables
// de entorno (nunca en un archivo). Tres pasos:
//   node herramientas/subir-r2.mjs                → revisar: arma la lista y la deja en build/web/publicar/ (sin red)
//   node herramientas/subir-r2.mjs --subir        → sube lo que falta o cambió (se puede cortar y repetir)
//   node herramientas/subir-r2.mjs --comprobar    → revisa en R2 que cada archivo esté con su tamaño y su huella
// y uno más, solo para mirar: --sobrantes (lo que hay en R2 bajo mkw/ que ya no está en la lista; no borra nada).
//
// Las llaves (Cloudflare → R2 → Manage R2 API Tokens → Create API token, permiso "Object Read & Write" solo para ese
// bucket): R2_CUENTA (el Account ID), R2_ID (Access Key ID), R2_SECRETO (Secret Access Key), R2_BUCKET (el nombre del
// bucket, el del binding DISCO del Worker). R2_ENDPOINT cambia el servidor (las pruebas usan uno falso local).
//
// Qué se sube (las llaves son las rutas que pide la página, con "mkw/" delante; las mismas que sirve servidor.mjs):
//   mkw/mkw/disco/…              el disco extraído (extraido/disco)
//   mkw/mkw/sd/RetroRewind6/…    Retro Rewind; mkw/mkw/sd/riivolution/… su partida base
//   mkw/wc/runtime/assets/…      los archivos base del runtime de WiiCompiled
//   mkw/build/…                  el programa: mkw.js (+ .br), mkw.wasm.br (el .wasm sin comprimir no: ~130 MB que
//                                Chrome nunca pide; --con-wasm lo agrega), pipelines.bin, bloques.json, imagenes/,
//                                diminutos.bin (§93: los archivos diminutos en un solo objeto, armado aquí)
//   mkw/manifiesto.json          la lista de archivos que verá el juego (ruta y tamaño), igual que servidor.mjs
//   mkw/version.json             {version, build}: huellas de TODO lo subido y del programa (el Worker las pone en
//                                las cabeceras X-Mkw-Version y X-Mkw-Build). Va AL FINAL: hasta que no está todo
//                                arriba, los jugadores siguen con la versión anterior.
//
// La firma de cada pedido es "AWS Signature Version 4" (la que usa S3 y acepta R2): una cuenta HMAC-SHA256 en cadena
// con el secreto, la fecha, la región ("auto") y el servicio, sobre una forma fija del pedido. El secreto nunca viaja:
// viaja la firma, que solo sirve para ESE pedido y por unos minutos. Como un sello que depende del contenido del sobre.
// Además cada archivo va con su SHA-256 en x-amz-content-sha256: R2 lo recalcula y rechaza el archivo si llegó distinto.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { armarDiminutos } from './diminutos.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- la firma (AWS Signature Version 4) ----------
const sha256 = d => crypto.createHash('sha256').update(d).digest('hex');
const hmac = (clave, d) => crypto.createHmac('sha256', clave).update(d).digest();
// codificar una parte de la ruta como pide S3: todo menos A-Z a-z 0-9 - _ . ~ (la "/" separa partes y no se toca)
const codifica = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
export function firmar({ metodo, host, ruta, consulta = '', cabeceras, hashCuerpo, id, secreto, region = 'auto', servicio = 's3', fecha }) {
  const amz = fecha.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');   // 20130524T000000Z
  const dia = amz.slice(0, 8);
  const todas = { ...Object.fromEntries(Object.entries(cabeceras).map(([k, v]) => [k.toLowerCase(), String(v).trim()])), host, 'x-amz-date': amz, 'x-amz-content-sha256': hashCuerpo };
  const nombres = Object.keys(todas).sort();
  const canonico = [metodo, ruta.split('/').map(codifica).join('/'), consulta,
    nombres.map(k => `${k}:${todas[k]}\n`).join(''), nombres.join(';'), hashCuerpo].join('\n');
  const alcance = `${dia}/${region}/${servicio}/aws4_request`;
  const aFirmar = ['AWS4-HMAC-SHA256', amz, alcance, sha256(canonico)].join('\n');
  const clave = hmac(hmac(hmac(hmac('AWS4' + secreto, dia), region), servicio), 'aws4_request');
  const firma = crypto.createHmac('sha256', clave).update(aFirmar).digest('hex');
  return { ...todas, authorization: `AWS4-HMAC-SHA256 Credential=${id}/${alcance}, SignedHeaders=${nombres.join(';')}, Signature=${firma}`, firma };
}

// ---------- la lista ----------
const TIPOS = { '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm',
                '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
function recorrer(carpeta, base = carpeta, salida = []) {
  const entradas = fs.readdirSync(carpeta, { withFileTypes: true });
  if (entradas.length === 0 && carpeta !== base) salida.push({ ruta: path.relative(base, carpeta).split(path.sep).join('/'), vacia: true });
  for (const e of entradas.sort((a, b) => a.name < b.name ? -1 : 1)) {
    const p = path.join(carpeta, e.name);
    if (e.isDirectory()) recorrer(p, base, salida);
    else if (e.isFile()) { const st = fs.statSync(p); salida.push({ ruta: path.relative(base, p).split(path.sep).join('/'), archivo: p, bytes: st.size, fecha: st.mtimeMs }); }
  }
  return salida;
}
// huellas guardadas (ruta|tamaño|fecha → sha256) para no releer 5 GB cada vez
function cacheHuellas(archivo) {
  let datos = {};
  try { datos = JSON.parse(fs.readFileSync(archivo, 'utf8')); } catch {}
  return {
    async de(f) {
      const k = `${f.archivo}|${f.bytes}|${f.fecha}`;
      if (datos[k]) return datos[k];
      const h = crypto.createHash('sha256');
      await new Promise((ok, mal) => fs.createReadStream(f.archivo).on('data', d => h.update(d)).on('end', ok).on('error', mal));
      return (datos[k] = h.digest('hex'));
    },
    guardar() { fs.mkdirSync(path.dirname(archivo), { recursive: true }); fs.writeFileSync(archivo, JSON.stringify(datos)); },
  };
}

export async function armarLista({ carpetas, build, conWasm = false, huellas }) {
  const objetos = [], manifiesto = {}, avisos = [];
  for (const [prefijo, carpeta] of carpetas) {                       // prefijo = lo que ve el juego: "/mkw/disco/"
    if (!fs.existsSync(carpeta)) throw new Error(`falta la carpeta ${carpeta} (${prefijo})`);
    const lista = recorrer(carpeta);
    manifiesto[prefijo] = lista.map(f => [f.ruta, f.vacia ? -1 : f.bytes]);
    for (const f of lista) if (!f.vacia) objetos.push({ llave: 'mkw' + prefijo + f.ruta, ...f });
  }
  // el programa: el .br tiene que ser del mismo programa (no más viejo que el .wasm), si no se sube algo viejo
  const prog = f => path.join(build, f);
  const fresco = f => { try { return fs.statSync(prog(f + '.br')).mtimeMs >= fs.statSync(prog(f)).mtimeMs; } catch { return false; } };
  if (!fs.existsSync(prog('mkw.js')) || !fs.existsSync(prog('mkw.wasm'))) throw new Error(`falta el programa en ${build} (compilar-web.py --modo navegador --final)`);
  if (!fresco('mkw.wasm')) throw new Error('mkw.wasm.br falta o es más viejo que mkw.wasm: node herramientas/comprimir-build.mjs');
  const deBuild = ['mkw.js', 'mkw.wasm.br', ...(fresco('mkw.js') ? ['mkw.js.br'] : []), ...(conWasm ? ['mkw.wasm'] : [])];
  if (!fresco('mkw.js')) avisos.push('mkw.js.br falta o es viejo: se sube solo mkw.js (sin comprimir, ~270 KB)');
  for (const extra of ['pipelines.bin', 'bloques.json']) if (fs.existsSync(prog(extra))) deBuild.push(extra); else avisos.push(`sin ${extra} (guion.mjs --semilla): la primera visita será más lenta`);
  for (const f of deBuild) { const st = fs.statSync(prog(f)); objetos.push({ llave: 'mkw/build/' + f, ruta: f, archivo: prog(f), bytes: st.size, fecha: st.mtimeMs }); }
  if (fs.existsSync(prog('imagenes'))) {
    for (const f of recorrer(prog('imagenes'))) if (!f.vacia) objetos.push({ llave: 'mkw/build/imagenes/' + f.ruta, ...f });
  } else avisos.push('sin build/…/imagenes (empaquetar-imagenes.mjs): la página no muestra fotos de pistas');
  // las huellas
  let hechos = 0;
  for (const o of objetos) {
    o.sha256 = await huellas.de(o);
    if (++hechos % 500 === 0) process.stdout.write(`  huellas: ${hechos} de ${objetos.length}\r`);
  }
  // §93 (E2): los ~600 archivos diminutos (≤ 8 KB) en un solo objeto, armado de los mismos archivos que se suben
  // (herramientas/diminutos.mjs): la primera visita los baja de un pedido en vez de uno por archivo
  const paquete = armarDiminutos(carpetas);
  objetos.push({ llave: 'mkw/build/diminutos.bin', ruta: 'diminutos.bin', datos: paquete, bytes: paquete.length, sha256: sha256(paquete) });
  const huellaDe = l => crypto.createHash('sha256').update(l.map(o => `${o.llave}|${o.bytes}|${o.sha256}\n`).join('')).digest('hex').slice(0, 16);
  const version = { version: huellaDe(objetos), build: huellaDe(objetos.filter(o => /^mkw\/build\/mkw\.(js|wasm)/.test(o.llave))) };
  const extras = [
    { llave: 'mkw/manifiesto.json', datos: Buffer.from(JSON.stringify(manifiesto)) },
    { llave: 'mkw/version.json', datos: Buffer.from(JSON.stringify(version)) },
  ].map(o => ({ ...o, bytes: o.datos.length, sha256: sha256(o.datos) }));
  return { objetos, extras, version, manifiesto, avisos };
}

// ---------- R2 (S3) ----------
function cliente({ cuenta, id, secreto, bucket, endpoint }) {
  const base = new URL(endpoint || `https://${cuenta}.r2.cloudflarestorage.com`);
  const pedir = async (metodo, llave, { cuerpo = null, hash = sha256(''), cabeceras = {}, consulta = '' } = {}) => {
    const ruta = `/${bucket}/${llave}`;
    const f = firmar({ metodo, host: base.host, ruta, consulta, cabeceras, hashCuerpo: hash, id, secreto, fecha: new Date() });
    const { firma, host, ...h } = f;
    const url = `${base.origin}${ruta.split('/').map(codifica).join('/')}${consulta ? '?' + consulta : ''}`;
    return fetch(url, { method: metodo, headers: h, body: cuerpo });
  };
  return {
    async cabeza(llave) {
      const r = await pedir('HEAD', llave);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HEAD ${llave}: ${r.status}`);
      return { bytes: Number(r.headers.get('content-length')), sha256: r.headers.get('x-amz-meta-sha256') || '' };
    },
    async poner(llave, datos, hash, tipo) {
      const r = await pedir('PUT', llave, { cuerpo: datos, hash, cabeceras: { 'content-type': tipo, 'x-amz-meta-sha256': hash } });
      if (!r.ok) throw new Error(`PUT ${llave}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    },
    async listar(prefijo) {                                           // ListObjectsV2, de a 1000
      const llaves = [];
      let sigue = '';
      for (;;) {
        const q = [`list-type=2`, `prefix=${codifica(prefijo)}`, ...(sigue ? [`continuation-token=${codifica(sigue)}`] : [])].sort().join('&');
        const r = await pedir('GET', '', { consulta: q });
        if (!r.ok) throw new Error(`listar: ${r.status}`);
        const x = await r.text();
        for (const m of x.matchAll(/<Key>([^<]*)<\/Key>/g)) llaves.push(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
        const t = /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(x);
        if (!/<IsTruncated>true<\/IsTruncated>/.test(x) || !t) break;
        sigue = t[1];
      }
      return llaves;
    },
  };
}
// de a N a la vez, con reintentos (una red de casa a veces corta)
async function enParalelo(cosas, n, hacer) {
  let i = 0;
  const trabajador = async () => { while (i < cosas.length) { const c = cosas[i++]; for (let intento = 0; ; intento++) {
    try { await hacer(c); break; } catch (e) { if (intento >= 4) throw e; await new Promise(r => setTimeout(r, 1000 * 2 ** intento)); } } } };
  await Promise.all(Array.from({ length: Math.min(n, cosas.length) }, trabajador));
}

// ---------- el programa ----------
export async function principal(argv = process.argv.slice(2), entorno = process.env, escribe = console.log) {
  const opcion = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  // --carpetas DIR: otra raíz con disco/, RetroRewind6/, riivolution/, assets/, build/ (las pruebas usan una inventada)
  const otra = opcion('--carpetas');
  const carpetas = otra
    ? [['/mkw/disco/', path.join(otra, 'disco')], ['/mkw/sd/RetroRewind6/', path.join(otra, 'RetroRewind6')], ['/mkw/sd/riivolution/', path.join(otra, 'riivolution')], ['/wc/runtime/assets/', path.join(otra, 'assets')]]
    : [['/mkw/disco/', path.join(raiz, 'extraido/disco')], ['/mkw/sd/RetroRewind6/', path.join(raiz, 'terceros/RetroRewind/RetroRewind6')],
       ['/mkw/sd/riivolution/', path.join(raiz, 'terceros/RetroRewind/riivolution')], ['/wc/runtime/assets/', path.join(raiz, 'terceros/Wiicompiled/runtime/assets')]];
  const build = otra ? path.join(otra, 'build') : path.join(raiz, entorno.MKW_BUILD || 'build/web/navegador');
  const salida = opcion('--salida', path.join(raiz, 'build/web/publicar'));
  const huellas = cacheHuellas(path.join(salida, 'huellas.json'));
  escribe('armando la lista (la primera vez calcula la huella de ~5 GB: unos minutos)…');
  const { objetos, extras, version, avisos } = await armarLista({ carpetas, build, conWasm: argv.includes('--con-wasm'), huellas });
  huellas.guardar();
  const todos = [...objetos, ...extras];
  const total = todos.reduce((a, o) => a + o.bytes, 0);
  fs.mkdirSync(salida, { recursive: true });
  fs.writeFileSync(path.join(salida, 'lista.tsv'), 'llave\tbytes\tsha256\n' + todos.map(o => `${o.llave}\t${o.bytes}\t${o.sha256}`).join('\n') + '\n');
  fs.writeFileSync(path.join(salida, 'version.json'), JSON.stringify(version, null, 1));
  escribe(`${todos.length} archivos, ${(total / 1e9).toFixed(2)} GB → ${path.relative(raiz, path.join(salida, 'lista.tsv'))}`);
  escribe(`versión ${version.version}, programa ${version.build}`);
  for (const a of avisos) escribe('  aviso: ' + a);
  const grandes = [...objetos].sort((a, b) => b.bytes - a.bytes).slice(0, 5);
  escribe('  los más grandes: ' + grandes.map(o => `${o.llave.split('/').pop()} ${(o.bytes / 1e6).toFixed(0)} MB`).join(', '));
  if (objetos.some(o => o.bytes > 5e9)) throw new Error('hay un archivo de más de 5 GB (el tope de un PUT de R2)');

  const accion = argv.includes('--subir') ? 'subir' : argv.includes('--comprobar') ? 'comprobar' : argv.includes('--sobrantes') ? 'sobrantes' : null;
  if (!accion) { escribe('(solo revisar: nada salió de este PC. Para subir: --subir, con R2_CUENTA, R2_ID, R2_SECRETO y R2_BUCKET)'); return { todos, version }; }
  const faltan = ['R2_ID', 'R2_SECRETO', 'R2_BUCKET', ...(entorno.R2_ENDPOINT ? [] : ['R2_CUENTA'])].filter(k => !entorno[k]);
  if (faltan.length) throw new Error('faltan las variables ' + faltan.join(', ') + ' (ver la cabecera de este archivo)');
  const r2 = cliente({ cuenta: entorno.R2_CUENTA, id: entorno.R2_ID, secreto: entorno.R2_SECRETO, bucket: entorno.R2_BUCKET, endpoint: entorno.R2_ENDPOINT });
  const datosDe = o => o.datos || fsp.readFile(o.archivo);
  const tipoDe = o => TIPOS[path.extname(o.llave.replace(/\.br$/, '')).toLowerCase()] || 'application/octet-stream';

  if (accion === 'subir') {
    let subidos = 0, iguales = 0, bytes = 0;
    const t0 = Date.now();
    const sube = async o => {
      const h = await r2.cabeza(o.llave);
      if (h && h.bytes === o.bytes && h.sha256 === o.sha256) { iguales++; return; }
      await r2.poner(o.llave, await datosDe(o), o.sha256, tipoDe(o));
      subidos++; bytes += o.bytes;
      if (subidos % 50 === 0) escribe(`  ${subidos} subidos (${(bytes / 1e9).toFixed(2)} GB, ${(bytes / 1e6 / ((Date.now() - t0) / 1000)).toFixed(1)} MB/s), ${iguales} ya estaban`);
    };
    // primero todos los archivos; el manifiesto y, al final, la versión (cuando ya está todo arriba)
    await enParalelo(objetos, 6, sube);
    await sube(extras[0]);
    await sube(extras[1]);
    escribe(`listo: ${subidos} subidos (${(bytes / 1e9).toFixed(2)} GB), ${iguales} ya estaban iguales. Ahora: --comprobar`);
    return { subidos, iguales };
  }
  if (accion === 'comprobar') {
    const mal = [];
    let vistos = 0;
    await enParalelo(todos, 12, async o => {
      const h = await r2.cabeza(o.llave);
      if (!h) mal.push(`falta ${o.llave}`);
      else if (h.bytes !== o.bytes || h.sha256 !== o.sha256) mal.push(`distinto ${o.llave} (${h.bytes} bytes, huella ${h.sha256.slice(0, 12) || 'sin huella'})`);
      if (++vistos % 1000 === 0) escribe(`  revisados ${vistos} de ${todos.length}`);
    });
    for (const m of mal.slice(0, 30)) escribe('  ✗ ' + m);
    escribe(mal.length ? `✗ ${mal.length} de ${todos.length} no están bien: --subir de nuevo` : `✓ los ${todos.length} archivos están en R2 con su tamaño y su huella`);
    return { mal };
  }
  if (accion === 'sobrantes') {
    const enR2 = await r2.listar('mkw/'), nuestros = new Set(todos.map(o => o.llave));
    const sobran = enR2.filter(k => !nuestros.has(k));
    for (const k of sobran.slice(0, 50)) escribe('  sobra ' + k);
    escribe(`${sobran.length} archivos en R2 bajo mkw/ que ya no están en la lista (no se borró nada; se pueden borrar a mano en Cloudflare)`);
    return { sobran };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
}
