// Prueba de telefono-seguro.mjs SIN teléfono: un adb y un Chrome de mentira (nada del juego, nada real).
//
// Resumen: comprueba las cinco protecciones —
//   - la lista blanca rechaza install, push, rm, reboot, «settings put», un «;» colado y un puerto ajeno, y deja pasar
//     solo las órdenes de leer y los túneles;
//   - con dos teléfonos o uno sin autorizar se detiene;
//   - la limpieza corre siempre (también si la página falla a la mitad) y quita cada túnel que puso;
//   - si el Chrome no deja abrir un incógnito, se detiene sin abrir nada más;
//   - el calor corta la prueba; la foto de después encuentra una app nueva o un ajuste cambiado.
// Uso:  node herramientas/prueba-telefono-seguro.mjs
import { permitida, crearAdb, unTelefono, temperatura, comparar, abrir } from './telefono-seguro.mjs';

let bien = 0, mal = 0;
const ok = (texto, cumple, detalle = '') => { cumple ? bien++ : mal++; console.log(`${cumple ? '✓' : '✗'} ${texto}${detalle ? ' — ' + detalle : ''}`); };
const P = [8140];

// 1) la lista blanca
const prohibidas = [
  ['install', 'x.apk'], ['uninstall', 'com.android.chrome'], ['push', 'a', '/sdcard/a'], ['shell', 'rm', '-rf', '/sdcard'],
  ['reboot'], ['shell', 'settings', 'put', 'global', 'adb_enabled', '0'], ['shell', 'pm', 'list', 'packages;rm', '-rf', '/'],
  ['shell', 'pm', 'clear', 'com.android.chrome'], ['reverse', 'tcp:22', 'tcp:22'], ['reverse', 'tcp:8140', 'tcp:22'],
  ['forward', 'tcp:9333', 'tcp:5555'], ['shell'], ['shell', 'am', 'force-stop', 'com.android.chrome'],
];
ok('la lista blanca rechaza las 13 órdenes peligrosas', prohibidas.every(a => !permitida(a, P)),
  prohibidas.filter(a => permitida(a, P)).map(a => a.join(' ')).join(', '));
const permitidas = [['devices', '-l'], ['reverse', 'tcp:8140', 'tcp:8140'], ['reverse', '--remove', 'tcp:8140'],
  ['forward', 'tcp:9333', 'localabstract:chrome_devtools_remote'], ['forward', '--remove', 'tcp:9333'],
  ['shell', 'pm', 'list', 'packages'], ['shell', 'settings', 'list', 'secure'], ['shell', 'getprop', 'ro.product.model'], ['shell', 'dumpsys', 'battery']];
ok('y deja pasar las 9 de leer y de túnel', permitidas.every(a => permitida(a, P)));
{
  const reg = [];
  const adb = crearAdb({ ejecutable: 'no-existe-adb', puertos: P, registro: l => reg.push(l) });
  let rechazo = null;
  try { await adb.correr(['install', 'x.apk']); } catch (e) { rechazo = e.message; }
  ok('crearAdb rechaza antes de llamar a adb y lo anota', /no permitida/.test(rechazo || '') && reg[0]?.startsWith('RECHAZADA'), reg[0]);
}

// 2) qué teléfono
const lista = l => `List of devices attached\n${l}\n`;
ok('un teléfono listo da su serie', unTelefono(lista('ABC123 device usb:1 model:X')) === 'ABC123');
const lanza = f => { try { f(); return null; } catch (e) { return e.message; } };
ok('dos teléfonos → se detiene', /más de un/.test(lanza(() => unTelefono(lista('A device\nB device'))) || ''));
ok('sin autorizar → pide aceptar el aviso', /autoriz/.test(lanza(() => unTelefono(lista('A unauthorized'))) || ''));
ok('ninguno → se detiene', /no hay/.test(lanza(() => unTelefono(lista(''))) || ''));
ok('la temperatura en décimas', temperatura('  level: 80\n  temperature: 387\n') === 38.7);

