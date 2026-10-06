# Antitrampas en los juegos individuales

Hay gente que mete récords falsos en las tablas del Solo Club (y, con eso,
cobra monedas de récord, de podio y de partidas del club). Este documento
dice **por dónde se cuelan**, **qué se hace contra eso** y **cómo se reparte
el trabajo juego a juego**. El detalle de cada juego vive en
`docs/antitrampas/<juego>.md`.

## 1. Por dónde se cuela una trampa hoy

Un récord del club recorre este camino:

```
juego (iframe)  ──Club.result({categoria, puntos, tiempo})──▶  conexion.js
   ──postMessage──▶  solo/club.js (crearSolo)  ──resultadoClub()──▶  pendientes (localStorage)
   ──guardaConPodio──▶  soloRanks/<cat>/<uid>   (+ podios, clubJugadas, logros, Discord)
```

Lo único que se comprobaba era la **forma** del dato (`resultadoClub`: que
la categoría exista, que los puntos sean enteros, topes generosos) y, en
las reglas, que la marca mejore la anterior. Nada miraba si esa partida
existió. Las vías, de la más fácil a la más difícil:

| # | Vía | Esfuerzo | Ejemplo |
|---|-----|----------|---------|
| 1 | **`Club.result` desde la consola** del iframe | una línea | `Club.result({categoria:'club-sortem-10',puntos:10,tiempo:1})` |
| 2 | **Editar `localStorage`**: `jg.club.pendientes.<uid>.<juego>` (sube solo al abrir el juego), o el progreso/racha del juego | un minuto | racha de la Sopa de 400 días, Atasco con 720 ★ |
| 3 | **Tocar el estado del juego** desde la consola: variables globales, `window.__fanal.salta(13)`, el reloj | minutos | FANAL «terminado» sin jugar, minas con el tiempo congelado |
| 4 | **Acelerar o frenar el reloj** (`performance.now`, `requestAnimationFrame`, pausar con el depurador) | minutos | sortEm en 0,8 s, Sprint de Tetris en 5 s |
| 5 | **Escribir en Firebase a mano** con el SDK, saltándose la página | saber un poco | cualquier fila de `soloRanks` |
| 6 | **Un bot** que juega de verdad (resuelve el sudoku, la sopa, el atasco) | programar | marcas perfectas pero humanamente imposibles |

Las vías 1–4 son las que importan: no piden saber nada y son las que se ven
en las tablas. La 5 deja rastro, y la 6 solo se ataca con verosimilitud.

**Datos reales.** El plan se escribió sin ver la base: desde la sesión en
la nube no hay salida a `*.firebaseio.com`, y leer `soloRanks` pide sesión.
Para identificar a los tramposos que ya están en las tablas hay que
exportar `soloRanks` (y, si existe, `soloPruebas`) desde la consola
(Realtime Database → nodo → ⋮ → *Exportar JSON*) y pasarlo por
`node colabtex/scripts/auditar-club.cjs export.json` (ver §5). **La
exportación no se sube al repositorio**, que es público: trae nombres y uids.

## 2. La idea: un récord no se cree, se comprueba

Es lo mismo que ya hace el sitio con las monedas («la economía se deriva,
no se guarda»): **cada resultado viaja con una prueba** —lo que hace falta
para rehacer la partida: la semilla, las jugadas con su instante— y **el
verificador del juego la rehace con el mismo motor puro** antes de guardar
nada. Si no cuadra, la partida **se rechaza en el acto**: no entra en la
tabla, no paga monedas, no da logros, el juego lo dice en pantalla y queda
un aviso en `sospechas/<uid>` para los administradores.

Capas, de dentro hacia fuera:

1. **Prueba de partida (por juego).** El juego registra lo mínimo para
   rehacerla y lo manda con `Club.result(dato, prueba)`. El verificador
   (`colabtex/src/juegos/solo/verifica/<juego>.js`) la rehace y compara
   puntos y tiempo. Esto mata las vías 1, 2 y 3: un número suelto ya no
   basta, hay que fabricar una partida entera que el motor acepte.
2. **Verosimilitud humana (por juego).** Dentro de una partida válida,
   límites de lo que una persona puede hacer: tiempo mínimo entre jugadas,
   jugadas por segundo, tiempos por debajo del récord mundial del género,
   el tiempo declarado contra el que dicen las marcas de tiempo. Esto
   frena la vía 4 y parte de la 6.
3. **La prueba se guarda** (`soloPruebas/<cat>/<uid>/<partida>`), y **las
   reglas no aceptan una fila de `soloRanks` sin su prueba**. Quien escriba
   a mano (vía 5) tiene que dejar también una prueba, y esa se puede
   auditar después con el mismo verificador.
