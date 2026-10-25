// Un "juego falso" para la prueba de partidas guardadas: escribe, renombra y borra archivos con las mismas
// funciones de C que usa el juego de verdad (fopen/fwrite/fclose, rename, remove). Así la prueba pasa por el
// mismo camino: C → llamadas al sistema de Emscripten → FS.close / FS.rename / FS.unlink del MEMFS real.
#include <stdio.h>
#include <emscripten.h>

// Escribe un archivo de n bytes, todos con el mismo valor (como una partida nueva)
EMSCRIPTEN_KEEPALIVE int escribe(const char* ruta, int n, int valor) {
    FILE* f = fopen(ruta, "wb");
    if (!f) return -1;
    for (int i = 0; i < n; i++) fputc(valor, f);
    fclose(f);
    return 0;
}

// Guardado "seguro" como el del runtime: escribe un .tmp y después lo renombra encima del archivo final
EMSCRIPTEN_KEEPALIVE int escribe_seguro(const char* ruta, const char* tmp, int n, int valor) {
    if (escribe(tmp, n, valor)) return -1;
    return rename(tmp, ruta);
}

EMSCRIPTEN_KEEPALIVE int borra(const char* ruta) { return remove(ruta); }

int main(void) { return 0; }
