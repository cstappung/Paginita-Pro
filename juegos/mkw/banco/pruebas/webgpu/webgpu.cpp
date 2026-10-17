/* Prueba de concepto: WebGPU desde C++ (emdawnwebgpu) con las esperas de aurora suspendidas por JSPI.
 *
 * Resumen: aurora (el renderizador de WiiCompiled) usa la API de Dawn (webgpu_cpp.h) y en tres lugares ESPERA a la
 * GPU de forma bloqueante con Instance::WaitAny: al pedir el adaptador, al pedir el dispositivo y, en cada cuadro,
 * al leer de vuelta píxeles a la RAM (la copia de EFB, efb_ram_copy.cpp). En el navegador no se puede bloquear;
 * esta prueba verifica que esas mismas llamadas funcionan suspendiendo el programa con JSPI, y que se puede
 * dibujar a 60 fps desde un bucle "infinito" como el del juego (que cede el control al terminar cada cuadro, igual
 * que aurora_end_frame en vi.cpp).
 *
 * Qué mide (lo lee la página): si cada paso funcionó, los cuadros por segundo, cuánto tarda la lectura de vuelta
 * de la GPU por cuadro y si el color leído es el correcto.
 */
#include <emscripten.h>
#include <webgpu/webgpu_cpp.h>
#include <cstdio>
#include <cstring>

static wgpu::Instance gInstancia;               /* la "conexión" con WebGPU */
static wgpu::Adapter gAdaptador;                /* la tarjeta de video elegida */
static wgpu::Device gDispositivo;               /* lo que se usa para crear y mandar trabajo a la GPU */
static wgpu::Surface gSuperficie;               /* el <canvas> donde se dibuja */
static wgpu::RenderPipeline gPipeline;          /* el "programa" de dibujo (shaders WGSL + estado) */
static wgpu::TextureFormat gFormato;            /* el formato de color del canvas */

/* Resultados que la página lee */
static int gPaso = 0;                           /* hasta qué paso llegó: 1 adaptador, 2 dispositivo, 3 superficie, 4 pipeline, 5 cuadros */
static double gMsLectura = 0;                   /* tiempo total de las lecturas de vuelta */
static int gLecturas = 0, gLecturasBien = 0;    /* cuántas lecturas y cuántas dieron el color esperado */
static int gCuadros = 0;
static double gMsTotal = 0;
static char gError[256] = "";

extern "C" {
EMSCRIPTEN_KEEPALIVE int paso(void) { return gPaso; }
EMSCRIPTEN_KEEPALIVE int cuadros(void) { return gCuadros; }
EMSCRIPTEN_KEEPALIVE double ms_total(void) { return gMsTotal; }
EMSCRIPTEN_KEEPALIVE double ms_lectura(void) { return gLecturas ? gMsLectura / gLecturas : 0; }
EMSCRIPTEN_KEEPALIVE int lecturas_bien(void) { return gLecturasBien; }
EMSCRIPTEN_KEEPALIVE int lecturas(void) { return gLecturas; }
EMSCRIPTEN_KEEPALIVE const char *error(void) { return gError; }
}

/* Ceder el control al navegador hasta el próximo cuadro de pantalla (como el fin de cuadro del juego).
 * EM_ASYNC_JS + JSPI: el programa queda suspendido y el navegador muestra lo dibujado. */
EM_ASYNC_JS(void, espera_cuadro, (void), {
    /* con la pestaña oculta el navegador no da cuadros: entonces se espera 16 ms (la página lo avisa) */
    await new Promise(r => document.hidden ? setTimeout(r, 16) : requestAnimationFrame(() => r()));
});

/* El shader: un triángulo que gira (WGSL, como los que genera aurora) */
static const char *kShader = R"(
struct U { t: f32 };
@group(0) @binding(0) var<uniform> u: U;
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let a = u.t + f32(i) * 2.0944;                       // 120° entre vértices
  return vec4f(0.6 * cos(a), 0.6 * sin(a), 0.0, 1.0);
}
@fragment fn fs() -> @location(0) vec4f { return vec4f(0.894, 0.0, 0.169, 1.0); }   // rojo Mario
)";

