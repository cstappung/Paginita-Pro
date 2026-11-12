// telefono-seguro.mjs — medir el juego en un teléfono Android de verdad por el cable USB SIN dejarle nada
// (pedido del dueño, 2026-11-07: «no dejar ninguna traza de la prueba ni nada raro en mi teléfono ni tocar nada vital»).
//
// Resumen: el PC maneja el Chrome del teléfono por la depuración USB (adb + DevTools) con cinco protecciones:
//   1. LISTA BLANCA de órdenes adb: solo las de abajo, palabra por palabra. Nada de install, push, rm, reboot,
//      «settings put» ni ninguna otra; cualquier otra orden se rechaza ANTES de llegar al teléfono.
//   2. PESTAÑA DE INCÓGNITO aparte (un «contexto de navegador» nuevo): lo que el juego guarda (caché, IndexedDB,
//      partida, historial) vive en la memoria de esa pestaña y se borra al cerrarla. Si el Chrome del teléfono no
//      deja abrir una, el programa se DETIENE (no usa tu Chrome normal).
//   3. LIMPIEZA GARANTIZADA: pase lo que pase (error, Ctrl+C, calor) se cierra la pestaña y se quitan los dos
//      túneles del cable (adb reverse/forward). Tu Chrome y tus pestañas no se cierran.
//   4. FOTO ANTES Y DESPUÉS: la lista de apps instaladas y los ajustes del sistema, leídos (solo leer) antes y
//      después; si algo cambió, lo dice con el detalle.
//   5. VIGÍA DEL CALOR: lee la temperatura de la batería cada 10 s y corta a los 42 °C.
//   6. LA PANTALLA PRENDIDA (el dueño, 2026-11-10: «te dejo dejar la pantalla siempre prendida»; solo eso): mientras
//      está conectado, «Pantalla siempre activa con el cable» (svc power stayon usb). ANTES se lee el valor original
//      (settings get global stay_on_while_plugged_in) y la limpieza garantizada lo devuelve exacto; se anota también en
//      build/web/datos/telefono/pantalla-original.json para que `limpiar` lo devuelva si una corrida se cortó a la fuerza.
//      Si el teléfono ya la tenía prendida con el cable, no se toca nada. --sin-pantalla = no tocarla.
// Cada orden que se le manda al teléfono queda anotada en build/web/datos/telefono/<fecha>/registro.txt.
//
// Uso:
//   node herramientas/telefono-seguro.mjs revisar                      (solo leer: qué teléfono, foto, temperatura)
//   node herramientas/telefono-seguro.mjs abrir [--ruta "/?modo=directa&…"] [--puerto 8140] [--segundos 90]
//        (antes, en otra consola: node web/navegador/servidor.mjs; el teléfono lo ve como su propio 127.0.0.1)
// adb: el de Google (platform-tools); se busca en TELEFONO_ADB, en el PATH o en %LOCALAPPDATA%\Android\Sdk.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUERTO_DEVTOOLS = 9333;          // el túnel del PC a las DevTools del Chrome del teléfono
const TEMP_MAXIMA = 42;                // °C de la batería: más que esto, se corta
const PROP_LEIDAS = ['ro.product.manufacturer', 'ro.product.model', 'ro.build.version.release'];
const AJUSTES = ['global', 'secure', 'system'];

// ---------- 1. la lista blanca ----------
// Cada regla es una lista de palabras; '<puerto>' = un número de puerto permitido.
const REGLAS = [
  ['reverse', 'tcp:<puerto>', 'tcp:<puerto>'],
  ['reverse', '--remove', 'tcp:<puerto>'],
  ['forward', `tcp:${PUERTO_DEVTOOLS}`, 'localabstract:chrome_devtools_remote'],
  ['forward', '--remove', `tcp:${PUERTO_DEVTOOLS}`],
  ['shell', 'pm', 'list', 'packages'],
  ...AJUSTES.map(a => ['shell', 'settings', 'list', a]),
  ...PROP_LEIDAS.map(p => ['shell', 'getprop', p]),
  ['shell', 'dumpsys', 'battery'],
  // 6. la pantalla prendida con el cable: leer el valor, prenderla, y las órdenes para devolver cada valor original
  ['shell', 'settings', 'get', 'global', 'stay_on_while_plugged_in'],
  ...['usb', 'ac', 'wireless', 'true', 'false'].map(v => ['shell', 'svc', 'power', 'stayon', v]),
  // (los valores que «svc» no sabe escribir —varias fuentes juntas, o con el dock (8)—: solo ESE ajuste y solo un número del 0 al 15)
  ['shell', 'settings', 'put', 'global', 'stay_on_while_plugged_in', '<0-15>'],
];

