# Run on VDI (PowerShell) from repo root after Node 22+ is installed.
# Usage: .\scripts\setup-vdi-local.ps1 [-SkipBuild]

param([switch]$SkipBuild)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=== HGV comp hub — VDI local run ===" -ForegroundColor Cyan

# Node
$nodeVer = (node -v) 2>$null
if (-not $nodeVer) {
  Write-Host "Node not found. Install Node 22 LTS:" -ForegroundColor Red
  Write-Host "  winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
  Write-Host "  (new PowerShell window after install)" -ForegroundColor Yellow
  exit 1
}
Write-Host "Node $nodeVer"

# .env
$envExample = Join-Path $Root 'scripts\vdi-edw.env.example'
$envFile = Join-Path $Root '.env'
if (-not (Test-Path $envFile)) {
  if (-not (Test-Path $envExample)) { throw "Missing $envExample" }
  Copy-Item $envExample $envFile
  Write-Host "Created .env from vdi-edw template — edit warehouse/endpoint if needed." -ForegroundColor Yellow
} else {
  Write-Host ".env exists"
}

# Databricks CLI
$db = Get-Command databricks -ErrorAction SilentlyContinue
if (-not $db) {
  Write-Host "Databricks CLI not found. Install:" -ForegroundColor Red
  Write-Host "  winget install Databricks.DatabricksCLI" -ForegroundColor Yellow
  exit 1
}
Write-Host "Databricks CLI: $(databricks -v 2>&1 | Select-Object -First 1)"

$profile = 'hgv-edw'
$envFile = Join-Path $Root '.env'
$hostUrl = $null
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*DATABRICKS_HOST\s*=\s*(.+)\s*$') {
      $hostUrl = $Matches[1].Trim().TrimEnd('/')
      break
    }
  }
}
if (-not $hostUrl -or $hostUrl -match 'REPLACE-WITH') {
  $hostUrl = 'https://adb-7405610243855520.0.azuredatabricks.net'
}
$profiles = databricks auth profiles 2>&1 | Out-String
if ($profiles -notmatch [regex]::Escape($profile) -or $profiles -match "$profile.*\s+NO") {
  Write-Host ""
  Write-Host "Log in to HGV Databricks (browser will open):" -ForegroundColor Yellow
  databricks auth login --host $hostUrl --profile $profile
}

# Dependencies
if (-not (Test-Path (Join-Path $Root 'node_modules'))) {
  Write-Host "npm install (may take a few minutes)..." -ForegroundColor Cyan
  npm install
} else {
  Write-Host "node_modules present"
}

# Build or use pre-built dist from deploy zip
$hasDist = (Test-Path (Join-Path $Root 'dist\server.js')) -and (Test-Path (Join-Path $Root 'client\dist\index.html'))
if (-not $SkipBuild -and -not $hasDist) {
  Write-Host "npm run build:artifacts..." -ForegroundColor Cyan
  npm run build:artifacts
} elseif ($hasDist) {
  Write-Host "Using existing dist/ (skip build)" -ForegroundColor Green
} else {
  Write-Host "SkipBuild set but dist/ missing — run without -SkipBuild" -ForegroundColor Red
  exit 1
}

# Patch analytics queries for edw catalog if still workspace.*
$queriesDir = Join-Path $Root 'config\queries'
if (Test-Path $queriesDir) {
  Get-ChildItem $queriesDir -Filter '*.sql' | ForEach-Object {
    $c = Get-Content $_.FullName -Raw
    if ($c -match 'workspace\.hgv_comp') {
      $c = $c -replace 'workspace\.hgv_comp', 'edw_dev_hris.hgv_comp'
      Set-Content $_.FullName $c -NoNewline
    }
  }
}

Write-Host ""
Write-Host "Start app:" -ForegroundColor Green
Write-Host "  npm start" -ForegroundColor White
Write-Host "Then open in VDI browser:" -ForegroundColor Green
Write-Host "  http://127.0.0.1:8000" -ForegroundColor White
Write-Host ""
Write-Host "(localhost avoids Databricks Apps DNS / azure.databricksapps.com)" -ForegroundColor DarkGray
