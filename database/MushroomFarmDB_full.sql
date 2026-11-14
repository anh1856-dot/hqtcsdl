/* =====================================================================
   MushroomFarmDB - FILE GOP DAY DU (tao tu dong boi build_full.ps1)
   Gom: 01 -> 05. Khong gom 06 (backup) va 07 (demo, chay tung doan).
   Chay ca file trong SSMS: bam F5. CANH BAO: xoa va tao lai toan bo bang
   trong MushroomFarmDB (khong anh huong database khac).
   Sua code thi sua o cac file goc, roi chay lai build_full.ps1.
   ===================================================================== */

/* #####################################################################
   01_create_tables.sql
   ##################################################################### */
/* =====================================================================
   MushroomFarmDB - He thong quan ly nuoi trong nam thong minh
   01_create_tables.sql : Tao database, bang, rang buoc, index
   Chay lai nhieu lan duoc: xoa bang cu (chi trong MushroomFarmDB) roi tao lai
   ===================================================================== */

-- Filtered index, trigger, procedure can 2 tuy chon nay (sqlcmd mac dinh tat QUOTED_IDENTIFIER)
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF DB_ID(N'MushroomFarmDB') IS NULL
    CREATE DATABASE MushroomFarmDB;
GO

USE MushroomFarmDB;
GO

/* ---------- Xoa bang cu theo thu tu nguoc khoa ngoai ---------- */
DROP TABLE IF EXISTS dbo.DeliveryRequests;
DROP TABLE IF EXISTS dbo.Harvests;
DROP TABLE IF EXISTS dbo.GrowthLogs;
DROP TABLE IF EXISTS dbo.UserNotificationPrefs;
DROP TABLE IF EXISTS dbo.NotificationSettings;
DROP TABLE IF EXISTS dbo.Notifications;
DROP TABLE IF EXISTS dbo.Alerts;
DROP TABLE IF EXISTS dbo.DeviceCommands;
DROP TABLE IF EXISTS dbo.SensorReadings;
DROP TABLE IF EXISTS dbo.EnvThresholds;
DROP TABLE IF EXISTS dbo.Devices;
DROP TABLE IF EXISTS dbo.Payments;
DROP TABLE IF EXISTS dbo.RentalTrays;
DROP TABLE IF EXISTS dbo.Rentals;
DROP TABLE IF EXISTS dbo.RentalPackages;
DROP TABLE IF EXISTS dbo.Trays;
DROP TABLE IF EXISTS dbo.MushroomTypes;
DROP TABLE IF EXISTS dbo.Rooms;
DROP TABLE IF EXISTS dbo.Users;
DROP TABLE IF EXISTS dbo.Roles;
GO

/* =====================================================================
   1. TAI KHOAN
   ===================================================================== */
CREATE TABLE dbo.Roles (
    RoleId      TINYINT       NOT NULL CONSTRAINT PK_Roles PRIMARY KEY,
    RoleName    VARCHAR(20)   NOT NULL CONSTRAINT UQ_Roles_RoleName UNIQUE,
    Description NVARCHAR(200) NULL
);

CREATE TABLE dbo.Users (
    UserId       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
    RoleId       TINYINT        NOT NULL CONSTRAINT FK_Users_Roles REFERENCES dbo.Roles(RoleId),
    FullName     NVARCHAR(100)  NOT NULL,
    Email        VARCHAR(100)   NOT NULL,
    Phone        VARCHAR(15)    NULL,
    PasswordHash VARCHAR(255)   NOT NULL,           -- backend luu bcrypt hash
    Address      NVARCHAR(255)  NULL,
    AvatarUrl    VARCHAR(500)   NULL,
    Status       VARCHAR(10)    NOT NULL CONSTRAINT DF_Users_Status DEFAULT 'Active',
    IsDeleted    BIT            NOT NULL CONSTRAINT DF_Users_IsDeleted DEFAULT 0,
    CreatedAt    DATETIME2(0)   NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSDATETIME(),
    UpdatedAt    DATETIME2(0)   NULL,
    LastLoginAt  DATETIME2(0)   NULL,
    CONSTRAINT UQ_Users_Email UNIQUE (Email),
    CONSTRAINT CK_Users_Status CHECK (Status IN ('Active', 'Disabled')),
    CONSTRAINT CK_Users_Email CHECK (Email LIKE '%_@_%._%')
);
-- Phone duy nhat nhung cho phep NULL
CREATE UNIQUE INDEX UX_Users_Phone ON dbo.Users(Phone) WHERE Phone IS NOT NULL;
GO

/* =====================================================================
   2. PHONG, LOAI NAM, KHAY
   ===================================================================== */
CREATE TABLE dbo.Rooms (
    RoomId      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Rooms PRIMARY KEY,
    RoomCode    VARCHAR(10)    NOT NULL CONSTRAINT UQ_Rooms_RoomCode UNIQUE,
    RoomName    NVARCHAR(100)  NOT NULL,
    Capacity    INT            NOT NULL,            -- so khay toi da
    Description NVARCHAR(500)  NULL,
    Status      VARCHAR(15)    NOT NULL CONSTRAINT DF_Rooms_Status DEFAULT 'Active',
    CreatedAt   DATETIME2(0)   NOT NULL CONSTRAINT DF_Rooms_CreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT CK_Rooms_Capacity CHECK (Capacity > 0),
    CONSTRAINT CK_Rooms_Status CHECK (Status IN ('Active', 'Maintenance', 'Inactive'))
);

CREATE TABLE dbo.MushroomTypes (
    MushroomTypeId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MushroomTypes PRIMARY KEY,
    TypeName       NVARCHAR(100) NOT NULL CONSTRAINT UQ_MushroomTypes_TypeName UNIQUE,
    GrowthDays     INT           NOT NULL,          -- so ngay tu cay giong den thu hoach
    ExpectedYieldKg DECIMAL(6,2) NULL,              -- san luong du kien / khay
    Description    NVARCHAR(500) NULL,
    ImageUrl       VARCHAR(500)  NULL,
    CONSTRAINT CK_MushroomTypes_GrowthDays CHECK (GrowthDays > 0)
);

CREATE TABLE dbo.Trays (
    TrayId              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Trays PRIMARY KEY,
    TrayCode            VARCHAR(20)  NOT NULL CONSTRAINT UQ_Trays_TrayCode UNIQUE,
    RoomId              INT          NOT NULL CONSTRAINT FK_Trays_Rooms REFERENCES dbo.Rooms(RoomId),
    MushroomTypeId      INT          NULL CONSTRAINT FK_Trays_MushroomTypes REFERENCES dbo.MushroomTypes(MushroomTypeId),
    PositionLabel       NVARCHAR(50) NULL,          -- vi tri tren ke, vd: Ke A - Tang 2
    Status              VARCHAR(20)  NOT NULL CONSTRAINT DF_Trays_Status DEFAULT 'Available',
    Stage               VARCHAR(20)  NULL,          -- giai doan sinh truong, NULL khi chua trong
    PlantedDate         DATE         NULL,
    ExpectedHarvestDate DATE         NULL,
    CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_Trays_CreatedAt DEFAULT SYSDATETIME(),
    UpdatedAt           DATETIME2(0) NULL,
    CONSTRAINT CK_Trays_Status CHECK (Status IN
        ('Available', 'Rented', 'Growing', 'ReadyToHarvest', 'Harvested', 'Maintenance')),
    CONSTRAINT CK_Trays_Stage CHECK (Stage IN
        ('Inoculation', 'Incubation', 'Pinning', 'Fruiting', 'Harvest')),
    CONSTRAINT CK_Trays_Dates CHECK (ExpectedHarvestDate IS NULL OR PlantedDate IS NULL
                                     OR ExpectedHarvestDate >= PlantedDate)
);
CREATE INDEX IX_Trays_RoomId_Status ON dbo.Trays(RoomId, Status);
GO

/* =====================================================================
   3. CHO THUE
   ===================================================================== */
CREATE TABLE dbo.RentalPackages (
    PackageId    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RentalPackages PRIMARY KEY,
    PackageName  NVARCHAR(100) NOT NULL,
    DurationDays INT           NOT NULL,
    PricePerTray DECIMAL(12,0) NOT NULL,            -- VND
    MaxTrays     INT           NOT NULL CONSTRAINT DF_RentalPackages_MaxTrays DEFAULT 1,
    Description  NVARCHAR(500) NULL,
    IsActive     BIT           NOT NULL CONSTRAINT DF_RentalPackages_IsActive DEFAULT 1,
    CreatedAt    DATETIME2(0)  NOT NULL CONSTRAINT DF_RentalPackages_CreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT CK_RentalPackages_Duration CHECK (DurationDays > 0),
    CONSTRAINT CK_RentalPackages_Price CHECK (PricePerTray >= 0),
    CONSTRAINT CK_RentalPackages_MaxTrays CHECK (MaxTrays > 0)
);

CREATE TABLE dbo.Rentals (
    RentalId    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Rentals PRIMARY KEY,
    CustomerId  INT           NOT NULL CONSTRAINT FK_Rentals_Customer REFERENCES dbo.Users(UserId),
    PackageId   INT           NOT NULL CONSTRAINT FK_Rentals_Packages REFERENCES dbo.RentalPackages(PackageId),
    CreatedBy   INT           NULL CONSTRAINT FK_Rentals_CreatedBy REFERENCES dbo.Users(UserId), -- Operator gan khay; NULL = khach tu thue
    StartDate   DATE          NOT NULL,
    EndDate     DATE          NOT NULL,
    TrayCount   INT           NOT NULL,
    TotalAmount DECIMAL(14,0) NOT NULL,
    Status      VARCHAR(15)   NOT NULL CONSTRAINT DF_Rentals_Status DEFAULT 'Pending',
    Note        NVARCHAR(500) NULL,
    CreatedAt   DATETIME2(0)  NOT NULL CONSTRAINT DF_Rentals_CreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT CK_Rentals_Dates CHECK (EndDate > StartDate),
    CONSTRAINT CK_Rentals_TrayCount CHECK (TrayCount > 0),
    CONSTRAINT CK_Rentals_Status CHECK (Status IN ('Pending', 'Active', 'Completed', 'Cancelled'))
);
CREATE INDEX IX_Rentals_CustomerId ON dbo.Rentals(CustomerId, Status);

-- Chi tiet: khay nao thuoc don thue nao
CREATE TABLE dbo.RentalTrays (
    RentalTrayId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RentalTrays PRIMARY KEY,
    RentalId     INT          NOT NULL CONSTRAINT FK_RentalTrays_Rentals REFERENCES dbo.Rentals(RentalId),
    TrayId       INT          NOT NULL CONSTRAINT FK_RentalTrays_Trays REFERENCES dbo.Trays(TrayId),
    IsActive     BIT          NOT NULL CONSTRAINT DF_RentalTrays_IsActive DEFAULT 1,
    IsLinked     BIT          NOT NULL CONSTRAINT DF_RentalTrays_IsLinked DEFAULT 0, -- khach da dang ky bang ma khay
    LinkedAt     DATETIME2(0) NULL,
    CONSTRAINT UQ_RentalTrays UNIQUE (RentalId, TrayId)
);
-- BR03: mot khay tai mot thoi diem chi thuoc 1 don thue dang hieu luc
CREATE UNIQUE INDEX UX_RentalTrays_ActiveTray ON dbo.RentalTrays(TrayId) WHERE IsActive = 1;

CREATE TABLE dbo.Payments (
    PaymentId     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Payments PRIMARY KEY,
    RentalId      INT           NOT NULL CONSTRAINT FK_Payments_Rentals REFERENCES dbo.Rentals(RentalId),
    Amount        DECIMAL(14,0) NOT NULL,
    Method        VARCHAR(20)   NOT NULL,
    Status        VARCHAR(15)   NOT NULL CONSTRAINT DF_Payments_Status DEFAULT 'Pending',
    TransactionRef VARCHAR(50)  NULL,               -- ma giao dich gia lap
    PaidAt        DATETIME2(0)  NULL,
    CreatedAt     DATETIME2(0)  NOT NULL CONSTRAINT DF_Payments_CreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT CK_Payments_Amount CHECK (Amount >= 0),
    CONSTRAINT CK_Payments_Method CHECK (Method IN ('Cash', 'BankTransfer', 'EWallet', 'Card')),
    CONSTRAINT CK_Payments_Status CHECK (Status IN ('Pending', 'Paid', 'Failed', 'Refunded'))
);
CREATE INDEX IX_Payments_RentalId ON dbo.Payments(RentalId);
GO

/* =====================================================================
   4. IOT: THIET BI, CAM BIEN, NGUONG, LENH DIEU KHIEN
   ===================================================================== */
CREATE TABLE dbo.Devices (
    DeviceId     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Devices PRIMARY KEY,
    DeviceCode   VARCHAR(20)   NOT NULL CONSTRAINT UQ_Devices_DeviceCode UNIQUE,
    DeviceName   NVARCHAR(100) NOT NULL,
    DeviceType   VARCHAR(20)   NOT NULL,
    RoomId       INT           NOT NULL CONSTRAINT FK_Devices_Rooms REFERENCES dbo.Rooms(RoomId),
    TrayId       INT           NULL CONSTRAINT FK_Devices_Trays REFERENCES dbo.Trays(TrayId), -- camera huong vao khay
    IsSimulated  BIT           NOT NULL CONSTRAINT DF_Devices_IsSimulated DEFAULT 1,
    IsOn         BIT           NOT NULL CONSTRAINT DF_Devices_IsOn DEFAULT 0,   -- trang thai bat/tat (thiet bi dieu khien)
    AutoMode     BIT           NOT NULL CONSTRAINT DF_Devices_AutoMode DEFAULT 1,
    Status       VARCHAR(10)   NOT NULL CONSTRAINT DF_Devices_Status DEFAULT 'Online',
    StreamUrl    VARCHAR(500)  NULL,                -- chi dung cho camera
    LastSeenAt   DATETIME2(0)  NULL,
    CreatedAt    DATETIME2(0)  NOT NULL CONSTRAINT DF_Devices_CreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT CK_Devices_Type CHECK (DeviceType IN
        ('Sensor', 'MistSprayer', 'Fan', 'Heater', 'GrowLight', 'Camera')),
    CONSTRAINT CK_Devices_Status CHECK (Status IN ('Online', 'Offline', 'Error')),
    CONSTRAINT CK_Devices_Stream CHECK (DeviceType = 'Camera' OR StreamUrl IS NULL)
);
CREATE INDEX IX_Devices_RoomId ON dbo.Devices(RoomId, DeviceType);

