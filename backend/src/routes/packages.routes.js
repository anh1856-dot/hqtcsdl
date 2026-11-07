const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middlewares/auth');
const { notFound, asyncHandler } = require('../utils/http');
const { requireFields, toInt, toNumber, toBool } = require('../utils/validate');

const COLUMNS = 'PackageId, PackageName, DurationDays, PricePerTray, MaxTrays, Description, IsActive, CreatedAt';

// GET /api/packages - cong khai (khong can dang nhap), chi goi dang ap dung
router.get('/', asyncHandler(async (req, res) => {
  const rows = await db.query(
    `SELECT ${COLUMNS} FROM dbo.RentalPackages WHERE IsActive = 1 ORDER BY PricePerTray`
  );
  res.json({ data: rows });
}));

// GET /api/packages/all (Admin) - ca goi da ngung ap dung
router.get('/all', authenticate, authorize('Admin'), asyncHandler(async (req, res) => {
  res.json({ data: await db.query(`SELECT ${COLUMNS} FROM dbo.RentalPackages ORDER BY PackageId`) });
}));

// POST /api/packages (Admin)
router.post('/', authenticate, authorize('Admin'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['packageName', 'durationDays', 'pricePerTray']);
  const row = await db.queryOne(
    `INSERT INTO dbo.RentalPackages (PackageName, DurationDays, PricePerTray, MaxTrays, Description)
     OUTPUT inserted.*
     VALUES (@name, @days, @price, @maxTrays, @description)`,
    {
      name: req.body.packageName,
      days: toInt(req.body.durationDays, 'durationDays', { min: 1 }),
      price: toNumber(req.body.pricePerTray, 'pricePerTray', { min: 0 }),
      maxTrays: toInt(req.body.maxTrays ?? 1, 'maxTrays', { min: 1 }),
      description: req.body.description || null,
    }
  );
  res.status(201).json({ data: row });
}));

// PUT /api/packages/:id (Admin) - gia moi chi ap dung cho don thue moi
router.put('/:id', authenticate, authorize('Admin'), asyncHandler(async (req, res) => {
  const row = await db.queryOne(
    `UPDATE dbo.RentalPackages
     SET PackageName  = COALESCE(@name, PackageName),
         DurationDays = COALESCE(@days, DurationDays),
         PricePerTray = COALESCE(@price, PricePerTray),
         MaxTrays     = COALESCE(@maxTrays, MaxTrays),
         Description  = COALESCE(@description, Description),
         IsActive     = COALESCE(@isActive, IsActive)
     OUTPUT inserted.*
     WHERE PackageId = @id`,
    {
      id: req.params.id,
      name: req.body.packageName || null,
      days: toInt(req.body.durationDays, 'durationDays', { min: 1, optional: true }),
      price: toNumber(req.body.pricePerTray, 'pricePerTray', { min: 0, optional: true }),
      maxTrays: toInt(req.body.maxTrays, 'maxTrays', { min: 1, optional: true }),
      description: req.body.description || null,
      isActive: req.body.isActive === undefined ? null : toBool(req.body.isActive, 'isActive'),
    }
  );
  if (!row) throw notFound('Không tìm thấy gói thuê.');
  res.json({ data: row });
}));

// DELETE /api/packages/:id (Admin) - ngung ap dung (giu lai vi don thue cu tham chieu)
router.delete('/:id', authenticate, authorize('Admin'), asyncHandler(async (req, res) => {
  const result = await db.queryOne(
    'UPDATE dbo.RentalPackages SET IsActive = 0 WHERE PackageId = @id; SELECT @@ROWCOUNT AS Affected;',
    { id: req.params.id }
  );
  if (!result.Affected) throw notFound('Không tìm thấy gói thuê.');
  res.status(204).end();
}));

module.exports = router;
