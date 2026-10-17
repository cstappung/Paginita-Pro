# Análisis: Mario Kart Wii (WiiCompiled + Retro Rewind) → navegador

Fecha: 2026-10-16. Fuentes: WiiCompiled @ `bd219e38`, WheelWizard @ `b721766`, wiki de Retro Rewind (mkwiiki.org),
`GUIA-BT3.md`. Rutas relativas a `terceros/Wiicompiled/` salvo que se diga otra cosa.

## 1. Qué es cada cosa

| Proyecto | Qué es | Licencia | Qué nos da |
|---|---|---|---|
| **WiiCompiled** | Static recomp: traduce el PowerPC de `main.dol` + `StaticR.rel` a ~28 000 funciones C++ y las compila con un runtime propio (HLE de la Wii) y aurora (GX → WebGPU/Dawn) | GPL‑3.0 | **El juego entero**, con física 100 % igual a la Wii (probado con ghosts) |
| **WheelWizard** | Lanzador/gestor en C#/Avalonia: baja el setup de WiiCompiled, instala Retro Rewind, lanza Dolphin | GPL‑3.0 | Solo referencia de formatos y APIs (rksys, friend codes, Miis, salas de rwfc.net, actualizador de RR) |
| **Retro Rewind** v6.13.1 | Mod de ZPL sobre Pulsar: 209 pistas retro + 132 custom, 200cc/500cc, Retro WFC (online propio basado en WiiLink) | Sin licencia de redistribución publicada | Se traduce **estáticamente** junto al juego (`translate-mod`, perfil `retro-rewind`) |

Ninguno menciona la web: **no existe port a navegador; lo hacemos nosotros.**

## 2. Cómo es el código traducido (lo bueno)

- Cada función es `extern "C" void func(CpuContext* ctx)`; registros en un struct; saltos con `goto`/`switch`;
  llamadas indirectas por tabla (`InvokeIndirectCpu`). **Sin computed goto, sin asm, sin intrínsecos, sin `__int128`.**
  Compila a wasm sin trucos.
- Ya existe una **ruta de memoria comprobada por software** (`GuestFlat::RequiresCheckedAccess()`), activa en
  producción en Mac ARM: espejos, MMIO, EFB diferido y guarda de código resueltos sin fallos de página. Es
  justo lo que wasm necesita.
- RAM real del invitado: ~155 MB (MEM1 24 MB + MEM2 128 MB + extras): **cabe en wasm32**.
- aurora ya tiene restos de soporte WebGPU/32 bits (`BACKEND_WEBGPU`, hilos de pipelines apagados con WebGPU,
  `XXH32` con punteros de 32 bits). Los shaders son **WGSL generado**: el WebGPU del navegador lo entiende tal cual.
- Audio por SDL3 (que tiene backend web), mandos por SDL3 (Gamepad API).

## 3. Bloqueadores, de menor a mayor

| # | Bloqueador | Dificultad | Cómo se resuelve |
|---|---|---|---|
| 1 | CMake exige 64 bits y plataformas fijas; `#error` en 3 cabeceras | Fácil | Rama `__EMSCRIPTEN__` + toolchain emcmake |
| 2 | Intrínsecos SSE/NEON en cabeceras ISA (PSQ, paired singles) | Fácil | `#else` escalar (la rama ARM ya casi lo es) o `wasm_simd128.h` |
| 3 | Extras de escritorio (Discord, ducking, SEH/señales, símbolos) | Fácil | `#ifdef` fuera |
| 4 | `.text`/`.data` del DOL embebidos con `.incbin` | Fácil | Leerlos del disco al arrancar (mejor también en lo legal) |
| 5 | Superficie de dibujo | Fácil | `SurfaceSourceEmscripten` (canvas) en `BackendBinding.cpp` |
| 6 | Excepciones C++ (`AccessViolation`) y pila del host profunda | Fácil | `-fwasm-exceptions`, `STACK_SIZE` de varios MB |
| 7 | Memoria plana de 4 GB en dirección fija (`VirtualAlloc2`/`mmap`) | Medio | `RequiresCheckedAccess()` siempre activo + buffers normales (como Mac ARM) |
| 8 | FPU: FTZ (no existe en wasm), NaN, **`std::fma` por software (lento)** | Medio | FMA exacta propia (double-double) + normalizar NaN + vaciar denormales si FPSCR.NI |
| 9 | Archivos: carpeta DATA extraída, NAND, `Config.toml`, sqlite | Medio | FS en memoria/OPFS; archivos del disco por pedido (como BT3) |
| 10 | Hilos de aurora (presenter, interpolación, sqlite) y del mezclador AX | Medio | Todos tienen modo en línea/apagado |
| 11 | Wii Remote Bluetooth / adaptador GC USB | Medio | Fuera de alcance (Gamepad API sí) |
| 12 | **Dawn nativo → WebGPU del navegador**; esperas síncronas (`WaitAny`, readback de EFB por cuadro) | Difícil | emdawnwebgpu + JSPI para suspender en esas esperas |
| 13 | **Hilos del juego como fibers** (`CreateFiber`/libco) + bucle principal que nunca devuelve el control | Difícil | Fibers sobre JSPI (verificar soporte en Emscripten) o un pthread por hilo con testigo único |
| 14 | Tamaño: ~28 000 funciones, decenas a >100 MB de `.wasm`, ~2 GB RAM por unidad al compilar | Difícil | Shards, `-O2`, carga en streaming; el PC (9800X3D, 61 GB) aguanta |
| 15 | **Online**: UDP P2P (GameSpy natneg) + TCP/TLS a Retro WFC con sockets crudos | Muy difícil | Puente WebSocket/WebRTC + relé propio; se deja para el final |
| 16 | **Legal**: el `.wasm` es código de Nintendo traducido | — | Nunca público: R2 + Worker de amigos (como el disco de BT3) |

## 4. Diferencias con BT3

| | BT3 | Mario Kart |
|---|---|---|
| Origen | Decomp (C escrito por personas) | Static recomp (C++ generado) |
| ¿`.wasm` publicable? | Sí (tablas en blanco) | **No**: solo R2 privado |
| Fps | 30 | **60** |
| Render | WebGL2 (port propio del GS) | **WebGPU** (aurora ya es WebGPU) |
| Esperas | JSPI en `Web_SleepMs` | JSPI en fin de cuadro, `WaitAny` y cambios de fiber |
| Disco | ISO leído en el lugar (AFS) | Disco Wii **cifrado** → se extrae una vez con `nodtool`; los archivos se sirven por pedido |
| En línea | Lockstep propio por WebRTC | Retro WFC (servidores + P2P UDP): necesita puente |

## 5. Lo que sirve de WheelWizard (reimplementar en JS desde la doc pública, no copiar: GPL)

- Salas en vivo: `GET https://rwfc.net/api/roomstatus` (jugadores, VR/BR, Mii en base64), ranking y perfil por friend code.
- `rksys.dat` (licencias, VR/BR, amigos, CRC32), friend code ↔ PID (MD5 + "JCMR"), Miis de 74 bytes.
- Actualizador de Retro Rewind: `update.rwfc.net/RetroRewind/{RetroRewindVersion,RetroRewindDelete}.txt` + zips delta.
- No sirve: todo lo que lanza procesos, Dolphin, Avalonia. El render de caras Mii usa `FFLResHigh.dat` (de Nintendo).