-- Moi dong = 1 lan do cua 1 node cam bien (nhiet do, do am, CO2)
CREATE TABLE dbo.SensorReadings (
    ReadingId   BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SensorReadings PRIMARY KEY,
    DeviceId    INT           NOT NULL CONSTRAINT FK_SensorReadings_Devices REFERENCES dbo.Devices(DeviceId),
    RoomId      INT           NOT NULL CONSTRAINT FK_SensorReadings_Rooms REFERENCES dbo.Rooms(RoomId),
    Temperature DECIMAL(5,2)  NULL,                 -- do C
    Humidity    DECIMAL(5,2)  NULL,                 -- %
    CO2         DECIMAL(7,1)  NULL,                 -- ppm
    RecordedAt  DATETIME2(0)  NOT NULL CONSTRAINT DF_SensorReadings_RecordedAt DEFAULT SYSDATETIME(),
    CONSTRAINT CK_SensorReadings_Humidity CHECK (Humidity BETWEEN 0 AND 100),
    CONSTRAINT CK_SensorReadings_CO2 CHECK (CO2 >= 0),
    CONSTRAINT CK_SensorReadings_Temp CHECK (Temperature BETWEEN -20 AND 80)
);
-- Truy van lich su theo phong + thoi gian
CREATE INDEX IX_SensorReadings_Room_Time ON dbo.SensorReadings(RoomId, RecordedAt DESC)
    INCLUDE (Temperature, Humidity, CO2);

-- Nguong moi truong theo phong, moi chi so 1 dong
CREATE TABLE dbo.EnvThresholds (
    ThresholdId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EnvThresholds PRIMARY KEY,
    RoomId      INT          NOT NULL CONSTRAINT FK_EnvThresholds_Rooms REFERENCES dbo.Rooms(RoomId),
    Metric      VARCHAR(15)  NOT NULL,
    MinValue    DECIMAL(7,2) NOT NULL,
    MaxValue    DECIMAL(7,2) NOT NULL,
    UpdatedBy   INT          NULL CONSTRAINT FK_EnvThresholds_Users REFERENCES dbo.Users(UserId),
    UpdatedAt   DATETIME2(0) NOT NULL CONSTRAINT DF_EnvThresholds_UpdatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_EnvThresholds UNIQUE (RoomId, Metric),
    CONSTRAINT CK_EnvThresholds_Metric CHECK (Metric IN ('Temperature', 'Humidity', 'CO2')),
    CONSTRAINT CK_EnvThresholds_Range CHECK (MinValue < MaxValue)
);

-- Lich su lenh dieu khien (thu cong hoac tu dong)
CREATE TABLE dbo.DeviceCommands (
    CommandId  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DeviceCommands PRIMARY KEY,
    DeviceId   INT           NOT NULL CONSTRAINT FK_DeviceCommands_Devices REFERENCES dbo.Devices(DeviceId),
    Command    VARCHAR(10)   NOT NULL,
    Source     VARCHAR(10)   NOT NULL,
    IssuedBy   INT           NULL CONSTRAINT FK_DeviceCommands_Users REFERENCES dbo.Users(UserId),
    Reason     NVARCHAR(255) NULL,
    Status     VARCHAR(10)   NOT NULL CONSTRAINT DF_DeviceCommands_Status DEFAULT 'Sent',
    CreatedAt  DATETIME2(0)  NOT NULL CONSTRAINT DF_DeviceCommands_CreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT CK_DeviceCommands_Command CHECK (Command IN ('ON', 'OFF')),
    CONSTRAINT CK_DeviceCommands_Source CHECK (Source IN ('Manual', 'Auto')),
    CONSTRAINT CK_DeviceCommands_Status CHECK (Status IN ('Sent', 'Executed', 'Failed')),
    CONSTRAINT CK_DeviceCommands_Issuer CHECK (Source = 'Auto' OR IssuedBy IS NOT NULL)
);
CREATE INDEX IX_DeviceCommands_Device_Time ON dbo.DeviceCommands(DeviceId, CreatedAt DESC);
GO

/* =====================================================================
   5. CANH BAO, THONG BAO
   ===================================================================== */
CREATE TABLE dbo.Alerts (
    AlertId    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Alerts PRIMARY KEY,
    RoomId     INT           NOT NULL CONSTRAINT FK_Alerts_Rooms REFERENCES dbo.Rooms(RoomId),
    ReadingId  BIGINT        NULL CONSTRAINT FK_Alerts_SensorReadings REFERENCES dbo.SensorReadings(ReadingId),
    Metric     VARCHAR(15)   NOT NULL,
    Value      DECIMAL(7,2)  NOT NULL,
    Severity   VARCHAR(10)   NOT NULL,
    Message    NVARCHAR(500) NOT NULL,
    Status     VARCHAR(15)   NOT NULL CONSTRAINT DF_Alerts_Status DEFAULT 'Open',
    ResolvedBy INT           NULL CONSTRAINT FK_Alerts_Users REFERENCES dbo.Users(UserId),
    ResolvedAt DATETIME2(0)  NULL,
    CreatedAt  DATETIME2(0)  NOT NULL CONSTRAINT DF_Alerts_CreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT CK_Alerts_Metric CHECK (Metric IN ('Temperature', 'Humidity', 'CO2')),
    CONSTRAINT CK_Alerts_Severity CHECK (Severity IN ('Warning', 'Critical')),
    CONSTRAINT CK_Alerts_Status CHECK (Status IN ('Open', 'Acknowledged', 'Resolved'))
);
CREATE INDEX IX_Alerts_Room_Status ON dbo.Alerts(RoomId, Status);

CREATE TABLE dbo.Notifications (
    NotificationId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY,
    UserId    INT           NOT NULL CONSTRAINT FK_Notifications_Users REFERENCES dbo.Users(UserId),
    Type      VARCHAR(20)   NOT NULL,
    Title     NVARCHAR(200) NOT NULL,
    Content   NVARCHAR(1000) NOT NULL,
    AlertId   INT           NULL CONSTRAINT FK_Notifications_Alerts REFERENCES dbo.Alerts(AlertId),
    TrayId    INT           NULL CONSTRAINT FK_Notifications_Trays REFERENCES dbo.Trays(TrayId),
    IsRead    BIT           NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT 0,
    CreatedAt DATETIME2(0)  NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT CK_Notifications_Type CHECK (Type IN
        ('Alert', 'Progress', 'HarvestReady', 'Rental', 'Delivery', 'System'))
);
CREATE INDEX IX_Notifications_User ON dbo.Notifications(UserId, IsRead, CreatedAt DESC);

-- UC35: Admin bat/tat tung loai thong bao cho toan he thong
CREATE TABLE dbo.NotificationSettings (
    Type        VARCHAR(20)   NOT NULL CONSTRAINT PK_NotificationSettings PRIMARY KEY,
    DisplayName NVARCHAR(100) NOT NULL,
    IsEnabled   BIT           NOT NULL CONSTRAINT DF_NotificationSettings_IsEnabled DEFAULT 1,
    UpdatedBy   INT           NULL CONSTRAINT FK_NotificationSettings_Users REFERENCES dbo.Users(UserId),
    UpdatedAt   DATETIME2(0)  NOT NULL CONSTRAINT DF_NotificationSettings_UpdatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT CK_NotificationSettings_Type CHECK (Type IN
        ('Alert', 'Progress', 'HarvestReady', 'Rental', 'Delivery', 'System'))
);

-- Nguoi dung tu tat loai thong bao khong muon nhan (khong co dong = dang bat)
CREATE TABLE dbo.UserNotificationPrefs (
    UserId    INT          NOT NULL CONSTRAINT FK_UserNotificationPrefs_Users REFERENCES dbo.Users(UserId),
    Type      VARCHAR(20)  NOT NULL CONSTRAINT FK_UserNotificationPrefs_Settings REFERENCES dbo.NotificationSettings(Type),
    IsEnabled BIT          NOT NULL,
    UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_UserNotificationPrefs_UpdatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT PK_UserNotificationPrefs PRIMARY KEY (UserId, Type)
);
GO

/* =====================================================================
   6. TIEN DO, THU HOACH, GIAO NHAN
   ===================================================================== */
CREATE TABLE dbo.GrowthLogs (
    LogId     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_GrowthLogs PRIMARY KEY,
    TrayId    INT            NOT NULL CONSTRAINT FK_GrowthLogs_Trays REFERENCES dbo.Trays(TrayId),
    Stage     VARCHAR(20)    NOT NULL,
    Note      NVARCHAR(1000) NULL,
    ImageUrl  VARCHAR(500)   NULL,
    LoggedBy  INT            NOT NULL CONSTRAINT FK_GrowthLogs_Users REFERENCES dbo.Users(UserId),
    LoggedAt  DATETIME2(0)   NOT NULL CONSTRAINT DF_GrowthLogs_LoggedAt DEFAULT SYSDATETIME(),
    CONSTRAINT CK_GrowthLogs_Stage CHECK (Stage IN
        ('Inoculation', 'Incubation', 'Pinning', 'Fruiting', 'Harvest'))
);
CREATE INDEX IX_GrowthLogs_Tray ON dbo.GrowthLogs(TrayId, LoggedAt DESC);

CREATE TABLE dbo.Harvests (
    HarvestId     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Harvests PRIMARY KEY,
    TrayId        INT           NOT NULL CONSTRAINT FK_Harvests_Trays REFERENCES dbo.Trays(TrayId),
    RentalId      INT           NULL CONSTRAINT FK_Harvests_Rentals REFERENCES dbo.Rentals(RentalId), -- NULL neu khay cua trai
    ScheduledDate DATE          NOT NULL,
    HarvestedAt   DATETIME2(0)  NULL,
    WeightKg      DECIMAL(6,2)  NULL,
    Quality       VARCHAR(10)   NULL,
    Status        VARCHAR(15)   NOT NULL CONSTRAINT DF_Harvests_Status DEFAULT 'Scheduled',
    RecordedBy    INT           NULL CONSTRAINT FK_Harvests_Users REFERENCES dbo.Users(UserId),
    Note          NVARCHAR(500) NULL,
    CONSTRAINT CK_Harvests_Weight CHECK (WeightKg IS NULL OR WeightKg >= 0),
    CONSTRAINT CK_Harvests_Quality CHECK (Quality IN ('A', 'B', 'C')),
    CONSTRAINT CK_Harvests_Status CHECK (Status IN ('Scheduled', 'Completed', 'Cancelled')),
    CONSTRAINT CK_Harvests_Completed CHECK (Status <> 'Completed'
                                            OR (HarvestedAt IS NOT NULL AND WeightKg IS NOT NULL))
);
CREATE INDEX IX_Harvests_Tray ON dbo.Harvests(TrayId, Status);

CREATE TABLE dbo.DeliveryRequests (
    RequestId     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DeliveryRequests PRIMARY KEY,
    HarvestId     INT           NOT NULL CONSTRAINT FK_DeliveryRequests_Harvests REFERENCES dbo.Harvests(HarvestId),
    CustomerId    INT           NOT NULL CONSTRAINT FK_DeliveryRequests_Users REFERENCES dbo.Users(UserId),
    RequestType   VARCHAR(10)   NOT NULL,
    Address       NVARCHAR(255) NULL,
    ReceiverPhone VARCHAR(15)   NULL,
    PreferredDate DATE          NULL,
    Fee           DECIMAL(12,0) NOT NULL CONSTRAINT DF_DeliveryRequests_Fee DEFAULT 0,
    Status        VARCHAR(15)   NOT NULL CONSTRAINT DF_DeliveryRequests_Status DEFAULT 'Pending',
    ProcessedBy   INT           NULL CONSTRAINT FK_DeliveryRequests_ProcessedBy REFERENCES dbo.Users(UserId),
    CreatedAt     DATETIME2(0)  NOT NULL CONSTRAINT DF_DeliveryRequests_CreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT CK_DeliveryRequests_Type CHECK (RequestType IN ('Pickup', 'Delivery')),
    CONSTRAINT CK_DeliveryRequests_Address CHECK (RequestType = 'Pickup' OR Address IS NOT NULL),
    CONSTRAINT CK_DeliveryRequests_Status CHECK (Status IN
        ('Pending', 'Confirmed', 'Shipping', 'Completed', 'Cancelled'))
);
GO

PRINT N'01_create_tables.sql: xong';

GO

/* #####################################################################
   02_views_functions.sql
   ##################################################################### */
/* =====================================================================
   MushroomFarmDB
   02_views_functions.sql : Function va View
   ===================================================================== */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE MushroomFarmDB;
GO

/* =====================================================================
   FUNCTION
   ===================================================================== */

-- BR07: Ngay thu hoach du kien = ngay trong + so ngay sinh truong cua loai nam
CREATE OR ALTER FUNCTION dbo.fn_CalcExpectedHarvestDate
(
    @PlantedDate    DATE,
    @MushroomTypeId INT
)
RETURNS DATE
AS
BEGIN
    DECLARE @Days INT;
    SELECT @Days = GrowthDays FROM dbo.MushroomTypes WHERE MushroomTypeId = @MushroomTypeId;
    RETURN CASE WHEN @PlantedDate IS NULL OR @Days IS NULL THEN NULL
                ELSE DATEADD(DAY, @Days, @PlantedDate) END;
