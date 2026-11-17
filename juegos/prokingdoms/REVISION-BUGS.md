# Revisión de bugs de Pro Kingdoms (17 de noviembre de 2026, `pk-77`)

Rama `claude/revision-bugs-pk`, hecha desde `origin/main` (`pk-75`). La rama `claude/epic-gauss-33djdu` ya usa
`pk-76` («elegir tropas en el celular», un cambio de interfaz que no se pisa con este), así que esta entrega sube a
**`pk-77`** para no chocar. Si se integra antes que pk-76, basta con dejar el número más alto.

Cada bug se reprodujo antes de arreglarlo. Las pruebas nuevas fallan sin el arreglo y pasan con él.

## a) Bugs encontrados y arreglados

### Carretas: traslado entre bodegas (pk-68)

**1. La carreta de traslado se queda para siempre esperando junto a un Almacén vacío**
- **Archivo:** `js/logistics.js` (`descargar`, `L.offline`, nueva `ponerTraslado`).
- **Síntoma:** con el pueblo sobre el tope (por un premio, o al demoler un Almacén), la carreta llega a un Almacén vacío
  y queda en «Almacén está lleno: espera para descargar». Si no, descarga en una bodega llena y la conciliación devuelve
  la carga al origen: el viaje no sirve.
- **Causa:** `put()` medía el lugar contra el tope del pueblo, pero lo que lleva un traslado ya contaba dentro de ese
  tope. Es el mismo caso que pk-70 arregló para las cintas de bodega a bodega.
- **Arreglo:** en un traslado entra solo lo que cabe en *esa* bodega (`Lb.lugar`), con el margen
  `Lb.poner(b, k, m, m)`. Lo mismo sin conexión.

**2. Una carreta cargada da vueltas para siempre si su destino desaparece**
- **Archivo:** `js/logistics.js` (`L.extremos`, `descargar`, nueva `bodegaParaCarga`).
- **Síntoma:** el estado repite «Granero no recibe madera: va a Centro Urbano» cada 0,3 s.
- **Causa:** `otraBodega` elegía el nuevo destino según lo que hay en el origen, no según la carga. `descargar`
  proponía la bodega fija de origen, que `extremos` rechaza, y así sin fin.
- **Arreglo:** con la carreta cargada, el destino se elige por lo que lleva y nunca es la bodega fija. Si ninguna
  bodega lo guarda, la carga vuelve al pueblo.

- **Prueba de 1 y 2:** `colabtex/tests/prokingdoms.test.cjs`, «pk-77: un traslado entre bodegas…».

### Guerra (G4, G3)

**3. Unos refuerzos que se aplican tarde deshacen una retirada (servidor)**
- **Archivos:** `server/sim.js` (`tickCamps`, `asedio`, nueva `aplicarRefuerzo`) y `js/data.js` (`D.asedioReplan`).
- **Síntoma:** el atacante se retira y aun así conquista la parcela, con botín completo.
- **Causa:** el tick (cada 5 s, o perezoso en Cloud Functions) aplicaba los refuerzos desde su hora de llegada, que ya
  había pasado. Si en ese hueco el atacante se retiraba, el plan rearmado borraba la retirada.
- **Arreglo:**
  - `D.asedioReplan` devuelve `null` si el plan tiene `fin` (retirada o rendición).
  - Los refuerzos ya llegados se aplican **antes** de cada decisión.

**4. Una retirada o rendición en el primer segundo se puede rearmar**
- **Archivo:** `js/data.js`.
- **Síntoma:** en ese segundo una salida del defensor sube las bajas de quien se retira del 15 % al 71 %, y una táctica
  convierte una rendición en un asedio. El mismo guard del punto 3 lo arregla.

**5. Una salida que falla igual cobra el 5 % y queda gastada (servidor)**
- **Archivo:** `server/sim.js` (`asedio`).
- **Síntoma:** al pedir la salida en la etapa 3 (donde ya no vale), da error pero la foto pierde el 5 % del ejército.
  Lo mismo pasaba con `tacCambio`.
