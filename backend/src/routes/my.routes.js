// API rieng cho khach hang (app mobile): khay cua toi, giao dich, thu hoach
const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middlewares/auth');
const { notFound, asyncHandler, getPaging, paged } = require('../utils/http');

router.use(authenticate, authorize('Customer'));

// GET /api/my/trays - khay dang thue (da lien ket) + moi truong moi nhat + camera
router.get('/trays', asyncHandler(async (req, res) => {
  const rows = await db.query(
    'SELECT * FROM dbo.fn_GetCustomerTrays(@id) ORDER BY TrayCode',
    { id: req.user.id }
  );
  res.json({ data: rows });
}));

// GET /api/my/trays/:trayId - chi tiet 1 khay cua toi: nhat ky, thu hoach, nguong phong
router.get('/trays/:trayId', asyncHandler(async (req, res) => {
  const tray = await db.queryOne(
    'SELECT * FROM dbo.fn_GetCustomerTrays(@id) WHERE TrayId = @trayId',
    { id: req.user.id, trayId: req.params.trayId }
  );
  if (!tray) throw notFound('Không tìm thấy khay trong danh sách khay bạn đang thuê.');

  const [logs, harvests, thresholds] = await db.queryMulti(
    `SELECT LogId, Stage, Note, ImageUrl, LoggedAt FROM dbo.GrowthLogs
     WHERE TrayId = @trayId AND LoggedAt >= (SELECT CAST(StartDate AS DATETIME2) FROM dbo.Rentals WHERE RentalId = @rentalId)
     ORDER BY LoggedAt DESC, LogId DESC;
     SELECT h.HarvestId, h.ScheduledDate, h.HarvestedAt, h.WeightKg, h.Quality, h.Status,
            d.RequestId AS DeliveryRequestId, d.Status AS DeliveryStatus
     FROM dbo.Harvests h
     LEFT JOIN dbo.DeliveryRequests d ON d.HarvestId = h.HarvestId AND d.Status <> 'Cancelled'
     WHERE h.TrayId = @trayId AND h.RentalId = @rentalId
     ORDER BY h.ScheduledDate DESC;
     SELECT th.Metric, th.MinValue, th.MaxValue
     FROM dbo.EnvThresholds th JOIN dbo.Trays t ON t.RoomId = th.RoomId
     WHERE t.TrayId = @trayId;`,
    { trayId: req.params.trayId, rentalId: tray.RentalId }
  );
  res.json({ data: { ...tray, growthLogs: logs, harvests, thresholds } });
}));

// GET /api/my/transactions - lich su thanh toan
router.get('/transactions', asyncHandler(async (req, res) => {
  const paging = getPaging(req.query);
  const rows = await db.query(
    `SELECT p.PaymentId, p.RentalId, pk.PackageName, rn.TrayCount, p.Amount, p.Method, p.Status,
            p.TransactionRef, p.PaidAt, COUNT(*) OVER() AS TotalCount
     FROM dbo.Payments p
     JOIN dbo.Rentals rn ON rn.RentalId = p.RentalId
     JOIN dbo.RentalPackages pk ON pk.PackageId = rn.PackageId
     WHERE rn.CustomerId = @id
     ORDER BY p.PaymentId DESC
     OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
    { id: req.user.id, offset: paging.offset, pageSize: paging.pageSize }
  );
  res.json(paged(rows, paging));
}));

// GET /api/my/harvests - cac dot thu hoach cua toi + trang thai giao nhan
router.get('/harvests', asyncHandler(async (req, res) => {
  const rows = await db.query(
    `SELECT h.HarvestId, t.TrayCode, mt.TypeName, h.ScheduledDate, h.HarvestedAt, h.WeightKg, h.Quality, h.Status,
            d.RequestId AS DeliveryRequestId, d.RequestType, d.Status AS DeliveryStatus
     FROM dbo.Harvests h
     JOIN dbo.Rentals rn ON rn.RentalId = h.RentalId
     JOIN dbo.Trays t ON t.TrayId = h.TrayId
     LEFT JOIN dbo.MushroomTypes mt ON mt.MushroomTypeId = t.MushroomTypeId
     LEFT JOIN dbo.DeliveryRequests d ON d.HarvestId = h.HarvestId AND d.Status <> 'Cancelled'
     WHERE rn.CustomerId = @id
     ORDER BY h.ScheduledDate DESC`,
    { id: req.user.id }
  );
  res.json({ data: rows });
}));

module.exports = router;
