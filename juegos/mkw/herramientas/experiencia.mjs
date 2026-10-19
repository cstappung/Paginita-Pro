// La página de Juegos de verdad, en esta PC, como la verá un amigo — el jugar.bat del proyecto (bitácora §69).
//
// Resumen: para probar la experiencia entera de punta a punta (entrar a Juegos, iniciar sesión, «Mario Kart Wii · un
// jugador» con el menú de inicio JloKart, sus modos, Multiplayer en este PC, Options, las partidas en la nube, Mi Mii,
// la sala en línea con amigos y CPU en 2 o 3 ventanas, el VR y los récords) sin publicar nada ni tocar el Firebase real:
//   1. Firebase de mentira: los EMULADORES oficiales de Firebase (cuentas, base de datos y Storage) en 127.0.0.1, con las
//      reglas del sitio tal cual (database.rules.json y storage.rules, copiadas a build/emuladores al arrancar). Lo que
//      se juega queda guardado en build/emuladores/datos para la próxima vez (al cerrar con Ctrl+C).
//   2. Cuentas de mentira (cuentas «de Google» del emulador): Piloto Uno, Dos y Tres (en la lista de amigos) e Intruso
//      (no está: para ver que a él Mario Kart no le aparece). Al apretar «Iniciar sesión», la ventanita del emulador las
//      muestra para elegir una.
//   3. El sitio servido como GitHub Pages (sitio-local.mjs) con el Worker DE VERDAD (worker-local.mjs, que acepta los
//      tokens del emulador), el catálogo de Juegos mostrando SOLO Mario Kart (su sala y su «un jugador»).
//   4. Chrome: una ventana por jugador, cada una con su propio perfil (build/perfiles/jugadorN): cada ventana es "otro
//      PC" con su propia sesión, como se probó BT3 en el mismo PC. Lado a lado.
// Todo en 127.0.0.1: nada sale de esta PC (la primera vez, firebase-tools baja sus emuladores de Google).
//
// Uso:  node herramientas/experiencia.mjs [--ventanas 1|2|3] [--sin-ventanas] [--puerto 8150] [--limpiar] [--carpeta build/emuladores]
//       --limpiar: borra lo guardado en los emuladores (cuentas, salas, partidas en la nube) y empieza de cero.
//       Requiere: Java (los emuladores de base y Storage) y firebase-tools en herramientas/cache/firebase-tools
//       (npm install --prefix herramientas/cache/firebase-tools firebase-tools@14.27.0).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const VENTANAS = Math.min(3, Math.max(1, Number(opcion('--ventanas', 1)) || 1));
const PUERTO = Number(opcion('--puerto', 8150));
const SITIO = `http://127.0.0.1:${PUERTO}`;
const PROYECTO = 'mi-pagina-pro';                                  // el del sitio (sus tokens dicen este proyecto)
const EMU = path.join(raiz, opcion('--carpeta', 'build/emuladores'));   // las pruebas usan otra: nunca tocan lo jugado
const DATOS = path.join(EMU, 'datos');
const FIREBASE = path.join(raiz, 'herramientas/cache/firebase-tools/node_modules/firebase-tools/lib/bin/firebase.js');
// las cuentas de mentira (correos de un dominio .test, que no existe): las 3 primeras en la lista de amigos del Worker
const CUENTAS = [
  { sub: 'piloto1', email: 'piloto1@paginita.test', name: 'Piloto Uno', amigo: true },
  { sub: 'piloto2', email: 'piloto2@paginita.test', name: 'Piloto Dos', amigo: true },
  { sub: 'piloto3', email: 'piloto3@paginita.test', name: 'Piloto Tres', amigo: true },
  { sub: 'intruso', email: 'intruso@paginita.test', name: 'Intruso (no es amigo)', amigo: false },
];
const PUERTOS_EMU = { auth: 9099, database: 9000, storage: 9199, hub: 4400, logging: 4500 };
const hijos = [];
const di = (...t) => console.log('[jugar]', ...t);

