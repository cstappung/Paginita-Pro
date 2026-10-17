// Decodificador de cuadros THP (ver thp_decodificador.h). Escrito desde cero con el estándar JPEG (ITU T.81) y la
// IDCT de Arai, Agui y Nakajima (1988); no copia código de Nintendo ni de otros decodificadores.
//
// Cómo se decodifica un JPEG de línea base, en cuatro pasos (se repiten para cada bloque de 8×8 píxeles):
//   1. Huffman: los datos son una tira de bits con códigos de largo variable (los valores frecuentes, más cortos).
//      Cada código dice cuántos ceros saltar y cuántos bits leer para el número siguiente.
//   2. Descuantizar: cada número se multiplica por su escalón de la tabla de cuantización (el codificador los había
//      dividido para ahorrar bits; es como volver a amplificar una señal que se atenuó por bandas).
//   3. IDCT: los 64 números son la "receta en frecuencia" del bloque (cuánto de cada patrón coseno); la IDCT los
//      vuelve a sumar para obtener los 64 píxeles. Es la transformada de Fourier inversa, con cosenos y en 2D.
//   4. Guardar: sumar 128 (los píxeles se codifican centrados en cero), recortar a 0..255 y escribir el bloque en la
//      textura, que la GPU de la Wii quiere en baldosas de 8×4.
// Un "MCU" (unidad mínima) de un THP son 16×16 píxeles: 4 bloques de Y + 1 de U + 1 de V (el color va a la mitad
// de resolución, 4:2:0).
#include "thp_decodificador.h"

#include <cmath>
#include <cstring>

namespace thp {
namespace {

// Orden zigzag: el k-ésimo número del bloque comprimido va a la posición natural zigzag[k] (fila × 8 + columna).
// El zigzag recorre el bloque de las frecuencias bajas a las altas, así los ceros del final quedan juntos.
constexpr uint8_t kZigzag[64] = {
    0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5,
    12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
    35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51,
    58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63};

constexpr double kPi = 3.14159265358979323846;

uint32_t leer16(const uint8_t* p) { return (uint32_t(p[0]) << 8) | p[1]; }

// ---------------------------------------------------------------------------------------------------------------
// Tablas de Huffman (T.81 anexo C): de "cuántos códigos hay de cada largo" + "los símbolos en orden" se reconstruyen
// los códigos (códigos "canónicos": cada uno es el anterior + 1, y al pasar a un largo mayor se corre un bit).
// ---------------------------------------------------------------------------------------------------------------
bool armarTabla(TablaHuffman& t, const uint8_t cuantos[16], const uint8_t* simbolos, int total) {
    std::memset(&t, 0, sizeof(t));
    std::memcpy(t.simbolos, simbolos, total);
    int codigo = 0, k = 0;
    for (int largo = 1; largo <= 16; ++largo) {
        t.primero[largo] = k;
        t.mincodigo[largo] = codigo;
        for (int i = 0; i < cuantos[largo - 1]; ++i, ++k, ++codigo) {
            if (largo <= 9) {
                // Todos los "vistazos" de 9 bits que empiezan con este código dan este símbolo
                const int desde = codigo << (9 - largo), hasta = (codigo + 1) << (9 - largo);
                for (int j = desde; j < hasta; ++j)
                    t.rapida[j] = static_cast<uint16_t>((largo << 8) | simbolos[k]);
            }
        }
        t.maxcodigo[largo] = cuantos[largo - 1] ? codigo - 1 : -1;
        if (codigo > (1 << largo)) return false;   // más códigos de los que caben en "largo" bits: tabla rota
        codigo <<= 1;
    }
    t.maxcodigo[17] = 0x7FFFFFFF;   // centinela
    t.cargada = true;
    return true;
}

// ---------------------------------------------------------------------------------------------------------------
// Lector de bits: guarda hasta 64 bits "por delante" en un registro, el primero arriba (como un registro de
// desplazamiento que se rellena de a bytes por la derecha). Sin relleno 0xFF00: en THP cada byte es dato.
// ---------------------------------------------------------------------------------------------------------------
struct LectorBits {
    const uint8_t* datos;
    size_t tam, pos;      // pos = el próximo byte que entra al registro
    uint64_t reg = 0;     // los bits por leer, alineados arriba
    int cuenta = 0;       // cuántos bits válidos tiene reg

