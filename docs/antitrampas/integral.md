# Antitrampas: Integrodle

Categorías: `club-integral-puntos` (el total acumulado de todo el historial,
solo crece) y `club-integral-racha` (días seguidos resueltos). Verificador:
`colabtex/src/juegos/solo/verifica/integral.js` (`PRUEBA = 1`). Pruebas:
`colabtex/tests/integral.test.cjs`.

## Vías de trampa

1. **`Club.result` desde la consola** con cualquier número.
2. **Editar lo guardado** (`integral.estado.cuenta.<uid>` en `localStorage`
   o `users/<uid>/club/integral`): días inventados o `[120, 1, …]` en cada
   uno. `limpia` ya rehace los puntos de lo intentado, y el verificador
   también.
3. **Colar la práctica como diario**: lo intentado tiene que resolver la
   integral *de esa fecha* (`objetivoDelDia`), no una cualquiera.
4. **Días imposibles**: futuros, anteriores al estreno (2026-10-21),
   repetidos o desordenados.
5. **El reloj**: frenarlo para bajar el tiempo (desempate).
6. **Bots** que escriben la primitiva de `datos.js` y envían al instante.
7. **Fabricar el historial con el motor**: la integral de cada fecha y su
   primitiva son públicas. Es el límite honesto, como en Electrodle.

## La prueba

```
{ v: 1, f: "2026-10-21",
  d: [[n.º del día, ms, "intento\nintento…", "dt.a,dt.a,…", u, mc]] }
```

Un día por fila (1 = el estreno). La forma (`dt` visible desde el intento
anterior y acciones de verdad por intento) va solo en los últimos 30 días
(`M.VENTANA`), y `u`/`mc` solo si no son cero, así que una fila tiene 3, 4
o 6 elementos. La racha manda solo el día del récord (`prueba(e, f, true)`).

## Qué se rechaza

- Un intento ilegible o que `revisa` no puede corregir, uno repetido (misma
  forma canónica), más de 6, un día que sigue después de acertar o que
  termina sin acertar ni gastar los 6.
- Puntos o tiempo que no dan exactamente la suma rehecha.
- En los últimos 30 días: un día sin forma, una sola acción sintética, un
  intento sin teclas, dos intentos a menos de 250 ms, un día entero en
  menos de 3 s.
- En el agregado: menos de 500 ms por intento con 20 o más, o 20 intervalos
  o más con un coeficiente de variación bajo 0,08 (metrónomo).
- La racha: más días que los que lleva Integrodle, un día no resuelto o sin
  forma (el tope de verdad es `rachasClub`, que sube de a uno por día).

`sospecha` (filas sin prueba): más de 120 puntos por día desde el estreno,
o mil puntos o más a menos de 10 ms por punto.
