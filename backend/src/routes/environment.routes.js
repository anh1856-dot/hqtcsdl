const router = require('express').Router();
const db = require('../config/db');
const { authenticate, isStaff } = require('../middlewares/auth');
const { forbidden, asyncHandler } = require('../utils/http');
const { toInt, oneOf } = require('../utils/validate');

router.use(authenticate);

// Khach chi xem duoc phong co khay minh dang thue (da lien ket)
async function canViewRoom(user, roomId) {
  if (isStaff(user)) return true;
  const row = await db.queryOne(
    `SELECT TOP (1) 1 AS ok
     FROM dbo.RentalTrays rt
     JOIN dbo.Rentals rn ON rn.RentalId = rt.RentalId
     JOIN dbo.Trays t ON t.TrayId = rt.TrayId
     WHERE rt.IsActive = 1 AND rt.IsLinked = 1 AND rn.CustomerId = @userId AND t.RoomId = @roomId`,
    { userId: user.id, roomId }
  );
  return !!row;
}

// GET /api/environment - moi truong moi nhat tung phong (kem nguong va trang thai Low/Normal/High)
router.get('/', asyncHandler(async (req, res) => {
  const rows = await db.query(
    `SELECT e.* FROM dbo.vw_RoomLatestEnvironment e
     WHERE @customerId IS NULL OR e.RoomId IN (
        SELECT t.RoomId FROM dbo.RentalTrays rt
        JOIN dbo.Rentals rn ON rn.RentalId = rt.RentalId
        JOIN dbo.Trays t ON t.TrayId = rt.TrayId
        WHERE rt.IsActive = 1 AND rt.IsLinked = 1 AND rn.CustomerId = @customerId)
     ORDER BY e.RoomCode`,
    { customerId: isStaff(req.user) ? null : req.user.id }
  );
  res.json({ data: rows });
}));

// GET /api/environment/:roomId/history?hours=24&groupBy=none|hour|day
// Du lieu ve bieu do. groupBy=hour/day tra ve gia tri trung binh
router.get('/:roomId/history', asyncHandler(async (req, res) => {
  const roomId = toInt(req.params.roomId, 'roomId');
  if (!(await canViewRoom(req.user, roomId))) throw forbidden('Bạn không có khay trong phòng này.');

  const hours = toInt(req.query.hours ?? 24, 'hours', { min: 1, max: 24 * 90 });
  const groupBy = oneOf(req.query.groupBy, ['none', 'hour', 'day'], 'groupBy', { optional: true }) || 'none';

  const bucket = {
    none: 'RecordedAt',
    hour: 'DATEADD(HOUR, DATEDIFF(HOUR, 0, RecordedAt), 0)',
    day: 'CAST(CAST(RecordedAt AS DATE) AS DATETIME2(0))',
  }[groupBy];

  const rows = await db.query(
    `SELECT TOP (2000) ${bucket} AS [Time],
            CAST(AVG(Temperature) AS DECIMAL(5,2)) AS Temperature,
            CAST(AVG(Humidity) AS DECIMAL(5,2))    AS Humidity,
            CAST(AVG(CO2) AS DECIMAL(7,1))         AS CO2
     FROM dbo.SensorReadings
     WHERE RoomId = @roomId AND RecordedAt >= DATEADD(HOUR, -@hours, SYSDATETIME())
     GROUP BY ${bucket}
     ORDER BY [Time]`,
    { roomId, hours }
  );
  res.json({ data: rows });
}));

module.exports = router;