// stay_on_while_plugged_in es una suma de bits: 1 = con cargador, 2 = con el cable USB, 4 = inalámbrico, 8 = con el dock
// (0 = nunca; el Oppo del dueño trae 15, todos: ahí no hace falta tocar nada)
const CABLE_USB = 2;
/** La orden que deja el ajuste exactamente en `valor` (el leído antes de empezar). */
export function ordenDevolver(valor) {
  const v = Number(valor);
  if (!Number.isInteger(v) || v < 0 || v > 15) return null;
  const svc = { 0: 'false', 1: 'ac', 2: 'usb', 4: 'wireless', 7: 'true' }[v];
  return svc ? ['shell', 'svc', 'power', 'stayon', svc] : ['shell', 'settings', 'put', 'global', 'stay_on_while_plugged_in', String(v)];
}
/** Prende la pantalla con el cable si hacía falta. Devuelve el valor original o null si no se tocó. */
export async function prenderPantalla(adb) {
  const original = Number((await adb.correr(['shell', 'settings', 'get', 'global', 'stay_on_while_plugged_in'])).trim());
  if (!Number.isInteger(original) || original < 0 || original > 15) throw new Error(`stay_on_while_plugged_in vale «${original}»: no lo toco`);
  if (original & CABLE_USB) return null;            // ya queda prendida con el cable: nada que hacer
  await adb.correr(['shell', 'svc', 'power', 'stayon', 'usb']);
  return original;
}
export async function devolverPantalla(adb, original) {
  const orden = ordenDevolver(original);
  if (!orden) throw new Error(`no sé devolver stay_on_while_plugged_in a «${original}»`);
  await adb.correr(orden);
  const ahora = Number((await adb.correr(['shell', 'settings', 'get', 'global', 'stay_on_while_plugged_in'])).trim());
  if (ahora !== Number(original)) throw new Error(`la pantalla quedó en ${ahora} y antes era ${original}`);
}

/** ¿Está permitida esta orden (sin el «-s serie» del principio)? `puertos` = los del servidor del juego. */
export function permitida(args, puertos) {
  if (args.length === 2 && args[0] === 'devices' && args[1] === '-l') return true;
  return REGLAS.some(r => r.length === args.length && r.every((p, i) => {
    if (p === '<0-15>') return /^([0-9]|1[0-5])$/.test(args[i] ?? '');
    if (!p.includes('<puerto>')) return p === args[i];
    const m = /^tcp:(\d+)$/.exec(args[i]);
    return !!m && puertos.includes(Number(m[1])) && (r[1] !== 'tcp:<puerto>' || args[1] === args[2]);
  }));
}

/** El adb con su lista blanca y su registro. `ejecutable` = ruta de adb (o del adb de mentira de la prueba). */
export function crearAdb({ ejecutable, puertos, registro = () => {} }) {
  let serie = null;
  const correr = (args) => new Promise((ok, mal) => {
    const completos = serie && args[0] !== 'devices' ? ['-s', serie, ...args] : args;
    if (!permitida(args, puertos)) {
      registro(`RECHAZADA: adb ${completos.join(' ')}`);
      return mal(new Error(`orden no permitida por la lista blanca: adb ${args.join(' ')}`));
    }
    registro(`adb ${completos.join(' ')}`);
    // execFile pasa las palabras sueltas: en el PC no hay intérprete de comandos que pueda unir otra orden
    // ADB_LIBUSB=1: el Oppo se presenta con el driver WinUSB genérico de Windows (sin la marca de ADB de Google) y
    // solo el camino libusb de adb lo encuentra (2026-11-07, Find X9 Pro); no cambia nada en el teléfono
    execFile(ejecutable, completos, { timeout: 30000, windowsHide: true, env: { ...process.env, ADB_LIBUSB: '1' } }, (e, out, err) =>
      e ? mal(new Error(`adb ${args.join(' ')}: ${String(err || e.message).trim()}`)) : ok(String(out)));
  });
  return { correr, fijarSerie: s => { serie = s; } };
}