END;
GO

-- So khay con trong (toan trai neu @RoomId = NULL)
CREATE OR ALTER FUNCTION dbo.fn_CountAvailableTrays (@RoomId INT = NULL)
RETURNS INT
AS
BEGIN
    RETURN (SELECT COUNT(*)
            FROM dbo.Trays t
            JOIN dbo.Rooms r ON r.RoomId = t.RoomId
            WHERE t.Status = 'Available'
              AND r.Status = 'Active'
              AND (@RoomId IS NULL OR t.RoomId = @RoomId));
END;
GO

-- Ten tieng Viet cua chi so moi truong (dung trong thong bao)
CREATE OR ALTER FUNCTION dbo.fn_MetricName (@Metric VARCHAR(15))
RETURNS NVARCHAR(20)
AS
BEGIN
    RETURN CASE @Metric WHEN 'Temperature' THEN N'Nhiệt độ'
                        WHEN 'Humidity'    THEN N'Độ ẩm'
                        WHEN 'CO2'         THEN N'CO₂'
                        ELSE @Metric END;
END;
GO

/* =====================================================================
   VIEW
   ===================================================================== */

-- Tong quan khay: phong, loai nam, trang thai, khach dang thue
CREATE OR ALTER VIEW dbo.vw_TrayOverview
AS
SELECT  t.TrayId, t.TrayCode, t.PositionLabel,
        r.RoomId, r.RoomCode, r.RoomName,
        mt.MushroomTypeId, mt.TypeName,
        t.Status, t.Stage, t.PlantedDate, t.ExpectedHarvestDate,
        DATEDIFF(DAY, CAST(SYSDATETIME() AS DATE), t.ExpectedHarvestDate) AS DaysToHarvest,
        rt.RentalId, rt.IsLinked,
        u.UserId   AS CustomerId,
        u.FullName AS CustomerName,
        rn.EndDate AS RentalEndDate
FROM dbo.Trays t
JOIN dbo.Rooms r               ON r.RoomId = t.RoomId
LEFT JOIN dbo.MushroomTypes mt ON mt.MushroomTypeId = t.MushroomTypeId
LEFT JOIN dbo.RentalTrays rt   ON rt.TrayId = t.TrayId AND rt.IsActive = 1
LEFT JOIN dbo.Rentals rn       ON rn.RentalId = rt.RentalId
LEFT JOIN dbo.Users u          ON u.UserId = rn.CustomerId;
GO

-- Moi truong moi nhat cua tung phong + so sanh voi nguong
CREATE OR ALTER VIEW dbo.vw_RoomLatestEnvironment
AS
WITH Latest AS (
    SELECT sr.*,
           ROW_NUMBER() OVER (PARTITION BY sr.RoomId ORDER BY sr.RecordedAt DESC, sr.ReadingId DESC) AS rn
    FROM dbo.SensorReadings sr
)
SELECT  r.RoomId, r.RoomCode, r.RoomName,
        l.Temperature, l.Humidity, l.CO2, l.RecordedAt,
        tT.MinValue AS TempMin, tT.MaxValue AS TempMax,
        tH.MinValue AS HumMin,  tH.MaxValue AS HumMax,
        tC.MinValue AS CO2Min,  tC.MaxValue AS CO2Max,
        CASE WHEN l.Temperature < tT.MinValue THEN 'Low'
             WHEN l.Temperature > tT.MaxValue THEN 'High' ELSE 'Normal' END AS TempState,
        CASE WHEN l.Humidity < tH.MinValue THEN 'Low'
             WHEN l.Humidity > tH.MaxValue THEN 'High' ELSE 'Normal' END AS HumState,
        CASE WHEN l.CO2 < tC.MinValue THEN 'Low'
             WHEN l.CO2 > tC.MaxValue THEN 'High' ELSE 'Normal' END AS CO2State
FROM dbo.Rooms r
LEFT JOIN Latest l              ON l.RoomId = r.RoomId AND l.rn = 1
LEFT JOIN dbo.EnvThresholds tT  ON tT.RoomId = r.RoomId AND tT.Metric = 'Temperature'
LEFT JOIN dbo.EnvThresholds tH  ON tH.RoomId = r.RoomId AND tH.Metric = 'Humidity'
LEFT JOIN dbo.EnvThresholds tC  ON tC.RoomId = r.RoomId AND tC.Metric = 'CO2';
GO

-- Trang thai thiet bi + lenh dieu khien gan nhat
CREATE OR ALTER VIEW dbo.vw_DeviceStatus
AS
SELECT  d.DeviceId, d.DeviceCode, d.DeviceName, d.DeviceType,
        r.RoomCode, r.RoomName,
        d.Status, d.IsOn, d.AutoMode, d.IsSimulated, d.LastSeenAt,
        lc.Command   AS LastCommand,
        lc.Source    AS LastCommandSource,
        lc.CreatedAt AS LastCommandAt
FROM dbo.Devices d
JOIN dbo.Rooms r ON r.RoomId = d.RoomId
OUTER APPLY (SELECT TOP (1) c.Command, c.Source, c.CreatedAt
             FROM dbo.DeviceCommands c
             WHERE c.DeviceId = d.DeviceId
             ORDER BY c.CreatedAt DESC, c.CommandId DESC) lc;
GO

-- Doanh thu theo thang (chi tinh thanh toan thanh cong)
CREATE OR ALTER VIEW dbo.vw_MonthlyRevenue
AS
-- Don thue + cac lan gia han (BR14) deu la thanh toan: so don/so khay chi tinh
-- o thanh toan dau tien cua don de khong dem trung; doanh thu cong tat ca.
WITH P AS (
    SELECT p.RentalId, p.Amount, p.PaidAt,
           CASE WHEN p.PaymentId = MIN(p.PaymentId) OVER (PARTITION BY p.RentalId) THEN 1 ELSE 0 END AS IsFirst
    FROM dbo.Payments p
    WHERE p.Status = 'Paid'
)
SELECT  YEAR(P.PaidAt)  AS [Year],
        MONTH(P.PaidAt) AS [Month],
        SUM(P.IsFirst)                                            AS RentalCount,
        SUM(CASE WHEN P.IsFirst = 1 THEN rn.TrayCount ELSE 0 END) AS TrayCount,
        SUM(1 - P.IsFirst)                                        AS ExtensionCount,
        SUM(P.Amount)                                             AS Revenue
FROM P
JOIN dbo.Rentals rn ON rn.RentalId = P.RentalId
GROUP BY YEAR(P.PaidAt), MONTH(P.PaidAt);
GO

-- San luong thu hoach theo thang va loai nam
CREATE OR ALTER VIEW dbo.vw_HarvestSummary
AS
SELECT  YEAR(h.HarvestedAt)  AS [Year],
        MONTH(h.HarvestedAt) AS [Month],
        mt.TypeName,
        COUNT(*)             AS HarvestCount,
        SUM(h.WeightKg)      AS TotalKg,
        CAST(AVG(h.WeightKg) AS DECIMAL(6,2)) AS AvgKgPerTray
FROM dbo.Harvests h
JOIN dbo.Trays t          ON t.TrayId = h.TrayId
JOIN dbo.MushroomTypes mt ON mt.MushroomTypeId = t.MushroomTypeId
WHERE h.Status = 'Completed'
GROUP BY YEAR(h.HarvestedAt), MONTH(h.HarvestedAt), mt.TypeName;
GO

-- Khay khach dang thue (BR08: khach chi thay khay da lien ket cua minh)
CREATE OR ALTER FUNCTION dbo.fn_GetCustomerTrays (@CustomerId INT)
RETURNS TABLE
AS
RETURN
    SELECT  v.TrayId, v.TrayCode, v.RoomName, v.TypeName,
            v.Status, v.Stage, v.PlantedDate, v.ExpectedHarvestDate, v.DaysToHarvest,
            v.RentalId, v.RentalEndDate,
            e.Temperature, e.Humidity, e.CO2, e.RecordedAt AS EnvRecordedAt,
            cam.StreamUrl AS CameraUrl
    FROM dbo.vw_TrayOverview v
    LEFT JOIN dbo.vw_RoomLatestEnvironment e ON e.RoomId = v.RoomId
    OUTER APPLY (SELECT TOP (1) d.StreamUrl
                 FROM dbo.Devices d
                 WHERE d.DeviceType = 'Camera'
                   AND d.RoomId = v.RoomId
                   AND (d.TrayId = v.TrayId OR d.TrayId IS NULL)
                 ORDER BY CASE WHEN d.TrayId = v.TrayId THEN 0 ELSE 1 END) cam
    WHERE v.CustomerId = @CustomerId
      AND v.IsLinked = 1;
GO

PRINT N'02_views_functions.sql: xong';

GO

/* #####################################################################
   03_procedures_triggers.sql
   ##################################################################### */
/* =====================================================================
   MushroomFarmDB
   03_procedures_triggers.sql : Stored procedure va Trigger
   Ma loi tu dinh nghia: 50001 - 50099 (backend bat theo ERROR_NUMBER)
   ===================================================================== */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE MushroomFarmDB;
GO

/* =====================================================================
   HAM HO TRO
   ===================================================================== */

-- Tra ve ten vai tro neu user ton tai, dang hoat dong; NULL neu khong hop le
CREATE OR ALTER FUNCTION dbo.fn_GetActiveUserRole (@UserId INT)
RETURNS VARCHAR(20)
AS
BEGIN
    RETURN (SELECT r.RoleName
            FROM dbo.Users u
            JOIN dbo.Roles r ON r.RoleId = u.RoleId
            WHERE u.UserId = @UserId AND u.Status = 'Active' AND u.IsDeleted = 0);
END;
GO

-- Khach dang thue khay (NULL neu khay khong co don thue hieu luc)
CREATE OR ALTER FUNCTION dbo.fn_GetTrayRenter (@TrayId INT)
RETURNS INT
AS
BEGIN
    RETURN (SELECT rn.CustomerId
            FROM dbo.RentalTrays rt
            JOIN dbo.Rentals rn ON rn.RentalId = rt.RentalId
            WHERE rt.TrayId = @TrayId AND rt.IsActive = 1);
END;
GO

/* =====================================================================
   1. CHO THUE
   ===================================================================== */

-- UC16: Khach tu thue 1 hoac nhieu khay online. He thong tu chon khay trong,
-- tao don thue + thanh toan (gia lap) trong 1 transaction.
CREATE OR ALTER PROCEDURE dbo.usp_RentTrays
    @CustomerId     INT,
    @PackageId      INT,
    @TrayCount      INT = 1,
    @RoomId         INT = NULL,          -- NULL = phong nao cung duoc
    @MushroomTypeId INT = NULL,          -- NULL = loai nao cung duoc
    @PaymentMethod  VARCHAR(20) = 'EWallet',
    @RentalId       INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Msg NVARCHAR(400);

    IF ISNULL(dbo.fn_GetActiveUserRole(@CustomerId), '') <> 'Customer'
        THROW 50001, N'Khách hàng không tồn tại hoặc tài khoản đã bị khóa.', 1;

    DECLARE @Duration INT, @Price DECIMAL(12,0), @MaxTrays INT;
    SELECT @Duration = DurationDays, @Price = PricePerTray, @MaxTrays = MaxTrays
    FROM dbo.RentalPackages
    WHERE PackageId = @PackageId AND IsActive = 1;

    IF @Duration IS NULL
        THROW 50002, N'Gói thuê không tồn tại hoặc đã ngừng áp dụng.', 1;

    IF @TrayCount < 1 OR @TrayCount > @MaxTrays
    BEGIN
        SET @Msg = CONCAT(N'Số khay phải từ 1 đến ', @MaxTrays, N' với gói này.');
        THROW 50003, @Msg, 1;
    END;

    -- BR14: khach chon loai nam co thoi gian sinh truong dai hon goi -> bao loi ro rang
    DECLARE @Growth INT = (SELECT GrowthDays FROM dbo.MushroomTypes WHERE MushroomTypeId = @MushroomTypeId);
    IF @Growth > @Duration
    BEGIN
        SET @Msg = CONCAT(N'Gói thuê quá ngắn cho loại nấm này (cần ', @Growth,
                          N' ngày, gói chỉ có ', @Duration, N' ngày). Hãy chọn gói dài hơn.');
        THROW 50009, @Msg, 1;
    END;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Khoa cac khay duoc chon de 2 khach thue cung luc khong lay trung khay.
        -- BR14: chi lay khay co loai nam kip thu hoach trong thoi han goi
        -- (khay chua gan loai nam thi loai nam chon luc bat dau trong).
        DECLARE @Picked TABLE (TrayId INT PRIMARY KEY);
        INSERT INTO @Picked (TrayId)
        SELECT TOP (@TrayCount) t.TrayId
        FROM dbo.Trays t WITH (UPDLOCK, HOLDLOCK)
        JOIN dbo.Rooms r ON r.RoomId = t.RoomId
        LEFT JOIN dbo.MushroomTypes mt ON mt.MushroomTypeId = t.MushroomTypeId
        WHERE t.Status = 'Available'
          AND r.Status = 'Active'
          AND (@RoomId IS NULL OR t.RoomId = @RoomId)
          AND (@MushroomTypeId IS NULL OR t.MushroomTypeId = @MushroomTypeId)
          AND (mt.GrowthDays IS NULL OR mt.GrowthDays <= @Duration)
        ORDER BY t.RoomId, t.TrayId;

        IF (SELECT COUNT(*) FROM @Picked) < @TrayCount
        BEGIN
            -- Phan biet "het khay" voi "con khay nhung loai nam qua dai so voi goi"
            DECLARE @AnyFree INT = (SELECT COUNT(*)
                                    FROM dbo.Trays t
                                    JOIN dbo.Rooms r ON r.RoomId = t.RoomId
                                    WHERE t.Status = 'Available' AND r.Status = 'Active'
                                      AND (@RoomId IS NULL OR t.RoomId = @RoomId)
                                      AND (@MushroomTypeId IS NULL OR t.MushroomTypeId = @MushroomTypeId));
            IF @AnyFree >= @TrayCount
            BEGIN
                SET @Msg = CONCAT(N'Gói thuê ', @Duration, N' ngày quá ngắn cho loại nấm của các khay còn trống ',
                                  N'(chỉ ', (SELECT COUNT(*) FROM @Picked), N' khay phù hợp). Hãy chọn gói dài hơn.');
                THROW 50009, @Msg, 1;
            END;
            SET @Msg = CONCAT(N'Không đủ khay trống. Yêu cầu ', @TrayCount,
                              N', còn ', (SELECT COUNT(*) FROM @Picked), N'.');
            THROW 50004, @Msg, 1;
        END;

        DECLARE @Today DATE = CAST(SYSDATETIME() AS DATE);
        DECLARE @Total DECIMAL(14,0) = @Price * @TrayCount;

        INSERT INTO dbo.Rentals (CustomerId, PackageId, StartDate, EndDate, TrayCount, TotalAmount, Status)
        VALUES (@CustomerId, @PackageId, @Today, DATEADD(DAY, @Duration, @Today), @TrayCount, @Total, 'Active');
        SET @RentalId = SCOPE_IDENTITY();

        -- Thue online: khay lien ket voi tai khoan ngay
        INSERT INTO dbo.RentalTrays (RentalId, TrayId, IsLinked, LinkedAt)
        SELECT @RentalId, TrayId, 1, SYSDATETIME() FROM @Picked;

        UPDATE t SET Status = 'Rented', UpdatedAt = SYSDATETIME()
        FROM dbo.Trays t JOIN @Picked p ON p.TrayId = t.TrayId;

        -- Thanh toan gia lap: thanh cong ngay
        INSERT INTO dbo.Payments (RentalId, Amount, Method, Status, TransactionRef, PaidAt)
        VALUES (@RentalId, @Total, @PaymentMethod, 'Paid',
                CONCAT('SIM', FORMAT(SYSDATETIME(), 'yyyyMMddHHmmss'), @RentalId), SYSDATETIME());

        INSERT INTO dbo.Notifications (UserId, Type, Title, Content)
        VALUES (@CustomerId, 'Rental', N'Thuê khay thành công',
                CONCAT(N'Bạn đã thuê ', @TrayCount, N' khay, đơn #', @RentalId,
                       N'. Tổng tiền: ', FORMAT(@Total, 'N0'), N' đ.'));

        COMMIT TRANSACTION;

        SELECT t.TrayId, t.TrayCode, r.RoomName
        FROM @Picked p
        JOIN dbo.Trays t ON t.TrayId = p.TrayId
        JOIN dbo.Rooms r ON r.RoomId = t.RoomId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- UC19: Operator gan 1 khay cu the cho khach (thue tai trai).
