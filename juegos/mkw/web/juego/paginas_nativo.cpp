// Page::Activate con aviso a la página web: esconder botones del juego que aquí no sirven — bitácora §66.
//
// Resumen: cada pantalla de los menús del juego es una "página" (Page). Cuando una se pone al frente, el juego llama a
// Page::Activate (0x80601AEC), que prepara sus botones (OnActivate). Esta versión llama a la del juego y, justo
// después, avisa a la página web (Module.mkwAlActivarPagina(dirección de la página)). La página (ocultar.mjs) mira qué
// pantalla es y esconde lo que no corresponde, por ejemplo «Retro WFC» fuera de la sala del sitio o los «Settings» de
// Retro Rewind. Como el aviso llega ANTES del primer dibujo de esa pantalla, lo escondido no alcanza a verse.
// Sin Module.mkwAlActivarPagina (Node, pruebas) queda exactamente lo del juego.
//
// Cómo se engancha: igual que semillas_nativo.cpp (compilar-web.py, REEMPLAZOS): la traducida pasa a llamarse
// func_80601AEC_traducida y esta define func_80601AEC, así le llegan todas las llamadas.
#include "ppc_runtime.h"

#include <emscripten/emscripten.h>

extern "C" void func_80601AEC_traducida(CpuContext* ctx);   // la del juego, con el nombre cambiado

EM_JS(void, mkw_web_pagina_activa, (uint32_t pagina), {
    if (Module.mkwAlActivarPagina) Module.mkwAlActivarPagina(pagina >>> 0);
});

extern "C" void func_80601AEC(CpuContext* MKW_RESTRICT ctx) {
    const uint32_t pagina = ctx->gpr[3];                    // r3 = this (la página), antes de que la función lo cambie
    func_80601AEC_traducida(ctx);
    mkw_web_pagina_activa(pagina);
}
