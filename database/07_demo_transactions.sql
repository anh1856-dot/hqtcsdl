/* =====================================================================
   MushroomFarmDB
   07_demo_transactions.sql : Demo transaction, khoa, muc co lap, deadlock

   KHONG bam F5 ca file. Moi demo can 2 (hoac 3) cua so query trong SSMS:
     - Mo cua so moi: chuot phai MushroomFarmDB -> New Query
     - Boi den dung doan "CUA SO 1" -> F5, trong vong vai giay
       chuyen sang cua so kia, boi den doan "CUA SO 2" -> F5
   Demo 1 co ghi du lieu that (them 2 don thue). Muon tra lai du lieu goc:
   chay lai run_all.ps1.
   ===================================================================== */


/* #####################################################################
   DEMO 1: HAI KHACH THUE CUNG LUC - KHONG BI TRUNG KHAY
   usp_RentTrays khoa cac khay duoc chon bang UPDLOCK, HOLDLOCK.
   Cua so 1 giu transaction 15 giay -> cua so 2 phai CHO, sau do nhan
   khay KHAC.
   ##################################################################### */

-- ===== CUA SO 1 =====
USE MushroomFarmDB;
BEGIN TRANSACTION;
    EXEC dbo.usp_RentTrays @CustomerId = 8, @PackageId = 1, @TrayCount = 2, @RoomId = 3;
    PRINT N'Cửa sổ 1 đã lấy khay, giữ khóa 15 giây...';
    WAITFOR DELAY '00:00:15';
COMMIT TRANSACTION;
PRINT N'Cửa sổ 1 COMMIT';

-- ===== CUA SO 2 (chay ngay sau cua so 1) =====
USE MushroomFarmDB;
DECLARE @Start DATETIME2 = SYSDATETIME();
EXEC dbo.usp_RentTrays @CustomerId = 6, @PackageId = 1, @TrayCount = 2, @RoomId = 3;
PRINT CONCAT(N'Cửa sổ 2 phải chờ ', DATEDIFF(SECOND, @Start, SYSDATETIME()), N' giây');

-- ===== CUA SO 3 (tuy chon, chay trong luc cua so 2 dang cho) =====
-- Xem ai dang cho ai va dang cho khoa loai gi
SELECT r.session_id       AS PhienDangCho,
       r.blocking_session_id AS BiChanBoiPhien,
       r.wait_type, r.wait_time AS ChoMs,
       t.text             AS CauLenh
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.blocking_session_id <> 0;

SELECT request_session_id AS Phien, resource_type, request_mode AS LoaiKhoa, request_status
FROM sys.dm_tran_locks
WHERE resource_database_id = DB_ID(N'MushroomFarmDB') AND resource_type IN ('KEY', 'OBJECT', 'PAGE')
ORDER BY request_session_id;


/* #####################################################################
   DEMO 2: MUC CO LAP - DIRTY READ
   Cua so 1 sua gia nhung CHUA commit (roi rollback).
   READ UNCOMMITTED doc duoc gia "ao" chua commit (dirty read).
   READ COMMITTED (mac dinh) phai cho cua so 1 xong.
   ##################################################################### */

-- ===== CUA SO 1 =====
USE MushroomFarmDB;
BEGIN TRANSACTION;
    UPDATE dbo.RentalPackages SET PricePerTray = 999000 WHERE PackageId = 1;
    PRINT N'Đã sửa giá nhưng chưa COMMIT, chờ 15 giây rồi ROLLBACK...';
    WAITFOR DELAY '00:00:15';
ROLLBACK TRANSACTION;
PRINT N'Cửa sổ 1 ROLLBACK, giá trở lại như cũ';

-- ===== CUA SO 2a: doc ban (tra ve 999000 du gia nay khong bao gio duoc luu) =====
USE MushroomFarmDB;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SELECT PackageName, PricePerTray AS GiaDocDuoc FROM dbo.RentalPackages WHERE PackageId = 1;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- ===== CUA SO 2b: muc mac dinh (bi chan den khi cua so 1 rollback, tra ve gia dung) =====
USE MushroomFarmDB;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
SELECT PackageName, PricePerTray AS GiaDocDuoc FROM dbo.RentalPackages WHERE PackageId = 1;


/* #####################################################################
   DEMO 3: DEADLOCK
   Hai transaction khoa 2 phong theo thu tu nguoc nhau -> cho vong tron.
   SQL Server tu phat hien, huy 1 ben (loi 1205 "deadlock victim"),
   ben con lai chay tiep. Ca hai deu ROLLBACK de khong doi du lieu.
   ##################################################################### */

-- ===== CUA SO 1 =====
USE MushroomFarmDB;
BEGIN TRY
    BEGIN TRANSACTION;
        UPDATE dbo.Rooms SET Description = Description WHERE RoomCode = 'R01';  -- khoa R01
        WAITFOR DELAY '00:00:05';
        UPDATE dbo.Rooms SET Description = Description WHERE RoomCode = 'R02';  -- cho R02
    ROLLBACK TRANSACTION;
    PRINT N'Cửa sổ 1 chạy xong';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT CONCAT(N'Cửa sổ 1 lỗi ', ERROR_NUMBER(), N': ', ERROR_MESSAGE());
END CATCH;

-- ===== CUA SO 2 (chay trong vong 5 giay sau cua so 1) =====
USE MushroomFarmDB;
BEGIN TRY
    BEGIN TRANSACTION;
        UPDATE dbo.Rooms SET Description = Description WHERE RoomCode = 'R02';  -- khoa R02
        WAITFOR DELAY '00:00:05';
        UPDATE dbo.Rooms SET Description = Description WHERE RoomCode = 'R01';  -- cho R01 -> deadlock
    ROLLBACK TRANSACTION;
    PRINT N'Cửa sổ 2 chạy xong';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT CONCAT(N'Cửa sổ 2 lỗi ', ERROR_NUMBER(), N': ', ERROR_MESSAGE());
END CATCH;

/* Cach xu ly deadlock trong ung dung: bat loi 1205 va thu lai vai lan.
   Cach phong tranh: moi transaction truy cap tai nguyen theo CUNG thu tu
   (vd luon R01 roi R02), giu transaction ngan, them index phu hop. */
USE MushroomFarmDB;
DECLARE @Try INT = 1;
WHILE @Try <= 3
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;
            UPDATE dbo.Rooms SET Description = Description WHERE RoomCode = 'R01';
            UPDATE dbo.Rooms SET Description = Description WHERE RoomCode = 'R02';
        ROLLBACK TRANSACTION;   -- demo: khong luu thay doi
        PRINT CONCAT(N'Thành công ở lần thử ', @Try);
        BREAK;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        IF ERROR_NUMBER() = 1205 AND @Try < 3
        BEGIN
            PRINT CONCAT(N'Deadlock, thử lại lần ', @Try + 1);
            SET @Try += 1;
            WAITFOR DELAY '00:00:01';
        END
        ELSE
            THROW;
    END CATCH;
END;
