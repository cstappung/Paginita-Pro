// DVD::ConvertPathToEntrynum nativo: reemplaza la función del juego que pasa un nombre de archivo
// ("/Race/Kart/ma_bike-ds-1.szs") a su número en el índice del disco (0x8015DF4C).
//
// Resumen: antes de abrir un archivo, el juego busca su número en el índice del disco (la "FST": la lista de todos
// los archivos y carpetas). La función de la Wii lo hace carpeta por carpeta, y dentro de cada carpeta recorre sus
// entradas una por una comparando nombres, como buscar una palabra en un diccionario leyendo desde la primera página.
// Al empezar cada carrera, Retro Rewind prueba ~9 300 nombres de voces (cada combinación de personaje, grupo y
// variante: "/sound/GRP_VO_YS-1_GOL_TOP2.brwsd.mario"…), casi todos inexistentes, y cada uno recorre la carpeta
// /sound/ entera: ~0,3 s seguidos en wasm, el tirón de la largada (bitácora §50).
//
// Aquí se hace el MISMO recorrido (mismas reglas que la función de la Wii: "/" vuelve a la raíz, sin "/" inicial se
// parte de la carpeta actual, una "/" final pide la carpeta, sin distinguir mayúsculas con la tabla de minúsculas del
// propio juego, la primera coincidencia en el orden del índice, en medio de un camino solo valen carpetas), pero
// dentro de cada carpeta se usa una tabla hash (nombre en minúsculas → entradas), armada la primera vez que se entra.
// Es el índice alfabético del diccionario: ir directo a la página.
//
// Lo raro se lo deja a la función del juego, que sabe tratarlo: componentes que empiezan con "." ("./", "../"), el
// modo de nombres cortos 8.3 (la opción global de nombres largos apagada: ahí la del juego revisa y hasta detiene la
// consola con OS::Panic), nombres de más de 512 letras y un índice que no se pueda leer.
//
// Qué lee (las mismas variables globales que la traducida, por r13 = el registro que apunta a las variables chicas):
//   r13-26072 carpeta actual (número de entrada)      r13-26048 dónde empieza el índice (entradas de 12 bytes)
//   r13-26052 dónde empiezan los nombres               r13-29512 opción de nombres largos (0 = solo 8.3)
// Cada entrada del índice (big-endian): [tipo (1 = carpeta) << 24 | dónde está su nombre], [padre (carpetas)],
// [siguiente entrada fuera de la carpeta (carpetas) / tamaño (archivos)]. La entrada 0 es la raíz y su tercer valor
// es la cantidad de entradas. Si el índice cambia de lugar o de tamaño, las tablas se tiran y se rearman.
//
// Cómo se engancha (compilar-web.py, "REEMPLAZOS"): el shard donde vive la traducida se compila copiado, con solo la
// definición renombrada a func_8015DF4C_traducida; este archivo define func_8015DF4C, así que le llegan todas las
// llamadas (DVD::Open, DVD::OpenDir, DVD::ChangeDir, las de Retro Rewind).
//
// Modos (variable MKW_RUTAS; la página la pone con ?rutas=…):
//   (nada)      nativo
//   traducido   siempre la del juego, como antes (para medir la diferencia)
//   comparar    las dos en cada búsqueda; se queda la del juego y avisa si alguna vez difieren
//   listar      nativo, y escribe cada nombre buscado con su respuesta (para ver qué busca el juego)
// Cada segundo con búsquedas escribe en la consola cuántas hubo y cuánto tardaron.
#include "ppc_runtime.h"
#include "memory.h"

#include <emscripten/emscripten.h>

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <unordered_map>
#include <vector>

extern "C" void func_8015DF4C_traducida(CpuContext* ctx);   // la del juego, con el nombre cambiado
// del runtime (dvd.cpp, parche): la ruta del archivo de verdad y su tamaño para un número de entrada del índice
extern "C" const char* mkw_dvd_ruta_de_entrada(int32_t entrada, uint32_t* tam);

// Aviso a la página: "el juego acaba de encontrar este archivo; lo va a leer enseguida" (bitácora §52). La página
// (mkw.mjs → disco.mjs) empieza a bajarlo en paralelo con los otros avisos, en vez de que el juego lo pida solo
// cuando lo lee, uno detrás de otro. En Node no hay Module.mkwAvisoLectura y no pasa nada.
EM_JS(void, mkw_web_aviso_lectura, (const char* ruta, unsigned tam), {
    if (Module.mkwAvisoLectura) Module.mkwAvisoLectura(UTF8ToString(ruta), tam);
});

