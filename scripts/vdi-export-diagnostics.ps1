# Run on VDI after git pull — exports warehouse probes to data/comp/diagnostics/ for GitHub sync.
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\vdi-export-diagnostics.ps1 [-Commit]

param([switch]$Commit)

$ErrorActionPreference = 'Stop'
$Root = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { Get-Location }
Set-Location $Root

function Load-DotEnv {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $val = $line.Substring($eq + 1).Trim()
    [Environment]::SetEnvironmentVariable($key, $val, 'Process')
  }
}

Load-DotEnv (Join-Path $Root '.env')

$profile = 'hgv-edw'
$hostUrl = if ($env:DATABRICKS_HOST) { $env:DATABRICKS_HOST.Trim().TrimEnd('/') } else { 'https://adb-7405610243855520.0.azuredatabricks.net' }
$env:DATABRICKS_HOST = $hostUrl
$env:DATABRICKS_CONFIG_PROFILE = $profile
if (-not $env:DATABRICKS_WAREHOUSE_ID) { $env:DATABRICKS_WAREHOUSE_ID = '9e9c06ad1c397404' }
Remove-Item Env:DATABRICKS_TOKEN -ErrorAction SilentlyContinue

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node required.' -ForegroundColor Red
  exit 1
}

if (-not (Get-Command databricks -ErrorAction SilentlyContinue)) {
  Write-Host 'Databricks CLI required.' -ForegroundColor Red
  exit 1
}

$profiles = databricks auth profiles 2>&1 | Out-String
if ($profiles -notmatch [regex]::Escape($profile) -or $profiles -match "$profile[^\n]*\s+NO") {
  $printScript = Join-Path $PSScriptRoot 'vdi-auth-url.ps1'
  $env:BROWSER = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$printScript`""
  Write-Host 'CLI login required — copy URL into VDI browser:' -ForegroundColor Yellow
  databricks auth login --host $hostUrl --profile $profile
}

Write-Host 'Preflight token…' -ForegroundColor Cyan
$null = databricks auth token --profile $profile -o json 2>&1
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host 'Exporting diagnostics to data/comp/diagnostics/ …' -ForegroundColor Cyan
node (Join-Path $Root 'scripts\vdi-export-diagnostics.mjs')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Done. Sync via git:' -ForegroundColor Green
Write-Host '  git add data/comp/diagnostics'
Write-Host '  git commit -m "chore: warehouse diagnostics export"'
Write-Host '  git push'

if ($Commit) {
  git add data/comp/diagnostics
  git commit -m "chore: warehouse diagnostics export $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  git push
}
