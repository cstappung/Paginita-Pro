# Compila la prueba de paridad dos veces: x86 nativo (g++, la referencia) y wasm (em++, nuestro parche).
# Escribe referencia-x86.txt (huellas de x86 con 1M casos) y paridad.js + paridad.wasm.
# -Simd: además paridad-simd.js/.wasm, compilado con -msimd128 (el experimento de compilar-web.py --simd).
param([switch]$Simd)
$Raiz = Resolve-Path "$PSScriptRoot\..\..\.."
$env:EMSDK_QUIET = '1'
. "$Raiz\herramientas\emsdk\emsdk_env.ps1" *> $null
$ErrorActionPreference = 'Stop'
$WC = "$Raiz\terceros\Wiicompiled"
# em++ por su ruta (emsdk_env.ps1 no siempre lo deja en el PATH de esta consola)
$emxx = "$Raiz\herramientas\emsdk\upstream\emscripten\em++.exe"
$inc = @('-I', "$WC\runtime\include", '-I', "$WC\runtime\src", '-I', "$WC")
$fp = @('-O2', '-std=c++20', '-fno-fast-math', '-ffp-contract=off', '-w', '-DTARGET_PC')
Push-Location $PSScriptRoot
try {
  # x86-64-v3 = el perfil de CPU del build de PC (AVX2 + FMA). __regcall no existe en g++: se vacía.
  $exe = Join-Path $env:TEMP 'paridad-x86.exe'
  $cmd = Get-Command g++ -ErrorAction SilentlyContinue        # (sin .Source directo: falla en modo estricto si no hay g++)
  $gxx = if ($cmd) { $cmd.Source } else { 'C:\Strawberry\c\bin\g++.exe' }   # MinGW de Strawberry Perl
  & $gxx paridad.cpp -o $exe @fp -march=x86-64-v3 '-D__regcall=' @inc
  if ($LASTEXITCODE) { throw "g++ falló ($LASTEXITCODE)" }
  & $exe 1000000 | Set-Content -Encoding ascii referencia-x86.txt
  & $emxx paridad.cpp -o paridad.js @fp @inc `
    '-sEXPORTED_RUNTIME_METHODS=["callMain"]' -sINVOKE_RUN=0 -sMODULARIZE=1 -sEXPORT_ES6=1 '-sENVIRONMENT=web,node' -sEXIT_RUNTIME=0
  if ($LASTEXITCODE) { throw "em++ falló ($LASTEXITCODE)" }
  if ($Simd) {
    & $emxx paridad.cpp -o paridad-simd.js @fp -msimd128 @inc `
      '-sEXPORTED_RUNTIME_METHODS=["callMain"]' -sINVOKE_RUN=0 -sMODULARIZE=1 -sEXPORT_ES6=1 '-sENVIRONMENT=web,node' -sEXIT_RUNTIME=0
    if ($LASTEXITCODE) { throw "em++ -msimd128 falló ($LASTEXITCODE)" }
  }
  Get-Item referencia-x86.txt, paridad.js, paridad.wasm | Select-Object Name, Length
} finally { Pop-Location }
