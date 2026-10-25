// Prueba de subir-r2.mjs con un R2 FALSO en esta PC y archivos INVENTADOS (nada del juego) — bitácora §65.
//
// Resumen: arma una carpeta con la forma de lo que se sube (disco/, RetroRewind6/, riivolution/, assets/ y build/ con
// un "programa" de mentira), levanta un servidor que habla como la API S3 de R2 (HEAD, PUT, listar) y que, como R2,
// revisa la firma de cada pedido y el SHA-256 de cada archivo; y corre el script de verdad contra él. Comprueba:
//   - la firma: igual al ejemplo publicado por AWS (con eso, la cuenta está bien hecha) y un secreto equivocado → 403;
//   - la lista: llaves con "mkw/" delante, el manifiesto con la forma de servidor.mjs (carpetas vacías con -1);
//   - subir: todo llega con sus bytes exactos, la versión va ÚLTIMA; repetir no sube nada; un archivo cambiado sube solo;
//   - comprobar y sobrantes: encuentran lo que falta, lo distinto y lo que sobra (sin borrar nada);
//   - un programa a medio comprimir (el .br más viejo que el .wasm) frena antes de subir.
// Uso:  node herramientas/prueba-subir-r2.mjs
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { firmar, principal } from './subir-r2.mjs';

let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const sha = d => crypto.createHash('sha256').update(d).digest('hex');
const ID = 'IDDEPRUEBA', SECRETO = 'secreto-de-prueba-que-no-sirve-para-nada', BUCKET = 'disco';

