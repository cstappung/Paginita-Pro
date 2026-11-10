# Compila la prueba de paridad dos veces: x86 nativo (g++, la referencia) y wasm (em++, nuestro parche).
# Escribe referencia-x86.txt (huellas de x86 con 1M casos) y paridad.js + paridad.wasm.
# -Simd: además paridad-simd.js/.wasm, compilado con -msimd128 (el experimento de compilar-web.py --simd).
# -Motor (§170): con las cabeceras de terceros/Wiicompiled-motor (el paso 6) y los casos de memoria (MKW_PARIDAD_MOTOR):
#   referencia-x86-motor.txt y paridad-motor.js/.wasm (con -msimd128, como el juego). La de siempre no se toca.
param([switch]$Simd, [switch]$Motor)
$Raiz = Resolve-Path "$PSScriptRoot\..\..\.."
$env:EMSDK_QUIET = '1'
. "$Raiz\herramientas\emsdk\emsdk_env.ps1" *> $null
$ErrorActionPreference = 'Stop'
# $env:MKW_WIICOMPILED = otra copia con -Motor (p. ej. 'terceros\Wiicompiled-motor-m1': el paso 6 sobre la v0.9.3, §170)
$WC = if ($Motor -and $env:MKW_WIICOMPILED) { "$Raiz\$env:MKW_WIICOMPILED" } elseif ($Motor) { "$Raiz\terceros\Wiicompiled-motor" } else { "$Raiz\terceros\Wiicompiled" }
# em++ por su ruta (emsdk_env.ps1 no siempre lo deja en el PATH de esta consola)
$emxx = "$Raiz\herramientas\emsdk\upstream\emscripten\em++.exe"
$inc = @('-I', "$WC\runtime\include", '-I', "$WC\runtime\src", '-I', "$WC")
$fp = @('-O2', '-std=c++20', '-fno-fast-math', '-ffp-contract=off', '-w', '-DTARGET_PC')
# los casos de memoria solo si la copia trae el paso 6 (mkw_motor.h); sin él (N15a, la v0.9.3 sola) van los 22 de siempre
if ($Motor -and (Test-Path "$WC\runtime\include\mkw_motor.h")) { $fp += '-DMKW_PARIDAD_MOTOR' }
Push-Location $PSScriptRoot
try {
  # x86-64-v3 = el perfil de CPU del build de PC (AVX2 + FMA). __regcall no existe en g++: se vacía.
  $exe = Join-Path $env:TEMP 'paridad-x86.exe'
  $cmd = Get-Command g++ -ErrorAction SilentlyContinue        # (sin .Source directo: falla en modo estricto si no hay g++)
  $gxx = if ($cmd) { $cmd.Source } else { 'C:\Strawberry\c\bin\g++.exe' }   # MinGW de Strawberry Perl
  & $gxx paridad.cpp -o $exe @fp -march=x86-64-v3 '-D__regcall=' @inc
  if ($LASTEXITCODE) { throw "g++ falló ($LASTEXITCODE)" }
  if ($Motor) {
    # §170: borrar la de antes y exigir la nueva (una vez quedó la de otra corrida y la paridad comparó contra ella)
    Remove-Item referencia-x86-motor.txt -ErrorAction SilentlyContinue
    & $exe 1000000 | Set-Content -Encoding ascii referencia-x86-motor.txt
    if ($LASTEXITCODE -or -not (Test-Path referencia-x86-motor.txt) -or (Get-Item referencia-x86-motor.txt).Length -eq 0) { throw "la referencia x86 (motor) no se escribió ($LASTEXITCODE)" }
    & $emxx paridad.cpp -o paridad-motor.js @fp -msimd128 @inc `
      '-sEXPORTED_RUNTIME_METHODS=["callMain"]' -sINVOKE_RUN=0 -sMODULARIZE=1 -sEXPORT_ES6=1 '-sENVIRONMENT=web,node' -sEXIT_RUNTIME=0
    if ($LASTEXITCODE) { throw "em++ (motor) falló ($LASTEXITCODE)" }
    Get-Item referencia-x86-motor.txt, paridad-motor.js, paridad-motor.wasm | Select-Object Name, Length
    return
  }
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
