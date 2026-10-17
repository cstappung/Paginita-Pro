// Envoltorio para el banco: expone el decodificador THP nativo (web/thp/thp_decodificador.cpp) a JavaScript.
// La página / Node le pasa un cuadro hecho por el codificador de prueba (prueba.mjs) y lee las tres texturas.
#include <emscripten.h>

#include "../../../web/thp/thp_decodificador.h"

static thp::Cuadro cuadro;   // ~6 KB de tablas: estático, no en la pila

// Lee la cabecera; devuelve el Resultado (0 = bien) y deja ancho/alto en *ancho/*alto
extern "C" EMSCRIPTEN_KEEPALIVE int thp_cabecera(const uint8_t* datos, int tam, int* ancho, int* alto) {
    cuadro = thp::Cuadro{};
    const thp::Resultado r = thp::leerCabecera(datos, static_cast<size_t>(tam), cuadro);
    *ancho = cuadro.ancho;
    *alto = cuadro.alto;
    return static_cast<int>(r);
}

// Decodifica el cuadro cuya cabecera se leyó con thp_cabecera
extern "C" EMSCRIPTEN_KEEPALIVE int thp_decodificar(const uint8_t* datos, int tam, uint8_t* y, uint8_t* u, uint8_t* v,
                                                    float redondeo) {
    return static_cast<int>(thp::decodificar(datos, static_cast<size_t>(tam), cuadro, y, u, v, redondeo));
}