4. **Lo pendiente se re-verifica.** Lo que espera en `localStorage` para
   subir pasa otra vez por el verificador al cargarse (vía 2).
5. **Moderación.** Un administrador (`admins/<uid>`) puede **borrar una
   fila** de `soloRanks` o de `soloPruebas`, y **vetar una cuenta**
   (`vetados/<uid>`): una cuenta vetada no escribe récords, ni partidas del
   club, ni podios, y no aparece en ninguna tabla. Borrar la fila también
   anula, sola, la moneda de récord y los podios que salían de ella
   (`podioValido` exige que las dos filas existan).

### Límite honesto

Todo corre en el navegador de quien juega. Alguien que reescriba el
cliente puede saltarse la verificación en vivo, y un bot puede fabricar una
prueba válida jugando él. Lo primero queda **auditable y borrable** (capa
3); lo segundo solo lo frena la verosimilitud (capa 2). Cerrarlo del todo
exige un servidor que verifique antes de escribir: una Cloud Function que
reciba la prueba, la rehaga y sea la única que puede escribir en
`soloRanks` (plan Blaze de Firebase). El diseño de aquí ya deja eso a un
paso: el verificador es un módulo puro que corre igual en Node.

## 3. El contrato (lo que ya está hecho, común a todos)

- `juegos/club/conexion.js` (`?v=club-11`): `Club.result(dato, prueba)` manda
  la prueba; si la página rechaza la partida, el panel lo dice y el juego
  recibe el evento `club-rechazo` (`{categoria, partida, motivo}`).
  `window.Club` está congelado.
- `colabtex/src/juegos/solo/verifica.js`: el registro. `verificaClub(juego,
  dato, prueba)` devuelve `null` si vale o el motivo; nunca lanza (un
  verificador que falla **rechaza**). Rechaza una prueba de más de
  `PRUEBA_MAX` (200 000 caracteres de JSON) y, si el juego ya declara
  `PRUEBA > 0`, un resultado sin prueba.
- `colabtex/src/juegos/solo/verifica/<juego>.js`, uno por juego:

  ```js
  export const PRUEBA = 0;                    // versión de la prueba; 0 = aún no la exige
  export function verifica(dato, prueba) {}   // null | 'motivo'  (puede ser async)
  export function sospecha(categoria, fila) {}// null | 'motivo'  (fila guardada, sin prueba)
  ```

  Los doce ya están llenos y todos declaran `PRUEBA = 1`: exigen la prueba
  (Metro Rush llegó el último, ver `docs/antitrampas/metrorush.md`).
- `solo/club.js`: verifica antes de guardar, de pagar (`alResultado`) y de
  dar logros; re-verifica lo pendiente; avisa con `reportaSospecha`.
- `juegos-main.js` (`guardaClub`): escribe la prueba y después la fila;
  solo si mejora la marca guardada (una prueba por récord, no por partida).
- `fb-juegos.js`: `guardarPruebaSolo`, `leerPruebaSolo`, `reportaSospecha`,
  y `watchSolo`/`leerSolo` ya no muestran cuentas vetadas.
- Reglas: `rachasClub` (la racha contada, ver §4), `soloPruebas` (escribe su dueño, una vez; lee cualquiera con
  sesión, para poder auditar), `sospechas` (escribe su dueño, una vez; lee
  solo un admin), `vetados` (escribe solo un admin), `soloRanks` exige la
  prueba y deja borrar a un admin. **Hay que publicarlas a mano** en la
  consola. Hasta entonces todo sigue funcionando como antes (la prueba
  falla con `PERMISSION_DENIED` y la fila se escribe igual con las reglas
  viejas), salvo la verificación en vivo, que ya rechaza.
- `colabtex/scripts/auditar-club.cjs`: la auditoría de una exportación.

## 4. Juego a juego

Cada juego tiene su agente y su archivo `docs/antitrampas/<juego>.md`. Lo
que se espera de cada uno:

1. **Leer el juego** y escribir sus vías concretas de trampa.
2. **Emitir la prueba**: la semilla (si el juego usaba `Math.random`, pasar
   a un generador con semilla que el verificador pueda repetir) y las
   jugadas con su instante, en el formato más compacto razonable.
3. **Verificar**: rehacer la partida con el motor puro (si no hay motor
   puro, extraerlo: es lo que permite verificar en Node) y comparar puntos
   y tiempo; luego los límites humanos.
4. **`sospecha()`**: umbrales para lo que ya está guardado sin prueba,
   apoyados en récords conocidos del género, no inventados.
5. **Pruebas** en `colabtex/tests/antitrampas-<juego>.test.cjs`: partidas
   reales de robot que pasan, y trampas de cada vía que se rechazan.
