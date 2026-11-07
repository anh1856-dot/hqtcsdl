const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middlewares/auth');
const { asyncHandler, getPaging, paged } = require('../utils/http');
const { toInt, oneOf } = require('../utils/validate');

router.use(authenticate, authorize('Admin', 'Operator'));

// GET /api/alerts?status=Open|Acknowledged|Resolved&roomId=&severity=&page=
router.get('/', asyncHandler(async (req, res) => {
  const paging = getPaging(req.query);
  const rows = await db.query(
    `SELECT a.AlertId, a.RoomId, r.RoomCode, r.RoomName, a.Metric, a.Value, a.Severity, a.Message, a.Status,
            a.CreatedAt, a.ResolvedAt, u.FullName AS ResolvedBy, COUNT(*) OVER() AS TotalCount
     FROM dbo.Alerts a
     JOIN dbo.Rooms r ON r.RoomId = a.RoomId
     LEFT JOIN dbo.Users u ON u.UserId = a.ResolvedBy
     WHERE (@status IS NULL OR a.Status = @status)
       AND (@roomId IS NULL OR a.RoomId = @roomId)
       AND (@severity IS NULL OR a.Severity = @severity)
     ORDER BY CASE a.Status WHEN 'Open' THEN 0 WHEN 'Acknowledged' THEN 1 ELSE 2 END, a.AlertId DESC
     OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
    {
      status: oneOf(req.query.status, ['Open', 'Acknowledged', 'Resolved'], 'status', { optional: true }),
      roomId: toInt(req.query.roomId, 'roomId', { optional: true }),
      severity: oneOf(req.query.severity, ['Warning', 'Critical'], 'severity', { optional: true }),
      offset: paging.offset, pageSize: paging.pageSize,
    }
  );
  res.json(paged(rows, paging));
}));

// PATCH /api/alerts/:id { status: 'Acknowledged' | 'Resolved' }
router.patch('/:id', asyncHandler(async (req, res) => {
  await db.exec('dbo.usp_UpdateAlertStatus', {
    AlertId: toInt(req.params.id, 'id'),
    Status: oneOf(req.body.status, ['Acknowledged', 'Resolved'], 'status'),
    UserId: req.user.id,
  });
  res.json({ data: await db.queryOne('SELECT * FROM dbo.Alerts WHERE AlertId = @id', { id: req.params.id }) });
}));

module.exports = router;