-- Khay chua lien ket: khach phai nhap ma khay tren app (usp_LinkTrayByCode).
CREATE OR ALTER PROCEDURE dbo.usp_AssignTrayToCustomer
    @OperatorId    INT,
    @CustomerId    INT,
    @PackageId     INT,
    @TrayCode      VARCHAR(20),
    @PaymentMethod VARCHAR(20) = 'Cash',
    @RentalId      INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(dbo.fn_GetActiveUserRole(@OperatorId), '') NOT IN ('Admin', 'Operator')
        THROW 50010, N'Bạn không có quyền gán khay.', 1;

    IF ISNULL(dbo.fn_GetActiveUserRole(@CustomerId), '') <> 'Customer'
        THROW 50001, N'Khách hàng không tồn tại hoặc tài khoản đã bị khóa.', 1;

    DECLARE @Duration INT, @Price DECIMAL(12,0);
    SELECT @Duration = DurationDays, @Price = PricePerTray
    FROM dbo.RentalPackages WHERE PackageId = @PackageId AND IsActive = 1;
    IF @Duration IS NULL
        THROW 50002, N'Gói thuê không tồn tại hoặc đã ngừng áp dụng.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @TrayId INT, @TrayStatus VARCHAR(20), @Growth INT, @Msg NVARCHAR(400);
        SELECT @TrayId = t.TrayId, @TrayStatus = t.Status, @Growth = mt.GrowthDays
        FROM dbo.Trays t WITH (UPDLOCK, HOLDLOCK)
        LEFT JOIN dbo.MushroomTypes mt ON mt.MushroomTypeId = t.MushroomTypeId
        WHERE t.TrayCode = @TrayCode;

        IF @TrayId IS NULL
            THROW 50005, N'Mã khay không tồn tại.', 1;
        IF @TrayStatus <> 'Available'
            THROW 50006, N'Khay không ở trạng thái sẵn sàng cho thuê.', 1;
        -- BR14: loai nam cua khay phai kip thu hoach trong thoi han goi
        IF @Growth > @Duration
        BEGIN
            SET @Msg = CONCAT(N'Gói thuê quá ngắn cho loại nấm của khay này (cần ', @Growth,
                              N' ngày, gói chỉ có ', @Duration, N' ngày). Hãy chọn gói dài hơn.');
            THROW 50009, @Msg, 1;
        END;

        DECLARE @Today DATE = CAST(SYSDATETIME() AS DATE);

        INSERT INTO dbo.Rentals (CustomerId, PackageId, CreatedBy, StartDate, EndDate, TrayCount, TotalAmount, Status)
        VALUES (@CustomerId, @PackageId, @OperatorId, @Today, DATEADD(DAY, @Duration, @Today), 1, @Price, 'Active');
        SET @RentalId = SCOPE_IDENTITY();

        INSERT INTO dbo.RentalTrays (RentalId, TrayId, IsLinked) VALUES (@RentalId, @TrayId, 0);

        UPDATE dbo.Trays SET Status = 'Rented', UpdatedAt = SYSDATETIME() WHERE TrayId = @TrayId;

        INSERT INTO dbo.Payments (RentalId, Amount, Method, Status, TransactionRef, PaidAt)
        VALUES (@RentalId, @Price, @PaymentMethod, 'Paid',
                CONCAT('SIM', FORMAT(SYSDATETIME(), 'yyyyMMddHHmmss'), @RentalId), SYSDATETIME());

        INSERT INTO dbo.Notifications (UserId, Type, Title, Content, TrayId)
        VALUES (@CustomerId, 'Rental', N'Bạn được gán khay mới',
                CONCAT(N'Khay ', @TrayCode, N' đã được gán cho bạn. Nhập mã khay trong ứng dụng để theo dõi.'),
                @TrayId);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- UC18 / BR09: Khach dang ky khay bang ma. Chi thanh cong khi khay thuoc
-- don thue dang hieu luc cua chinh khach do.
CREATE OR ALTER PROCEDURE dbo.usp_LinkTrayByCode
    @CustomerId INT,
    @TrayCode   VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @RentalTrayId INT, @IsLinked BIT, @OwnerId INT;

    SELECT @RentalTrayId = rt.RentalTrayId, @IsLinked = rt.IsLinked, @OwnerId = rn.CustomerId
    FROM dbo.Trays t
    JOIN dbo.RentalTrays rt ON rt.TrayId = t.TrayId AND rt.IsActive = 1
    JOIN dbo.Rentals rn     ON rn.RentalId = rt.RentalId AND rn.Status = 'Active'
    WHERE t.TrayCode = @TrayCode;

    IF NOT EXISTS (SELECT 1 FROM dbo.Trays WHERE TrayCode = @TrayCode)
        THROW 50005, N'Mã khay không tồn tại.', 1;
    IF @RentalTrayId IS NULL OR @OwnerId <> @CustomerId
        THROW 50007, N'Khay này không thuộc đơn thuê của bạn.', 1;
    IF @IsLinked = 1
        THROW 50008, N'Khay đã được liên kết với tài khoản của bạn trước đó.', 1;

    UPDATE dbo.RentalTrays
    SET IsLinked = 1, LinkedAt = SYSDATETIME()
    WHERE RentalTrayId = @RentalTrayId;

    SELECT * FROM dbo.fn_GetCustomerTrays(@CustomerId) WHERE TrayCode = @TrayCode;
END;
GO

-- Scheduler: ket thuc don thue het han.
-- BR14: don con khay dang trong / cho thu hoach thi GIU LAI den khi thu hoach xong,
-- khong tinh them phi; bao 1 lan cho khach va nhan vien. Thu hoach xong thi
-- usp_RecordHarvest goi lai procedure nay voi @RentalId de dong don ngay.
--   @RentalId = NULL : xu ly tat ca don (scheduler)
--   @Silent   = 1    : khong tra ket qua SELECT (khi duoc goi tu procedure khac)
CREATE OR ALTER PROCEDURE dbo.usp_CompleteExpiredRentals
    @RentalId INT = NULL,
    @Silent   BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Done TABLE (RentalId INT PRIMARY KEY, CustomerId INT);
    DECLARE @Today DATE = CAST(SYSDATETIME() AS DATE);

    BEGIN TRANSACTION;

    -- 1) Don qua han nhung con khay dang trong: bao 1 lan (khong dong don)
    DECLARE @Overdue TABLE (RentalId INT PRIMARY KEY, CustomerId INT, EndDate DATE);
    INSERT INTO @Overdue (RentalId, CustomerId, EndDate)
    SELECT rn.RentalId, rn.CustomerId, rn.EndDate
    FROM dbo.Rentals rn WITH (UPDLOCK)
    WHERE rn.Status = 'Active'
      AND rn.EndDate < @Today
      AND (@RentalId IS NULL OR rn.RentalId = @RentalId)
      AND EXISTS (SELECT 1
                  FROM dbo.RentalTrays rt
                  JOIN dbo.Trays t ON t.TrayId = rt.TrayId
                  WHERE rt.RentalId = rn.RentalId AND rt.IsActive = 1
                    AND t.Status IN ('Growing', 'ReadyToHarvest'))
      -- Da bao roi thi thoi (kiem tra ca thong bao cua khach lan cua nhan vien,
      -- vi khach co the tat loai thong bao Rental)
      AND NOT EXISTS (SELECT 1 FROM dbo.Notifications n
                      WHERE n.Type = 'Rental'
                        AND (n.Content LIKE CONCAT(N'Đơn thuê #', rn.RentalId, N' đã đến hạn%')
                          OR n.Content LIKE CONCAT(N'Đơn thuê #', rn.RentalId, N' đã quá hạn%')));

    INSERT INTO dbo.Notifications (UserId, Type, Title, Content)
    SELECT o.CustomerId, 'Rental', N'Đơn thuê đã đến hạn',
           CONCAT(N'Đơn thuê #', o.RentalId, N' đã đến hạn ngày ', FORMAT(o.EndDate, 'dd/MM/yyyy'),
                  N'. Khay vẫn đang trồng nên đơn được giữ đến khi thu hoạch xong, không tính thêm phí.')
    FROM @Overdue o
    UNION ALL
    SELECT u.UserId, 'Rental', N'Đơn thuê quá hạn đang chờ thu hoạch',
           CONCAT(N'Đơn thuê #', o.RentalId, N' đã quá hạn (', FORMAT(o.EndDate, 'dd/MM/yyyy'),
                  N') nhưng còn khay đang trồng. Đơn sẽ tự đóng sau khi thu hoạch.')
    FROM @Overdue o
    CROSS JOIN dbo.Users u
    JOIN dbo.Roles ro ON ro.RoleId = u.RoleId
    WHERE ro.RoleName = 'Operator' AND u.Status = 'Active' AND u.IsDeleted = 0;

    -- 2) Dong don het han khong con khay dang trong
    UPDATE rn SET Status = 'Completed'
    OUTPUT inserted.RentalId, inserted.CustomerId INTO @Done
    FROM dbo.Rentals rn
    WHERE rn.Status = 'Active'
      AND rn.EndDate < @Today
      AND (@RentalId IS NULL OR rn.RentalId = @RentalId)
      AND NOT EXISTS (SELECT 1
                      FROM dbo.RentalTrays rt
                      JOIN dbo.Trays t ON t.TrayId = rt.TrayId
                      WHERE rt.RentalId = rn.RentalId AND rt.IsActive = 1
                        AND t.Status IN ('Growing', 'ReadyToHarvest'));

    -- Tra khay ve trang thai bao tri (ve sinh) truoc khi cho thue lai
    UPDATE t SET Status = 'Maintenance', Stage = NULL, PlantedDate = NULL,
                 ExpectedHarvestDate = NULL, UpdatedAt = SYSDATETIME()
    FROM dbo.Trays t
    JOIN dbo.RentalTrays rt ON rt.TrayId = t.TrayId AND rt.IsActive = 1
    JOIN @Done d ON d.RentalId = rt.RentalId;

    UPDATE rt SET IsActive = 0
    FROM dbo.RentalTrays rt JOIN @Done d ON d.RentalId = rt.RentalId;

    INSERT INTO dbo.Notifications (UserId, Type, Title, Content)
    SELECT CustomerId, 'Rental', N'Đơn thuê đã kết thúc',
           CONCAT(N'Đơn thuê #', RentalId, N' đã hết hạn và được đóng.')
    FROM @Done;

    COMMIT TRANSACTION;

    IF @Silent = 0
        SELECT RentalId, CustomerId FROM @Done;
END;
GO

