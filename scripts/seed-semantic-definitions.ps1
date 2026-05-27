# Run semantic layer seeding statements one-by-one
param(
    [Parameter(Mandatory = $true)]
    [string]$Profile,

    [Parameter(Mandatory = $true)]
    [string]$WarehouseId
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$SqlFile = Join-Path $Root "..\data\comp\04_seed_semantic_definitions.sql"

if (-not (Test-Path $SqlFile)) {
    throw "SQL file not found at $SqlFile"
}

Write-Host "Reading SQL file: $SqlFile"
$sql = Get-Content $SqlFile -Raw

# Split statements by semicolon followed by newline
$statements = [regex]::Split($sql, ';\s*(?=\r?\n|$)') | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notmatch '^\s*--' }

$i = 0
foreach ($statement in $statements) {
    $executable = ($statement -split "`n" | Where-Object { $_ -notmatch '^\s*--' }) -join "`n"
    $executable = $executable.Trim()
    if (-not $executable) { continue }

    $i++
    $preview = ($executable -split "`n" | Select-Object -First 1).Trim()
    if ($preview.Length -gt 72) { $preview = $preview.Substring(0, 72) + '...' }
    Write-Host "Executing Statement [$i]: $preview"

    $tmp = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tmp, $executable + ';')
    try {
        databricks experimental aitools tools query --warehouse $WarehouseId --profile $Profile --output json --file $tmp 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Statement failed: $preview"
        }
    } finally {
        Remove-Item -Path $tmp -ErrorAction SilentlyContinue
    }
}

Write-Host "Successfully completed seeding semantic definitions."
