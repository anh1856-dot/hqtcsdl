// API cho thiet bi IoT (that hoac chuong trinh gia lap) - xac thuc bang header x-device-key
const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize, requireDeviceKey } = require('../middlewares/auth');
const { asyncHandler } = require('../utils/http');
const { requireFields, toInt, toNumber } = require('../utils/validate');

// GET /api/sensors/config - danh sach cam bien + nguong + trang thai thiet bi trong phong
router.get('/config', requireDeviceKey, asyncHandler(async (req, res) => {
  const [sensors, thresholds, actuators] = await db.queryMulti(
    `SELECT d.DeviceCode, d.RoomId, r.RoomCode, d.Status FROM dbo.Devices d JOIN dbo.Rooms r ON r.RoomId = d.RoomId
     WHERE d.DeviceType = 'Sensor' AND d.Status <> 'Offline' ORDER BY r.RoomCode;
     SELECT RoomId, Metric, MinValue, MaxValue FROM dbo.EnvThresholds;
     SELECT DeviceCode, RoomId, DeviceType, IsOn FROM dbo.Devices
     WHERE DeviceType IN ('MistSprayer', 'Fan', 'Heater', 'GrowLight');`
  );
  res.json({
    data: sensors.map((s) => ({
      ...s,
      thresholds: thresholds.filter((t) => t.RoomId === s.RoomId),
      actuators: actuators.filter((a) => a.RoomId === s.RoomId),
    })),
  });
}));

// POST /api/sensors/readings { deviceCode, temperature?, humidity?, co2? }
// Trigger trong DB tu tao canh bao + bat/tat thiet bi. Tra ve trang thai thiet bi de mo phong phan ung.
router.post('/readings', requireDeviceKey, asyncHandler(async (req, res) => {
  requireFields(req.body, ['deviceCode']);
  const deviceCode = String(req.body.deviceCode).trim().toUpperCase();
  const { recordset } = await db.exec('dbo.usp_InsertSensorReading', {
    DeviceCode: deviceCode,
    Temperature: toNumber(req.body.temperature, 'temperature', { min: -20, max: 80, optional: true }),
    Humidity: toNumber(req.body.humidity, 'humidity', { min: 0, max: 100, optional: true }),
    CO2: toNumber(req.body.co2, 'co2', { min: 0, max: 100000, optional: true }),
  });
  const actuators = await db.query(
    `SELECT a.DeviceCode, a.DeviceType, a.IsOn, a.AutoMode
     FROM dbo.Devices a JOIN dbo.Devices s ON s.RoomId = a.RoomId
     WHERE s.DeviceCode = @code AND a.DeviceType IN ('MistSprayer', 'Fan', 'Heater', 'GrowLight')`,
    { code: deviceCode }
  );
  res.status(201).json({ data: { readingId: recordset[0].ReadingId, actuators } });
}));

// POST /api/sensors/simulate (Admin) { rounds?, intervalMinutes?, anomalyPercent? }
// Sinh nhanh du lieu gia lap ngay trong SQL Server (usp_SimulateSensorData)
router.post('/simulate', authenticate, authorize('Admin'), asyncHandler(async (req, res) => {
  await db.exec('dbo.usp_SimulateSensorData', {
    Rounds: toInt(req.body.rounds ?? 1, 'rounds', { min: 1, max: 500 }),
    IntervalMinutes: toInt(req.body.intervalMinutes ?? 5, 'intervalMinutes', { min: 1 }),
    AnomalyPercent: toInt(req.body.anomalyPercent ?? 10, 'anomalyPercent', { min: 0, max: 100 }),
  });
  res.json({ data: { message: 'Đã sinh dữ liệu cảm biến giả lập.' } });
}));

module.exports = router;
