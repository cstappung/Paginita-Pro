// §291: qué navegador abren las pruebas y las mediciones (Playwright).
//
// Resumen: todas las herramientas abrían «Chrome de verdad» con `channel: 'chrome'`. El dueño juega también en Opera GX
// (que es Chromium por dentro, con su propia capa encima) y ahí el juego va peor; para medirlo hace falta abrir Opera GX
// con las mismas herramientas. Este módulo decide cuál:
//   --navegador chrome|opera-gx|<ruta a un .exe>   (también --navegador=…)
//   MKW_NAVEGADOR=chrome|opera-gx|<ruta>           (la variable sirve para TODAS las herramientas, aunque no lean la opción)
// Por omisión: chrome (como siempre). `opcionesNavegador()` devuelve lo que va dentro de chromium.launch(…) o de
// launchPersistentContext(…): `{ channel: 'chrome' }` o `{ executablePath: 'C:\\…\\opera.exe' }`.
//
// El perfil: Playwright siempre le pasa al navegador una carpeta de perfil propia (temporal con launch(); la que dé la
// herramienta con launchPersistentContext, siempre en %TEMP%). Nunca se usa el perfil del dueño. Por eso Opera GX abre
// «de fábrica»: sin sus limitadores de RAM/CPU/red prendidos, sin extensiones ni el bloqueador de anuncios del dueño.
//
// Ojo con Opera GX: `…\Programs\Opera GX\opera.exe` (la de afuera) es el LANZADOR, que abre otro proceso y se va;
// Playwright perdería el navegador. El de verdad está en la carpeta de la versión: `…\Opera GX\139.0.6053.63\opera.exe`.
// Se elige la versión más nueva que tenga opera.exe.
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

// la versión como lista de números, para ordenar «139.0.6053.63» después de «139.0.6053.42»
const numeros = v => v.split('.').map(Number);
const masNueva = (a, b) => { const x = numeros(a), y = numeros(b); for (let i = 0; i < 4; i++) if ((x[i] || 0) !== (y[i] || 0)) return (y[i] || 0) - (x[i] || 0); return 0; };

// el opera.exe de verdad (no el lanzador) dentro de una instalación de Opera (GX u otra)
export function buscarOpera(carpeta) {
  if (!existsSync(carpeta)) return null;
  const versiones = readdirSync(carpeta).filter(n => /^\d+(\.\d+){3}$/.test(n) && existsSync(path.join(carpeta, n, 'opera.exe'))).sort(masNueva);
  return versiones.length ? path.join(carpeta, versiones[0], 'opera.exe') : null;
}

// lo que pidió quien corre la herramienta: la opción gana a la variable; nada = chrome
export function navegadorPedido(argv = process.argv) {
  const i = argv.findIndex(a => a === '--navegador' || a.startsWith('--navegador='));
  if (i >= 0) return argv[i].includes('=') ? argv[i].split('=').slice(1).join('=') : (argv[i + 1] || 'chrome');
  return process.env.MKW_NAVEGADOR || 'chrome';
}

// { nombre, exe, opciones, proceso }: nombre = 'chrome' | 'opera-gx' | 'otro'; opciones = para launch(); proceso = el
// nombre del .exe en el Administrador de tareas (para atar núcleos con --nucleos o mirar la memoria por proceso)
export function elegirNavegador(argv = process.argv) {
  const pedido = navegadorPedido(argv);
  if (pedido === 'chrome' || pedido === '') return { nombre: 'chrome', exe: null, opciones: { channel: 'chrome' }, proceso: 'chrome.exe' };
  if (pedido === 'opera-gx' || pedido === 'opera') {
    const base = path.join(process.env.LOCALAPPDATA || '', 'Programs', pedido === 'opera-gx' ? 'Opera GX' : 'Opera');
    const exe = buscarOpera(base);
    if (!exe) throw new Error(`§291: no encuentro ${pedido} en ${base} (¿instalado? o pasa la ruta del opera.exe de la carpeta de la versión)`);
    return { nombre: pedido, exe, opciones: { executablePath: exe }, proceso: 'opera.exe' };
  }
  if (!existsSync(pedido)) throw new Error(`§291: --navegador ${pedido}: no es chrome, opera-gx ni un archivo que exista`);
  // una ruta a mano: si es el lanzador de Opera (la carpeta tiene versiones dentro), tomar el de verdad
  const exe = path.basename(pedido).toLowerCase() === 'opera.exe' ? (buscarOpera(path.dirname(pedido)) || pedido) : pedido;
  return { nombre: 'otro', exe, opciones: { executablePath: exe }, proceso: path.basename(exe) };
}

// lo que va dentro de chromium.launch({ ...opcionesNavegador(), … }) en lugar de channel: 'chrome'
export const opcionesNavegador = (argv = process.argv) => elegirNavegador(argv).opciones;
