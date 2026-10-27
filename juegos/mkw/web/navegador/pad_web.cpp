// Mandos de GameCube para la versión navegador: la página es la que "aprieta los botones".
//
// Resumen: el juego lee sus mandos con PADRead (el runtime lo engancha en runtime/src/hle/input/pad.cpp y escribe
// el resultado en la memoria de la Wii). En el PC, PADRead viene de aurora (lib/dolphin/pad/pad.cpp), que lee los
// mandos con SDL. En la web esa pieza se reemplaza por esta: la página (web/navegador/controles.mjs) junta teclado,
// mandos (Gamepad API) y el mando táctil del celular, y en cada refresco llama a mkw_web_pad(...) con el estado
// completo de un mando de GameCube por puerto (1 a 4 jugadores). PADRead solo devuelve eso.
//
// También reenvía la vibración que pide el juego (PADControlMotor) a la página (Module.mkwVibrar), que la pasa al
// mando (vibrationActuator) o al celular (navigator.vibrate).
//
// Solo están las funciones de PAD que usa el runtime (las demás son del menú F10 y del asistente de mandos, que en
// la web no se compilan).
//
// La carrera sincronizada de la sala con CPU (lockstep, bitácora §61): todas las consolas de la sala corren la misma
// carrera offline a la vez (12 karts: los humanos de la sala y CPU) y para que salga igual en todas, cada cuadro todas
// usan los MISMOS botones de cada humano. Durante la carrera (sección VS), cada vez que el juego lee los mandos en un
// cuadro nuevo, PADRead le pregunta a la página (Module.mkwLockstep.pad, lockstep.mjs) los botones de todos para ese
// cuadro y ESPERA (JSPI suspende el juego) hasta tenerlos: llegan de los otros navegadores por la malla WebRTC. Cada
// humano maneja "su" puerto (el mismo en todas las consolas): el juego cree que su kart es un CPU (así no arma
// pantalla dividida) pero el kart lee ese mando (semillas_nativo.cpp); aquí además se le apaga al kart la marca de CPU
// (si no, el juego le da la largada automática de los CPU).
// §91 (C9): hasta 12 humanos. Los mandos de la sala 0..g_mkwPuertos-1 van a los puertos de verdad; los demás son
// "mandos virtuales": sus botones quedan en g_mkwPadVirtual y mandos_virtuales_nativo.cpp los pasa al portador
// virtual del kart de ese humano (el juego no tiene más de 4 puertos).
#include <dolphin/pad.h>

#include <emscripten.h>

#include <cstring>

#include "memory.h"

namespace {
PADStatus g_pad[PAD_CHANMAX]{};   // el último estado que mandó la página, por puerto
bool g_conectado[PAD_CHANMAX]{};  // ¿hay un mando en ese puerto?
}  // namespace

// ---- carrera sincronizada ----
extern "C" int g_mkwRelojFijo;                       // ppc_helpers.cpp: la carrera sincronizada está armada
extern "C" uint32_t g_mkwHumanos;                    // semillas_nativo.cpp: bit i = el puesto i es un humano de la sala
extern "C" int g_mkwMiPuesto;                        // semillas_nativo.cpp: mi puesto (el HUD lo muestra, lockstep_nativo.cpp)
extern "C" int g_mkwVistaPropia;                     // semillas_nativo.cpp: bit 1 = la cámara sigue a mi kart
extern "C" int8_t g_mkwPuestoDeMando[12];            // semillas_nativo.cpp: mando → puesto de su kart
extern "C" int g_mkwPuertos;                         // semillas_nativo.cpp: los mandos de la sala con puerto de verdad
// §91: los botones de los mandos virtuales (los de la sala sin puerto), para mandos_virtuales_nativo.cpp
struct MkwPadVirtual { uint16_t botones; int8_t sx, sy, cx, cy; uint8_t gl, gr; uint8_t conectado; };
extern "C" MkwPadVirtual g_mkwPadVirtual[12] = {};
extern "C" uint32_t g_mkwCortados;                   // semillas_nativo.cpp: bit i = el humano del puesto i se fue
// La carrera terminó: la página vuelve a mandar sus mandos (controles.reenviar)
EM_JS(void, mkw_web_lockstep_fin, (), { if (Module.mkwLockstepFin) Module.mkwLockstepFin(); });

