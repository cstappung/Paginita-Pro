# Compila la prueba de fibers sobre JSPI (fibers.c → fibers.js + fibers.wasm).
# Resumen: carga Emscripten desde herramientas\emsdk y compila con JSPI. fiber_trampolin se exporta como
# "promising" (JSPI_EXPORTS) para que cada fiber nuevo tenga su propia pila de wasm.
$Raiz = Resolve-Path "$PSScriptRoot\..\..\.."                       # la carpeta del proyecto
$env:EMSDK_QUIET = '1'
. "$Raiz\herramientas\emsdk\emsdk_env.ps1" *> $null                 # emcc en el PATH (antes de 'Stop': escribe en stderr)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
  emcc fibers.c -O2 -o fibers.js `
    -sJSPI=1 '-sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE=["$stackSave","$stackRestore"]' `
    '-sJSPI_EXPORTS=["fiber_trampolin","mide_cambios"]' `
    '-sEXPORTED_FUNCTIONS=["_main","_fiber_trampolin","_orden","_resultado","_quien_espero","_mide_cambios","_emscripten_stack_set_limits"]' `
    '-sEXPORTED_RUNTIME_METHODS=["UTF8ToString","callMain"]' `
    -sINVOKE_RUN=0 -sMODULARIZE=1 -sEXPORT_ES6=1 '-sENVIRONMENT=web,node' `
    -sSTACK_SIZE=1MB -sALLOW_MEMORY_GROWTH=1
  if ($LASTEXITCODE) { throw "emcc falló ($LASTEXITCODE)" }
  Get-Item fibers.js, fibers.wasm | Select-Object Name, Length
} finally { Pop-Location }
