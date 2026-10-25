# Compila el decodificador THP nativo (web/thp/thp_decodificador.cpp) + su envoltorio a thp.js + thp.wasm, con las
# mismas opciones que usa el juego para esa pieza (compilar-web.py, grupo "thp": -O3 y SIMD).
$Raiz = Resolve-Path "$PSScriptRoot\..\..\.."
$env:EMSDK_QUIET = '1'
. "$Raiz\herramientas\emsdk\emsdk_env.ps1" *> $null
$ErrorActionPreference = 'Stop'
$emxx = "$Raiz\herramientas\emsdk\upstream\emscripten\em++.exe"
Push-Location $PSScriptRoot
try {
  & $emxx envoltorio.cpp "$Raiz\web\thp\thp_decodificador.cpp" -o thp.js -std=c++20 -O3 -msimd128 -w `
    '-sEXPORTED_FUNCTIONS=["_malloc","_free","_thp_cabecera","_thp_decodificar"]' `
    '-sEXPORTED_RUNTIME_METHODS=["HEAPU8","HEAP32"]' -sALLOW_MEMORY_GROWTH=1 `
    -sMODULARIZE=1 -sEXPORT_ES6=1 '-sENVIRONMENT=web,node'
  if ($LASTEXITCODE) { throw "em++ falló ($LASTEXITCODE)" }
  Get-Item thp.js, thp.wasm | Select-Object Name, Length
} finally { Pop-Location }