// ---------- lecturas (solo leer) ----------
export function unTelefono(salidaDevices) {
  const filas = salidaDevices.split(/\r?\n/).slice(1).map(l => l.trim()).filter(Boolean);
  const listos = filas.filter(l => /\sdevice(\s|$)/.test(l));
  if (filas.some(l => /\sunauthorized/.test(l))) throw new Error('el teléfono no autorizó este PC: acepta el aviso «¿Permitir depuración USB?» en la pantalla');
  if (listos.length === 0) throw new Error('no hay ningún teléfono conectado con la depuración USB prendida');
  if (listos.length > 1) throw new Error('hay más de un aparato conectado: deja solo uno');
  return listos[0].split(/\s+/)[0];
}

export function temperatura(salidaBateria) {
  const m = /temperature:\s*(\d+)/.exec(salidaBateria);
  return m ? Number(m[1]) / 10 : null;   // Android la da en décimas de grado
}

export async function foto(adb) {
  const paquetes = (await adb.correr(['shell', 'pm', 'list', 'packages'])).split(/\r?\n/).map(s => s.trim()).filter(Boolean).sort();
  const ajustes = {};
  for (const a of AJUSTES) ajustes[a] = (await adb.correr(['shell', 'settings', 'list', a])).split(/\r?\n/).map(s => s.trim()).filter(Boolean).sort();
  return { paquetes, ajustes };
}

/** Qué cambió entre dos fotos. Los ajustes que el teléfono cambia solo (la hora, la pantalla) se marcan aparte. */
export function comparar(antes, despues) {
  const dif = (a, b) => ({ nuevos: b.filter(x => !a.includes(x)), quitados: a.filter(x => !b.includes(x)) });
  // (también lo que mueve tu mano o el teléfono mientras juegas: girar la pantalla, el volumen, el modo oscuro con la
  // pantalla apagada, el ahorro de energía «doze», la frecuencia adaptable de la pantalla «adfr», el control de calor del sistema; ninguna orden de la lista blanca puede escribirlos)
  const solos = /(time|boot_count|screen_brightness|battery|_timestamp|last_|user_rotation|volume|dark_mode_wait|doze|adfr_|thermal|stats)/i;
  const res = { paquetes: dif(antes.paquetes, despues.paquetes), ajustes: {}, igual: true };
  if (res.paquetes.nuevos.length || res.paquetes.quitados.length) res.igual = false;
  for (const a of AJUSTES) {
    const d = dif(antes.ajustes[a], despues.ajustes[a]);
    const clave = s => s.split('=')[0];
    const propios = [...d.nuevos, ...d.quitados].filter(s => !solos.test(clave(s)));
    res.ajustes[a] = { ...d, propios };
    if (propios.length) res.igual = false;
  }
  return res;
}

// ---------- la prueba en el teléfono ----------
/**
 * `conectar(puertoDevtools)` → { abrirIncognito() → { pagina, cerrar() }, soltar() } (Playwright de verdad o uno de
 * mentira en la prueba). `esperar(ms)` se inyecta para que la prueba no espere de verdad.
 */