// 3) el recorrido con un adb y un Chrome de mentira
function telefonoFalso({ calor = 300, appNueva = false, ajusteNuevo = false, incognito = true, falla = false } = {}) {
  const ordenes = [];
  let fotos = 0, tuneles = new Set();
  const adb = {
    fijarSerie() {},
    async correr(args) {
      if (!permitida(args, P)) throw new Error('no permitida ' + args.join(' '));
      ordenes.push(args.join(' '));
      const o = args.join(' ');
      if (o === 'devices -l') return lista('SERIE1 device');
      if (o.startsWith('shell getprop')) return 'X\n';
      if (o === 'shell dumpsys battery') return `temperature: ${calor}\n`;
      if (o === 'shell pm list packages') { fotos++; return 'package:com.android.chrome\n' + (appNueva && fotos > 1 ? 'package:com.rara\n' : ''); }
      if (o.startsWith('shell settings list')) return 'a=1\n' + (ajusteNuevo && fotos > 1 && o.endsWith('global') ? 'adb_wifi_enabled=1\n' : '');
      if (args[0] === 'reverse' || args[0] === 'forward') {
        if (args[1] === '--remove') tuneles.delete(args[2]); else tuneles.add(args[1]);
      }
      return '';
    },
  };
  const estado = { incognitoAbierto: false, incognitoCerrado: false, soltado: false };
  const conectar = async () => ({
    abrirIncognito: async () => {
      if (!incognito) throw new Error('Target.createBrowserContext no está');
      estado.incognitoAbierto = true;
      const oyentes = {};
      estado.oyentes = oyentes;
      return { pagina: { goto: async () => { if (falla) throw new Error('la página se cayó'); oyentes.console?.({ type: () => 'log', text: () => 'hola' }); },
        evaluate: async () => ({ fps: 58 }), on: (n, f) => { oyentes[n] = f; },
        bringToFront: async () => { estado.alFrente = (estado.alFrente || 0) + 1; }, screenshot: async () => Buffer.from('png') },
        cerrar: async () => { estado.incognitoCerrado = true; } };
    },
    soltar: async () => { estado.soltado = true; },
  });
  return { adb, conectar, estado, ordenes, tuneles: () => tuneles };
}
const correr = (t, extra = {}) => abrir({ adb: t.adb, puertos: P, ruta: '/', segundos: 30, conectar: t.conectar, esperar: async () => {}, aviso: () => {}, ...extra });

{
  const t = telefonoFalso();
  const r = await correr(t);
  ok('normal: abre en incógnito, lee el informe y lo cierra', t.estado.incognitoAbierto && t.estado.incognitoCerrado && r.informe?.fps === 58);
  ok('normal: quita los dos túneles y se desconecta', t.tuneles().size === 0 && t.estado.soltado, [...t.tuneles()].join(','));
  ok('normal: la foto de después dice «igual»', r.cambios?.igual === true);
}
{
  const t = telefonoFalso({ falla: true });
  let error = null;
  try { await correr(t); } catch (e) { error = e.message; }
  ok('si la página falla: el error sube y la limpieza igual corre', /se cayó/.test(error || '') && t.estado.incognitoCerrado && t.tuneles().size === 0);
}
{
  const t = telefonoFalso({ incognito: false });
  let error = null;
  try { await correr(t); } catch (e) { error = e.message; }
  ok('sin incógnito: se detiene, no abre otra pestaña y limpia los túneles', /incógnito/.test(error || '') && !t.estado.incognitoAbierto && t.tuneles().size === 0);
}
{
  const t = telefonoFalso({ calor: 431 });
  const r = await correr(t);
  ok('el calor corta la prueba', /43\.1/.test(r.motivo), r.motivo);
}
{
  const r = await correr(telefonoFalso({ appNueva: true }));
  ok('la foto encuentra una app nueva', r.cambios && !r.cambios.igual && r.cambios.paquetes.nuevos.includes('package:com.rara'));
  const r2 = await correr(telefonoFalso({ ajusteNuevo: true }));
  ok('y un ajuste nuevo del sistema', r2.cambios && !r2.cambios.igual && r2.cambios.ajustes.global.propios.length === 1);
  const a = { paquetes: [], ajustes: { global: ['boot_count=5'], secure: [], system: [] } };
  const b = { paquetes: [], ajustes: { global: ['boot_count=6'], secure: [], system: [] } };
  ok('lo que el teléfono cambia solo (la cuenta de encendidos) no se toma como nuestro', comparar(a, b).igual === true);
}
{
  const t = telefonoFalso();
  await correr(t);
  ok('todas las órdenes que llegaron al teléfono son de la lista blanca', t.ordenes.every(o => permitida(o.split(' '), P)), `${t.ordenes.length} órdenes`);
}

{
  // las fotos cada 30 s, la muestra cada 10 s, la consola y la pestaña al frente
  const t = telefonoFalso();
  const fotos = [];
  const r = await correr(t, { segundos: 60, alFoto: async n => { fotos.push(n); } });
  ok('una foto de la pestaña cada 30 s', fotos.join(',') === 'foto-000s.png,foto-030s.png', fotos.join(','));
  ok('una muestra del juego cada 10 s y los mensajes de la consola', r.historial.length === 6 && r.consola.includes('log: hola'), `${r.historial.length} muestras`);
  ok('la pestaña de incógnito pasa al frente de la pantalla', t.estado.alFrente >= 1);
  // girar la pantalla o cambiar el volumen con la mano no es un cambio nuestro; un ajuste de verdad sí
  const a = { paquetes: [], ajustes: { global: ['per_speaker_music_volume=1'], secure: ['Setting_doze_with_policyoff=0'], system: ['user_rotation=0'] } };
  const b = { paquetes: [], ajustes: { global: ['per_speaker_music_volume=2'], secure: ['Setting_doze_with_policyoff=1'], system: ['user_rotation=1'] } };
  const c = { paquetes: [], ajustes: { global: ['per_speaker_music_volume=2', 'adb_wifi_enabled=1'], secure: [], system: [] } };
  ok('girar la pantalla, el volumen o el ahorro de energía no cuentan como nuestros; un ajuste nuevo sí',
    comparar(a, b).igual === true && comparar(a, c).igual === false);
}

console.log(`\n${bien}/${bien + mal} puntos`);
process.exitCode = mal ? 1 : 0;