// El puesto de esta consola en la carrera sincronizada (Module.mkwMiPuesto, -1 = no hay)
EM_JS(int, mkw_web_mi_puesto, (), { const v = Module.mkwMiPuesto && Module.mkwMiPuesto(); return (v === null || v === undefined) ? -1 : v | 0; });
// ¿Hay carrera sincronizada en la página?
EM_JS(int, mkw_web_lockstep_hay, (), { return Module.mkwLockstep ? 1 : 0; });
// Los botones de los mandos de la sala para el cuadro `cuadro` (espera hasta tenerlos). datos: 12 × 8 enteros
// (conectado, botones, sx, sy, cx, cy, gl, gr), uno por mando de la sala (§91: antes 4). Devuelve 1 si los escribió.
EM_ASYNC_JS(int, mkw_web_lockstep_pad, (int cuadro, int32_t* datos), {
    const v = await Module.mkwLockstep.pad(cuadro);
    if (!v) return 0;
    for (let i = 0; i < 96; i++) HEAP32[(datos >> 2) + i] = i < v.length ? v[i] | 0 : 0;
    return 1;
});

namespace {
uint32_t g_lsRaceinfo = 0;       // el Raceinfo de la carrera en curso (cambia con cada carrera)
int64_t g_lsCuadro = -1;         // el último cuadro que se pidió
bool g_lsMarcas = false;         // ¿ya se les apagó la marca de CPU a los karts de los humanos?
int32_t g_lsDatos[96];
int g_lsMio = -1;                // mi puesto (la cámara lo sigue)
bool g_lsEnCarrera = false;      // ¿el último PADRead fue de la carrera sincronizada?

// El cuadro de la carrera: Raceinfo (0x809BD730) +0x1E cuenta la presentación y +0x20 la carrera (uno se queda
// quieto mientras corre el otro). -1 si no hay carrera sincronizada en curso (menús, cargas, la presentación 0x1A).
bool EsPuntero(uint32_t p) { return (p >= 0x80000000u && p < 0x81800000u) || (p >= 0x90000000u && p < 0x94000000u); }

int64_t CuadroDeCarrera()
{
    if (!g_mkwRelojFijo) return -1;
    const uint32_t sm = Memory::Read32(0x809C1E38);                    // SectionMgr
    if (!EsPuntero(sm)) return -1;
    const uint32_t sec = Memory::Read32(sm);
    if (!EsPuntero(sec) || Memory::Read32(sec) != 0x20) return -1;     // solo VS
    const uint32_t ri = Memory::Read32(0x809BD730);
    if (!EsPuntero(ri)) return -1;
    // Raceinfo +0x28 = etapa (0 presentación, 1 cuenta regresiva, 2 carrera, 4 terminó). Terminada, lo que sigue son
    // las pantallas de resultados (menús, no cambian la carrera siguiente): cada consola sigue con su mando
    // Carrera nueva: otro Raceinfo, o el mismo de nuevo en etapa < 4 después de haber terminado (en la copa la carrera
    // siguiente se arma con un "Scene Restart" y el Raceinfo nuevo puede quedar en la MISMA dirección, §62).
    static bool terminada = false;
    const uint32_t etapa = Memory::Read32(ri + 0x28);
    if (ri == g_lsRaceinfo && etapa >= 4) { terminada = true; return -1; }
    if (ri != g_lsRaceinfo || terminada) {
        terminada = false;
        g_lsRaceinfo = ri; g_lsCuadro = -1; g_lsMarcas = false; g_lsMio = g_mkwMiPuesto = mkw_web_mi_puesto();
    }
    // +0x1C: los 16 bits de abajo (+0x1E) cuentan la presentación/cuenta regresiva; el byte de arriba son marcas que se
    // prenden al terminar la carrera (0x0C…), así que se leen solo los 16 de abajo. +0x20 cuenta la carrera.
    return static_cast<int64_t>(Memory::Read16(ri + 0x1E)) + Memory::Read32(ri + 0x20);
}

// Kart::Link::IsCPU lee el bit 0 de las marcas del kart (KartObjectManager 0x809C18F8 → +0x20 lista → kart →
// +0 → +4 ajustes → +0x14). A los humanos: sin la marca de CPU (bit 0) y con la de jugador local (bit 1), igual en
// todas las consolas.
void MarcarHumanos()
{
    const uint32_t kom = Memory::Read32(0x809C18F8);
    if (!EsPuntero(kom)) return;
    const uint32_t lista = Memory::Read32(kom + 0x20);
    if (!EsPuntero(lista)) return;
    for (int i = 0; i < 12; i++) {
        if (!(g_mkwHumanos & (1u << i))) continue;
        const uint32_t kart = Memory::Read32(lista + 4 * i);
        if (!EsPuntero(kart)) return;
        const uint32_t ajustes = Memory::Read32(Memory::Read32(kart) + 4);
        Memory::Write32(ajustes + 0x14, (Memory::Read32(ajustes + 0x14) & ~1u) | 2u);
    }
    g_lsMarcas = true;
}

// La cámara sigue a mi kart: RaceCameraMgr (0x809C19B8) +0x18 lista de cámaras → la primera, +0x9C = el puesto que
// sigue. Solo eso cambia entre consolas: la tabla de pantallas de Racedata (que mira la lógica) queda igual en todas.
void CamaraAMiKart()
{
    if (g_lsMio < 0 || g_lsMio >= 12 || !(g_mkwVistaPropia & 2)) return;
    const uint32_t mgr = Memory::Read32(0x809C19B8);
    if (!EsPuntero(mgr)) return;
    const uint32_t lista = Memory::Read32(mgr + 0x18);
    if (!EsPuntero(lista)) return;
    const uint32_t cam = Memory::Read32(lista);
    if (EsPuntero(cam) && Memory::Read8(cam + 0x9C) != g_lsMio) Memory::Write8(cam + 0x9C, static_cast<uint8_t>(g_lsMio));
}
}  // namespace

