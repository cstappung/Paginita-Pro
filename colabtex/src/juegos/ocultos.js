/* Los juegos que esta persona no debe ver, ni siquiera nombrados (en la tienda del perfil, en las tablas de las
   monedas…). Hoy solo BT3, que es privado: oculto hasta que bt3-amigos.js confirma que está en la lista de amigos.
   Un módulo aparte, sin Firebase, para que lo usen las vistas (y sus pruebas en Node) sin cargar la sesión. */
const ocultos = new Set(["bt3"]);

export const juegoOculto = k => ocultos.has(k);
export function ponOculto(k, si) { if (si) ocultos.add(k); else ocultos.delete(k); }
