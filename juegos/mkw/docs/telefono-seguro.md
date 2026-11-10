# Medir en tu teléfono sin dejarle nada (`herramientas/telefono-seguro.mjs`)

Pedido del dueño (2026-11-07): probar el juego en un teléfono Android de verdad por el cable USB, sin dejar trazas
ni tocar nada vital. Prueba sin teléfono: `node herramientas/prueba-telefono-seguro.mjs` (22 puntos).

## Lo que hace y lo que no puede hacer

| Protección | Qué asegura |
|---|---|
| Lista blanca de órdenes | Solo 9 órdenes, palabra por palabra: los dos túneles del cable y leer (apps instaladas, ajustes, modelo, batería). Instalar, copiar archivos, borrar, reiniciar o cambiar un ajuste se rechaza **en el PC**, antes de llegar al teléfono. Cada orden queda en `build/web/datos/telefono/<fecha>/registro.txt`. |
| Pestaña de incógnito aparte | Todo lo que el juego guarda (caché, partida, historial) vive en esa pestaña y Chrome lo borra al cerrarla. Si tu Chrome no deja abrirla, el programa se detiene en vez de usar tu Chrome normal. |
| Limpieza garantizada | Con error, Ctrl+C o calor: se cierra la pestaña y se quitan los túneles. Tus pestañas y tu Chrome no se cierran. |
| Foto antes y después | Compara las apps instaladas y los ajustes del sistema y avisa si algo cambió. |
| Vigía del calor | Corta a los 42 °C de batería. |

Es como medir un circuito con una punta de osciloscopio de alta impedancia: se mira sin cargar el circuito, y al
sacar la punta el circuito queda igual que antes.

## Pasos

1. Bajar **platform-tools** de Google (el `adb` oficial): https://developer.android.com/tools/releases/platform-tools,
   descomprimir y poner su carpeta en el PATH o en `TELEFONO_ADB=ruta\adb.exe`.
2. En el teléfono: Ajustes → Acerca del teléfono → tocar 7 veces «Número de compilación»; en Opciones de desarrollador,
   prender «Depuración USB». Conectar el cable y aceptar «¿Permitir depuración USB?» solo para este PC.
3. Abrir Chrome en el teléfono.
4. `node herramientas/telefono-seguro.mjs revisar` (solo lee: modelo, cuántas apps, temperatura).
5. En otra consola `node web/navegador/servidor.mjs`; después
   `node herramientas/telefono-seguro.mjs abrir --ruta "/?modo=directa&pista=0.0&soloCpu=1" --segundos 90`.
   Al final dice «✓ el teléfono quedó igual que antes» y guarda en la carpeta de la corrida el informe de rendimiento
   (`resultado.json`: el informe del juego, una muestra cada 10 s en `historial`, los mensajes de la consola en
   `consola`) y una foto de la pestaña cada 30 s (`foto-000s.png`, …). La pestaña pasa sola al frente de la pantalla
   con el tamaño real del teléfono y el medidor de fps prendido (solo en esa pestaña; `--sin-fps` = sin medidor).
   Si una corrida se cortó a la fuerza: `node herramientas/telefono-seguro.mjs limpiar` quita los túneles del cable.
6. Al terminar: apagar «Depuración USB» (y, si quieres, «Revocar autorizaciones de depuración USB»).

## Trampas encontradas con el Oppo (2026-11-07)

- **Chrome de Android no deja abrir pestañas como en el PC**: Playwright, al abrir una, pide cambiar el tamaño de la
  ventana (`Browser.setWindowBounds`) y Chrome móvil lo rechaza. Se abre con `Target.createTarget` dentro del
  contexto de incógnito y **ya con la dirección del juego**: si se navega después, Chrome cambia la pestaña por otra y
  se pierde el hilo («Frame has been detached»).
- **Sin `viewport: null` el juego sale deformado**: Playwright finge una pantalla de 1280×720.
- **Chrome tiene que estar abierto** en el teléfono: sin eso la puerta de DevTools no contesta («socket hang up»).
- **Lo que mueve tu mano no es un cambio nuestro**: girar la pantalla, el volumen, el modo oscuro con la pantalla
  apagada y el ahorro de energía (y el propio teléfono: su frecuencia adaptable de pantalla «adfr» y su control de calor) cambian ajustes mientras se juega; la foto de después los separa de los nuestros
  (ninguna orden de la lista blanca puede escribir un ajuste).

