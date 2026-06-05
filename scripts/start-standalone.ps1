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

function Import-DotEnvFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }

    $equalsIndex = $trimmed.IndexOf('=')
    if ($equalsIndex -lt 1) {
      continue
    }

    $name = $trimmed.Substring(0, $equalsIndex).Trim()
    $value = $trimmed.Substring($equalsIndex + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

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
Import-DotEnvFile (Join-Path $projectRoot '.env')
Import-DotEnvFile (Join-Path $projectRoot '.env.local')
$env:PORT = [string]$Port
$env:HOSTNAME = $Hostname

Set-Location $standaloneDir
& $nodeExe 'server.js'
