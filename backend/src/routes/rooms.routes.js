const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middlewares/auth');
const { badRequest, notFound, conflict, asyncHandler } = require('../utils/http');
const { requireFields, toInt, toNumber, oneOf } = require('../utils/validate');

const METRICS = ['Temperature', 'Humidity', 'CO2'];

router.use(authenticate, authorize('Admin', 'Operator'));

// GET /api/rooms - danh sach phong + thong ke khay
router.get('/', asyncHandler(async (req, res) => {
  const rows = await db.query(
    `SELECT r.RoomId, r.RoomCode, r.RoomName, r.Capacity, r.Description, r.Status, r.CreatedAt,
            COUNT(t.TrayId) AS TrayCount,
            SUM(CASE WHEN t.Status = 'Available' THEN 1 ELSE 0 END) AS AvailableTrays,
            SUM(CASE WHEN t.Status IN ('Rented', 'Growing', 'ReadyToHarvest', 'Harvested') THEN 1 ELSE 0 END) AS InUseTrays
     FROM dbo.Rooms r
     LEFT JOIN dbo.Trays t ON t.RoomId = r.RoomId
     GROUP BY r.RoomId, r.RoomCode, r.RoomName, r.Capacity, r.Description, r.Status, r.CreatedAt
     ORDER BY r.RoomCode`
  );
  res.json({ data: rows });
}));

// GET /api/rooms/:id - chi tiet phong: nguong, thiet bi, moi truong moi nhat
router.get('/:id', asyncHandler(async (req, res) => {
  const [rooms, thresholds, devices, env] = await db.queryMulti(
    `SELECT RoomId, RoomCode, RoomName, Capacity, Description, Status, CreatedAt FROM dbo.Rooms WHERE RoomId = @id;
     SELECT Metric, MinValue, MaxValue, UpdatedAt FROM dbo.EnvThresholds WHERE RoomId = @id;
     SELECT DeviceId, DeviceCode, DeviceName, DeviceType, Status, IsOn, AutoMode FROM dbo.Devices WHERE RoomId = @id ORDER BY DeviceType;
     SELECT Temperature, Humidity, CO2, RecordedAt, TempState, HumState, CO2State
     FROM dbo.vw_RoomLatestEnvironment WHERE RoomId = @id;`,
    { id: req.params.id }
  );
  if (!rooms.length) throw notFound('Không tìm thấy phòng.');
  res.json({ data: { ...rooms[0], thresholds, devices, environment: env[0] || null } });
}));

// POST /api/rooms
router.post('/', asyncHandler(async (req, res) => {
  requireFields(req.body, ['roomCode', 'roomName', 'capacity']);
  const room = await db.queryOne(
    `INSERT INTO dbo.Rooms (RoomCode, RoomName, Capacity, Description, Status)
     OUTPUT inserted.*
     VALUES (@roomCode, @roomName, @capacity, @description, @status)`,
    {
      roomCode: String(req.body.roomCode).trim().toUpperCase(),
      roomName: req.body.roomName,
      capacity: toInt(req.body.capacity, 'capacity', { min: 1 }),
      description: req.body.description || null,
      status: oneOf(req.body.status, ['Active', 'Maintenance', 'Inactive'], 'status', { optional: true }) || 'Active',
    }
  );
  res.status(201).json({ data: room });
}));

// PUT /api/rooms/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const capacity = toInt(req.body.capacity, 'capacity', { min: 1, optional: true });
  if (capacity !== null) {
    const used = await db.queryOne('SELECT COUNT(*) AS n FROM dbo.Trays WHERE RoomId = @id', { id: req.params.id });
    if (used.n > capacity) throw conflict(`Phòng đang có ${used.n} khay, sức chứa không được nhỏ hơn số này.`);
  }
  const room = await db.queryOne(
    `UPDATE dbo.Rooms
     SET RoomName    = COALESCE(@roomName, RoomName),
         Capacity    = COALESCE(@capacity, Capacity),
         Description = CASE WHEN @setDesc = 1 THEN @description ELSE Description END,
         Status      = COALESCE(@status, Status)
     OUTPUT inserted.*
     WHERE RoomId = @id`,
    {
      id: req.params.id,
      roomName: req.body.roomName || null,
      capacity,
      setDesc: req.body.description !== undefined ? 1 : 0,
      description: req.body.description || null,
      status: oneOf(req.body.status, ['Active', 'Maintenance', 'Inactive'], 'status', { optional: true }),
    }
  );
  if (!room) throw notFound('Không tìm thấy phòng.');
  res.json({ data: room });
}));

// DELETE /api/rooms/:id - chi xoa duoc phong chua co khay, thiet bi, du lieu
router.delete('/:id', authorize('Admin'), asyncHandler(async (req, res) => {
  const room = await db.queryOne('SELECT RoomId FROM dbo.Rooms WHERE RoomId = @id', { id: req.params.id });
  if (!room) throw notFound('Không tìm thấy phòng.');
  const trays = await db.queryOne('SELECT COUNT(*) AS n FROM dbo.Trays WHERE RoomId = @id', { id: req.params.id });
  if (trays.n) throw conflict('Phòng đang có khay, không thể xóa. Hãy chuyển trạng thái phòng sang Inactive.');
  await db.query(
    `DELETE FROM dbo.EnvThresholds WHERE RoomId = @id;
     DELETE FROM dbo.Rooms WHERE RoomId = @id;`,
    { id: req.params.id }
  );
  res.status(204).end();
}));

// GET /api/rooms/:id/thresholds
router.get('/:id/thresholds', asyncHandler(async (req, res) => {
  const rows = await db.query(
    'SELECT Metric, MinValue, MaxValue, UpdatedBy, UpdatedAt FROM dbo.EnvThresholds WHERE RoomId = @id',
    { id: req.params.id }
  );
  res.json({ data: rows });
}));

// PUT /api/rooms/:id/thresholds  [{ metric, minValue, maxValue }, ...]  (Admin)
router.put('/:id/thresholds', authorize('Admin'), asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body.thresholds;
  if (!Array.isArray(items) || !items.length) throw badRequest('Cần gửi mảng ngưỡng [{ metric, minValue, maxValue }].');

  const room = await db.queryOne('SELECT RoomId FROM dbo.Rooms WHERE RoomId = @id', { id: req.params.id });
  if (!room) throw notFound('Không tìm thấy phòng.');

  for (const item of items) {
    const metric = oneOf(item.metric, METRICS, 'metric');
    const minValue = toNumber(item.minValue, 'minValue');
    const maxValue = toNumber(item.maxValue, 'maxValue');
    if (minValue >= maxValue) throw badRequest(`Ngưỡng ${metric}: minValue phải nhỏ hơn maxValue.`);
    await db.query(
      `MERGE dbo.EnvThresholds AS t
       USING (SELECT @roomId AS RoomId, @metric AS Metric) AS s
          ON t.RoomId = s.RoomId AND t.Metric = s.Metric
       WHEN MATCHED THEN UPDATE SET MinValue = @minValue, MaxValue = @maxValue, UpdatedBy = @userId, UpdatedAt = SYSDATETIME()
       WHEN NOT MATCHED THEN INSERT (RoomId, Metric, MinValue, MaxValue, UpdatedBy)
                             VALUES (@roomId, @metric, @minValue, @maxValue, @userId);`,
      { roomId: req.params.id, metric, minValue, maxValue, userId: req.user.id }
    );
  }
  const rows = await db.query('SELECT Metric, MinValue, MaxValue, UpdatedAt FROM dbo.EnvThresholds WHERE RoomId = @id', { id: req.params.id });
  res.json({ data: rows });
}));

module.exports = router;