    // Rellenar a 56..63 bits. Camino rápido: leer 8 bytes de una vez (hay 8 bytes legibles después de tam) y
    // avanzar solo los bytes que entraron (técnica de F. Giesen, "Reading bits in far too many ways").
    inline void rellenar() {
        if (pos + 8 <= tam) [[likely]] {
            uint64_t ocho;
            std::memcpy(&ocho, datos + pos, 8);
            ocho = __builtin_bswap64(ocho);              // los datos vienen con el primer byte primero
            reg |= ocho >> cuenta;
            pos += (63 - cuenta) >> 3;
            cuenta |= 56;
            return;
        }
        while (cuenta <= 56) {                          // cerca del final: de a un byte, con ceros después
            const uint64_t b = pos < tam ? datos[pos] : 0;
            ++pos;
            reg |= b << (56 - cuenta);
            cuenta += 8;
        }
    }
    // ¿Se USARON bits más allá de tam? (los que solo entraron al registro por adelantado no cuentan)
    inline bool agotado() const { return pos * 8 - cuenta > tam * 8; }
    inline uint32_t mirar(int n) const { return static_cast<uint32_t>(reg >> (64 - n)); }
    inline void consumir(int n) { reg <<= n; cuenta -= n; }

    // Un símbolo de Huffman; -1 si el código no existe en la tabla (datos corruptos)
    inline int simbolo(const TablaHuffman& t) {
        if (cuenta < 16) rellenar();
        const uint16_t r = t.rapida[mirar(9)];
        if (r) [[likely]] {
            consumir(r >> 8);
            return r & 0xFF;
        }
        for (int largo = 10; largo <= 16; ++largo) {
            const int32_t c = static_cast<int32_t>(mirar(largo));
            if (c <= t.maxcodigo[largo]) {
                consumir(largo);
                return t.simbolos[t.primero[largo] + c - t.mincodigo[largo]];
            }
        }
        return -1;
    }
    // "RECEIVE + EXTEND" de T.81: n bits que forman un número con signo (los que empiezan con 0 son negativos)
    inline int valor(int n) {
        if (n == 0) return 0;
        if (cuenta < n) rellenar();
        const int v = static_cast<int>(mirar(n));
        consumir(n);
        return v < (1 << (n - 1)) ? v - (1 << n) + 1 : v;
    }
};

// ---------------------------------------------------------------------------------------------------------------
// IDCT de 8×8 con vectores de 4 números (en wasm: SIMD, 4 cuentas por instrucción). Un bloque son 8 filas, cada
// una en dos vectores: I = columnas 0..3, D = columnas 4..7.
// ---------------------------------------------------------------------------------------------------------------
typedef float f4 __attribute__((vector_size(16)));
typedef int32_t i4 __attribute__((vector_size(16)));
typedef uint8_t u8x4 __attribute__((vector_size(4)));

// IDCT de 8 puntos (Arai–Agui–Nakajima): 5 multiplicaciones y 29 sumas en vez de 64 multiplicaciones. Las
// multiplicaciones que faltan ya están metidas en la tabla de cuantización (ver prepararCuant). Cada vector lleva 4
// columnas (o 4 filas) a la vez: el mismo "circuito" aplicado a 4 señales en paralelo.
inline void idct8(f4 v[8]) {
    // Parte par (entradas 0, 2, 4, 6)
    const f4 p10 = v[0] + v[4], p11 = v[0] - v[4];
    const f4 p13 = v[2] + v[6];
    const f4 p12 = (v[2] - v[6]) * 1.414213562f - p13;
    const f4 e0 = p10 + p13, e3 = p10 - p13, e1 = p11 + p12, e2 = p11 - p12;
    // Parte impar (entradas 1, 3, 5, 7)
    const f4 z13 = v[5] + v[3], z10 = v[5] - v[3], z11 = v[1] + v[7], z12 = v[1] - v[7];
    const f4 o7 = z11 + z13;
    const f4 o11 = (z11 - z13) * 1.414213562f;
    const f4 z5 = (z10 + z12) * 1.847759065f;
    const f4 o10 = z5 - z12 * 1.082392200f;
    const f4 o12 = z5 - z10 * 2.613125930f;
    const f4 o6 = o12 - o7;
    const f4 o5 = o11 - o6;
    const f4 o4 = o10 - o5;
    v[0] = e0 + o7; v[7] = e0 - o7;
    v[1] = e1 + o6; v[6] = e1 - o6;
    v[2] = e2 + o5; v[5] = e2 - o5;
    v[3] = e3 + o4; v[4] = e3 - o4;
}

// Trasponer 4×4 (filas ↔ columnas) con barajados de vectores
inline void trasponer4(f4& a, f4& b, f4& c, f4& d) {
    const f4 t0 = __builtin_shufflevector(a, b, 0, 4, 1, 5), t1 = __builtin_shufflevector(a, b, 2, 6, 3, 7);
    const f4 t2 = __builtin_shufflevector(c, d, 0, 4, 1, 5), t3 = __builtin_shufflevector(c, d, 2, 6, 3, 7);
    a = __builtin_shufflevector(t0, t2, 0, 1, 4, 5); b = __builtin_shufflevector(t0, t2, 2, 3, 6, 7);
    c = __builtin_shufflevector(t1, t3, 0, 1, 4, 5); d = __builtin_shufflevector(t1, t3, 2, 3, 6, 7);
}

// Trasponer el bloque de 8×8: los cuatro cuadrantes se trasponen y los dos de la diagonal secundaria se cambian
inline void trasponer8(f4 I[8], f4 D[8]) {
    trasponer4(I[0], I[1], I[2], I[3]);
    trasponer4(D[4], D[5], D[6], D[7]);
    trasponer4(D[0], D[1], D[2], D[3]);
    trasponer4(I[4], I[5], I[6], I[7]);
    for (int r = 0; r < 4; ++r) { const f4 t = D[r]; D[r] = I[r + 4]; I[r + 4] = t; }
}

// De número a píxel: + 128 + redondeo, recortar a 0..255, a entero, a byte
inline u8x4 aPixel(f4 x, f4 desplazamiento) {
    x = x + desplazamiento;
    x = x > 0.0f ? x : f4{0, 0, 0, 0};
    x = x < 255.0f ? x : f4{255, 255, 255, 255};
    return __builtin_convertvector(__builtin_convertvector(x, i4), u8x4);
}

// IDCT del bloque (coeficientes ya descuantizados, orden natural) y escritura en la textura I8: las filas 0..3 del
// bloque son una baldosa de 8×4 (32 bytes seguidos) y las filas 4..7 la baldosa de abajo.
inline void idctYGuardar(const float coef[64], uint8_t* baldosaArriba, uint8_t* baldosaAbajo, float redondeo) {
    f4 I[8], D[8];
    for (int r = 0; r < 8; ++r) {
        std::memcpy(&I[r], coef + r * 8, 16);
        std::memcpy(&D[r], coef + r * 8 + 4, 16);
    }
    idct8(I); idct8(D);       // columnas
    trasponer8(I, D);
    idct8(I); idct8(D);       // filas
    trasponer8(I, D);
    const float d = 128.0f + redondeo;
    const f4 desplazamiento = {d, d, d, d};
    for (int r = 0; r < 8; ++r) {
        uint8_t* fila = (r < 4 ? baldosaArriba : baldosaAbajo) + (r & 3) * 8;
        const u8x4 a = aPixel(I[r], desplazamiento), b = aPixel(D[r], desplazamiento);
        std::memcpy(fila, &a, 4);
        std::memcpy(fila + 4, &b, 4);
    }
}

// Bloque sin frecuencias altas (solo el promedio, "DC"): todos los píxeles iguales. Da exactamente lo mismo que la
// IDCT completa (con solo la entrada 0, la IDCT de arriba no hace más que copiarla), sin hacer las cuentas.
inline void llenarYGuardar(float dc, uint8_t* baldosaArriba, uint8_t* baldosaAbajo, float redondeo) {
    float x = dc + 128.0f + redondeo;
    x = x > 0.0f ? x : 0.0f;
    x = x < 255.0f ? x : 255.0f;
    const uint8_t p = static_cast<uint8_t>(static_cast<int>(x));
    std::memset(baldosaArriba, p, 32);
    std::memset(baldosaAbajo, p, 32);
}

// Factores de la IDCT de AAN que se meten en la tabla de cuantización: s[0] = 1, s[k] = √2·cos(kπ/16); y /8 por
// las dos pasadas (cada IDCT de 8 puntos de AAN deja el resultado 8 veces... ver T.81 A.3.3: el 1/4 de la fórmula
// por 1/2 de cada C(0) = 1/√2 al cuadrado).
void prepararCuant(float salida[64], const uint8_t zz[64]) {
    double s[8];
    s[0] = 1.0;
    for (int k = 1; k < 8; ++k) s[k] = std::cos(k * kPi / 16.0) * std::sqrt(2.0);
    for (int k = 0; k < 64; ++k) {
        const int n = kZigzag[k], fila = n >> 3, col = n & 7;
        salida[n] = static_cast<float>(zz[k] * s[fila] * s[col] / 8.0);
    }
}

// Escribe el bloque (bx, by) (en bloques de 8×8) de una textura I8 de "ancho" píxeles
struct Plano {
    uint8_t* base;
    int baldosasPorFila;   // ancho / 8
    inline uint8_t* arriba(int bx, int by) const { return base + (size_t(2 * by) * baldosasPorFila + bx) * 32; }
    inline uint8_t* abajo(int bx, int by) const { return base + (size_t(2 * by + 1) * baldosasPorFila + bx) * 32; }
};

}  // namespace

// ---------------------------------------------------------------------------------------------------------------
Resultado leerCabecera(const uint8_t* d, size_t tam, Cuadro& c) {
    if (tam < 4 || d[0] != 0xFF || d[1] != 0xD8) return Resultado::Corrupto;   // SOI = "empieza una imagen"
    size_t i = 2;
    int ids[3] = {-1, -1, -1};
    bool hayCuadro = false;
    while (true) {
        if (i + 4 > tam) return Resultado::FaltaEntrada;
        if (d[i] != 0xFF) return Resultado::Corrupto;
        const uint8_t marca = d[i + 1];
        const size_t largo = leer16(d + i + 2);
        if (largo < 2) return Resultado::Corrupto;
        if (i + 2 + largo > tam) return Resultado::FaltaEntrada;
        const uint8_t* s = d + i + 4;              // contenido del segmento
        const size_t n = largo - 2;
        switch (marca) {
        case 0xDB: {  // DQT: tablas de cuantización (pueden venir varias seguidas)
            for (size_t j = 0; j < n;) {
                const int precision = s[j] >> 4, id = s[j] & 15;
                if (precision != 0 || id > 3) return Resultado::NoSoportado;   // solo escalones de 8 bits
                if (j + 65 > n) return Resultado::Corrupto;
                prepararCuant(c.cuant[id], s + j + 1);
                c.cuantCargada[id] = true;
                j += 65;
            }
            break;
        }
        case 0xC4: {  // DHT: tablas de Huffman
            for (size_t j = 0; j < n;) {
                if (j + 17 > n) return Resultado::Corrupto;
                const int clase = s[j] >> 4, id = s[j] & 15;
                if (clase > 1 || id > 3) return Resultado::Corrupto;
                int total = 0;
                for (int k = 0; k < 16; ++k) total += s[j + 1 + k];
                if (total > 256 || j + 17 + total > n) return Resultado::Corrupto;
                if (!armarTabla(clase ? c.ac[id] : c.dc[id], s + j + 1, s + j + 17, total)) return Resultado::Corrupto;
                j += 17 + total;
            }
            break;
        }
        case 0xC0: {  // SOF0: tamaño y componentes. Solo Y 2×2 + U 1×1 + V 1×1 (4:2:0), como los THP.
            if (n < 15 || s[0] != 8 || s[5] != 3) return Resultado::NoSoportado;
            c.alto = static_cast<int>(leer16(s + 1));
            c.ancho = static_cast<int>(leer16(s + 3));
            const uint8_t muestreo[3] = {0x22, 0x11, 0x11};
            for (int k = 0; k < 3; ++k) {
                ids[k] = s[6 + 3 * k];
                if (s[7 + 3 * k] != muestreo[k] || s[8 + 3 * k] > 3) return Resultado::NoSoportado;
                c.tablaCuant[k] = s[8 + 3 * k];
            }
            if (c.ancho <= 0 || c.alto <= 0 || c.ancho % 16 || c.alto % 16) return Resultado::NoSoportado;
            hayCuadro = true;
            break;
        }
        case 0xDA: {  // SOS: empiezan los datos. Los tres componentes en el orden del SOF, de línea base completa.
            if (!hayCuadro || n < 10 || s[0] != 3) return Resultado::NoSoportado;
            for (int k = 0; k < 3; ++k) {
                if (s[1 + 2 * k] != ids[k]) return Resultado::NoSoportado;
                c.tablaDc[k] = s[2 + 2 * k] >> 4;
                c.tablaAc[k] = s[2 + 2 * k] & 15;
                if (c.tablaDc[k] > 3 || c.tablaAc[k] > 3) return Resultado::Corrupto;
                if (!c.dc[c.tablaDc[k]].cargada || !c.ac[c.tablaAc[k]].cargada || !c.cuantCargada[c.tablaCuant[k]])
                    return Resultado::Corrupto;
            }
            if (s[7] != 0 || s[8] != 63 || s[9] != 0) return Resultado::NoSoportado;
            c.inicioDatos = i + 2 + largo;
            return Resultado::Bien;
        }
        case 0xDD:  // DRI: intervalo de reinicio. Los THP no lo usan; si viniera distinto de 0, no se hace.
            if (n >= 2 && leer16(s) != 0) return Resultado::NoSoportado;
            break;
        default:
            // Otros SOF (progresivo, aritmético…): no. Comentarios y APPn: se saltan.
            if ((marca >= 0xC1 && marca <= 0xCF && marca != 0xC4 && marca != 0xC8 && marca != 0xCC))
                return Resultado::NoSoportado;
            break;
        }
        i += 2 + largo;
    }
}

Resultado decodificar(const uint8_t* datos, size_t tam, const Cuadro& c, uint8_t* y, uint8_t* u, uint8_t* v,
                      float redondeo) {
    LectorBits lector{datos, tam, c.inicioDatos};
    const Plano planos[3] = {{y, c.ancho / 8}, {u, c.ancho / 16}, {v, c.ancho / 16}};
    int prediccion[3] = {0, 0, 0};         // el DC de cada bloque se guarda como diferencia con el anterior
    alignas(16) float coef[64];
    const int mcuAncho = c.ancho / 16, mcuAlto = c.alto / 16;
    for (int my = 0; my < mcuAlto; ++my) {
        for (int mx = 0; mx < mcuAncho; ++mx) {
            for (int b = 0; b < 6; ++b) {      // 4 bloques de Y, luego U, luego V
                const int comp = b < 4 ? 0 : b - 3;
                const TablaHuffman& tdc = c.dc[c.tablaDc[comp]];
                const TablaHuffman& tac = c.ac[c.tablaAc[comp]];
                const float* q = c.cuant[c.tablaCuant[comp]];
                // 1. DC: diferencia con el bloque anterior del mismo componente
                const int t = lector.simbolo(tdc);
                if (t < 0 || t > 11) return Resultado::Corrupto;
                prediccion[comp] += lector.valor(t);
                std::memset(coef, 0, sizeof(coef));
                coef[0] = static_cast<float>(prediccion[comp]) * q[0];
                // 2. AC: pares (ceros a saltar, bits del valor); 0x00 = "el resto son ceros"; 0xF0 = 16 ceros
                bool soloDc = true;
                for (int k = 1; k < 64;) {
                    const int rs = lector.simbolo(tac);
                    if (rs < 0) return Resultado::Corrupto;
                    const int ceros = rs >> 4, bits = rs & 15;
                    if (bits == 0) {
                        if (ceros != 15) break;
                        k += 16;
                        continue;
                    }
                    k += ceros;
                    if (k > 63) return Resultado::Corrupto;
                    const int n = kZigzag[k];
                    coef[n] = static_cast<float>(lector.valor(bits)) * q[n];
                    soloDc = false;
                    ++k;
                }
                // 3 y 4. IDCT y guardar en su lugar de la textura
                int bx, by;
                if (comp == 0) { bx = 2 * mx + (b & 1); by = 2 * my + (b >> 1); }
                else { bx = mx; by = my; }
                const Plano& p = planos[comp];
                if (soloDc) llenarYGuardar(coef[0], p.arriba(bx, by), p.abajo(bx, by), redondeo);
                else idctYGuardar(coef, p.arriba(bx, by), p.abajo(bx, by), redondeo);
            }
        }
        if (lector.agotado()) return Resultado::FaltaEntrada;
    }
    return lector.agotado() ? Resultado::FaltaEntrada : Resultado::Bien;
}

}  // namespace thp
