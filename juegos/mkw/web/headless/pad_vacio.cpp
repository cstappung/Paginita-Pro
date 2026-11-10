// Modo sin pantalla (Node): lo que en el navegador da web/navegador/pad_web.cpp para los mandos virtuales de la sala
// (§91). Sin página no hay sala: ningún mando virtual y nunca «en la carrera sincronizada». Sin esto el enlace de Node
// fallaba desde §91 (lo usa web/juego/mandos_virtuales_nativo.cpp, que va en los dos modos). Bitácora §153.
#include <cstdint>

struct MkwPadVirtual { uint16_t botones; int8_t sx, sy, cx, cy; uint8_t gl, gr; uint8_t conectado; };
extern "C" MkwPadVirtual g_mkwPadVirtual[12] = {};
extern "C" int mkw_pad_en_carrera() { return 0; }
