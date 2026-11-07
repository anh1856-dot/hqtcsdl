const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middlewares/auth');
const { notFound, conflict, asyncHandler } = require('../utils/http');
const { requireFields, toInt, toNumber, oneOf } = require('../utils/validate');

const STATUSES = ['Available', 'Rented', 'Growing', 'ReadyToHarvest', 'Harvested', 'Maintenance'];
const STAGES = ['Inoculation', 'Incubation', 'Pinning', 'Fruiting', 'Harvest'];

router.use(authenticate);

// GET /api/trays/available - khay con trong theo phong / loai nam (khach xem truoc khi thue)
router.get('/available', asyncHandler(async (req, res) => {
  const rows = await db.query(
    `SELECT v.RoomId, v.RoomName, v.MushroomTypeId, v.TypeName, COUNT(*) AS AvailableTrays
     FROM dbo.vw_TrayOverview v
     JOIN dbo.Rooms r ON r.RoomId = v.RoomId AND r.Status = 'Active'
     WHERE v.Status = 'Available'
     GROUP BY v.RoomId, v.RoomName, v.MushroomTypeId, v.TypeName
     ORDER BY v.RoomName`
  );
  res.json({ data: rows });
}));

// Tu day tro xuong chi danh cho Admin / Operator
router.use(authorize('Admin', 'Operator'));

// GET /api/trays?roomId=&status=&q=
router.get('/', asyncHandler(async (req, res) => {
  const rows = await db.query(
    `SELECT * FROM dbo.vw_TrayOverview
     WHERE (@roomId IS NULL OR RoomId = @roomId)
       AND (@status IS NULL OR Status = @status)
       AND (@q IS NULL OR TrayCode LIKE '%' + @q + '%' OR CustomerName LIKE N'%' + @q + N'%')
     ORDER BY TrayCode`,
    {
      roomId: toInt(req.query.roomId, 'roomId', { optional: true }),
      status: oneOf(req.query.status, STATUSES, 'status', { optional: true }),
      q: req.query.q || null,
    }
  );
  res.json({ data: rows });
}));

// GET /api/trays/:id - chi tiet khay + nhat ky phat trien + thu hoach
router.get('/:id', asyncHandler(async (req, res) => {
  const [trays, logs, harvests] = await db.queryMulti(
    `SELECT * FROM dbo.vw_TrayOverview WHERE TrayId = @id;
     SELECT g.LogId, g.Stage, g.Note, g.ImageUrl, g.LoggedAt, u.FullName AS LoggedBy
     FROM dbo.GrowthLogs g JOIN dbo.Users u ON u.UserId = g.LoggedBy
     WHERE g.TrayId = @id ORDER BY g.LoggedAt DESC, g.LogId DESC;
     SELECT HarvestId, RentalId, ScheduledDate, HarvestedAt, WeightKg, Quality, Status, Note
     FROM dbo.Harvests WHERE TrayId = @id ORDER BY ScheduledDate DESC;`,
    { id: req.params.id }
  );
  if (!trays.length) throw notFound('Không tìm thấy khay.');
  res.json({ data: { ...trays[0], growthLogs: logs, harvests } });
}));

