// Decodificador de cuadros de video THP, escrito desde cero a partir del formato público (JPEG de línea base).
//
// Resumen: un cuadro de un video THP es una imagen JPEG "de línea base" (la forma más común de JPEG) con dos
// particularidades: los bytes 0xFF dentro de los datos comprimidos NO llevan el 0x00 de relleno que exige el JPEG
// normal, y el resultado no se entrega como imagen sino como tres texturas de la GPU de la Wii en formato I8
// (un byte por píxel, acomodado en "baldosas" de 8×4 píxeles): Y (brillo) a tamaño completo, U y V (color) a la
// mitad de ancho y de alto. Este archivo no sabe nada del juego ni del runtime: recibe bytes y devuelve bytes, así
// el banco (banco/pruebas/thp) lo prueba con cuadros falsos hechos por su propio codificador.
#pragma once

#include <cstddef>
#include <cstdint>

namespace thp {

enum class Resultado {
    Bien = 0,
    NoSoportado,   // algo válido en JPEG que este decodificador no hace (progresivo, 4:2:2, reinicios…)
    Corrupto,      // los datos no tienen sentido (tabla mala, código de Huffman inexistente…)
    FaltaEntrada,  // se acabaron los bytes antes de terminar: pedir más y volver a intentar
};

// Una tabla de Huffman lista para decodificar (ver thp_decodificador.cpp)
struct TablaHuffman {
    uint16_t rapida[512];     // los códigos de hasta 9 bits, de un solo vistazo: (largo << 8) | símbolo; 0 = más largo
    int32_t maxcodigo[18];    // para los códigos largos (10..16 bits): el código más alto de cada largo, o -1
    int32_t mincodigo[17];    // el código más bajo de cada largo
    int32_t primero[17];      // dónde empiezan en "simbolos" los de cada largo
    uint8_t simbolos[256];
    bool cargada;
};

// Lo que dice la cabecera del cuadro, y las tablas ya preparadas
struct Cuadro {
    int ancho = 0, alto = 0;  // en píxeles (múltiplos de 16)
    size_t inicioDatos = 0;   // dónde empiezan los datos comprimidos (después del marcador SOS)
    float cuant[4][64];       // tablas de cuantización ya multiplicadas por los factores de la IDCT (orden natural)
    bool cuantCargada[4] = {};
    TablaHuffman dc[4], ac[4];
    int tablaCuant[3] = {}, tablaDc[3] = {}, tablaAc[3] = {};  // Y, U, V
};

// Lee los marcadores del JPEG hasta el comienzo de los datos comprimidos.
Resultado leerCabecera(const uint8_t* datos, size_t tam, Cuadro& cuadro);

// Decodifica el cuadro completo. "datos" debe tener 8 bytes legibles más allá de "tam" (se leen de a 8).
// y: ancho×alto bytes; u y v: (ancho/2)×(alto/2) bytes cada una; las tres en formato I8 de la GPU de la Wii.
// redondeo: lo que se suma antes de cortar los decimales (0.5 = redondear al más cercano).
Resultado decodificar(const uint8_t* datos, size_t tam, const Cuadro& cuadro, uint8_t* y, uint8_t* u, uint8_t* v,
                      float redondeo = 0.5f);

}  // namespace thp