-- UC22 / BR14: Gia han don thue co tra phi (khach tu gia han hoac nhan vien gia han ho).
-- Gia han them @Terms ky theo goi cua don, gia = gia hien tai cua goi x so khay x so ky.
-- Don da qua han (dang duoc giu cho thu hoach) thi tinh tu hom nay, khong thu tien nhung ngay da giu.
CREATE OR ALTER PROCEDURE dbo.usp_ExtendRental
    @RentalId      INT,
    @ActorId       INT,
    @Terms         INT = 1,
    @PaymentMethod VARCHAR(20) = 'EWallet',
    @NewEndDate    DATE = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Role VARCHAR(20) = dbo.fn_GetActiveUserRole(@ActorId);
    IF @Role IS NULL
        THROW 50010, N'Bạn không có quyền thực hiện thao tác này.', 1;
    IF @Terms IS NULL OR @Terms < 1 OR @Terms > 12
        THROW 50052, N'Số kỳ gia hạn phải từ 1 đến 12.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Khoa dong don thue: tranh 2 lan gia han cung luc hoac scheduler dong don giua chung
        DECLARE @CustomerId INT, @Status VARCHAR(20), @EndDate DATE, @TrayCount INT,
                @PackageId INT, @Duration INT, @Price DECIMAL(12,0), @PkgActive BIT;
        SELECT @CustomerId = rn.CustomerId, @Status = rn.Status, @EndDate = rn.EndDate,
               @TrayCount = rn.TrayCount, @PackageId = rn.PackageId,
               @Duration = pk.DurationDays, @Price = pk.PricePerTray, @PkgActive = pk.IsActive
        FROM dbo.Rentals rn WITH (UPDLOCK, HOLDLOCK)
        JOIN dbo.RentalPackages pk ON pk.PackageId = rn.PackageId
        WHERE rn.RentalId = @RentalId;

        IF @CustomerId IS NULL
            THROW 50050, N'Không tìm thấy đơn thuê.', 1;
        IF @Role = 'Customer' AND @CustomerId <> @ActorId
            THROW 50010, N'Đơn thuê này không phải của bạn.', 1;
        IF @Status <> 'Active'
            THROW 50051, N'Chỉ gia hạn được đơn thuê đang hoạt động.', 1;
        IF @PkgActive = 0
            THROW 50002, N'Gói thuê của đơn đã ngừng áp dụng, không gia hạn được.', 1;

        DECLARE @Today DATE = CAST(SYSDATETIME() AS DATE);
        DECLARE @Days INT = @Duration * @Terms;
        DECLARE @Amount DECIMAL(14,0) = @Price * @TrayCount * @Terms;
        SET @NewEndDate = DATEADD(DAY, @Days, CASE WHEN @EndDate < @Today THEN @Today ELSE @EndDate END);

        UPDATE dbo.Rentals
        SET EndDate = @NewEndDate, TotalAmount = TotalAmount + @Amount
        WHERE RentalId = @RentalId;

        INSERT INTO dbo.Payments (RentalId, Amount, Method, Status, TransactionRef, PaidAt)
        VALUES (@RentalId, @Amount, @PaymentMethod, 'Paid',
                CONCAT('EXT', FORMAT(SYSDATETIME(), 'yyyyMMddHHmmss'), @RentalId), SYSDATETIME());

        INSERT INTO dbo.Notifications (UserId, Type, Title, Content)
        VALUES (@CustomerId, 'Rental', N'Gia hạn đơn thuê thành công',
                CONCAT(N'Đơn thuê #', @RentalId, N' được gia hạn thêm ', @Days, N' ngày, đến ',
                       FORMAT(@NewEndDate, 'dd/MM/yyyy'), N'. Số tiền: ', FORMAT(@Amount, 'N0'), N' đ.'));

        COMMIT TRANSACTION;

        SELECT @RentalId AS RentalId, @NewEndDate AS EndDate, @Days AS ExtendedDays, @Amount AS Amount;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* =====================================================================
   2. CANH TAC, THU HOACH, GIAO NHAN
   ===================================================================== */

-- Bat dau vu trong tren khay (khay trong hoac khay vua duoc thue)
CREATE OR ALTER PROCEDURE dbo.usp_StartCultivation
    @TrayId         INT,
    @MushroomTypeId INT,
    @OperatorId     INT,
    @Note           NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(dbo.fn_GetActiveUserRole(@OperatorId), '') NOT IN ('Admin', 'Operator')
        THROW 50010, N'Bạn không có quyền thực hiện thao tác này.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.MushroomTypes WHERE MushroomTypeId = @MushroomTypeId)
        THROW 50011, N'Loại nấm không tồn tại.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Trays WHERE TrayId = @TrayId AND Status IN ('Available', 'Rented'))
        THROW 50012, N'Khay không tồn tại hoặc không ở trạng thái có thể bắt đầu trồng.', 1;

    DECLARE @Today DATE = CAST(SYSDATETIME() AS DATE);
    DECLARE @Expected DATE = dbo.fn_CalcExpectedHarvestDate(@Today, @MushroomTypeId);
    DECLARE @CustomerId INT = dbo.fn_GetTrayRenter(@TrayId);

    BEGIN TRANSACTION;

    UPDATE dbo.Trays
    SET Status = 'Growing', Stage = 'Inoculation', MushroomTypeId = @MushroomTypeId,
        PlantedDate = @Today, ExpectedHarvestDate = @Expected, UpdatedAt = SYSDATETIME()
    WHERE TrayId = @TrayId;

    INSERT INTO dbo.GrowthLogs (TrayId, Stage, Note, LoggedBy)
    VALUES (@TrayId, 'Inoculation', ISNULL(@Note, N'Bắt đầu cấy giống'), @OperatorId);

    IF @CustomerId IS NOT NULL
        INSERT INTO dbo.Notifications (UserId, Type, Title, Content, TrayId)
        SELECT @CustomerId, 'Progress', N'Khay của bạn đã bắt đầu trồng',
               CONCAT(N'Khay ', TrayCode, N' bắt đầu cấy giống. Dự kiến thu hoạch: ',
                      FORMAT(@Expected, 'dd/MM/yyyy'), N'.'),
               @TrayId
        FROM dbo.Trays WHERE TrayId = @TrayId;

    COMMIT TRANSACTION;
END;
GO

-- UC12/UC13: Cap nhat giai doan sinh truong (chi duoc di toi, khong lui).
-- Khi sang giai doan Harvest: khay chuyen ReadyToHarvest va tao lich thu hoach.
CREATE OR ALTER PROCEDURE dbo.usp_UpdateTrayStage
    @TrayId     INT,
    @NewStage   VARCHAR(20),
    @OperatorId INT,
    @Note       NVARCHAR(1000) = NULL,
    @ImageUrl   VARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(dbo.fn_GetActiveUserRole(@OperatorId), '') NOT IN ('Admin', 'Operator')
        THROW 50010, N'Bạn không có quyền thực hiện thao tác này.', 1;

    DECLARE @Status VARCHAR(20), @OldStage VARCHAR(20), @TrayCode VARCHAR(20), @Expected DATE;
    SELECT @Status = Status, @OldStage = Stage, @TrayCode = TrayCode, @Expected = ExpectedHarvestDate
    FROM dbo.Trays WHERE TrayId = @TrayId;

    IF @Status IS NULL
        THROW 50005, N'Khay không tồn tại.', 1;
    IF @Status <> 'Growing'
        THROW 50013, N'Chỉ cập nhật giai đoạn cho khay đang trồng.', 1;

    -- Thu tu giai doan (BR06)
    DECLARE @OldOrder INT = CASE @OldStage WHEN 'Inoculation' THEN 1 WHEN 'Incubation' THEN 2
                                           WHEN 'Pinning' THEN 3 WHEN 'Fruiting' THEN 4 WHEN 'Harvest' THEN 5 END;
    DECLARE @NewOrder INT = CASE @NewStage WHEN 'Inoculation' THEN 1 WHEN 'Incubation' THEN 2
                                           WHEN 'Pinning' THEN 3 WHEN 'Fruiting' THEN 4 WHEN 'Harvest' THEN 5 END;
    IF @NewOrder IS NULL
        THROW 50014, N'Giai đoạn không hợp lệ.', 1;
    IF @NewOrder <= @OldOrder
        THROW 50015, N'Giai đoạn mới phải sau giai đoạn hiện tại.', 1;

    DECLARE @CustomerId INT = dbo.fn_GetTrayRenter(@TrayId);
    DECLARE @RentalId INT = (SELECT RentalId FROM dbo.RentalTrays WHERE TrayId = @TrayId AND IsActive = 1);
    DECLARE @StageName NVARCHAR(50) = CASE @NewStage WHEN 'Inoculation' THEN N'Cấy giống'
                                                     WHEN 'Incubation'  THEN N'Ủ tơ'
                                                     WHEN 'Pinning'     THEN N'Ra nụ'
                                                     WHEN 'Fruiting'    THEN N'Phát triển quả thể'
                                                     WHEN 'Harvest'     THEN N'Sẵn sàng thu hoạch' END;

    BEGIN TRANSACTION;

    UPDATE dbo.Trays
    SET Stage = @NewStage,
        Status = CASE WHEN @NewStage = 'Harvest' THEN 'ReadyToHarvest' ELSE Status END,
        UpdatedAt = SYSDATETIME()
    WHERE TrayId = @TrayId;

    INSERT INTO dbo.GrowthLogs (TrayId, Stage, Note, ImageUrl, LoggedBy)
    VALUES (@TrayId, @NewStage, @Note, @ImageUrl, @OperatorId);

    IF @NewStage = 'Harvest'
    BEGIN
        DECLARE @Today DATE = CAST(SYSDATETIME() AS DATE);
        INSERT INTO dbo.Harvests (TrayId, RentalId, ScheduledDate, Status)
        VALUES (@TrayId, @RentalId,
                CASE WHEN @Expected > @Today THEN @Expected ELSE @Today END, 'Scheduled');
    END;

    IF @CustomerId IS NOT NULL
        INSERT INTO dbo.Notifications (UserId, Type, Title, Content, TrayId)
        VALUES (@CustomerId,
                CASE WHEN @NewStage = 'Harvest' THEN 'HarvestReady' ELSE 'Progress' END,
                CONCAT(N'Khay ', @TrayCode, N': ', @StageName),
                CONCAT(N'Khay ', @TrayCode, N' đã chuyển sang giai đoạn "', @StageName, N'".',
                       CASE WHEN @Note IS NOT NULL THEN CONCAT(N' Ghi chú: ', @Note) ELSE N'' END),
                @TrayId);

    COMMIT TRANSACTION;
END;
GO

-- UC37: Ghi nhan ket qua thu hoach
CREATE OR ALTER PROCEDURE dbo.usp_RecordHarvest
    @TrayId     INT,
    @WeightKg   DECIMAL(6,2),
    @Quality    VARCHAR(10),
    @OperatorId INT,
    @Note       NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(dbo.fn_GetActiveUserRole(@OperatorId), '') NOT IN ('Admin', 'Operator')
        THROW 50010, N'Bạn không có quyền thực hiện thao tác này.', 1;

    DECLARE @HarvestId INT = (SELECT TOP (1) HarvestId FROM dbo.Harvests
                              WHERE TrayId = @TrayId AND Status = 'Scheduled'
                              ORDER BY ScheduledDate);
    IF @HarvestId IS NULL
        THROW 50016, N'Khay chưa có lịch thu hoạch.', 1;
    IF @WeightKg IS NULL OR @WeightKg < 0
        THROW 50017, N'Khối lượng thu hoạch không hợp lệ.', 1;

    DECLARE @CustomerId INT = dbo.fn_GetTrayRenter(@TrayId);

    BEGIN TRANSACTION;

    UPDATE dbo.Harvests
    SET Status = 'Completed', HarvestedAt = SYSDATETIME(), WeightKg = @WeightKg,
        Quality = @Quality, RecordedBy = @OperatorId, Note = @Note
    WHERE HarvestId = @HarvestId;

    UPDATE dbo.Trays SET Status = 'Harvested', UpdatedAt = SYSDATETIME() WHERE TrayId = @TrayId;

    IF @CustomerId IS NOT NULL
        INSERT INTO dbo.Notifications (UserId, Type, Title, Content, TrayId)
        SELECT @CustomerId, 'HarvestReady', N'Đã thu hoạch nấm của bạn',
               CONCAT(N'Khay ', TrayCode, N' thu hoạch được ', @WeightKg,
                      N' kg. Hãy chọn nhận tại trại hoặc giao tận nơi.'),
               @TrayId
        FROM dbo.Trays WHERE TrayId = @TrayId;

    -- BR14: don da qua han (dang giu cho thu hoach) -> dong ngay neu khong con khay nao dang trong
    DECLARE @RentalId INT = (SELECT rt.RentalId
                             FROM dbo.RentalTrays rt
                             JOIN dbo.Rentals rn ON rn.RentalId = rt.RentalId
                             WHERE rt.TrayId = @TrayId AND rt.IsActive = 1
                               AND rn.Status = 'Active' AND rn.EndDate < CAST(SYSDATETIME() AS DATE));
    IF @RentalId IS NOT NULL
        EXEC dbo.usp_CompleteExpiredRentals @RentalId = @RentalId, @Silent = 1;

    COMMIT TRANSACTION;

    SELECT @HarvestId AS HarvestId;
END;
GO

