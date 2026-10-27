// Los 6 Mii invitados del juego, con la cara que dibuja el mismo juego — bitácora §86.
//
// Resumen: en «Elige un Mii» el juego tiene la pestaña «Guest» con 6 Mii que no son de nadie: los «Mii por defecto» de
// la librería de caras de la Wii (RFL). La página los quiere mostrar en su menú de Mii con LAS IMÁGENES DEL JUEGO, no
// con dibujos nuestros. Este módulo hace, por pedido de la página, lo mismo que esa pantalla, sin abrirla:
//   1. crea un grupo de Mii (MiiGroup) en el montón de la escena, como MiiSelect::OnInit (0x80847E40): new de 0x98
//      bytes, MiiGroup::MiiGroup (0x805F9E78) y MiiGroup::Init(6 Mii, solo la textura 0, montón) (0x805FA04C). La
//      textura 0 es la del ícono de «Elige un Mii»;
//   2. carga cada invitado con MiiGroup::LoadDefaultMii(i, i) (0x805FA748), la misma llamada de
//      MiiSelect::SetMiiIcons (0x80848F94) en la pestaña Guest. Adentro el juego crea el Mii desde la tabla de la RFL
//      (MiiManager::CreateDefaultMii 0x80527F84 → Mii::Load 0x80526020 → fuente 6 = «por defecto» → 0x800CA800, que
//      copia 74 bytes de 0x8024C4D0 + 74·i) y lo manda a dibujar: MiiGroup::AddMii (0x805FA3FC) →
//      MiiRenderMgr::AddMii (0x80781290), que dibuja la cabeza en 3D y la COPIA a una textura (GXCopyTex).
//      MiiGroup::AddMii dibuja EN EL MOMENTO solo si la sección se está armando (Section +0x38F = 1, como cuando
//      «Elige un Mii» se abre); con la sección andando deja un pedido en la fila del MiiRenderMgr para otro cuadro.
//      Mientras se cargan los 6 se marca «armándose» y después se deja como estaba: así todo pasa en este cuadro;
//   3. la copia queda solo en la tarjeta de video (aurora no la baja a la memoria del juego si nadie la lee). Aquí se
//      pide bajarla en el mismo cuadro (aurora_flush_efb_copy_to_ram; aurora olvida el pedido al cerrar el cuadro):
//      aurora la escribe en la memoria del juego en el formato de textura de la Wii (baldosas) y de ahí se copia;
//   4. borra el grupo (MiiGroup::~MiiGroup con delete, 0x805F9F58).
// Solo en la escena de menús (id 1), con el SectionMgr quieto (sin cambio de sección) y la sección ya armada (si se
// está armando de verdad, se espera). Corre una vez por pedido, al principio del SectionMgr::Update del juego (lo
// llama directo_nativo.cpp), en el hilo del juego, antes de que el cuadro se dibuje.
// Como sacar una foto del tablero con la misma cámara de la fábrica: la cara es la que dibuja el juego, píxel a píxel.
//
// Direcciones: Pulsar (GameSource: MiiGroup.hpp, MiiRenderer.hpp, MiiManager.hpp, Mii.hpp, MiiSelect.hpp,
// GameScene.hpp, Section.hpp) y el C++ traducido (func_805FA748, func_80527F84, func_80526460, func_800CB6A0,
// func_800CA800, func_80847E40, func_80848F94, func_805F9F58).
//
// Uso desde la página (invitados.mjs):  Module._mkw_invitados_pedir()   → 1 = pedido
//                                       Module._mkw_invitados_estado()  → 0 nada, 1 esperando, 2 listo, -1 no se pudo
//                                       Module._mkw_invitados_salida()  → dónde quedó todo (ver Salida)
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"

#include <emscripten/emscripten.h>
#include <cstddef>
#include <cstring>

// aurora: baja a la memoria del juego una copia de textura que solo está en la tarjeta de video (en Node, una vacía:
// web/headless/aurora_manual.cpp). La segunda baja todas las pendientes.
extern "C" bool aurora_flush_efb_copy_to_ram(void* dest);
extern "C" bool aurora_flush_efb_copies_to_ram();

