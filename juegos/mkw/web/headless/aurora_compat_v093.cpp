// MKW web, N15a (bitácora §170): lo que el runtime v0.9.3 de WiiCompiled le pide a la aurora nueva y la aurora sin
// pantalla (aurora_manual.cpp, modo Node) no tiene. Solo se compila con el runtime nuevo (el que trae guest_abi/): con
// el de siempre este archivo queda vacío.
//
// Resumen: el reparto del cuadro entre «la ventana» y «el hilo de GX» es para el hilo de GX de la v0.9.3, que en la web
// no existe (gx_worker.h deja ShouldDefer() en falso fijo); se responde como si fuera el cuadro entero. Lo demás
// (vsync, tasa del monitor, la ventana de SDL) no tiene sentido sin pantalla: respuestas neutras.
#if __has_include("guest_abi/dispatch.h")
#include <cstdint>

struct AuroraImguiFrame;   // la aurora nueva lo usa para pasar el dibujo de ImGui entre hilos; aquí nunca hay uno
struct SDL_Window;

extern "C" bool aurora_begin_frame();
extern "C" void aurora_end_frame();

extern "C" bool aurora_begin_frame_window() { return aurora_begin_frame(); }   // la mitad de la ventana = el cuadro entero
extern "C" bool aurora_begin_frame_gx() { return true; }                       // y la de GX ya empezó con él
extern "C" AuroraImguiFrame* aurora_end_frame_window() { aurora_end_frame(); return nullptr; }
extern "C" void aurora_end_frame_gx(AuroraImguiFrame*) {}
extern "C" void aurora_release_imgui_frame(AuroraImguiFrame*) {}
extern "C" double aurora_get_display_refresh_rate() { return 60.0; }         // sin monitor: el ritmo de la Wii PAL60
extern "C" bool aurora_display_shows_interpolation() { return false; }       // sin pantalla no hay cuadros intermedios
extern "C" SDL_Window* aurora_get_window() { return nullptr; }
extern "C" void aurora_enable_vsync(bool) {}
extern "C" void AuroraSetGxProducerThread() {}
// la aurora de verdad (navegador) ya la tiene: se salta lo que no tiene su pipeline listo (§29); sin pantalla no hay pipelines
extern "C" void aurora_set_skip_unready_pipelines(bool) {}
#endif
