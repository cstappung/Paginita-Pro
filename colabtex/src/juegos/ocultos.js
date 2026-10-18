/* Los juegos que esta persona no debe ver, ni siquiera nombrados (en la tienda del perfil, en las tablas de las
   monedas…). Hoy BT3 y Mario Kart Wii, que son privados (sus programas se sirven solo a los amigos de la lista del
   Worker): ocultos hasta que bt3-amigos.js confirma que está en la lista.
   Un módulo aparte, sin Firebase, para que lo usen las vistas (y sus pruebas en Node) sin cargar la sesión. */
const ocultos = new Set(["bt3", "mkw"]);

export const juegoOculto = k => ocultos.has(k);
export function ponOculto(k, si) { if (si) ocultos.add(k); else ocultos.delete(k); }
