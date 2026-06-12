# VDI local run — OAuth orgs (PATs disabled). Injects a fresh CLI access token, then starts the app.
# Usage (from unzipped app root):  powershell -ExecutionPolicy Bypass -File .\scripts\vdi-start.ps1

$ErrorActionPreference = 'Stop'
$Root = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { Get-Location }
Set-Location $Root

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

$hostUrl = if ($env:DATABRICKS_HOST) { $env:DATABRICKS_HOST.Trim().TrimEnd('/') } else { '' }
if (-not $hostUrl -or $hostUrl -match 'REPLACE-WITH') {
  Write-Host 'Set DATABRICKS_HOST in .env to your workspace URL (copy from VDI browser address bar).' -ForegroundColor Red
  exit 1
}

$appkit = Join-Path $Root 'node_modules\@databricks\appkit\package.json'
if (-not (Test-Path $appkit)) {
  Write-Host 'Missing node_modules — run npm install first (from this folder):' -ForegroundColor Red
  Write-Host "  cd $Root" -ForegroundColor Yellow
  Write-Host '  npm install' -ForegroundColor Yellow
  exit 1
}

if (-not (Get-Command databricks -ErrorAction SilentlyContinue)) {
  Write-Host 'Databricks CLI not found. Run: winget install Databricks.DatabricksCLI' -ForegroundColor Red
  exit 1
}

$profiles = databricks auth profiles 2>&1 | Out-String
if ($profiles -notmatch [regex]::Escape($profile) -or $profiles -match "$profile[^\n]*\s+NO") {
  Write-Host "Log in once (browser): databricks auth login --host $hostUrl --profile $profile" -ForegroundColor Yellow
  databricks auth login --host $hostUrl --profile $profile
}

Write-Host 'Fetching OAuth access token from CLI profile (PATs are disabled in this org)...' -ForegroundColor Cyan
$tokenJson = databricks auth token --profile $profile -o json 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host $tokenJson -ForegroundColor Red
  Write-Host 'Token fetch failed. Run: databricks current-user me --profile hgv-edw' -ForegroundColor Yellow
  exit 1
}
$token = ($tokenJson | ConvertFrom-Json).access_token
if (-not $token) { throw 'No access_token in databricks auth token output' }

$env:NODE_ENV = 'production'
$env:DATABRICKS_HOST = $hostUrl
$env:DATABRICKS_TOKEN = $token
Remove-Item Env:DATABRICKS_CONFIG_PROFILE -ErrorAction SilentlyContinue

if (-not $env:DATABRICKS_WAREHOUSE_ID) {
  $env:DATABRICKS_WAREHOUSE_ID = '9e9c06ad1c397404'
}
if (-not $env:COMP_CATALOG) { $env:COMP_CATALOG = 'edw_dev_hris' }
if (-not $env:COMP_SCHEMA) { $env:COMP_SCHEMA = 'hgv_comp' }
if (-not $env:COMP_DATA_MODE) { $env:COMP_DATA_MODE = 'production' }
if (-not $env:DATABRICKS_APP_PORT) { $env:DATABRICKS_APP_PORT = '8000' }
if (-not $env:FLASK_RUN_HOST) { $env:FLASK_RUN_HOST = '127.0.0.1' }

Write-Host "Starting app → http://127.0.0.1:$($env:DATABRICKS_APP_PORT)" -ForegroundColor Green
node (Join-Path $Root 'dist\server.js')
