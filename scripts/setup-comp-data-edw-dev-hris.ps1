# Bootstrap edw_dev_hris.hgv_comp — full DDL (+ optional demo seeds) via Databricks CLI.
# Same pattern as setup-comp-data.ps1 but targets data/comp/edw_dev_hris/.
#
# Usage (DDL only — production):
#   .\scripts\setup-comp-data-edw-dev-hris.ps1 -Profile <profile> -WarehouseId <id>
#
# Usage (DDL + demo seeds for UI smoke test):
#   .\scripts\setup-comp-data-edw-dev-hris.ps1 -Profile <profile> -WarehouseId <id> -IncludeSeeds

param(
    [Parameter(Mandatory = $true)]
    [string]$Profile,

    [Parameter(Mandatory = $true)]
    [string]$WarehouseId,

    [switch]$IncludeSeeds
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$SqlRoot = Join-Path $Root 'data\comp\edw_dev_hris'

function Invoke-DatabricksSqlFile {
    param([string]$FilePath)
    if (-not (Test-Path $FilePath)) {
        throw "SQL file not found: $FilePath"
    }
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
        $tmp = Join-Path $env:TEMP ("hgv-edw-setup-$i.sql")
        [System.IO.File]::WriteAllText($tmp, $executable + ';')
        try {
            $out = databricks experimental aitools tools query --warehouse $WarehouseId --profile $Profile --output json --file $tmp 2>&1
            if ($LASTEXITCODE -ne 0) {
                $outText = ($out | Out-String)
                if ($outText -match 'FIELD_ALREADY_EXISTS|already exists|DUPLICATE_COLUMN|SCHEMA_ALREADY_EXISTS') {
                    Write-Host "  (skipped — already applied)"
                } else {
                    throw "Statement failed in ${FilePath}: $preview`n$outText"
                }
            }
        } finally {
            Remove-Item -Path $tmp -ErrorAction SilentlyContinue
        }
    }
}

$ddlFiles = @(
    '01_create_schema.sql',
    '05_extend_admin_finance.sql',
    '05b_extend_finance_reference.sql',
    '06_create_marketing_benchmark.sql',
    '07_create_regional_bonus.sql',
    '09_create_guest_registry.sql',
    '10_create_plan_assessment.sql'
)

$seedFiles = @(
    '02_seed_synthetic_data.sql',
    '02a_seed_core_dims.sql',
    '02b_seed_sales_core.sql',
    '02c_seed_sales_diversity.sql',
    '04_seed_semantic_definitions.sql',
    '05a_seed_admin_finance.sql',
    '06a_seed_marketing_benchmark.sql',
    '07a_seed_regional_bonus.sql',
    '09a_seed_guest_registry.sql',
    '10a_seed_plan_assessment.sql'
)

Write-Host "=== HGV Comp bootstrap: edw_dev_hris.hgv_comp ===" -ForegroundColor Cyan

$bootstrapOneShot = Join-Path $SqlRoot '00_bootstrap_all_ddl.sql'
if (Test-Path $bootstrapOneShot) {
    Invoke-DatabricksSqlFile $bootstrapOneShot
} else {
    foreach ($f in $ddlFiles) {
        Invoke-DatabricksSqlFile (Join-Path $SqlRoot $f)
    }
}

if ($IncludeSeeds) {
    Write-Host "`n=== Loading demo seeds ===" -ForegroundColor Cyan
    foreach ($f in $seedFiles) {
        Invoke-DatabricksSqlFile (Join-Path $SqlRoot $f)
    }
}

Write-Host ''
Write-Host 'Done. Verify:' -ForegroundColor Green
databricks experimental aitools tools query --warehouse $WarehouseId --profile $Profile --output json `
    "SHOW TABLES IN edw_dev_hris.hgv_comp"
Write-Host ''
Write-Host 'After app deploy, run grant scripts in data/comp/edw_dev_hris/03*.sql and 08_grant_app_permissions.sql'
Write-Host 'Replace the service principal UUID with your new app SP client id.'