-- UC38: Khach yeu cau nhan nam tai trai hoac giao tan noi
CREATE OR ALTER PROCEDURE dbo.usp_RequestDelivery
    @CustomerId    INT,
    @HarvestId     INT,
    @RequestType   VARCHAR(10),
    @Address       NVARCHAR(255) = NULL,
    @ReceiverPhone VARCHAR(15) = NULL,
    @PreferredDate DATE = NULL,
    @RequestId     INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1
                   FROM dbo.Harvests h
                   JOIN dbo.Rentals rn ON rn.RentalId = h.RentalId
                   WHERE h.HarvestId = @HarvestId AND h.Status = 'Completed'
                     AND rn.CustomerId = @CustomerId)
        THROW 50020, N'Không tìm thấy đợt thu hoạch của bạn.', 1;

    IF EXISTS (SELECT 1 FROM dbo.DeliveryRequests
               WHERE HarvestId = @HarvestId AND Status <> 'Cancelled')
        THROW 50021, N'Đợt thu hoạch này đã có yêu cầu giao nhận.', 1;

    IF @RequestType = 'Delivery' AND @Address IS NULL
        SELECT @Address = Address FROM dbo.Users WHERE UserId = @CustomerId;

    INSERT INTO dbo.DeliveryRequests (HarvestId, CustomerId, RequestType, Address, ReceiverPhone, PreferredDate, Fee)
    VALUES (@HarvestId, @CustomerId, @RequestType, @Address,
            ISNULL(@ReceiverPhone, (SELECT Phone FROM dbo.Users WHERE UserId = @CustomerId)),
            @PreferredDate,
            CASE WHEN @RequestType = 'Delivery' THEN 30000 ELSE 0 END);
    SET @RequestId = SCOPE_IDENTITY();
END;
GO

/* =====================================================================
   3. IOT
   ===================================================================== */

-- UC24: API nhan du lieu tu thiet bi (that hoac gia lap) goi procedure nay
CREATE OR ALTER PROCEDURE dbo.usp_InsertSensorReading
    @DeviceCode  VARCHAR(20),
    @Temperature DECIMAL(5,2) = NULL,
    @Humidity    DECIMAL(5,2) = NULL,
    @CO2         DECIMAL(7,1) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @DeviceId INT, @RoomId INT;
    SELECT @DeviceId = DeviceId, @RoomId = RoomId
    FROM dbo.Devices WHERE DeviceCode = @DeviceCode AND DeviceType = 'Sensor';

    IF @DeviceId IS NULL
        THROW 50030, N'Thiết bị cảm biến không tồn tại.', 1;

    UPDATE dbo.Devices SET LastSeenAt = SYSDATETIME(), Status = 'Online' WHERE DeviceId = @DeviceId;

    INSERT INTO dbo.SensorReadings (DeviceId, RoomId, Temperature, Humidity, CO2)
    VALUES (@DeviceId, @RoomId, @Temperature, @Humidity, @CO2);

    SELECT CAST(SCOPE_IDENTITY() AS BIGINT) AS ReadingId;
END;
GO

-- Gia lap IoT: sinh du lieu cho moi cam bien dang online.
-- @Rounds lan do, cach nhau @IntervalMinutes (lui ve qua khu de tao lich su).
-- @AnomalyPercent: ti le % moi chi so bi vuot nguong (de test canh bao).
CREATE OR ALTER PROCEDURE dbo.usp_SimulateSensorData
    @Rounds          INT = 1,
    @IntervalMinutes INT = 5,
    @AnomalyPercent  INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @i INT = @Rounds - 1;
    WHILE @i >= 0
    BEGIN
        DECLARE @At DATETIME2(0) = DATEADD(MINUTE, -@i * @IntervalMinutes, SYSDATETIME());

        -- Moi lan do la 1 lenh INSERT rieng de trigger xu ly theo dung thu tu thoi gian
        INSERT INTO dbo.SensorReadings (DeviceId, RoomId, Temperature, Humidity, CO2, RecordedAt)
        SELECT d.DeviceId, d.RoomId,
               CAST(v.T AS DECIMAL(5,2)),
               CAST(CASE WHEN v.H > 100 THEN 100 WHEN v.H < 0 THEN 0 ELSE v.H END AS DECIMAL(5,2)),
               CAST(CASE WHEN v.C < 0 THEN 0 ELSE v.C END AS DECIMAL(7,1)),
               @At
        FROM dbo.Devices d
        LEFT JOIN dbo.EnvThresholds tT ON tT.RoomId = d.RoomId AND tT.Metric = 'Temperature'
        LEFT JOIN dbo.EnvThresholds tH ON tH.RoomId = d.RoomId AND tH.Metric = 'Humidity'
        LEFT JOIN dbo.EnvThresholds tC ON tC.RoomId = d.RoomId AND tC.Metric = 'CO2'
        -- Nguong mac dinh neu phong chua cau hinh
        CROSS APPLY (SELECT ISNULL(tT.MinValue, 18)  AS TMin, ISNULL(tT.MaxValue, 26)   AS TMax,
                            ISNULL(tH.MinValue, 80)  AS HMin, ISNULL(tH.MaxValue, 95)   AS HMax,
                            ISNULL(tC.MinValue, 400) AS CMin, ISNULL(tC.MaxValue, 1000) AS CMax) th
        -- So ngau nhien rieng cho tung dong
        CROSS APPLY (SELECT RAND(CHECKSUM(NEWID())) AS rT, RAND(CHECKSUM(NEWID())) AS rH, RAND(CHECKSUM(NEWID())) AS rC,
                            ABS(CHECKSUM(NEWID())) % 100 AS aT, ABS(CHECKSUM(NEWID())) % 100 AS aH,
                            ABS(CHECKSUM(NEWID())) % 100 AS aC) rnd
        -- Binh thuong: nam trong 15%-85% khoang nguong. Bat thuong: vuot 10%-40% khoang nguong
        CROSS APPLY (SELECT
            CASE WHEN rnd.aT >= @AnomalyPercent THEN th.TMin + (th.TMax - th.TMin) * (0.15 + 0.7 * rnd.rT)
                 WHEN rnd.rT < 0.5 THEN th.TMin - (th.TMax - th.TMin) * (0.1 + 0.6 * rnd.rT)
                 ELSE th.TMax + (th.TMax - th.TMin) * (0.1 + 0.6 * (rnd.rT - 0.5)) END AS T,
            CASE WHEN rnd.aH >= @AnomalyPercent THEN th.HMin + (th.HMax - th.HMin) * (0.15 + 0.7 * rnd.rH)
                 WHEN rnd.rH < 0.5 THEN th.HMin - (th.HMax - th.HMin) * (0.1 + 0.6 * rnd.rH)
                 ELSE th.HMax + (th.HMax - th.HMin) * (0.1 + 0.6 * (rnd.rH - 0.5)) END AS H,
            CASE WHEN rnd.aC >= @AnomalyPercent THEN th.CMin + (th.CMax - th.CMin) * (0.15 + 0.7 * rnd.rC)
                 ELSE th.CMax + (th.CMax - th.CMin) * (0.1 + 0.3 * rnd.rC) END AS C   -- CO2 chi bat thuong khi cao
        ) v
        WHERE d.DeviceType = 'Sensor' AND d.Status <> 'Offline';

        SET @i -= 1;
    END;

    UPDATE dbo.Devices SET LastSeenAt = SYSDATETIME()
    WHERE DeviceType = 'Sensor' AND Status <> 'Offline';
END;
GO

-- UC27: Operator bat/tat thiet bi thu cong (tat che do tu dong cua thiet bi do)
CREATE OR ALTER PROCEDURE dbo.usp_ControlDevice
    @DeviceId INT,
    @Command  VARCHAR(10),
    @UserId   INT,
    @Reason   NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISNULL(dbo.fn_GetActiveUserRole(@UserId), '') NOT IN ('Admin', 'Operator')
        THROW 50010, N'Bạn không có quyền điều khiển thiết bị.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Devices
                   WHERE DeviceId = @DeviceId AND DeviceType IN ('MistSprayer', 'Fan', 'Heater', 'GrowLight'))
        THROW 50031, N'Thiết bị không tồn tại hoặc không điều khiển được.', 1;
    IF @Command NOT IN ('ON', 'OFF')
        THROW 50032, N'Lệnh không hợp lệ (ON/OFF).', 1;

    BEGIN TRANSACTION;
    UPDATE dbo.Devices SET AutoMode = 0 WHERE DeviceId = @DeviceId;
    INSERT INTO dbo.DeviceCommands (DeviceId, Command, Source, IssuedBy, Reason)
    VALUES (@DeviceId, @Command, 'Manual', @UserId, @Reason);
    COMMIT TRANSACTION;
END;
GO

-- UC33: Xac nhan / xu ly canh bao
CREATE OR ALTER PROCEDURE dbo.usp_UpdateAlertStatus
    @AlertId INT,
    @Status  VARCHAR(15),
    @UserId  INT
AS
BEGIN
    SET NOCOUNT ON;

    IF ISNULL(dbo.fn_GetActiveUserRole(@UserId), '') NOT IN ('Admin', 'Operator')
        THROW 50010, N'Bạn không có quyền xử lý cảnh báo.', 1;
    IF @Status NOT IN ('Acknowledged', 'Resolved')
        THROW 50033, N'Trạng thái không hợp lệ.', 1;

    UPDATE dbo.Alerts
    SET Status = @Status,
        ResolvedBy = @UserId,
        ResolvedAt = CASE WHEN @Status = 'Resolved' THEN SYSDATETIME() ELSE ResolvedAt END
    WHERE AlertId = @AlertId AND Status <> 'Resolved';

    IF @@ROWCOUNT = 0
        THROW 50034, N'Cảnh báo không tồn tại hoặc đã được xử lý.', 1;
END;
GO

-- UC35: Admin bat/tat 1 loai thong bao cho toan he thong
CREATE OR ALTER PROCEDURE dbo.usp_SetNotificationSetting
    @Type      VARCHAR(20),
    @IsEnabled BIT,
    @AdminId   INT
AS
BEGIN
    SET NOCOUNT ON;

    IF ISNULL(dbo.fn_GetActiveUserRole(@AdminId), '') <> 'Admin'
        THROW 50010, N'Chỉ Admin được cấu hình thông báo.', 1;

    UPDATE dbo.NotificationSettings
    SET IsEnabled = @IsEnabled, UpdatedBy = @AdminId, UpdatedAt = SYSDATETIME()
    WHERE Type = @Type;

    IF @@ROWCOUNT = 0
        THROW 50035, N'Loại thông báo không tồn tại.', 1;
END;
GO

-- Nguoi dung tu bat/tat 1 loai thong bao cho rieng minh
CREATE OR ALTER PROCEDURE dbo.usp_SetUserNotificationPref
    @UserId    INT,
    @Type      VARCHAR(20),
    @IsEnabled BIT
AS
BEGIN
    SET NOCOUNT ON;

    IF dbo.fn_GetActiveUserRole(@UserId) IS NULL
        THROW 50001, N'Tài khoản không tồn tại hoặc đã bị khóa.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.NotificationSettings WHERE Type = @Type)
        THROW 50035, N'Loại thông báo không tồn tại.', 1;

    MERGE dbo.UserNotificationPrefs AS t
    USING (SELECT @UserId AS UserId, @Type AS Type) AS s
       ON t.UserId = s.UserId AND t.Type = s.Type
    WHEN MATCHED THEN
        UPDATE SET IsEnabled = @IsEnabled, UpdatedAt = SYSDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (UserId, Type, IsEnabled) VALUES (@UserId, @Type, @IsEnabled);
END;
GO

/* =====================================================================
   4. BAO CAO
   ===================================================================== */

-- UC41: Doanh thu theo goi thue trong khoang thoi gian
CREATE OR ALTER PROCEDURE dbo.usp_RevenueReport
    @FromDate DATE,
    @ToDate   DATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Moi don co the co nhieu thanh toan (thue + cac lan gia han):
    -- RentalCount/TrayCount chi tinh o thanh toan dau tien cua don, tranh dem trung;
    -- Revenue cong tat ca thanh toan; ExtensionCount = so lan gia han trong ky.
    WITH P AS (
        SELECT p.RentalId, p.Amount, p.PaidAt,
               CASE WHEN p.PaymentId = MIN(p.PaymentId) OVER (PARTITION BY p.RentalId) THEN 1 ELSE 0 END AS IsFirst
        FROM dbo.Payments p
        WHERE p.Status = 'Paid'
    )
    SELECT  pk.PackageId, pk.PackageName,
            SUM(P.IsFirst)                                           AS RentalCount,
            SUM(CASE WHEN P.IsFirst = 1 THEN rn.TrayCount ELSE 0 END) AS TrayCount,
            SUM(1 - P.IsFirst)                                       AS ExtensionCount,
            SUM(P.Amount)                                            AS Revenue
    FROM P
    JOIN dbo.Rentals rn        ON rn.RentalId = P.RentalId
    JOIN dbo.RentalPackages pk ON pk.PackageId = rn.PackageId
    WHERE P.PaidAt >= @FromDate
      AND P.PaidAt <  DATEADD(DAY, 1, @ToDate)
    GROUP BY ROLLUP ((pk.PackageId, pk.PackageName))
    ORDER BY GROUPING(pk.PackageId), Revenue DESC;
END;
GO

/* =====================================================================
   5. TRIGGER
   ===================================================================== */

