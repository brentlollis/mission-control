param(
  [int]$Port = 3000,
  [string]$Hostname = '0.0.0.0'
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir '..')
$standaloneDir = Join-Path $projectRoot '.next\standalone'
$standaloneNextDir = Join-Path $standaloneDir '.next'
$standaloneStaticDir = Join-Path $standaloneNextDir 'static'
$sourceStaticDir = Join-Path $projectRoot '.next\static'
$sourcePublicDir = Join-Path $projectRoot 'public'
$standalonePublicDir = Join-Path $standaloneDir 'public'
$bundledNode22 = Join-Path (Resolve-Path (Join-Path $projectRoot '..')) 'runtime\node-v22.22.3-win-x64\node.exe'

if (-not (Test-Path (Join-Path $standaloneDir 'server.js'))) {
  throw "Standalone server missing at $standaloneDir\server.js. Run pnpm build first."
}

New-Item -ItemType Directory -Force -Path $standaloneNextDir | Out-Null

if (Test-Path $sourceStaticDir) {
  if (Test-Path $standaloneStaticDir) {
    Remove-Item -LiteralPath $standaloneStaticDir -Recurse -Force
  }
  Copy-Item -LiteralPath $sourceStaticDir -Destination $standaloneStaticDir -Recurse -Force
}

if (Test-Path $sourcePublicDir) {
  if (Test-Path $standalonePublicDir) {
    Remove-Item -LiteralPath $standalonePublicDir -Recurse -Force
  }
  Copy-Item -LiteralPath $sourcePublicDir -Destination $standalonePublicDir -Recurse -Force
}

$nodeExe = if (Test-Path $bundledNode22) { $bundledNode22 } else { 'node.exe' }
$env:PORT = [string]$Port
$env:HOSTNAME = $Hostname

Set-Location $standaloneDir
& $nodeExe 'server.js'