// La página llama a esto: estado completo de un mando de GameCube.
//   botones: bits PAD_BUTTON_* (A 0x100, B 0x200, X 0x400, Y 0x800, START 0x1000, Z 0x10, R 0x20, L 0x40, cruz 0x1-0x8)
//   sx, sy: stick principal (-128..127, +y = arriba);  cx, cy: stick C;  gl, gr: gatillos analógicos (0..255)
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_web_pad(int puerto, int conectado, int botones, int sx, int sy, int cx,
                                                 int cy, int gl, int gr)
{
    if (puerto < 0 || puerto >= PAD_CHANMAX) return;
    if (g_lsCuadro >= 0 && g_lsRaceinfo && CuadroDeCarrera() >= 0) return;   // en la carrera sincronizada manda la página por PADRead
    g_conectado[puerto] = conectado != 0;
    PADStatus& p = g_pad[puerto];
    p.button = static_cast<u16>(botones);
    p.stickX = static_cast<s8>(sx);
    p.stickY = static_cast<s8>(sy);
    p.substickX = static_cast<s8>(cx);
    p.substickY = static_cast<s8>(cy);
    p.triggerL = static_cast<u8>(gl);
    p.triggerR = static_cast<u8>(gr);
    p.analogA = 0;
    p.analogB = 0;
}

// La vibración que pide el juego, hacia la página: cmd 0 = parar, 1 = vibrar, 2 = parar en seco
EM_JS(void, mkw_web_vibrar, (int puerto, int cmd), {
    if (Module.mkwVibrar) Module.mkwVibrar(puerto, cmd);
});

extern "C" BOOL PADInit() { return TRUE; }