// 1) la firma contra el ejemplo de AWS ("GET Object", documentación de Signature Version 4 para S3)
{
  const f = firmar({ metodo: 'GET', host: 'examplebucket.s3.amazonaws.com', ruta: '/test.txt', cabeceras: { range: 'bytes=0-9' },
    hashCuerpo: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', id: 'AKIAIOSFODNN7EXAMPLE',
    secreto: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1', fecha: new Date('2013-05-24T00:00:00Z') });
  ok('la firma da lo mismo que el ejemplo publicado por AWS', f.firma === 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41', f.firma.slice(0, 16) + '…');
}

// 2) los archivos inventados
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mkw-subir-'));
const escribe = (rel, datos, fecha) => { const p = path.join(tmp, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, datos); if (fecha) fs.utimesSync(p, fecha, fecha); };
const bytes = (n, s = 1) => Buffer.from(Array.from({ length: n }, (_, i) => (i * 31 + s) & 255));
escribe('disco/files/Race/Course/pista_a.szs', bytes(5000, 1));
escribe('disco/files/Mi Pista (v2) & más.szs', bytes(70, 2));
escribe('disco/sys/main.dol', bytes(300, 3));
fs.mkdirSync(path.join(tmp, 'disco/files/vacia'), { recursive: true });
escribe('RetroRewind6/Code/Code.pul', bytes(800, 4));
escribe('riivolution/RetroRewind6.xml', '<xml/>');
escribe('assets/fuente.bin', bytes(20, 5));
const antes = new Date(Date.now() - 60000), ahora = new Date();
escribe('build/mkw.js', 'export default 1;', antes);
escribe('build/mkw.wasm', bytes(4000, 6), antes);
escribe('build/mkw.wasm.br', bytes(900, 7), ahora);
escribe('build/pipelines.bin', bytes(64, 8));
escribe('build/bloques.json', '{"corridas":3,"bloques":[]}');
escribe('build/imagenes/pistas/a.webp', bytes(33, 9));

// 3) el R2 falso: revisa la firma (con el secreto que conoce) y el SHA-256 del cuerpo, guarda en memoria
const guardado = new Map(), orden = [];
let pedidos = 0;
const servidor = http.createServer(async (q, r) => {
  pedidos++;
  const cuerpo = await new Promise(ok => { const t = []; q.on('data', d => t.push(d)); q.on('end', () => ok(Buffer.concat(t))); });
  const url = new URL(q.url, 'http://x'), auth = q.headers.authorization || '';
  const m = /Credential=([^/]+)\/(\d{8})\/([^/]+)\/s3\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]{64})/.exec(auth);
  if (!m || m[1] !== ID) { r.writeHead(403); return r.end('<Error><Code>InvalidAccessKeyId</Code></Error>'); }
  const firmadas = m[4].split(';');
  const cab = Object.fromEntries(firmadas.filter(k => !['host', 'x-amz-date', 'x-amz-content-sha256'].includes(k)).map(k => [k, q.headers[k]]));
  const fecha = new Date(q.headers['x-amz-date'].replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'));
  const ruta = decodeURIComponent(url.pathname);
  const consulta = [...url.searchParams].map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())])
    .sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('&');
  const esperada = firmar({ metodo: q.method, host: q.headers.host, ruta, consulta, cabeceras: cab, hashCuerpo: q.headers['x-amz-content-sha256'],
    id: ID, secreto: SECRETO, region: m[3], fecha }).firma;
  if (esperada !== m[5]) { r.writeHead(403); return r.end('<Error><Code>SignatureDoesNotMatch</Code></Error>'); }
  const llave = ruta.replace(`/${BUCKET}/`, '');
  if (q.method === 'PUT') {
    if (sha(cuerpo) !== q.headers['x-amz-content-sha256']) { r.writeHead(400); return r.end('<Error><Code>XAmzContentSHA256Mismatch</Code></Error>'); }
    guardado.set(llave, { datos: cuerpo, meta: q.headers['x-amz-meta-sha256'] || '', tipo: q.headers['content-type'] }); orden.push(llave);
    r.writeHead(200); return r.end();
  }
  if (q.method === 'HEAD') {
    const o = guardado.get(llave);
    if (!o) { r.writeHead(404); return r.end(); }
    // como Cloudflare: si el cliente acepta comprimido y el archivo es de texto (js, json, svg, wasm…), lo comprime y la
    // respuesta va sin Content-Length (el script leía «0 bytes» y daba por mal subidos 325 archivos que estaban bien)
    const comprime = /gzip|br|deflate/.test(q.headers['accept-encoding'] || '') && /text|json|javascript|svg|wasm/.test(o.tipo || '');
    r.writeHead(200, { ...(comprime ? { 'content-encoding': 'gzip' } : { 'content-length': o.datos.length }), 'x-amz-meta-sha256': o.meta }); return r.end();
  }
  if (q.method === 'GET' && url.searchParams.get('list-type') === '2') {          // de a 3, para probar la continuación
    const todas = [...guardado.keys()].filter(k => k.startsWith(url.searchParams.get('prefix') || '')).sort();
    const desde = Number(url.searchParams.get('continuation-token') || 0), trozo = todas.slice(desde, desde + 3);
    const mas = desde + 3 < todas.length;
    r.writeHead(200, { 'content-type': 'application/xml' });
    return r.end(`<ListBucketResult>${trozo.map(k => `<Contents><Key>${k.replace(/&/g, '&amp;')}</Key></Contents>`).join('')}<IsTruncated>${mas}</IsTruncated>${mas ? `<NextContinuationToken>${desde + 3}</NextContinuationToken>` : ''}</ListBucketResult>`);
  }
  r.writeHead(400); r.end();
});
await new Promise(ok => servidor.listen(0, '127.0.0.1', ok));
const ENDPOINT = `http://127.0.0.1:${servidor.address().port}`;
const entorno = { R2_ENDPOINT: ENDPOINT, R2_ID: ID, R2_SECRETO: SECRETO, R2_BUCKET: BUCKET };
const salida = path.join(tmp, 'salida');
const callado = () => {};
const corre = (extra, env = entorno) => principal(['--carpetas', tmp, '--salida', salida, ...extra], env, callado);

