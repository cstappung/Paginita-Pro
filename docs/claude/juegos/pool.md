# Pool 8

Billar a ocho bolas, por turnos, para 2 (1 contra 1) o 4 jugadores (2 contra 2).
Código: motor y reglas en `colabtex/src/juegos/motor.js` (sección «Pool»,
`redPool`), pantalla en `pool.js`, dibujo en `pool-vista.js`, pruebas en
`colabtex/tests/pool.test.cjs`.

## Cómo funciona en línea

- **El log de jugadas es el estado**, como en todos los juegos de sala. Cada
  tiro es `{t:"tiro", uid, dx, dy, f, a, b, px?, py?, c?}`: dirección (vector
  unitario, no ángulo), fuerza 0,02–1, punto de golpe `a`/`b` dentro de un
  disco, `px`/`py` si se coloca la blanca en mano y `c` (0–5) con la tronera
  cantada para la 8.
- **La física es determinista**: paso fijo de 1/600 s y solo `+ − × ÷ √`
  (nada de `sin`, `cos` ni `pow`), para que todos los navegadores calculen
  la misma mesa. Por eso el tiro viaja como vector y no como ángulo. **No
  uses trigonometría dentro de la simulación**; en el dibujo sí se puede (la
  orientación de las bolas es solo visual).
- `redPool` reproduce el log entero. Cada tiro se simula una sola vez gracias
  a una caché por prefijo (`plCache`, claves FNV): sin ella cada repintado
  volvería a simular toda la partida.
- Si cambias cualquier constante de `PL` o el orden de las operaciones de
  `plPaso`, **cambias el resultado de todas las partidas guardadas**. Hazlo
  solo si no te importa que las salas antiguas se vean distintas.

## Física (resumen)

Unidades en mm, y hacia arriba, mesa de 2540×1270, bola de radio 28,575.
Modelo de deslizar/rodar (velocidad angular `wx, wy, wz`), choque bola–bola
con fricción («throw»), banda con fricción y efecto lateral, doce puntas de
banda junto a las troneras y seis zonas de captura. Red de seguridad: ningún
tiro pasa de 45 s simulados.

## Reglas

Reglas tradicionales de 8 ball (ver el manual, `reglas.js`):

- Rotura legal: una bola embolsada o al menos cuatro a banda; la 8 en la
  rotura vuelve a su sitio; blanca embolsada en la rotura → cabecera.
- Mesa abierta hasta que una bola legal asigna lisas (1–7) o rayadas (9–15).
- Primer contacto con bola propia (la 8 solo tras despejar), banda tras el
  contacto o bola embolsada; si no, falta → blanca en mano (`mano`:
  `"cabecera"` o `"libre"`).
- La 8 se canta (tronera 0–5) y debe caer en ella sin falta; antes de tiempo,
  en otra tronera o con falta es derrota (`motivo`: `ocho`, `ocho-pronto`,
  `ocho-mal`, `ocho-falta`, `abandono`).
- 2 contra 2: anfitrión (asiento 0) + asiento `pareja` (1–3) contra el resto;
  los equipos alternan, dentro de cada uno rota quien tira. Los ganadores
  de equipo se guardan como `"eq:a"` / `"eq:b"` (`ganoEn` los resuelve con
  `equiposPool`). Un equipo pierde por abandono cuando se van todos sus
  miembros.

## Opciones de sala (`OPCIONES.pool` en `juegos-main.js`)

`cupo` (2 o 4), `guia` (1 con línea guía, 0 sin ella) y `pareja` (1–3, solo
2 contra 2). No se llaman `modo` porque `modo` está en la lista blanca de las
reglas; los campos extra pasan por `$otro`. Con cupo 4 la sala empieza sola al
llenarse (no hay botón «Empezar»: `minimoDe` vale 4).

## Pantalla (`pool.js`)

- Canvas 2D: la mesa es una capa que se pinta una vez (`dibujaMesa`) y cada
  bola es una esfera sombreada por píxel con orientación (`pintaBola`).
- Para ver un tiro nuevo se parte de `ultima.antes` y se llama a `plPaso` en
  tiempo real; al acabar se encaja con `est.mesa`. `ocupado()` es verdadero
  durante la repetición para que el cartel de fin espere, y `ctx.listo()` se
  llama al terminar.
- Si la pestaña está oculta o es la primera carga, no se anima: se encaja el
  estado directamente.
- La línea guía es solo ayuda de puntería: se pinta en rojo si el primer
  contacto sería ilegal, pero no impide el tiro.
- Sonidos por `sonido.js` (`plTaco`, `plChoque`, `plBanda`, `plTronera`).

## Integración

Ver `docs/claude/juegos/crear-un-juego.md` (juego de sala). Lugares tocados:
`motor.js`, `juegos-main.js`, `salon-datos.js`, `buscador.js`, `logros.js`
(`SALA.pool`), `monedas.js` (`NIVEL.pool`, `PESO.pool`), `perfil-tarjeta.js` y
`marcos-animados.js` (marco `tpool`), `reglas*.js`, `sonido.js`, `juegos.html`
(`.jg-pool`, `.jg-pl-*`, portada `.jg-art-pool`) y
`firebase/database.rules.json` (**hay que republicar las reglas a mano**, ver
`firebase/CONFIGURAR-FIREBASE.md`).

## Tacos, cofres y novedades (v0.1)

- `tacos.js` (puro): catálogo `TACOS` (13 diseños, cada uno con rareza), `RAREZAS` con probabilidad (por mil) y reembolso por repetido, `PRECIO_COFRE = 500`. Común 58 %, Poco común 27 %, Raro 11 %, Épico 3,5 %, Legendario 0,5 %. «escuela» es el taco inicial y no sale de cofres.
- Cofre: nodo `cofres/<uid>/<clave>` = `{at, p}` (`at === now`, `p === 500`, se escribe una sola vez; ver reglas). El premio es `abreCofre(uid, clave, at)`, determinista, así que nadie lo elige. Si ya se tenía, `monedas.js` devuelve `reembolsoDe(id)`.
- Los tacos que se poseen se calculan en `economia()` (`usuarios[uid].tacos`); el saldo nunca se guarda. Un cofre nuevo suma un nodo a `NODOS_MONEDAS` (ahora 14).
- Taco equipado: `users/<uid>/taco` (fuera de `perfil`, porque `guardarPerfil` lo reescribe entero). Al rival se le dibuja solo si lo posee según la economía; si no, «escuela».
- Dibujo: `dibujaTaco` / `dibujaTacoMini` en `pool-vista.js`. Para un taco nuevo: una entrada en `TACOS` (y su veta en `vetas` si es nueva).
- Menú del juego: `pool-menu.js` (🎁 Tacos y cofres, 📋 Novedades). Para una versión nueva, agregar un bloque al inicio de `NOVEDADES_POOL` en `pool-novedades.js` y subir `VERSION_POOL`.
- Las reglas de Firebase hay que volver a publicarlas a mano (nodo `cofres`).