extern "C" u32 PADRead(PADStatus* status)
{
    // carrera sincronizada: en cada cuadro nuevo, los botones de todos (de la página, esperando si faltan)
    const int64_t cuadro = mkw_web_lockstep_hay() ? CuadroDeCarrera() : -1;
    if (cuadro < 0 && g_lsEnCarrera) {
        // terminó la carrera: los puertos vuelven a ser de la página (los de los otros humanos quedaban con sus
        // últimos botones, que los menús de resultados podrían leer); la página vuelve a mandar los suyos
        g_lsEnCarrera = false;
        for (int i = 0; i < PAD_CHANMAX; ++i) { g_pad[i] = PADStatus{}; g_conectado[i] = false; }
        for (auto& v : g_mkwPadVirtual) v = MkwPadVirtual{};
        mkw_web_lockstep_fin();
    }
    if (cuadro >= 0) {
        g_lsEnCarrera = true;
        if (!g_lsMarcas) MarcarHumanos();
        CamaraAMiKart();
        if (cuadro != g_lsCuadro && mkw_web_lockstep_pad(static_cast<int>(cuadro), g_lsDatos)) {
            g_lsCuadro = cuadro;
            for (int i = 0; i < 12; ++i) {
                const int32_t* d = g_lsDatos + i * 8;
                // d[0] == 2: ese humano se fue; su kart sigue sin nadie y la carrera ya no lo espera para terminar
                const int puesto = g_mkwPuestoDeMando[i];
                if (d[0] == 2 && puesto >= 0 && puesto < 12) g_mkwCortados |= 1u << puesto;
                if (i >= g_mkwPuertos || i >= PAD_CHANMAX) {   // §91: mando virtual (sin puerto)
                    MkwPadVirtual& v = g_mkwPadVirtual[i];
                    v.conectado = static_cast<uint8_t>(d[0]);
                    v.botones = static_cast<uint16_t>(d[1]);
                    v.sx = static_cast<int8_t>(d[2]); v.sy = static_cast<int8_t>(d[3]);
                    v.cx = static_cast<int8_t>(d[4]); v.cy = static_cast<int8_t>(d[5]);
                    v.gl = static_cast<uint8_t>(d[6]); v.gr = static_cast<uint8_t>(d[7]);
                    continue;
                }
                g_conectado[i] = d[0] != 0;
                g_pad[i].button = static_cast<u16>(d[1]);
                g_pad[i].stickX = static_cast<s8>(d[2]); g_pad[i].stickY = static_cast<s8>(d[3]);
                g_pad[i].substickX = static_cast<s8>(d[4]); g_pad[i].substickY = static_cast<s8>(d[5]);
                g_pad[i].triggerL = static_cast<u8>(d[6]); g_pad[i].triggerR = static_cast<u8>(d[7]);
                g_pad[i].analogA = g_pad[i].analogB = 0;
            }
        }
    }
    u32 conVibracion = 0;  // un bit por puerto conectado: "este mando puede vibrar" (como el aurora original)
    for (int i = 0; i < PAD_CHANMAX; ++i) {
        if (status) {
            status[i] = g_pad[i];
            status[i].err = g_conectado[i] ? PAD_ERR_NONE : PAD_ERR_NO_CONTROLLER;
        }
        if (g_conectado[i]) conVibracion |= PAD_CHAN0_BIT >> i;
    }
    return conVibracion;
}

// §91: ¿la carrera sincronizada está en curso? (mandos_virtuales_nativo.cpp solo alimenta los virtuales entonces)
extern "C" int mkw_pad_en_carrera() { return g_lsEnCarrera && g_lsCuadro >= 0 ? 1 : 0; }

extern "C" BOOL PADReset(u32) { return TRUE; }
extern "C" BOOL PADRecalibrate(u32) { return TRUE; }
extern "C" void PADControlMotor(u32 chan, u32 cmd) { mkw_web_vibrar(static_cast<int>(chan), static_cast<int>(cmd)); }

extern "C" u32 PADCount()
{
    u32 n = 0;
    for (bool c : g_conectado) n += c ? 1 : 0;
    return n;
}
extern "C" s32 PADGetIndexForPort(u32 port) { return port < PAD_CHANMAX && g_conectado[port] ? static_cast<s32>(port) : -1; }
extern "C" const char* PADGetNameForControllerIndex(u32 idx)
{
    static const char* const kNombres[PAD_CHANMAX] = {"Mando web 1", "Mando web 2", "Mando web 3", "Mando web 4"};
    return idx < PAD_CHANMAX ? kNombres[idx] : nullptr;
}
// Sin SDL ni mapeos: el mapeo de teclas y botones lo hace la página
extern "C" PADButtonMapping* PADGetButtonMappings(u32, u32* count) { if (count) *count = 0; return nullptr; }
extern "C" PADButtonMapping* PADGetAltButtonMappings(u32, u32* count) { if (count) *count = 0; return nullptr; }
extern "C" struct SDL_Gamepad* PADGetSDLGamepadForIndex(u32) { return nullptr; }