try {
  // 4) revisar (sin red)
  const { todos, version } = await corre([]);
  const llaves = todos.map(o => o.llave);
  ok('revisar no sale a la red', pedidos === 0, `${pedidos} pedidos`);
  ok('las llaves llevan mkw/ delante, con las rutas que pide la página',
     llaves.includes('mkw/mkw/disco/files/Race/Course/pista_a.szs') && llaves.includes('mkw/mkw/sd/RetroRewind6/Code/Code.pul') &&
     llaves.includes('mkw/mkw/sd/riivolution/RetroRewind6.xml') && llaves.includes('mkw/wc/runtime/assets/fuente.bin'));
  ok('el programa: mkw.js y mkw.wasm.br, sin el .wasm sin comprimir', llaves.includes('mkw/build/mkw.js') && llaves.includes('mkw/build/mkw.wasm.br') && !llaves.includes('mkw/build/mkw.wasm'));
  ok('las semillas y las imágenes también', llaves.includes('mkw/build/pipelines.bin') && llaves.includes('mkw/build/bloques.json') && llaves.includes('mkw/build/imagenes/pistas/a.webp'));
  // §93 (E2): el paquete de los diminutos: los archivos de ≤ 8 KB, con su ruta de juego y sus bytes; los grandes no
  {
    const p = todos.find(o => o.llave === 'mkw/build/diminutos.bin'), b = p?.datos;
    const indice = b && b.subarray(0, 4).toString('latin1') === 'MKWD' ? JSON.parse(b.subarray(12, 12 + b.readUInt32LE(8))).archivos : [];
    let o = 12 + (b ? b.readUInt32LE(8) : 0); const de = {};
    for (const [r, t] of indice) { de[r] = b.subarray(o, o + t); o += t; }
    ok('§93: el paquete de los diminutos lleva los de ≤ 8 KB (con su ruta de juego y sus bytes) y no los grandes',
       !!b && o === b.length && sha(de['/mkw/disco/files/Race/Course/pista_a.szs'] || Buffer.alloc(0)) === sha(fs.readFileSync(path.join(tmp, 'disco/files/Race/Course/pista_a.szs'))) &&
       indice.every(([, t]) => t > 0 && t <= 8192) && !indice.some(([r]) => r.endsWith('main.dol') && fs.statSync(path.join(tmp, 'disco/sys/main.dol')).size > 8192),
       `${indice.length} archivos, ${b?.length} bytes`);
  }
  ok('el manifiesto y la versión, AL FINAL de la lista', llaves.at(-2) === 'mkw/manifiesto.json' && llaves.at(-1) === 'mkw/version.json');
  const man = JSON.parse(todos.find(o => o.llave === 'mkw/manifiesto.json').datos);
  ok('el manifiesto tiene la forma de servidor.mjs (carpetas vacías con -1)',
     JSON.stringify(Object.keys(man)) === JSON.stringify(['/mkw/disco/', '/mkw/sd/RetroRewind6/', '/mkw/sd/riivolution/', '/wc/runtime/assets/']) &&
     man['/mkw/disco/'].some(([r, t]) => r === 'files/vacia' && t === -1) && man['/mkw/disco/'].some(([r, t]) => r === 'files/Race/Course/pista_a.szs' && t === 5000));
  const tsv = fs.readFileSync(path.join(salida, 'lista.tsv'), 'utf8').trim().split('\n');
  ok('lista.tsv: una línea por archivo con bytes y SHA-256', tsv.length === todos.length + 1 && tsv[1].split('\t')[2].length === 64, `${tsv.length - 1} líneas`);
  ok('huella del archivo = SHA-256 de su contenido', todos.find(o => o.llave === 'mkw/mkw/disco/sys/main.dol').sha256 === sha(bytes(300, 3)));

  // 5) subir
  await corre(['--subir']);
  const exactos = todos.every(o => guardado.has(o.llave) && sha(guardado.get(o.llave).datos) === o.sha256 && guardado.get(o.llave).meta === o.sha256);
  ok('todo llegó con sus bytes exactos y su huella', exactos, `${guardado.size} de ${todos.length}`);
  ok('nombres con espacios, paréntesis y & llegan bien', guardado.has('mkw/mkw/disco/files/Mi Pista (v2) & más.szs'));
  ok('la versión se sube ÚLTIMA (los jugadores siguen con la anterior hasta que está todo)', orden.at(-1) === 'mkw/version.json' && orden.at(-2) === 'mkw/manifiesto.json');
  ok('cada archivo con su tipo (el .wasm.br como wasm)', guardado.get('mkw/build/mkw.wasm.br').tipo === 'application/wasm' && guardado.get('mkw/build/mkw.js').tipo.startsWith('text/javascript'));
  ok('version.json tiene las dos huellas', JSON.parse(guardado.get('mkw/version.json').datos).build === version.build);
  orden.length = 0;
  await corre(['--subir']);
  ok('subir otra vez no sube nada (todo igual)', orden.length === 0, `${orden.length} subidos`);
  escribe('disco/files/Race/Course/pista_a.szs', bytes(5000, 99));
  await corre(['--subir']);
  // (§93: pista_a es diminuta, ≤ 8 KB: cambia también el paquete de los diminutos)
  ok('un archivo cambiado: sube él (y el paquete de los diminutos, que lo lleva), y la versión nueva al final',
     orden.includes('mkw/mkw/disco/files/Race/Course/pista_a.szs') && orden.includes('mkw/build/diminutos.bin') && orden.at(-1) === 'mkw/version.json' && orden.length === 3, orden.join(', '));

  // 6) comprobar y sobrantes
  let r = await corre(['--comprobar']);
  ok('comprobar: todo bien', r.mal.length === 0);
  guardado.get('mkw/mkw/disco/sys/main.dol').datos = bytes(10);
  guardado.get('mkw/mkw/disco/sys/main.dol').meta = sha(bytes(10));
  guardado.delete('mkw/build/pipelines.bin');
  r = await corre(['--comprobar']);
  ok('comprobar encuentra lo distinto y lo que falta', r.mal.length === 2 && r.mal.some(x => x.startsWith('distinto mkw/mkw/disco/sys/main.dol')) && r.mal.some(x => x === 'falta mkw/build/pipelines.bin'), r.mal.join(' | '));
  guardado.set('mkw/build/viejo.wasm.br', { datos: bytes(5), meta: '' }); guardado.set('otro/de-bt3.bin', { datos: bytes(5), meta: '' });
  r = await corre(['--sobrantes']);
  ok('sobrantes: solo lo de mkw/ que ya no está (y no borra nada)', r.sobran.length === 1 && r.sobran[0] === 'mkw/build/viejo.wasm.br' && guardado.has('mkw/build/viejo.wasm.br'), r.sobran.join(', '));

  // 7) lo que debe frenar
  let error = '';
  try { await corre(['--subir'], { ...entorno, R2_SECRETO: 'otro' }); } catch (e) { error = e.message; }
  ok('con un secreto equivocado R2 dice 403 y el script lo cuenta', /403/.test(error), error.slice(0, 80));
  error = '';
  try { await corre(['--subir'], { R2_ENDPOINT: ENDPOINT, R2_ID: ID }); } catch (e) { error = e.message; }
  ok('sin las llaves no intenta nada y dice cuáles faltan', /R2_SECRETO/.test(error) && /R2_BUCKET/.test(error), error);
  fs.utimesSync(path.join(tmp, 'build/mkw.wasm.br'), antes, new Date(antes.getTime() - 5000));
  fs.utimesSync(path.join(tmp, 'build/mkw.wasm'), ahora, ahora);
  error = '';
  try { await corre([]); } catch (e) { error = e.message; }
  ok('el .br más viejo que el .wasm frena (no se sube un programa a medias)', /mkw\.wasm\.br/.test(error), error);
} catch (e) {
  ok('la prueba terminó sin errores', false, e.stack);
} finally {
  servidor.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
