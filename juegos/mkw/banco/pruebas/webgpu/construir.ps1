# Compila la prueba de WebGPU (webgpu.cpp → webgpu.js + webgpu.wasm) con emdawnwebgpu y JSPI.
# Resumen: --use-port=emdawnwebgpu da la misma API webgpu_cpp.h que usa aurora, pero sobre el WebGPU del navegador.
# -sJSPI deja que Instance::WaitAny suspenda el programa en vez de bloquear la pestaña.
$Raiz = Resolve-Path "$PSScriptRoot\..\..\.."
$env:EMSDK_QUIET = '1'
. "$Raiz\herramientas\emsdk\emsdk_env.ps1" *> $null
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
  em++ webgpu.cpp -O2 -std=c++20 -o webgpu.js `
    --use-port=emdawnwebgpu `
    -sJSPI=1 `
    '-sEXPORTED_FUNCTIONS=["_main","_paso","_cuadros","_ms_total","_ms_lectura","_lecturas_bien","_lecturas","_error"]' `
    '-sEXPORTED_RUNTIME_METHODS=["UTF8ToString","callMain"]' `
    -sINVOKE_RUN=0 -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web -sALLOW_MEMORY_GROWTH=1
  if ($LASTEXITCODE) { throw "em++ falló ($LASTEXITCODE)" }
  Get-Item webgpu.js, webgpu.wasm | Select-Object Name, Length
} finally { Pop-Location }
