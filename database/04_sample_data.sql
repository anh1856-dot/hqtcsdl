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
   PasswordHash: gia tri tam. Backend tao lai bang bcrypt khi seed tai khoan that. */
INSERT INTO dbo.Users (RoleId, FullName, Email, Phone, PasswordHash, Address) VALUES
(1, N'Quản trị viên',     'admin@mushroomfarm.test',     '0900000001', 'CHANGE_ME_BCRYPT_HASH', N'Trang trại nấm, Củ Chi, TP.HCM'),
(2, N'Nguyễn Văn Vận',    'operator1@mushroomfarm.test', '0900000002', 'CHANGE_ME_BCRYPT_HASH', NULL),
(2, N'Trần Thị Hành',     'operator2@mushroomfarm.test', '0900000003', 'CHANGE_ME_BCRYPT_HASH', NULL),
(3, N'Lê Minh An',        'an.le@example.test',          '0911111111', 'CHANGE_ME_BCRYPT_HASH', N'12 Lê Lợi, Quận 1, TP.HCM'),
(3, N'Phạm Thu Bình',     'binh.pham@example.test',      '0922222222', 'CHANGE_ME_BCRYPT_HASH', N'45 Nguyễn Trãi, Quận 5, TP.HCM'),
(3, N'Hoàng Gia Cường',   'cuong.hoang@example.test',    '0933333333', 'CHANGE_ME_BCRYPT_HASH', N'78 Võ Văn Ngân, Thủ Đức, TP.HCM'),
(3, N'Đỗ Ngọc Dung',      'dung.do@example.test',        '0944444444', 'CHANGE_ME_BCRYPT_HASH', N'9 Phan Xích Long, Phú Nhuận, TP.HCM'),
(3, N'Vũ Quốc Em',        'em.vu@example.test',          '0955555555', 'CHANGE_ME_BCRYPT_HASH', NULL);

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
(N'Gói Gia đình',    90, 350000, 10, N'Nhiều khay, phù hợp nấm chu kỳ dài');
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
