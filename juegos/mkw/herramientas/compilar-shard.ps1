# Compila shards del C++ traducido a objetos wasm (.o) con em++ y mide tiempo y tamaño.
# Uso:  powershell -ExecutionPolicy Bypass -File herramientas\compilar-shard.ps1 [-Grupo base_common] [-Cuantos 1] [-Todos] [-Hilos N]
# Genera build\shard\<grupo>\build.ninja y corre ninja (en paralelo, y solo recompila lo que cambió).
# Los .o quedan en build\shard\<grupo>\ (ignorado por git: es código del juego).
param(
  [string]$Grupo = 'base_common',
  [int]$Cuantos = 1,
  [switch]$Todos,
  [int]$Hilos = [Environment]::ProcessorCount
)
$Raiz = (Resolve-Path "$PSScriptRoot\..").Path
$env:EMSDK_QUIET = '1'
. "$Raiz\herramientas\emsdk\emsdk_env.ps1" *> $null
$ErrorActionPreference = 'Stop'

$WC = "$Raiz\terceros\Wiicompiled"
$Dir = "$WC\generated\build_shards\$Grupo"
$Sal = "$Raiz\build\shard\$Grupo"
New-Item -ItemType Directory -Force $Sal | Out-Null
$fuentes = @(Get-ChildItem "$Dir\*.cpp" | Sort-Object Name)
if (-not $Todos) { $fuentes = @($fuentes | Select-Object -First $Cuantos) }

# Mismas banderas que PublicProducts.cmake usa para las unidades traducidas, más las de la web.
$inc = @("$WC\runtime\include", "$WC\runtime\src", $WC, "$WC\aurora-main\include", $Dir) | ForEach-Object { "-I`"$_`"" }
$banderas = "-std=c++20 -O2 -fno-fast-math -ffp-contract=off -fno-slp-vectorize -w -fwasm-exceptions -DTARGET_PC " + ($inc -join ' ')
$emxx = (Get-Command em++.exe).Source

# ninja: '$' y ':' de las rutas se escapan con '$'
function N([string]$p) { $p.Replace('$', '$$').Replace(':', '$:').Replace(' ', '$ ') }
$lineas = @(
  "rule emxx",
  "  command = `"$emxx`" -c `$in -o `$out $banderas -MD -MF `$out.d",
  "  depfile = `$out.d",
  "  deps = gcc",
  "  description = em++ `$in"
)
foreach ($f in $fuentes) { $lineas += "build $(N "$Sal\$($f.BaseName).o"): emxx $(N $f.FullName)" }
[IO.File]::WriteAllLines("$Sal\build.ninja", $lineas)

$reloj = [Diagnostics.Stopwatch]::StartNew()
& ninja -C $Sal -j $Hilos -k 0 2>&1 | Where-Object { $_ -notmatch '^\[\d+/\d+\] em\+\+' } | Select-Object -First 60
$fallo = $LASTEXITCODE
$reloj.Stop()

$objs = @(Get-ChildItem "$Sal\*.o" -ErrorAction SilentlyContinue | Where-Object { $fuentes.BaseName -contains $_.BaseName })
$fuenteMB = ($fuentes | Measure-Object Length -Sum).Sum / 1MB
$objMB = ($objs | Measure-Object Length -Sum).Sum / 1MB
"{0} shards de {1}: {2} objetos, ninja={3}, {4:N1} s ({5} hilos)" -f $fuentes.Count, $Grupo, $objs.Count, $fallo, $reloj.Elapsed.TotalSeconds, $Hilos
"fuente {0:N1} MB -> objetos wasm {1:N1} MB" -f $fuenteMB, $objMB
exit $fallo
