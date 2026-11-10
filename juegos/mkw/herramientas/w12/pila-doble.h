// W12, el techo (bitácora §215): cada acceso a la pila de la Wii (dirección r1 + k) se hace DOS veces.
// Lo que el programa se frena con esto ≈ lo que cuestan hoy esos accesos ≈ lo máximo que W12 puede ganar (W12 los
// saca enteros: pasan a ser variables de C++). Solo instrumento: nunca va al programa para jugar.
//
// Resumen: herramientas/w12/techo.py reescribe en una copia del código traducido «MemoryInline::FlatRead32((r1 + 8))»
// como «MKW_PILA(MemoryInline::FlatRead32)((r1 + 8))». Este archivo (con -include, compilar-web.py --frio) define
// MKW_PILA: una función sin nombre que llama dos veces a la de siempre, con una «barrera» entre las dos (le dice al
// compilador que los argumentos pudieron cambiar, así no junta las dos llamadas en una) y guardando el primer resultado
// (así no borra la primera lectura por inútil). Con MKW_W12_TECHO=0 es la función de siempre: el mismo programa que H6.
#pragma once
#include "guest_abi/guest_abi.h"
#include <type_traits>

#ifndef MKW_W12_TECHO
#define MKW_W12_TECHO 1
#endif

namespace mkw_pila {
// la barrera: el compilador cree que x cambió (no puede reusar la cuenta de antes)
template <typename T> inline void barrera(T& x) {
    if constexpr (std::is_integral_v<T> || std::is_floating_point_v<T>) __asm__ volatile("" : "+r"(x));
}
// guardar: el compilador cree que alguien usa x (no puede borrar la lectura que lo dio)
template <typename T> inline void guarda(const T& x) {
    if constexpr (std::is_integral_v<T> || std::is_floating_point_v<T>) __asm__ volatile("" : : "r"(x));
}
}  // namespace mkw_pila

#if MKW_W12_TECHO
#define MKW_PILA(F) ([](auto... a) -> decltype(auto) {                                  \
    if constexpr (std::is_void_v<decltype(F(a...))>) {                                   \
        F(a...); (::mkw_pila::barrera(a), ...); F(a...);                                 \
    } else {                                                                             \
        auto v = F(a...); ::mkw_pila::guarda(v); (::mkw_pila::barrera(a), ...);          \
        return F(a...);                                                                  \
    } })
#else
#define MKW_PILA(F) F
#endif
