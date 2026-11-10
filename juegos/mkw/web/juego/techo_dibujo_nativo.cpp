// W3 de la etapa 0 del plan v4 (bitácora §200) y E4 (bitácora §222): el techo de «dibujar un grupo en nativo».
//
// Resumen: antes de escribir un dibujo propio de algo (la pista, los karts, los objetos, los efectos), medir lo MÁS que
// podría ahorrar: lo que cuesta hoy que el juego lo dibuje. Este instrumento (solo en un programa aparte,
// MKW_TECHO_COMPILAR=1 de compilar-web.py; nunca en el de jugar) esconde ese grupo SOLO mientras se dibuja: la lógica de
// la carrera y lo que lee del dibujo (ScnMgr::SwitchScnRoot, ModelDirector::Update) siguen viendo todo. La imagen queda
// sin ese grupo (solo para medir): lo que suben los cuadros por segundo es el techo.
//
// El modo es una suma de bits (MKW_TECHO en Node, mkw_techo_modo(m) en la página, ?techo=N):
//   1 = la pista (W3, §200): el ModelDirector de «course_model.brres» fuera de la escena antes de cada dibujo
//       (EGG::SceneManager::draw 0x8023AEAC → ModelDirector::ToggleVisible 0x8055C9F0, como el juego esconde un modelo).
//   2 = los efectos (partículas): EGG::EffectManager::Draw (0x802251DC) vuelve sin dibujar. Su cálculo
//       (CalcEffect, que el juego hace dentro de Effects::Mgr::Draw) y su azar propio siguen igual.
//   4 = los modelos cuyas «opciones de dibujo» (ModelDirector +0x24) están en la máscara (mkw_techo_mascara, MKW_TECHO_OP;
//       bit k = la opción k de la tabla 0x808B6ED0): dentro de ScnMgrRace::DrawModels (0x805B1CD8), justo alrededor de
//       ScnMgr::DrawModelsImpl (0x805625A8) —donde se juntan y se mandan los modelos a la tarjeta—, se sacan de su grupo
//       con ToggleVisible(false) y se vuelven a poner con ToggleVisible(true). Los modelos que carga la pista
//       (CourseMgr::LoadModels: la pista, el cielo) nunca entran en esta máscara.
//       Karts y pilotos = opción 10 (Kart::Part 0x80592920, DriverController 0x807D21F8) y 1 (pilotos transparentes).
//       Objetos = 5, 7, 12, 15 (ObjectCollidable, ObjectKCL, …); lo demás del grupo 1 (los objetos lanzados) se ve en el
//       recuento por opción que imprime Node.
// mkw_techo_dato(i): 0 modelos de la pista cargados, 1 el ModelDirector de la pista, 2 dibujos con la pista escondida,
//   3 el modo, 4 efectos sin dibujar, 5 modelos escondidos en el último dibujo, 6 dibujos de la carrera con la máscara,
//   7 la máscara, 10+k = cuántos modelos con la opción k había en la escena en el último dibujo de la carrera (k < 24).
#include "ppc_runtime.h"
#include "abi_bridge.h"
#include "memory.h"

#include <emscripten/emscripten.h>

#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace {
int g_modo = -1;
uint32_t g_mascara = 0xFFFFFFFFu;  // sin leer todavía
uint32_t g_curso = 0;       // el ModelDirector del modelo de la pista (el último cargado)
uint32_t g_cursos[2] = {};  // la pista carga dos (course_model.brres dos veces): se esconden los dos
uint32_t g_dePista[16] = {};  // todo lo que carga CourseMgr::LoadModels (pista, cielo…): nunca en la máscara
int g_nDePista = 0;
double g_cargados = 0, g_escondidas = 0, g_efectos = 0, g_escondidosUltimo = 0, g_dibujosMascara = 0;
double g_porOpcion[24] = {};
bool g_enCarrera = false;   // dentro de ScnMgrRace::DrawModels