int main() {
    /* 1. Instancia con TimedWaitAny (aurora la pide igual: gpu.cpp) y adaptador esperando con WaitAny */
    wgpu::InstanceDescriptor di{};
    static const wgpu::InstanceFeatureName kFeat[] = {wgpu::InstanceFeatureName::TimedWaitAny};
    di.requiredFeatureCount = 1;
    di.requiredFeatures = kFeat;
    gInstancia = wgpu::CreateInstance(&di);
    if (!gInstancia) { snprintf(gError, sizeof gError, "CreateInstance falló"); return 1; }

    wgpu::RequestAdapterOptions oa{};
    oa.powerPreference = wgpu::PowerPreference::HighPerformance;
    wgpu::Future fa = gInstancia.RequestAdapter(&oa, wgpu::CallbackMode::WaitAnyOnly,
        [](wgpu::RequestAdapterStatus s, wgpu::Adapter a, wgpu::StringView msg) {
            if (s == wgpu::RequestAdapterStatus::Success) gAdaptador = std::move(a);
            else snprintf(gError, sizeof gError, "adaptador: %.*s", (int)msg.length, msg.data);
        });
    if (gInstancia.WaitAny(fa, UINT64_MAX) != wgpu::WaitStatus::Success || !gAdaptador) return 1;   /* ← suspende */
    gPaso = 1;

    /* 2. Dispositivo, también esperando */
    wgpu::DeviceDescriptor dd{};
    dd.SetUncapturedErrorCallback([](const wgpu::Device &, wgpu::ErrorType t, wgpu::StringView msg) {
        snprintf(gError, sizeof gError, "error de GPU %d: %.*s", (int)t, (int)msg.length, msg.data);
    });
    wgpu::Future fd = gAdaptador.RequestDevice(&dd, wgpu::CallbackMode::WaitAnyOnly,
        [](wgpu::RequestDeviceStatus s, wgpu::Device d, wgpu::StringView msg) {
            if (s == wgpu::RequestDeviceStatus::Success) gDispositivo = std::move(d);
            else snprintf(gError, sizeof gError, "dispositivo: %.*s", (int)msg.length, msg.data);
        });
    if (gInstancia.WaitAny(fd, UINT64_MAX) != wgpu::WaitStatus::Success || !gDispositivo) return 1;
    gPaso = 2;

    /* 3. La superficie: el <canvas id="lienzo"> (lo que falta en BackendBinding.cpp de aurora) */
    wgpu::EmscriptenSurfaceSourceCanvasHTMLSelector canvas{};
    canvas.selector = "#lienzo";
    wgpu::SurfaceDescriptor ds{};
    ds.nextInChain = &canvas;
    gSuperficie = gInstancia.CreateSurface(&ds);
    wgpu::SurfaceCapabilities caps;
    gSuperficie.GetCapabilities(gAdaptador, &caps);
    gFormato = caps.formats[0];
    wgpu::SurfaceConfiguration sc{};
    sc.device = gDispositivo;
    sc.format = gFormato;
    sc.width = 640; sc.height = 528;            /* la resolución interna de la Wii (PAL) */
    sc.presentMode = wgpu::PresentMode::Fifo;
    gSuperficie.Configure(&sc);
    gPaso = 3;

    /* 4. El pipeline: shader WGSL compilado en el momento (como aurora) */
    wgpu::ShaderSourceWGSL wgsl{};
    wgsl.code = kShader;
    wgpu::ShaderModuleDescriptor dsm{};
    dsm.nextInChain = &wgsl;
    wgpu::ShaderModule sm = gDispositivo.CreateShaderModule(&dsm);
    wgpu::ColorTargetState ct{};
    ct.format = gFormato;
    wgpu::FragmentState fs{};
    fs.module = sm; fs.entryPoint = "fs"; fs.targetCount = 1; fs.targets = &ct;
    wgpu::RenderPipelineDescriptor dp{};
    dp.vertex.module = sm; dp.vertex.entryPoint = "vs";
    dp.fragment = &fs;
    gPipeline = gDispositivo.CreateRenderPipeline(&dp);
    wgpu::BufferDescriptor du{};
    du.size = 16; du.usage = wgpu::BufferUsage::Uniform | wgpu::BufferUsage::CopyDst;
    wgpu::Buffer uniforme = gDispositivo.CreateBuffer(&du);
    wgpu::BindGroupEntry be{};
    be.binding = 0; be.buffer = uniforme; be.size = 16;
    wgpu::BindGroupDescriptor dbg{};
    dbg.layout = gPipeline.GetBindGroupLayout(0); dbg.entryCount = 1; dbg.entries = &be;
    wgpu::BindGroup grupo = gDispositivo.CreateBindGroup(&dbg);

    /* Una textura propia "EFB" (como la de aurora) para leer de vuelta: se dibuja ahí y se copia a un búfer */
    wgpu::TextureDescriptor dt{};
    dt.size = {64, 64, 1};
    dt.format = wgpu::TextureFormat::RGBA8Unorm;
    dt.usage = wgpu::TextureUsage::RenderAttachment | wgpu::TextureUsage::CopySrc;
    wgpu::Texture efb = gDispositivo.CreateTexture(&dt);
    wgpu::ColorTargetState ct2{}; ct2.format = wgpu::TextureFormat::RGBA8Unorm;
    wgpu::FragmentState fs2 = fs; fs2.targets = &ct2;
    wgpu::RenderPipelineDescriptor dp2 = dp; dp2.fragment = &fs2;
    wgpu::RenderPipeline pipelineEfb = gDispositivo.CreateRenderPipeline(&dp2);
    wgpu::BindGroupDescriptor dbg2 = dbg; dbg2.layout = pipelineEfb.GetBindGroupLayout(0);
    wgpu::BindGroup grupoEfb = gDispositivo.CreateBindGroup(&dbg2);
    wgpu::BufferDescriptor dl{};
    dl.size = 256 * 64; dl.usage = wgpu::BufferUsage::CopyDst | wgpu::BufferUsage::MapRead;   /* 256 B por fila (alineación) */
    wgpu::Buffer lectura = gDispositivo.CreateBuffer(&dl);
    gPaso = 4;

    /* 5. El bucle del juego: 180 cuadros, cada uno dibuja, lee de vuelta un píxel (EFB→RAM) y cede el control */
    double t0 = emscripten_get_now();
    for (int i = 0; i < 180; i++) {
        float t = i * 0.05f;
        gDispositivo.GetQueue().WriteBuffer(uniforme, 0, &t, 4);

        wgpu::SurfaceTexture st;
        gSuperficie.GetCurrentTexture(&st);
        wgpu::CommandEncoder enc = gDispositivo.CreateCommandEncoder();
        auto pasada = [&](wgpu::TextureView vista, wgpu::RenderPipeline &pl, wgpu::BindGroup &g) {
            wgpu::RenderPassColorAttachment ca{};
            ca.view = vista; ca.loadOp = wgpu::LoadOp::Clear; ca.storeOp = wgpu::StoreOp::Store;
            ca.clearValue = {0.05, 0.06, 0.08, 1.0};
            wgpu::RenderPassDescriptor rp{}; rp.colorAttachmentCount = 1; rp.colorAttachments = &ca;
            wgpu::RenderPassEncoder p = enc.BeginRenderPass(&rp);
            p.SetPipeline(pl); p.SetBindGroup(0, g); p.Draw(3); p.End();
        };
        pasada(st.texture.CreateView(), gPipeline, grupo);          /* lo que se ve */
        pasada(efb.CreateView(), pipelineEfb, grupoEfb);             /* la "EFB" */
        wgpu::TexelCopyTextureInfo src{}; src.texture = efb;
        wgpu::TexelCopyBufferInfo dst{}; dst.buffer = lectura; dst.layout.bytesPerRow = 256; dst.layout.rowsPerImage = 64;
        wgpu::Extent3D ext{64, 64, 1};
        enc.CopyTextureToBuffer(&src, &dst, &ext);
        wgpu::CommandBuffer cmd = enc.Finish();
        gDispositivo.GetQueue().Submit(1, &cmd);

        /* la lectura de vuelta SÍNCRONA, como efb_ram_copy.cpp: MapAsync + WaitAny (← suspende con JSPI) */
        double tl = emscripten_get_now();
        bool mapeado = false;
        wgpu::Future fm = lectura.MapAsync(wgpu::MapMode::Read, 0, dl.size, wgpu::CallbackMode::WaitAnyOnly,
            [&](wgpu::MapAsyncStatus s, wgpu::StringView) { mapeado = s == wgpu::MapAsyncStatus::Success; });
        gInstancia.WaitAny(fm, UINT64_MAX);
        gMsLectura += emscripten_get_now() - tl;
        gLecturas++;
        if (mapeado) {
            const uint8_t *px = (const uint8_t *)lectura.GetConstMappedRange(0, dl.size);
            const uint8_t *c = px + 32 * 256 + 32 * 4;               /* el píxel del centro: dentro del triángulo */
            if (c[0] > 220 && c[1] < 10 && c[2] > 30 && c[2] < 55) gLecturasBien++;   /* rojo (228, 0, 43) */
            lectura.Unmap();
        }
        espera_cuadro();                                             /* fin de cuadro: el navegador muestra */
        gCuadros++;
    }
    gMsTotal = emscripten_get_now() - t0;
    gPaso = 5;
    printf("webgpu: %d cuadros en %.0f ms, lectura media %.2f ms\n", gCuadros, gMsTotal, gMsLectura / gLecturas);
    return 0;
}
