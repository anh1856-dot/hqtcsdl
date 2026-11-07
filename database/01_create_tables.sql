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
