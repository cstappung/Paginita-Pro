// Ejecuta una prueba Node con un límite externo al hilo de Chrome.
// Uso: node herramientas/correr-acotado.mjs SEGUNDOS archivo.mjs [argumentos…]
// Si el navegador se bloquea, se termina solamente el árbol del proceso hijo que acabamos de crear.
import { spawn } from 'node:child_process';
const [segundos, archivo, ...args] = process.argv.slice(2);
if (!(Number(segundos) > 0) || !archivo) throw new Error('Falta SEGUNDOS archivo.mjs');
const hijo = spawn(process.execPath, [archivo, ...args], { stdio: 'inherit', windowsHide: true });
let agotado = false;
const reloj = setTimeout(() => {
  agotado = true;
  console.error(`✗ Límite externo de ${segundos} s: se termina solo el árbol propio PID ${hijo.pid}`);
  if (process.platform === 'win32') spawn('taskkill', ['/PID', String(hijo.pid), '/T', '/F'], { stdio: 'inherit', windowsHide: true });
  else hijo.kill('SIGTERM');
}, Number(segundos) * 1000);
hijo.once('error', e => { clearTimeout(reloj); console.error(e); process.exitCode = 1; });
hijo.once('exit', codigo => { clearTimeout(reloj); process.exitCode = agotado ? 124 : codigo === 0 ? 0 : 1; });