// ¿Está libre un puerto? (si otro programa lo usa, mejor decirlo claro que fallar a medias)
const libre = puerto => new Promise(r => { const s = net.createServer().once('error', () => r(false)).once('listening', () => s.close(() => r(true))).listen(puerto, '127.0.0.1'); });
// Espera una línea en la salida de un proceso
const esperarLinea = (hijo, patron, ms, que) => new Promise((ok, mal) => {
  const reloj = setTimeout(() => mal(new Error(`${que}: no arrancó en ${ms / 1000} s`)), ms);
  const mira = d => { if (patron.test(String(d))) { clearTimeout(reloj); ok(); } };
  hijo.stdout.on('data', mira); hijo.stderr?.on('data', mira);
  hijo.once('exit', c => { clearTimeout(reloj); mal(new Error(`${que} se cerró (código ${c})`)); });
});
// En Windows, kill() corta el proceso sin cerrar a sus hijos: el árbol entero
const matar = h => { if (!h || h.exitCode !== null) return; if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(h.pid), '/T', '/F']); else h.kill(); };

// 1) Los emuladores, con las reglas del sitio copiadas al lado (firebase-tools no acepta reglas fuera de su carpeta)
async function emuladores() {
  if (!fs.existsSync(FIREBASE)) throw new Error('falta firebase-tools: npm install --prefix herramientas/cache/firebase-tools firebase-tools@14.27.0');
  if (spawnSync('java', ['-version']).status !== 0) throw new Error('falta Java (los emuladores de la base y de Storage lo necesitan)');
  for (const [que, p] of Object.entries(PUERTOS_EMU)) if (!(await libre(p))) throw new Error(`el puerto ${p} (${que} de Firebase) está ocupado: ¿quedó abierto otro jugar.bat?`);
  if (args.includes('--limpiar')) fs.rmSync(DATOS, { recursive: true, force: true });
  fs.mkdirSync(EMU, { recursive: true });
  const reglas = path.join(raiz, 'terceros/Paginita-Pro/firebase');
  fs.copyFileSync(path.join(reglas, 'database.rules.json'), path.join(EMU, 'database.rules.json'));
  fs.copyFileSync(path.join(reglas, 'storage.rules'), path.join(EMU, 'storage.rules'));
  const emu = Object.fromEntries(Object.entries(PUERTOS_EMU).map(([k, port]) => [k, { host: '127.0.0.1', port }]));
  fs.writeFileSync(path.join(EMU, 'firebase.json'), JSON.stringify({
    database: { rules: 'database.rules.json' }, storage: { rules: 'storage.rules' },
    emulators: { ...emu, ui: { enabled: false }, singleProjectMode: true },
  }, null, 2));
  const h = spawn(process.execPath, [FIREBASE, 'emulators:start', '--project', PROYECTO, '--only', 'auth,database,storage',
    ...(fs.existsSync(path.join(DATOS, 'firebase-export-metadata.json')) ? ['--import', DATOS] : []), '--export-on-exit', DATOS],
  { cwd: EMU, stdio: ['ignore', 'pipe', 'pipe'] });
  hijos.push(h);
  const registro = fs.createWriteStream(path.join(EMU, 'emuladores.log'));
  h.stdout.pipe(registro); h.stderr.pipe(registro);
  di('arrancando los emuladores de Firebase (cuentas, base y Storage)… (la primera vez baja sus programas)');
  await esperarLinea(h, /All emulators ready/, 180000, 'los emuladores de Firebase');
  return h;
}

// 2) Las cuentas de mentira: «inicio con Google» del emulador con un token sin firma (el emulador lo acepta);
//    si ya existen, solo entra (no se repiten)
async function cuentas() {
  for (const c of CUENTAS) {
    const r = await fetch(`http://127.0.0.1:${PUERTOS_EMU.auth}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=emulador`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestUri: 'http://localhost', returnSecureToken: true,
        postBody: 'id_token=' + encodeURIComponent(JSON.stringify({ sub: c.sub, email: c.email, email_verified: true, name: c.name })) + '&providerId=google.com' }) });
    if (!r.ok) throw new Error(`no pude crear la cuenta ${c.name}: ${r.status} ${await r.text()}`);
  }
}