export async function abrir({ adb, puertos, ruta, segundos, conectar, esperar, aviso = console.log, alFoto = null, grabar = null, alGrabacion = null,
  pantalla = false, recuerdo = null, alContexto = null, durante = null }) {
  const serie = unTelefono(await adb.correr(['devices', '-l']));
  adb.fijarSerie(serie);
  const datos = {};
  for (const p of PROP_LEIDAS) datos[p] = (await adb.correr(['shell', 'getprop', p])).trim();
  aviso(`teléfono: ${datos['ro.product.manufacturer']} ${datos['ro.product.model']} (Android ${datos['ro.build.version.release']})`);
  const antes = await foto(adb);
  const limpiezas = [];                 // se corren al revés, siempre, una sola vez
  let limpio = false;
  const limpiar = async () => {
    if (limpio) return; limpio = true;
    for (const f of limpiezas.reverse()) { try { await f(); } catch (e) { aviso(`limpieza: ${e.message}`); } }
  };
  const alCortar = () => { aviso('Ctrl+C: limpiando antes de salir…'); limpiar().then(() => process.exit(130)); };
  process.once('SIGINT', alCortar);
  const consola = [], historial = [];
  let informe = null, motivo = 'terminó el tiempo', despues = null, datosDurante = null;
  try {
    // 6. la pantalla prendida mientras está conectado; la limpieza la devuelve exacta (y `recuerdo` la anota en disco
    // por si la corrida se corta a la fuerza)
    if (pantalla) {
      const original = await prenderPantalla(adb);
      if (original != null) {
        recuerdo?.guardar(original);
        limpiezas.push(async () => { await devolverPantalla(adb, original); recuerdo?.borrar(); });
        aviso(`pantalla prendida con el cable (antes ${original}; se devuelve al terminar)`);
      }
    }
    for (const p of puertos) {
      await adb.correr(['reverse', `tcp:${p}`, `tcp:${p}`]);
      limpiezas.push(() => adb.correr(['reverse', '--remove', `tcp:${p}`]));
    }
    await adb.correr(['forward', `tcp:${PUERTO_DEVTOOLS}`, 'localabstract:chrome_devtools_remote']);
    limpiezas.push(() => adb.correr(['forward', '--remove', `tcp:${PUERTO_DEVTOOLS}`]));
    const navegador = await conectar(PUERTO_DEVTOOLS, alContexto);
    limpiezas.push(() => navegador.soltar());
    let pestaña;
    try { pestaña = await Promise.race([navegador.abrirIncognito(`http://127.0.0.1:${puertos[0]}${ruta}`), new Promise((_, no) => setTimeout(() => no(new Error('pasaron 60 s sin respuesta')), 60000))]); }
    catch (e) { throw new Error(`el Chrome del teléfono no dejó abrir una pestaña de incógnito (${e.message}); me detengo para no usar tu Chrome normal`); }
    limpiezas.push(() => pestaña.cerrar());
    // mensajes de consola de la pestaña (solo leer; si la pestaña de mentira no tiene .on, se salta)
    if (typeof pestaña.pagina.on === 'function') {
      pestaña.pagina.on('console', m => { if (consola.length < 3000) consola.push(`${m.type()}: ${String(m.text()).slice(0, 300)}`); });
      pestaña.pagina.on('pageerror', e => consola.push(`pageerror: ${String(e.message || e).slice(0, 300)}`));
    }
    // traer la pestaña de incógnito al frente para que el dueño la vea (Page.bringToFront: solo enfoca, no escribe nada)
    if (typeof pestaña.pagina.bringToFront === 'function') await pestaña.pagina.bringToFront().catch(() => {});
    if (!pestaña.navegado) await pestaña.pagina.goto(`http://127.0.0.1:${puertos[0]}${ruta}`);
    if (typeof pestaña.pagina.bringToFront === 'function') await pestaña.pagina.bringToFront().catch(() => {});
    if (typeof pestaña.pantallaCompleta === 'function') {
      const r = await pestaña.pantallaCompleta().catch(e => e.message);
      aviso(r === true ? 'pantalla completa: sí' : `pantalla completa: no (${r})`);
    }
    // `durante(pagina)`: una prueba que maneja la pestaña del teléfono mientras tanto (p. ej. la sala PC + celular,
    // herramientas/prueba-sala-telefono.mjs); el muestreo de cada 10 s sigue y termina cuando ella termina (o a los
    // `segundos`). Si falla, el error sube DESPUÉS de la limpieza
    let terminado = !durante, resultadoDurante = null, errorDurante = null;
    const tarea = durante ? Promise.resolve().then(() => durante(pestaña.pagina)).then(r => { resultadoDurante = r; }, e => { errorDurante = e; }).finally(() => { terminado = true; }) : null;
    for (let t = 0; t < segundos && !(durante && terminado); t += 10) {
      const grados = temperatura(await adb.correr(['shell', 'dumpsys', 'battery']));
      // una muestra del estado del juego en la pestaña cada 10 s (solo leer window.mkwEstado)
      const muestra = await pestaña.pagina.evaluate(() => {
        try { const e = window.mkwEstado || {}; const a = e.n8auto;
          return { enCarrera: e.enCarrera ?? null, logica: e.logica ?? null, cpuPura: window.mkwLastre ? (window.mkwLastre() || {}).cpuPuraMs ?? null : null,
            // N8: los contadores del motor (dibujados, saltados, imágenes del medio…) y lo que decidió la vigía
            n8: typeof e.n8 === 'function' ? e.n8() : null, n8auto: a ? { prendido: a.prendido, cambios: a.cambios, sirve: a.sirve, fijo: a.fijo } : null,
            ahora: Math.round(performance.now()), lienzo: window.__vigiaLienzo ? { n: window.__vigiaLienzo.cambios.length, resizes: window.__vigiaLienzo.resizes } : null }; }
        catch (x) { return { error: String(x) }; }
      }).catch(x => ({ error: x.message }));
      historial.push({ t, grados, muestra });
      // la pantalla completa se pierde si la página se recarga o el juego cambia de modo: se vuelve a pedir cada 10 s
      if (typeof pestaña.pantallaCompleta === 'function' && t > 0) await pestaña.pantallaCompleta().catch(() => {});
      // una foto de la pestaña cada 30 s (Page.captureScreenshot: solo copia la imagen al PC)
      if (alFoto && t % 30 === 0 && typeof pestaña.pagina.screenshot === 'function') {
        const img = await pestaña.pagina.screenshot({ timeout: 15000 }).catch(() => null);
        if (img) await alFoto(`foto-${String(t).padStart(3, '0')}s.png`, img);
      }
      // la grabación: las imágenes que el teléfono compone durante unos segundos (Page.startScreencast: solo copia
      // imágenes al PC), para ver parpadeos que una foto suelta no alcanza
      if (grabar && t === grabar.desde && typeof pestaña.grabar === 'function') {
        const cuadros = await pestaña.grabar(grabar.segundos * 1000).catch(e => { aviso(`grabación: ${e.message}`); return []; });
        if (alGrabacion) await alGrabacion(cuadros);
      }
      if (grados != null && grados >= TEMP_MAXIMA) { motivo = `la batería llegó a ${grados} °C`; break; }
      if (durante) { for (let k = 0; k < 10 && !terminado; k++) await esperar(Math.min(1, segundos - t) * 1000); }
      else await esperar(Math.min(10, segundos - t) * 1000);
    }
    if (tarea) { await tarea; if (errorDurante) throw errorDurante; }
    datosDurante = resultadoDurante;
    informe = await pestaña.pagina.evaluate(async () => {
      try {
        const i = typeof window.mkwInformeRendimiento === 'function' ? await window.mkwInformeRendimiento() : null;
        return i && window.__vigiaLienzo ? { ...i, vigiaLienzo: window.__vigiaLienzo } : i;
      }
      catch (e) { return { error: String(e) }; }
    }).catch(e => ({ error: e.message }));
  } finally {
    await limpiar();
    process.removeListener('SIGINT', alCortar);
    despues = await foto(adb).catch(() => null);
  }
  const cambios = despues ? comparar(antes, despues) : null;
  return { telefono: datos, motivo, informe, cambios, historial, consola, durante: datosDurante };
}

