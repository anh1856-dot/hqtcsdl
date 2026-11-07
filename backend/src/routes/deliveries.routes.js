const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize, isStaff } = require('../middlewares/auth');
const { notFound, conflict, asyncHandler } = require('../utils/http');
const { requireFields, toInt, oneOf, toDate } = require('../utils/validate');

const STATUSES = ['Pending', 'Confirmed', 'Shipping', 'Completed', 'Cancelled'];
// Trang thai duoc phep chuyen tiep
const NEXT = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Shipping', 'Completed', 'Cancelled'],
  Shipping: ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
};
const STATUS_TEXT = {
  Confirmed: 'đã được xác nhận',
  Shipping: 'đang được giao',
  Completed: 'đã hoàn tất',
  Cancelled: 'đã bị hủy',
};

router.use(authenticate);

// POST /api/deliveries - khach yeu cau nhan tai trai / giao tan noi
// { harvestId, requestType: 'Pickup'|'Delivery', address?, receiverPhone?, preferredDate? }
router.post('/', authorize('Customer'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['harvestId', 'requestType']);
  const { output } = await db.exec(
    'dbo.usp_RequestDelivery',
    {
      CustomerId: req.user.id,
      HarvestId: toInt(req.body.harvestId, 'harvestId'),
      RequestType: oneOf(req.body.requestType, ['Pickup', 'Delivery'], 'requestType'),
      Address: req.body.address || null,
      ReceiverPhone: req.body.receiverPhone || null,
      PreferredDate: toDate(req.body.preferredDate, 'preferredDate', { optional: true }),
    },
    { RequestId: db.sql.Int }
  );
  const row = await db.queryOne('SELECT * FROM dbo.DeliveryRequests WHERE RequestId = @id', { id: output.RequestId });
  res.status(201).json({ data: row });
}));

// GET /api/deliveries?status= - khach: cua minh; Admin/Operator: tat ca
router.get('/', asyncHandler(async (req, res) => {
  const rows = await db.query(
    `SELECT d.RequestId, d.HarvestId, t.TrayCode, h.WeightKg, d.CustomerId, u.FullName AS CustomerName,
            d.RequestType, d.Address, d.ReceiverPhone, d.PreferredDate, d.Fee, d.Status, d.CreatedAt,
            pb.FullName AS ProcessedBy
     FROM dbo.DeliveryRequests d
     JOIN dbo.Harvests h ON h.HarvestId = d.HarvestId
     JOIN dbo.Trays t ON t.TrayId = h.TrayId
     JOIN dbo.Users u ON u.UserId = d.CustomerId
     LEFT JOIN dbo.Users pb ON pb.UserId = d.ProcessedBy
     WHERE (@customerId IS NULL OR d.CustomerId = @customerId)
       AND (@status IS NULL OR d.Status = @status)
     ORDER BY d.RequestId DESC`,
    {
      customerId: isStaff(req.user) ? null : req.user.id,
      status: oneOf(req.query.status, STATUSES, 'status', { optional: true }),
    }
  );
  res.json({ data: rows });
}));

// PATCH /api/deliveries/:id/status { status } (Admin/Operator) - cap nhat + thong bao cho khach
router.patch('/:id/status', authorize('Admin', 'Operator'), asyncHandler(async (req, res) => {
  const status = oneOf(req.body.status, STATUSES, 'status');
  const current = await db.queryOne('SELECT Status FROM dbo.DeliveryRequests WHERE RequestId = @id', { id: req.params.id });
  if (!current) throw notFound('Không tìm thấy yêu cầu giao nhận.');
  if (!NEXT[current.Status].includes(status)) {
    throw conflict(`Không thể chuyển từ "${current.Status}" sang "${status}".`);
  }

  await db.query(
    `UPDATE dbo.DeliveryRequests SET Status = @status, ProcessedBy = @userId WHERE RequestId = @id;
     INSERT INTO dbo.Notifications (UserId, Type, Title, Content)
     SELECT CustomerId, 'Delivery', N'Cập nhật giao nhận',
            CONCAT(N'Yêu cầu ', CASE RequestType WHEN 'Pickup' THEN N'nhận nấm tại trại' ELSE N'giao nấm' END,
                   N' #', RequestId, N' ', @statusText, N'.')
     FROM dbo.DeliveryRequests WHERE RequestId = @id;`,
    { id: req.params.id, status, userId: req.user.id, statusText: STATUS_TEXT[status] }
  );
  res.json({ data: await db.queryOne('SELECT * FROM dbo.DeliveryRequests WHERE RequestId = @id', { id: req.params.id }) });
}));

// PATCH /api/deliveries/:id/cancel - khach huy yeu cau dang cho xu ly
router.patch('/:id/cancel', authorize('Customer'), asyncHandler(async (req, res) => {
  const result = await db.queryOne(
    `UPDATE dbo.DeliveryRequests SET Status = 'Cancelled'
     WHERE RequestId = @id AND CustomerId = @userId AND Status = 'Pending';
     SELECT @@ROWCOUNT AS Affected;`,
    { id: req.params.id, userId: req.user.id }
  );
  if (!result.Affected) throw conflict('Chỉ hủy được yêu cầu của bạn đang ở trạng thái chờ xử lý.');
  res.json({ data: { requestId: Number(req.params.id), status: 'Cancelled' } });
}));

module.exports = router;
