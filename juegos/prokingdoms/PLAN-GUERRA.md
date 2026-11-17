# Pro Kingdoms: plan de la mega actualización «Estandartes de Guerra»

- **Fecha:** 16 de noviembre de 2026.
- **Versión evaluada:** `pk-54`, en modo local.
- **Base:** la lectura del código de `js/`, `server/` y `functions/`, los planes anteriores y sus notas, y una partida
  del piloto (`?local&timelapse`) con una campaña de conquista lanzada a mano para mirarla en pantalla (sección 0).
  No es una partida jugada a mano de principio a fin: las notas de la tabla salen de eso y hay que leerlas así.
- **Para qué sirve:** es la guía para implementar la actualización por partes, igual que los dos planes anteriores.
  Cada fase es una entrega aparte (una versión `pk-N`). Para pedirla basta con decir «implementa la Fase G1 del plan
  de guerra».
- **Lo que no cambia:** las reglas de la sección 1 de `PLAN-MEGA-ACTUALIZACION.md` y las de `CLAUDE.md` de esta
  carpeta valen para todas las fases. La sección 11 de este plan agrega las propias.

- **Avance (16 de noviembre de 2026):** G1, G2 y G3 salieron en `pk-60`, la misma versión que integra la red de
  cintas (`pk-56` a `pk-59`); los números `pk-N` que siguen en este documento ya no valen, cada fase toma el que toque.
  - **G1 y G2:** hechas. La tabla de la sección 1 no se movió; recargar a mitad de un asedio lo retoma con el mismo
    plan y volver una hora después da el final que el plan decía. Diferencia con el texto: un tanteo perdido sigue
    costando el 15 % fijo del ejército. El piloto reclama hacia el vecino pero en 311 minutos no llegó a una frontera.
  - **G3:** hecha en el servidor y el cliente, probada con tres navegadores contra el servidor local y con
    `tools/asedio-test.js`. Falta `firebase deploy --only functions` para que valga en el mundo real. Diferencias
    con el texto: no se subió `D.PROTO` (las dos versiones conviven, así nadie queda afuera entre la publicación y
    el despliegue); no se hizo `guarn` (la mezcla real de tropas del defensor en la etapa 3); mientras el final no se
    conoce, las dos barras bajan parejas; `functions` `npm run prueba` no se corrió (pide el emulador).
  - **G4:** hecha en `pk-61`, en local y en el servidor (misma función, `D.asedioReplan`): táctica al lanzar y un
    cambio, refuerzos, retirada, oficio de las tropas, salida y rendición. Probada en navegador (local y con tres
    jugadores) y con `tools/asedio-test.js`. Diferencias con el texto: el cerco le quita un 10 % a la etapa de la
    frontera (en vez de un 15 % a la milicia); no se hizo «pedir ayuda» a los aliados; la columna de refuerzos y la
    retirada no tienen dibujo propio (sale un cartel sobre la batalla); el oficio es una ventaja leve para huestes
    con especialistas, no un reparto neutro. Necesita `firebase deploy --only functions` (ruta nueva `/api/asedio`).
  - **G5:** hecha en `pk-62` (que además integra la Fase C3 de cintas de la rama principal). `D.PROTO` subió a 11:
    hay que publicar y desplegar la función juntos. Comarcas con cinco rasgos (Vega, Bosque viejo, Cantera vieja,
    Cerro, Santuario), Fuerte fronterizo, ariete y torre de asedio, regla del Asesor. Diferencias con el texto: no se
    hizo el rasgo «Cruce»; el Cerro no da alcance extra a las torres en vivo; las máquinas se dibujan como un carro
    (no tienen modelo propio en `vehiculos.js`) y el Fuerte no es todavía la pieza de la etapa 2 en el dibujo; la
    torre de asedio quita 5 puntos de bajas al asedio entero; no se corrió el piloto antes y después.
  - **G6:** hecha en `pk-63`, solo cliente. Fortalezas (hasta 8, según el mapa) que se sitian con el mismo asedio,
    dan tributo diario y un bono a elección, y hay que defender cada 3 a 5 días; la hueste de un tanteo se ve marchar
    y se le puede pagar tributo. Diferencias con el texto: las fortalezas no son lugares de `W.pois` (módulo aparte,
    sin tocar el despeje ni su prueba) y usan el dibujo del Fuerte; no cuentan los héroes; no hay «pedir ayuda» ni
    tanteos decididos por el servidor en línea; no se hizo el capítulo de la Crónica «La Marca del Norte».
  - Sigue G7 (la guerra del mundo: Ciudadela y gremios, servidor).

---

## Índice

