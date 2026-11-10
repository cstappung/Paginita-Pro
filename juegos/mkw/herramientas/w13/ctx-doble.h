// W13, el techo (bitácora §216): cada lectura y escritura del contexto de la CPU (ctx->gpr[n], ctx->cr, ctx->lr, …)
// en el código traducido se hace DOS veces. W13 no las saca: solo las abarata (una dirección fija en vez de un puntero:
// V8 podría saltarse la revisión de límites y queda libre un registro). Si hacerlas dos veces no se nota, abaratarlas
// tampoco puede ganar. Solo instrumento: nunca va al programa para jugar.
//
// Resumen: herramientas/w13/techo.py reescribe en una copia del código traducido «r1 = ctx->gpr[1];» como
// «r1 = MKW_CTX_L(ctx->gpr[1]);» y «ctx->gpr[1] = r1;» como «ctx->gpr[1] = r1; MKW_CTX_E(ctx->gpr[1]);». Con
// MKW_W13_TECHO=1 (por omisión) MKW_CTX_L lee dos veces y MKW_CTX_E vuelve a leer y escribir el mismo casillero; entre
// medio, una barrera de memoria (el compilador cree que la memoria pudo cambiar: no puede juntar los dos accesos). La
// barrera estorba un poco más que el acceso solo: el techo sale algo más alto de lo que es, nunca más bajo.
#pragma once
#include "guest_abi/guest_abi.h"

#ifndef MKW_W13_TECHO
#define MKW_W13_TECHO 1
#endif

#include <type_traits>
namespace mkw_ctx {
// guardar: el compilador cree que alguien usa v (no puede borrar la primera lectura por inútil)
template <typename T> inline void guarda(const T& v) {
    if constexpr (std::is_integral_v<T> || std::is_floating_point_v<T>) __asm__ volatile("" : : "r"(v));
    else __asm__ volatile("" : : "r"(&v) : "memory");
}
}  // namespace mkw_ctx

#if MKW_W13_TECHO
#define MKW_CTX_BARRERA() __asm__ volatile("" ::: "memory")
#define MKW_CTX_L(x) ([&]() { auto mkw_v_ = (x); ::mkw_ctx::guarda(mkw_v_); MKW_CTX_BARRERA(); return (x); }())
#define MKW_CTX_E(x) do { MKW_CTX_BARRERA(); (x) = (x); } while (0)
#else
#define MKW_CTX_L(x) (x)
#define MKW_CTX_E(x) do { } while (0)
#endif
