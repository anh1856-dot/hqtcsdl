# Tao lai toan bo MushroomFarmDB tren SQL Server local (Windows Authentication)
# Cach chay: mo PowerShell tai thu muc database, go:  .\run_all.ps1
# Doi server: .\run_all.ps1 -Server "localhost\SQLEXPRESS"
param([string]$Server = "localhost")

$scripts = '01_create_tables', '02_views_functions', '03_procedures_triggers', '04_sample_data'
foreach ($s in $scripts) {
    Write-Host "== $s.sql"
    sqlcmd -S $Server -E -C -b -f 65001 -i (Join-Path $PSScriptRoot "$s.sql")
    if ($LASTEXITCODE -ne 0) { Write-Host "LOI tai $s.sql" -ForegroundColor Red; exit 1 }
}
Write-Host "Hoan tat." -ForegroundColor Green
