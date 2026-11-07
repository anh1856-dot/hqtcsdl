/* =====================================================================
   MushroomFarmDB
   06_backup_restore.sql : Sao luu va khoi phuc (chay tay trong SSMS, F5)

   Kich ban demo:
     1. Chuyen recovery model sang FULL
     2. Backup FULL
     3. Them du lieu -> Backup DIFFERENTIAL
     4. Ghi lai thoi diem T, roi "lo tay" dat gia moi goi thue = 0
     5. Backup LOG
     6. Kiem tra file backup (VERIFYONLY, HEADERONLY)
     7. Khoi phuc FULL + DIFF + LOG den dung thoi diem T (STOPAT)
        vao database moi MushroomFarmDB_Restore (khong ghi de DB goc)
     8. Lay gia dung tu ban khoi phuc sua lai DB goc

   File backup nam trong thu muc backup mac dinh cua SQL Server.
   ===================================================================== */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO
USE master;
GO

DECLARE @Dir  NVARCHAR(400) = CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS NVARCHAR(400));
DECLARE @Full NVARCHAR(500) = @Dir + N'\MushroomFarmDB_FULL.bak';
DECLARE @Diff NVARCHAR(500) = @Dir + N'\MushroomFarmDB_DIFF.bak';
DECLARE @Log  NVARCHAR(500) = @Dir + N'\MushroomFarmDB_LOG.trn';
PRINT CONCAT(N'Thư mục backup: ', @Dir);

/* ---------- 1. Recovery model FULL (bat buoc de backup LOG / khoi phuc theo thoi diem) ---------- */
ALTER DATABASE MushroomFarmDB SET RECOVERY FULL;

/* ---------- 2. Backup FULL: sao luu toan bo database ---------- */
BACKUP DATABASE MushroomFarmDB TO DISK = @Full
WITH INIT, FORMAT, CHECKSUM, COMPRESSION, NAME = N'MushroomFarmDB - Full';
PRINT N'2. Đã backup FULL';

/* ---------- 3. Thay doi du lieu roi backup DIFFERENTIAL (chi phan thay doi tu lan FULL) ---------- */
EXEC MushroomFarmDB.dbo.usp_SimulateSensorData @Rounds = 5, @IntervalMinutes = 1, @AnomalyPercent = 0;

BACKUP DATABASE MushroomFarmDB TO DISK = @Diff
WITH DIFFERENTIAL, INIT, FORMAT, CHECKSUM, COMPRESSION, NAME = N'MushroomFarmDB - Diff';
PRINT N'3. Đã backup DIFFERENTIAL';

/* ---------- 4. Su co: lo tay cap nhat sai gia ---------- */
WAITFOR DELAY '00:00:02';
DECLARE @BeforeMistake DATETIME = GETDATE();
WAITFOR DELAY '00:00:02';

UPDATE MushroomFarmDB.dbo.RentalPackages SET PricePerTray = 0;   -- quen WHERE!
PRINT CONCAT(N'4. Sự cố lúc ', FORMAT(GETDATE(), 'HH:mm:ss'),
             N': tất cả giá gói thuê = 0. Khôi phục về ', FORMAT(@BeforeMistake, 'HH:mm:ss'));

/* ---------- 5. Backup LOG (ghi lai moi giao tac, ke ca lenh sai) ---------- */
BACKUP LOG MushroomFarmDB TO DISK = @Log
WITH INIT, FORMAT, CHECKSUM, COMPRESSION, NAME = N'MushroomFarmDB - Log';
PRINT N'5. Đã backup LOG';

/* ---------- 6. Kiem tra file backup ---------- */
RESTORE VERIFYONLY FROM DISK = @Full WITH CHECKSUM;
RESTORE VERIFYONLY FROM DISK = @Diff WITH CHECKSUM;
RESTORE VERIFYONLY FROM DISK = @Log  WITH CHECKSUM;

-- Lich su backup SQL Server luu trong msdb
SELECT TOP (3) bs.name AS BackupName,
       CASE bs.type WHEN 'D' THEN 'FULL' WHEN 'I' THEN 'DIFF' WHEN 'L' THEN 'LOG' END AS BackupType,
       bs.backup_start_date AS StartedAt,
       CAST(bs.compressed_backup_size / 1024.0 / 1024 AS DECIMAL(10,2)) AS SizeMB,
       bmf.physical_device_name AS FilePath
FROM msdb.dbo.backupset bs
JOIN msdb.dbo.backupmediafamily bmf ON bmf.media_set_id = bs.media_set_id
WHERE bs.database_name = N'MushroomFarmDB'
ORDER BY bs.backup_start_date DESC;

/* ---------- 7. Khoi phuc vao database moi, dung truoc thoi diem su co ---------- */
IF DB_ID(N'MushroomFarmDB_Restore') IS NOT NULL
BEGIN
    ALTER DATABASE MushroomFarmDB_Restore SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE MushroomFarmDB_Restore;
END;

-- Ten logic cua file data/log lay tu DB goc, file vat ly moi dat ten _Restore
DECLARE @DataPath NVARCHAR(400) = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS NVARCHAR(400));
DECLARE @DataName SYSNAME, @LogName SYSNAME;
SELECT @DataName = name FROM sys.master_files WHERE database_id = DB_ID(N'MushroomFarmDB') AND type = 0;
SELECT @LogName  = name FROM sys.master_files WHERE database_id = DB_ID(N'MushroomFarmDB') AND type = 1;
DECLARE @MoveData NVARCHAR(500) = @DataPath + N'MushroomFarmDB_Restore.mdf';
DECLARE @MoveLog  NVARCHAR(500) = @DataPath + N'MushroomFarmDB_Restore_log.ldf';

-- FULL va DIFF: NORECOVERY = chua mo database, con cho khoi phuc tiep
RESTORE DATABASE MushroomFarmDB_Restore FROM DISK = @Full
WITH MOVE @DataName TO @MoveData, MOVE @LogName TO @MoveLog, NORECOVERY, REPLACE;

RESTORE DATABASE MushroomFarmDB_Restore FROM DISK = @Diff WITH NORECOVERY;

-- LOG: chi ap dung den truoc thoi diem su co, RECOVERY = mo database
RESTORE LOG MushroomFarmDB_Restore FROM DISK = @Log WITH STOPAT = @BeforeMistake, RECOVERY;
PRINT N'7. Đã khôi phục vào MushroomFarmDB_Restore';

/* ---------- 8. So sanh va sua lai DB goc tu ban khoi phuc ---------- */
SELECT g.PackageName,
       g.PricePerTray AS GiaTrongDBGoc_SauSuCo,
       r.PricePerTray AS GiaTrongBanKhoiPhuc
FROM MushroomFarmDB.dbo.RentalPackages g
JOIN MushroomFarmDB_Restore.dbo.RentalPackages r ON r.PackageId = g.PackageId;

UPDATE g SET PricePerTray = r.PricePerTray
FROM MushroomFarmDB.dbo.RentalPackages g
JOIN MushroomFarmDB_Restore.dbo.RentalPackages r ON r.PackageId = g.PackageId;
PRINT N'8. Đã sửa lại giá trong MushroomFarmDB từ bản khôi phục';

SELECT PackageName, PricePerTray FROM MushroomFarmDB.dbo.RentalPackages;
GO

/* ---------- Don dep (bo comment neu muon xoa ban khoi phuc) ----------
ALTER DATABASE MushroomFarmDB_Restore SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
DROP DATABASE MushroomFarmDB_Restore;
*/