- **Arreglo:** el costo y las marcas se aplican solo si el rearmado del plan salió bien.

**6. La vista del asedio revela la derrota desde el segundo 0**
- **Archivo:** `js/data.js` (`D.asedioVista`).
- **Causa:** el final viajaba cuando «empezaron todas las etapas del plan», y un ataque que se quiebra en la frontera
  tiene un plan de una sola etapa.
- **Síntoma:** desde el principio viajaban `gano: false`, las bajas, la fuerza real y `rota`. La falta de `parcial`
  delataba al perdedor.
- **Arreglo:** el final viaja cuando empieza el estandarte o cuando terminó el asedio. Las vistas parciales no llevan
  `rota`. En `tools/asedio-test.js` se quitó la excepción que lo aceptaba.

**7. Los refuerzos locales no llegan si se recarga o se pone al día sin conexión**
- **Archivo:** `js/terr.js` (`T.update`, `T.accion`).
- **Causa:** la condición era «ahora antes del final», no «llegaron antes del final» como en el servidor. El mismo
  asedio terminaba distinto con la pestaña abierta.
- **Arreglo:** la misma condición que el servidor. Además, se aplican antes de una decisión local.

- **Pruebas de 3 a 7:**
  - `colabtex/tests/pk-asedio.test.cjs`, «pk-77: un plan cortado…»: guard y vista.
  - `tools/asedio-test.js`: salida fuera de etapa, y retirada después de que llegaron los refuerzos.

**8. Menores de guerra (sin prueba propia)**
- **Ciudadela (`server/sim.js`, `ciudDe`):** si el gremio con más ímpetu se disolvió, nadie ocupaba la Ciudadela.
  Ahora la toma el siguiente gremio que exista.
- **«Llega en…» del aviso `under_attack` (`js/net.js`):** restaba la hora del servidor al reloj local. Ahora usa
  `aLocal`.
- **Misión `fortaleza_semana` (`js/fortalezas.js`):** al recuperar una fortaleza perdida, la marca `semana` no se
  borraba y la misión no volvía a contar. Ahora se borra al tomarla.

### Red de cintas (pk-69 a pk-75)

**9. Un unidor se traba con un divisor o clasificador que le entrega directo**
- **Archivo:** `js/cintas.js` (`listo`).
- **Síntoma:** la otra entrada del unidor queda parada para siempre. En el escenario de prueba el aserradero recibía
  320 y después nada.
- **Causa:** el turno de una entrada contaba como «listo» aunque su punta no pudiera ir al unidor: el divisor salta
  esa rama (pk-72) o el filtro del clasificador la cierra. Así el turno no avanzaba nunca.
- **Arreglo:** «listo» solo si lo de la punta puede ir a ese unidor.

**10. Clasificador con una sola salida filtrada a una rama que no lo recibe**
- **Archivo:** `js/cintas.js` (`salir`).
- **Síntoma:** en vivo la madera iba por la rama filtrada y en la punta «volvía al pueblo» (si venía de un campamento,
  pasaba al pueblo sin tope), en vez de seguir por «lo que sobre». Sin conexión iba por «lo que sobre»: vivo y sin
  conexión daban resultados distintos.
- **Arreglo:** el clasificador salta toda salida cuya rama no recibe el recurso, aunque sea la única de su grupo.

**11. Atasco permanente con un resto de paquete menor que 1**
- **Archivo:** `js/cintas.js` (`entregar`, `sacar`).
- **Causa:** `Lb.sacar` da hasta el total del pueblo, que antes de conciliar puede ser menor que el estante. Así salía
  un paquete de 15,5; al entregarlo por partes quedaba un 0,5 que nunca entraba («lleno» para siempre).
- **Arreglo:** una boca de bodega no saca si el pueblo tiene menos de un paquete, y un resto menor que 1 entra igual.

