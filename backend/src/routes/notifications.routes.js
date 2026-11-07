const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middlewares/auth');
const { notFound, asyncHandler, getPaging, paged } = require('../utils/http');
const { requireFields, toBool } = require('../utils/validate');

router.use(authenticate);

// GET /api/notifications?unreadOnly=true&page= - thong bao cua toi (kem so chua doc)
router.get('/', asyncHandler(async (req, res) => {
  const paging = getPaging(req.query);
  const unreadOnly = req.query.unreadOnly === 'true';
  const [rows, counts] = await db.queryMulti(
    `SELECT NotificationId, Type, Title, Content, AlertId, TrayId, IsRead, CreatedAt, COUNT(*) OVER() AS TotalCount
     FROM dbo.Notifications
     WHERE UserId = @userId AND (@unreadOnly = 0 OR IsRead = 0)
     ORDER BY NotificationId DESC
     OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
     SELECT COUNT(*) AS UnreadCount FROM dbo.Notifications WHERE UserId = @userId AND IsRead = 0;`,
    { userId: req.user.id, unreadOnly: unreadOnly ? 1 : 0, offset: paging.offset, pageSize: paging.pageSize }
  );
  res.json({ ...paged(rows, paging), unreadCount: counts[0].UnreadCount });
}));

// PATCH /api/notifications/read-all
router.patch('/read-all', asyncHandler(async (req, res) => {
  const result = await db.queryOne(
    'UPDATE dbo.Notifications SET IsRead = 1 WHERE UserId = @userId AND IsRead = 0; SELECT @@ROWCOUNT AS Affected;',
    { userId: req.user.id }
  );
  res.json({ data: { updated: result.Affected } });
}));

// GET /api/notifications/preferences - cac loai thong bao va trang thai bat/tat cua toi
router.get('/preferences', asyncHandler(async (req, res) => {
  const rows = await db.query(
    `SELECT s.Type, s.DisplayName, s.IsEnabled AS SystemEnabled,
            ISNULL(p.IsEnabled, CAST(1 AS BIT)) AS UserEnabled
     FROM dbo.NotificationSettings s
     LEFT JOIN dbo.UserNotificationPrefs p ON p.Type = s.Type AND p.UserId = @userId
     ORDER BY s.Type`,
    { userId: req.user.id }
  );
  res.json({ data: rows });
}));

// PUT /api/notifications/preferences { type, isEnabled }
router.put('/preferences', asyncHandler(async (req, res) => {
  requireFields(req.body, ['type', 'isEnabled']);
  await db.exec('dbo.usp_SetUserNotificationPref', {
    UserId: req.user.id,
    Type: req.body.type,
    IsEnabled: toBool(req.body.isEnabled, 'isEnabled'),
  });
  res.json({ data: { type: req.body.type, isEnabled: toBool(req.body.isEnabled, 'isEnabled') } });
}));

// GET /api/notifications/settings (Admin) - cau hinh toan he thong
router.get('/settings', authorize('Admin'), asyncHandler(async (req, res) => {
  const rows = await db.query(
    `SELECT s.Type, s.DisplayName, s.IsEnabled, s.UpdatedAt, u.FullName AS UpdatedBy
     FROM dbo.NotificationSettings s LEFT JOIN dbo.Users u ON u.UserId = s.UpdatedBy ORDER BY s.Type`
  );
  res.json({ data: rows });
}));

// PUT /api/notifications/settings/:type (Admin) { isEnabled }
router.put('/settings/:type', authorize('Admin'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['isEnabled']);
  await db.exec('dbo.usp_SetNotificationSetting', {
    Type: req.params.type,
    IsEnabled: toBool(req.body.isEnabled, 'isEnabled'),
    AdminId: req.user.id,
  });
  res.json({ data: await db.queryOne('SELECT * FROM dbo.NotificationSettings WHERE Type = @type', { type: req.params.type }) });
}));

// PATCH /api/notifications/:id/read
router.patch('/:id/read', asyncHandler(async (req, res) => {
  const result = await db.queryOne(
    'UPDATE dbo.Notifications SET IsRead = 1 WHERE NotificationId = @id AND UserId = @userId; SELECT @@ROWCOUNT AS Affected;',
    { id: req.params.id, userId: req.user.id }
  );
  if (!result.Affected) throw notFound('Không tìm thấy thông báo.');
  res.json({ data: { notificationId: Number(req.params.id), isRead: true } });
}));

// DELETE /api/notifications/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await db.queryOne(
    'DELETE FROM dbo.Notifications WHERE NotificationId = @id AND UserId = @userId; SELECT @@ROWCOUNT AS Affected;',
    { id: req.params.id, userId: req.user.id }
  );
  if (!result.Affected) throw notFound('Không tìm thấy thông báo.');
  res.status(204).end();
}));

module.exports = router;
