# Compila el "juego falso" de la prueba de partidas guardadas (archivos.c → archivos.js + archivos.wasm).
# Resumen: carga Emscripten desde herramientas\emsdk y compila con el sistema de archivos en memoria (MEMFS) de
# verdad, exportando FS (para que la prueba lo vigile igual que mkw.mjs) y ccall (para llamar a las funciones de C).
$Raiz = Resolve-Path "$PSScriptRoot\..\..\.."                       # la carpeta del proyecto
$env:EMSDK_QUIET = '1'
. "$Raiz\herramientas\emsdk\emsdk_env.ps1" *> $null                 # emcc en el PATH (antes de 'Stop': escribe en stderr)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
  emcc archivos.c -O2 -o archivos.js `
    -sFORCE_FILESYSTEM=1 '-sEXPORTED_RUNTIME_METHODS=["FS","ccall"]' `
    '-sEXPORTED_FUNCTIONS=["_main","_escribe","_escribe_seguro","_borra"]' `
    -sINVOKE_RUN=0 -sMODULARIZE=1 -sEXPORT_ES6=1 '-sENVIRONMENT=web,node' -sALLOW_MEMORY_GROWTH=1
  if ($LASTEXITCODE) { throw "emcc falló ($LASTEXITCODE)" }
  Get-Item archivos.js, archivos.wasm | Select-Object Name, Length
} finally { Pop-Location }
