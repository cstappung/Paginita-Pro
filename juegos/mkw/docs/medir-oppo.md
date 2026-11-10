**Ya no se usa** (el dueño, 2026-10-31: «no necesitas medir el oppo»). Queda como registro; nada del plan espera esto.

# Medir la tarjeta de video en el Oppo (para el dueño)

**Para qué.** La gama media y la baja se simulan en este PC con un «lastre» de la tarjeta (`lastreGpu`, bitácora §155).
Hoy ese lastre está puesto a ojo. El Oppo dio en §115 unos 34 ms de tarjeta por imagen, pero con un medidor que también
cuenta otras cosas (`onSubmittedWorkDone`). Medida en la tarjeta misma, la gama media simulada da 1,2–1,5 ms (§164).
Una de las dos está mal, y solo el Oppo puede decir cuál. Con el número de verdad se recalibra `lastreGpu`
(H1/H2 del plan de rendimiento). **Esto lo tiene que hacer usted**: el Oppo es el único teléfono que tenemos.

Lleva unos 10 minutos.

## Antes (una vez): que Chrome no redondee las medidas

Chrome redondea las marcas de tiempo de la tarjeta a 0,1 ms, y las partes del dibujo de este juego duran 0,01–0,08 ms:
con el redondeo salen casi todas en 0 o en 0,1. En el PC se apaga con una bandera; en el teléfono se hace así:

1. En el Oppo, abra Chrome y escriba en la barra de direcciones: `chrome://flags/#enable-webgpu-developer-features`
2. En **«WebGPU Developer Features»** elija **Enabled**.
3. Apriete **Relaunch** (abajo): Chrome se reinicia.

(Si no aparece, siga igual: la medida sale redondeada pero sirve para saber si son ~1 ms o ~30 ms.)

## La medida

1. Abra el juego como siempre: el sitio → **Juegos** → **Mario Kart** → **▶ Jugar solo**. Teléfono **acostado**,
   sin otras apps abiertas. Mejor cargado o con más de 50 % de batería, porque con poca batería el teléfono frena.
2. Espere a que cargue y llegue al menú del juego.
3. Toque el engranaje **⚙** (arriba) → pestaña **Avanzado** → baje hasta **Diagnóstico** → toque
   **«🔬 Perfilar la tarjeta de video»**. La página se recarga sola.
4. Entre a una carrera: **Single Player → Grand Prix (o VS) → 150cc → cualquier personaje → la primera copa** (la
   primera pista, Luigi Circuit, es la que se mide en el PC). Corra **al menos 30 segundos** después de la largada. Los
   primeros 20 s el juego anota cuánto tarda cada parte del dibujo y puede ir un poco más lento: es normal.
5. Ponga pausa (o termine la carrera). Toque **⚙ → Avanzado → Diagnóstico → «📋 Copiar el informe de rendimiento»**.
   Debe decir «✓ Copiado».
6. **Pegue el texto en el chat** de la sesión. Si el botón dice «No se pudo copiar», mantenga el dedo sobre el texto
   que aparece abajo, elija **Seleccionar todo → Copiar** y péguelo.

Si puede, repita los pasos 3 a 6 una vez más (otra carrera), para tener dos medidas.

## Qué miro yo en el informe

- **`perfilTarjeta.tramoMs`** (desde §173): lo que tardó la tarjeta en cada imagen = el último fin menos el primer
  comienzo (la mediana). **Este es el número que vale en el teléfono**: en su tarjeta (de «mosaicos») las partes del
  dibujo se pisan y no se pueden sumar; `perfilTarjeta.mosaicos: true` lo confirma y `aviso` lo explica. El 30-10 dio
  ≈ 3 ms (leído a mano de `pasadasCaras`, `docs/datos-oppo-2026-10-30.json`).
- **`ultimos10s.cpuPuraMs`** (desde §173): la CPU pura del juego por cuadro. Sale sola con «Mostrar qué frena» (lo
  prende «🔬 Perfilar la tarjeta»): no hay que hacer nada aparte. Si `cpuPuraMs` está cerca de 16,7 o más y `tramoMs`
  es chico, frena la CPU; al revés, la tarjeta.
- `perfilTarjeta.msPorCuadro`: los ms de tarjeta por imagen sumando las pasadas (en el teléfono sale de más: ver arriba).
- `perfilTarjeta.pasadasCaras`: qué partes del dibujo cuestan más.
- Que la marca sin redondeo haya funcionado: si salen valores como 0,013 y no solo 0,0/0,1.

## Cómo se recalibra con ese número

En este PC la carrera cuesta **0,20 ms de tarjeta por imagen** (§164, `t164q-k1`), y el lastre multiplica ese tiempo
(con `lastreGpu=6`: 1,2–1,5 ms). Entonces:

- el lastre que imita al Oppo es **`lastreGpu` = ms del Oppo ÷ 0,20** (por ejemplo, 3 ms → 15; 34 ms → 170);
- la gama media y la baja se ponen por encima de ese número, en la misma proporción que hoy tienen entre sí (6 y 15);
- se vuelve a correr la escalera con la tarjeta (`esc164-*`) para ver si en algún escalón el techo pasa a ser la
  tarjeta en vez de la CPU.

Mientras no llegue el informe, esto queda en H1/H2 como **«falta el Oppo (el dueño)»**. No es un pendiente de N13.

---

# Lo demás que solo puede cerrar el Oppo (pasos 1 a 3 y 10 del plan)

Todo lo de abajo ya está hecho y medido en el PC (bitácora §177.4). Falta el número del teléfono. Si tiene poco
tiempo, haga solo la **parte A**: con un informe sirven V1, H1, H2, N2 y G5 a la vez.

## A. Un informe en Grand Prix o VS, 12 karts (cierra V1, H1, H2, N2 y G5)

Es la misma medida de arriba («La medida», pasos 1 a 6). En el informe que me pega, además de lo de la tarjeta, miro:

- **V1 (qué frena: el juego, la espera o la tarjeta):** `ultimos10s.cpuPuraMs` (el juego sin esperas),
  `perfilTarjeta.tramoMs` (la tarjeta) y `perfilTarjeta.pasadasCaras` (qué parte del dibujo). Con eso queda cerrado.
- **H1 y H2 (el aparato de mentira y el presupuesto):** la recalibración de arriba, y el `presupuesto` del informe con
  cada pieza contra su meta.
- **N2 (la línea base del Oppo):** los fps y los ms de esa carrera son el escalón «teléfono tope de gama» medido.
- **G5 (la forma de la vista):** el campo `vista` debe decir «16:9 fija». Si dice otra cosa, me avisa.

## B. Contrarreloj contra 12 karts (cierra U3)

Sirve para saber cuánto del cuadro es la base del juego y cuánto suman los 11 rivales. Hay que hacerlo dos veces,
una con el juego recién abierto (1.ª visita del día) y otra después (2.ª):

1. Single Player → **Time Trials** → 150cc → cualquier personaje → Luigi Circuit. Corra 30 segundos.
2. Pausa → ⚙ → Avanzado → Diagnóstico → **«📋 Copiar el informe de rendimiento»** y péguelo en el chat.
3. Lo mismo en **VS** (12 karts) en la misma pista. Péguelo también.
4. Cierre Chrome del todo y repita 1 a 3 (esa es la 2.ª visita).

En este PC la Contrarreloj cuesta 4,9 ms de CPU pura contra 6,6 con 12 karts (§157): unas 3/4 partes son la base.

## C. Las pruebas de cálculo en el teléfono (cierra R6, primera mitad, y el criterio 3 del paso 3)

Comprueban que el teléfono (un procesador ARM) hace las cuentas igual que el PC (x86). Si no, en una sala PC + teléfono
la carrera de cada uno se separaría. No llevan nada del juego: son páginas del banco.

1. En el PC, abra `jugar.bat suelto` (o `node web/navegador/servidor.mjs`). En el teléfono, con el cable USB y la
   depuración USB prendida, abra en el PC `chrome://inspect` → **Port forwarding** → agregue `8140` →
   `localhost:8140`. (Si no lo ha hecho nunca, me avisa y lo hacemos juntos.)
2. En el Chrome del teléfono abra `http://localhost:8140/banco/pruebas/paridad/index.html` y espere el resultado
   (✓/✗ arriba). Después `http://localhost:8140/banco/pruebas/fma/index.html`.
3. Mándeme una foto de cada resultado, o copie el texto.

## D. Una sala PC + Oppo (cierra R6)

Cuando C dé todo ✓: una sala del sitio con el PC y el Oppo (`?salasObra=0`, porque las salas están «en obra»), una copa
de 3 carreras. Si las carreras no se separan (el aviso 📶 «se separó» nunca sale), R6 está cerrado. Si sale, me pega
el registro de las dos (⚙ → Avanzado → Diagnóstico → copiar el registro).

En el PC ya se probó lo que se puede probar sin el teléfono: la misma carrera con una pestaña en 16:9 y la otra en
21:9, parada, con otra fluidez (120/180) y con otra escala (§177.3).

## E. ¿El teléfono da memoria compartida? ¿Y el juego en un Worker? (cierra H5 y la mitad del teléfono del paso 8)

Lo que el plan de hilos necesita saber del Oppo (bitácora §186–§189). Nada del juego en los pasos 1 y 2: son páginas del
banco. Toma unos 3 minutos.