-- UC28 + UC32 + BR10: Sau khi co du lieu cam bien moi
--   1) So voi nguong -> tao canh bao (khong tao trung neu da co canh bao chua xu ly)
--   2) Chi so tro lai binh thuong -> tu dong dong canh bao
--   3) Gui thong bao cho Admin/Operator va khach co khay trong phong
--   4) Tu dong bat/tat quat, phun suong, suoi (thiet bi o che do Auto)
CREATE OR ALTER TRIGGER dbo.trg_SensorReadings_AfterInsert
ON dbo.SensorReadings
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Chi xet lan do moi nhat cua moi phong trong lo du lieu vua insert
    WITH Latest AS (
        SELECT i.*, ROW_NUMBER() OVER (PARTITION BY i.RoomId ORDER BY i.RecordedAt DESC, i.ReadingId DESC) AS rn
        FROM inserted i
    )
    SELECT  l.ReadingId, l.RoomId, m.Metric, m.Value, th.MinValue, th.MaxValue,
            CASE WHEN m.Value < th.MinValue THEN 'Low'
                 WHEN m.Value > th.MaxValue THEN 'High'
                 ELSE 'Normal' END AS State
    INTO #Eval
    FROM Latest l
    CROSS APPLY (VALUES ('Temperature', CAST(l.Temperature AS DECIMAL(7,2))),
                        ('Humidity',    CAST(l.Humidity    AS DECIMAL(7,2))),
                        ('CO2',         CAST(l.CO2         AS DECIMAL(7,2)))) m(Metric, Value)
    JOIN dbo.EnvThresholds th ON th.RoomId = l.RoomId AND th.Metric = m.Metric
    WHERE l.rn = 1 AND m.Value IS NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM #Eval) RETURN;

    -- 2) Tu dong dong canh bao khi chi so binh thuong tro lai
    UPDATE a SET Status = 'Resolved', ResolvedAt = SYSDATETIME()
    FROM dbo.Alerts a
    JOIN #Eval e ON e.RoomId = a.RoomId AND e.Metric = a.Metric
    WHERE e.State = 'Normal' AND a.Status IN ('Open', 'Acknowledged');

    -- 1) Tao canh bao moi
    DECLARE @NewAlerts TABLE (AlertId INT, RoomId INT, Severity VARCHAR(10), Message NVARCHAR(500));

    INSERT INTO dbo.Alerts (RoomId, ReadingId, Metric, Value, Severity, Message)
    OUTPUT inserted.AlertId, inserted.RoomId, inserted.Severity, inserted.Message INTO @NewAlerts
    SELECT  e.RoomId, e.ReadingId, e.Metric, e.Value,
            CASE WHEN e.Value > e.MaxValue + 0.25 * (e.MaxValue - e.MinValue)
                   OR e.Value < e.MinValue - 0.25 * (e.MaxValue - e.MinValue)
                 THEN 'Critical' ELSE 'Warning' END,
            CONCAT(r.RoomName, N': ', dbo.fn_MetricName(e.Metric),
                   CASE e.State WHEN 'High' THEN N' cao' ELSE N' thấp' END,
                   N' (', CAST(e.Value AS DECIMAL(7,1)), N', ngưỡng ',
                   CAST(e.MinValue AS DECIMAL(7,1)), N' - ', CAST(e.MaxValue AS DECIMAL(7,1)), N')')
    FROM #Eval e
    JOIN dbo.Rooms r ON r.RoomId = e.RoomId
    WHERE e.State <> 'Normal'
      AND NOT EXISTS (SELECT 1 FROM dbo.Alerts a
                      WHERE a.RoomId = e.RoomId AND a.Metric = e.Metric
                        AND a.Status IN ('Open', 'Acknowledged'));

    -- 3) Thong bao
    INSERT INTO dbo.Notifications (UserId, Type, Title, Content, AlertId)
    SELECT  rcp.UserId, 'Alert',
            CASE n.Severity WHEN 'Critical' THEN N'⚠ Cảnh báo nghiêm trọng' ELSE N'Cảnh báo môi trường' END,
            n.Message, n.AlertId
    FROM @NewAlerts n
    CROSS APPLY (
        SELECT u.UserId
        FROM dbo.Users u JOIN dbo.Roles ro ON ro.RoleId = u.RoleId
        WHERE ro.RoleName IN ('Admin', 'Operator') AND u.Status = 'Active' AND u.IsDeleted = 0
        UNION
        SELECT rn.CustomerId
        FROM dbo.RentalTrays rt
        JOIN dbo.Rentals rn ON rn.RentalId = rt.RentalId
        JOIN dbo.Trays t    ON t.TrayId = rt.TrayId
        WHERE t.RoomId = n.RoomId AND rt.IsActive = 1 AND rt.IsLinked = 1
    ) rcp;

    -- 4) Dieu khien tu dong
    WITH S AS (
        -- ELSE '' + NULLIF de MAX khong gap NULL (tranh warning gui ve backend)
        SELECT RoomId,
               NULLIF(MAX(CASE WHEN Metric = 'Temperature' THEN State ELSE '' END), '') AS T,
               NULLIF(MAX(CASE WHEN Metric = 'Humidity'    THEN State ELSE '' END), '') AS H,
               NULLIF(MAX(CASE WHEN Metric = 'CO2'         THEN State ELSE '' END), '') AS C
        FROM #Eval GROUP BY RoomId
    ),
    Desired AS (
        SELECT d.DeviceId, d.IsOn,
               CASE d.DeviceType
                   WHEN 'MistSprayer' THEN CASE WHEN S.H IS NULL THEN NULL WHEN S.H = 'Low' THEN 1 ELSE 0 END
                   WHEN 'Heater'      THEN CASE WHEN S.T IS NULL THEN NULL WHEN S.T = 'Low' THEN 1 ELSE 0 END
                   WHEN 'Fan'         THEN CASE WHEN 'High' IN (S.T, S.H, S.C) THEN 1
                                                WHEN S.T IS NULL AND S.H IS NULL AND S.C IS NULL THEN NULL
                                                ELSE 0 END
               END AS WantOn,
               CASE d.DeviceType
                   WHEN 'MistSprayer' THEN N'Độ ẩm '
                   WHEN 'Heater'      THEN N'Nhiệt độ '
                   ELSE N'Nhiệt độ/độ ẩm/CO₂ ' END AS Topic
        FROM S JOIN dbo.Devices d ON d.RoomId = S.RoomId
        WHERE d.AutoMode = 1 AND d.Status = 'Online'
          AND d.DeviceType IN ('MistSprayer', 'Heater', 'Fan')
    )
    INSERT INTO dbo.DeviceCommands (DeviceId, Command, Source, Reason)
    SELECT DeviceId,
           CASE WantOn WHEN 1 THEN 'ON' ELSE 'OFF' END,
           'Auto',
           CONCAT(N'Tự động: ', Topic, CASE WantOn WHEN 1 THEN N'vượt ngưỡng' ELSE N'đã ổn định' END)
    FROM Desired
    WHERE WantOn IS NOT NULL AND WantOn <> IsOn;
END;
GO

-- Cap nhat trang thai bat/tat cua thiet bi theo lenh moi nhat.
-- Thiet bi gia lap coi nhu thuc thi ngay.
CREATE OR ALTER TRIGGER dbo.trg_DeviceCommands_AfterInsert
ON dbo.DeviceCommands
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    WITH LastCmd AS (
        SELECT i.DeviceId, i.Command,
               ROW_NUMBER() OVER (PARTITION BY i.DeviceId ORDER BY i.CreatedAt DESC, i.CommandId DESC) AS rn
        FROM inserted i
    )
    UPDATE d SET IsOn = CASE lc.Command WHEN 'ON' THEN 1 ELSE 0 END
    FROM dbo.Devices d JOIN LastCmd lc ON lc.DeviceId = d.DeviceId AND lc.rn = 1;

    UPDATE c SET Status = 'Executed'
    FROM dbo.DeviceCommands c
    JOIN inserted i  ON i.CommandId = c.CommandId
    JOIN dbo.Devices d ON d.DeviceId = c.DeviceId
    WHERE d.IsSimulated = 1;
END;
GO

-- UC35: Loc thong bao theo cau hinh truoc khi luu.
--   - Loai bi Admin tat toan he thong: khong gui cho ai
--   - Nguoi dung tu tat loai do: khong gui cho nguoi do
--   - Ngoai le: canh bao moi truong (Alert) luon gui cho Admin/Operator
CREATE OR ALTER TRIGGER dbo.trg_Notifications_InsteadOfInsert
ON dbo.Notifications
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.Notifications (UserId, Type, Title, Content, AlertId, TrayId, IsRead, CreatedAt)
    SELECT i.UserId, i.Type, i.Title, i.Content, i.AlertId, i.TrayId,
           ISNULL(i.IsRead, 0), ISNULL(i.CreatedAt, SYSDATETIME())
    FROM inserted i
    LEFT JOIN dbo.NotificationSettings s  ON s.Type = i.Type
    LEFT JOIN dbo.UserNotificationPrefs p ON p.UserId = i.UserId AND p.Type = i.Type
    WHERE (i.Type = 'Alert' AND dbo.fn_GetActiveUserRole(i.UserId) IN ('Admin', 'Operator'))
       OR (ISNULL(s.IsEnabled, 1) = 1 AND ISNULL(p.IsEnabled, 1) = 1);
END;
GO

-- BR12: Xoa tai khoan = xoa mem (giu lich su thue, thanh toan)
CREATE OR ALTER TRIGGER dbo.trg_Users_InsteadOfDelete
ON dbo.Users
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE u SET IsDeleted = 1, Status = 'Disabled', UpdatedAt = SYSDATETIME()
    FROM dbo.Users u JOIN deleted d ON d.UserId = u.UserId;
END;
GO

-- So khay trong phong khong vuot suc chua
CREATE OR ALTER TRIGGER dbo.trg_Trays_CheckRoomCapacity
ON dbo.Trays
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(RoomId) RETURN;

    IF EXISTS (SELECT 1
               FROM dbo.Rooms r
               WHERE r.RoomId IN (SELECT RoomId FROM inserted)
                 AND (SELECT COUNT(*) FROM dbo.Trays t WHERE t.RoomId = r.RoomId) > r.Capacity)
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50040, N'Số khay vượt quá sức chứa của phòng.', 1;
    END;
END;
GO

PRINT N'03_procedures_triggers.sql: xong';

GO

/* #####################################################################
   04_sample_data.sql
   ##################################################################### */
/* =====================================================================
   MushroomFarmDB
   04_sample_data.sql : Du lieu mau
   Chay ngay sau 01 -> 02 -> 03 (bang phai rong). Muon nap lai: chay lai tu 01.
   Phan cuoi goi cac procedure nghiep vu de tao du lieu thue / trong / thu hoach
   ===================================================================== */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO
USE MushroomFarmDB;
GO

IF EXISTS (SELECT 1 FROM dbo.Roles)
BEGIN
    RAISERROR(N'Database da co du lieu. Hay chay lai 01_create_tables.sql truoc.', 16, 1);
    SET NOEXEC ON;
END;
GO

/* ---------- Vai tro ---------- */
INSERT INTO dbo.Roles (RoleId, RoleName, Description) VALUES
(1, 'Admin',    N'Quản trị hệ thống'),
(2, 'Operator', N'Nhân viên vận hành trang trại'),
(3, 'Customer', N'Khách thuê khay nấm');

/* ---------- Nguoi dung ----------
   PasswordHash: bcrypt cua mat khau dev chung (xem database/README.md). */
INSERT INTO dbo.Users (RoleId, FullName, Email, Phone, PasswordHash, Address) VALUES
(1, N'Quản trị viên',     'admin@mushroomfarm.test',     '0900000001', '$2a$10$nqlP4esxH8QTj5inQtosV./KCBbuL9.oCjt.oa4yZmzCNqJSBMJXe', N'Trang trại nấm, Củ Chi, TP.HCM'),
(2, N'Nguyễn Văn Vận',    'operator1@mushroomfarm.test', '0900000002', '$2a$10$nqlP4esxH8QTj5inQtosV./KCBbuL9.oCjt.oa4yZmzCNqJSBMJXe', NULL),
(2, N'Trần Thị Hành',     'operator2@mushroomfarm.test', '0900000003', '$2a$10$nqlP4esxH8QTj5inQtosV./KCBbuL9.oCjt.oa4yZmzCNqJSBMJXe', NULL),
(3, N'Lê Minh An',        'an.le@example.test',          '0911111111', '$2a$10$nqlP4esxH8QTj5inQtosV./KCBbuL9.oCjt.oa4yZmzCNqJSBMJXe', N'12 Lê Lợi, Quận 1, TP.HCM'),
(3, N'Phạm Thu Bình',     'binh.pham@example.test',      '0922222222', '$2a$10$nqlP4esxH8QTj5inQtosV./KCBbuL9.oCjt.oa4yZmzCNqJSBMJXe', N'45 Nguyễn Trãi, Quận 5, TP.HCM'),
(3, N'Hoàng Gia Cường',   'cuong.hoang@example.test',    '0933333333', '$2a$10$nqlP4esxH8QTj5inQtosV./KCBbuL9.oCjt.oa4yZmzCNqJSBMJXe', N'78 Võ Văn Ngân, Thủ Đức, TP.HCM'),
(3, N'Đỗ Ngọc Dung',      'dung.do@example.test',        '0944444444', '$2a$10$nqlP4esxH8QTj5inQtosV./KCBbuL9.oCjt.oa4yZmzCNqJSBMJXe', N'9 Phan Xích Long, Phú Nhuận, TP.HCM'),
(3, N'Vũ Quốc Em',        'em.vu@example.test',          '0955555555', '$2a$10$nqlP4esxH8QTj5inQtosV./KCBbuL9.oCjt.oa4yZmzCNqJSBMJXe', NULL);

/* ---------- Cau hinh thong bao (UC35) ---------- */
INSERT INTO dbo.NotificationSettings (Type, DisplayName, UpdatedBy) VALUES
('Alert',        N'Cảnh báo môi trường',      1),
('Progress',     N'Tiến độ sinh trưởng',      1),
('HarvestReady', N'Sẵn sàng / đã thu hoạch',  1),
('Rental',       N'Thuê khay',                1),
('Delivery',     N'Giao nhận',                1),
('System',       N'Thông báo hệ thống',       1);

-- Khach Phạm Thu Bình tat thong bao tien do (chi nhan canh bao, thu hoach...)
INSERT INTO dbo.UserNotificationPrefs (UserId, Type, IsEnabled)
SELECT UserId, 'Progress', 0 FROM dbo.Users WHERE Email = 'binh.pham@example.test';