// ---------- varias visitas en la misma pestaña de incógnito (§276) ----------
/**
 * La 2.ª visita sin salir del marco: la MISMA pestaña de incógnito se recarga (location.reload, no se navega a otra
 * dirección: Chrome móvil cambiaría la pestaña). Lo que la 1.ª visita guardó en ese incógnito (la caché HTTP, Cache
 * Storage, IndexedDB, la caché de shaders de la tarjeta) sigue ahí hasta que el marco cierra la pestaña y Chrome lo borra
 * todo. `medir(pagina, n)` mide la visita n (1, 2, …); `esperarCarga(pagina)` espera a que la recarga terminó.
 * Lo que un incógnito NO guarda (la caché de código compilado de V8) se dice aparte en la bitácora.
 * Se usa como `durante` de abrir(): la pestaña, los túneles y la limpieza siguen siendo los del marco.
 */
export async function visitasSeguidas(pagina, { visitas = 2, medir, esperarCarga = p => p.waitForLoadState?.('load', { timeout: 120000 }), pausa = async () => {} }) {
  const resultados = [];
  for (let n = 1; n <= visitas; n++) {
    if (n > 1) {
      await pausa();
      // la recarga se pide desde la página (no con otra dirección); el «evaluate» puede cortarse con la recarga misma
      await pagina.evaluate(() => { setTimeout(() => location.reload(), 0); return true; }).catch(() => {});
      await esperarCarga(pagina);
    }
    resultados.push(await medir(pagina, n));
  }
  return resultados;
}

