const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middlewares/auth');
const { notFound, asyncHandler, getPaging, paged } = require('../utils/http');
const { requireFields, toInt, oneOf, toBool } = require('../utils/validate');

const TYPES = ['Sensor', 'MistSprayer', 'Fan', 'Heater', 'GrowLight', 'Camera'];

const DEVICE_SQL = `
  SELECT v.*, d.RoomId, d.TrayId, d.StreamUrl
  FROM dbo.vw_DeviceStatus v JOIN dbo.Devices d ON d.DeviceId = v.DeviceId`;

router.use(authenticate, authorize('Admin', 'Operator'));

// GET /api/devices?roomId=&type=
router.get('/', asyncHandler(async (req, res) => {
  const rows = await db.query(
    `${DEVICE_SQL}
     WHERE (@roomId IS NULL OR d.RoomId = @roomId) AND (@type IS NULL OR v.DeviceType = @type)
     ORDER BY v.RoomCode, v.DeviceType`,
    {
      roomId: toInt(req.query.roomId, 'roomId', { optional: true }),
      type: oneOf(req.query.type, TYPES, 'type', { optional: true }),
    }
  );
  res.json({ data: rows });
}));

// GET /api/devices/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const row = await db.queryOne(`${DEVICE_SQL} WHERE v.DeviceId = @id`, { id: req.params.id });
  if (!row) throw notFound('Không tìm thấy thiết bị.');
  res.json({ data: row });
}));

// POST /api/devices (Admin) { deviceCode, deviceName, deviceType, roomId, trayId?, streamUrl?, isSimulated? }
router.post('/', authorize('Admin'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['deviceCode', 'deviceName', 'deviceType', 'roomId']);
  const created = await db.queryOne(
    `INSERT INTO dbo.Devices (DeviceCode, DeviceName, DeviceType, RoomId, TrayId, StreamUrl, IsSimulated)
     OUTPUT inserted.DeviceId
     VALUES (@code, @name, @type, @roomId, @trayId, @streamUrl, @isSimulated)`,
    {
      code: String(req.body.deviceCode).trim().toUpperCase(),
      name: req.body.deviceName,
      type: oneOf(req.body.deviceType, TYPES, 'deviceType'),
      roomId: toInt(req.body.roomId, 'roomId'),
      trayId: toInt(req.body.trayId, 'trayId', { optional: true }),
      streamUrl: req.body.streamUrl || null,
      isSimulated: req.body.isSimulated === undefined ? true : toBool(req.body.isSimulated, 'isSimulated'),
    }
  );
  res.status(201).json({ data: await db.queryOne(`${DEVICE_SQL} WHERE v.DeviceId = @id`, { id: created.DeviceId }) });
}));

// PUT /api/devices/:id (Admin) { deviceName?, roomId?, trayId?, streamUrl?, status? }
router.put('/:id', authorize('Admin'), asyncHandler(async (req, res) => {
  const result = await db.queryOne(
    `UPDATE dbo.Devices
     SET DeviceName = COALESCE(@name, DeviceName),
         RoomId     = COALESCE(@roomId, RoomId),
         TrayId     = CASE WHEN @setTray = 1 THEN @trayId ELSE TrayId END,
         StreamUrl  = CASE WHEN @setStream = 1 THEN @streamUrl ELSE StreamUrl END,
         Status     = COALESCE(@status, Status)
     WHERE DeviceId = @id;
     SELECT @@ROWCOUNT AS Affected;`,
    {
      id: req.params.id,
      name: req.body.deviceName || null,
      roomId: toInt(req.body.roomId, 'roomId', { optional: true }),
      setTray: req.body.trayId !== undefined ? 1 : 0,
      trayId: toInt(req.body.trayId, 'trayId', { optional: true }),
      setStream: req.body.streamUrl !== undefined ? 1 : 0,
      streamUrl: req.body.streamUrl || null,
      status: oneOf(req.body.status, ['Online', 'Offline', 'Error'], 'status', { optional: true }),
    }
  );
  if (!result.Affected) throw notFound('Không tìm thấy thiết bị.');
  res.json({ data: await db.queryOne(`${DEVICE_SQL} WHERE v.DeviceId = @id`, { id: req.params.id }) });
}));

// DELETE /api/devices/:id (Admin) - 409 neu da co du lieu; khi do nen chuyen Status = Offline
router.delete('/:id', authorize('Admin'), asyncHandler(async (req, res) => {
  const result = await db.queryOne('DELETE FROM dbo.Devices WHERE DeviceId = @id; SELECT @@ROWCOUNT AS Affected;', { id: req.params.id });
  if (!result.Affected) throw notFound('Không tìm thấy thiết bị.');
  res.status(204).end();
}));

// POST /api/devices/:id/control { command: 'ON'|'OFF', reason? } - bat/tat thu cong (tat che do tu dong)
router.post('/:id/control', asyncHandler(async (req, res) => {
  await db.exec('dbo.usp_ControlDevice', {
    DeviceId: toInt(req.params.id, 'id'),
    Command: oneOf(req.body.command, ['ON', 'OFF'], 'command'),
    UserId: req.user.id,
    Reason: req.body.reason || null,
  });
  res.json({ data: await db.queryOne(`${DEVICE_SQL} WHERE v.DeviceId = @id`, { id: req.params.id }) });
}));

// PATCH /api/devices/:id/auto-mode { autoMode: true|false } - bat lai che do tu dong theo nguong
router.patch('/:id/auto-mode', asyncHandler(async (req, res) => {
  const result = await db.queryOne(
    `UPDATE dbo.Devices SET AutoMode = @auto
     WHERE DeviceId = @id AND DeviceType IN ('MistSprayer', 'Fan', 'Heater', 'GrowLight');
     SELECT @@ROWCOUNT AS Affected;`,
    { id: req.params.id, auto: toBool(req.body.autoMode, 'autoMode') }
  );
  if (!result.Affected) throw notFound('Không tìm thấy thiết bị điều khiển được.');
  res.json({ data: await db.queryOne(`${DEVICE_SQL} WHERE v.DeviceId = @id`, { id: req.params.id }) });
}));

// GET /api/devices/:id/commands - lich su lenh dieu khien
router.get('/:id/commands', asyncHandler(async (req, res) => {
  const paging = getPaging(req.query);
  const rows = await db.query(
    `SELECT c.CommandId, c.Command, c.Source, c.Reason, c.Status, c.CreatedAt, u.FullName AS IssuedBy,
            COUNT(*) OVER() AS TotalCount
     FROM dbo.DeviceCommands c LEFT JOIN dbo.Users u ON u.UserId = c.IssuedBy
     WHERE c.DeviceId = @id
     ORDER BY c.CreatedAt DESC, c.CommandId DESC
     OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
    { id: req.params.id, offset: paging.offset, pageSize: paging.pageSize }
  );
  res.json(paged(rows, paging));
}));

module.exports = router;