6. Subir `PRUEBA` a 1 cuando el juego ya emite la prueba.

| Juego | Categorías | Qué se puede rehacer | Dificultad |
|---|---|---|---|
| Mina Club | `club-minas-*` (tiempo) | semilla + clics con instante | baja |
| Snake Club | `club-snake-*` (puntos) | semilla + giros por tic | media |
| Tetris Club | `club-tetris-*` | semilla (el motor ya es puro) + entradas | media |
| Sopa de letras | `club-sopa-*` (tiempo, racha) | tablero de la semilla + selecciones; la racha | baja |
| Sudoku Arcade | `club-sudoku-*` | tablero de la semilla + dígitos; el arcade se recalcula | baja |
| Atasco | `club-atasco-estrellas` | los movimientos de cada nivel (motor y solver ya puros) | baja |
| Electrodle | `club-electro-*` | los intentos de cada modo; el blanco sale de la fecha | media |
| sortEm | `club-sortem-*` (tiempo) | el reparto + cada movimiento | media |
| BBTAN | `club-bbtan-rondas` | semilla + ángulo de cada tiro (física determinista) | alta |
| FANAL | `club-fanal-*` | tiempo real: verosimilitud y reloj, más que repetición | alta |
| Frontera | `club-frontera-*` | semilla + elecciones (el simulador ya es determinista) | alta |
| Metro Rush | `club-metrorush-*` | tiempo real: la pista de la semilla, los objetos que suben el multiplicador, los metros contra la velocidad y el reloj | alta |

Las **rachas** (Sopa, Sudoku, Electrodle) son un caso aparte: el número
sale de un blob que el propio usuario escribe (`users/<uid>/club/<juego>`).
Ya están resueltas de forma común, como el `diario` de las monedas:
`rachasClub/<uid>/<categoría>` = `{dia, n, at}` solo sube de a uno por día
de Chile (la regla lo comprueba; un día saltado vuelve a 1), y la fila de
`club-*-racha` no puede pasar de `n` (`guardaClub` la recorta;
`club-datos.js: rachaClub`). Quien ya tenía una racha en la tabla la sigue
desde ahí al estrenarlo. El verificador de cada juego solo tiene que
probar que el diario de hoy se resolvió de verdad.

## 5. Qué hacer con los que ya están en las tablas

**Lo corto: el panel de administración** (`juegos.html#admin`, pestaña
*Auditoría*). Hace lo mismo que el script de abajo contra la base viva, sin
exportar nada: las señales sin bajar ninguna prueba (la tabla ya está en
memoria), y después, con un botón, verifica solo las pruebas que nadie
auditó todavía (el veredicto queda en `auditados`). Cada fila se elimina o
se marca como buena con un clic. Los récords que suben al podio llegan
además a la pestaña *Récords*, con su repetición en Tetris, Snake, sortEm
y el buscaminas. Las señales viven en `src/juegos/admin-datos.js` y el
script las usa también, así que los dos nunca discrepan.

Lo de siempre, por consola:

1. Exportar `soloRanks` (y `soloPruebas`, `sospechas`, `vetados`) desde la
   consola, a un archivo fuera del repositorio o en `auditoria/` (ignorada).
2. `cd colabtex && node scripts/auditar-club.cjs ../auditoria/export.json`.
   Lista, por cuenta, cada fila sospechosa y por qué. Las señales más
   fuertes: una `partida` que no es un UUID (escrita fuera del juego), y
   las marcas imposibles.
3. Revisar a mano y, en la consola: borrar la fila
   (`soloRanks/<cat>/<uid>`) y, si es reincidente, vetar
   (`vetados/<uid>` = `{at: <ahora>, m: "motivo"}`).

## 6. El castigo: pantallazo azul y diez minutos fuera

Rechazar la marca deja fuera de la tabla al que hace trampa, pero no le
cuesta nada intentarlo otra vez. Por eso, además del aviso en `sospechas`,
quien manda una partida trucada se lleva un castigo
(`colabtex/src/juegos/castigo.js`, archivos en `juegos/castigo/`):

1. **Pantallazo azul.** Una pantalla azul de Windows 10 de mentira a pantalla
   completa (`bsod.png`) con su zumbido (`bsod.mp3`), durante
   `PANTALLAZO_MS` (10 s). El teclado no responde y el juego del club que
   estaba abierto se desmonta (deja de sonar).
2. **«WASTED».** Suena el de GTA (`wasted.mp3`) y la pantalla pasa a negro
   con el letrero.
3. **Retención.** `RETENCION_MS` (10 min) con una capa que tapa todo
   Juegos y la cuenta atrás. Mientras dura, `render()` en `juegos-main.js`
   no monta nada debajo (`castigoActivo`). Al terminar, la capa se quita y
   la página vuelve a montar lo que diga la ruta, sin recargar.