1. Como en C: en el PC `jugar.bat suelto` (o `node web/navegador/servidor.mjs`) y en el PC `chrome://inspect` →
   **Port forwarding** → `8140` → `localhost:8140`, con el teléfono enchufado.
2. En el Chrome del teléfono abra `http://localhost:8140/banco/pruebas/aislamiento/index.html`. Espere la tabla (unos
   20 s: al final mide los núcleos) y apriete **«📋 Copiar el informe»**; péguemelo. La tabla dice, en cuatro columnas
   (sin cabecera, Document-Isolation-Policy, COOP/COEP y DIP puesta por un service worker), si queda aislado, si hay
   memoria compartida, si JSPI y WebGPU andan en un Worker, cuánto tarda en ir y volver una caja de 1 y 4 MB y cuántos
   núcleos calculan a la vez. Lo que busco: la fila «Memoria compartida» en la columna de Document-Isolation-Policy.
3. Después el juego mismo en un Worker (sí usa el juego, desde el PC): abra
   `http://localhost:8140/trabajador.html?modo=directa&pista=0.0&semilla=1234&cpu=maximo&soloCpu=1` y, cuando la
   carrera esté andando, anote los «img/s» del recuadro de arriba a la izquierda. Repita con `&hilo=principal` al final
   (el juego en la página, como hoy). Si con el Worker son iguales o más, el plan B anda en el teléfono.
4. Si en el paso 2 la columna Document-Isolation-Policy dice «sí» en memoria compartida: repita el paso 3 agregando
   `&aislar=dip` (el juego aislado, con memoria compartida).

## F. El ahorro de energía, el calor y las texturas comprimidas (cierra E1, E2 y la parte del teléfono de G6)

Del paso 15 (bitácora §190). Usa el juego, con el mismo arreglo de C (`jugar.bat suelto` en el PC y **Port forwarding**
`8140` → `localhost:8140`). Toma una copa entera.

1. **El calor (E2).** En el teléfono, sin funda y sin cargar, abra
   `http://localhost:8140/?modo=gp&copa=0&cpu=maximo&calor=1` (el Grand Prix de la primera copa) y corra la copa entera (4 carreras, unos 12 min)
   sin pausas. Si aparece en la esquina «🌡️ El teléfono se está calentando…», anote en qué carrera. Al terminar, en
   Avanzado → Diagnóstico apriete «📋 Copiar el informe de rendimiento» y péguemelo: el campo `energia.calorMinutos`
   trae los ms por cuadro de cada minuto de carrera (si suben con los minutos, el teléfono se calentó y frenó).
2. **El ahorro de energía (E1).** En el teléfono, prenda el «Ahorro de batería» de Android (o deje la batería bajo 20 %) y
   abra `http://localhost:8140/?modo=directa&pista=0.0&cpu=maximo&ahorro=1`. Si Chrome baja la pantalla a 30, en ~5 s de
   carrera tiene que salir «🔋 Chrome está ahorrando batería…». Diga si salió (y si el juego se veía a 30). Lo mismo en un
   portátil con batería y el «Ahorro de energía» de Chrome prendido (Configuración → Rendimiento), si tiene uno a mano.
3. **Las texturas comprimidas (G6).** Abra `http://localhost:8140/?modo=directa&pista=0.0&cpu=maximo&texturasBc=1`, y en la
   carrera copie el informe de rendimiento: el campo `texturasBc` dice cuántas texturas subieron comprimidas. Espero
   `bc: 0` en el teléfono (las tarjetas de teléfono no traen el formato BC de los PC, sino ETC2/ASTC): si sale más de 0, el
   Oppo sí lo tiene y conviene medirlo como en el PC.
4. **Los pipelines en la carrera (G4, la parte barata).** Las 64 compilaciones en plena carrera del 30-10 (§173) eran
   todas «de fondo» (el dibujo se salta hasta que llegan; 0 armadas de golpe) y venían casi todas juntas (57 en el
   segundo 98), con la semilla vieja (`pipelines.bin` del 18-10, hecha solo con los menús). Con la semilla por pista
   (`pipelines-c2.bin`, §174) en este PC quedan **3** en la carrera y en la gama baja simulada **1** (§190). Para
   confirmarlo en el teléfono hace falta una **visita nueva** (Chrome → Configuración del sitio → borrar los datos de
   `localhost:8140`) con `http://localhost:8140/?modo=directa&pista=13.2&cpu=maximo&pipelines=pipelines-c2.bin&bloques=bloques-d9.json`
   y el informe de rendimiento al terminar la carrera: en `porSegundo`, los `pip` durante la carrera (antes 57 + 3 + 2 + 1 + 1).
