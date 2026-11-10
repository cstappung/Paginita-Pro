# E4c (W25), paso 0, pieza C2: pasa las texturas BC1 de G6 (§190.2) a la aurora del motor
# (terceros/aurora-main-viejo-motor), todo detrás de MKW_CHICA_C2 (sin la marca, aurora compila igual que antes).
#
# Qué hace, en orden:
#   1) texture_convert.hpp: la declaración de cmpr_to_bc1;
#   2) texture_convert.cpp: la función cmpr_to_bc1 copiada de terceros/Wiicompiled/aurora-main (donde se escribió en §190);
#   3) texture.cpp: el contador, la verificación, la decisión «¿esta CMPR va en BC1?», una función que crea la textura
#      en BC1 y la exportación mkw_web_texturas_bc.
# Con MKW_CHICA_C2 las texturas van en BC1 POR OMISIÓN (MKW_TEXTURAS_BC_DEF=1); la página puede pedir
# ?texturasBc=0 (apagadas) o ?texturasBc=verifica.
# Uso: python -I herramientas/e4c/portar-c2.py   (si ya está puesto, no hace nada)
import pathlib, re, sys
sys.stdout.reconfigure(encoding="utf-8")   # -I no deja usar PYTHONIOENCODING y la consola de Windows no tiene «✓»

RAIZ = pathlib.Path(__file__).resolve().parents[2]
DEST = RAIZ / "terceros" / "aurora-main-viejo-motor" / "lib" / "gfx"
ORIG = RAIZ / "terceros" / "Wiicompiled" / "aurora-main" / "lib" / "gfx"
MARCA = "MKW_CHICA_C2"


def leer(p):  # se lee en binario para no tocar los finales de línea mezclados del archivo
    return p.read_bytes().decode("utf-8")


def escribir(p, t):
    p.write_bytes(t.encode("utf-8"))


def reemplazar_una(t, viejo, nuevo, donde):
    # texture.cpp trae finales de línea mezclados: si el texto no está con «\n», se busca con «\r\n»
    if t.count(viejo) == 0 and "\n" in viejo and t.count(viejo.replace("\n", "\r\n")) == 1:
        viejo, nuevo = viejo.replace("\n", "\r\n"), nuevo.replace("\n", "\r\n")
    n = t.count(viejo)
    if n != 1:
        sys.exit(f"✗ {donde}: se esperaba 1 vez «{viejo.strip()[:60]}», hay {n}")
    return t.replace(viejo, nuevo)


# 1) la declaración
hpp = DEST / "texture_convert.hpp"
t = leer(hpp)
if MARCA not in t:
    ancla = re.search(r"ConvertedTexture convert_tlut\([^\n]*\n", t)
    if not ancla:
        sys.exit("✗ texture_convert.hpp: no encuentro convert_tlut")
    t = t[:ancla.end()] + ("#if MKW_CHICA_C2   // MKW RETRO (E4c C2, G6 §190): CMPR → BC1 sin descomprimir; false = va por RGBA8\n"
                           "bool cmpr_to_bc1(uint32_t width, uint32_t height, uint32_t mips, ArrayRef<uint8_t> data, ByteBuffer& out);\n"
                           "#endif\n") + t[ancla.end():]
    escribir(hpp, t)
    print("✓ texture_convert.hpp")

# 2) la función, tal como quedó en la aurora de §190
cpp = DEST / "texture_convert.cpp"
t = leer(cpp)
if MARCA not in t:
    o = leer(ORIG / "texture_convert.cpp").replace("\r\n", "\n")
    i = o.index("// MKW RETRO (G6, §190): CMPR (la textura comprimida")
    f = o.index("\n}\n", o.index("bool cmpr_to_bc1(", i)) + 3
    fn = o[i:f]
    if "#include <cstring>" not in t:
        t = t.replace("#include <algorithm>", "#include <algorithm>\n#include <cstring>", 1)
    fin = t.rindex("} // namespace aurora::gfx")
    t = t[:fin] + "#if MKW_CHICA_C2\n" + fn + "#endif\n" + t[fin:]
    escribir(cpp, t)
    print("✓ texture_convert.cpp")

