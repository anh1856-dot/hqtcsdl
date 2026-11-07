const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middlewares/auth');
const { notFound, asyncHandler } = require('../utils/http');
const { requireFields, toInt, toNumber } = require('../utils/validate');

router.use(authenticate);

// GET /api/mushroom-types
router.get('/', asyncHandler(async (req, res) => {
  const rows = await db.query(
    'SELECT MushroomTypeId, TypeName, GrowthDays, ExpectedYieldKg, Description, ImageUrl FROM dbo.MushroomTypes ORDER BY TypeName'
  );
  res.json({ data: rows });
}));

// POST /api/mushroom-types (Admin)
router.post('/', authorize('Admin'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['typeName', 'growthDays']);
  const row = await db.queryOne(
    `INSERT INTO dbo.MushroomTypes (TypeName, GrowthDays, ExpectedYieldKg, Description, ImageUrl)
     OUTPUT inserted.*
     VALUES (@typeName, @growthDays, @yield, @description, @imageUrl)`,
    {
      typeName: req.body.typeName,
      growthDays: toInt(req.body.growthDays, 'growthDays', { min: 1 }),
      yield: toNumber(req.body.expectedYieldKg, 'expectedYieldKg', { min: 0, optional: true }),
      description: req.body.description || null,
      imageUrl: req.body.imageUrl || null,
    }
  );
  res.status(201).json({ data: row });
}));

// PUT /api/mushroom-types/:id (Admin)
router.put('/:id', authorize('Admin'), asyncHandler(async (req, res) => {
  const row = await db.queryOne(
    `UPDATE dbo.MushroomTypes
     SET TypeName        = COALESCE(@typeName, TypeName),
         GrowthDays      = COALESCE(@growthDays, GrowthDays),
         ExpectedYieldKg = COALESCE(@yield, ExpectedYieldKg),
         Description     = COALESCE(@description, Description),
         ImageUrl        = COALESCE(@imageUrl, ImageUrl)
     OUTPUT inserted.*
     WHERE MushroomTypeId = @id`,
    {
      id: req.params.id,
      typeName: req.body.typeName || null,
      growthDays: toInt(req.body.growthDays, 'growthDays', { min: 1, optional: true }),
      yield: toNumber(req.body.expectedYieldKg, 'expectedYieldKg', { min: 0, optional: true }),
      description: req.body.description || null,
      imageUrl: req.body.imageUrl || null,
    }
  );
  if (!row) throw notFound('Không tìm thấy loại nấm.');
  res.json({ data: row });
}));

// DELETE /api/mushroom-types/:id (Admin) - loi 409 neu dang duoc khay su dung
router.delete('/:id', authorize('Admin'), asyncHandler(async (req, res) => {
  const result = await db.queryOne(
    'DELETE FROM dbo.MushroomTypes WHERE MushroomTypeId = @id; SELECT @@ROWCOUNT AS Affected;',
    { id: req.params.id }
  );
  if (!result.Affected) throw notFound('Không tìm thấy loại nấm.');
  res.status(204).end();
}));

module.exports = router;