/* ---------- Loai nam ---------- */
INSERT INTO dbo.MushroomTypes (TypeName, GrowthDays, ExpectedYieldKg, Description) VALUES
(N'Nấm bào ngư',  28, 1.20, N'Dễ trồng, chu kỳ ngắn, ưa ẩm cao'),
(N'Nấm linh chi', 90, 0.30, N'Dược liệu, chu kỳ dài'),
(N'Nấm kim châm', 45, 1.00, N'Ưa lạnh, cần CO₂ thấp'),
(N'Nấm đùi gà',   50, 1.10, N'Thân to, giòn, giá trị cao');

/* ---------- Phong nuoi ---------- */
INSERT INTO dbo.Rooms (RoomCode, RoomName, Capacity, Description) VALUES
('R01', N'Phòng A - Bào ngư',  20, N'Phòng chính, gần khu đóng gói'),
('R02', N'Phòng B - Linh chi', 15, N'Phòng tối, kiểm soát nhiệt độ chặt'),
('R03', N'Phòng C - Kim châm', 15, N'Phòng lạnh');

/* ---------- Khay: R01 12 khay, R02 10 khay, R03 8 khay ---------- */
WITH TrayPlan AS (
    SELECT * FROM (VALUES ('R01', 12, N'Nấm bào ngư'),
                          ('R02', 10, N'Nấm linh chi'),
                          ('R03',  8, N'Nấm kim châm')) v(RoomCode, Qty, TypeName)
),
Nums AS (
    SELECT TOP (20) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n FROM sys.objects
)
INSERT INTO dbo.Trays (TrayCode, RoomId, MushroomTypeId, PositionLabel)
SELECT CONCAT('TRAY-', p.RoomCode, '-', FORMAT(n.n, '000')),
       r.RoomId, mt.MushroomTypeId,
       CONCAT(N'Kệ ', CHAR(64 + (n.n - 1) / 4 + 1), N' - Tầng ', (n.n - 1) % 4 + 1)
FROM TrayPlan p
JOIN Nums n               ON n.n <= p.Qty
JOIN dbo.Rooms r          ON r.RoomCode = p.RoomCode
JOIN dbo.MushroomTypes mt ON mt.TypeName = p.TypeName;

/* ---------- Nguong moi truong ---------- */
INSERT INTO dbo.EnvThresholds (RoomId, Metric, MinValue, MaxValue, UpdatedBy)
SELECT r.RoomId, v.Metric, v.MinV, v.MaxV, 1
FROM dbo.Rooms r
JOIN (VALUES
    ('R01', 'Temperature', 22, 28), ('R01', 'Humidity', 80, 95), ('R01', 'CO2', 400, 1000),
    ('R02', 'Temperature', 24, 30), ('R02', 'Humidity', 85, 95), ('R02', 'CO2', 400, 1500),
    ('R03', 'Temperature', 10, 16), ('R03', 'Humidity', 85, 95), ('R03', 'CO2', 400,  800)
) v(RoomCode, Metric, MinV, MaxV) ON v.RoomCode = r.RoomCode;

/* ---------- Thiet bi (tat ca gia lap) ---------- */
INSERT INTO dbo.Devices (DeviceCode, DeviceName, DeviceType, RoomId, StreamUrl)
SELECT CONCAT(v.Prefix, '-', r.RoomCode), CONCAT(v.Name, N' ', r.RoomCode), v.DeviceType, r.RoomId,
       CASE WHEN v.DeviceType = 'Camera'
            THEN CONCAT('http://localhost:8080/streams/', LOWER(r.RoomCode), '.mp4') END
FROM dbo.Rooms r
CROSS JOIN (VALUES ('SEN',   N'Cảm biến môi trường', 'Sensor'),
                   ('MIST',  N'Máy phun sương',      'MistSprayer'),
                   ('FAN',   N'Quạt thông gió',      'Fan'),
                   ('HEAT',  N'Máy sưởi',            'Heater'),
                   ('LIGHT', N'Đèn LED',             'GrowLight'),
                   ('CAM',   N'Camera',              'Camera')) v(Prefix, Name, DeviceType);

/* ---------- Goi thue ---------- */
INSERT INTO dbo.RentalPackages (PackageName, DurationDays, PricePerTray, MaxTrays, Description) VALUES
(N'Gói Trải nghiệm', 30, 150000,  2, N'Phù hợp người mới, 1 vụ nấm bào ngư'),
(N'Gói Tiêu chuẩn',  60, 250000,  5, N'Theo dõi trọn vụ, kèm thông báo tiến độ'),
(N'Gói Gia đình',   120, 350000, 10, N'Nhiều khay, đủ thời gian cho nấm chu kỳ dài như linh chi');
GO

/* =====================================================================
   CHAY NGHIEP VU MAU QUA PROCEDURE
   ===================================================================== */
DECLARE @Op1 INT = (SELECT UserId FROM dbo.Users WHERE Email = 'operator1@mushroomfarm.test');
DECLARE @An  INT = (SELECT UserId FROM dbo.Users WHERE Email = 'an.le@example.test');
DECLARE @Binh INT = (SELECT UserId FROM dbo.Users WHERE Email = 'binh.pham@example.test');
DECLARE @Cuong INT = (SELECT UserId FROM dbo.Users WHERE Email = 'cuong.hoang@example.test');
DECLARE @Dung INT = (SELECT UserId FROM dbo.Users WHERE Email = 'dung.do@example.test');
DECLARE @Rid INT;

-- Ket qua SELECT cua procedure duoc ghi vao bang tam de khong in ra man hinh
CREATE TABLE #Out (TrayId INT, TrayCode VARCHAR(20), RoomName NVARCHAR(100));

-- Thue online
INSERT INTO #Out EXEC dbo.usp_RentTrays @CustomerId = @An,    @PackageId = 1, @TrayCount = 2, @RoomId = 1, @RentalId = @Rid OUTPUT;
INSERT INTO #Out EXEC dbo.usp_RentTrays @CustomerId = @Binh,  @PackageId = 2, @TrayCount = 3, @RoomId = 1, @RentalId = @Rid OUTPUT;
INSERT INTO #Out EXEC dbo.usp_RentTrays @CustomerId = @Cuong, @PackageId = 3, @TrayCount = 2, @RoomId = 2, @PaymentMethod = 'BankTransfer', @RentalId = @Rid OUTPUT;

-- Thue tai trai: Operator gan khay, khach Dung lien ket 1 khay bang ma, khay con lai chua lien ket
EXEC dbo.usp_AssignTrayToCustomer @OperatorId = @Op1, @CustomerId = @Dung, @PackageId = 2, @TrayCode = 'TRAY-R03-001', @RentalId = @Rid OUTPUT;
EXEC dbo.usp_AssignTrayToCustomer @OperatorId = @Op1, @CustomerId = @Dung, @PackageId = 2, @TrayCode = 'TRAY-R03-002', @RentalId = @Rid OUTPUT;

CREATE TABLE #Linked (TrayId INT, TrayCode VARCHAR(20), RoomName NVARCHAR(100), TypeName NVARCHAR(100),
    Status VARCHAR(20), Stage VARCHAR(20), PlantedDate DATE, ExpectedHarvestDate DATE, DaysToHarvest INT,
    RentalId INT, RentalEndDate DATE, Temperature DECIMAL(5,2), Humidity DECIMAL(5,2), CO2 DECIMAL(7,1),
    EnvRecordedAt DATETIME2(0), CameraUrl VARCHAR(500));
INSERT INTO #Linked EXEC dbo.usp_LinkTrayByCode @CustomerId = @Dung, @TrayCode = 'TRAY-R03-001';

-- Bat dau trong cho cac khay da thue + vai khay cua trai
DECLARE @TrayId INT, @TypeId INT;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT TrayId, MushroomTypeId FROM dbo.Trays
    WHERE Status = 'Rented' OR TrayCode IN ('TRAY-R01-010', 'TRAY-R01-011', 'TRAY-R02-009');
OPEN cur;
FETCH NEXT FROM cur INTO @TrayId, @TypeId;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC dbo.usp_StartCultivation @TrayId = @TrayId, @MushroomTypeId = @TypeId, @OperatorId = @Op1;
    FETCH NEXT FROM cur INTO @TrayId, @TypeId;
END;
CLOSE cur; DEALLOCATE cur;

-- Lui ngay trong ve qua khu de du lieu giong thuc te (khay trong tu 5-30 ngay truoc)
UPDATE t
SET PlantedDate = DATEADD(DAY, -x.DaysAgo, CAST(SYSDATETIME() AS DATE)),
    ExpectedHarvestDate = dbo.fn_CalcExpectedHarvestDate(DATEADD(DAY, -x.DaysAgo, CAST(SYSDATETIME() AS DATE)), t.MushroomTypeId)
FROM dbo.Trays t
CROSS APPLY (SELECT CASE t.TrayCode
                        WHEN 'TRAY-R01-001' THEN 28 WHEN 'TRAY-R01-002' THEN 20
                        WHEN 'TRAY-R01-003' THEN 14 WHEN 'TRAY-R01-004' THEN 10
                        WHEN 'TRAY-R01-010' THEN 29 WHEN 'TRAY-R01-011' THEN 25
                        ELSE 5 END AS DaysAgo) x
WHERE t.Status = 'Growing';

-- Cap nhat giai doan
DECLARE @T1 INT = (SELECT TrayId FROM dbo.Trays WHERE TrayCode = 'TRAY-R01-001');
DECLARE @T2 INT = (SELECT TrayId FROM dbo.Trays WHERE TrayCode = 'TRAY-R01-002');
DECLARE @T3 INT = (SELECT TrayId FROM dbo.Trays WHERE TrayCode = 'TRAY-R01-003');
DECLARE @T10 INT = (SELECT TrayId FROM dbo.Trays WHERE TrayCode = 'TRAY-R01-010');
DECLARE @T11 INT = (SELECT TrayId FROM dbo.Trays WHERE TrayCode = 'TRAY-R01-011');

EXEC dbo.usp_UpdateTrayStage @T1, 'Incubation', @Op1, N'Tơ nấm lan đều';
EXEC dbo.usp_UpdateTrayStage @T1, 'Pinning',    @Op1, N'Xuất hiện nhiều nụ';
EXEC dbo.usp_UpdateTrayStage @T1, 'Fruiting',   @Op1, N'Quả thể phát triển tốt';
EXEC dbo.usp_UpdateTrayStage @T1, 'Harvest',    @Op1, N'Mũ nấm đạt kích thước';
EXEC dbo.usp_UpdateTrayStage @T2, 'Incubation', @Op1;
EXEC dbo.usp_UpdateTrayStage @T2, 'Pinning',    @Op1, N'Nụ nhỏ, đều';
EXEC dbo.usp_UpdateTrayStage @T3, 'Incubation', @Op1;
EXEC dbo.usp_UpdateTrayStage @T10, 'Incubation', @Op1;
EXEC dbo.usp_UpdateTrayStage @T10, 'Pinning',    @Op1;
EXEC dbo.usp_UpdateTrayStage @T10, 'Fruiting',   @Op1;
EXEC dbo.usp_UpdateTrayStage @T10, 'Harvest',    @Op1;
EXEC dbo.usp_UpdateTrayStage @T11, 'Incubation', @Op1;
EXEC dbo.usp_UpdateTrayStage @T11, 'Pinning',    @Op1;
EXEC dbo.usp_UpdateTrayStage @T11, 'Fruiting',   @Op1;
EXEC dbo.usp_UpdateTrayStage @T11, 'Harvest',    @Op1;

-- Thu hoach: khay cua khach An va 1 khay cua trai
CREATE TABLE #H (HarvestId INT);
INSERT INTO #H EXEC dbo.usp_RecordHarvest @TrayId = @T1,  @WeightKg = 1.35, @Quality = 'A', @OperatorId = @Op1;
INSERT INTO #H EXEC dbo.usp_RecordHarvest @TrayId = @T10, @WeightKg = 1.10, @Quality = 'B', @OperatorId = @Op1;

-- Khach An yeu cau giao tan noi
DECLARE @HarvestId INT = (SELECT HarvestId FROM dbo.Harvests WHERE TrayId = @T1 AND Status = 'Completed');
DECLARE @Req INT;
EXEC dbo.usp_RequestDelivery @CustomerId = @An, @HarvestId = @HarvestId, @RequestType = 'Delivery', @RequestId = @Req OUTPUT;

-- Lui ngay thanh toan cua 2 don dau ve cac thang truoc de bao cao doanh thu co nhieu thang
UPDATE dbo.Payments SET PaidAt = DATEADD(MONTH, -2, PaidAt) WHERE RentalId = 1;
UPDATE dbo.Payments SET PaidAt = DATEADD(MONTH, -1, PaidAt) WHERE RentalId = 2;

-- Gia lap IoT: 48 lan do, moi lan cach 30 phut (24 gio), 8% bat thuong
EXEC dbo.usp_SimulateSensorData @Rounds = 48, @IntervalMinutes = 30, @AnomalyPercent = 8;

DROP TABLE #Out, #Linked, #H;
GO

SET NOEXEC OFF;
GO
PRINT N'04_sample_data.sql: xong';

GO

/* #####################################################################
   05_security.sql
   ##################################################################### */
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

-- Chi duoc xoa o nhung bang it rui ro (Users co trigger xoa mem).
-- Bang danh muc: khoa ngoai van chan xoa du lieu dang duoc tham chieu.
GRANT DELETE ON dbo.Notifications         TO rl_backend;
GRANT DELETE ON dbo.UserNotificationPrefs TO rl_backend;
GRANT DELETE ON dbo.Users                 TO rl_backend;
GRANT DELETE ON dbo.Rooms                 TO rl_backend;
GRANT DELETE ON dbo.EnvThresholds         TO rl_backend;
GRANT DELETE ON dbo.Trays                 TO rl_backend;
GRANT DELETE ON dbo.MushroomTypes         TO rl_backend;
GRANT DELETE ON dbo.Devices               TO rl_backend;

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
