# Apply Unity Catalog grants for the hilton-kb-chat app service principal.
# Usage: .\scripts\apply-app-grants.ps1 -Profile hgv-premium -WarehouseId 0df692712c9a2f9a

param(
    [Parameter(Mandatory = $true)]
    [string]$Profile,

    [Parameter(Mandatory = $true)]
    [string]$WarehouseId
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$GrantFile = Join-Path $Root 'data\comp\08_grant_app_permissions.sql'

Write-Host "Applying app SP grants from $GrantFile ..."

$sql = Get-Content $GrantFile -Raw
$statements = [regex]::Split($sql, ';\s*(?=\r?\n|$)') | ForEach-Object { $_.Trim() } | Where-Object { $_ }

$i = 0
foreach ($statement in $statements) {
    $executable = ($statement -split "`n" | Where-Object { $_ -notmatch '^\s*--' }) -join "`n"
    $executable = $executable.Trim()
    if (-not $executable) { continue }

    $i++
    $preview = ($executable -split "`n" | Select-Object -First 1).Trim()
    if ($preview.Length -gt 80) { $preview = $preview.Substring(0, 80) + '...' }
    Write-Host "  [$i] $preview"

    $tmp = Join-Path $env:TEMP ("hgv-app-grants-$i.sql")
    [System.IO.File]::WriteAllText($tmp, $executable + ';')
    try {
        databricks experimental aitools tools query --warehouse $WarehouseId --profile $Profile --output json --file $tmp 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Grant failed: $preview"
        }
    } finally {
        Remove-Item -Path $tmp -ErrorAction SilentlyContinue
    }
}

Write-Host ''
Write-Host 'Done. App SP now has SELECT + MODIFY on workspace.hgv_comp for bootstrap seeding.'
