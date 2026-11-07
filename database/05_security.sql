/* =====================================================================
   MushroomFarmDB
   05_security.sql : Phan quyen SQL Server (login, user, role, GRANT/DENY)
   Chay sau 01 -> 04. Chay lai nhieu lan duoc.

   3 tai khoan, moi tai khoan chi co dung quyen can thiet (least privilege):
     mushroom_app    -> backend Node.js
     mushroom_report -> chi xem bao cao
     mushroom_iot    -> chuong trinh gia lap IoT, chi gui du lieu cam bien

   LUU Y:
   - Mat khau ben duoi chi dung cho moi truong dev tren may ca nhan. Doi lai
     neu dua len server that.
   - Muon dang nhap bang cac login nay, SQL Server phai bat che do
     "SQL Server and Windows Authentication mode" (SSMS: chuot phai server
     -> Properties -> Security), roi khoi dong lai dich vu SQL Server.
   ===================================================================== */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

/* =====================================================================
   1. LOGIN (cap server)
   ===================================================================== */
USE master;
GO
DECLARE @Logins TABLE (LoginName SYSNAME, Pwd NVARCHAR(128));
INSERT INTO @Logins VALUES
(N'mushroom_app',    N'MushroomApp@Dev2026'),
(N'mushroom_report', N'MushroomReport@Dev2026'),
(N'mushroom_iot',    N'MushroomIoT@Dev2026');

