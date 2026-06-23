# Used as BROWSER= for `databricks auth login` on VDI — prints OAuth URL instead of opening a window.
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$UrlParts
)

$url = ($UrlParts -join ' ').Trim()
Write-Host ''
Write-Host 'Copy this URL into your VDI browser, sign in, then return here:' -ForegroundColor Yellow
Write-Host $url -ForegroundColor Cyan
Write-Host ''