# 3) texture.cpp
tex = DEST / "texture.cpp"
t = leer(tex)
if MARCA not in t:
    o = leer(ORIG / "texture.cpp").replace("\r\n", "\n")
    i = o.index("// MKW RETRO (G6, §190): las texturas CMPR de la Wii suben como BC1")
    f = o.index("\n}\n", o.index("bool texturas_bc() noexcept {", i)) + 3
    bloque = o[i:f]
    # sin la variable de entorno vale MKW_TEXTURAS_BC_DEF (1 en el paquete); «0» = apagadas
    bloque = reemplazar_una(bloque, "g_texturasBc = v == nullptr ? 0 : v[0] == '1' ? 1",
                            "g_texturasBc = v == nullptr ? MKW_TEXTURAS_BC_DEF : v[0] == '1' ? 1", "texturas_bc")
    bloque = ("#ifndef MKW_TEXTURAS_BC_DEF\n#define MKW_TEXTURAS_BC_DEF 1\n#endif\n" + bloque +
              "TextureHandle mkw_textura_bc1(uint32_t width, uint32_t height, uint32_t mips, u32 gxFormat,\n"
              "                              const char* label) noexcept;\n")
    t = t.replace("#include <utility>", "#include <utility>\n#include <cstdlib>\n#include <cmath>\n#include <cstring>", 1)
    t = reemplazar_una(t, "TextureHandle new_static_texture_2d(",
                       "#if MKW_CHICA_C2   // MKW RETRO (E4c C2)\n" + bloque + "#endif\n\nTextureHandle new_static_texture_2d(",
                       "new_static_texture_2d")
    decide = o[o.index("  // MKW RETRO (G6, §190): CMPR → BC1 cuando se puede"):o.index("  auto& ref = *handle;", o.index("  // MKW RETRO (G6, §190): CMPR → BC1 cuando se puede"))]
    decide = reemplazar_una(decide, "new_texture_2d_with_format(width, height, mips, format, wgpu::TextureFormat::BC1RGBAUnorm, label)",
                            "mkw_textura_bc1(width, height, mips, format, label)", "decide")
    t = reemplazar_una(t, "  auto handle = new_dynamic_texture_2d(width, height, mips, format, label);\n",
                       "#if MKW_CHICA_C2\n" + decide + "#else\n  auto handle = new_dynamic_texture_2d(width, height, mips, format, label);\n#endif\n",
                       "handle")
    t = t.replace("  ConvertedTexture converted;\n  if (ref.gxFormat != InvalidTextureFormat) {",
                  "  ConvertedTexture converted;\n#if MKW_CHICA_C2\n  if (usarBc) {\n    data = {bc.data(), bc.size()};\n  } else\n#endif\n"
                  "  if (ref.gxFormat != InvalidTextureFormat) {", 1)
    if "if (usarBc) {\n    data" not in t:
        t = t.replace("  ConvertedTexture converted;\r\n  if (ref.gxFormat != InvalidTextureFormat) {",
                      "  ConvertedTexture converted;\n#if MKW_CHICA_C2\n  if (usarBc) {\n    data = {bc.data(), bc.size()};\n  } else\n#endif\n"
                      "  if (ref.gxFormat != InvalidTextureFormat) {", 1)
    if "if (usarBc) {\n    data" not in t:
        sys.exit("✗ texture.cpp: no encuentro «ConvertedTexture converted; if (ref.gxFormat …»")
    # la textura en BC1: la misma de new_dynamic_texture_2d con otro formato
    i = t.index("TextureHandle new_dynamic_texture_2d(")
    f = t.index("\nTextureHandle new_render_texture(", i)
    copia = t[i:f].replace("\r\n", "\n")
    copia = reemplazar_una(copia, "TextureHandle new_dynamic_texture_2d(uint32_t width, uint32_t height, uint32_t mips, u32 gxFormat,\n"
                                  "                                     const char* label) noexcept {",
                           "TextureHandle mkw_textura_bc1(uint32_t width, uint32_t height, uint32_t mips, u32 gxFormat,\n"
                           "                              const char* label) noexcept {", "copia")
    copia = reemplazar_una(copia, "const auto wgpuFormat = to_wgpu(gxFormat);",
                           "const auto wgpuFormat = wgpu::TextureFormat::BC1RGBAUnorm;", "copia")
    t = t[:f] + "\n#if MKW_CHICA_C2\n" + copia.strip("\n") + "\n#endif\n" + t[f:]
    t = t.rstrip() + ("\n\n#if MKW_CHICA_C2   // MKW RETRO (E4c C2): k = 0..8, ver texturas_bc\n"
                      "extern \"C\" EMSCRIPTEN_KEEPALIVE uint32_t mkw_web_texturas_bc(uint32_t k) { return k < 9 ? aurora::gfx::g_bcCuenta[k] : 0; }\n"
                      "#endif\n")
    escribir(tex, t)
    print("✓ texture.cpp")
print("C2 puesto en la aurora del motor (detrás de MKW_CHICA_C2)")