0. [Resumen y evaluación](#0-resumen-y-evaluación)
1. [Cómo funciona hoy la conquista](#1-cómo-funciona-hoy-la-conquista)
2. [Las decisiones de fondo](#2-las-decisiones-de-fondo)
3. [Fase G1: el asedio por etapas](#3-fase-g1-el-asedio-por-etapas-pk-55)
4. [Fase G2: la batalla a la vista](#4-fase-g2-la-batalla-a-la-vista-pk-56)
5. [Fase G3: asedios entre jugadores](#5-fase-g3-asedios-entre-jugadores-pk-57-servidor)
6. [Fase G4: decisiones durante el asedio](#6-fase-g4-decisiones-durante-el-asedio-pk-58)
7. [Fase G5: motivos para pelear](#7-fase-g5-motivos-para-pelear-pk-59-servidor)
8. [Fase G6: fortalezas y amenazas visibles](#8-fase-g6-fortalezas-y-amenazas-visibles-pk-60)
9. [Fase G7: la guerra del mundo](#9-fase-g7-la-guerra-del-mundo-pk-61-servidor)
10. [Fase G8: contenido de cierre](#10-fase-g8-contenido-de-cierre-pk-62)
11. [Reglas y trampas de este plan](#11-reglas-y-trampas-de-este-plan)
12. [Decisiones que debe tomar el dueño](#12-decisiones-que-debe-tomar-el-dueño)
13. [Tamaño y orden](#13-tamaño-y-orden)

---

## 0. Resumen y evaluación

### Dónde estamos

Las notas «antes» son las de `pk-10` (plan «Héroes y Fronteras»). Las de hoy salen de leer `pk-54`.

| Aspecto | `pk-10` | Hoy | Meta | Fase que lo mueve |
|---|---|---|---|---|
| Automatización | 6 | 8 | 8,5 | G8 |
| Entretención | 6 | 8 | 9 | G2, G4, G6 |
| Aventura | 5 | 8,5 | 9 | G6 |
| Gráficos y ambientación | 8 | 9 | 9,5 | G2 |
| Economía y estrategia | 7 | 8,5 | 9 | G5 |
| Progresión y ritmo | 6 | 8 | 8,5 | G5, G8 |
| Combate contra el mundo (mazmorras, jefes) | 6 | 8,5 | 8,5 | |
| **Guerra entre reinos (conquista)** | 4 | **4** | **8,5** | G1 a G5 |
| Cantidad de contenido | 8 | 9 | 9,5 | G5, G6, G8 |
| Social y multijugador | 4 | 7 | 8,5 | G3, G7 |
| Celular | 6 | 8 | 8,5 | cada fase |
| Estabilidad técnica | 8 | 8,5 | 9 | G1 (pruebas del modelo) |

### El diagnóstico en cuatro frases

1. **El juego creció por todos lados menos por la guerra entre reinos.** Mazmorras, héroes, jefes, logística, mar y
   diplomacia tienen sistemas propios y a la vista. La conquista sigue como en `pk-10`: un contador, una tirada y un
   aviso.
2. **La conquista no se ve.** Seis soldados marchan hasta la parcela, hay una banderita roja de 7 píxeles y, al
   llegar, la parcela cambia de color en el mismo segundo. Es la única pelea del juego que no dibuja ni un golpe: las
   expediciones al menos llaman a `Troops.fight`; las campañas ni eso (`js/terr.js:188`).
3. **No hay nada que decidir.** Se eligen tropas y se espera. El ejército es un solo número (`Social.power`): da lo
   mismo mandar 30 arqueros que 30 lanceros, no hay retirada, ni refuerzos, ni forma de responder cuando te atacan
   aparte de «sube tus torres».
4. **Casi no hay por qué pelear, ni con quién.** Todas las parcelas valen lo mismo (64 casillas y un botín fijo). Es
   cara, tiene treguas de 12 a 24 h y pide la Era III. Y los reinos nacen separados por 2 a 4 parcelas libres
   (medido sobre el mapa de `D.SEED`), así que solo se puede atacar a alguien después de reclamar tierra hacia él, y
   nada en el juego lo dice.

### Lo que mostró la partida del piloto

- 146 minutos de juego a ×40 en modo local, sin errores en la consola.
- Era II a los 13,5 min y Era III a los 34. **No llegó a la Era IV** (con `pk-45` llegaba a los 104 min): quedó con
  la población al tope (128/128), comida y madera llenas, 192 de piedra y la Cantería parada por falta de piedra, y
  un Campamento Maderero lleno sin carromato. `CLAUDE.md` ya advierte que el ritmo no se midió después de `pk-54`.
  Puede ser el piloto (no aprendió las rutas con comodín) o el juego; **hay que aclararlo antes de G1** (sección 13).
- Al final de la partida, ninguna de las 337 parcelas ajenas tocaba el territorio del piloto: no había a quién
  atacar. Por eso la captura de una campaña en marcha no se pudo hacer, y lo que este plan dice de cómo se ve hoy
  sale del código de dibujo (`troops.js`, `render.js`), no de la pantalla.

### Qué trae la actualización

- **El asedio por etapas:** la campaña deja de ser una tirada. Al llegar, tus tropas pelean tres etapas (la frontera,
  las defensas y el estandarte) que duran minutos, con una barra de avance que es la verdad de la batalla.
- **La batalla en el mapa:** campamento de asedio, dos bandos de figuras que chocan, flechas de las torres,
  catapultas contra las murallas, caídos, humo, y la parcela que se va tiñendo del color del atacante a medida que
  avanza el frente. Al final se arría un estandarte y se iza el otro.
- **Lo ve todo el mundo:** atacante, defensor y vecinos ven la misma batalla, y el que no estaba la puede ver después
  en repetición.
- **Decisiones:** táctica de asalto o de cerco, retirada, refuerzos; el defensor puede hacer una salida, pedir ayuda
  a sus aliados o rendir la parcela.
- **Motivos:** comarcas (parcelas con rasgo propio), fuertes fronterizos, máquinas de asedio y tropas que rinden
  distinto en cada etapa.
- **El mismo sistema contra el mundo:** fortalezas neutrales para sitiar, y los tanteos de los reinos simulados
  convertidos en asedios que se ven venir y se pueden responder.
- **La guerra del mundo:** la Ciudadela, un objetivo semanal para gremios, con ranking y títulos de guerra.

### Tamaño

Ocho entregas (`pk-55` a `pk-62`), unas **20 a 28 sesiones**. G1 y G2 juntas ya cumplen el pedido central (que la
batalla se vea y se vea el avance) contra reinos simulados y no tocan el servidor.

---

## 1. Cómo funciona hoy la conquista

| Paso | Dónde | Qué pasa |
|---|---|---|
| Lanzar | `T.attack` (`js/terr.js:162`) | Paga `D.conquestCost` (se paga aunque pierdas), descuenta las tropas y crea `{ k, slot, units, power, arrive }` en `st.terr.camps`. `power` es `Social.power(units)`: un número. |
| Marcha | `T.marches` (`js/troops.js:101`) | Seis figuras caminan del Cuartel a la parcela. Viaje: `90 + distancia × 1,5` segundos. |
| Bandera | `js/render.js:1010` | Un palo y un rectángulo rojo sobre la parcela mientras hay campaña. |
| Batalla | `resolveCampaign` (`js/terr.js:188`) | Al llegar: `atk × U(0,85–1,15) > def × U(0,85–1,15)`. Sin dibujo. |
| Defensa | `D.parcelDefenseParts` (`js/data.js:600`) | Milicia de la era + torres cerca + ejército en casa, × murallas, × 1,5 de local, × 1,25 por parcela propia vecina. Ya viene **separada por origen** (`era`, `towers`, `troops`, `walls`, `home`, `around`). |
| Resultado | `finishCampaign` (`js/terr.js:193`) | Gana: la parcela cambia de dueño, botín fijo por era, pierde 12 a 30% de las tropas. Pierde: 70 a 80%. Tregua de 24 h o 12 h para el defensor. |
| Contra un jugador | `conquer`, `tickCamps` (`server/sim.js:938`, `:974`) | El servidor valida la fuerza (`checkArmy`), guarda la campaña y a la hora de llegada hace la misma tirada con la última foto del defensor. Avisa por el buzón (`under_attack`, `parcel_lost`, `parcel_defended`, `conquest_result`). |
| Contra un reino simulado | `conquerBot` (`server/sim.js:913`) | La batalla es del navegador; el servidor solo valida y anota el cambio de dueño. |
| Tanteos de los simulados | `resolveThreat` (`js/terr.js:272`) | Aviso de 2 minutos y una tirada. Si pierdes: la parcela y el 15% del ejército. Sin dibujo. |
| Resumen | `UI.battleEl`, `D.battleCause` | Barras por origen de la defensa y una frase con la causa. Es lo mejor del sistema y se conserva. |

Con esas tiradas, la probabilidad de ganar según la proporción de fuerzas es hoy (medido, 400.000 tiradas):

| atk / def | 0,8 | 0,9 | 1,0 | 1,1 | 1,2 | 1,3 |
|---|---|---|---|---|---|---|
| Gana | 3% | 21% | 50% | 77% | 92% | 99% |

**Esta tabla es el contrato de balance de las fases G1 a G3**: el asedio nuevo tiene que dar la misma curva (±3
puntos) mientras nadie use las decisiones de G4.

---

## 2. Las decisiones de fondo

### 2.1. Una sola verdad: el plan de batalla

La batalla **no se simula figura por figura**. Al llegar las tropas se calcula, con una semilla, un **plan de
batalla**: cuánto dura cada etapa, cómo quedan las fuerzas al final de cada una y quién gana. El plan es una función
pura que vive en `js/data.js` (`D.asedioPlan`), porque la usa también el servidor (`functions/prepara.js` copia ese
archivo). Todo lo demás (figuras, flechas, barra, tinte de la parcela) **es un dibujo del plan en el instante
`ahora`**.

Por qué así y no con el motor de `js/batalla.js`:

- **El servidor decide la conquista entre jugadores** y no puede correr una simulación de figuras por cada batalla
  (una instancia, tick perezoso de 5 s). Un plan son tres multiplicaciones.
- **Sin conexión da lo mismo que en vivo** sin escribir nada aparte: el plan depende de la semilla y del reloj, no de
  si alguien mira. Recargar en medio de la batalla la retoma en el mismo punto.
- **La repetición sale gratis:** guardar el plan (unos 300 bytes) es guardar la batalla entera.
- **Es la regla que ya tiene el juego** para las tropas del mapa: «se dibujan, no se simulan» (`js/troops.js`).

La ventana de batalla de `batalla.js` (órdenes, héroes, habilidades) queda para lo que es: expediciones y mazmorras.
Ver la decisión 3 de la sección 12.

### 2.2. Tres etapas que salen de lo que ya existe

La defensa ya está separada por origen. Cada etapa es un grupo de esas partes, así que **la suma sigue siendo la
defensa de hoy** y el resumen final (`battleCause`) no cambia:

| Etapa | Partes de la defensa | Lo que se ve |
|---|---|---|
| 1. **La frontera** | `era` (milicia) + `around` (parcelas vecinas) | Choque de líneas en el borde por donde entra el atacante; llegan milicianos corriendo desde las parcelas vecinas. |
| 2. **Las defensas** | `towers` + `walls` | Las torres disparan, las catapultas tiran contra murallas y torres, escalas y ariete si la parcela está amurallada. |
| 3. **El estandarte** | `troops` (guarnición) + `home` (bono de local) | Lo que queda de los dos bandos pelea alrededor del estandarte del centro, con un anillo que se llena. |

Una etapa sin fuerza (una parcela sin torres ni murallas) dura 10 s y se muestra como «sin defensas».

### 2.3. Ímpetu y resistencia, no cadáveres

Las dos barras son **ímpetu** (atacante) y **resistencia** (defensor). Bajan a la vez; el que se queda sin la suya
pierde. Las **bajas** siguen saliendo de `D.conquestLoss` (12 a 30% si ganas, 70 a 80% si pierdes): si las barras
fueran soldados, ganar con 1,2 veces la defensa costaría el 83% del ejército y cambiaría todo el balance.

Las figuras caídas en pantalla siguen la curva de bajas, no la de ímpetu: al terminar quedan en pie exactamente los
que vuelven.

### 2.4. Suspenso sin trampa

Hoy hay una tirada del atacante y una del defensor. En el plan nuevo cada etapa tiene su tirada, y las tiradas se
ajustan para dar la curva de la sección 1. Así una etapa puede salir mejor o peor de lo esperado («la muralla
aguantó un 18% más») y la batalla tiene vuelcos de verdad en vez de un resultado cantado desde el primer segundo.

El cliente no recibe el final por adelantado: el servidor solo cuenta la etapa en curso (5.2).

---

## 3. Fase G1: el asedio por etapas (`pk-55`)

Cambia las reglas, sin dibujo nuevo todavía más que la barra. Solo cliente; contra reinos simulados y en modo local.

### 3.1. El modelo (`js/data.js`)

- `D.ASEDIO = { etapas: ['frontera', 'defensas', 'estandarte'], partes: { frontera: ['era', 'around'], defensas:
  ['towers', 'walls'], estandarte: ['troops', 'home'] }, dur: { min: 30, max: 150, vacia: 10 }, tirada: […] }`.
- `D.asedioPlan({ atk, parts, semilla, tactica })` devuelve `{ etapas: [{ id, def, dur, a0, a1, d0, d1, suerte }],
  gano, ratio, bajas, total }`. Usa `U.rng(semilla, n)`, nunca `Math.random` (regla «semilla por campaña»).
  - La duración de cada etapa es proporcional a su parte de la defensa, entre `dur.min` y `dur.max`. Total típico:
    3 a 6 minutos.
  - `bajas` sale de `D.conquestLoss(gano, ratio)` con la misma semilla (hoy usa `Math.random`).
- `D.asedioEn(plan, t)` devuelve el estado en el segundo `t`: `{ etapa, f (0 a 1 dentro de la etapa), impetu,
  resistencia, control (0 a 1 de la parcela), caidosA, caidosD }`. Es lo único que leen el dibujo y la interfaz.
- `D.scaleParts` y `D.battleCause` se quedan: el plan guarda `parts` ya escalado para el resumen.

### 3.2. La campaña (`js/terr.js`)

- La campaña gana una fase: `go` → **`asedio`** → `back`. Al llegar (`now >= c.arrive`) se calcula
  `c.plan = D.asedioPlan(…)` con `c.semilla` (creada al lanzar) y `c.ini = now`. El resultado se aplica cuando
  `now >= c.ini + plan.total`: `finishCampaign` no cambia.
- Todo va por marcas de tiempo, como hoy `c.arrive`: una partida recargada o un cálculo sin conexión llegan al mismo
  final sin código aparte.
- La parcela **no cambia de dueño hasta el final**. Mientras dura el asedio está «en disputa»: no se puede reclamar,
  atacar otra vez ni construir en ella (`T.enDisputa(k)`, y `'disputa'` en `placeWhy`).
- Los tanteos de los reinos simulados (`resolveThreat`) pasan por el mismo plan, con el jugador de defensor. La
  pérdida fija del 15% del ejército se reemplaza por las bajas del plan aplicadas a la guarnición, con tope 15%.
- Partidas guardadas con una campaña en `go`: siguen igual y al llegar entran al asedio. No hace falta reinicio.

### 3.3. Interfaz mínima

- **Cinta de frente** arriba, bajo el cartel de eventos (`--evh`): tres casillas (⚔ frontera, 🧱 defensas, ⚑
  estandarte), las dos barras, el tiempo que queda de la etapa y «Ver» (centra la cámara). Con varios frentes, la
  cinta muestra el más avanzado y un «+N».
- La ventana de la parcela, en vez de «Ya hay una campaña», muestra el estado del asedio.
- El resumen (`UI.battleEl`) gana una fila por etapa con su suerte.
- **El camino a la frontera:** la ventana Territorio lista a cada vecino con «te faltan N parcelas para tocar su
  frontera» y un botón que marca en el mapa las parcelas libres que acercan (camino más corto por parcelas
  reclamables). Hoy esa distancia no se muestra en ninguna parte.

### 3.4. Pruebas y piloto

- `colabtex/tests/pk-asedio.test.cjs` (agregarlo a `test:juegos`): la curva de la sección 1 con 20.000 planes por
  proporción (±3 puntos); `asedioEn` es continuo, monótono y termina en el resultado; la misma semilla da el mismo
  plan; la suma de las etapas es la defensa total; bajas dentro de los rangos de hoy.
- El piloto ya no conquista (nunca lo hizo). Que aprenda a lanzar una campaña cuando su fuerza pase de 1,25 veces la
  defensa de una parcela vecina, para que `?timelapse` ejercite el sistema y el vigía de invariantes lo cubra.

### Criterios de aceptación de G1

1. Una campaña contra un reino simulado dura minutos, pasa por las tres etapas y termina con el mismo tipo de
   resultado, botín, bajas y treguas que hoy.
2. Recargar en medio de un asedio lo retoma en el mismo punto y con el mismo final.
3. Cerrar el juego durante el asedio y volver una hora después da el mismo resultado que quedarse mirando.
4. La prueba de la curva pasa. `npm run test:juegos` pasa.

---

## 4. Fase G2: la batalla a la vista (`pk-56`)

**Es el pedido central.** Archivo nuevo `js/frente.js` (`PK.Frente`), que dibuja cada asedio a partir de
`D.asedioEn(plan, ahora)`. Nada de lo que hace entra en el guardado ni cambia un número (regla 9 del plan anterior).

### 4.1. El escenario es la parcela

- **Por dónde entran:** el lado de la parcela que toca la tierra del atacante (si toca por dos lados, el más cercano
  a su Cuartel). Ese lado define un eje de avance; todo se coloca sobre él.
- **Campamento de asedio:** dos o tres tiendas, una fogata con humo y el estandarte del atacante, justo fuera de ese
  borde. Aparece cuando la columna llega y se desarma al final.
- **El frente:** una línea que cruza la parcela perpendicular al eje. Su posición es el `control` del plan: en la
  etapa 1 está pegada al borde, en la 2 a la altura de las torres o murallas, en la 3 rodea el centro.

### 4.2. El avance pintado en el suelo

- Las 64 casillas de la parcela se ordenan por distancia al borde de entrada. Las que quedan detrás del frente se
  tiñen con el color del atacante (trama rayada, como el patrón de daltonismo de `pk-31`), y la fila del frente
  parpadea. **Se ve de un vistazo cuánto falta.**
- El borde de la parcela pasa a trazo discontinuo blanco y rojo mientras está en disputa (donde hoy `render.js`
  dibuja los bordes del territorio).
- En el minimapa, la parcela parpadea con dos espadas.

### 4.3. Los dos bandos

- **Atacantes:** hasta 14 figuras elegidas con `Troops.pickTypes(c.units, 14)` (al menos una de cada tipo que
  mandaste), con `Sp.troop` en tu color. La catapulta usa su sprite de carreta, atrás.
- **Defensores:** hasta 12 figuras en el color del reino defendido, armadas desde las partes de la defensa:
  milicianos por `era` y `around`, arqueros junto a las torres por `towers`, y la mezcla real de la guarnición por
  `troops` (del defensor simulado se inventa con su semilla; del jugador real llega en G3).
- **Cómo se mueven:** cada figura tiene un puesto relativo al frente (semilla + índice). Los de cuerpo a cuerpo se
  emparejan con un rival y alternan golpe y guardia (`mode: 'work'` con su herramienta, como la guarnición que
  entrena); los tiradores quedan dos casillas atrás y sueltan flechas que vuelan en arco hasta un blanco real; los
  clérigos echan su luz sobre un herido.
- **Caídos:** cada figura tiene su instante de caída, repartido para seguir la curva de bajas del plan. Cae, queda
  tendida 6 s y se desvanece. Cuando el frente avanza, las figuras caminan a su puesto nuevo.
- **Nada de esto guarda estado:** la posición y la pose salen de `(semilla, índice, t)`, así que dos jugadores ven
  la misma batalla y una recarga no la cambia.

### 4.4. Las piezas de cada etapa

- **Frontera:** carga inicial (los atacantes corren los últimos metros con un grito y polvo), y refuerzos del
  defensor que llegan trotando desde las parcelas vecinas mientras `around` aporte.
- **Defensas:** las torres y el Centro Urbano reales del defensor que estén a menos de 18 casillas disparan a los
  atacantes (el mismo efecto que contra los bandidos en `incursiones.js`). Las catapultas tiran piedras que dejan
  polvo y una marca; si la parcela está amurallada (`W.wall`, `W.wallAj`) aparecen dos escalas y un ariete contra el
  tramo más cercano. Cuando la etapa se pierde, las torres de la parcela quedan con humo. **Los edificios no se
  dañan de verdad:** siguen la regla de hoy (se desarman y se devuelven enteros si la parcela cae).
- **Estandarte:** un mástil en el centro con el escudo del defensor (el de `diplomacia.js`). Un anillo en el suelo
  se llena con el avance de la etapa. Los últimos defensores forman un círculo alrededor.
- **El final:** si gana el atacante, se arría un estandarte y se iza el otro (1,5 s), la trama se vuelve color
  pleno en una onda desde el centro, los vencedores levantan las armas y suena la fanfarria; los defensores que
  quedan se retiran hacia su Centro Urbano. Si pierde, los atacantes huyen al campamento, lo desarman y vuelven; los
  defensores festejan.

### 4.5. Sonido y cámara

- Golpes, flechas y derrumbes con lugar (`R.sonarEnCasilla`, nunca `Sfx.play`): se oyen si la batalla está en
  pantalla y con paneo. Un cuerno al empezar cada etapa. Grabaciones nuevas (tambor de marcha, choque de escudos,
  vítores) con su ganancia medida como en `pk-38`; mientras no estén, se usan `hit`, `pick` y `cuerno`.
- La música pasa a su capa de combate mientras haya un asedio propio en pantalla (ya existe para los jefes:
  `B.vistaActual`).
- **«Ver»** en la cinta centra y acerca la cámara a la parcela y pliega el panel (como al colocar con el dedo). Un
  segundo toque vuelve adonde estabas.

### 4.6. La crónica y la repetición

- Al terminar, el resumen se abre como **«Crónica de la batalla»**: una línea de tiempo con las tres etapas, los
  momentos («¡Brecha en la muralla!», «La milicia de las parcelas vecinas llegó tarde»), bajas por tipo de tropa,
  botín y la causa (`battleCause`).
- **«Ver de nuevo»:** reproduce la batalla en el mapa a ×4 desde el plan guardado (`st.terr.battles` ya guarda 12;
  se le agrega `plan`, `units`, `lado`). Sirve sobre todo al defensor que no estaba.

### 4.7. Rendimiento y celular

- Tope de 30 figuras por asedio y 3 asedios dibujados en detalle; el resto, solo trama, estandarte y cinta.
- Solo se arman las figuras si la parcela está en pantalla (`vis`). Las flechas son partículas de `R.particles`.
- `node tools/rendimiento.js` con 300 aldeanos y un asedio en pantalla no puede bajar más de un 10%.
- La cinta en 390×844 ocupa una línea (íconos sin texto), y en horizontal va arriba a la izquierda. Con «menos
  movimiento» (`PK.menosMov`) no hay sacudidas ni parpadeo, y la trama es fija.

### Criterios de aceptación de G2

1. Con la cámara sobre la parcela se ven dos bandos peleando durante todo el asedio, con figuras que caen, y en
   cualquier momento una persona que no leyó nada puede decir quién va ganando y cuánto falta.
2. El número de atacantes en pie al final coincide con los sobrevivientes que vuelven (escala incluida).
3. Dos navegadores con la misma partida ven la misma batalla en el mismo segundo.
4. Pasa la revisión con Playwright a 390×844, 915×412 y 1280×800, con capturas de las tres etapas y del final.
5. El asedio que te hacen a ti (tanteo de un reino simulado) se ve igual, desde el otro lado.

---

## 5. Fase G3: asedios entre jugadores (`pk-57`, servidor)

Sube `D.PROTO` a 11 y pide `firebase deploy --only functions`.

### 5.1. El servidor (`server/sim.js`, rutas en `server/index.js` y `functions/index.js`)

- `tickCamps`: al llegar la campaña ya no resuelve. Calcula `c.plan = D.asedioPlan(…)` con la foto del defensor de
  ese momento, guarda `c.ini` y deja la campaña viva. Cuando `t >= c.ini + plan.total` aplica el resultado con el
  código de hoy (cambio de dueño, treguas, revancha, buzón).
- La foto del defensor (`snap`) suma `guarn`: la mezcla de su ejército en casa, validada con `checkArmy`, para que el
  atacante vea las tropas reales en la etapa 3.
- Mientras hay asedio, la parcela está en disputa: `claim`, `conquer` y `conquerBot` la rechazan.
- Límite: un asedio por parcela (ya está) y como mucho 2 contra el mismo defensor a la vez.

### 5.2. Lo que viaja en el sync

- Lista `asedios` del mundo, con versión `asv` (igual que `apv` de la Calzada): solo se manda cuando cambia.
- Cada entrada: `{ id, k, de, a, lado, ini, units, guarn, semilla visual, etapas ya empezadas }`. **La etapa en
  curso lleva su duración y cómo termina; las siguientes no viajan.** El final solo se conoce cuando empieza la
  última etapa. La semilla visual es distinta de la que decide el plan.
- El reloj es el del servidor (el desfase ya se calcula para los saqueos: `Sq.off`).
- **La ve todo el mundo:** cualquier jugador con la parcela explorada ve la batalla y la cinta («Ana asedia a
  Bruno»). Costo medido como en S6: la lista cambia unas 4 veces por asedio.

### 5.3. El defensor

- El aviso `under_attack` ya sale al lanzar la campaña. Se agrega `siege_start` al llegar, con notificación del
  sistema (`PK.Notify`) y «Ver».
- Al volver después de un asedio que no vio: el informe sin conexión ofrece «Ver la batalla» (la repetición de 4.6;
  el buzón trae el plan completo cuando ya terminó).

### 5.4. Pruebas

- `tools/asedio-test.js` (en proceso, como `saqueo-test.js`): campaña → llegada → tres etapas → resultado; parcela
  en disputa; el plan del sync nunca incluye etapas sin empezar; reinicio del servidor a mitad de asedio (el plan
  está guardado en el doc `camps`).
- `node tools/cheat-test.js`: una foto con `guarn` mayor que el ejército se recorta y se anota.
- `cd functions && npm run prueba`.

### Criterios de aceptación de G3

1. Dos cuentas en el mismo mundo: una ataca, las dos ven la misma batalla y el mismo final, y una tercera la ve de
   espectadora.
2. La curva de la sección 1 se mantiene en el servidor (misma función).
3. Un cliente `PROTO` 10 recibe 426 y la pantalla de «Jugar sin conexión».

---

## 6. Fase G4: decisiones durante el asedio (`pk-58`)

Todo lo de esta fase cambia el plan, así que cada acción **vuelve a calcular el plan desde el instante actual** con
las fuerzas que quedan (`D.asedioReplan`), en el cliente contra simulados y en el servidor contra jugadores (ruta
`POST /api/asedio { id, accion }`, 4 acciones por asedio como mucho).

### 6.1. El atacante

- **Táctica** (se elige al lanzar y se puede cambiar una vez):
  - *Asalto:* etapas un 30% más cortas; +10 puntos a las bajas si gana.
  - *Cerco:* etapas un 60% más largas; −8 puntos de bajas y la milicia (`era`) pierde un 15%. Le da tiempo al
    defensor para reaccionar: es la táctica segura contra un rival desconectado y la arriesgada contra uno despierto.
- **Retirada:** corta el asedio. Bajas entre 15% (al empezar) y 50% (al final) en vez del 70 a 80% de la derrota. El
  defensor recibe la tregua de 12 h como si hubiera resistido. La campaña ya está pagada.
- **Refuerzos:** una segunda columna desde tu Cuartel (una sola por asedio). Si llega antes del final suma su fuerza
  al ímpetu; si llega tarde, se vuelve. Se valida con `checkArmy` como una campaña.
- **Tropas con oficio** (multiplicadores por etapa en `D.ARMY[k].asedio`, calculados por el servidor desde las
  unidades ya validadas): jinete y caballero ×1,25 en la frontera; catapulta ×2 y ballestero ×1,3 en las defensas,
  arquero ×0,8 ahí; lancero, monje y clérigo ×1,2 en el estandarte. El selector de tropas muestra la fuerza por
  etapa, como hoy el planificador de expediciones muestra «fuerza contra». El total con un ejército equilibrado
  queda igual que hoy (se mide con la prueba de la curva).

### 6.2. El defensor

- **Salida:** una vez por asedio, en las etapas 1 o 2: tu guarnición sale a pelear. Suma un 20% de `troops` a la
  resistencia de esa etapa y cuesta un 5% de esas tropas.
- **Pedir ayuda:** los aliados de la diplomacia suman como en los saqueos (`D.DIPLO.ayuda`, `aliadosAyuda`), y sus
  columnas se ven llegar con su color.
- **Rendir la parcela:** termina el asedio sin bajas para nadie; el atacante se queda con la parcela y con medio
  botín. Para quien prefiere no arriesgar su guarnición.
- Sin el jugador (desconectado, sin conexión, `?timelapse`): no se usa ninguna (regla «las elecciones sin jugador
  toman la opción por defecto»). La curva de la sección 1 sigue valiendo para ese caso.

### 6.3. Antitrampas

- La salida y los refuerzos gastan ejército de la foto (`s.army`), como una campaña.
- Cada acción se anota; pasarse del máximo o actuar fuera de una etapa válida devuelve error, sin sospecha.
- Probar con `cheat-test.js`: refuerzos mayores que el ejército, dos salidas, acción sobre un asedio ajeno.

### Criterios de aceptación de G4

1. Cada acción cambia la barra y el dibujo en el momento (la columna de refuerzos se ve llegar; en la retirada las
   figuras dan la vuelta).
2. Retirarse nunca deja mejor que ganar ni peor que perder.
3. La curva sin acciones no cambió.

---

## 7. Fase G5: motivos para pelear (`pk-59`, servidor)

Sube `D.PROTO` (tipos de edificio y de tropa nuevos: `cleanBuildings` descarta los desconocidos).

### 7.1. Comarcas: parcelas con rasgo

- Cada parcela que no es núcleo ni zona común tiene, con probabilidad de 1 en 4, un **rasgo** sembrado
  (`W.rasgoDe(k)` en `js/world.js`, con su propio rng `D.SEED + 6151`: no mueve el mapa ni pide reinicio).
- Rasgos: **Vega** (granjas dentro +15%), **Bosque viejo** (tala +10% para campamentos dentro), **Cerro** (defensa
  de la parcela ×1,3 y +1 de alcance a sus torres en vivo), **Cruce** (carretas y carromatos +20% de velocidad
  dentro), **Cantera vieja** (minería +10% dentro), **Santuario** (+3 de ánimo).
- Los bonos de recolección pasan por `Vida.recoleccion` (recortado) y los demás por `G.bono`; todos caben en
  `LIM.slack` y `LIM.vida`. El Cerro entra en `mult` de `parcelDefenseParts` en los dos lados.
- En el modo Territorio cada comarca lleva su ícono, y la ventana de la parcela dice qué da. El Asesor gana la regla
  «hay una Vega libre junto a tu frontera».
- Botín: conquistar una comarca da +50% de botín.

### 7.2. El Fuerte fronterizo

- Edificio nuevo `fuerte` (3×3, Era III, `max: era => 1 + ⌊era / 3⌋`), en `data.js`. Defensa propia como una torre
  alta y **radio de 2 parcelas** para la cuenta de la etapa 2. El servidor lo suma en `towerDefense` y en `defMax`.
- En el dibujo es la pieza de la etapa 2: los defensores pelean desde su empalizada y es lo que humea al caer.
- Da sentido a elegir qué frontera se defiende: hoy todo el ejército defiende todas las parcelas a la vez.

### 7.3. Máquinas de asedio

- **Ariete** (Era III, Cuartel nivel 4): fuerza baja, ×3 en la etapa de defensas si la parcela tiene murallas.
- **Torre de asedio** (Era V, pide maquinaria): ×2 en defensas y reduce las bajas de esa etapa.
- Las dos son modelos de `vehiculos.js` (cajas, ruedas, 8 direcciones), marchan con la columna y se ven trabajar.
- Solo cuentan en asedios: en expediciones valen su fuerza base (regla «solo PvE» al revés: `asedio` nunca entra en
  `Exp.powerVs`).

### 7.4. Balance

- Piloto antes y después. Las comarcas no deben mover el ritmo de eras más de un 5%.
- `armyMultMax` y `defMax` actualizados y `cheat-test.js` en la misma entrega.

---

## 8. Fase G6: fortalezas y amenazas visibles (`pk-60`)

El sistema de asedios es caro de hacer y entre jugadores se usa pocas veces por semana. Esta fase lo pone a trabajar
todos los días, también en modo local. Solo cliente.

### 8.1. Fortalezas

- Lugar nuevo `fortaleza` (4×4): ocho en el mapa, **al final de `W.pois` y con su propio rng** (sin reinicio; hay
  que regenerar el fixture de POIs). El despeje las trata como cualquier lugar.
- Se sitian desde el Cuartel con el mismo asedio de tres etapas (empalizada, torre del homenaje, estandarte), contra
  bandidos, no-muertos o gigantes según la fortaleza. Aquí sí valen los héroes y `Exp.powerVs`: es PvE.
- Tomada, es tuya: da un bono de comarca a elección y un tributo diario. Cada 3 a 5 días reales una hueste intenta
  recuperarla y **la defiendes tú** (el mismo dibujo desde el otro lado). Sin conexión se resuelve por el plan.
- Niveles: cada fortaleza retomada vuelve un nivel más fuerte, con mejor botín (equipo de héroe, gemas).

### 8.2. Las amenazas de los reinos simulados

- Los tanteos (`st.terr.threats`) ya pasan por el plan desde G1. Ahora la hueste se ve salir del reino vecino con su
  escudo y marchar hasta tu frontera (como las partidas de saqueo de `saqueos.js`), y la ventana ofrece **pelear,
  pagar tributo o pedir ayuda**, igual que un saqueo.
- En línea, que los decida el servidor junto con los saqueos (`tickSaqueos`): hoy en línea los simulados nunca atacan
  tu frontera (`if (online()) return` en `T.update`).

### 8.3. La Crónica

- Un capítulo corto nuevo, «La Marca del Norte», que enseña el asedio: Tobías te lleva a sitiar la primera
  fortaleza con tropas prestadas (como la batalla de la guía, que no cuesta nada).

---

## 9. Fase G7: la guerra del mundo (`pk-61`, servidor)

- **La Ciudadela:** una fortaleza grande en una zona común, una por mundo. Cada semana los gremios la sitian: cada
  miembro manda una campaña al día (validada con `checkArmy`, como el jefe semanal de `pk-24`) y su ímpetu se suma al
  de su gremio. El domingo, el gremio con más ímpetu la ocupa: su estandarte ondea ahí toda la semana, a la vista de
  todos, y sus miembros reciben un bono suave (+5% de oro del Mercado) y un marco de retrato.
- **Rankings** (`D.RANKINGS`): «Conquistas» y «Fortalezas», con títulos semanales («Azote de las Fronteras»,
  «Castellano Mayor»).
- **Diario de guerra** en Reinos: las últimas 20 batallas del mundo con «Ver» (la repetición de 4.6, guardada en el
  servidor solo como plan).
- **Diplomacia:** un aliado puede sumarse a tu asedio contra un rival común (una columna suya, pedida desde Reinos);
  la relación con el atacado baja para los dos.

---

## 10. Fase G8: contenido de cierre (`pk-62`)

- **Misiones** (rama Guerra): primer asedio ganado, ganar una etapa de defensas con ariete, retirarse a tiempo,
  resistir un asedio con una salida, tomar una comarca, mantener una fortaleza una semana, ver una repetición.
- **Desafíos y Retos del Rey:** «gana un asedio sin perder más del 15%», «defiende dos veces en un día».
- **Pase del Reino:** puntos por asedios y fortalezas (con tope por día, los decide el servidor) y aspectos nuevos
  de estandarte y de campamento de asedio. Sin bonos de fuerza.
- **Pendientes del plan de logística que encajan aquí** (su sección 9): la vista «Logística» en el mapa, la
  empalizada de campamentos y los bandidos que asaltan carromatos con escolta (usa el dibujo de pelea de G2).
- **Consejero nuevo, el Mariscal** (Salón del Consejo): avisa qué parcela vecina está a tu alcance, propone la
  mezcla de tropas por etapa y, si se lo permites, ordena la retirada cuando el plan va perdido.
- **Guía:** dos pasos más de Tobías al entrar a la Era III (abrir Territorio, leer una parcela).
- **Prueba de ritmo** completa con el piloto y ajuste final de costos de campaña.

---

## 11. Reglas y trampas de este plan

1. **El plan es la verdad; el dibujo no decide nada.** Ningún número de balance en `frente.js`. Si el dibujo y la
   barra no coinciden, está mal el dibujo.
2. **Semilla por campaña**, creada al lanzar y guardada. Nunca `Math.random` ni `U.rand` en el plan: recargar justo
   antes de una etapa no puede cambiarla. (Hoy `conquestLoss` usa `Math.random`: se corrige en G1.)
3. **Dos semillas:** la que decide y la visual. El servidor nunca manda la primera.
4. **Reloj:** el asedio usa marcas de tiempo reales, como `c.arrive` hoy, y en línea el reloj del servidor. No
  `G.ahora()`: una campaña no es producción y no debe acelerarse con el piloto más de lo que ya hace `Date.now`.
5. **La curva de la sección 1 no se mueve sin querer.** La prueba de G1 se corre en cada fase.
6. **Héroes, objetos y leyendas siguen fuera de la conquista entre reinos** (`Social.power`). Solo entran en las
   fortalezas (PvE).
7. **Los edificios no se rompen.** Humo y marcas son dibujo; al caer la parcela se desarman y se devuelven enteros.
8. **En el mar no hay asedios** (el servidor no ve ese mapa): `frente.js` no se carga con el tema `mar`.
9. **Parcela en disputa:** ni construir, ni reclamar, ni rutas nuevas que terminen ahí. Los aldeanos del defensor que
   trabajen dentro se refugian (como en un asedio de bandidos) y vuelven al terminar.
10. **Lo que manda el sync va con versión** (`asv`), y la lista se vacía sola: un asedio terminado sale en el sync
    siguiente.
11. **Avisos:** un asedio produce como mucho 3 avisos (empieza, última etapa, final). El resto lo cuenta la cinta.
12. **Cada entrega:** `?v=pk-N` en todos los scripts (el archivo nuevo incluido, después de `troops.js`), `PK_VER`,
    `npm run build`, y las notas en `CLAUDE.md` de esta carpeta en pocas líneas.

---

## 12. Decisiones que debe tomar el dueño

Cada una trae la opción recomendada, que es la que el plan da por elegida si no dices otra cosa.

1. **¿Cuánto dura un asedio?** Recomendado: 3 a 6 minutos contra simulados y 8 a 12 entre jugadores (para que el
   defensor alcance a llegar con el aviso). Alternativa: largo de verdad (30 a 60 min) entre jugadores, más
   estratégico pero nadie lo mira entero.
2. **¿Los demás jugadores ven tus batallas?** Recomendado: sí, todos los del mundo. Alternativa: solo atacante,
   defensor y sus aliados.
3. **¿La etapa del estandarte se puede pelear en la ventana de batalla, con órdenes?** Recomendado: no. Serían dos
   verdades (el plan y el motor de `batalla.js`) y entre jugadores no se puede. Si más adelante la quieres, solo
   contra simulados y fortalezas.
4. **¿Rendir la parcela (6.2) existe?** Recomendado: sí. Alternativa: no, toda parcela se pelea.
5. **¿Las comarcas (7.1) cambian parcelas que ya tienen dueño?** Recomendado: sí, aparecen para todos sin reinicio
   (a algunos les tocará una dentro de su tierra). Alternativa: solo en tierra libre al momento del cambio.
6. **¿La Ciudadela (9) da algo que afecte el juego?** Recomendado: un bono suave y cosas a la vista. Alternativa:
   solo honor (estandarte, título y marco).
7. **¿Se baja el costo de las campañas?** Recomendado: no en G1 a G4; se revisa en G8 con datos de uso. El costo
   alto es lo que hoy protege a los que recién empiezan.

---

## 13. Tamaño y orden

| Fase | Versión | Servidor | Sesiones | Depende de |
|---|---|---|---|---|
| G1. Asedio por etapas | `pk-55` | no | 2 a 3 | |
| G2. La batalla a la vista | `pk-56` | no | 4 a 6 | G1 |
| G3. Entre jugadores | `pk-57` | sí, `PROTO` 11 | 3 a 4 | G1, G2 |
| G4. Decisiones | `pk-58` | sí | 3 a 4 | G3 |
| G5. Motivos | `pk-59` | sí, `PROTO` 12 | 3 a 4 | G2 |
| G6. Fortalezas y amenazas | `pk-60` | no (8.2 en línea: sí) | 3 a 4 | G2 |
| G7. La guerra del mundo | `pk-61` | sí | 2 a 3 | G3, G6 |
| G8. Cierre | `pk-62` | puntos del Pase | 2 a 3 | todas |

- **Antes de G1, media sesión:** correr `?timelapse` hasta la Era V y ver por qué el piloto se queda en la Era III
  (sección 0). Si es el piloto, enseñarle las rutas de `pk-54`; si es el juego, arreglarlo primero: sin una prueba
  de ritmo sana no se puede medir nada de lo que sigue.
- **G1 + G2** son el pedido: se pueden pedir juntas («implementa G1 y G2») y publicar sin desplegar la función.
  Mientras no llegue G3, la conquista entre jugadores sigue con la tirada de hoy (el dibujo muestra un choque corto
  al llegar el resultado).
- **G5 y G6** no dependen de G3 ni de G4: si el servidor se atrasa, se pueden adelantar.
- Ninguna fase pide reiniciar mundos ni partidas.
