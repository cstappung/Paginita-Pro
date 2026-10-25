// Los nombres de los pilotos de la sala en el juego (M22, el modelo «Modo consola» que eligió el dueño) — bitácora §98.
//
// Resumen: el globo con el nombre sobre cada kart y las filas de las tablas de resultados escriben el nombre del Mii de
// esa casilla de SectionParams (+0x188, el MiiGroup «playerMiis» de 12, una casilla por puesto de la carrera), con el
// mensaje 9501 (el nombre del Mii, Mii +0x68) — no el de RacedataPlayer. El juego llena ese grupo como si los
// jugadores de esta consola fueran los puestos 0, 1…: la elección de personaje copia la licencia en la casilla 0 (que
// se llama «Piloto») y las demás quedan vacías (sin nombre). Por eso en la sala uno salía «Piloto» y el otro, nada.
// Aquí, en tres pasos (lo investigado está en la bitácora §98; las direcciones son de Retro Rewind 6.13.1):
//   A. al abrirse la elección de personaje (CharacterSelect::OnInit de RR, rr_overlay_8083D55C: el momento en que el
//      juego mismo carga Mii en ese grupo, con el dibujante de caras listo), cada casilla de humano vacía recibe un
//      Mii invitado con MiiGroup::LoadDefaultMii (0x805FA748) — la cara de uno de los 6 invitados, la misma en todas
//      las consolas;
//   B. en cada carrera, al final de Racedata_InitRace de Pulsar (directo_nativo.cpp llama a mkwNombresEnCarrera), el
//      nombre que manda la sala se escribe en el Mii de la casilla de cada humano (+0x68, hasta 10 letras) y se baja
//      su marca +0xA5 (con ella el juego escribe «Player»). Solo escrituras: ahí todavía no se puede reservar memoria;
//   C. ya en la carrera (SectionMgr::Update, directo_nativo.cpp llama a mkwNombresCpu), el texto con que el juego
//      nombra a cada CPU — con las skins de Retro Rewind («Meowser», «King Bob-omb»…) y en el idioma del juego — para
//      las tablas de la página: el mismo camino que usa el juego (GetCharacterNameBMGId y GetCustomMsg de Pulsar).
// Nada de esto toca la carrera: solo la interfaz lee esos Mii (la huella del lockstep compara karts y botones).
//
// Desde la página (nombres-juego.mjs):  Module._mkw_nombres() → la dirección de Nombres (abajo), que la página llena;
//   Module._mkw_nombres_cpu_pedir() → C en la próxima carrera;  Module._mkw_nombres_cpu() → la dirección de NombresCpu;
//   Module._mkw_nombres_estado(k) → para mirar (0 Mii cargados por A, 1 nombres escritos por B, 2 casillas sin Mii).
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"

#include <emscripten/emscripten.h>
#include <cstdint>
#include <cstring>

