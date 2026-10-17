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
#include <dolphin/pad.h>

#include <emscripten.h>

#include <cstring>

namespace {
PADStatus g_pad[PAD_CHANMAX]{};   // el último estado que mandó la página, por puerto
bool g_conectado[PAD_CHANMAX]{};  // ¿hay un mando en ese puerto?
}  // namespace

// La página llama a esto: estado completo de un mando de GameCube.
//   botones: bits PAD_BUTTON_* (A 0x100, B 0x200, X 0x400, Y 0x800, START 0x1000, Z 0x10, R 0x20, L 0x40, cruz 0x1-0x8)
//   sx, sy: stick principal (-128..127, +y = arriba);  cx, cy: stick C;  gl, gr: gatillos analógicos (0..255)
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_web_pad(int puerto, int conectado, int botones, int sx, int sy, int cx,
                                                 int cy, int gl, int gr)
{
    if (puerto < 0 || puerto >= PAD_CHANMAX) return;
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
