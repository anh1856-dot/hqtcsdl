# Gop 01 -> 05 thanh MushroomFarmDB_full.sql (de xem / nop bai)
# Chay lai moi khi sua 1 trong cac file goc:  .\build_full.ps1
$scripts = '01_create_tables', '02_views_functions', '03_procedures_triggers', '04_sample_data', '05_security'
$header = @"
/* =====================================================================
   MushroomFarmDB - FILE GOP DAY DU (tao tu dong boi build_full.ps1)
   Gom: 01 -> 05. Khong gom 06 (backup) va 07 (demo, chay tung doan).
   Chay ca file trong SSMS: bam F5. CANH BAO: xoa va tao lai toan bo bang
   trong MushroomFarmDB (khong anh huong database khac).
   Sua code thi sua o cac file goc, roi chay lai build_full.ps1.
   ===================================================================== */

"@
$parts = foreach ($s in $scripts) {
    "`r`n/* #####################################################################`r`n   $s.sql`r`n   ##################################################################### */`r`n" +
    [IO.File]::ReadAllText((Join-Path $PSScriptRoot "$s.sql"), [Text.Encoding]::UTF8)
}
# UTF-8 co BOM de SSMS doc dung tieng Viet
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'MushroomFarmDB_full.sql'),
    $header + ($parts -join "`r`nGO`r`n"), (New-Object Text.UTF8Encoding $true))
Write-Host "Da tao MushroomFarmDB_full.sql"