## Lo medido en el Oppo Find X9 Pro (2026-11-07, Luigi Circuit, 12 CPU en máximo)

| Corrida | Imágenes/s | Lógica/s | Procesador por cuadro | Notas |
|---|---|---|---|---|
| Sin N8 (programa `build/web`), primera | ~30 | ~47 | ~31 ms | el teléfono iba más lento esa vez |
| Sin N8, más tarde | ~45–55 (sube y baja) | ~59 | ~19–25 ms | la tarjeta: **3,4 ms por imagen** (`perfilGpu=1`, `tramoMs`) |
| N8 modo 1, «30 parejas» (`build/web-n8`) | 30 fijos | 60 | ~23 ms | «se ve bien» (el dueño) |
| N8 modo 2, con la imagen del medio (`build/web-e6`) | ~53 a la vista | 60 | ~30 ms | 57 pasadas por cuadro en vez de 28 |

- Lo que frena es **el procesador**: la tarjeta trabaja 3,4 ms. El teléfono cambia de velocidad entre corridas
  (su gestor de energía y calor): comparar siempre intercalando.
- **`build/web` no trae N8**: `?n8=` no hace nada ahí; N8 está en `build/web-n8` y `build/web-e6`
  (`MKW_BUILD=build/web-e6/navegador node web/navegador/servidor.mjs 8141`).
- **El parpadeo negro lo causaba la herramienta, no el juego.** La foto por DevTools (`Page.captureScreenshot`, cada
  30 s) cambia un instante el alto de la ventana en 1 píxel (267 ↔ 268); el lienzo se rehace (2128 ↔ 2135 de ancho) y
  el navegador lo deja en negro hasta el próximo dibujo. Lo encontró el vigía del lienzo (`vigiaLienzo` en el informe:
  cada cambio de tamaño con su hora): los cambios caían en los segundos 30, 60 y 90 de la herramienta, justo con los
  parpadeos que vio el dueño. Sin fotos, 0 cambios en la carrera. Por eso las fotos ahora van solo con `--fotos`.
  Descartado antes: las recetas de dibujo (con `?pipelines=sincronico` 0 dibujos saltados y seguía), los anillos
  (`?anillo=0`, seguía) y N8 (el programa `build/web` no lo trae y seguía).
- Calor: la batería no pasó de 33,6 °C en 2 min.

## Calibración: tu Oppo contra los aparatos simulados del PC (tramo fijo sin tope, 2026-11-07)

`?modo=directa&pista=0.0&soloCpu=1&cpu=maximo&semilla=1234&sinTope=1&tramo=600-2400` (solo para medir: la lógica del
juego va siempre a 60). Cuadros de lógica por segundo, el techo del procesador:

| Aparato | Lógica/s | ms por cuadro |
|---|---|---|
| Este PC | 133–149 | ~7 |
| **Oppo Find X9 Pro** | **~108** (100–115) | **~9,3** |
| PC típico simulado (`lastre=2.2`) | 91–93 | ~10,8 |
| Portátil simulado (`lastre=3&ladron=64`) | 46 | ~21 |
| Teléfono gama media simulado (`lastre=4…`) | 32 | ~31 |
| Teléfono gama baja simulado (`lastre=7…`) | 20 | ~50 |

El Oppo (gama alta) equivale a **`lastre` ≈ 1,7**; la gama media simulada es ~3,4 veces más lenta que él. Los del PC
son de la escalera de E6 (`build/web/datos/medir-sitio/e6-*-tramo.json`).

## Más del 2026-11-07

- **Toques:** con «30 parejas», 32 s tocando botones y stick: la lógica siguió en 60 salvo un segundo a 49,6 (el
  primer toque). El «lag al apretar» no se ve en la lógica; falta medir la demora del toque a la imagen.
- **Caída (error conocido, no se repitió):** una vez, en `?modo=vs&copa=0&fila=0&cpu=maximo&n8=1` con `build/web-e6`,
  al cargar la carrera: «Memory access violation at 0x7E685400 … no mapped region», entrada `func_800060A4`. Repetido en
  el teléfono, en el PC y en el PC como teléfono: sin caída.
- **Vibración:** un crítico propuso rediseñarla (pulsos de 12 ms imperceptibles, traqueteo de 5–10 Hz, costuras cada
  100 ms): niveles con histéresis, patrones de `navigator.vibrate` renovados cada ~450 ms, golpes de 60 ms, topes de
  energía; `?vibracion=niveles|pulsos|vieja`. Sin hacer todavía.