// ---------- la línea de comandos ----------
export function buscarAdb() {
  if (process.env.TELEFONO_ADB) return process.env.TELEFONO_ADB;
  const candidatos = [
    path.join('platform-tools-latest-windows', 'platform-tools', 'adb.exe'),   // el zip de Google bajado en esta carpeta
    path.join('platform-tools', 'adb.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
  ];
  for (const c of candidatos) if (fs.existsSync(c)) return path.resolve(c);
  return 'adb';
}

export async function conectarPlaywright(puerto, opciones = { fps: true }, alContexto = null) {
  const { chromium } = await import('../banco/node_modules/playwright-core/index.mjs');
  const navegador = await chromium.connectOverCDP(`http://127.0.0.1:${puerto}`);
  return {
    // newContext = Target.createBrowserContext: un incógnito aparte; al cerrarlo Chrome borra todo lo suyo
    // En Android, c.newPage() falla (pide cambiar el tamaño de la ventana, que Chrome móvil no permite): se crea la
    // pestaña con Target.createTarget dentro del contexto de incógnito y se espera a que Playwright la vea.
    abrirIncognito: async (url = 'about:blank') => {
      const sesion = await navegador.newBrowserCDPSession();
      const antes = new Set((await sesion.send('Target.getBrowserContexts')).browserContextIds);
      // viewport: null = la pantalla del teléfono tal cual (sin eso Playwright finge una de 1280×720 y el juego sale mal)
      const c = await navegador.newContext({ viewport: null });
      if (alContexto) await alContexto(c);   // (p. ej. el puente de la señal del banco con el PC, herramientas/puente-contextos.mjs)
      // el medidor de fps y «qué frena» prendidos, solo en el almacén de esta pestaña de incógnito (se borra al cerrarla)
      if (opciones.fps) await c.addInitScript(() => { try { localStorage.setItem('mkw.graficos', JSON.stringify({ verFps: true, verDetalle: true })); } catch {} });
      // el vigía del lienzo (solo mira): cada cambio de tamaño del lienzo del juego (al cambiar de tamaño el navegador lo
      // deja en negro hasta el próximo dibujo) y cada aviso «resize» de la ventana, con su hora; lo lee el informe
      await c.addInitScript(() => {
        const v = window.__vigiaLienzo = { cambios: [], resizes: 0 };
        const t = () => Math.round(performance.now());
        // los toques por segundo (para ver si tocar los botones frena el juego); solo cuenta
        v.toques = {}; v.vibrar = 0;
        for (const tipo of ['pointerdown', 'pointermove', 'pointerup']) addEventListener(tipo, () => { const s = Math.floor(performance.now() / 1000); const k = v.toques[s] ||= [0, 0, 0]; k[['pointerdown', 'pointermove', 'pointerup'].indexOf(tipo)]++; }, { capture: true, passive: true });
        if (navigator.vibrate) { const orig = navigator.vibrate.bind(navigator); navigator.vibrate = (...a) => { v.vibrar++; return orig(...a); }; }
        addEventListener('resize', () => { v.resizes++; if (v.cambios.length < 500) v.cambios.push(['resize', t(), innerWidth, innerHeight, devicePixelRatio]); });
        document.addEventListener('DOMContentLoaded', () => {
          const lienzo = document.getElementById('canvas');
          if (!lienzo) return;
          new MutationObserver(() => { if (v.cambios.length < 500) v.cambios.push(['lienzo', t(), lienzo.width, lienzo.height]); })
            .observe(lienzo, { attributes: true, attributeFilter: ['width', 'height', 'style'] });
        });
      });
      const id = (await sesion.send('Target.getBrowserContexts')).browserContextIds.find(x => !antes.has(x));
      if (!id) { await c.close().catch(() => {}); throw new Error('no apareció el contexto de incógnito'); }
      const espera = c.waitForEvent('page', { timeout: 20000 });
      await sesion.send('Target.createTarget', { url, browserContextId: id });
      const pagina = await espera;
      await pagina.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});
      const grabar = async (ms) => {
        const cdp = await c.newCDPSession(pagina);
        const cuadros = [];
        cdp.on('Page.screencastFrame', ev => {
          cuadros.push({ t: ev.metadata?.timestamp ?? null, jpg: Buffer.from(ev.data, 'base64') });
          cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
        });
        await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 50, maxWidth: 480, maxHeight: 270, everyNthFrame: 1 });
        await new Promise(f => setTimeout(f, ms));
        await cdp.send('Page.stopScreencast').catch(() => {});
        await cdp.detach().catch(() => {});
        return cuadros;
      };
      // pantalla completa: el navegador la permite solo «tras un toque»; userGesture: true hace de toque. Es solo de esta
      // pestaña: al cerrarla el teléfono vuelve a como estaba
      const pantallaCompleta = async () => {
        const cdp = await c.newCDPSession(pagina);
        const r = await cdp.send('Runtime.evaluate', { // el botón ⛶ de la página (#completa: pantalla completa y acostado); si todavía no está, la página entera
          expression: `(async () => { if (document.fullscreenElement) return true; const b = document.getElementById('completa');
            if (b) { b.click(); await new Promise(f => setTimeout(f, 500)); if (document.fullscreenElement) return true; }
            // (si el botón no alcanzó, la página entera directo y acostada)
            const r = await document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => true, e => String(e));
            screen.orientation?.lock?.('landscape').catch(() => {});
            return r; })()`,
          userGesture: true, awaitPromise: true, returnByValue: true });
        await cdp.detach().catch(() => {});
        return r.result?.value;
      };
      return { pagina, navegado: true, grabar, pantallaCompleta, cerrar: () => c.close() };   // Chrome móvil cambia la pestaña si se navega después: se abre ya con la dirección
    },
    soltar: () => navegador.close(),   // conectado por CDP, close() solo se desconecta: tu Chrome sigue abierto
  };
}

