# Load marketing benchmark tables only (does not recreate core comp schema).
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
        $tmp = Join-Path $env:TEMP ("hgv-mkt-setup-$i.sql")
        [System.IO.File]::WriteAllText($tmp, $executable + ';')
        try {
            $out = databricks experimental aitools tools query --warehouse $WarehouseId --profile $Profile --output json --file $tmp 2>&1
            if ($LASTEXITCODE -ne 0) {
                $outText = ($out | Out-String)
                if ($outText -match 'FIELD_ALREADY_EXISTS|already exists|DUPLICATE_COLUMN') {
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

Invoke-DatabricksSqlFile (Join-Path $Root 'data\comp\02a_seed_core_dims.sql')
Invoke-DatabricksSqlFile (Join-Path $Root 'data\comp\02b_seed_sales_core.sql')
Invoke-DatabricksSqlFile (Join-Path $Root 'data\comp\06_create_marketing_benchmark.sql')
Invoke-DatabricksSqlFile (Join-Path $Root 'data\comp\07_create_regional_bonus.sql')
Invoke-DatabricksSqlFile (Join-Path $Root 'data\comp\06a_seed_marketing_benchmark.sql')
Invoke-DatabricksSqlFile (Join-Path $Root 'data\comp\07a_seed_regional_bonus.sql')
Invoke-DatabricksSqlFile (Join-Path $Root 'data\comp\10_create_plan_assessment.sql')
Invoke-DatabricksSqlFile (Join-Path $Root 'data\comp\10a_seed_plan_assessment.sql')
Invoke-DatabricksSqlFile (Join-Path $Root 'data\comp\11_alter_scenario_conversion.sql')
Invoke-DatabricksSqlFile (Join-Path $Root 'data\comp\08_grant_app_permissions.sql')

Write-Host ''
Write-Host 'Marketing benchmark row count:'
databricks experimental aitools tools query --warehouse $WarehouseId --profile $Profile --output json "SELECT COUNT(1) AS metric_rows FROM workspace.hgv_comp.fact_marketing_rep_metric"
Write-Host 'Regional bonus area count:'
databricks experimental aitools tools query --warehouse $WarehouseId --profile $Profile --output json "SELECT COUNT(1) AS area_rows FROM workspace.hgv_comp.fact_regional_bonus_area"
Write-Host 'Regional bonus tier count:'
databricks experimental aitools tools query --warehouse $WarehouseId --profile $Profile --output json "SELECT COUNT(1) AS tier_rows FROM workspace.hgv_comp.fact_regional_bonus_tier"