// POST /api/trays { roomId, quantity?, mushroomTypeId?, positionLabel? }
// Ma khay tu sinh: TRAY-<RoomCode>-001, 002, ...
router.post('/', asyncHandler(async (req, res) => {
  requireFields(req.body, ['roomId']);
  const roomId = toInt(req.body.roomId, 'roomId');
  const quantity = toInt(req.body.quantity ?? 1, 'quantity', { min: 1, max: 100 });

  const room = await db.queryOne('SELECT RoomCode FROM dbo.Rooms WHERE RoomId = @roomId', { roomId });
  if (!room) throw notFound('Không tìm thấy phòng.');

  // Bang Trays co trigger nen OUTPUT phai ghi vao bien bang (OUTPUT ... INTO)
  const rows = await db.query(
    `SET XACT_ABORT ON;
     BEGIN TRANSACTION;
     DECLARE @New TABLE (TrayId INT, TrayCode VARCHAR(20));
     DECLARE @MaxNo INT = (SELECT MAX(TRY_CAST(RIGHT(TrayCode, 3) AS INT))
                           FROM dbo.Trays WITH (UPDLOCK, HOLDLOCK) WHERE RoomId = @roomId);
     WITH Ten AS (SELECT n FROM (VALUES (0),(0),(0),(0),(0),(0),(0),(0),(0),(0)) v(n)),
          Nums AS (SELECT TOP (@quantity) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n FROM Ten a CROSS JOIN Ten b)
     INSERT INTO dbo.Trays (TrayCode, RoomId, MushroomTypeId, PositionLabel)
     OUTPUT inserted.TrayId, inserted.TrayCode INTO @New
     SELECT CONCAT('TRAY-', @roomCode, '-', FORMAT(ISNULL(@MaxNo, 0) + n, '000')), @roomId, @typeId, @position
     FROM Nums;
     COMMIT TRANSACTION;
     SELECT TrayId, TrayCode FROM @New ORDER BY TrayId;`,
    {
      roomId, quantity, roomCode: room.RoomCode,
      typeId: toInt(req.body.mushroomTypeId, 'mushroomTypeId', { optional: true }),
      position: req.body.positionLabel || null,
    }
  );
  res.status(201).json({ data: rows });
}));

// PUT /api/trays/:id { roomId?, mushroomTypeId?, positionLabel? }
router.put('/:id', asyncHandler(async (req, res) => {
  const tray = await db.queryOne('SELECT Status FROM dbo.Trays WHERE TrayId = @id', { id: req.params.id });
  if (!tray) throw notFound('Không tìm thấy khay.');
  const roomId = toInt(req.body.roomId, 'roomId', { optional: true });
  if (roomId !== null && tray.Status !== 'Available' && tray.Status !== 'Maintenance') {
    throw conflict('Chỉ chuyển phòng cho khay đang trống hoặc bảo trì.');
  }
  await db.query(
    `UPDATE dbo.Trays
     SET RoomId         = COALESCE(@roomId, RoomId),
         MushroomTypeId = COALESCE(@typeId, MushroomTypeId),
         PositionLabel  = COALESCE(@position, PositionLabel),
         UpdatedAt      = SYSDATETIME()
     WHERE TrayId = @id`,
    {
      id: req.params.id, roomId,
      typeId: toInt(req.body.mushroomTypeId, 'mushroomTypeId', { optional: true }),
      position: req.body.positionLabel || null,
    }
  );
  res.json({ data: await db.queryOne('SELECT * FROM dbo.vw_TrayOverview WHERE TrayId = @id', { id: req.params.id }) });
}));

// PATCH /api/trays/:id/status { status: 'Available' | 'Maintenance' }
// Don khay sau thu hoach / dua vao bao tri. Khay con don thue -> ve 'Rented' de trong vu moi.
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const target = oneOf(req.body.status, ['Available', 'Maintenance'], 'status');
  const tray = await db.queryOne(
    `SELECT t.Status, CASE WHEN rt.RentalTrayId IS NULL THEN 0 ELSE 1 END AS HasRental
     FROM dbo.Trays t LEFT JOIN dbo.RentalTrays rt ON rt.TrayId = t.TrayId AND rt.IsActive = 1
     WHERE t.TrayId = @id`,
    { id: req.params.id }
  );
  if (!tray) throw notFound('Không tìm thấy khay.');
  if (['Growing', 'ReadyToHarvest'].includes(tray.Status)) {
    throw conflict('Khay đang trồng hoặc chờ thu hoạch, không thể đổi trạng thái.');
  }
  const newStatus = target === 'Available' && tray.HasRental ? 'Rented' : target;
  await db.query(
    `UPDATE dbo.Trays
     SET Status = @status, Stage = NULL, PlantedDate = NULL, ExpectedHarvestDate = NULL, UpdatedAt = SYSDATETIME()
     WHERE TrayId = @id`,
    { id: req.params.id, status: newStatus }
  );
  res.json({ data: await db.queryOne('SELECT * FROM dbo.vw_TrayOverview WHERE TrayId = @id', { id: req.params.id }) });
}));