namespace {

enum Modo { kNativo = 0, kTraducido = 1, kComparar = 2, kListar = 3 };

int modo() {
    static int m = -1;
    if (m < 0) {
        const char* e = std::getenv("MKW_RUTAS");
        m = (e && !std::strcmp(e, "traducido")) ? kTraducido : (e && !std::strcmp(e, "comparar")) ? kComparar
          : (e && !std::strcmp(e, "listar")) ? kListar : kNativo;
        std::printf("[rutas] búsqueda en el índice del disco: %s\n",
                    m == kNativo ? "nativa (tablas hash)" : m == kTraducido ? "la traducida" : m == kComparar ? "comparar" : "listar");
    }
    return m;
}

constexpr int32_t kCarpetaActual = -26072, kIndice = -26048, kNombres = -26052, kNombresLargos = -29512;
constexpr size_t kMaxNombre = 512;
constexpr uint32_t kTablaMinusculas = 0x80271148u + 56u;    // la misma que usa la traducida: *(*(esto) + 16) = tolower

uint32_t leer32(uint32_t a) { return MemoryInline::FlatRead32(a); }
uint8_t leer8(uint32_t a) { return Memory::Read8(a); }

// ---- El índice, con una tabla hash por carpeta ----
struct Indice {
    uint32_t inicio = 0, nombres = 0, cantidad = 0;
    uint8_t minuscula[256];                                   // la tabla de minúsculas del juego (copiada una vez)
    std::unordered_map<uint32_t, std::unordered_map<std::string, std::vector<uint32_t>>> carpetas;   // carpeta → nombre → entradas
};
Indice g_indice;

uint32_t palabra(uint32_t entrada, int k) { return leer32(g_indice.inicio + entrada * 12u + uint32_t(k) * 4u); }
bool esCarpeta(uint32_t entrada) { return (palabra(entrada, 0) >> 24) != 0; }
uint32_t siguiente(uint32_t carpeta) { return palabra(carpeta, 2); }
uint32_t padre(uint32_t carpeta) { return palabra(carpeta, 1); }

// Pasa a minúsculas como la función del juego: solo los bytes 0..127 (un char con signo negativo queda igual)
char plegar(uint8_t c) { return (c & 0x80u) ? char(c) : char(g_indice.minuscula[c]); }

bool prepararIndice(const CpuContext* ctx) {
    const uint32_t r13 = ctx->gpr[13];
    const uint32_t inicio = leer32(r13 + uint32_t(kIndice)), nombres = leer32(r13 + uint32_t(kNombres));
    if (!inicio || !nombres) return false;
    const uint32_t cantidad = leer32(inicio + 8u);
    if (inicio != g_indice.inicio || nombres != g_indice.nombres || cantidad != g_indice.cantidad) {
        g_indice.inicio = inicio; g_indice.nombres = nombres; g_indice.cantidad = cantidad;
        g_indice.carpetas.clear();
        const uint32_t tabla = leer32(leer32(kTablaMinusculas) + 16u);
        for (int c = 0; c < 256; ++c) g_indice.minuscula[c] = tabla ? leer8(tabla + uint32_t(c)) : uint8_t(c >= 'A' && c <= 'Z' ? c + 32 : c);
        std::printf("[rutas] índice del disco: %u entradas\n", cantidad);
    }
    return cantidad > 0 && cantidad < 0x100000u;
}

// La tabla de una carpeta: sus hijos directos (sin entrar a subcarpetas), en el orden del índice
const std::unordered_map<std::string, std::vector<uint32_t>>& tablaDe(uint32_t carpeta) {
    auto [it, nueva] = g_indice.carpetas.try_emplace(carpeta);
    if (nueva) {
        const uint32_t fin = std::min(siguiente(carpeta), g_indice.cantidad);
        std::string nombre;
        for (uint32_t i = carpeta + 1; i < fin; i = esCarpeta(i) ? std::max(siguiente(i), i + 1) : i + 1) {
            nombre.clear();
            for (uint32_t p = g_indice.nombres + (palabra(i, 0) & 0xFFFFFFu); nombre.size() < kMaxNombre; ++p) {
                const uint8_t c = leer8(p);
                if (!c) break;
                nombre.push_back(plegar(c));
            }
            it->second[nombre].push_back(i);
        }
    }
    return it->second;
}

// El recorrido de la función de la Wii, con las tablas. Devuelve false si es un caso raro (lo resuelve la traducida).
bool buscarNativo(const CpuContext* ctx, int32_t& respuesta, std::string* listado) {
    const uint32_t r13 = ctx->gpr[13];
    if (leer32(r13 + uint32_t(kNombresLargos)) == 0) return false;      // modo 8.3: lo revisa la del juego
    if (!prepararIndice(ctx)) return false;
    // el nombre pedido, completo
    std::string ruta;
    for (uint32_t p = ctx->gpr[3];; ++p) {
        const uint8_t c = leer8(p);
        if (!c) break;
        if (ruta.size() >= kMaxNombre) return false;
        ruta.push_back(char(c));
    }
    if (listado) *listado = ruta;
    uint32_t carpeta = leer32(r13 + uint32_t(kCarpetaActual));
    size_t pos = 0;
    std::string componente;
    for (;;) {
        if (pos == ruta.size()) { respuesta = int32_t(carpeta); return true; }   // se acabó el nombre: esta carpeta
        if (ruta[pos] == '/') { carpeta = 0; ++pos; continue; }               // "/" = desde la raíz
        if (ruta[pos] == '.') return false;                                     // "." y "..": la del juego
        const size_t fin = ruta.find('/', pos);
        const bool pideCarpeta = fin != std::string::npos;                      // hay más camino después
        const size_t largo = (pideCarpeta ? fin : ruta.size()) - pos;
        componente.assign(ruta, pos, largo);
        for (char& c : componente) c = plegar(uint8_t(c));
        const auto& tabla = tablaDe(carpeta);
        const auto it = tabla.find(componente);
        int64_t hallada = -1;
        if (it != tabla.end())
            for (uint32_t e : it->second)
                if (!pideCarpeta || esCarpeta(e)) { hallada = e; break; }       // en medio del camino solo carpetas
        if (hallada < 0) { respuesta = -1; return true; }
        if (!pideCarpeta) { respuesta = int32_t(hallada); return true; }
        carpeta = uint32_t(hallada);
        pos += largo + 1;
    }
}

// Avisar una sola vez por archivo (una entrada encontrada otra vez ya está bajada o bajándose)
std::vector<bool> g_avisadas;
void avisarLectura(int32_t entrada) {
    if (entrada <= 0 || entrada >= 0x100000) return;
    if (g_avisadas.size() <= size_t(entrada)) g_avisadas.resize(size_t(entrada) + 1024, false);
    if (g_avisadas[size_t(entrada)]) return;
    g_avisadas[size_t(entrada)] = true;
    uint32_t tam = 0;
    if (const char* ruta = mkw_dvd_ruta_de_entrada(entrada, &tam)) mkw_web_aviso_lectura(ruta, tam);
}

// Estadísticas por segundo
double g_inicioSegundo = 0, g_msSegundo = 0;
unsigned g_llamadasSegundo = 0, g_rarasSegundo = 0, g_difierenTotal = 0;

void anotar(double ms, bool rara) {
    const double ahora = emscripten_get_now();
    if (g_inicioSegundo == 0) g_inicioSegundo = ahora;
    if (ahora - g_inicioSegundo >= 1000.0) {
        if (g_llamadasSegundo)
            std::printf("[rutas] %u búsquedas en el índice (%u por la traducida), %.1f ms%s\n", g_llamadasSegundo,
                        g_rarasSegundo, g_msSegundo, modo() == kComparar ? (g_difierenTotal ? " — HAY DIFERENCIAS" : " — todas iguales") : "");
        g_inicioSegundo = ahora; g_msSegundo = 0; g_llamadasSegundo = 0; g_rarasSegundo = 0;
    }
    g_llamadasSegundo++; g_rarasSegundo += rara ? 1u : 0u; g_msSegundo += ms;
}

}  // namespace