**12. Sin conexión, el margen de las bodegas y los descuentos se mezclaban entre orígenes**
- **Archivo:** `js/cintas.js` (`Ci.offline`).
- **Síntoma:** con el pueblo sobre el tope, la madera de un campamento entraba a una bodega gracias al margen de lo
  que salía de otra bodega. Además lo entregado se descontaba a todas las bocas de ese recurso en proporción: en el
  escenario, el campamento perdía 240 sin entregar nada.
- **Arreglo:** el flujo va por clave, `recurso` o `recurso|b` (lo que sale de una bodega).

- **Prueba de 9 a 12:** `colabtex/tests/prokingdoms.test.cjs`, «pk-77: cintas — …».

## b) Encontrados sin arreglar, o dudosos

- **Las tropas reales del atacante viajan a todos durante el asedio** (`server/sim.js`, `asediosDe` manda
  `units: c.units`). Con eso se puede estimar la fuerza que `asedioVista` esconde. Hay que decidir qué mostrar: el
  dibujo usa esas tropas.
- **La vista parcial todavía deja adivinar un quiebre:** la etapa en curso de un ataque que se quiebra trae su
  `c1/f1/dur` reales, más cortos. Esconderlo del todo cambiaría lo que dibujan los espectadores hasta el resultado.
- **El Mariscal y la misión `retirada_a_tiempo` no se disparan en línea antes de la última etapa:** en la vista
  parcial `atk = def`, así que el ímpetu es igual a la resistencia. Puede ser intencional («las barras bajan
  parejas»).
- **`cv`/`dv2` en el mar** (`js/mundo.js`): el cliente adopta la versión aunque el servidor no mande la Ciudadela ni
  el diario. No tiene efecto hoy, porque el viaje recarga la página y las versiones vuelven a −1.
- **Divisor sin conexión:** reparte en partes iguales sin mirar si una rama está llena. Lo de la rama llena no se
  entrega (no se pierde); en vivo iría a la otra rama. Ya está en CLAUDE.md como «split evenly».
- **`c.rr` compartido entre recursos y grupos de un clasificador o divisor:** reparto torcido por un rato, sin atasco.
- **`aceptaAbajo` en una red con ciclos** puede guardar un conjunto a medio armar hasta el próximo `rearmar`. No se
  reprodujo.
- **El Molino de tu tierra aparece en el armador de rutas como bodega fija:** el botón «Crear ruta» queda habilitado,
  pero la ruta siempre se rechaza con un aviso. Es de interfaz, no traba nada.
- **Una carga queda arriba de la carreta si se demuele la bodega fija de su ruta,** hasta que se borra la ruta.
  `Lb.fuera` la sigue contando, así que no se pierde. Las rutas fijas de antes ya hacían lo mismo.

## c) Resultado de las pruebas

- **`npm run test:juegos`:** antes de los cambios pasaban las 1405 pruebas. Después, ver el resultado final abajo.
- **Pruebas del servidor** (`tools/asedio-test.js`, `saqueo-test.js`, `diplo-test.js`, `mundo-test.js`,
  `regata-test.js`, `cheat-test.js`): todas pasan, antes y después. `asedio-test.js` tiene dos chequeos nuevos.
- **Navegador (Playwright):**
  - Todas las ventanas del menú abiertas en 1280×800, 390×844 y 915×412 con `?local&dev`, sin errores de consola.
  - Un `?timelapse` de unos 600 minutos de juego (hasta la Era IV, con 21 piezas de cinta y 22 rutas) con un vigilante
    de invariantes: nunca hubo NaN ni negativos en `S.res` ni en `inv`, `inb` u `outb`.
  - El armador de rutas con una sola bodega muestra «No hay a dónde llevar…» sin errores.

## d) Despliegue

**Hay que desplegar functions:** cambió `server/sim.js` (`aplicarRefuerzo`, la salida que no cobra si falla, la
Ciudadela) y `js/data.js` (`asedioReplan`, `asedioVista`), que el servidor también carga. El dueño debe correr
`firebase deploy --only functions` a mano. `D.PROTO` no cambió: un cliente nuevo con el servidor viejo, y al revés,
siguen funcionando.