int modo() {
    if (g_modo < 0) { const char* e = std::getenv("MKW_TECHO"); g_modo = e ? std::atoi(e) : 0; }
    return g_modo;
}
uint32_t mascara() {
    if (g_mascara == 0xFFFFFFFFu) {
        const char* e = std::getenv("MKW_TECHO_OP");
        g_mascara = e ? static_cast<uint32_t>(std::strtoul(e, nullptr, 0)) : 0;
    }
    return g_mascara;
}

// el nombre que pasó el juego (hasta 47 letras; vacío si no es texto)
void nombreDe(uint32_t a, char* s) {
    s[0] = 0;
    if (a < 0x80000000u || a >= 0x81800000u) return;
    for (int i = 0; i < 47; i++) {
        const uint8_t c = Memory::Read8(a + i);
        if (!c) { s[i] = 0; return; }
        if (c < 0x20 || c > 0x7e) { s[0] = 0; return; }
        s[i] = static_cast<char>(c); s[i + 1] = 0;
    }
}

bool esDePista(uint32_t md) {
    for (int i = 0; i < g_nDePista; i++) if (g_dePista[i] == md) return true;
    return false;
}

// ModelDirector::ToggleVisible(md, visible), con la pila del juego y los demás registros intactos
void visible(CpuContext* ctx, uint32_t md, bool v) {
    CpuContext c = *ctx;
    c.gpr[3] = md; c.gpr[4] = v ? 1 : 0;
    InvokeDirectCpu<0x8055C9F0u>(&c);
}
}  // namespace

extern "C" EMSCRIPTEN_KEEPALIVE void mkw_techo_modo(int m) { g_modo = m; }
extern "C" EMSCRIPTEN_KEEPALIVE void mkw_techo_mascara(uint32_t m) { g_mascara = m; }
extern "C" EMSCRIPTEN_KEEPALIVE double mkw_techo_dato(int i) {
    switch (i) {
        case 0: return g_cargados;
        case 1: return double(g_curso);
        case 2: return g_escondidas;
        case 3: return double(modo());
        case 4: return g_efectos;
        case 5: return g_escondidosUltimo;
        case 6: return g_dibujosMascara;
        case 7: return double(mascara());
        default: return (i >= 10 && i < 34) ? g_porOpcion[i - 10] : -1;
    }
}

// Retro Rewind cambia esta función: en RR quien carga los modelos de la pista (0x8078E33C) llama a su copia
// rr_overlay_8078E1B0 (mismos argumentos), no a la del juego. Se envuelven las dos.
namespace {
void anotarModelo(CpuContext* ctx, void (*original)(CpuContext*)) {
    const uint32_t destino = ctx->gpr[5], nombre = ctx->gpr[6];
    char n[48];
    nombreDe(nombre, n);
    original(ctx);
    const uint32_t md = destino ? Memory::Read32(destino) : 0;
    g_cargados++;
    if (md) {   // una pista nueva vuelve a llenar la lista desde el principio cuando se llena
        if (g_nDePista == 16) g_nDePista = 0;
        g_dePista[g_nDePista++] = md;
    }
    // el nombre que llega es el del archivo: la pista es «course_model.brres»; el cielo, «vrcorn_model.brres»
    if (md && std::strcmp(n, "course_model.brres") == 0) { g_cursos[0] = g_cursos[1]; g_cursos[1] = md; g_curso = md; }
    if (std::getenv("MKW_TECHO")) std::printf("[techo] modelo «%s» → ModelDirector %08x%s\n", n, md, md == g_curso ? " (la pista)" : "");
}
}  // namespace

extern "C" void func_8078E1B0_traducida(CpuContext* ctx);   // CourseMgr::LoadModels (cargar un modelo)
extern "C" void func_8078E1B0(CpuContext* ctx) { anotarModelo(ctx, func_8078E1B0_traducida); }
extern "C" void rr_overlay_8078E1B0_traducida(CpuContext* ctx);   // la copia de RR
extern "C" void rr_overlay_8078E1B0(CpuContext* ctx) { anotarModelo(ctx, rr_overlay_8078E1B0_traducida); }

