# Compila la prueba de excepciones entre fibers (excepciones.cpp → excepciones.js + .wasm) con -fwasm-exceptions + JSPI.
$Raiz = Resolve-Path "$PSScriptRoot\..\..\.."
$env:EMSDK_QUIET = '1'
. "$Raiz\herramientas\emsdk\emsdk_env.ps1" *> $null
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
  em++ excepciones.cpp -O2 -std=c++20 -fwasm-exceptions -o excepciones.js `
    -sJSPI=1 '-sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE=["$stackSave","$stackRestore"]' '-sJSPI_EXPORTS=["fx_trampolin"]' `
    '-sEXPORTED_FUNCTIONS=["_main","_fx_trampolin","_registro","_emscripten_stack_set_limits"]' `
    '-sEXPORTED_RUNTIME_METHODS=["UTF8ToString","callMain"]' `
    -sINVOKE_RUN=0 -sMODULARIZE=1 -sEXPORT_ES6=1 '-sENVIRONMENT=web,node' -sALLOW_MEMORY_GROWTH=1
  if ($LASTEXITCODE) { throw "em++ falló ($LASTEXITCODE)" }
  Get-Item excepciones.js, excepciones.wasm | Select-Object Name, Length
} finally { Pop-Location }