// dónde queda anotado el valor original de la pantalla mientras está cambiado (lo borra la limpieza)
export function recuerdoPantalla(archivo = path.join('build', 'web', 'datos', 'telefono', 'pantalla-original.json')) {
  return {
    guardar: v => { fs.mkdirSync(path.dirname(archivo), { recursive: true }); fs.writeFileSync(archivo, JSON.stringify({ stay_on_while_plugged_in: v, cuando: new Date().toISOString() })); },
    leer: () => { try { return JSON.parse(fs.readFileSync(archivo, 'utf8')).stay_on_while_plugged_in; } catch { return null; } },
    borrar: () => { try { fs.unlinkSync(archivo); } catch {} },
  };
}

async function principal() {
  const [orden, ...resto] = process.argv.slice(2);
  const opcion = (n, d) => { const i = resto.indexOf(n); return i >= 0 ? resto[i + 1] : d; };
  const puertos = String(opcion('--puerto', '8140')).split(',').map(Number);
  const carpeta = path.join('build', 'web', 'datos', 'telefono', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
  fs.mkdirSync(carpeta, { recursive: true });
  const lineas = [];
  const registro = l => { lineas.push(`${new Date().toISOString()} ${l}`); fs.writeFileSync(path.join(carpeta, 'registro.txt'), lineas.join('\n') + '\n'); };
  const adb = crearAdb({ ejecutable: buscarAdb(), puertos, registro });
  if (orden === 'revisar') {
    const serie = unTelefono(await adb.correr(['devices', '-l']));
    adb.fijarSerie(serie);
    for (const p of PROP_LEIDAS) console.log(`${p} = ${(await adb.correr(['shell', 'getprop', p])).trim()}`);
    const f = await foto(adb);
    console.log(`apps instaladas: ${f.paquetes.length}; batería: ${temperatura(await adb.correr(['shell', 'dumpsys', 'battery']))} °C`);
  } else if (orden === 'abrir') {
    const r = await abrir({ adb, puertos, ruta: opcion('--ruta', '/'), segundos: Number(opcion('--segundos', '90')),
      conectar: (p, alCtx) => conectarPlaywright(p, { fps: !resto.includes('--sin-fps') }, alCtx),
      pantalla: !resto.includes('--sin-pantalla'), recuerdo: recuerdoPantalla(),
      // --fotos: una foto cada 30 s. Solo a pedido: en Android la foto por DevTools cambia un instante el tamaño de la
      // ventana (1 píxel), el lienzo del juego se rehace y se ve un parpadeo negro (2026-11-07: era esto, no el juego)
      alFoto: resto.includes('--fotos') ? (nombre, img) => fs.writeFileSync(path.join(carpeta, nombre), img) : null,
      // --grabar desde,segundos (p. ej. 60,8): las imágenes compuestas de esos segundos en <carpeta>/grabacion/
      grabar: opcion('--grabar') ? (([d, s]) => ({ desde: Number(d), segundos: Number(s) }))(opcion('--grabar').split(',')) : null,
      alGrabacion: cuadros => {
        const dir = path.join(carpeta, 'grabacion'); fs.mkdirSync(dir, { recursive: true });
        cuadros.forEach((q, i) => fs.writeFileSync(path.join(dir, `${String(i).padStart(4, '0')}.jpg`), q.jpg));
        fs.writeFileSync(path.join(dir, 'tiempos.json'), JSON.stringify(cuadros.map(q => q.t)));
        console.log(`grabación: ${cuadros.length} imágenes en ${dir}`);
      }, esperar: ms => new Promise(f => setTimeout(f, ms)) });
    fs.writeFileSync(path.join(carpeta, 'resultado.json'), JSON.stringify(r, null, 2));
    console.log(`fin: ${r.motivo}`);
    if (!r.cambios) console.log('✗ no se pudo leer la foto de después');
    else if (r.cambios.igual) console.log('✓ el teléfono quedó igual que antes (apps y ajustes)');
    else console.log('✗ algo cambió en el teléfono:', JSON.stringify(r.cambios, null, 2));
  } else if (orden === 'limpiar') {
    // quita los túneles del cable si una corrida anterior se cortó a la fuerza (solo las órdenes «--remove» de la lista blanca)
    adb.fijarSerie(unTelefono(await adb.correr(['devices', '-l'])));
    for (const p of puertos) await adb.correr(['reverse', '--remove', `tcp:${p}`]).catch(e => console.log(e.message));
    const r = recuerdoPantalla(), original = r.leer();
    if (original != null) { await devolverPantalla(adb, original); r.borrar(); console.log(`pantalla devuelta a ${original}`); }
    await adb.correr(['forward', '--remove', `tcp:${PUERTO_DEVTOOLS}`]).catch(e => console.log(e.message));
    console.log('túneles quitados');
  } else {
    console.log('uso: node herramientas/telefono-seguro.mjs revisar | limpiar | abrir [--ruta …] [--puerto 8140] [--segundos 90]');
    process.exitCode = 2; return;
  }
  console.log(`registro de órdenes: ${path.join(carpeta, 'registro.txt')}`);
  console.log('Al terminar: apaga «Depuración USB» en Opciones de desarrollador (y, si quieres, «Revocar autorizaciones»).');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch(e => { console.error(`✗ ${e.message}`); process.exitCode = 1; });
}