namespace {
constexpr uint32_t kSectionMgr = 0x809C1E38;      // puntero al SectionMgr
constexpr uint32_t kMiiRenderMgr = 0x809C2DF0;    // MiiRenderMgr::sInstance (el que dibuja las caras)
constexpr uint32_t kRKSystem = 0x80385FC8;        // RKSystem: +0x54 el SceneManager → +0xC la escena actual
constexpr uint32_t kTablaInvitados = 0x8024C4D0;  // los 6 Mii por defecto de la RFL, 74 bytes cada uno
constexpr uint32_t kHeapActual = 0x80386EA0;      // EGG::Heap::current (Heap.hpp de Pulsar)
constexpr uint32_t kEscenaMenus = 1;              // SCENE_ID_MENU (GameScene.hpp)
constexpr int kInvitados = 6;
constexpr uint32_t kTamMii = 74;
constexpr uint32_t kTamMaxImagen = 256 * 256 * 4; // la textura más grande que se acepta (RGBA8 de 256×256)

// Lo que lee la página (todo en el orden de la memoria de wasm: little-endian)
struct Invitado {
    uint8_t mii[76];          // los 74 bytes del Mii (el mismo formato de RFL_DB.dat) y 2 de relleno
    uint32_t ancho, alto;     // de la textura del ícono
    uint32_t formato;         // formato de textura de la Wii (GXTexFmt: 5 = RGB5A3, 6 = RGBA8…)
    uint32_t bytes;           // cuántos bytes de imagen (en baldosas, como en la Wii)
    uint32_t direccion;       // dónde la dibujó el juego (para la bitácora)
    uint32_t bajada;          // 1 = aurora la bajó con el pedido de esa dirección, 2 = con el de todas, 0 = no
};
struct Salida {
    int32_t cuantos;          // cuántos invitados con imagen
    int32_t cuadros;          // en qué cuadro se hizo (contando los SectionMgr::Update desde el pedido)
    int32_t microsegundos;    // cuánto tardó todo, dentro de ese cuadro (crear, dibujar 6 caras, bajarlas, borrar)
    Invitado invitado[kInvitados];
    uint8_t imagen[kInvitados][kTamMaxImagen];
};
Salida g_salida;
int g_estado = 0;             // 0 nada, 1 pedido, 2 listo, -1 no se pudo
int g_cuadros = 0;
int g_paso = 0;              // por dónde va (para depurar si el juego se detiene a mitad: 1 grupo, 10+i invitado i, 20 borrar)

// Llama a una función del juego con r3..r6 sobre una copia del contexto (como directo_nativo.cpp) y devuelve r3
template <uint32_t Funcion>
uint32_t llamar(const CpuContext* ctx, uint32_t r3, uint32_t r4 = 0, uint32_t r5 = 0, uint32_t r6 = 0) {
    CpuContext c = *ctx;
    c.gpr[3] = r3; c.gpr[4] = r4; c.gpr[5] = r5; c.gpr[6] = r6;
    InvokeDirectCpu<Funcion>(&c);
    return c.gpr[3];
}

// Bytes de una textura de la Wii: baldosas de 8×8 (I4, CMPR), 8×4 (I8, IA4) o 4×4 (el resto); 32 bytes cada una
// (64 la RGBA8, que va en dos mitades)
uint32_t tamTextura(uint32_t ancho, uint32_t alto, uint32_t formato) {
    uint32_t bw = 4, bh = 4, porBaldosa = 32;
    if (formato == 0 || formato == 14) { bw = 8; bh = 8; }
    else if (formato == 1 || formato == 2) { bw = 8; bh = 4; }
    else if (formato == 6) porBaldosa = 64;
    else if (formato > 6) return 0;               // (los de paleta no se esperan aquí)
    return ((ancho + bw - 1) / bw) * ((alto + bh - 1) / bh) * porBaldosa;
}

// El montón de la escena de menús donde MiiSelect arma su grupo (GameScene +0xC94 MEM1 en la sección 0x54, +0xC98 MEM2
// en las demás), o 0 si no estamos en una pantalla de menú quieta
uint32_t monton() {
    const uint32_t sm = Memory::Read32(kSectionMgr);
    const uint32_t sec = sm ? Memory::Read32(sm) : 0;
    if (!sec || Memory::Read32(sm + 0x30) != 0 || Memory::Read8(sec + 0x38F)) return 0;   // cambiando o armándose
    if (!Memory::Read32(kMiiRenderMgr)) return 0;
    const uint32_t sys = Memory::Read32(kRKSystem);
    const uint32_t escenas = sys ? Memory::Read32(sys + 0x54) : 0;
    const uint32_t escena = escenas ? Memory::Read32(escenas + 0xC) : 0;
    if (!escena || Memory::Read32(escena + 0x28) != kEscenaMenus) return 0;
    return Memory::Read32(escena + (Memory::Read32(sec) == 0x54 ? 0xC94 : 0xC98));
}

// Los pasos 1-4 de arriba
void sacarInvitados(const CpuContext* ctx, uint32_t heap) {
    std::memset(&g_salida.invitado, 0, sizeof(g_salida.invitado));
    g_salida.cuantos = 0;
    g_salida.cuadros = g_cuadros;
    const double t0 = emscripten_get_now();
    // Las pantallas crean su grupo de Mii mientras se arman (OnInit), y ahí el montón de la escena está ABIERTO y es el
    // montón «actual» de EGG (de donde saca memoria un new sin montón: Init pide así sus listas, new[] 0x80229DF0).
    // En medio del cuadro no: el juego cierra los montones al terminar de armar la escena (EGG::Heap +0x1C dameFlag,
    // bit 0: pedirles memoria detiene el juego con «DAME DAME», ExpHeap::alloc 0x80226C04, eggExpHeap.cpp:174) y el
    // actual es otro. Así que, solo mientras se crea el grupo, el de la escena se abre y pasa a ser el actual
    // (EGG::Heap::current, 0x80386EA0); después todo vuelve a como estaba. (Devolver memoria no mira la bandera:
    // ExpHeap::free 0x80226C78.)
    g_paso = 1;
    const uint32_t actual = Memory::Read32(kHeapActual);
    const uint16_t bandera = Memory::Read16(heap + 0x1C);
    Memory::Write16(heap + 0x1C, static_cast<uint16_t>(bandera & ~1u));
    Memory::Write32(kHeapActual, heap);
    const uint32_t grupo = llamar<0x80229DE0u>(ctx, 0x98, heap, 4);     // new(0x98, montón, alineado a 4)
    if (grupo) {
        llamar<0x805F9E78u>(ctx, grupo);                                 // MiiGroup::MiiGroup
        llamar<0x805FA04Cu>(ctx, grupo, kInvitados, 1, heap);            // Init(6 Mii, textura 0, montón)
    }
    Memory::Write32(kHeapActual, actual);
    Memory::Write16(heap + 0x1C, bandera);
    if (!grupo) { g_estado = -1; return; }
    const uint32_t seccion = Memory::Read32(Memory::Read32(kSectionMgr));
    const uint8_t armandose = Memory::Read8(seccion + 0x38F);
    Memory::Write8(seccion + 0x38F, 1);                                  // que MiiGroup::AddMii dibuje ya (ver arriba)
    for (int i = 0; i < kInvitados; i++) {
        Invitado& inv = g_salida.invitado[i];
        g_paso = 10 + i;
        for (uint32_t k = 0; k < kTamMii; k++) inv.mii[k] = Memory::Read8(kTablaInvitados + kTamMii * i + k);
        llamar<0x805FA748u>(ctx, grupo, static_cast<uint32_t>(i), static_cast<uint32_t>(i));   // LoadDefaultMii(i, i)
        const uint32_t texturas = Memory::Read32(grupo + 0x8);           // MiiTexObj[6] de la textura 0
        if (!texturas) continue;
        const uint32_t tex = texturas + 0x24 * i;                        // MiiTexObj: GXTexObj (0x20) + «ya dibujado»
        if (!Memory::Read8(tex + 0x20)) continue;
        // GXTexObj como lo deja GXInitTexObj: +0x8 ancho-1 (10 bits), alto-1 (10 bits), formato (4 bits);
        // +0xC dirección física / 32; +0x14 formato
        const uint32_t tam = Memory::Read32(tex + 0x8);
        inv.ancho = (tam & 0x3FF) + 1;
        inv.alto = ((tam >> 10) & 0x3FF) + 1;
        inv.formato = Memory::Read32(tex + 0x14);
        if (inv.formato > 14) inv.formato = (tam >> 20) & 0xF;
        inv.direccion = ((Memory::Read32(tex + 0xC) & 0xFFFFFFu) << 5) | 0x80000000u;   // física → la de la CPU
        inv.bytes = tamTextura(inv.ancho, inv.alto, inv.formato);
        if (!inv.bytes || inv.bytes > kTamMaxImagen || !Memory::Contains(inv.direccion, inv.bytes)) { inv.bytes = 0; continue; }
        uint8_t* p = Memory::GetPointer(inv.direccion, inv.bytes);
        if (aurora_flush_efb_copy_to_ram(p)) inv.bajada = 1;
        else if (aurora_flush_efb_copies_to_ram()) inv.bajada = 2;
        std::memcpy(g_salida.imagen[i], p, inv.bytes);
        g_salida.cuantos++;
    }
    Memory::Write8(seccion + 0x38F, armandose);
    g_paso = 20;
    llamar<0x805F9F58u>(ctx, grupo, 1);                                  // ~MiiGroup y delete
    g_paso = 0;
    g_salida.microsegundos = static_cast<int32_t>((emscripten_get_now() - t0) * 1000.0);
    g_estado = g_salida.cuantos == kInvitados ? 2 : -1;
}
}

extern "C" EMSCRIPTEN_KEEPALIVE int mkw_invitados_pedir() { g_estado = 1; g_cuadros = 0; return 1; }
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_invitados_estado() { return g_estado; }
extern "C" EMSCRIPTEN_KEEPALIVE Salida* mkw_invitados_salida() { return &g_salida; }
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_invitados_paso() { return g_paso; }
// tamaños para que la página lea Salida sin adivinar
extern "C" EMSCRIPTEN_KEEPALIVE int mkw_invitados_forma(int que) {
    switch (que) {
        case 0: return static_cast<int>(sizeof(Invitado));
        case 1: return static_cast<int>(offsetof(Salida, invitado));
        case 2: return static_cast<int>(offsetof(Salida, imagen));
        case 3: return static_cast<int>(kTamMaxImagen);
        default: return kInvitados;
    }
}

// En cada SectionMgr::Update (directo_nativo.cpp, antes del Update del juego)
extern "C" void mkw_invitados_cuadro(const CpuContext* ctx) {
    if (g_estado != 1) return;
    g_cuadros++;
    if (const uint32_t heap = monton()) sacarInvitados(ctx, heap);
}