DECLARE @Name SYSNAME, @Pwd NVARCHAR(128), @Sql NVARCHAR(MAX);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT LoginName, Pwd FROM @Logins;
OPEN cur;
FETCH NEXT FROM cur INTO @Name, @Pwd;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = @Name)
    BEGIN
        -- CREATE LOGIN khong nhan bien cho mat khau -> dung dynamic SQL
        SET @Sql = N'CREATE LOGIN ' + QUOTENAME(@Name)
                 + N' WITH PASSWORD = ' + QUOTENAME(@Pwd, '''')
                 + N', DEFAULT_DATABASE = MushroomFarmDB, CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;';
        EXEC sys.sp_executesql @Sql;
        PRINT CONCAT(N'Tao login ', @Name);
    END;
    FETCH NEXT FROM cur INTO @Name, @Pwd;
END;
CLOSE cur; DEALLOCATE cur;
GO

/* =====================================================================
   2. USER va ROLE (cap database)
   ===================================================================== */
USE MushroomFarmDB;
GO

IF USER_ID(N'mushroom_app')    IS NULL CREATE USER mushroom_app    FOR LOGIN mushroom_app;
IF USER_ID(N'mushroom_report') IS NULL CREATE USER mushroom_report FOR LOGIN mushroom_report;
IF USER_ID(N'mushroom_iot')    IS NULL CREATE USER mushroom_iot    FOR LOGIN mushroom_iot;

IF DATABASE_PRINCIPAL_ID(N'rl_backend') IS NULL CREATE ROLE rl_backend;
IF DATABASE_PRINCIPAL_ID(N'rl_report')  IS NULL CREATE ROLE rl_report;
IF DATABASE_PRINCIPAL_ID(N'rl_iot')     IS NULL CREATE ROLE rl_iot;

IF IS_ROLEMEMBER(N'rl_backend', N'mushroom_app')    = 0 ALTER ROLE rl_backend ADD MEMBER mushroom_app;
IF IS_ROLEMEMBER(N'rl_report',  N'mushroom_report') = 0 ALTER ROLE rl_report  ADD MEMBER mushroom_report;
IF IS_ROLEMEMBER(N'rl_iot',     N'mushroom_iot')    = 0 ALTER ROLE rl_iot     ADD MEMBER mushroom_iot;
GO

/* =====================================================================
   3. QUYEN CHO TUNG ROLE
   ===================================================================== */

/* ---------- rl_backend: backend ung dung ----------
   Duoc doc/them/sua tren toan schema va goi moi procedure.
   KHONG duoc ALTER/DROP bang (khong co quyen DDL).
   Cac bang tien bac / lich su: DENY ghi truc tiep, bat buoc di qua procedure.
   Procedure van chay duoc nho "ownership chaining": procedure va bang cung
   chu so huu (dbo) nen SQL Server khong kiem tra quyen tren bang nua. */
GRANT SELECT, INSERT, UPDATE, EXECUTE ON SCHEMA::dbo TO rl_backend;

-- Chi duoc xoa o nhung bang it rui ro (Users co trigger xoa mem)
GRANT DELETE ON dbo.Notifications         TO rl_backend;
GRANT DELETE ON dbo.UserNotificationPrefs TO rl_backend;
GRANT DELETE ON dbo.Users                 TO rl_backend;

-- Thue khay, thanh toan: chi qua usp_RentTrays / usp_AssignTrayToCustomer
DENY INSERT, UPDATE, DELETE ON dbo.Payments    TO rl_backend;
DENY INSERT, DELETE         ON dbo.Rentals     TO rl_backend;
DENY INSERT, DELETE         ON dbo.RentalTrays TO rl_backend;

-- Du lieu lich su khong duoc sua / xoa (phuc vu truy vet)
DENY UPDATE, DELETE ON dbo.SensorReadings TO rl_backend;
DENY UPDATE, DELETE ON dbo.DeviceCommands TO rl_backend;
DENY UPDATE, DELETE ON dbo.GrowthLogs     TO rl_backend;
GO

/* ---------- rl_report: chi xem bao cao ---------- */
GRANT SELECT  ON dbo.vw_MonthlyRevenue        TO rl_report;
GRANT SELECT  ON dbo.vw_HarvestSummary        TO rl_report;
GRANT SELECT  ON dbo.vw_TrayOverview          TO rl_report;
GRANT SELECT  ON dbo.vw_RoomLatestEnvironment TO rl_report;
GRANT EXECUTE ON dbo.usp_RevenueReport        TO rl_report;
GO

/* ---------- rl_iot: chi gui du lieu cam bien ---------- */
GRANT EXECUTE ON dbo.usp_InsertSensorReading TO rl_iot;
GRANT EXECUTE ON dbo.usp_SimulateSensorData  TO rl_iot;
GO

/* =====================================================================
   4. KIEM TRA QUYEN (EXECUTE AS = tam dong vai user, khong can dang nhap)
   ===================================================================== */
CREATE TABLE #Check (Seq INT IDENTITY, Who SYSNAME, Action NVARCHAR(100), Expected NVARCHAR(10), Result NVARCHAR(200));
DECLARE @r NVARCHAR(200);

-- rl_report
EXECUTE AS USER = 'mushroom_report';
BEGIN TRY DECLARE @x1 INT = (SELECT COUNT(*) FROM dbo.vw_MonthlyRevenue); SET @r = N'OK'; END TRY
BEGIN CATCH SET @r = CONCAT(N'Bị chặn (', ERROR_NUMBER(), N')'); END CATCH;
REVERT;
INSERT #Check VALUES ('mushroom_report', N'SELECT vw_MonthlyRevenue', N'OK', @r);

EXECUTE AS USER = 'mushroom_report';
BEGIN TRY DECLARE @x2 INT = (SELECT COUNT(*) FROM dbo.Users); SET @r = N'OK'; END TRY
BEGIN CATCH SET @r = CONCAT(N'Bị chặn (', ERROR_NUMBER(), N')'); END CATCH;
REVERT;
INSERT #Check VALUES ('mushroom_report', N'SELECT bảng Users', N'Bị chặn', @r);

-- rl_iot
EXECUTE AS USER = 'mushroom_iot';
BEGIN TRY
    BEGIN TRAN;
    CREATE TABLE #R (ReadingId BIGINT);
    INSERT #R EXEC dbo.usp_InsertSensorReading @DeviceCode = 'SEN-R01', @Temperature = 25, @Humidity = 88, @CO2 = 600;
    ROLLBACK;
    SET @r = N'OK';
END TRY
BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; SET @r = CONCAT(N'Bị chặn (', ERROR_NUMBER(), N')'); END CATCH;
REVERT;
INSERT #Check VALUES ('mushroom_iot', N'EXEC usp_InsertSensorReading', N'OK', @r);

EXECUTE AS USER = 'mushroom_iot';
BEGIN TRY DECLARE @x3 INT = (SELECT COUNT(*) FROM dbo.SensorReadings); SET @r = N'OK'; END TRY
BEGIN CATCH SET @r = CONCAT(N'Bị chặn (', ERROR_NUMBER(), N')'); END CATCH;
REVERT;
INSERT #Check VALUES ('mushroom_iot', N'SELECT bảng SensorReadings', N'Bị chặn', @r);

-- rl_backend
EXECUTE AS USER = 'mushroom_app';
BEGIN TRY BEGIN TRAN; UPDATE dbo.Payments SET Amount = 0; ROLLBACK; SET @r = N'OK'; END TRY
BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; SET @r = CONCAT(N'Bị chặn (', ERROR_NUMBER(), N')'); END CATCH;
REVERT;
INSERT #Check VALUES ('mushroom_app', N'UPDATE trực tiếp bảng Payments', N'Bị chặn', @r);

EXECUTE AS USER = 'mushroom_app';
BEGIN TRY
    BEGIN TRAN;
    CREATE TABLE #T (TrayId INT, TrayCode VARCHAR(20), RoomName NVARCHAR(100));
    INSERT #T EXEC dbo.usp_RentTrays @CustomerId = 8, @PackageId = 1, @TrayCount = 1;
    ROLLBACK;
    SET @r = N'OK';
END TRY
BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; SET @r = CONCAT(N'Bị chặn (', ERROR_NUMBER(), N')'); END CATCH;
REVERT;
INSERT #Check VALUES ('mushroom_app', N'EXEC usp_RentTrays (ghi Payments qua proc)', N'OK', @r);

EXECUTE AS USER = 'mushroom_app';
BEGIN TRY BEGIN TRAN; EXEC (N'DROP TABLE dbo.Alerts'); ROLLBACK; SET @r = N'OK'; END TRY
BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; SET @r = CONCAT(N'Bị chặn (', ERROR_NUMBER(), N')'); END CATCH;
REVERT;
INSERT #Check VALUES ('mushroom_app', N'DROP TABLE Alerts', N'Bị chặn', @r);

SELECT Who, Action, Expected, Result,
       CASE WHEN LEFT(Result, 2) = LEFT(Expected, 2) THEN N'✔' ELSE N'✘ SAI' END AS Pass
FROM #Check ORDER BY Seq;
DROP TABLE #Check;
GO

PRINT N'05_security.sql: xong';