extern "C" void func_8015DF4C(CpuContext* ctx) {
    const int m = modo();
    const double t0 = emscripten_get_now();
    if (m == kTraducido) { func_8015DF4C_traducida(ctx); anotar(emscripten_get_now() - t0, true); return; }

    int32_t respuesta = -1;
    std::string ruta;
    const bool nativa = buscarNativo(ctx, respuesta, (m == kComparar || m == kListar) ? &ruta : nullptr);
    if (m == kComparar) {
        func_8015DF4C_traducida(ctx);                       // se queda la del juego
        const int32_t real = int32_t(ctx->gpr[3]);
        if (nativa && real != respuesta && g_difierenTotal++ < 20)
            std::printf("[rutas] ¡DIFIEREN! «%s»: nativa %d, del juego %d\n", ruta.c_str(), respuesta, real);
    } else if (nativa) {
        ctx->gpr[3] = uint32_t(respuesta);                  // la respuesta, en r3 como la daría la del juego
        if (m == kListar) std::printf("[rutas] «%s» → %d\n", ruta.c_str(), respuesta);
    } else {
        func_8015DF4C_traducida(ctx);
        if (m == kListar) std::printf("[rutas] «%s» → %d (traducida)\n", ruta.c_str(), int32_t(ctx->gpr[3]));
    }
    anotar(emscripten_get_now() - t0, !nativa);
    avisarLectura(int32_t(ctx->gpr[3]));                    // lo encontró: probablemente lo lee enseguida
}
