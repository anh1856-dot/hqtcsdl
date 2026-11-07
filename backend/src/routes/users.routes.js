const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticate, authorize } = require('../middlewares/auth');
const { badRequest, notFound, conflict, asyncHandler, getPaging, paged } = require('../utils/http');
const { requireFields, oneOf, isEmail } = require('../utils/validate');

const ROLES = ['Admin', 'Operator', 'Customer'];

const USER_COLUMNS = `
  u.UserId, u.FullName, u.Email, u.Phone, u.Address, r.RoleName AS Role,
  u.Status, u.IsDeleted, u.CreatedAt, u.LastLoginAt`;

router.use(authenticate);

// GET /api/users?role=&status=&q=&page=&pageSize=
// Admin xem tat ca; Operator chi xem danh sach khach hang (de gan khay)
router.get('/', authorize('Admin', 'Operator'), asyncHandler(async (req, res) => {
  const paging = getPaging(req.query);
  const role = req.user.role === 'Operator' ? 'Customer' : oneOf(req.query.role, ROLES, 'role', { optional: true });
  const status = oneOf(req.query.status, ['Active', 'Disabled'], 'status', { optional: true });

  const rows = await db.query(
    `SELECT ${USER_COLUMNS}, COUNT(*) OVER() AS TotalCount
     FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId = u.RoleId
     WHERE u.IsDeleted = 0
       AND (@role IS NULL OR r.RoleName = @role)
       AND (@status IS NULL OR u.Status = @status)
       AND (@q IS NULL OR u.FullName LIKE N'%' + @q + N'%' OR u.Email LIKE '%' + @q + '%' OR u.Phone LIKE '%' + @q + '%')
     ORDER BY u.UserId
     OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`,
    { role, status, q: req.query.q || null, offset: paging.offset, pageSize: paging.pageSize }
  );
  res.json(paged(rows, paging));
}));

// GET /api/users/:id
router.get('/:id', authorize('Admin'), asyncHandler(async (req, res) => {
  const user = await db.queryOne(
    `SELECT ${USER_COLUMNS} FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId = u.RoleId WHERE u.UserId = @id`,
    { id: req.params.id }
  );
  if (!user) throw notFound('Không tìm thấy tài khoản.');
  res.json({ data: user });
}));

// POST /api/users - Admin tao tai khoan (moi vai tro)
router.post('/', authorize('Admin'), asyncHandler(async (req, res) => {
  const { fullName, email, password, phone, address } = req.body;
  requireFields(req.body, ['fullName', 'email', 'password', 'role']);
  const role = oneOf(req.body.role, ROLES, 'role');
  if (!isEmail(email)) throw badRequest('Email không hợp lệ.');
  if (String(password).length < 6) throw badRequest('Mật khẩu phải có ít nhất 6 ký tự.');

  const created = await db.queryOne(
    // Bang Users co trigger nen khong dung OUTPUT, lay id bang SCOPE_IDENTITY()
    `INSERT INTO dbo.Users (RoleId, FullName, Email, Phone, PasswordHash, Address)
     SELECT RoleId, @fullName, @email, @phone, @hash, @address FROM dbo.Roles WHERE RoleName = @role;
     SELECT CAST(SCOPE_IDENTITY() AS INT) AS UserId;`,
    {
      role, fullName, email: email.trim().toLowerCase(), phone: phone || null,
      hash: await bcrypt.hash(password, 10), address: address || null,
    }
  );
  const user = await db.queryOne(
    `SELECT ${USER_COLUMNS} FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId = u.RoleId WHERE u.UserId = @id`,
    { id: created.UserId }
  );
  res.status(201).json({ data: user });
}));

// PUT /api/users/:id - sua thong tin, doi vai tro
router.put('/:id', authorize('Admin'), asyncHandler(async (req, res) => {
  const { fullName, phone, address } = req.body;
  const role = oneOf(req.body.role, ROLES, 'role', { optional: true });
  if (role && Number(req.params.id) === req.user.id && role !== 'Admin') {
    throw badRequest('Không thể tự hạ quyền Admin của chính mình.');
  }

  const result = await db.queryOne(
    `UPDATE u
     SET FullName  = COALESCE(@fullName, u.FullName),
         Phone     = CASE WHEN @setPhone = 1 THEN @phone ELSE u.Phone END,
         Address   = CASE WHEN @setAddress = 1 THEN @address ELSE u.Address END,
         RoleId    = COALESCE((SELECT RoleId FROM dbo.Roles WHERE RoleName = @role), u.RoleId),
         UpdatedAt = SYSDATETIME()
     FROM dbo.Users u
     WHERE u.UserId = @id AND u.IsDeleted = 0;
     SELECT @@ROWCOUNT AS Affected;`,
    {
      id: req.params.id, fullName: fullName || null, role,
      setPhone: phone !== undefined ? 1 : 0, phone: phone || null,
      setAddress: address !== undefined ? 1 : 0, address: address || null,
    }
  );
  if (!result.Affected) throw notFound('Không tìm thấy tài khoản.');
  const user = await db.queryOne(
    `SELECT ${USER_COLUMNS} FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId = u.RoleId WHERE u.UserId = @id`,
    { id: req.params.id }
  );
  res.json({ data: user });
}));

// PATCH /api/users/:id/status { status: 'Active' | 'Disabled' } - khoa / mo khoa
router.patch('/:id/status', authorize('Admin'), asyncHandler(async (req, res) => {
  const status = oneOf(req.body.status, ['Active', 'Disabled'], 'status');
  if (Number(req.params.id) === req.user.id) throw conflict('Không thể tự khóa tài khoản của chính mình.');

  const result = await db.queryOne(
    `UPDATE dbo.Users SET Status = @status, UpdatedAt = SYSDATETIME()
     WHERE UserId = @id AND IsDeleted = 0;
     SELECT @@ROWCOUNT AS Affected;`,
    { id: req.params.id, status }
  );
  if (!result.Affected) throw notFound('Không tìm thấy tài khoản.');
  res.json({ data: { UserId: Number(req.params.id), Status: status } });
}));

// PUT /api/users/:id/password { newPassword } - Admin dat lai mat khau
router.put('/:id/password', authorize('Admin'), asyncHandler(async (req, res) => {
  requireFields(req.body, ['newPassword']);
  if (String(req.body.newPassword).length < 6) throw badRequest('Mật khẩu phải có ít nhất 6 ký tự.');

  const result = await db.queryOne(
    `UPDATE dbo.Users SET PasswordHash = @hash, UpdatedAt = SYSDATETIME()
     WHERE UserId = @id AND IsDeleted = 0;
     SELECT @@ROWCOUNT AS Affected;`,
    { id: req.params.id, hash: await bcrypt.hash(req.body.newPassword, 10) }
  );
  if (!result.Affected) throw notFound('Không tìm thấy tài khoản.');
  res.json({ data: { message: 'Đã đặt lại mật khẩu.' } });
}));

// DELETE /api/users/:id - xoa mem (trigger trg_Users_InsteadOfDelete)
router.delete('/:id', authorize('Admin'), asyncHandler(async (req, res) => {
  if (Number(req.params.id) === req.user.id) throw conflict('Không thể tự xóa tài khoản của chính mình.');
  const exists = await db.queryOne('SELECT 1 AS x FROM dbo.Users WHERE UserId = @id AND IsDeleted = 0', { id: req.params.id });
  if (!exists) throw notFound('Không tìm thấy tài khoản.');
  await db.query('DELETE FROM dbo.Users WHERE UserId = @id', { id: req.params.id });
  res.status(204).end();
}));

module.exports = router;