// 3) El sitio (como GitHub Pages) y el Worker de verdad
async function sitio() {
  for (const p of [PUERTO, PUERTO + 1]) if (!(await libre(p))) throw new Error(`el puerto ${p} está ocupado: ¿quedó abierto otro jugar.bat o sitio-local?`);
  const amigos = CUENTAS.filter(c => c.amigo).map(c => c.email).join(',');
  const h = spawn(process.execPath, [path.join(raiz, 'herramientas/sitio-local.mjs'), '--puerto', String(PUERTO), '--emuladores', '--solo', 'mkw', '--amigos', amigos],
    { stdio: ['ignore', 'pipe', 'inherit'] });
  hijos.push(h);
  await esperarLinea(h, /la página sola/, 60000, 'el sitio local');
  return h;
}

// 4) Chrome: una ventana por jugador, cada una con su perfil, lado a lado
function chrome() {
  const candidatos = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]
    .filter(Boolean).map(b => path.join(b, 'Google/Chrome/Application/chrome.exe'));
  const exe = candidatos.find(f => fs.existsSync(f));
  if (!exe) { di(`no encontré Chrome: ábrelo tú en ${SITIO}/juegos.html`); return; }
  let ancho = 1920, alto = 1040;
  const ps = spawnSync('powershell', ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.Windows.Forms; $a=[System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea; "$($a.Width) $($a.Height)"'], { encoding: 'utf8' });
  const m = /(\d+) (\d+)/.exec(ps.stdout || ''); if (m) { ancho = Number(m[1]); alto = Number(m[2]); }
  const w = Math.floor(ancho / VENTANAS);
  for (let i = 0; i < VENTANAS; i++) {
    const perfil = path.join(raiz, `build/perfiles/jugador${i + 1}`);
    fs.mkdirSync(perfil, { recursive: true });
    spawn(exe, [`--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check', '--new-window',
      `--window-position=${i * w},0`, `--window-size=${w},${alto}`, `${SITIO}/juegos.html`], { detached: true, stdio: 'ignore' }).unref();
  }
}

async function cerrar(codigo = 0) {
  const emu = hijos[0];
  for (const h of hijos.slice(1)) matar(h);
  // los emuladores guardan lo jugado al recibir Ctrl+C (export-on-exit); se les da tiempo
  if (emu && emu.exitCode === null) {
    di('guardando lo jugado (cuentas, salas, partidas en la nube)…');
    if (process.platform !== 'win32') emu.kill('SIGINT');
    await new Promise(r => { const t = setTimeout(() => { matar(emu); r(); }, 30000); emu.once('exit', () => { clearTimeout(t); r(); }); });
  }
  process.exit(codigo);
}
process.on('SIGINT', () => cerrar(0));
process.on('SIGTERM', () => cerrar(0));

try {
  await emuladores();
  await cuentas();
  await sitio();
  if (!args.includes('--sin-ventanas')) chrome();
  console.log(`
  ✔ Listo: ${SITIO}/juegos.html  (${VENTANAS} ventana${VENTANAS > 1 ? 's' : ''} de Chrome, cada una es "otro PC")

  Cómo probar:
   1. «Iniciar sesión» → en la ventanita del emulador elige una cuenta: Piloto Uno, Dos o Tres (amigos) — una distinta
      en cada ventana. Intruso no es amigo: a él Mario Kart no le aparece.
   2. «Mario Kart Wii · un jugador» → el menú de inicio JloKart: Single Player (Grand Prix, Contrarreloj, VS, Batalla),
      Multiplayer → Local (2 a 4 mandos en este PC) u Online (las salas), Options (controles, partida, Mi Mii).
   3. Sala en línea: en una ventana abre una sala de Mario Kart Wii (con CPU = copa sincronizada hasta 4; sin CPU = VS en
      línea, el que mueve el VR); en las otras, entra a esa sala; el anfitrión aprieta «¡A correr!».
   Las partidas, salas, VR y récords quedan en Firebase de mentira (build/emuladores/datos), nunca en el real.
   Para apagar: Ctrl+C en esta ventana (guarda lo jugado). Empezar de cero: jugar.bat limpiar.
`);
} catch (e) {
  console.error('\n[jugar] ✗ ' + (e && e.message || e));
  await cerrar(1);
}