extern "C" void func_8023AEAC_traducida(CpuContext* ctx);   // EGG::SceneManager::draw
extern "C" void func_8023AEAC(CpuContext* ctx) {
    if ((modo() & 1) && g_curso) {
        for (const uint32_t md : g_cursos) if (md) visible(ctx, md, false);   // ToggleVisible(pista, false)
        g_escondidas++;
    }
    func_8023AEAC_traducida(ctx);
}

// §222: los efectos. EGG::EffectManager::Draw es el único camino al dibujo de las partículas (7 llamadas, todas desde
// Effects::Mgr); su cálculo va por EffectManager::CalcEffect (0x802250E0), que no se toca.
extern "C" void func_802251DC_traducida(CpuContext* ctx);
extern "C" void func_802251DC(CpuContext* ctx) {
    if (modo() & 2) { g_efectos++; return; }
    func_802251DC_traducida(ctx);
}

// §222: los modelos por opción de dibujo, solo en el dibujo de la carrera.
extern "C" void func_805B1CD8_traducida(CpuContext* ctx);   // ScnMgrRace::DrawModels
extern "C" void func_805B1CD8(CpuContext* ctx) {
    g_enCarrera = true;
    func_805B1CD8_traducida(ctx);
    g_enCarrera = false;
}

extern "C" void func_805625A8_traducida(CpuContext* ctx);   // ScnMgr::DrawModelsImpl(this, screen)
extern "C" void func_805625A8(CpuContext* ctx) {
    if (!g_enCarrera) { func_805625A8_traducida(ctx); return; }
    const bool esconder = (modo() & 4) && mascara();
    const bool contar = std::getenv("MKW_TECHO") != nullptr;
    const uint32_t mgr = ctx->gpr[3];
    // la lista de todos los ModelDirector del ScnMgr (nw4r::ut::List en +0x58: cabeza, cola, cuántos, desplazamiento
    // del enlace; el enlace es {anterior, siguiente})
    uint32_t escondidos[512];
    int n = 0;
    double porOpcion[24] = {};
    if (esconder || contar) {
        const uint16_t desp = Memory::Read16(mgr + 0x58 + 0xA);
        uint32_t md = Memory::Read32(mgr + 0x58);
        for (int guarda = 0; md && guarda < 4096; guarda++) {
            const uint32_t sig = Memory::Read32(md + desp + 4);
            const uint32_t op = Memory::Read32(md + 0x24), bits = Memory::Read32(md + 0x4);
            const bool enEscena = (bits & 0x200000u) && !(bits & 0x1000000u);   // metido en los grupos y no sacado
            if (enEscena && op < 24) porOpcion[op]++;
            if (esconder && enEscena && op < 24 && (mascara() >> op & 1) && !esDePista(md) && n < 512) {
                visible(ctx, md, false);
                escondidos[n++] = md;
            }
            md = sig;
        }
        std::memcpy(g_porOpcion, porOpcion, sizeof porOpcion);
    }
    func_805625A8_traducida(ctx);
    for (int i = n - 1; i >= 0; i--) visible(ctx, escondidos[i], true);   // de vuelta, antes de SwitchScnRoot
    if (esconder) { g_escondidosUltimo = n; g_dibujosMascara++; }
    static int veces = 0;   // en Node, cada 600 dibujos de la carrera: qué hay en la escena por opción
    if (contar && ++veces % 600 == 1) {
        std::printf("[techo] dibujo de la carrera: escondidos %d; en la escena por opción:", n);
        for (int k = 0; k < 24; k++) if (porOpcion[k]) std::printf(" %d:%d", k, int(porOpcion[k]));
        std::printf("\n");
    }
}
