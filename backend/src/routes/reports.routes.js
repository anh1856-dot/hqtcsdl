// Bao cao, thong ke. Them ?format=csv de tai file Excel (CSV)
const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middlewares/auth');
const { asyncHandler } = require('../utils/http');
const { toInt, toDate } = require('../utils/validate');
const { sendRows } = require('../utils/csv');

router.use(authenticate);

function dateRange(query) {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfYear = `${today.slice(0, 4)}-01-01`;
  return {
    from: toDate(query.from, 'from', { optional: true }) || firstOfYear,
    to: toDate(query.to, 'to', { optional: true }) || today,
  };
}

// GET /api/reports/dashboard (Admin, Operator) - so lieu tong quan
router.get('/dashboard', authorize('Admin', 'Operator'), asyncHandler(async (req, res) => {
  const [summary, trays, env, alerts] = await db.queryMulti(
    `DECLARE @MonthStart DATE = DATEFROMPARTS(YEAR(SYSDATETIME()), MONTH(SYSDATETIME()), 1);
     SELECT
       (SELECT COUNT(*) FROM dbo.Rentals WHERE Status = 'Active') AS ActiveRentals,
       (SELECT COUNT(*) FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId = u.RoleId
         WHERE r.RoleName = 'Customer' AND u.IsDeleted = 0) AS Customers,
       (SELECT COUNT(*) FROM dbo.Alerts WHERE Status IN ('Open', 'Acknowledged')) AS OpenAlerts,
       (SELECT ISNULL(SUM(Amount), 0) FROM dbo.Payments WHERE Status = 'Paid' AND PaidAt >= @MonthStart) AS RevenueThisMonth,
       (SELECT ISNULL(SUM(WeightKg), 0) FROM dbo.Harvests WHERE Status = 'Completed' AND HarvestedAt >= @MonthStart) AS HarvestKgThisMonth,
       (SELECT COUNT(*) FROM dbo.Harvests WHERE Status = 'Scheduled') AS PendingHarvests,
       (SELECT COUNT(*) FROM dbo.DeliveryRequests WHERE Status IN ('Pending', 'Confirmed', 'Shipping')) AS PendingDeliveries;
     SELECT Status, COUNT(*) AS Count FROM dbo.Trays GROUP BY Status;
     SELECT RoomId, RoomCode, RoomName, Temperature, Humidity, CO2, RecordedAt, TempState, HumState, CO2State
     FROM dbo.vw_RoomLatestEnvironment ORDER BY RoomCode;
     SELECT TOP (5) a.AlertId, r.RoomName, a.Metric, a.Value, a.Severity, a.Message, a.CreatedAt
     FROM dbo.Alerts a JOIN dbo.Rooms r ON r.RoomId = a.RoomId
     WHERE a.Status IN ('Open', 'Acknowledged') ORDER BY a.AlertId DESC;`
  );
  res.json({ data: { ...summary[0], traysByStatus: trays, environment: env, latestAlerts: alerts } });
}));

// Cac bao cao chi tiet: chi Admin
router.use(authorize('Admin'));

// GET /api/reports/revenue?from=&to= - doanh thu theo goi (dong cuoi PackageId = null la tong)
router.get('/revenue', asyncHandler(async (req, res) => {
  const { from, to } = dateRange(req.query);
  const { recordset } = await db.exec('dbo.usp_RevenueReport', { FromDate: from, ToDate: to });
  sendRows(req, res, recordset, `doanh-thu_${from}_${to}`);
}));

// GET /api/reports/revenue/monthly
router.get('/revenue/monthly', asyncHandler(async (req, res) => {
  const rows = await db.query('SELECT * FROM dbo.vw_MonthlyRevenue ORDER BY [Year], [Month]');
  sendRows(req, res, rows, 'doanh-thu-theo-thang');
}));

// GET /api/reports/harvests - san luong theo thang va loai nam
router.get('/harvests', asyncHandler(async (req, res) => {
  const rows = await db.query('SELECT * FROM dbo.vw_HarvestSummary ORDER BY [Year], [Month], TypeName');
  sendRows(req, res, rows, 'san-luong-thu-hoach');
}));

// GET /api/reports/rentals?from=&to= - danh sach don thue
router.get('/rentals', asyncHandler(async (req, res) => {
  const { from, to } = dateRange(req.query);
  const rows = await db.query(
    `SELECT rn.RentalId, u.FullName AS CustomerName, u.Email, p.PackageName, rn.TrayCount, rn.TotalAmount,
            rn.StartDate, rn.EndDate, rn.Status, rn.CreatedAt
     FROM dbo.Rentals rn
     JOIN dbo.Users u ON u.UserId = rn.CustomerId
     JOIN dbo.RentalPackages p ON p.PackageId = rn.PackageId
     WHERE rn.CreatedAt >= @from AND rn.CreatedAt < DATEADD(DAY, 1, CAST(@to AS DATE))
     ORDER BY rn.RentalId`,
    { from, to }
  );
  sendRows(req, res, rows, `don-thue_${from}_${to}`);
}));

// GET /api/reports/environment?roomId=&from=&to= - trung binh / min / max moi truong theo ngay
router.get('/environment', asyncHandler(async (req, res) => {
  const { from, to } = dateRange(req.query);
  const rows = await db.query(
    `SELECT r.RoomCode, r.RoomName, CAST(s.RecordedAt AS DATE) AS [Date],
            CAST(AVG(s.Temperature) AS DECIMAL(5,2)) AS AvgTemperature,
            MIN(s.Temperature) AS MinTemperature, MAX(s.Temperature) AS MaxTemperature,
            CAST(AVG(s.Humidity) AS DECIMAL(5,2)) AS AvgHumidity,
            CAST(AVG(s.CO2) AS DECIMAL(7,1)) AS AvgCO2, MAX(s.CO2) AS MaxCO2,
            COUNT(*) AS Readings,
            (SELECT COUNT(*) FROM dbo.Alerts a WHERE a.RoomId = r.RoomId
               AND CAST(a.CreatedAt AS DATE) = CAST(s.RecordedAt AS DATE)) AS Alerts
     FROM dbo.SensorReadings s JOIN dbo.Rooms r ON r.RoomId = s.RoomId
     WHERE (@roomId IS NULL OR s.RoomId = @roomId)
       AND s.RecordedAt >= @from AND s.RecordedAt < DATEADD(DAY, 1, CAST(@to AS DATE))
     GROUP BY r.RoomId, r.RoomCode, r.RoomName, CAST(s.RecordedAt AS DATE)
     ORDER BY r.RoomCode, [Date]`,
    { roomId: toInt(req.query.roomId, 'roomId', { optional: true }), from, to }
  );
  sendRows(req, res, rows, `moi-truong_${from}_${to}`);
}));

module.exports = router;