**Qué castiga** (`esTrampa`). Solo una partida **recién jugada** que el
verificador rechazó (`vivo`, que pasan `solo/club.js` para lo que llega
«en vivo» y `frontera.js` para la victoria que se acaba de ganar). No
castiga:

- un pendiente de `localStorage` que se vuelve a verificar al cargar, ni la
  marca o el libro de victorias de la Frontera que se re-verifican al
  entrar: pudieron jugarse con otra versión del motor;
- un verificador que falló («No se pudo comprobar…»);
- una prueba que no cabe («demasiado grande»): una partida larguísima no
  es trampa.

Una partida que llega **sin prueba** sí castiga: es la firma de
`Club.result` desde la consola, y desde que el iframe se carga con
`?v=club-37` (Metro Rush, el último en estrenar su prueba) ninguna versión actual del juego la manda así.

**Dónde vive la retención**, y por qué en dos sitios:

- `users/<uid>/castigo` = `{at}` con la hora **del servidor**. Para una
  cuenta es la verdad: termina en `at + RETENCION_MS` medido con
  `fb.ahora()` (el reloj corregido con `.info/serverTimeOffset`), así que
  adelantar el reloj del aparato no la acorta: cuando llega la corrección
  (`seguirReloj(alCambiar)`) se vuelve a mirar. Se escucha en vivo
  (`watchCastigo`), así que llega a las demás pestañas y aparatos de la
  cuenta. `users/<uid>` ya es solo del dueño: **no hace falta publicar
  reglas nuevas**.
- `localStorage` `jg.castigo` = `{h, u}`. Tapa desde el primer momento al
  recargar, antes de que se sepa quién es; vale para un invitado (salir de
  la cuenta no lo esquiva) y cubre una escritura en la cuenta que falló.
  Lleva el uid castigado: en un computador compartido, **otra cuenta no
  hereda el castigo**, y al invitado la capa le ofrece «¿No eres tú? Entra
  con tu cuenta». No se borra al parecer vencido (el reloj del aparato
  puede mentir); simplemente deja de valer.

**El límite honesto.** Los dos registros son del propio jugador: quien sabe
abrir la consola puede borrarlos. Pero tiene que darse cuenta, y su marca
igualmente no subió: el castigo es la parte que disuade, el rechazo es la
que protege la tabla. `tests/castigo.test.cjs` cubre qué cuenta como
trampa, de quién es la retención, el recorrido entero con el reloj en la
mano y que esté conectado donde se rechaza una partida.

## Cuentas paradas: los cortes

Borrar récords falsos baja lo ganado hacia atrás. El recorrido de
`economia()` (juegos/monedas.js) encuentra entonces compras de PRODROP o de
la tienda que nunca se pudieron pagar y **para** la cuenta: esa compra y todo
lo que compró después no vale, no puede vender ni intercambiar, y todo lo que
gane desde ahí se va a tapar el hueco, porque lo ganado no tiene fecha y se
mide entero contra el pasado.

Un **corte** (`colabtex/src/juegos/cortes.js`) lo arregla sin deuda:
`<uid>: {hasta, tope}`. Hasta `hasta`, la cuenta gasta contra `tope` (lo que
ganaba al limpiarla, o menos si después se borra algo más) y una compra que
no alcanzaba **se anula sin parar la cuenta**: el sobre no existe, la
graduación no se hizo, la compra en el mercado se cae y la carta se queda
con quien vendía. Desde `hasta`, lo que gana es suyo y se mide normal. Es lo
mismo que anular una a una, en orden, las compras impagas (se comprobó con
los datos reales: 2 073 compras anuladas dan el mismo estado que dos cortes).

Va en el código, no en Firebase: no cuesta descargas ni reglas. Después de
una limpieza:

```
cd colabtex
node scripts/cortes.cjs ../auditoria/export.json            # mira qué pasaría
node scripts/cortes.cjs ../auditoria/export.json --escribe  # lo agrega a cortes.js
npm run build
```

`--hasta AAAA-MM-DD` (o `AAAA-MM-DDTHH:MM`, hora de Chile) fija el final del corte (por omisión, el fin de mañana).
`--desde AAAA-MM-DDTHH:MM` perdona lo comprado antes de esa hora: vale entero
aunque no alcanzara, el saldo queda en cero, y solo se anula lo de después.
Tiene que caer **después** de la última compra impaga de la cuenta; desde
ahí lo que gane se mide normal. Si siguió comprando sin fondos después, el
script lo dice (la cuenta seguiría parada) y hay que correr el corte.
