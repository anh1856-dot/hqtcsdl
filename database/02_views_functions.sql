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
