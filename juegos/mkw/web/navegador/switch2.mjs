// Despertar un mando de Switch 2 conectado por cable — bitácora §263 (el dueño: «agrega compatibilidad con mando switch y
// switch 2»).
//
// Resumen: los mandos de Switch 2 (Pro Controller 2, el de GameCube de Switch 2, los Joy-Con 2) enchufados por USB no
// mandan nada hasta que alguien les habla por su segunda «puerta» (la interfaz 1, de fabricante): una lista de 17
// órdenes cortas que la consola les manda al conectarlos. Recién entonces aparecen en el navegador como un mando más
// (mapping "": botones crudos, que disposicion-mando.mjs ordena). El navegador puede mandar esas órdenes con WebUSB
// (`navigator.usb`), pero solo después de que la persona elige el mando en la ventana del navegador (un clic: es una
// regla de seguridad, no se puede saltar).
//   · Las 17 órdenes son las que documentaron quienes estudiaron el protocolo (ns2-usb-wake en Linux y otros: las mismas
//     en el mismo orden, verificadas aquí contra los dos textos). Son datos del protocolo; este código es nuestro.
//   · Cada orden va por la salida «bulk» de la interfaz 1; después se lee una respuesta corta, si viene (no se usa).
//   · Windows: el sistema no le pone un controlador a esa interfaz, y sin él el navegador no la puede abrir
//     («NetworkError»/«SecurityError» al reclamarla). Se dice en palabras simples qué hacer (instalar el controlador
//     WinUSB para esa interfaz con Zadig) y que por Bluetooth el navegador todavía no los ve. En Android y Mac anda solo.
// Como un equipo que trae el interruptor general apagado de fábrica: hay que subirlo una vez, después funciona como todos.
//
// Uso:  if (switch2Disponible()) await despertarSwitch2({ alPaso })  → { ok, nombre, error? }

export const VENDEDOR = 0x057e;
export const PRODUCTOS = { 0x2066: 'Joy-Con 2 (der.)', 0x2067: 'Joy-Con 2 (izq.)', 0x2069: 'Pro Controller de Switch 2', 0x2073: 'Mando de GameCube de Switch 2' };
const h = s => Uint8Array.from(s.trim().split(/\s+/), x => parseInt(x, 16));
// Las órdenes, en orden (los largos importan: 4 → 22 bytes, 5 → 25, 10 → 28)
export const ORDENES = [
  '03 91 00 0d 00 08 00 00 01 00 ff ff ff ff ff ff',
  '07 91 00 01 00 00 00 00',
  '16 91 00 01 00 00 00 00',
  '15 91 00 01 00 0e 00 00 00 02 ff ff ff ff ff ff ff ff ff ff ff ff',
  '15 91 00 02 00 11 00 00 00 ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff ff',
  '15 91 00 03 00 01 00 00 00',
  '09 91 00 07 00 08 00 00 00 00 00 00 00 00 00 00',
  '0c 91 00 02 00 04 00 00 27 00 00 00',
  '11 91 00 03 00 00 00 00',
  '0a 91 00 08 00 14 00 00 01 ff ff ff ff ff ff ff ff 35 00 46 00 00 00 00 00 00 00 00',
  '0c 91 00 04 00 04 00 00 27 00 00 00',
  '03 91 00 0a 00 04 00 00 09 00 00 00',
  '10 91 00 01 00 00 00 00',
  '01 91 00 0c 00 00 00 00',
  '03 91 00 01 00 00 00',
  '0a 91 00 02 00 04 00 00 03 00 00',
  '09 91 00 07 00 08 00 00 01 00 00 00 00 00 00 00',   // (la última prende la luz del jugador 1)
].map(h);

export const switch2Disponible = (nav = globalThis.navigator) => !!nav?.usb?.requestDevice;
const espera = ms => new Promise(r => setTimeout(r, ms));

// Mandar las órdenes a un dispositivo ya abierto (separado para probarlo con un USB de mentira en el banco)
export async function mandarOrdenes(disp, { alPaso = null, pausaMs = 30, respuestaMs = 120 } = {}) {
  if (!disp.configuration) await disp.selectConfiguration(1);
  const interfaz = disp.configuration.interfaces.find(i => i.interfaceNumber === 1);
  if (!interfaz) throw Object.assign(new Error('el mando no tiene la interfaz 1'), { tipo: 'interfaz' });
  await disp.claimInterface(1);
  const alt = interfaz.alternate || interfaz.alternates?.[0];
  const sale = alt.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');
  const entra = alt.endpoints.find(e => e.direction === 'in' && e.type === 'bulk');
  if (!sale) throw Object.assign(new Error('sin salida bulk'), { tipo: 'interfaz' });
  for (let i = 0; i < ORDENES.length; i++) {
    const r = await disp.transferOut(sale.endpointNumber, ORDENES[i]);
    if (r.status !== 'ok') throw Object.assign(new Error(`la orden ${i + 1} volvió «${r.status}»`), { tipo: 'orden' });
    // la respuesta, si llega (no se usa; esperarla un rato evita mandar la siguiente encima)
    if (entra) await Promise.race([disp.transferIn(entra.endpointNumber, 64).catch(() => null), espera(respuestaMs)]);
    alPaso?.(i + 1, ORDENES.length);
    await espera(pausaMs);
  }
  try { await disp.releaseInterface(1); } catch {}
  return true;
}

// El clic de la persona: elegir el mando en la ventana del navegador, abrirlo y despertarlo
export async function despertarSwitch2({ nav = globalThis.navigator, alPaso = null } = {}) {
  if (!switch2Disponible(nav)) return { ok: false, error: 'Este navegador no puede hablar por USB (hace falta Chrome o Edge).' };
  let disp = null;
  try {
    disp = await nav.usb.requestDevice({ filters: Object.keys(PRODUCTOS).map(p => ({ vendorId: VENDEDOR, productId: +p })) });
  } catch (e) {
    return { ok: false, cancelado: true, error: 'No se eligió ningún mando.' };
  }
  const nombre = PRODUCTOS[disp.productId] || 'Mando de Switch 2';
  try {
    if (!disp.opened) await disp.open();
    await mandarOrdenes(disp, { alPaso });
    return { ok: true, nombre };
  } catch (e) {
    const windows = /Win/.test(nav.userAgent || nav.platform || '');
    const bloqueado = /NetworkError|SecurityError|InvalidStateError|Access denied|Unable to claim/i.test(`${e?.name} ${e?.message}`);
    return { ok: false, nombre, error: bloqueado && windows
      ? 'Windows no deja abrir esta parte del mando. Para usarlo por cable, instala una vez el controlador «WinUSB» para la ' +
        '«Interface 1» de este mando con el programa Zadig, y vuelve a tocar «Activar». (Por Bluetooth, el navegador todavía no lo ve.)'
      : `No se pudo activar (${e?.message || e}). Desenchúfalo, vuelve a enchufarlo y prueba otra vez.` };
  } finally {
    try { if (disp?.opened) await disp.close(); } catch {}
  }
}