namespace {
constexpr uint32_t kSectionMgr = 0x809C1E38;      // puntero al SectionMgr (+0x98 SectionParams)
constexpr uint32_t kMiiRenderMgr = 0x809C2DF0;    // MiiRenderMgr::sInstance (dibuja las caras; sin él, A no se hace)
constexpr uint32_t kRacedata = 0x809BD728;        // puntero al Racedata (+0x20 el escenario de la carrera)
constexpr uint32_t kRaceinfo = 0x809BD730;        // puntero al Raceinfo (existe con la carrera armada)
constexpr uint32_t kRKSystem = 0x80385FC8;        // RKSystem: +0x54 el SceneManager → +0xC la escena actual
constexpr uint32_t kEscenaCarrera = 2;            // SCENE_ID_RACE (GameScene.hpp)
constexpr uint32_t kPlayerMiis = 0x188;           // SectionParams +0x188: el MiiGroup de los 12 puestos
constexpr int kLetras = 11;                       // el nombre del Mii: 10 letras UTF-16 y el 0 del final

// Lo que llena la página (memoria de wasm: little-endian)
struct Nombres {
    uint16_t nombre[12][kLetras];   // el nombre de cada puesto de humano (UTF-16, ya limpio: ≤ 10 letras y un 0)
    uint8_t hay[12];                // 1 = ese puesto es un humano de la sala
    uint8_t cara[12];               // el invitado (0..5) cuya cara lleva su Mii si no tiene uno
    int32_t activo;                 // 1 = sala: A, B y C trabajan
};
struct NombresCpu {
    int32_t listo;                  // cuántas veces se llenó (la página mira si cambió)
    int32_t mensaje[12];            // el número de mensaje que usó el juego (0 = no es CPU)
    uint16_t texto[12][32];         // el texto (UTF-16, sin las marcas de formato del juego)
};
// Las skins de las CPU que reparte la sala (las que sorteó una consola en la carrera 1): Retro Rewind las sortea solo
// en la primera carrera de cada consola, así que quien recarga a mitad de la copa vería otras
struct Skins {
    int32_t hay;                    // 1 = ponerlas al armar cada carrera
    uint8_t skin[12];               // la de cada puesto (racePlayerSlots, 0 = la de siempre)
    uint8_t leidas[12];             // las que dejó el sorteo de RR en esta consola al armar esta carrera (para la página:
                                    // su lector de memoria no llega más arriba de 0x81800000)
};
constexpr uint32_t kSkinsRR = 0x818A08A8;          // racePlayerSlots de Retro Rewind (u8[12])
constexpr uint32_t kTablasRR = 0x81878C7C;         // characterTables de Retro Rewind (u8[24][101]: ≠ 0 = esa skin existe)
Nombres g_n;
NombresCpu g_cpu;
Skins g_skins;
int32_t g_cargados = 0, g_escritos = 0, g_sinMii = 0, g_cpuPedido = 0;

template <uint32_t Funcion>
uint32_t llamar(const CpuContext* ctx, uint32_t r3, uint32_t r4 = 0, uint32_t r5 = 0, uint32_t r6 = 0) {
    CpuContext c = *ctx;
    c.gpr[3] = r3; c.gpr[4] = r4; c.gpr[5] = r5; c.gpr[6] = r6;
    InvokeDirectCpu<Funcion>(&c);
    return c.gpr[3];
}
// MEM1 (con lo que Retro Rewind carga más arriba, 0x818…) y MEM2 (los montones grandes del juego, 0x90…)
bool esPuntero(uint32_t p) { return (p >= 0x80000000u && p < 0x82000000u) || (p >= 0x90000000u && p < 0x94000000u); }
uint32_t sectionParams() {
    const uint32_t sm = Memory::Read32(kSectionMgr);
    return esPuntero(sm) ? Memory::Read32(sm + 0x98) : 0;
}
// el Mii de la casilla j del grupo de los 12 puestos (MiiGroup +0x4: la lista de punteros), o 0
uint32_t miiDe(uint32_t sp, int j) {
    const uint32_t lista = Memory::Read32(sp + kPlayerMiis + 0x4);
    return esPuntero(lista) ? Memory::Read32(lista + 4u * static_cast<uint32_t>(j)) : 0;
}
bool cargado(uint32_t m) { return esPuntero(m) && Memory::Read8(m + 0xA4) != 0; }   // Mii +0xA4: isLoaded
uint32_t escenaActual() {
    const uint32_t sys = Memory::Read32(kRKSystem);
    const uint32_t escenas = esPuntero(sys) ? Memory::Read32(sys + 0x54) : 0;
    const uint32_t escena = esPuntero(escenas) ? Memory::Read32(escenas + 0xC) : 0;
    return esPuntero(escena) ? Memory::Read32(escena + 0x28) : 0xFFFFFFFFu;
}
}  // namespace

