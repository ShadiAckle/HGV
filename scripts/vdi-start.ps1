# VDI local run — same auth path that worked in first successful SQL test (CLI profile, not PAT).
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\vdi-start.ps1

$ErrorActionPreference = 'Stop'
$Root = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { Get-Location }
Set-Location $Root

$defaultHost = 'https://adb-7405610243855520.0.azuredatabricks.net'
$profile = 'hgv-edw'

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

$hostUrl = if ($env:DATABRICKS_HOST) { $env:DATABRICKS_HOST.Trim().TrimEnd('/') } else { $defaultHost }
$env:DATABRICKS_HOST = $hostUrl
$env:DATABRICKS_CONFIG_PROFILE = $profile
$env:NODE_ENV = 'production'
if (-not $env:DATABRICKS_WORKSPACE_ID) { $env:DATABRICKS_WORKSPACE_ID = '7405610243855520' }
if (-not $env:DATABRICKS_WAREHOUSE_ID) { $env:DATABRICKS_WAREHOUSE_ID = '9e9c06ad1c397404' }
if (-not $env:COMP_CATALOG) { $env:COMP_CATALOG = 'edw_dev_hris' }
if (-not $env:COMP_SCHEMA) { $env:COMP_SCHEMA = 'hgv_comp' }
if (-not $env:COMP_DATA_MODE) { $env:COMP_DATA_MODE = 'production' }
if (-not $env:DATABRICKS_APP_PORT) { $env:DATABRICKS_APP_PORT = '8000' }
if (-not $env:FLASK_RUN_HOST) { $env:FLASK_RUN_HOST = '127.0.0.1' }
Remove-Item Env:DATABRICKS_TOKEN -ErrorAction SilentlyContinue

$appkit = Join-Path $Root 'node_modules\@databricks\appkit\package.json'
if (-not (Test-Path $appkit)) {
  Write-Host 'Missing node_modules — run: npm install' -ForegroundColor Red
  exit 1
}

if (-not (Get-Command databricks -ErrorAction SilentlyContinue)) {
  Write-Host 'Databricks CLI not found. Run: winget install Databricks.DatabricksCLI' -ForegroundColor Red
  exit 1
}

$profiles = databricks auth profiles 2>&1 | Out-String
if ($profiles -notmatch [regex]::Escape($profile) -or $profiles -match "$profile[^\n]*\s+NO") {
  Write-Host "Log in once (complete in browser before continuing):" -ForegroundColor Yellow
  databricks auth login --host $hostUrl --profile $profile
}

Write-Host "Preflight: CLI token for profile $profile..." -ForegroundColor Cyan
$null = databricks auth token --profile $profile -o json 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "CLI auth failed. Re-run: databricks auth login --host $hostUrl --profile $profile" -ForegroundColor Red
  exit 1
}

Write-Host "Starting app → http://127.0.0.1:$($env:DATABRICKS_APP_PORT)" -ForegroundColor Green
node (Join-Path $Root 'dist\server.js')
