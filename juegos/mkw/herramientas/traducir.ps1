# Traduce Mario Kart Wii + Retro Rewind de PowerPC a C++ con el traductor de WiiCompiled, desde cero.
#
# Resumen: verifica el disco, extrae main.dol y StaticR.rel con nodtool, comprueba sus SHA-256, deja Retro Rewind
# donde el manifiesto lo busca, y corre los 5 comandos del traductor en el mismo orden que el setup oficial
# (Launcher/LocalBuild.ps1). Todo lo que produce queda en terceros/ y extraido/ (fuera de git: es código y datos
# de Nintendo). Tarda ~2 minutos en el PC de trabajo.
#
# Uso:  powershell -ExecutionPolicy Bypass -File herramientas\traducir.ps1
#       (requiere: herramientas\instalar.ps1 ya corrido, Retro Rewind en terceros\RetroRewind\RetroRewind6)
$ErrorActionPreference = 'Stop'                                            # cualquier error detiene el script

$Raiz   = Split-Path -Parent $PSScriptRoot                                 # la carpeta del proyecto (MKW RETRO)
$Disco  = Get-ChildItem -LiteralPath $Raiz -Recurse -Filter *.rvz | Select-Object -First 1   # la imagen del disco
$Nod    = Join-Path $Raiz 'herramientas\cache\nodtool.exe'                 # extractor de discos de Wii (encounter/nod)
$WC     = Join-Path $Raiz 'terceros\Wiicompiled'                           # el clon de WiiCompiled (commit fijo)
$RR     = Join-Path $Raiz 'terceros\RetroRewind\RetroRewind6'              # Retro Rewind instalado
$Trad   = Join-Path $WC 'translator\src\Translator.Cli\bin\Release\net8.0\Translator.Cli.dll'   # el traductor
$Hilos  = [Environment]::ProcessorCount                                    # usar todos los núcleos
$env:DOTNET_ROLL_FORWARD = 'Major'                                         # el traductor pide .NET 8; corre en el 10
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'

# Los hashes que exige projects/mkwii/recomp.yml (cualquier otro disco se rechaza)
$ShaDol = '80d18895b39c63bd80f457398bfcbb91b7d16ac116a41a88967e954080155b05'
$ShaRel = '16d9d146112541fefea701ecb5bc1a496f9d50e4a752fbb5b6778e7c6399f67d'

function Paso($t) { Write-Host "`n== $t" -ForegroundColor Cyan }          # títulos visibles en la consola
function Corre { & dotnet $Trad @args; if ($LASTEXITCODE) { throw "el traductor falló: $args" } }   # traductor + chequeo

if (-not $Disco) { throw 'No encuentro la imagen .rvz en la carpeta del proyecto' }

Paso '1. Extraer el disco (solo la partición de datos, ~2,6 GB)'
$Ext = Join-Path $Raiz 'extraido\disco'
if (-not (Test-Path (Join-Path $Ext 'sys\main.dol'))) { & $Nod extract $Disco.FullName $Ext -q }

Paso '2. Verificar que es el ejecutable original (SHA-256)'
$dol = Join-Path $Ext 'sys\main.dol'; $rel = Join-Path $Ext 'files\rel\StaticR.rel'
if ((Get-FileHash $dol).Hash.ToLower() -ne $ShaDol) { throw 'main.dol no es el de la versión PAL original' }
if ((Get-FileHash $rel).Hash.ToLower() -ne $ShaRel) { throw 'StaticR.rel no es el de la versión PAL original' }
New-Item -ItemType Directory -Force (Join-Path $WC 'Assets') | Out-Null   # el manifiesto los busca en Assets/
Copy-Item $dol, $rel (Join-Path $WC 'Assets') -Force

Paso '3. Dejar Retro Rewind donde lo busca el perfil retro-rewind (enlace, sin copiar 2 GB)'
$Pp = Join-Path $WC 'PulsarPacks\completed\RetroRewind'
New-Item -ItemType Directory -Force $Pp | Out-Null
if (-not (Test-Path (Join-Path $Pp 'RetroRewind6'))) { New-Item -ItemType Junction -Path (Join-Path $Pp 'RetroRewind6') -Target $RR | Out-Null }

Push-Location $WC                                                          # las rutas del manifiesto son relativas
try {
  $Proy = 'projects/mkwii/recomp.yml'
  Paso '4. Traducir el juego base (sabiendo del Code.pul, para no saltarse sus parches)'
  Corre translate-recursive 0x800060A4 --project $Proy --outdir generated/functions `
        --output-metadata generated/base_translation_metadata.json --prune-stale --threads $Hilos
  Paso '5. Manifiesto del juego base (rangos de funciones, secciones)'
  Corre emit-base-manifest --project $Proy --out build/base --functions-dir generated/functions `
        --translation-output-metadata generated/base_translation_metadata.json --region P
  Paso '6. Traducir Retro Rewind (Code.pul + payload de Retro WFC, verificado con firma)'
  $pul = Join-Path $Pp 'RetroRewind6\Binaries\Code.pul'
  Corre translate-mod --project $Proy --profile retro-rewind --base-manifest build/base/mkwii_base_manifest.json `
        --base-translation-output-metadata generated/base_translation_metadata.json --code-pul $pul `
        --mod-root (Join-Path $Pp 'RetroRewind6') --mod-name 'Retro Rewind' --region P `
        --out build/mods/retro_rewind_full_cpp --emit-cpp --threads $Hilos `
        --retro-wfc-payload 'https://rwfc.net/api/wfc/payload?g=RMCPD00'
  Paso '7. Secciones de datos del DOL/REL y RuntimeConfig.h'
  Corre generate-data-init --project $Proy
  Paso '8. Grafo de compilación (shards de CMake)'
  Corre emit-build-shards --project $Proy --base-metadata generated/base_translation_metadata.json `
        --base-functions-dir generated/functions --native-source-dir runtime/src --out generated/build_shards `
        --resolved-profile build/mods/retro_rewind_full_cpp/resolved_dispatch_profile.json `
        --retro-cpp-dir build/mods/retro_rewind_full_cpp/cpp
} finally { Pop-Location }
Write-Host "`nlisto: C++ en $WC\generated y $WC\build\mods" -ForegroundColor Green
