# Publish VDI zip to GitHub Releases (ShadiAckle/HGV) using ShadiAckle PAT only.
# Usage:
#   $env:SHADIACKLE_GH_TOKEN = 'ghp_...'   # fine-grained PAT for ShadiAckle/HGV only
#   npm run package:edw-vdi
#   powershell -ExecutionPolicy Bypass -File .\scripts\ship-github-release.ps1 -Version 1.10.1

param(
  [Parameter(Mandatory = $true)]
  [string]$Version
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$token = $env:SHADIACKLE_GH_TOKEN
if (-not $token) { throw 'Set SHADIACKLE_GH_TOKEN (ShadiAckle PAT scoped to ShadiAckle/HGV).' }

$tag = "v$Version"
$zipSrc = Join-Path $Root "build\hgv-comp-v$Version-edw_dev_hris.zip"
if (-not (Test-Path $zipSrc)) {
  Write-Host "Missing $zipSrc — run: npm run package:edw-vdi" -ForegroundColor Yellow
  exit 1
}

$releasesDir = Join-Path $Root 'releases'
New-Item -ItemType Directory -Force -Path $releasesDir | Out-Null
Copy-Item $zipSrc (Join-Path $releasesDir 'hgv-comp-app-edw_dev_hris.zip') -Force
$assetName = "HGV-v$Version-deployment-ready.zip"
Copy-Item $zipSrc (Join-Path $releasesDir $assetName) -Force

git add (Join-Path $releasesDir 'hgv-comp-app-edw_dev_hris.zip') (Join-Path $releasesDir $assetName) releases/README.md
git commit -m "Release $tag VDI deploy zip." 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host 'Nothing to commit or commit skipped.' -ForegroundColor DarkYellow }

$head = git rev-parse HEAD
git tag -f $tag $head
git push "https://ShadiAckle:$token@github.com/ShadiAckle/HGV.git" main
git push "https://ShadiAckle:$token@github.com/ShadiAckle/HGV.git" "refs/tags/$tag" --force

$env:GH_TOKEN = $token
gh release delete $tag --repo ShadiAckle/HGV --yes 2>$null
gh release create $tag (Join-Path $releasesDir $assetName) `
  --repo ShadiAckle/HGV `
  --title "$tag — VDI npm release" `
  --notes "Download **$assetName**, unzip, npm install, npm start. Profile hgv-edw, catalog edw_dev_hris."

Write-Host "Published: https://github.com/ShadiAckle/HGV/releases/tag/$tag" -ForegroundColor Green