extern "C" EMSCRIPTEN_KEEPALIVE Nombres* mkw_nombres() { return &g_n; }
extern "C" EMSCRIPTEN_KEEPALIVE NombresCpu* mkw_nombres_cpu() { return &g_cpu; }
extern "C" EMSCRIPTEN_KEEPALIVE Skins* mkw_nombres_skins() { return &g_skins; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_nombres_cpu_pedir() { g_cpuPedido = 1; }
extern "C" EMSCRIPTEN_KEEPALIVE int32_t mkw_nombres_estado(int32_t k) { return k == 0 ? g_cargados : k == 1 ? g_escritos : g_sinMii; }

// A. CharacterSelect::OnInit (el de RR): después de lo del juego, un Mii invitado en cada casilla de humano vacía
extern "C" void rr_overlay_8083D55C_traducida(CpuContext* ctx);
extern "C" void rr_overlay_8083D55C(CpuContext* MKW_RESTRICT ctx) {
    rr_overlay_8083D55C_traducida(ctx);
    if (!g_n.activo) return;
    const uint32_t sp = sectionParams();
    if (!esPuntero(sp) || !esPuntero(Memory::Read32(kMiiRenderMgr))) return;
    for (int j = 0; j < 12; j++) {
        if (!g_n.hay[j] || cargado(miiDe(sp, j))) continue;
        const uint32_t cara = g_n.cara[j] < 6 ? g_n.cara[j] : static_cast<uint32_t>(j % 6);
        llamar<0x805FA748u>(ctx, sp + kPlayerMiis, static_cast<uint32_t>(j), cara);   // MiiGroup::LoadDefaultMii
        if (cargado(miiDe(sp, j))) ++g_cargados;
    }
}

// B. al final de Racedata_InitRace (directo_nativo.cpp): el nombre de cada humano en el Mii de su casilla
void mkwNombresEnCarrera() {
    const uint32_t rd = Memory::Read32(kRacedata), sp = sectionParams();
    if (!esPuntero(rd) || Memory::Read32(rd + 0x20 + 0xB48 + 0x8) != 1) return;   // solo en una carrera VS
    // las skins de la sala, después del sorteo de RR (que va al final de Racedata_InitRace de Pulsar): solo en los
    // puestos de CPU y solo si esa skin existe para ese personaje. Antes, las del sorteo, para la página
    for (int j = 0; j < 12; j++) g_skins.leidas[j] = Memory::Read8(kSkinsRR + static_cast<uint32_t>(j));
    if (g_skins.hay) for (int j = 0; j < 12; j++) {
        const uint32_t pj = rd + 0x20 + 0x8 + 0xF0u * static_cast<uint32_t>(j);
        const uint32_t personaje = Memory::Read32(pj + 0xC), s = g_skins.skin[j];
        if (Memory::Read32(pj + 0x10) != 1 || personaje >= 24 || s > 100) continue;
        if (s == 0 || Memory::Read8(kTablasRR + personaje * 101u + s)) Memory::Write8(kSkinsRR + static_cast<uint32_t>(j), static_cast<uint8_t>(s));
    }
    if (!g_n.activo || !esPuntero(sp)) return;
    for (int j = 0; j < 12; j++) {
        if (!g_n.hay[j] || Memory::Read32(rd + 0x20 + 0x8 + 0xF0u * static_cast<uint32_t>(j) + 0x10) != 0) continue;   // un humano
        const uint32_t m = miiDe(sp, j);
        if (!cargado(m)) { ++g_sinMii; continue; }
        for (int k = 0; k < kLetras; k++) Memory::Write16(m + 0x68 + 2u * static_cast<uint32_t>(k), k < kLetras - 1 ? g_n.nombre[j][k] : 0);
        Memory::Write8(m + 0xA5, 0);                                     // sin ella el juego escribe «Player»
        ++g_escritos;
    }
}

// C. ya en la carrera (SectionMgr::Update, directo_nativo.cpp): el texto con que el juego nombra a cada CPU
void mkwNombresCpu(const CpuContext* ctx) {
    if (!g_cpuPedido || escenaActual() != kEscenaCarrera || !esPuntero(Memory::Read32(kRaceinfo))) return;
    const uint32_t rd = Memory::Read32(kRacedata);
    if (!esPuntero(rd)) return;
    g_cpuPedido = 0;
    std::memset(g_cpu.mensaje, 0, sizeof(g_cpu.mensaje));
    std::memset(g_cpu.texto, 0, sizeof(g_cpu.texto));
    for (int j = 0; j < 12; j++) {
        const uint32_t pj = rd + 0x20 + 0x8 + 0xF0u * static_cast<uint32_t>(j);
        if (Memory::Read32(pj + 0x10) != 1) continue;                   // solo las CPU
        const uint32_t personaje = Memory::Read32(pj + 0xC);
        if (personaje >= 0x30) continue;
        // GetCharacterNameBMGId de Pulsar (personaje, nombre genérico de Mii, puesto, no es la ceremonia) y su texto
        const uint32_t mensaje = llamar<0x8185285Cu>(ctx, personaje, 1, static_cast<uint32_t>(j), 0);
        const uint32_t p = llamar<0x818611E0u>(ctx, mensaje);              // GetCustomMsg: UTF-16 big-endian o 0
        g_cpu.mensaje[j] = static_cast<int32_t>(mensaje);
        if (!esPuntero(p)) continue;
        int n = 0;
        for (uint32_t q = p; n < 31 && q < p + 256;) {
            const uint16_t c = Memory::Read16(q);
            if (!c) break;
            if (c == 0x1A) {                                             // una marca de formato: el byte que sigue es su largo
                const uint8_t largo = Memory::Read8(q + 2);
                if (largo < 4) break;
                q += largo;
                continue;
            }
            q += 2;
            if (c < 0x20) continue;                                      // (los nombres de RR empiezan con un tabulador)
            g_cpu.texto[j][n++] = c;
        }
    }
    ++g_cpu.listo;
}