// DELETE /api/trays/:id (Admin) - chi xoa duoc khay chua tung dung (409 neu co lich su)
router.delete('/:id', authorize('Admin'), asyncHandler(async (req, res) => {
  const result = await db.queryOne('DELETE FROM dbo.Trays WHERE TrayId = @id; SELECT @@ROWCOUNT AS Affected;', { id: req.params.id });
  if (!result.Affected) throw notFound('Không tìm thấy khay.');
  res.status(204).end();
}));

// POST /api/trays/:id/start { mushroomTypeId, note? } - bat dau vu trong
router.post('/:id/start', asyncHandler(async (req, res) => {
  requireFields(req.body, ['mushroomTypeId']);
  await db.exec('dbo.usp_StartCultivation', {
    TrayId: toInt(req.params.id, 'id'),
    MushroomTypeId: toInt(req.body.mushroomTypeId, 'mushroomTypeId'),
    OperatorId: req.user.id,
    Note: req.body.note || null,
  });
  res.json({ data: await db.queryOne('SELECT * FROM dbo.vw_TrayOverview WHERE TrayId = @id', { id: req.params.id }) });
}));

// POST /api/trays/:id/stage { stage, note?, imageUrl? } - cap nhat giai doan
router.post('/:id/stage', asyncHandler(async (req, res) => {
  await db.exec('dbo.usp_UpdateTrayStage', {
    TrayId: toInt(req.params.id, 'id'),
    NewStage: oneOf(req.body.stage, STAGES, 'stage'),
    OperatorId: req.user.id,
    Note: req.body.note || null,
    ImageUrl: req.body.imageUrl || null,
  });
  res.json({ data: await db.queryOne('SELECT * FROM dbo.vw_TrayOverview WHERE TrayId = @id', { id: req.params.id }) });
}));

// POST /api/trays/:id/logs { note, imageUrl? } - ghi nhat ky (khong doi giai doan)
router.post('/:id/logs', asyncHandler(async (req, res) => {
  requireFields(req.body, ['note']);
  const tray = await db.queryOne('SELECT Stage FROM dbo.Trays WHERE TrayId = @id', { id: req.params.id });
  if (!tray) throw notFound('Không tìm thấy khay.');
  if (!tray.Stage) throw conflict('Khay chưa trồng, không thể ghi nhật ký.');
  const log = await db.queryOne(
    `INSERT INTO dbo.GrowthLogs (TrayId, Stage, Note, ImageUrl, LoggedBy)
     OUTPUT inserted.*
     VALUES (@id, @stage, @note, @imageUrl, @userId)`,
    { id: req.params.id, stage: tray.Stage, note: req.body.note, imageUrl: req.body.imageUrl || null, userId: req.user.id }
  );
  res.status(201).json({ data: log });
}));

// POST /api/trays/:id/harvest { weightKg, quality: 'A'|'B'|'C', note? }
router.post('/:id/harvest', asyncHandler(async (req, res) => {
  requireFields(req.body, ['weightKg', 'quality']);
  const { recordset } = await db.exec('dbo.usp_RecordHarvest', {
    TrayId: toInt(req.params.id, 'id'),
    WeightKg: toNumber(req.body.weightKg, 'weightKg', { min: 0, max: 9999 }),
    Quality: oneOf(req.body.quality, ['A', 'B', 'C'], 'quality'),
    OperatorId: req.user.id,
    Note: req.body.note || null,
  });
  res.json({ data: { harvestId: recordset[0].HarvestId } });
}));

module.exports = router;
