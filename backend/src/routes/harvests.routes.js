const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middlewares/auth');
const { asyncHandler } = require('../utils/http');
const { oneOf, toDate, toInt, requireFields } = require('../utils/validate');

router.use(authenticate, authorize('Admin', 'Operator'));

// GET /api/harvests?status=Scheduled|Completed|Cancelled&from=&to=
// Lich thu hoach (Scheduled) va lich su thu hoach (Completed). Ghi nhan thu hoach: POST /api/trays/:id/harvest
router.get('/', asyncHandler(async (req, res) => {
  const rows = await db.query(
    `SELECT h.HarvestId, h.TrayId, t.TrayCode, r.RoomName, mt.TypeName,
            h.RentalId, u.FullName AS CustomerName,
            h.ScheduledDate, h.HarvestedAt, h.WeightKg, h.Quality, h.Status, h.Note,
            rb.FullName AS RecordedBy
     FROM dbo.Harvests h
     JOIN dbo.Trays t ON t.TrayId = h.TrayId
     JOIN dbo.Rooms r ON r.RoomId = t.RoomId
     LEFT JOIN dbo.MushroomTypes mt ON mt.MushroomTypeId = t.MushroomTypeId
     LEFT JOIN dbo.Rentals rn ON rn.RentalId = h.RentalId
     LEFT JOIN dbo.Users u ON u.UserId = rn.CustomerId
     LEFT JOIN dbo.Users rb ON rb.UserId = h.RecordedBy
     WHERE (@status IS NULL OR h.Status = @status)
       AND (@from IS NULL OR h.ScheduledDate >= @from)
       AND (@to IS NULL OR h.ScheduledDate <= @to)
     ORDER BY CASE WHEN h.Status = 'Scheduled' THEN 0 ELSE 1 END, h.ScheduledDate`,
    {
      status: oneOf(req.query.status, ['Scheduled', 'Completed', 'Cancelled'], 'status', { optional: true }),
      from: toDate(req.query.from, 'from', { optional: true }),
      to: toDate(req.query.to, 'to', { optional: true }),
    }
  );
  res.json({ data: rows });
}));

// POST /api/harvests { trayId, scheduledDate, note? } - lap lich / doi lich thu hoach (UC36)
// Khay da co lich dang cho thi doi sang ngay moi. Khach thue nhan thong bao.
router.post('/', asyncHandler(async (req, res) => {
  requireFields(req.body, ['trayId', 'scheduledDate']);
  const { recordset } = await db.exec(
    'dbo.usp_ScheduleHarvest',
    {
      TrayId: toInt(req.body.trayId, 'trayId', { min: 1 }),
      ScheduledDate: toDate(req.body.scheduledDate, 'scheduledDate'),
      OperatorId: req.user.id,
      Note: req.body.note ? String(req.body.note).slice(0, 500) : null,
    },
    { HarvestId: db.sql.Int }
  );
  res.status(201).json({ data: recordset[0] || null });
}));

// PATCH /api/harvests/:id/cancel { note? } - huy lich thu hoach dang cho
router.patch('/:id/cancel', asyncHandler(async (req, res) => {
  const { recordset } = await db.exec('dbo.usp_CancelHarvest', {
    HarvestId: toInt(req.params.id, 'id', { min: 1 }),
    OperatorId: req.user.id,
    Note: req.body && req.body.note ? String(req.body.note).slice(0, 500) : null,
  });
  res.json({ data: recordset[0] || null });
}));

module.exports = router;
