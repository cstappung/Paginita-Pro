// MKW web, N15a (bitácora §170): lo de escritorio que el runtime v0.9.3 de WiiCompiled usa y la web no tiene. Va en los
// dos modos (Node y navegador). Solo se compila con el runtime nuevo (el que trae guest_abi/): con el de siempre queda
// vacío.
//   - posix_spawnp: steam_input_layout.cpp abre el cliente de Steam para cambiar la distribución del mando; en la página
//     no hay Steam ni procesos: siempre «no se pudo» (ENOSYS).
//   - PADGetKeyButtonBindings: «agitar para el truco» (#378, no se adopta) pregunta si el puerto va con teclado; los
//     mandos los pone la página (pad_web.cpp / pad_vacio.cpp): ningún teclado de aurora.
#if __has_include("guest_abi/dispatch.h")
#include <cerrno>
#include <dolphin/pad.h>

extern "C" int posix_spawnp(void*, const char*, const void*, const void*, char* const[], char* const[]) { return ENOSYS; }
extern "C" PADKeyButtonBinding* PADGetKeyButtonBindings(u32, u32* buttonCount) {
    if (buttonCount) *buttonCount = 0;
    return nullptr;
}
#endif
