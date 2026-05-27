# Load comp star schema + synthetic seed data on your SQL warehouse.
# Usage:
#   .\scripts\setup-comp-data.ps1 -Profile hgv-premium -WarehouseId 0df692712c9a2f9a

param(
    [Parameter(Mandatory = $true)]
    [string]$Profile,

    [Parameter(Mandatory = $true)]
    [string]$WarehouseId
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Invoke-DatabricksSqlFile {
    param([string]$FilePath)
    Write-Host "Running $FilePath ..."
    $sql = Get-Content $FilePath -Raw
    $statements = [regex]::Split($sql, ';\s*(?=\r?\n|$)') | ForEach-Object { $_.Trim() } | Where-Object { $_ }

    $i = 0
    foreach ($statement in $statements) {
        $executable = ($statement -split "`n" | Where-Object { $_ -notmatch '^\s*--' }) -join "`n"
        $executable = $executable.Trim()
        if (-not $executable) { continue }

        $i++
        $preview = ($executable -split "`n" | Select-Object -First 1).Trim()
        if ($preview.Length -gt 72) { $preview = $preview.Substring(0, 72) + '...' }
        Write-Host "  [$i] $preview"
        $tmp = Join-Path $env:TEMP ("hgv-comp-setup-$i.sql")
        [System.IO.File]::WriteAllText($tmp, $executable + ';')
        try {
            databricks experimental aitools tools query --warehouse $WarehouseId --profile $Profile --output json --file $tmp 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Statement failed in ${FilePath}: $preview"
            }
        } finally {
            Remove-Item -Path $tmp -ErrorAction SilentlyContinue
        }
    }
}

Invoke-DatabricksSqlFile (Join-Path $Root 'data\comp\01_create_schema.sql')
Invoke-DatabricksSqlFile (Join-Path $Root 'data\comp\02_seed_synthetic_data.sql')
Invoke-DatabricksSqlFile (Join-Path $Root 'data\comp\02a_seed_core_dims.sql')
Invoke-DatabricksSqlFile (Join-Path $Root 'data\comp\06_create_marketing_benchmark.sql')
Invoke-DatabricksSqlFile (Join-Path $Root 'data\comp\06a_seed_marketing_benchmark.sql')

Write-Host ''
Write-Host 'Optional: marketing benchmark + regional bonus + plan assessment (run if not already loaded):'
Write-Host '  .\scripts\setup-marketing-data.ps1 -Profile' $Profile '-WarehouseId' $WarehouseId
Write-Host ''
Write-Host 'Apply app service principal grants (required for runtime bootstrap seeding):'
Write-Host '  .\scripts\apply-app-grants.ps1 -Profile' $Profile '-WarehouseId' $WarehouseId
Write-Host ''
Write-Host 'Done. Jason demo row:'
databricks experimental aitools tools query --warehouse $WarehouseId --profile $Profile --output json "SELECT r.rep_name, pay.total_earnings, qa.attainment_pct FROM workspace.hgv_comp.fact_payout pay JOIN workspace.hgv_comp.fact_quota_attainment qa ON qa.rep_id = pay.rep_id AND qa.period_id = pay.period_id JOIN workspace.hgv_comp.dim_rep r ON r.rep_id = pay.rep_id WHERE r.rep_id = 'REP-JASON'"
