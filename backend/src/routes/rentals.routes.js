const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize, isStaff } = require('../middlewares/auth');
const { notFound, forbidden, asyncHandler, getPaging, paged } = require('../utils/http');
const { requireFields, toInt, oneOf } = require('../utils/validate');

const PAYMENT_METHODS = ['Cash', 'BankTransfer', 'EWallet', 'Card'];
const RENTAL_STATUSES = ['Pending', 'Active', 'Completed', 'Cancelled'];

router.use(authenticate);

// POST /api/rentals - khach thue khay online (thanh toan gia lap thanh cong ngay)
// { packageId, trayCount?, roomId?, mushroomTypeId?, paymentMethod? }
router.post('/', authorize('Customer'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['packageId']);
  const { recordset, output } = await db.exec(
    'dbo.usp_RentTrays',
    {
      CustomerId: req.user.id,
      PackageId: toInt(req.body.packageId, 'packageId'),
      TrayCount: toInt(req.body.trayCount ?? 1, 'trayCount', { min: 1 }),
      RoomId: toInt(req.body.roomId, 'roomId', { optional: true }),
      MushroomTypeId: toInt(req.body.mushroomTypeId, 'mushroomTypeId', { optional: true }),
      PaymentMethod: oneOf(req.body.paymentMethod, PAYMENT_METHODS, 'paymentMethod', { optional: true }) || 'EWallet',
    },
    { RentalId: db.sql.Int }
  );
  res.status(201).json({ data: { rentalId: output.RentalId, trays: recordset } });
}));

// POST /api/rentals/assign - Operator gan 1 khay cho khach thue tai trai
// { customerId, packageId, trayCode, paymentMethod? }
router.post('/assign', authorize('Admin', 'Operator'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['customerId', 'packageId', 'trayCode']);
  const { output } = await db.exec(
    'dbo.usp_AssignTrayToCustomer',
    {
      OperatorId: req.user.id,
      CustomerId: toInt(req.body.customerId, 'customerId'),
      PackageId: toInt(req.body.packageId, 'packageId'),
      TrayCode: String(req.body.trayCode).trim().toUpperCase(),
      PaymentMethod: oneOf(req.body.paymentMethod, PAYMENT_METHODS, 'paymentMethod', { optional: true }) || 'Cash',
    },
    { RentalId: db.sql.Int }
  );
  res.status(201).json({ data: { rentalId: output.RentalId } });
}));

// POST /api/rentals/link { trayCode } - khach nhap ma khay de lien ket vao tai khoan
router.post('/link', authorize('Customer'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['trayCode']);
  const { recordset } = await db.exec('dbo.usp_LinkTrayByCode', {
    CustomerId: req.user.id,
    TrayCode: String(req.body.trayCode).trim().toUpperCase(),
  });
  res.json({ data: recordset[0] || null });
}));

// POST /api/rentals/:id/extend { terms?, paymentMethod? } - gia han don thue (BR14 / UC22)
// Khach: chi gia han don cua minh. Admin/Operator: gia han ho khach.
router.post('/:id/extend', asyncHandler(async (req, res) => {
  const { recordset, output } = await db.exec(
    'dbo.usp_ExtendRental',
    {
      RentalId: toInt(req.params.id, 'id', { min: 1 }),
      ActorId: req.user.id,
      Terms: toInt(req.body.terms ?? 1, 'terms', { min: 1, max: 12 }),
      PaymentMethod: oneOf(req.body.paymentMethod, PAYMENT_METHODS, 'paymentMethod', { optional: true })
        || (isStaff(req.user) ? 'Cash' : 'EWallet'),
    },
    { NewEndDate: db.sql.Date }
  );
  res.json({ data: recordset[0] || { rentalId: Number(req.params.id), endDate: output.NewEndDate } });
}));

// POST /api/rentals/complete-expired (Admin) - dong don het han ngay (binh thuong scheduler tu chay)
router.post('/complete-expired', authorize('Admin'), asyncHandler(async (req, res) => {
  const { recordset } = await db.exec('dbo.usp_CompleteExpiredRentals');
  res.json({ data: { completed: recordset } });
}));

// GET /api/rentals?status=&customerId=&page=
// Khach: don cua minh. Admin/Operator: tat ca
router.get('/', asyncHandler(async (req, res) => {
  const paging = getPaging(req.query);
  const customerId = isStaff(req.user) ? toInt(req.query.customerId, 'customerId', { optional: true }) : req.user.id;
  const rows = await db.query(
    `SELECT rn.RentalId, rn.CustomerId, u.FullName AS CustomerName, rn.PackageId, p.PackageName,
            rn.StartDate, rn.EndDate, rn.TrayCount, rn.TotalAmount, rn.Status, rn.CreatedAt,
            op.FullName AS AssignedBy,
            (SELECT STRING_AGG(t.TrayCode, ', ') FROM dbo.RentalTrays rt JOIN dbo.Trays t ON t.TrayId = rt.TrayId
             WHERE rt.RentalId = rn.RentalId) AS TrayCodes,
            COUNT(*) OVER() AS TotalCount
     FROM dbo.Rentals rn
     JOIN dbo.Users u           ON u.UserId = rn.CustomerId
     JOIN dbo.RentalPackages p  ON p.PackageId = rn.PackageId
     LEFT JOIN dbo.Users op     ON op.UserId = rn.CreatedBy
     WHERE (@customerId IS NULL OR rn.CustomerId = @customerId)
       AND (@status IS NULL OR rn.Status = @status)
     ORDER BY rn.RentalId DESC
     OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
    {
      customerId,
      status: oneOf(req.query.status, RENTAL_STATUSES, 'status', { optional: true }),
      offset: paging.offset, pageSize: paging.pageSize,
    }
  );
  res.json(paged(rows, paging));
}));

// GET /api/rentals/:id - chi tiet don: khay, thanh toan
router.get('/:id', asyncHandler(async (req, res) => {
  const [rentals, trays, payments] = await db.queryMulti(
    `SELECT rn.*, u.FullName AS CustomerName, p.PackageName, p.DurationDays, p.PricePerTray
     FROM dbo.Rentals rn
     JOIN dbo.Users u ON u.UserId = rn.CustomerId
     JOIN dbo.RentalPackages p ON p.PackageId = rn.PackageId
     WHERE rn.RentalId = @id;
     SELECT t.TrayId, t.TrayCode, r.RoomName, t.Status, t.Stage, t.ExpectedHarvestDate, rt.IsActive, rt.IsLinked, rt.LinkedAt
     FROM dbo.RentalTrays rt
     JOIN dbo.Trays t ON t.TrayId = rt.TrayId
     JOIN dbo.Rooms r ON r.RoomId = t.RoomId
     WHERE rt.RentalId = @id;
     SELECT PaymentId, Amount, Method, Status, TransactionRef, PaidAt, CreatedAt
     FROM dbo.Payments WHERE RentalId = @id ORDER BY PaymentId;`,
    { id: req.params.id }
  );
  if (!rentals.length) throw notFound('Không tìm thấy đơn thuê.');
  if (!isStaff(req.user) && rentals[0].CustomerId !== req.user.id) throw forbidden('Đơn thuê này không phải của bạn.');
  res.json({ data: { ...rentals[0], trays, payments } });
}));

module.exports = router;
