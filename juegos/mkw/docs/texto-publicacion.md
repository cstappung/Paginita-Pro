# Texto para publicar JloKart Wii v2.0

Texto del commit y del PR de esta versión en `cstappung/Paginita-Pro`, ya con el número (237, `4937668`). El PR se hace
solo cuando el dueño lo confirme, cada vez.

El commit nº 237 (`4937668`) es el que abre el multijugador (§264). Los commits que vienen después solo tocan este texto.

---

## El commit (título y cuerpo)

```
🏁 JloKart Wii v2.0 — Mario Kart Wii + Retro Rewind en el navegador, con salas de hasta 12

Versión 2.0 · commit nº 237 del motor MKW RETRO (4937668) · 2026-11-09

Mario Kart Wii con Retro Rewind corre entero dentro de la página: sin emulador
y sin nada que instalar. El juego se traduce del PowerPC de la Wii a C++, se
compila a WebAssembly y se dibuja con WebGPU. 60 cuadros por segundo de lógica,
siempre 12 karts.

Lo nuevo en esta versión
• Multijugador abierto: salas de hasta 12 jugadores, copa o playlist,
  150cc / 100cc / espejo / azar y CPU de fácil a imposible. También 2 a 4
  jugadores en la misma pantalla.
• Largada pareja: todas las consolas dan el «¡YA!» en el mismo cuadro.
• Un jugador lento no frena a los demás: el árbitro y el relevo lo sostienen.
• Bienvenida «Ajusta el juego a tu aparato» y la Ayuda de ajustes, con
  recetas para PC lento, celular, mando y sala.
• Controles con el dibujo del mando, reasignar botones y los mandos de
  Switch 2 y genéricos.
• Casilla «Mostrar avisos de conexión y lag».
• Imagen elegible en plena carrera (Automático, 30 parejas, 60, con imagen
  intermedia) y un medidor con el 1 % más lento en vivo.
• Gráficos livianos opcionales (partículas, texturas, «⚡ Liviano») para
  aparatos que frena la tarjeta.
• Borrar por partes lo que el juego guarda en el navegador.

Rendimiento
• W30: las cuentas del procesador con las del navegador en vez de imitar
  la Wii al último bit, idénticas en todas las consolas. Entre +3 y +8 %
  de CPU en la gama baja.
• Optimización guiada por perfil (PGO) rehecha para esta versión.
• El programa comprimido pesa 13,7 MB.
• Durante la carrera no se baja nada de la red.

Probado
• La planilla completa contra el programa final: sincronía, fantasmas y
  desconexiones.
• 12 jugadores, cada uno en su ventana con caché vacía, entran desde la
  página y largan en el mismo cuadro, con las huellas iguales en los 12.

El juego no está en este repositorio: lo de Nintendo y Retro Rewind se sirve
privado desde R2 detrás del Worker de amigos. Aquí va solo la página, la
sala y la red. El resumen de estas semanas: juegos/mkw/docs/version-2.0.md.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

---

## El PR (título y descripción)

**Título:** `🏁 JloKart Wii v2.0 — multijugador abierto, bienvenida y el motor más rápido`

```markdown
# 🏁 JloKart Wii v2.0

> **Versión 2.0** · **commit nº 237** del motor MKW RETRO (`4937668`) · 2026-11-09

Mario Kart Wii **con Retro Rewind**, entero en el navegador: del PowerPC de la
Wii a C++, de C++ a WebAssembly y dibujado con WebGPU. **60 cuadros de lógica,
siempre 12 karts.** Chrome y Edge, en el escritorio y en Android.

## ✨ Lo nuevo

| | |
|---|---|
| 🌐 **Multijugador abierto** | Salas de hasta 12, copa o playlist, cilindrada y CPU de fácil a imposible; 2–4 en la misma pantalla |
| 🚦 **Largada pareja** | Todas las consolas dan el «¡YA!» en el mismo cuadro |
| 🛟 **Nadie frena a nadie** | El árbitro y el relevo sostienen al jugador lento |
| 👋 **Bienvenida y ayuda** | «Ajusta el juego a tu aparato», con recetas para cada jugador |
| 🎮 **Controles** | El dibujo del mando, reasignar todo, Switch 2 y mandos genéricos |
| 📶 **Avisos de lag** | Se pueden ocultar con una casilla |
| 🖼️ **Imagen en vivo** | Automático, 30 parejas, 60 o con imagen intermedia, con el 1 % más lento en el medidor |
| ⚡ **Liviano** | Partículas y texturas opcionales para aparatos que frena la tarjeta |
| 🧹 **Espacio** | Borrar por partes lo guardado en el navegador |

## 🚀 Rendimiento

- **W30**: cuentas nativas de WebAssembly, idénticas en todas las consolas (de +3 a +8 % de CPU en la gama baja).
- **PGO** rehecho para esta versión. El programa comprimido pesa **13,7 MB**.
- **0 descargas** con la carrera andando.

## ✅ Probado

- La planilla completa contra el programa final: sincronía, fantasmas y desconexiones.
- **12 jugadores**, cada uno en su ventana con caché vacía: entran desde la página, largan en el mismo cuadro y quedan con las huellas iguales en los 12.

## 📖 El trabajo de estas semanas

El resumen con los números está en [`juegos/mkw/docs/version-2.0.md`](juegos/mkw/docs/version-2.0.md). El detalle de cada paso está en `juegos/mkw/docs/bitacora.md`.

## 🔒 Lo que no va aquí

El juego (Nintendo y Retro Rewind) **no** está en este repositorio: se sirve privado desde R2 detrás del Worker de amigos.

## 📋 Para publicar (en este orden)

Los pasos con sus comandos están en `docs/publicar.md` de MKW RETRO, en «Publicar esta versión»:

1. R2.
2. El Worker.
3. Las reglas de Firebase, si cambiaron.
4. Este PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## La etiqueta (opcional, para que GitHub la muestre como versión)

Después del merge, el dueño puede marcar la versión. Así sale en «Releases» con el texto del PR:

```bash
git tag -a mkw-v2.0 -m "JloKart Wii v2.0 (commit nº 237 del motor MKW RETRO, 4937668)"
```

```bash
git push origin mkw-v2.0
```
