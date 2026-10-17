# Compila la prueba de FMA (fma.c → fma.js + fma.wasm). Mismas opciones de coma flotante que el juego traducido
# (-fno-fast-math -ffp-contract=off: el compilador no puede fusionar ni reordenar operaciones por su cuenta).
$Raiz = Resolve-Path "$PSScriptRoot\..\..\.."
$env:EMSDK_QUIET = '1'
. "$Raiz\herramientas\emsdk\emsdk_env.ps1" *> $null
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
  emcc fma.c -O2 -fno-fast-math -ffp-contract=off -o fma.js `
    '-sEXPORTED_FUNCTIONS=["_main","_corre","_dato","_ejemplo"]' `
    '-sEXPORTED_RUNTIME_METHODS=["UTF8ToString"]' `
    -sMODULARIZE=1 -sEXPORT_ES6=1 '-sENVIRONMENT=web,node'
  if ($LASTEXITCODE) { throw "emcc falló ($LASTEXITCODE)" }
  Get-Item fma.js, fma.wasm | Select-Object Name, Length
} finally { Pop-Location }
